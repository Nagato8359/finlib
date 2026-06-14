import { useState, useEffect, useMemo, useCallback } from 'react';
import { makeS, fEur } from '../../utils/constants';
import { AssetLogo, stockLogoSources, scpiLogoSources } from '../Modals';

const DAYS_SHORT  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const STORAGE_KEY = 'cap_div_received';

const loadReceived = () => {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
};
const saveReceived = set => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch {}
};

function posLogoSrcs(ticker, posType) {
  if (posType === 'scpi') return scpiLogoSources(ticker || '');
  return stockLogoSources(ticker, null);
}

export default function CalendrierDividendes({ T, data }) {
  const S = makeS(T);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed
  const [filter,    setFilter]    = useState('all');
  const [apiData,   setApiData]   = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [received,  setReceived]  = useState(loadReceived);
  const [customShares, setCustomShares] = useState({});
  const [editingShares, setEditingShares] = useState(null);
  const [liquidMsg, setLiquidMsg] = useState(null);

  const { investments, allDividends, setInvestments } = data;

  const mm          = String(viewMonth + 1).padStart(2, '0');
  const monthPrefix = `${viewYear}-${mm}`;

  // ── Fetch Yahoo Finance dividend data for all stock/ETF positions ────────────
  useEffect(() => {
    const tickers = [...new Set(
      (investments || []).flatMap(inv =>
        (inv.positions || [])
          .filter(p => ['stock', 'etf'].includes(p.posType) && p.ticker)
          .map(p => p.ticker.split('.')[0].toUpperCase())
      )
    )].filter(Boolean);
    if (!tickers.length) return;
    setApiLoading(true);
    fetch(`/api/dividends?tickers=${tickers.join(',')}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setApiData(d); })
      .catch(() => {})
      .finally(() => setApiLoading(false));
  }, [investments]);

  // ── Month navigation ─────────────────────────────────────────────────────────
  const prevMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // ── Build merged events for the visible month ────────────────────────────────
  const allMonthEvents = useMemo(() => {
    const events = [];

    // 1. Manual dividends (already recorded in investments.dividends[])
    (allDividends || []).filter(d => d.date?.startsWith(monthPrefix)).forEach(d => {
      events.push({
        id:        `m:${d.id}`,
        date:      d.date,
        source:    'manual',
        invId:     d.invId,
        invName:   d.invName,
        ticker:    null,
        posType:   null,
        name:      d.note || d.invName,
        amount:    d.amount,
        amountEUR: d.amount,
        currency:  'EUR',
        estimated: false,
      });
    });

    // 2. Yahoo Finance dividends per stock/ETF position
    if (apiData) {
      (investments || []).forEach(inv => {
        (inv.positions || [])
          .filter(p => ['stock', 'etf'].includes(p.posType) && p.ticker)
          .forEach(pos => {
            const base     = pos.ticker.split('.')[0].toUpperCase();
            const info     = apiData[base];
            if (!info) return;
            const shareKey = `${inv.id}:${base}`;
            const shares   = customShares[shareKey] ?? pos.shares;

            // Past / known dividends
            (info.dividends || []).filter(d => d.exDate?.startsWith(monthPrefix)).forEach(d => {
              events.push({
                id:        `a:${base}:${d.exDate}:${inv.id}`,
                date:      d.exDate,
                source:    'api',
                invId:     inv.id,
                invName:   inv.name,
                ticker:    pos.ticker,
                posType:   pos.posType,
                name:      pos.name,
                amount:    d.amount * shares,
                amountEUR: (d.amountEUR || d.amount) * shares,
                currency:  d.currency || 'USD',
                estimated: false,
                perShare:  d.amount,
                shares,
                shareKey,
                frequency: info.frequency,
              });
            });

            // Projected next dividend
            const nd = info.nextDividend;
            if (nd?.exDate?.startsWith(monthPrefix)) {
              events.push({
                id:        `a:${base}:${nd.exDate}:${inv.id}:est`,
                date:      nd.exDate,
                source:    'api_projected',
                invId:     inv.id,
                invName:   inv.name,
                ticker:    pos.ticker,
                posType:   pos.posType,
                name:      pos.name,
                amount:    nd.amount * shares,
                amountEUR: (nd.amountEUR || nd.amount) * shares,
                currency:  nd.currency || 'USD',
                estimated: true,
                perShare:  nd.amount,
                shares,
                shareKey,
                frequency: info.frequency,
              });
            }
          });
      });
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [allDividends, apiData, investments, monthPrefix, customShares]);

  // ── Apply filter ─────────────────────────────────────────────────────────────
  const monthEvents = useMemo(() => {
    if (filter === 'past')   return allMonthEvents.filter(e => e.date <= todayStr);
    if (filter === 'future') return allMonthEvents.filter(e => e.date >  todayStr);
    return allMonthEvents;
  }, [allMonthEvents, filter, todayStr]);

  const byDay = useMemo(() => {
    const map = {};
    monthEvents.forEach(e => {
      const d = parseInt(e.date.slice(8), 10);
      (map[d] = map[d] || []).push(e);
    });
    return map;
  }, [monthEvents]);

  const monthTotal = monthEvents.reduce((s, e) => s + e.amountEUR, 0);

  // ── Calendar grid cells ──────────────────────────────────────────────────────
  const firstDow   = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const startOff   = (firstDow + 6) % 7;                       // Mon=0
  const daysInMon  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells      = [
    ...Array(startOff).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // ── Toggle received + auto-add liquidity ─────────────────────────────────────
  const toggleReceived = useCallback(event => {
    setReceived(prev => {
      const next = new Set(prev);
      if (next.has(event.id)) {
        next.delete(event.id);
      } else {
        next.add(event.id);
        if (!event.estimated && event.invId && event.amountEUR > 0) {
          setInvestments(p => p.map(inv => {
            if (inv.id !== event.invId) return inv;
            const newCash = parseFloat(((parseFloat(inv.cash) || 0) + event.amountEUR).toFixed(2));
            return { ...inv, cash: newCash };
          }));
          setLiquidMsg(`+${fEur(event.amountEUR)} ajouté aux liquidités de "${event.invName}"`);
          setTimeout(() => setLiquidMsg(null), 4000);
        }
      }
      saveReceived(next);
      return next;
    });
  }, [setInvestments]);

  const updateShares = (shareKey, value) => {
    const n = parseFloat(value);
    if (!isNaN(n) && n > 0) setCustomShares(prev => ({ ...prev, [shareKey]: n }));
  };

  // ── Calendar cell ────────────────────────────────────────────────────────────
  const renderCell = (day, i) => {
    if (!day) return <div key={i} style={{ minHeight: 72 }} />;
    const dayStr    = `${viewYear}-${mm}-${String(day).padStart(2, '0')}`;
    const isToday   = dayStr === todayStr;
    const dayEvents = byDay[day] || [];
    return (
      <div key={i} style={{
        minHeight: 72,
        background: isToday ? T.accent + '1a' : T.bg2,
        border:     `1px solid ${isToday ? T.accent : T.cardBorder}`,
        borderRadius: 8,
        padding: '5px 5px 4px',
        boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 10, fontWeight: isToday ? 800 : 400, color: isToday ? T.accent : T.textFaint, marginBottom: dayEvents.length ? 4 : 0 }}>
          {day}
        </div>
        {dayEvents.slice(0, 3).map((e, j) => {
          const isRec = received.has(e.id);
          return (
            <div key={j} onClick={() => toggleReceived(e)} title={`${e.name || e.ticker} · ${fEur(e.amountEUR)}`}
              style={{
                fontSize: 8, padding: '2px 3px', borderRadius: 3, marginBottom: 2, cursor: 'pointer',
                background: isRec ? '#4ade8022' : e.estimated ? '#fb923c18' : '#3b82f618',
                border:     `1px solid ${isRec ? '#4ade8055' : e.estimated ? '#fb923c44' : '#3b82f644'}`,
                color:      isRec ? '#4ade80' : e.estimated ? '#fb923c' : T.text,
                display: 'flex', alignItems: 'center', gap: 2,
                overflow: 'hidden', whiteSpace: 'nowrap', transition: 'all .15s',
              }}>
              {e.ticker && (
                <AssetLogo
                  sources={posLogoSrcs(e.ticker, e.posType)}
                  letter={(e.ticker || '?')[0]}
                  color="#60A5FA"
                  size={12}
                />
              )}
              <span style={{ fontWeight: 700 }}>{(e.ticker || e.invName || '?').split('.')[0].slice(0, 5)}</span>
              <span>{fEur(e.amountEUR, true)}</span>
            </div>
          );
        })}
        {dayEvents.length > 3 && (
          <div style={{ fontSize: 8, color: T.textFaint, paddingLeft: 2 }}>+{dayEvents.length - 3} autres</div>
        )}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', color: T.text }}>📅 Calendrier dividendes</h1>
          <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>
            {apiLoading ? '⟳ Chargement Yahoo Finance…' : 'Dividendes reçus et projetés mois par mois'}
          </p>
        </div>
        {/* Month navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={{ ...S.btnS, padding: '5px 13px', fontSize: 18, lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text, minWidth: 170, textAlign: 'center' }}>
            {MONTHS_LONG[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} style={{ ...S.btnS, padding: '5px 13px', fontSize: 18, lineHeight: 1 }}>›</button>
        </div>
      </div>

      {/* Filter bar + month total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', 'Tous'], ['past', 'Passés'], ['future', 'Futurs']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              background: filter === val ? T.accent + '22' : T.cardBg,
              border:     `1px solid ${filter === val ? T.accent : T.cardBorder}`,
              color:      filter === val ? T.accent : T.textMuted,
              borderRadius: 8, padding: '5px 14px', fontSize: 12,
              fontWeight: filter === val ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
            }}>{label}</button>
          ))}
        </div>
        {monthTotal > 0 && (
          <span style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>
            Ce mois : +{fEur(monthTotal)}
          </span>
        )}
      </div>

      {/* Calendar grid */}
      <div style={{ ...S.card, padding: 16 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 0' }}>
              {d}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map(renderCell)}
        </div>
      </div>

      {/* Chronological list */}
      {monthEvents.length > 0 ? (
        <div style={{ ...S.card }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>
            Détail — {MONTHS_LONG[viewMonth]} {viewYear}
            {monthEvents.length > 0 && <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400, marginLeft: 8 }}>{monthEvents.length} versement{monthEvents.length > 1 ? 's' : ''}</span>}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {monthEvents.map(e => {
              const isRec  = received.has(e.id);
              const isPast = e.date <= todayStr;
              return (
                <div key={e.id} style={{
                  padding: '10px 14px', background: T.bg2, borderRadius: 10,
                  borderLeft: `3px solid ${isRec ? '#4ade80' : e.estimated ? '#fb923c' : isPast ? '#60a5fa' : T.cardBorder}`,
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  {/* Date */}
                  <div style={{ fontSize: 11, color: T.textMuted, minWidth: 64, flexShrink: 0 }}>
                    {e.date.slice(8)}/{mm}
                  </div>

                  {/* Logo + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 140 }}>
                    {e.ticker ? (
                      <AssetLogo sources={posLogoSrcs(e.ticker, e.posType)} letter={(e.ticker || '?')[0]} color="#60A5FA" size={28} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>💸</div>
                    )}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {e.ticker || e.invName}
                        {e.estimated && <span style={{ fontSize: 9, color: '#fb923c', fontStyle: 'italic', background: '#fb923c18', padding: '1px 5px', borderRadius: 3 }}>Estimé</span>}
                      </div>
                      <div style={{ fontSize: 10, color: T.textFaint }}>
                        {e.invName}{e.frequency ? ` · ${e.frequency}` : ''}{e.currency && e.currency !== 'EUR' ? ` · ${e.currency}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Editable shares (API events only) */}
                  {e.shareKey && (
                    <div style={{ fontSize: 10, color: T.textMuted, flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
                      {editingShares === e.id ? (
                        <input
                          type="number" min="0.0001" step="0.0001"
                          defaultValue={e.shares}
                          style={{ width: 64, background: T.bg3, border: `1px solid ${T.accent}`, borderRadius: 5, color: T.text, padding: '2px 5px', fontSize: 10, textAlign: 'right' }}
                          onBlur={ev => { updateShares(e.shareKey, ev.target.value); setEditingShares(null); }}
                          onKeyDown={ev => { if (ev.key === 'Enter') { updateShares(e.shareKey, ev.target.value); setEditingShares(null); } }}
                          autoFocus
                        />
                      ) : (
                        <span
                          onClick={() => setEditingShares(e.id)}
                          title="Cliquer pour modifier"
                          style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}>
                          {+parseFloat(e.shares).toFixed(4)} titres
                        </span>
                      )}
                      {e.perShare != null && (
                        <div style={{ fontSize: 9, color: T.textFaint }}>{e.perShare.toFixed(4)} {e.currency}/titre</div>
                      )}
                    </div>
                  )}

                  {/* Amount */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: isRec ? '#4ade80' : T.text }}>+{fEur(e.amountEUR)}</div>
                    {e.currency && e.currency !== 'EUR' && e.amount != null && (
                      <div style={{ fontSize: 10, color: T.textFaint }}>{e.amount.toFixed(4)} {e.currency}</div>
                    )}
                  </div>

                  {/* Status button */}
                  <button
                    onClick={() => !e.estimated && toggleReceived(e)}
                    style={{
                      border:   `1px solid ${isRec ? '#4ade80' : T.cardBorder}`,
                      background: isRec ? '#4ade8022' : 'transparent',
                      borderRadius: 7, padding: '4px 10px', fontSize: 10, fontWeight: 600,
                      color:    isRec ? '#4ade80' : e.estimated ? T.textFaint : T.textMuted,
                      cursor:   e.estimated ? 'default' : 'pointer',
                      fontFamily: 'inherit', flexShrink: 0,
                      opacity:  e.estimated ? 0.55 : 1, transition: 'all .15s',
                    }}>
                    {isRec ? '✓ Reçu' : e.estimated ? 'Estimé' : 'Marquer reçu'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center', padding: 56, color: T.textFaint }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Aucun dividende ce mois</div>
          <div style={{ fontSize: 12, lineHeight: 1.7, maxWidth: 380, margin: '0 auto' }}>
            {filter !== 'all'
              ? 'Changez le filtre pour voir plus de résultats.'
              : 'Ajoutez des dividendes manuellement depuis Patrimoine → Investissements, ou ajoutez des positions Actions/ETF avec un ticker valide.'}
          </div>
        </div>
      )}

      {/* Toast */}
      {liquidMsg && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9000, background: '#0d1117', border: '1px solid #4ade80', borderRadius: 12,
          padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#4ade80',
          boxShadow: '0 8px 32px rgba(0,0,0,.55)', animation: 'slideUp .25s ease', whiteSpace: 'nowrap',
        }}>
          ✅ {liquidMsg}
        </div>
      )}
    </div>
  );
}
