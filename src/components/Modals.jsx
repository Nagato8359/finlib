import { ModalShell, Label, makeS, fEur, CAT_COLORS, INV_CATS, HEALTH_CATS, CASH_TYPES, LISTING_CATS, LISTING_PLATFORMS, fPrice } from '../utils/constants';

const FRow = ({ cols = 2, children }) => <div className={`frow frow-${cols}`}>{children}</div>;
const FField = ({ label, children }) => <div><Label>{label}</Label>{children}</div>;

const mLeft = endDate => {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(0, months);
};

export default function Modals({ T, data }) {
  const S = makeS(T);
  const {
    modal, setModal, editItem, setEditItem, drillInv,
    txForm, setTxForm, invForm, setInvForm, healthForm, setHealthForm,
    posForm, setPosForm, goalForm, setGoalForm, cashForm, setCashForm,
    listingForm, setListingForm, loanForm, setLoanForm, debtForm, setDebtForm,
    mkTx, mkInv, mkHealth, mkPos, mkGoal, mkCash, mkListing, mkLoan, mkDebt,
    saveTx, saveInv, saveHealth, savePosition, saveListing, saveCash, saveGoal, saveLoan, saveDebt,
    investments, prices, fetchTickerPrice, fetchingPrice, invLiveValue, setInvestments,
  } = data;

  if (!modal) return null;

  const close = (reset) => { setModal(null); setEditItem(null); reset && reset(); };

  // ── Transaction ─────────────────────────────────────────────────────────────
  if (modal === 'tx') return (
    <ModalShell T={T} title={editItem ? 'Modifier la transaction' : 'Nouvelle transaction'} onClose={() => close(() => setTxForm(mkTx()))}>
      <FRow cols={2}>
        <FField label="Date"><input type="date" style={S.inp} value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} /></FField>
        <FField label="Type">
          <select style={S.inp} value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value }))}>
            <option value="income">Entrée (revenu)</option>
            <option value="expense">Sortie (dépense)</option>
          </select>
        </FField>
      </FRow>
      <FRow cols={2}>
        <FField label="Libellé"><input type="text" placeholder="Ex : Salaire, Loyer…" style={S.inp} value={txForm.label} onChange={e => setTxForm(p => ({ ...p, label: e.target.value }))} /></FField>
        <FField label="Montant (€)"><input type="number" placeholder="0" style={S.inp} value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} /></FField>
      </FRow>
      <FRow cols={2}>
        <FField label="Catégorie">
          <select style={S.inp} value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))}>
            {Object.keys(CAT_COLORS).map(c => <option key={c}>{c}</option>)}
          </select>
        </FField>
        <FField label="Récurrente">
          <select style={S.inp} value={txForm.recurrent ? 'oui' : 'non'} onChange={e => setTxForm(p => ({ ...p, recurrent: e.target.value === 'oui' }))}>
            <option value="non">Non (ponctuelle)</option>
            <option value="oui">Oui (mensuelle)</option>
          </select>
        </FField>
      </FRow>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={saveTx} style={S.btnG}>{editItem ? 'Enregistrer' : 'Ajouter'}</button>
        <button onClick={() => close(() => setTxForm(mkTx()))} style={S.btnS}>Annuler</button>
      </div>
    </ModalShell>
  );

  // ── Investissement ───────────────────────────────────────────────────────────
  if (modal === 'inv') return (
    <ModalShell T={T} title={editItem ? "Modifier l'actif" : 'Nouvel actif financier'} onClose={() => close(() => setInvForm(mkInv()))}>
      <FRow cols={2}>
        <FField label="Nom"><input type="text" placeholder="Ex : PEA — ETF World" style={S.inp} value={invForm.name} onChange={e => setInvForm(p => ({ ...p, name: e.target.value }))} /></FField>
        <FField label="Catégorie">
          <select style={S.inp} value={invForm.category} onChange={e => setInvForm(p => ({ ...p, category: e.target.value }))}>
            {INV_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </FField>
      </FRow>
      <FRow cols={2}>
        <FField label="Valeur actuelle (€)"><input type="number" placeholder="0" style={S.inp} value={invForm.value} onChange={e => setInvForm(p => ({ ...p, value: e.target.value }))} /></FField>
        <FField label="Montant investi (€)"><input type="number" placeholder="0" style={S.inp} value={invForm.invested} onChange={e => setInvForm(p => ({ ...p, invested: e.target.value }))} /></FField>
      </FRow>
      <FRow cols={1}>
        <FField label="Notes"><input type="text" placeholder="Remarques…" style={S.inp} value={invForm.notes} onChange={e => setInvForm(p => ({ ...p, notes: e.target.value }))} /></FField>
      </FRow>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={saveInv} style={S.btnG}>{editItem ? 'Enregistrer' : 'Ajouter'}</button>
        <button onClick={() => close(() => setInvForm(mkInv()))} style={S.btnS}>Annuler</button>
      </div>
    </ModalShell>
  );

  // ── Actif physique ───────────────────────────────────────────────────────────
  if (modal === 'health') return (
    <ModalShell T={T} title={editItem ? "Modifier l'actif" : 'Nouvel actif matériel'} onClose={() => close(() => setHealthForm(mkHealth()))}>
      <FRow cols={2}>
        <FField label="Nom"><input type="text" placeholder="Ex : Renault Clio, Collection…" style={S.inp} value={healthForm.name} onChange={e => setHealthForm(p => ({ ...p, name: e.target.value }))} /></FField>
        <FField label="Catégorie">
          <select style={S.inp} value={healthForm.category} onChange={e => setHealthForm(p => ({ ...p, category: e.target.value }))}>
            {HEALTH_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </FField>
      </FRow>
      <FRow cols={2}>
        <FField label="Prix d'achat (€)"><input type="number" placeholder="0" style={S.inp} value={healthForm.buyPrice} onChange={e => setHealthForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
        <FField label="Valeur actuelle (€)"><input type="number" placeholder="0" style={S.inp} value={healthForm.currentValue} onChange={e => setHealthForm(p => ({ ...p, currentValue: e.target.value }))} /></FField>
      </FRow>
      <FRow cols={2}>
        <FField label="Date d'acquisition"><input type="date" style={S.inp} value={healthForm.date} onChange={e => setHealthForm(p => ({ ...p, date: e.target.value }))} /></FField>
        <FField label="Notes"><input type="text" placeholder="Remarques…" style={S.inp} value={healthForm.notes} onChange={e => setHealthForm(p => ({ ...p, notes: e.target.value }))} /></FField>
      </FRow>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={saveHealth} style={S.btnG}>{editItem ? 'Enregistrer' : 'Ajouter'}</button>
        <button onClick={() => close(() => setHealthForm(mkHealth()))} style={S.btnS}>Annuler</button>
      </div>
    </ModalShell>
  );

  // ── Objectif ─────────────────────────────────────────────────────────────────
  if (modal === 'goal') return (
    <ModalShell T={T} title={editItem ? "Modifier l'objectif" : 'Nouvel objectif'} onClose={() => close(() => setGoalForm(mkGoal()))}>
      <FRow cols={1}>
        <FField label="Nom de l'objectif"><input type="text" placeholder="Ex : Indépendance financière" style={S.inp} value={goalForm.name} onChange={e => setGoalForm(p => ({ ...p, name: e.target.value }))} /></FField>
      </FRow>
      <FRow cols={2}>
        <FField label="Montant cible (€)"><input type="number" placeholder="0" style={S.inp} value={goalForm.target} onChange={e => setGoalForm(p => ({ ...p, target: e.target.value }))} /></FField>
        <FField label="Date limite"><input type="date" style={S.inp} value={goalForm.deadline} onChange={e => setGoalForm(p => ({ ...p, deadline: e.target.value }))} /></FField>
      </FRow>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={saveGoal} style={S.btnG}>{editItem ? 'Enregistrer' : 'Ajouter'}</button>
        <button onClick={() => close(() => setGoalForm(mkGoal()))} style={S.btnS}>Annuler</button>
      </div>
    </ModalShell>
  );

  // ── Épargne & Cash ───────────────────────────────────────────────────────────
  if (modal === 'cash') return (
    <ModalShell T={T} title={editItem ? 'Modifier le compte' : 'Nouveau compte'} onClose={() => close(() => setCashForm(mkCash()))}>
      <FRow cols={2}>
        <FField label="Nom du compte"><input type="text" placeholder="Ex : Livret A CA" style={S.inp} value={cashForm.name} onChange={e => setCashForm(p => ({ ...p, name: e.target.value }))} /></FField>
        <FField label="Type">
          <select style={S.inp} value={cashForm.type} onChange={e => setCashForm(p => ({ ...p, type: e.target.value }))}>
            {CASH_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </FField>
      </FRow>
      <FRow cols={2}>
        <FField label="Solde (€)"><input type="number" placeholder="0" style={S.inp} value={cashForm.balance} onChange={e => setCashForm(p => ({ ...p, balance: e.target.value }))} /></FField>
        <FField label="Taux annuel (%)"><input type="number" placeholder="0" step="0.01" style={S.inp} value={cashForm.rate} onChange={e => setCashForm(p => ({ ...p, rate: e.target.value }))} /></FField>
      </FRow>
      {cashForm.balance && cashForm.rate > 0 && (
        <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#4ade80' }}>
          💰 Intérêts annuels estimés : {fEur(parseFloat(cashForm.balance) * parseFloat(cashForm.rate) / 100)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={saveCash} style={S.btnG}>{editItem ? 'Enregistrer' : 'Ajouter'}</button>
        <button onClick={() => close(() => setCashForm(mkCash()))} style={S.btnS}>Annuler</button>
      </div>
    </ModalShell>
  );

  // ── Article en vente ──────────────────────────────────────────────────────────
  if (modal === 'listing') return (
    <ModalShell T={T} title={editItem ? "Modifier l'article" : 'Nouvel article en vente'} onClose={() => close(() => setListingForm(mkListing()))}>
      <FRow cols={2}>
        <FField label="Nom"><input type="text" placeholder="Ex : iPhone 13 Pro" style={S.inp} value={listingForm.name} onChange={e => setListingForm(p => ({ ...p, name: e.target.value }))} /></FField>
        <FField label="Catégorie">
          <select style={S.inp} value={listingForm.category} onChange={e => setListingForm(p => ({ ...p, category: e.target.value }))}>
            {LISTING_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </FField>
      </FRow>
      <FRow cols={2}>
        <FField label="Plateforme">
          <select style={S.inp} value={listingForm.platform} onChange={e => setListingForm(p => ({ ...p, platform: e.target.value }))}>
            {LISTING_PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
          </select>
        </FField>
        <FField label="Date de mise en vente"><input type="date" style={S.inp} value={listingForm.listedDate} onChange={e => setListingForm(p => ({ ...p, listedDate: e.target.value }))} /></FField>
      </FRow>
      <FRow cols={3}>
        <FField label="Prix achat (€)"><input type="number" placeholder="0" style={S.inp} value={listingForm.buyPrice} onChange={e => setListingForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
        <FField label="Prix vente (€)"><input type="number" placeholder="0" style={S.inp} value={listingForm.sellPrice} onChange={e => setListingForm(p => ({ ...p, sellPrice: e.target.value }))} /></FField>
        <FField label="Frais (€)"><input type="number" placeholder="0" style={S.inp} value={listingForm.fees} onChange={e => setListingForm(p => ({ ...p, fees: e.target.value }))} /></FField>
      </FRow>
      {listingForm.buyPrice !== '' && listingForm.sellPrice !== '' && (() => {
        const profit = parseFloat(listingForm.sellPrice || 0) - parseFloat(listingForm.buyPrice || 0) - parseFloat(listingForm.fees || 0);
        return (
          <div style={{ background: profit >= 0 ? 'rgba(16,185,129,.08)' : 'rgba(248,113,113,.08)', border: `1px solid ${profit >= 0 ? 'rgba(16,185,129,.2)' : 'rgba(248,113,113,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: profit >= 0 ? '#4ade80' : '#f87171' }}>
            {profit >= 0 ? '💰' : '⚠️'} Bénéfice espéré : <strong>{profit >= 0 ? '+' : ''}{fEur(profit)}</strong>
          </div>
        );
      })()}
      <FRow cols={1}>
        <FField label="Notes"><input type="text" placeholder="État, description…" style={S.inp} value={listingForm.notes} onChange={e => setListingForm(p => ({ ...p, notes: e.target.value }))} /></FField>
      </FRow>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={saveListing} style={S.btnG}>{editItem ? 'Enregistrer' : 'Ajouter'}</button>
        <button onClick={() => close(() => setListingForm(mkListing()))} style={S.btnS}>Annuler</button>
      </div>
    </ModalShell>
  );

  // ── Drill-down positions ──────────────────────────────────────────────────────
  if (modal === 'drill' && drillInv) {
    const cur = investments.find(i => i.id === drillInv.id) || { value: 0, invested: 0, positions: [] };
    const lv = invLiveValue(cur);
    return (
      <ModalShell T={T} title={`${drillInv.name} — Positions`} onClose={() => { setModal(null); setPosForm(mkPos()); setEditItem(null); }}>
        <div className="g3" style={{ marginBottom: 16 }}>
          {[{ l: 'Valeur', v: fEur(lv) }, { l: 'Investi', v: fEur(cur.invested) }, { l: 'P&L', v: fEur(lv - cur.invested) }].map(x => (
            <div key={x.l} style={{ background: T.bg2, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>{x.l}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{x.v}</div>
            </div>
          ))}
        </div>

        {(cur.positions || []).map(pos => {
          const pnl = (pos.currentPrice - pos.buyPrice) * pos.shares;
          const pct = pos.buyPrice > 0 ? ((pos.currentPrice - pos.buyPrice) / pos.buyPrice) * 100 : 0;
          return (
            <div key={pos.id} style={{ background: T.bg2, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{pos.ticker}</span>
                  <span style={{ color: T.textMuted, fontSize: 12, marginLeft: 8 }}>{pos.name}</span>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                    {pos.shares} · PA {fPrice(pos.buyPrice)} · Actuel {fPrice(prices[pos.ticker] ?? pos.currentPrice)}
                    {prices[pos.ticker] !== undefined && <span style={{ marginLeft: 5, fontSize: 9, background: 'rgba(16,185,129,.2)', color: '#10b981', padding: '1px 5px', borderRadius: 3 }}>LIVE</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{fEur(pos.shares * (prices[pos.ticker] ?? pos.currentPrice))}</div>
                  <div style={{ fontSize: 11, color: pnl >= 0 ? '#4ade80' : '#f87171' }}>{pnl >= 0 ? '+' : ''}{fEur(pnl)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => { setEditItem({ posId: pos.id }); setPosForm({ ticker: pos.ticker, name: pos.name, shares: pos.shares, buyPrice: pos.buyPrice, currentPrice: pos.currentPrice }); }} style={{ ...S.btnS, padding: '2px 8px', fontSize: 10 }}>✎</button>
                <button onClick={() => setInvestments(p => p.map(inv => inv.id !== drillInv.id ? inv : { ...inv, positions: inv.positions.filter(x => x.id !== pos.id) }))} style={{ ...S.btnD, padding: '2px 8px', fontSize: 10 }}>✕</button>
              </div>
            </div>
          );
        })}

        <div style={{ borderTop: `1px solid ${T.cardBorder}`, paddingTop: 16, marginTop: 8 }}>
          <h4 style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>{editItem?.posId ? 'Modifier la position' : 'Ajouter une position'}</h4>
          <FRow cols={2}>
            <FField label="Ticker (quittez pour fetch)">
              <input type="text" placeholder="Ex: CW8, BTC, AAPL" style={S.inp} value={posForm.ticker}
                onChange={e => setPosForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                onBlur={e => fetchTickerPrice(e.target.value.toUpperCase())} />
            </FField>
            <FField label="Nom"><input type="text" placeholder="Nom complet" style={S.inp} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} /></FField>
          </FRow>
          <FRow cols={3}>
            <FField label="Quantité"><input type="number" placeholder="0" style={S.inp} value={posForm.shares} onChange={e => setPosForm(p => ({ ...p, shares: e.target.value }))} /></FField>
            <FField label="Prix achat (€)"><input type="number" placeholder="0" style={S.inp} value={posForm.buyPrice} onChange={e => setPosForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
            <FField label={fetchingPrice ? 'Récupération…' : prices[posForm.ticker] != null ? 'Prix actuel ● LIVE' : 'Prix actuel (€)'}>
              <input type="number" placeholder={fetchingPrice ? '…' : 'Auto si ticker reconnu'} style={{ ...S.inp, opacity: fetchingPrice ? 0.6 : 1 }}
                value={posForm.currentPrice} onChange={e => setPosForm(p => ({ ...p, currentPrice: e.target.value }))} />
            </FField>
          </FRow>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={savePosition} style={S.btnG}>{editItem?.posId ? 'Modifier' : 'Ajouter la position'}</button>
            {editItem?.posId && <button onClick={() => { setEditItem(null); setPosForm(mkPos()); }} style={S.btnS}>Annuler</button>}
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── Crédit immobilier ─────────────────────────────────────────────────────
  if (modal === 'loan') {
    const totalMonthly = (parseFloat(loanForm.monthlyPayment) || 0) + (parseFloat(loanForm.insuranceAmount) || 0);
    const months = mLeft(loanForm.endDate);
    const costRemaining = Math.max(0, months * totalMonthly - (parseFloat(loanForm.capitalRemaining) || 0));
    return (
      <ModalShell T={T} title={editItem ? 'Modifier le crédit immobilier' : 'Nouveau crédit immobilier'} onClose={() => close(() => setLoanForm(mkLoan()))}>
        <FRow cols={2}>
          <FField label="Bien financé"><input type="text" placeholder="Ex : Appartement Paris" style={S.inp} value={loanForm.name} onChange={e => setLoanForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField label="Organisme prêteur"><input type="text" placeholder="Ex : Crédit Agricole" style={S.inp} value={loanForm.lender} onChange={e => setLoanForm(p => ({ ...p, lender: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField label="Capital emprunté (€)"><input type="number" placeholder="0" style={S.inp} value={loanForm.capitalBorrowed} onChange={e => setLoanForm(p => ({ ...p, capitalBorrowed: e.target.value }))} /></FField>
          <FField label="Capital restant dû (€)"><input type="number" placeholder="0" style={S.inp} value={loanForm.capitalRemaining} onChange={e => setLoanForm(p => ({ ...p, capitalRemaining: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField label="Mensualité hors assurance (€)"><input type="number" placeholder="0" style={S.inp} value={loanForm.monthlyPayment} onChange={e => setLoanForm(p => ({ ...p, monthlyPayment: e.target.value }))} /></FField>
          <FField label="Taux d'intérêt (%)"><input type="number" placeholder="0" step="0.01" style={S.inp} value={loanForm.rate} onChange={e => setLoanForm(p => ({ ...p, rate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={3}>
          <FField label="Assurance (€/mois)"><input type="number" placeholder="0" style={S.inp} value={loanForm.insuranceAmount} onChange={e => setLoanForm(p => ({ ...p, insuranceAmount: e.target.value }))} /></FField>
          <FField label="Organisme assurance"><input type="text" placeholder="Ex : CNP, Crédit Mutuel" style={S.inp} value={loanForm.insuranceOrganisme} onChange={e => setLoanForm(p => ({ ...p, insuranceOrganisme: e.target.value }))} /></FField>
          <FField label="Taux assurance (%)"><input type="number" placeholder="0" step="0.001" style={S.inp} value={loanForm.insuranceRate} onChange={e => setLoanForm(p => ({ ...p, insuranceRate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField label="Date de début"><input type="date" style={S.inp} value={loanForm.startDate} onChange={e => setLoanForm(p => ({ ...p, startDate: e.target.value }))} /></FField>
          <FField label="Date de fin"><input type="date" style={S.inp} value={loanForm.endDate} onChange={e => setLoanForm(p => ({ ...p, endDate: e.target.value }))} /></FField>
        </FRow>
        {(totalMonthly > 0 || months > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Mensualité totale', val: fEur(totalMonthly) + '/mois', color: '#60a5fa' },
              { label: 'Durée restante', val: `${months} mois`, color: '#a78bfa' },
              { label: 'Coût restant', val: fEur(costRemaining), color: '#f87171' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={saveLoan} style={S.btnG}>{editItem ? 'Enregistrer' : 'Ajouter'}</button>
          <button onClick={() => close(() => setLoanForm(mkLoan()))} style={S.btnS}>Annuler</button>
        </div>
      </ModalShell>
    );
  }

  // ── Crédit consommation ───────────────────────────────────────────────────
  if (modal === 'debt') {
    const months = mLeft(debtForm.endDate);
    return (
      <ModalShell T={T} title={editItem ? 'Modifier le crédit conso' : 'Nouveau crédit consommation'} onClose={() => close(() => setDebtForm(mkDebt()))}>
        <FRow cols={2}>
          <FField label="Nom"><input type="text" placeholder="Ex : Crédit auto, Crédit travaux" style={S.inp} value={debtForm.name} onChange={e => setDebtForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField label="Organisme prêteur"><input type="text" placeholder="Ex : Cetelem, Sofinco" style={S.inp} value={debtForm.lender} onChange={e => setDebtForm(p => ({ ...p, lender: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={3}>
          <FField label="Capital restant dû (€)"><input type="number" placeholder="0" style={S.inp} value={debtForm.capitalRemaining} onChange={e => setDebtForm(p => ({ ...p, capitalRemaining: e.target.value }))} /></FField>
          <FField label="Mensualité (€)"><input type="number" placeholder="0" style={S.inp} value={debtForm.monthlyPayment} onChange={e => setDebtForm(p => ({ ...p, monthlyPayment: e.target.value }))} /></FField>
          <FField label="Taux d'intérêt (%)"><input type="number" placeholder="0" step="0.01" style={S.inp} value={debtForm.rate} onChange={e => setDebtForm(p => ({ ...p, rate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={1}>
          <FField label="Date de fin"><input type="date" style={S.inp} value={debtForm.endDate} onChange={e => setDebtForm(p => ({ ...p, endDate: e.target.value }))} /></FField>
        </FRow>
        {months > 0 && (
          <div style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: T.textMuted }}>Durée restante</span>
            <span style={{ fontWeight: 700, color: '#f87171' }}>{months} mois</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={saveDebt} style={S.btnG}>{editItem ? 'Enregistrer' : 'Ajouter'}</button>
          <button onClick={() => close(() => setDebtForm(mkDebt()))} style={S.btnS}>Annuler</button>
        </div>
      </ModalShell>
    );
  }

  return null;
}
