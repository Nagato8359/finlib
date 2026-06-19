import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { makeS, fEur, fDate } from '../../utils/constants';
import { AssetLogo, stockLogoSources } from '../Modals';
import UpgradeWall from '../UpgradeWall';

const INDICES = [
  { ticker: '^FCHI', label: 'CAC 40',  color: '#60a5fa' },
  { ticker: '^GSPC', label: 'S&P 500', color: '#4ade80' },
  { ticker: '^IXIC', label: 'Nasdaq',  color: '#a78bfa' },
  { ticker: 'BTC',   label: 'Bitcoin', color: '#f97316' },
  { ticker: 'GC=F',  label: 'Or',      color: '#facc15' },
];

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/i;

// Stablecoins / chain gas tokens have no meaningful market "variation" to show here.
const NON_MARKET_TICKERS = new Set(['XDAI', 'WXDAI', 'USDC', 'USDT', 'DAI', 'BUSD']);

const PLACEHOLDER_COLORS = ['#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#facc15', '#f87171'];
function colorForSource(source) {
  let h = 0;
  for (let i = 0; i < (source || '').length; i++) h = (h * 31 + source.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_COLORS[h % PLACEHOLDER_COLORS.length];
}

function extractHeldTickers(investments) {
  const map = new Map();
  for (const inv of investments || []) {
    for (const pos of inv.positions || []) {
      if (['other', 'realestate', 'commodity'].includes(pos.posType)) continue;
      const key = (pos.isin || pos.ticker || '').toUpperCase();
      if (key && !NON_MARKET_TICKERS.has(key) && !map.has(key)) map.set(key, pos.name || pos.ticker || key);
    }
  }
  return map;
}

// Mirrors api/cron-prices.js's own divTickerSet logic so lookups hit real rows
// in dividend_events (which is keyed on resolved tickers, never ISINs).
function extractDividendTickers(investments) {
  const set = new Set();
  for (const inv of investments || []) {
    for (const pos of inv.positions || []) {
      if (['stock', 'etf'].includes(pos.posType) && pos.ticker && !ISIN_RE.test(pos.ticker)) {
        set.add(pos.ticker.split('.')[0].toUpperCase());
      }
    }
  }
  return [...set];
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return 'à l\'instant';
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

export default function VeilleMarche({ T, data }) {
  const S = makeS(T);
  const { investments = [] } = data || {};

  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);

  const [quotes, setQuotes] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(true);

  const [upcomingDivs, setUpcomingDivs] = useState([]);

  const heldMap = useMemo(() => extractHeldTickers(investments), [investments]);
  const heldTickers = useMemo(() => [...heldMap.keys()], [heldMap]);
  const divTickers = useMemo(() => extractDividendTickers(investments), [investments]);
  const allTickers = useMemo(
    () => [...new Set([...heldTickers, ...INDICES.map(i => i.ticker)])],
    [heldTickers]
  );

  // Once quotes have loaded, hide rows that never resolved to a real price
  // instead of rendering a row of bare dashes.
  const displayTickers = useMemo(
    () => heldTickers.filter(t => quotesLoading || quotes[t]?.price != null),
    [heldTickers, quotes, quotesLoading]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/prices?action=news');
        const json = await res.json();
        if (!cancelled) setNews(json.items || []);
      } catch {
        if (!cancelled) setNewsError(true);
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!allTickers.length) { setQuotesLoading(false); return; }
    let cancelled = false;
    (async () => {
      setQuotesLoading(true);
      try {
        const priceRes = await fetch(`/api/prices?tickers=${allTickers.map(encodeURIComponent).join(',')}`);
        const priceMap = await priceRes.json();

        const entries = await Promise.all(allTickers.map(async ticker => {
          const [r1j, r1s] = await Promise.all([
            fetch(`/api/prices?action=performance&key=${encodeURIComponent(ticker)}&tf=1J`).then(r => r.json()).catch(() => ({})),
            fetch(`/api/prices?action=performance&key=${encodeURIComponent(ticker)}&tf=1S`).then(r => r.json()).catch(() => ({})),
          ]);
          return [ticker, {
            price: priceMap[ticker] ?? null,
            change1J: typeof r1j.changePct === 'number' ? r1j.changePct : null,
            change1S: typeof r1s.changePct === 'number' ? r1s.changePct : null,
          }];
        }));
        if (!cancelled) setQuotes(Object.fromEntries(entries));
      } catch {
        // keep previous quotes on transient failure
      } finally {
        if (!cancelled) setQuotesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allTickers]);

  useEffect(() => {
    if (!divTickers.length) { setUpcomingDivs([]); return; }
    let cancelled = false;
    (async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from('dividend_events')
        .select('ticker, ex_date, amount, currency, amount_eur, status')
        .in('ticker', divTickers)
        .gte('ex_date', todayStr)
        .order('ex_date', { ascending: true })
        .limit(8);
      if (!cancelled) setUpcomingDivs(rows || []);
    })();
    return () => { cancelled = true; };
  }, [divTickers]);

  const VarCell = ({ value, size = 13 }) => {
    if (value == null) return <span style={{ color: T.textFaint, fontSize: size }}>—</span>;
    const up = value >= 0;
    return (
      <span style={{ color: up ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: size }}>
        {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
      </span>
    );
  };

  const isPro = data?.isPro || false;
  if (!isPro) return <UpgradeWall T={T} featureName="La Veille Marché" />;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        .vm-news-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .vm-news-card {
          display: flex; gap: 12px; align-items: flex-start;
          background: #131920; border-radius: 12px; padding: 16px;
          text-decoration: none; cursor: pointer; transition: background .15s;
        }
        .vm-news-card:hover { background: #1b2330; }
        .vm-idx-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        .vm-table-wrap { overflow-x: auto; }
        .vm-table { width: 100%; border-collapse: collapse; min-width: 420px; }
        .vm-table th { font-size: 10px; font-weight: 700; color: ${T.textMuted}; text-transform: uppercase; letter-spacing: .05em; padding: 7px 10px; text-align: right; white-space: nowrap; }
        .vm-table th:first-child { text-align: left; }
        .vm-table td { font-size: 12px; padding: 9px 10px; text-align: right; color: ${T.text}; }
        .vm-table td:first-child { text-align: left; font-weight: 600; }
        .vm-table tbody tr:nth-child(odd)  td { background: ${T.bg2}; }
        .vm-table tbody tr:nth-child(even) td { background: transparent; }
        .vm-table tbody tr td:first-child { border-radius: 8px 0 0 8px; }
        .vm-table tbody tr td:last-child  { border-radius: 0 8px 8px 0; }
        @media (max-width: 768px) {
          .vm-news-grid { grid-template-columns: 1fr; }
          .vm-idx-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>📰 Veille marché</h1>
        <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>Actualités, cours et calendrier de vos actifs</p>
      </div>

      {/* ── Actualités ────────────────────────────────────────────────────── */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Actualités financières</h3>
        {newsLoading ? (
          <div style={{ fontSize: 12, color: T.textFaint, padding: '12px 0' }}>Chargement des actualités…</div>
        ) : newsError || !news.length ? (
          <div style={{ fontSize: 12, color: T.textFaint, padding: '12px 0' }}>Actualités indisponibles pour le moment.</div>
        ) : (
          <div className="vm-news-grid">
            {news.slice(0, 10).map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="vm-news-card">
                {n.image ? (
                  <img src={n.image} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0, background: colorForSource(n.source), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>
                    {(n.source || '?')[0].toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.35, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {n.title}
                  </div>
                  {n.description && (
                    <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.45, marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {n.description}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{n.source || 'Source inconnue'} · {timeAgo(n.publishedAt)}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Indices boursiers ─────────────────────────────────────────────── */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Indices & actifs de référence</h3>
        <div className="vm-idx-grid">
          {INDICES.map(idx => {
            const q = quotes[idx.ticker];
            const trendTint = q?.change1J == null ? 'transparent' : q.change1J >= 0 ? 'rgba(74,222,128,.07)' : 'rgba(248,113,113,.07)';
            return (
              <div key={idx.ticker} style={{
                borderRadius: 14, padding: '14px 14px', minWidth: 0,
                background: `linear-gradient(160deg, ${trendTint}, ${T.cardBg})`,
                border: `1px solid ${idx.color}33`, borderTop: `3px solid ${idx.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: idx.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{idx.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {quotesLoading && !q ? '…' : q?.price != null ? fEur(q.price) : '—'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <VarCell value={q?.change1J} />
                  <span style={{ fontSize: 10, color: T.textFaint }}>1S : <VarCell value={q?.change1S} size={10} /></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Cours de mes actifs ───────────────────────────────────────────── */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Cours en temps réel de mes actifs</h3>
        {displayTickers.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textFaint }}>
            {quotesLoading ? 'Chargement…' : 'Aucune position avec un cours disponible.'}
          </div>
        ) : (
          <div className="vm-table-wrap">
            <table className="vm-table">
              <thead>
                <tr><th>Actif</th><th>Cours</th><th>Var. 1J</th><th>Var. 1S</th></tr>
              </thead>
              <tbody>
                {displayTickers.map(ticker => {
                  const q = quotes[ticker];
                  return (
                    <tr key={ticker}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AssetLogo sources={stockLogoSources(ticker)} letter={ticker[0]} color="#60A5FA" size={26} />
                          <span>{heldMap.get(ticker)} <span style={{ color: T.textFaint, fontWeight: 400 }}>({ticker})</span></span>
                        </div>
                      </td>
                      <td>{quotesLoading && !q ? '…' : q?.price != null ? fEur(q.price) : '—'}</td>
                      <td><VarCell value={q?.change1J} /></td>
                      <td><VarCell value={q?.change1S} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Calendrier économique ─────────────────────────────────────────── */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Calendrier économique</h3>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Prochaines dates ex-dividende sur vos titres
          </div>
          {upcomingDivs.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textFaint }}>Aucune date ex-dividende à venir détectée pour vos titres.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingDivs.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: T.bg2, borderRadius: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{d.ticker}</span>
                  <span style={{ color: T.textMuted }}>{fDate(d.ex_date)}</span>
                  <span style={{ color: d.status === 'confirmed' ? '#4ade80' : T.textFaint, fontSize: 11 }}>
                    {d.amount_eur ? `${d.amount_eur.toFixed(3)}€` : `${d.amount} ${d.currency}`} {d.status === 'estimated' ? '(estimé)' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.6, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}` }}>
          💡 La BCE et la FED tiennent généralement une réunion de politique monétaire toutes les 6 à 8 semaines.
          Les dates précises variant chaque année, consultez le calendrier officiel de chaque institution pour les prochaines échéances.
          Pour les publications de résultats des entreprises que vous détenez, référez-vous à leur page relations investisseurs — ces dates ne sont pas encore suivies automatiquement dans Capitaly.
        </div>
      </div>
    </div>
  );
}
