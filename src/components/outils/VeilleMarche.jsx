import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { makeS, fEur, fDate } from '../../utils/constants';

const INDICES = [
  { ticker: '^FCHI', label: 'CAC 40' },
  { ticker: '^GSPC', label: 'S&P 500' },
  { ticker: '^IXIC', label: 'Nasdaq' },
  { ticker: 'BTC',   label: 'Bitcoin' },
  { ticker: 'GC=F',  label: 'Or' },
];

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/i;

function extractHeldTickers(investments) {
  const map = new Map();
  for (const inv of investments || []) {
    for (const pos of inv.positions || []) {
      if (['other', 'realestate', 'commodity'].includes(pos.posType)) continue;
      const key = (pos.isin || pos.ticker || '').toUpperCase();
      if (key && !map.has(key)) map.set(key, pos.name || pos.ticker || key);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/performance?action=news');
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
            fetch(`/api/performance?key=${encodeURIComponent(ticker)}&tf=1J`).then(r => r.json()).catch(() => ({})),
            fetch(`/api/performance?key=${encodeURIComponent(ticker)}&tf=1S`).then(r => r.json()).catch(() => ({})),
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

  const VarCell = ({ value }) => {
    if (value == null) return <span style={{ color: T.textFaint }}>—</span>;
    const up = value >= 0;
    return (
      <span style={{ color: up ? '#4ade80' : '#f87171', fontWeight: 700 }}>
        {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        .vm-news-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .vm-table-wrap { overflow-x: auto; }
        .vm-table { width: 100%; border-collapse: collapse; min-width: 420px; }
        .vm-table th { font-size: 10px; font-weight: 700; color: ${T.textMuted}; text-transform: uppercase; letter-spacing: .05em; padding: 7px 10px; text-align: right; white-space: nowrap; }
        .vm-table th:first-child { text-align: left; }
        .vm-table td { font-size: 12px; padding: 9px 10px; border-top: 1px solid ${T.cardBorder}; text-align: right; color: ${T.text}; }
        .vm-table td:first-child { text-align: left; font-weight: 600; }
        @media (max-width: 768px) {
          .vm-news-grid { grid-template-columns: 1fr; }
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
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', gap: 12, padding: 12, background: T.bg2, borderRadius: 12, textDecoration: 'none', color: T.text, alignItems: 'flex-start' }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, flexShrink: 0, background: T.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, overflow: 'hidden' }}>
                  {n.image ? <img src={n.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📰'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35, marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 10, color: T.textFaint }}>{n.source || 'Source inconnue'} · {timeAgo(n.publishedAt)}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Indices boursiers ─────────────────────────────────────────────── */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Indices & actifs de référence</h3>
        <div className="vm-table-wrap">
          <table className="vm-table">
            <thead>
              <tr><th>Indice</th><th>Cours</th><th>Var. 1J</th><th>Var. 1S</th></tr>
            </thead>
            <tbody>
              {INDICES.map(idx => {
                const q = quotes[idx.ticker];
                return (
                  <tr key={idx.ticker}>
                    <td>{idx.label}</td>
                    <td>{quotesLoading && !q ? '…' : q?.price != null ? fEur(q.price) : '—'}</td>
                    <td><VarCell value={q?.change1J} /></td>
                    <td><VarCell value={q?.change1S} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cours de mes actifs ───────────────────────────────────────────── */}
      <div style={{ ...S.card }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: T.text }}>Cours en temps réel de mes actifs</h3>
        {heldTickers.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textFaint }}>Aucune position boursière détectée dans votre portefeuille.</div>
        ) : (
          <div className="vm-table-wrap">
            <table className="vm-table">
              <thead>
                <tr><th>Actif</th><th>Cours</th><th>Var. 1J</th><th>Var. 1S</th></tr>
              </thead>
              <tbody>
                {heldTickers.map(ticker => {
                  const q = quotes[ticker];
                  return (
                    <tr key={ticker}>
                      <td>{heldMap.get(ticker)} <span style={{ color: T.textFaint, fontWeight: 400 }}>({ticker})</span></td>
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
