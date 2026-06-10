import { makeS, fEur, fDate, today, CAT_COLORS, HEALTH_CATS, CASH_TYPES, CASH_TYPE_INFO, ITEM_CONDITIONS, PORTFOLIO_TYPES, PORTFOLIO_TYPE_ICON, PORTFOLIO_BROKERS_PEA, PORTFOLIO_BROKERS_CTO, PORTFOLIO_AV_TYPES, PORTFOLIO_AV_INSURERS, PORTFOLIO_CRYPTO_PLATFORMS, PORTFOLIO_CRYPTO_TYPES, PORTFOLIO_IMMO_TYPES, PORTFOLIO_PE_TYPES } from '../utils/constants';
// modal === 'drill' (position form) is handled by PositionFormModal in App.js

// ── Local atoms ───────────────────────────────────────────────────────────────
const CMShell = ({ T, title, icon, color, onClose, maxWidth = 560, children }) => (
  <div
    onClick={e => e.target === e.currentTarget && onClose()}
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}
  >
    <div style={{ background: T.bg3, border: `1px solid ${color}30`, borderRadius: 20, width: '100%', maxWidth, margin: '0 16px', overflow: 'hidden', boxShadow: `0 32px 80px rgba(0,0,0,.65), 0 0 0 1px ${color}18`, animation: 'slideUp .2s ease' }}>
      <div style={{ background: `linear-gradient(135deg,${color}1a,${color}0a)`, borderBottom: `1px solid ${color}25`, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 42, height: 42, background: color + '22', border: `1px solid ${color}45`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {icon}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>{title}</h3>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: T.textMuted, padding: '5px 12px', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: '22px 24px' }}>{children}</div>
    </div>
  </div>
);

const FRow = ({ cols = 2, children }) => <div className={`frow frow-${cols}`}>{children}</div>;
const Lbl = ({ children }) => (
  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</label>
);
const FField = ({ label, children, style }) => <div style={style}><Lbl>{label}</Lbl>{children}</div>;
const CBtn = ({ color, onClick, children, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{ background: disabled ? '#4b5563' : `linear-gradient(135deg,${color},${color}cc)`, border: 'none', borderRadius: 10, color: '#fff', padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
    {children}
  </button>
);
const fa = color => ({ paddingLeft: 10, borderLeft: `3px solid ${color}45`, borderRadius: '0 0 0 3px' });

const mLeft = endDate => {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  return Math.max(0, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()));
};

// ── Color maps for modals ─────────────────────────────────────────────────────
const TX_META = {
  income:         { color: '#10B981', icon: '📈', label: 'Revenu' },
  expense:        { color: '#EF4444', icon: '💳', label: 'Dépense' },
  transfer:       { color: '#60A5FA', icon: '↕️',  label: 'Virement' },
  loan_repayment: { color: '#FB923C', icon: '🏦', label: 'Remboursement' },
};
const PORTFOLIO_MODAL_COLOR = {
  PEA: '#10B981', CTO: '#10B981',
  'Assurance-vie': '#3B82F6',
  Crypto: '#F59E0B',
  Immobilier: '#8B5CF6',
  'Épargne salariale': '#06B6D4',
  Autre: '#94A3B8',
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function Modals({ T, data }) {
  const S = makeS(T);
  const {
    modal, setModal, editItem, setEditItem,
    txForm, setTxForm, healthForm, setHealthForm,
    goalForm, setGoalForm, cashForm, setCashForm,
    listingForm, setListingForm, loanForm, setLoanForm, debtForm, setDebtForm,
    mkTx, mkHealth, mkCash, mkListing, mkLoan, mkDebt, mkPortfolio,
    saveTx, saveHealth, saveListing, saveCash, saveGoal, saveLoan, saveDebt,
    savePortfolio,
    portfolioForm, setPortfolioForm,
    investments,
    allAccounts, computedLoans,
    listings, soldHistory,
    divForm, setDivForm, divInvId, addDividend,
  } = data;

  if (!modal) return null;
  const close = reset => { setModal(null); setEditItem(null); reset && reset(); };

  // ── Transaction ──────────────────────────────────────────────────────────────
  if (modal === 'tx') {
    const meta  = TX_META[txForm.type] || TX_META.expense;
    const c     = meta.color;
    const f     = fa(c);
    const isTransfer   = txForm.type === 'transfer';
    const isRepayment  = txForm.type === 'loan_repayment';
    const acctLabel    = txForm.type === 'income' ? 'Compte crédité' : isTransfer ? 'Compte source' : 'Compte débité';
    return (
      <CMShell T={T} icon={meta.icon} color={c} onClose={() => close(() => setTxForm(mkTx()))}
        title={editItem ? `Modifier — ${meta.label}` : `Nouvelle ${meta.label.toLowerCase()}`}>
        <FRow cols={2}>
          <FField style={f} label="Date"><input type="date" style={S.inp} value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} /></FField>
          <FField style={f} label="Type">
            <select style={S.inp} value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value }))}>
              <option value="income">Revenu (entrée)</option>
              <option value="expense">Dépense (sortie)</option>
              <option value="transfer">Virement entre comptes</option>
              <option value="loan_repayment">Remboursement crédit</option>
            </select>
          </FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Libellé"><input type="text" placeholder={isTransfer ? 'Ex : Virement PEA' : isRepayment ? 'Ex : Remb. crédit immo' : 'Ex : Salaire, Loyer…'} style={S.inp} value={txForm.label} onChange={e => setTxForm(p => ({ ...p, label: e.target.value }))} /></FField>
          <FField style={f} label="Montant (€)"><input type="number" placeholder="0" style={S.inp} value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} /></FField>
        </FRow>
        {!isTransfer && !isRepayment && (
          <FRow cols={2}>
            <FField style={f} label="Catégorie">
              <select style={S.inp} value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))}>
                {Object.keys(CAT_COLORS).map(c2 => <option key={c2}>{c2}</option>)}
              </select>
            </FField>
            <FField style={f} label="Récurrente">
              <select style={S.inp} value={txForm.recurrent ? 'oui' : 'non'} onChange={e => setTxForm(p => ({ ...p, recurrent: e.target.value === 'oui' }))}>
                <option value="non">Non (ponctuelle)</option>
                <option value="oui">Oui (mensuelle)</option>
              </select>
            </FField>
          </FRow>
        )}
        <FRow cols={isTransfer ? 2 : 1}>
          <FField style={f} label={acctLabel}>
            <select style={S.inp} value={txForm.accountId} onChange={e => setTxForm(p => ({ ...p, accountId: e.target.value }))}>
              <option value="">— Aucun compte lié —</option>
              {allAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FField>
          {isTransfer && (
            <FField style={f} label="Compte destination">
              <select style={S.inp} value={txForm.destAccountId} onChange={e => setTxForm(p => ({ ...p, destAccountId: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {allAccounts.filter(a => a.id !== txForm.accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FField>
          )}
        </FRow>
        {isRepayment && computedLoans.length > 0 && (
          <FRow cols={1}>
            <FField style={f} label="Crédit remboursé (optionnel)">
              <select style={S.inp} value={txForm.loanId} onChange={e => setTxForm(p => ({ ...p, loanId: e.target.value }))}>
                <option value="">— Aucun crédit lié —</option>
                {computedLoans.map(l => <option key={l.id} value={l.id}>{l.name} — {new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(l.computedRemaining)} restants</option>)}
              </select>
            </FField>
          </FRow>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveTx}>{editItem ? 'Enregistrer' : 'Ajouter'}</CBtn>
          <button onClick={() => close(() => setTxForm(mkTx()))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  // ── Enveloppe d'investissement ────────────────────────────────────────────────
  if (modal === 'portfolio') {
    const pt   = portfolioForm.type;
    const c    = PORTFOLIO_MODAL_COLOR[pt] || '#94A3B8';
    const icon = PORTFOLIO_TYPE_ICON[pt] || '📦';
    const f    = fa(c);
    const isAV  = pt === 'Assurance-vie';
    const isCrypto = pt === 'Crypto';
    const isImmo = pt === 'Immobilier';
    const isPE  = pt === 'Épargne salariale';
    const isPEA = pt === 'PEA';
    const isCTO = pt === 'CTO';
    const needsValue = isAV || isImmo || isPE || pt === 'Autre';
    return (
      <CMShell T={T} title={editItem ? "Modifier l'enveloppe" : 'Nouvelle enveloppe'} icon={icon} color={c} onClose={() => close(() => setPortfolioForm(mkPortfolio()))}>
        <FRow cols={2}>
          <FField style={f} label="Nom de l'enveloppe"><input type="text" placeholder="Ex : PEA Boursobank, Crypto Binance…" style={S.inp} value={portfolioForm.name} onChange={e => setPortfolioForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label="Type">
            <select style={S.inp} value={portfolioForm.type} onChange={e => setPortfolioForm(p => ({ ...p, type: e.target.value }))}>
              {PORTFOLIO_TYPES.map(t => <option key={t} value={t}>{PORTFOLIO_TYPE_ICON[t]} {t}</option>)}
            </select>
          </FField>
        </FRow>

        {(isPEA || isCTO) && (
          <FRow cols={2}>
            <FField style={f} label="Courtier">
              <select style={S.inp} value={portfolioForm.courtier} onChange={e => setPortfolioForm(p => ({ ...p, courtier: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {(isPEA ? PORTFOLIO_BROKERS_PEA : PORTFOLIO_BROKERS_CTO).map(b => <option key={b}>{b}</option>)}
              </select>
            </FField>
            <FField style={f} label="Date d'ouverture"><input type="date" style={S.inp} value={portfolioForm.openDate} onChange={e => setPortfolioForm(p => ({ ...p, openDate: e.target.value }))} /></FField>
          </FRow>
        )}
        {isPEA && portfolioForm.openDate && (() => {
          const open = new Date(portfolioForm.openDate);
          const fiveY = new Date(open.getFullYear() + 5, open.getMonth(), open.getDate());
          const passed = new Date() >= fiveY;
          return <div style={{ background: passed ? 'rgba(16,185,129,.08)' : 'rgba(96,165,250,.08)', border: `1px solid ${passed ? 'rgba(16,185,129,.2)' : 'rgba(96,165,250,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: passed ? '#4ade80' : '#60a5fa' }}>{passed ? '✅ Avantage fiscal PEA actif (5 ans dépassés)' : `⏳ Avantage fiscal le ${fiveY.toLocaleDateString('fr-FR')} — plafond 150 000 €`}</div>;
        })()}

        {isAV && (
          <FRow cols={2}>
            <FField style={f} label="Assureur">
              <select style={S.inp} value={portfolioForm.assureur} onChange={e => setPortfolioForm(p => ({ ...p, assureur: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {PORTFOLIO_AV_INSURERS.map(b => <option key={b}>{b}</option>)}
              </select>
            </FField>
            <FField style={f} label="Type de contrat">
              <select style={S.inp} value={portfolioForm.avType} onChange={e => setPortfolioForm(p => ({ ...p, avType: e.target.value }))}>
                {PORTFOLIO_AV_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FField>
          </FRow>
        )}
        {isAV && portfolioForm.openDate && (() => {
          const open = new Date(portfolioForm.openDate);
          const eightY = new Date(open.getFullYear() + 8, open.getMonth(), open.getDate());
          const passed = new Date() >= eightY;
          return <div style={{ background: passed ? 'rgba(16,185,129,.08)' : 'rgba(96,165,250,.08)', border: `1px solid ${passed ? 'rgba(16,185,129,.2)' : 'rgba(96,165,250,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: passed ? '#4ade80' : '#60a5fa' }}>{passed ? '✅ Fiscalité AV avantageuse (8 ans dépassés)' : `⏳ Avantage fiscal le ${eightY.toLocaleDateString('fr-FR')}`}</div>;
        })()}

        {isCrypto && (
          <FRow cols={2}>
            <FField style={f} label="Plateforme">
              <select style={S.inp} value={portfolioForm.platform} onChange={e => setPortfolioForm(p => ({ ...p, platform: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {PORTFOLIO_CRYPTO_PLATFORMS.map(b => <option key={b}>{b}</option>)}
              </select>
            </FField>
            <FField style={f} label="Type de wallet">
              <select style={S.inp} value={portfolioForm.walletType} onChange={e => setPortfolioForm(p => ({ ...p, walletType: e.target.value }))}>
                {PORTFOLIO_CRYPTO_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FField>
          </FRow>
        )}

        {isImmo && (
          <>
            <FRow cols={2}>
              <FField style={f} label="Type de bien">
                <select style={S.inp} value={portfolioForm.immoBien} onChange={e => setPortfolioForm(p => ({ ...p, immoBien: e.target.value }))}>
                  {PORTFOLIO_IMMO_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </FField>
              <FField style={f} label="Date d'acquisition"><input type="date" style={S.inp} value={portfolioForm.acquisitionDate} onChange={e => setPortfolioForm(p => ({ ...p, acquisitionDate: e.target.value }))} /></FField>
            </FRow>
            <FRow cols={1}>
              <FField style={f} label="Adresse"><input type="text" placeholder="12 rue des Lilas, 75011 Paris" style={S.inp} value={portfolioForm.adresse} onChange={e => setPortfolioForm(p => ({ ...p, adresse: e.target.value }))} /></FField>
            </FRow>
            <FRow cols={2}>
              <FField style={f} label="Loyer mensuel (€)"><input type="number" placeholder="0" style={S.inp} value={portfolioForm.loyerMensuel} onChange={e => setPortfolioForm(p => ({ ...p, loyerMensuel: e.target.value }))} /></FField>
              <FField style={f} label="Charges mensuelles (€)"><input type="number" placeholder="0" style={S.inp} value={portfolioForm.chargesMensuelles} onChange={e => setPortfolioForm(p => ({ ...p, chargesMensuelles: e.target.value }))} /></FField>
            </FRow>
          </>
        )}

        {isPE && (
          <FRow cols={2}>
            <FField style={f} label="Employeur"><input type="text" placeholder="Nom de l'entreprise" style={S.inp} value={portfolioForm.employeur} onChange={e => setPortfolioForm(p => ({ ...p, employeur: e.target.value }))} /></FField>
            <FField style={f} label="Type de plan">
              <select style={S.inp} value={portfolioForm.peType} onChange={e => setPortfolioForm(p => ({ ...p, peType: e.target.value }))}>
                {PORTFOLIO_PE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FField>
          </FRow>
        )}
        {isPE && (
          <FRow cols={1}>
            <FField style={f} label="Date de disponibilité"><input type="date" style={S.inp} value={portfolioForm.disponibiliteDate} onChange={e => setPortfolioForm(p => ({ ...p, disponibiliteDate: e.target.value }))} /></FField>
          </FRow>
        )}
        {(needsValue || isImmo) && (
          <FRow cols={2}>
            <FField style={f} label="Valeur actuelle (€)"><input type="number" placeholder="0" style={S.inp} value={portfolioForm.value} onChange={e => setPortfolioForm(p => ({ ...p, value: e.target.value }))} /></FField>
            <FField style={f} label="Montant investi (€)"><input type="number" placeholder="0" style={S.inp} value={portfolioForm.invested} onChange={e => setPortfolioForm(p => ({ ...p, invested: e.target.value }))} /></FField>
          </FRow>
        )}
        <FRow cols={1}>
          <FField style={f} label="Notes"><input type="text" placeholder="Remarques…" style={S.inp} value={portfolioForm.notes} onChange={e => setPortfolioForm(p => ({ ...p, notes: e.target.value }))} /></FField>
        </FRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={savePortfolio}>{editItem ? 'Enregistrer' : 'Ajouter'}</CBtn>
          <button onClick={() => close(() => setPortfolioForm(mkPortfolio()))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  // ── Patrimoine matériel ──────────────────────────────────────────────────────
  if (modal === 'health') {
    const c = '#F87171';
    const f = fa(c);
    const usedCats = [...new Set([...HEALTH_CATS, ...(listings.map(l => l.category)), ...(soldHistory.map(l => l.category))].filter(Boolean))];
    return (
      <CMShell T={T} title={editItem ? "Modifier l'actif" : 'Nouvel actif matériel'} icon="📦" color={c} onClose={() => close(() => setHealthForm(mkHealth()))}>
        <FRow cols={2}>
          <FField style={f} label="Nom"><input type="text" placeholder="Ex : Renault Clio, Collection…" style={S.inp} value={healthForm.name} onChange={e => setHealthForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label="Catégorie">
            <input type="text" list="health-cats-list" placeholder="Ex : Voiture, Collection…" style={S.inp} value={healthForm.category} onChange={e => setHealthForm(p => ({ ...p, category: e.target.value }))} />
            <datalist id="health-cats-list">{usedCats.map(cc => <option key={cc} value={cc} />)}</datalist>
          </FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Prix d'achat (€)"><input type="number" placeholder="0" style={S.inp} value={healthForm.buyPrice} onChange={e => setHealthForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
          <FField style={f} label="Valeur actuelle (€)"><input type="number" placeholder="0" style={S.inp} value={healthForm.currentValue} onChange={e => setHealthForm(p => ({ ...p, currentValue: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="État">
            <select style={S.inp} value={healthForm.condition || 'Bon état'} onChange={e => setHealthForm(p => ({ ...p, condition: e.target.value }))}>
              {ITEM_CONDITIONS.map(cc => <option key={cc}>{cc}</option>)}
            </select>
          </FField>
          <FField style={f} label="Lieu de stockage"><input type="text" placeholder="Ex : Garage, Cave…" style={S.inp} value={healthForm.storageLocation || ''} onChange={e => setHealthForm(p => ({ ...p, storageLocation: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Date d'acquisition"><input type="date" style={S.inp} value={healthForm.date} onChange={e => setHealthForm(p => ({ ...p, date: e.target.value }))} /></FField>
          <FField style={f} label="Notes"><input type="text" placeholder="Remarques…" style={S.inp} value={healthForm.notes} onChange={e => setHealthForm(p => ({ ...p, notes: e.target.value }))} /></FField>
        </FRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveHealth}>{editItem ? 'Enregistrer' : 'Ajouter'}</CBtn>
          <button onClick={() => close(() => setHealthForm(mkHealth()))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  // ── Objectif ──────────────────────────────────────────────────────────────────
  if (modal === 'goal') {
    const c = goalForm.color || '#10B981';
    const f = fa(c);
    return (
      <CMShell T={T} title={editItem ? "Modifier l'objectif" : 'Nouvel objectif'} icon="🎯" color={c} onClose={() => close(() => setGoalForm({}))}>
        <FRow cols={1}>
          <FField style={f} label="Nom de l'objectif"><input type="text" placeholder="Ex : Indépendance financière" style={S.inp} value={goalForm.name || ''} onChange={e => setGoalForm(p => ({ ...p, name: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Montant cible (€)"><input type="number" placeholder="0" style={S.inp} value={goalForm.target || ''} onChange={e => setGoalForm(p => ({ ...p, target: e.target.value }))} /></FField>
          <FField style={f} label="Date limite"><input type="date" style={S.inp} value={goalForm.deadline || ''} onChange={e => setGoalForm(p => ({ ...p, deadline: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={1}>
          <FField style={f} label="Couleur">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
              {['#10b981','#60a5fa','#f59e0b','#f472b6','#a78bfa','#fb923c','#34d399','#f87171'].map(col => (
                <button key={col} onClick={() => setGoalForm(p => ({ ...p, color: col }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: col, border: goalForm.color === col ? `3px solid #fff` : '3px solid transparent', cursor: 'pointer', padding: 0, outline: 'none' }} />
              ))}
            </div>
          </FField>
        </FRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveGoal}>{editItem ? 'Enregistrer' : 'Ajouter'}</CBtn>
          <button onClick={() => close(() => setGoalForm({}))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  // ── Épargne & Cash ───────────────────────────────────────────────────────────
  if (modal === 'cash') {
    const c = '#34D399';
    const f = fa(c);
    return (
      <CMShell T={T} title={editItem ? 'Modifier le compte' : 'Nouveau compte épargne'} icon="💰" color={c} onClose={() => close(() => setCashForm(mkCash()))}>
        <FRow cols={2}>
          <FField style={f} label="Nom du compte"><input type="text" placeholder="Ex : Livret A CA" style={S.inp} value={cashForm.name} onChange={e => setCashForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label="Type">
            <select style={S.inp} value={cashForm.type} onChange={e => {
              const info = CASH_TYPE_INFO[e.target.value] || {};
              setCashForm(p => ({ ...p, type: e.target.value, rate: info.rate != null ? info.rate : p.rate }));
            }}>
              {CASH_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Solde (€)"><input type="number" placeholder="0" style={S.inp} value={cashForm.balance} onChange={e => setCashForm(p => ({ ...p, balance: e.target.value }))} /></FField>
          <FField style={f} label="Taux annuel (%)"><input type="number" placeholder="0" step="0.01" style={S.inp} value={cashForm.rate} onChange={e => setCashForm(p => ({ ...p, rate: e.target.value }))} /></FField>
        </FRow>
        {(() => {
          const info = CASH_TYPE_INFO[cashForm.type] || {};
          const bal = parseFloat(cashForm.balance) || 0;
          const cap = info.cap;
          const overCap = cap != null && bal > cap;
          const remaining = cap != null ? cap - bal : null;
          return (
            <>
              {bal > 0 && cashForm.rate > 0 && (
                <div style={{ background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 12, color: '#4ade80' }}>
                  💰 Intérêts annuels estimés : {fEur(bal * parseFloat(cashForm.rate) / 100)}
                </div>
              )}
              {cap != null && (
                <div style={{ background: overCap ? 'rgba(248,113,113,.08)' : 'rgba(96,165,250,.08)', border: `1px solid ${overCap ? 'rgba(248,113,113,.3)' : 'rgba(96,165,250,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: overCap ? '#f87171' : '#60a5fa' }}>Plafond réglementaire : {fEur(cap)}</span>
                    {overCap && <span style={{ color: '#f87171', fontWeight: 700 }}>⚠ DÉPASSÉ</span>}
                  </div>
                  {!overCap && remaining != null && <span style={{ color: '#94a3b8' }}>Capacité restante : {fEur(remaining)}</span>}
                </div>
              )}
            </>
          );
        })()}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveCash}>{editItem ? 'Enregistrer' : 'Ajouter'}</CBtn>
          <button onClick={() => close(() => setCashForm(mkCash()))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  // ── Article en vente ──────────────────────────────────────────────────────────
  if (modal === 'listing') {
    const c = '#A78BFA';
    const f = fa(c);
    const usedCats      = [...new Set([...listings.map(l => l.category), ...soldHistory.map(l => l.category)].filter(Boolean))];
    const usedPlatforms = [...new Set([...listings.map(l => l.platform), ...soldHistory.map(l => l.platform)].filter(Boolean))];
    return (
      <CMShell T={T} title={editItem ? "Modifier l'article" : 'Nouvel article en vente'} icon="🏷️" color={c} onClose={() => close(() => setListingForm(mkListing()))}>
        <FRow cols={2}>
          <FField style={f} label="Nom"><input type="text" placeholder="Ex : iPhone 13 Pro" style={S.inp} value={listingForm.name} onChange={e => setListingForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label="Catégorie">
            <input type="text" list="listing-cats-list" placeholder="Ex : Électronique, Vêtements…" style={S.inp} value={listingForm.category} onChange={e => setListingForm(p => ({ ...p, category: e.target.value }))} />
            <datalist id="listing-cats-list">{usedCats.map(cc => <option key={cc} value={cc} />)}</datalist>
          </FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Plateforme de vente">
            <input type="text" list="listing-platforms-list" placeholder="Ex : eBay, Vinted, LeBonCoin…" style={S.inp} value={listingForm.platform} onChange={e => setListingForm(p => ({ ...p, platform: e.target.value }))} />
            <datalist id="listing-platforms-list">{usedPlatforms.map(pl => <option key={pl} value={pl} />)}</datalist>
          </FField>
          <FField style={f} label="Date de mise en vente"><input type="date" style={S.inp} value={listingForm.listedDate} onChange={e => setListingForm(p => ({ ...p, listedDate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="État">
            <select style={S.inp} value={listingForm.condition || 'Bon état'} onChange={e => setListingForm(p => ({ ...p, condition: e.target.value }))}>
              {ITEM_CONDITIONS.map(cc => <option key={cc}>{cc}</option>)}
            </select>
          </FField>
          <FField style={f} label="Lieu de stockage"><input type="text" placeholder="Ex : Cave, Garage…" style={S.inp} value={listingForm.storageLocation || ''} onChange={e => setListingForm(p => ({ ...p, storageLocation: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={3}>
          <FField style={f} label="Prix achat (€)"><input type="number" placeholder="0" style={S.inp} value={listingForm.buyPrice} onChange={e => setListingForm(p => ({ ...p, buyPrice: e.target.value }))} /></FField>
          <FField style={f} label="Prix vente (€)"><input type="number" placeholder="0" style={S.inp} value={listingForm.sellPrice} onChange={e => setListingForm(p => ({ ...p, sellPrice: e.target.value }))} /></FField>
          <FField style={f} label="Frais (€)"><input type="number" placeholder="0" style={S.inp} value={listingForm.fees} onChange={e => setListingForm(p => ({ ...p, fees: e.target.value }))} /></FField>
        </FRow>
        {listingForm.buyPrice !== '' && listingForm.sellPrice !== '' && (() => {
          const profit = parseFloat(listingForm.sellPrice || 0) - parseFloat(listingForm.buyPrice || 0) - parseFloat(listingForm.fees || 0);
          return (
            <div style={{ background: profit >= 0 ? 'rgba(16,185,129,.08)' : 'rgba(248,113,113,.08)', border: `1px solid ${profit >= 0 ? 'rgba(16,185,129,.2)' : 'rgba(248,113,113,.2)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 12, color: profit >= 0 ? '#4ade80' : '#f87171' }}>
              {profit >= 0 ? '💰' : '⚠️'} Bénéfice espéré : <strong>{profit >= 0 ? '+' : ''}{fEur(profit)}</strong>
            </div>
          );
        })()}
        <FRow cols={1}>
          <FField style={f} label="Notes"><input type="text" placeholder="Détails supplémentaires…" style={S.inp} value={listingForm.notes} onChange={e => setListingForm(p => ({ ...p, notes: e.target.value }))} /></FField>
        </FRow>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveListing}>{editItem ? 'Enregistrer' : 'Ajouter'}</CBtn>
          <button onClick={() => close(() => setListingForm(mkListing()))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  // ── Dividende ─────────────────────────────────────────────────────────────────
  if (modal === 'div') {
    const c   = '#10B981';
    const f   = fa(c);
    const inv = investments.find(i => i.id === divInvId);
    const closeDiv = () => { setModal(null); setDivForm({ date: today(), amount: '', gross: true, note: '' }); };
    return (
      <CMShell T={T} title={`Dividende — ${inv?.name || ''}`} icon="💸" color={c} onClose={closeDiv}>
        <FRow cols={2}>
          <FField style={f} label="Date de réception"><input type="date" style={S.inp} value={divForm.date} onChange={e => setDivForm(p => ({ ...p, date: e.target.value }))} /></FField>
          <FField style={f} label="Montant reçu (€)"><input type="number" placeholder="0.00" step="0.01" style={S.inp} value={divForm.amount} onChange={e => setDivForm(p => ({ ...p, amount: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Type">
            <select style={S.inp} value={divForm.gross ? 'brut' : 'net'} onChange={e => setDivForm(p => ({ ...p, gross: e.target.value === 'brut' }))}>
              <option value="brut">Brut (avant PFU)</option>
              <option value="net">Net (après PFU 30%)</option>
            </select>
          </FField>
          <FField style={f} label="Note"><input type="text" placeholder="Ex : Dividende trimestriel" style={S.inp} value={divForm.note} onChange={e => setDivForm(p => ({ ...p, note: e.target.value }))} /></FField>
        </FRow>
        {divForm.amount && parseFloat(divForm.amount) > 0 && (
          <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#4ade80' }}>
            {divForm.gross ? `Net estimé (après PFU 30%) : ${fEur(parseFloat(divForm.amount) * 0.7)}` : `Brut estimé : ${fEur(parseFloat(divForm.amount) / 0.7)}`}
          </div>
        )}
        {inv?.dividends?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>Historique ({inv.dividends.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
              {[...inv.dividends].sort((a, b) => b.date.localeCompare(a.date)).map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: T.bg2, borderRadius: 8, fontSize: 12 }}>
                  <span style={{ color: T.textMuted }}>{fDate(d.date)}{d.note ? ` · ${d.note}` : ''}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#4ade80', fontWeight: 600 }}>+{fEur(d.amount)}</span>
                    <span style={{ fontSize: 10, color: d.gross ? '#fb923c' : '#a78bfa', background: d.gross ? 'rgba(251,146,60,.12)' : 'rgba(167,139,250,.12)', padding: '1px 6px', borderRadius: 4 }}>{d.gross ? 'brut' : 'net'}</span>
                    <button onClick={() => data.delDividend(divInvId, d.id)} style={{ ...S.btnD, padding: '1px 6px', fontSize: 10 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <CBtn color={c} onClick={() => { addDividend(divInvId, divForm); setDivForm(p => ({ ...p, amount: '', note: '' })); }} disabled={!divForm.amount}>Ajouter</CBtn>
          <button onClick={closeDiv} style={S.btnS}>Fermer</button>
        </div>
      </CMShell>
    );
  }

  // ── Crédit immobilier ─────────────────────────────────────────────────────────
  if (modal === 'loan') {
    const c            = '#EF4444';
    const f            = fa(c);
    const totalMonthly = (parseFloat(loanForm.monthlyPayment) || 0) + (parseFloat(loanForm.insuranceAmount) || 0);
    const months       = mLeft(loanForm.endDate);
    const costLeft     = Math.max(0, months * totalMonthly - (parseFloat(loanForm.capitalRemaining) || 0));
    return (
      <CMShell T={T} title={editItem ? 'Modifier le crédit immobilier' : 'Nouveau crédit immobilier'} icon="🏠" color={c} onClose={() => close(() => setLoanForm(mkLoan()))}>
        <FRow cols={2}>
          <FField style={f} label="Bien financé"><input type="text" placeholder="Ex : Appartement Paris" style={S.inp} value={loanForm.name} onChange={e => setLoanForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label="Organisme prêteur"><input type="text" placeholder="Ex : Crédit Agricole" style={S.inp} value={loanForm.lender} onChange={e => setLoanForm(p => ({ ...p, lender: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Capital emprunté (€)"><input type="number" placeholder="0" style={S.inp} value={loanForm.capitalBorrowed} onChange={e => setLoanForm(p => ({ ...p, capitalBorrowed: e.target.value }))} /></FField>
          <FField style={f} label="Capital restant dû (€)"><input type="number" placeholder="0" style={S.inp} value={loanForm.capitalRemaining} onChange={e => setLoanForm(p => ({ ...p, capitalRemaining: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Mensualité hors assurance (€)"><input type="number" placeholder="0" style={S.inp} value={loanForm.monthlyPayment} onChange={e => setLoanForm(p => ({ ...p, monthlyPayment: e.target.value }))} /></FField>
          <FField style={f} label="Taux d'intérêt (%)"><input type="number" placeholder="0" step="0.01" style={S.inp} value={loanForm.rate} onChange={e => setLoanForm(p => ({ ...p, rate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={3}>
          <FField style={f} label="Assurance (€/mois)"><input type="number" placeholder="0" style={S.inp} value={loanForm.insuranceAmount} onChange={e => setLoanForm(p => ({ ...p, insuranceAmount: e.target.value }))} /></FField>
          <FField style={f} label="Organisme assurance"><input type="text" placeholder="CNP, Crédit Mutuel…" style={S.inp} value={loanForm.insuranceOrganisme} onChange={e => setLoanForm(p => ({ ...p, insuranceOrganisme: e.target.value }))} /></FField>
          <FField style={f} label="Taux assurance (%)"><input type="number" placeholder="0" step="0.001" style={S.inp} value={loanForm.insuranceRate} onChange={e => setLoanForm(p => ({ ...p, insuranceRate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={2}>
          <FField style={f} label="Date de début"><input type="date" style={S.inp} value={loanForm.startDate} onChange={e => setLoanForm(p => ({ ...p, startDate: e.target.value }))} /></FField>
          <FField style={f} label="Date de fin"><input type="date" style={S.inp} value={loanForm.endDate} onChange={e => setLoanForm(p => ({ ...p, endDate: e.target.value }))} /></FField>
        </FRow>
        {(totalMonthly > 0 || months > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Mensualité totale', val: fEur(totalMonthly) + '/mois', color: '#60a5fa' },
              { label: 'Durée restante',   val: `${months} mois`,             color: '#a78bfa' },
              { label: 'Coût restant',     val: fEur(costLeft),               color: '#f87171' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: T.bg2, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveLoan}>{editItem ? 'Enregistrer' : 'Ajouter'}</CBtn>
          <button onClick={() => close(() => setLoanForm(mkLoan()))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  // ── Crédit consommation ────────────────────────────────────────────────────────
  if (modal === 'debt') {
    const c      = '#FB923C';
    const f      = fa(c);
    const months = mLeft(debtForm.endDate);
    return (
      <CMShell T={T} title={editItem ? 'Modifier le crédit conso' : 'Nouveau crédit consommation'} icon="💳" color={c} onClose={() => close(() => setDebtForm(mkDebt()))}>
        <FRow cols={2}>
          <FField style={f} label="Nom"><input type="text" placeholder="Ex : Crédit auto, Crédit travaux" style={S.inp} value={debtForm.name} onChange={e => setDebtForm(p => ({ ...p, name: e.target.value }))} /></FField>
          <FField style={f} label="Organisme prêteur"><input type="text" placeholder="Ex : Cetelem, Sofinco" style={S.inp} value={debtForm.lender} onChange={e => setDebtForm(p => ({ ...p, lender: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={3}>
          <FField style={f} label="Capital restant dû (€)"><input type="number" placeholder="0" style={S.inp} value={debtForm.capitalRemaining} onChange={e => setDebtForm(p => ({ ...p, capitalRemaining: e.target.value }))} /></FField>
          <FField style={f} label="Mensualité (€)"><input type="number" placeholder="0" style={S.inp} value={debtForm.monthlyPayment} onChange={e => setDebtForm(p => ({ ...p, monthlyPayment: e.target.value }))} /></FField>
          <FField style={f} label="Taux d'intérêt (%)"><input type="number" placeholder="0" step="0.01" style={S.inp} value={debtForm.rate} onChange={e => setDebtForm(p => ({ ...p, rate: e.target.value }))} /></FField>
        </FRow>
        <FRow cols={1}>
          <FField style={f} label="Date de fin"><input type="date" style={S.inp} value={debtForm.endDate} onChange={e => setDebtForm(p => ({ ...p, endDate: e.target.value }))} /></FField>
        </FRow>
        {months > 0 && (
          <div style={{ background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: T.textMuted }}>Durée restante</span>
            <span style={{ fontWeight: 700, color: c }}>{months} mois</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CBtn color={c} onClick={saveDebt}>{editItem ? 'Enregistrer' : 'Ajouter'}</CBtn>
          <button onClick={() => close(() => setDebtForm(mkDebt()))} style={S.btnS}>Annuler</button>
        </div>
      </CMShell>
    );
  }

  return null;
}
