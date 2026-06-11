import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const SITUATIONS_FAMILIALES = ['Célibataire', 'En couple', 'Marié(e)', 'Pacsé(e)', 'Divorcé(e)', 'Veuf/Veuve'];
const STATUTS_PRO = ["Salarié(e)", "Fonctionnaire", "Indépendant(e)", "Chef d'entreprise", "Étudiant(e)", "Retraité(e)", "Sans emploi", "Autre"];

const EMPTY_PROFILE = {
  prenom: '', nom: '', dateNaissance: '', nationalite: '', situationFamiliale: '', nbEnfants: '',
  telephone: '', adresse: '', codePostal: '', ville: '', pays: '',
  statut: '', employeur: '', revenuMensuel: '', anciennete: '',
};

// ── Sous-composants au niveau module (jamais recréés à chaque render) ─────────

function SectionTitle({ T, icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px', paddingBottom: 8, borderBottom: `1px solid ${T.cardBorder}` }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textFaint }}>{label}</span>
    </div>
  );
}

function Field({ T, label, children, half }) {
  return (
    <div style={{ flex: half ? '0 0 calc(50% - 5px)' : '1 1 100%', marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>;
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function ProfilePage({ T, user, accent, onBack, currency, setCurrency, language, setLanguage, notifEnabled, handleNotif }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function load() {
      if (!user?.id) { setLoading(false); return; }
      try {
        const { data } = await supabase.from('user_data').select('profile').eq('user_id', user.id).single();
        if (data?.profile && typeof data.profile === 'object') {
          setProfile(prev => ({ ...prev, ...data.profile }));
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [user?.id]);

  const set = (key, val) => setProfile(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    if (newPwd && newPwd !== confirmPwd) {
      setMsg({ type: 'err', text: '❌ Les mots de passe ne correspondent pas' });
      return;
    }
    if (newPwd && newPwd.length < 6) {
      setMsg({ type: 'err', text: '❌ Mot de passe trop court (6 caractères min.)' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const { error: profileError } = await supabase.from('user_data').upsert({
        user_id: user.id,
        profile,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      const displayName = [profile.prenom, profile.nom].filter(Boolean).join(' ');
      if (displayName) localStorage.setItem('ct_displayname', displayName);

      if (newPwd) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: newPwd });
        if (pwdError) throw pwdError;
        setNewPwd(''); setConfirmPwd('');
      }

      setMsg({ type: 'ok', text: '✅ Profil enregistré' });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ type: 'err', text: '❌ ' + (e.message || "Erreur lors de l'enregistrement") });
    }
    setSaving(false);
  };

  const inp = {
    width: '100%', background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 8, color: T.text, padding: '8px 10px', fontSize: 13,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const initials = ([profile.prenom?.[0], profile.nom?.[0]].filter(Boolean).join('') || user?.email?.slice(0, 2) || '?').toUpperCase();
  const fullName = [profile.prenom, profile.nom].filter(Boolean).join(' ') || user?.email?.split('@')[0] || '';

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        <div style={{ animation: 'pulse 1.5s infinite', fontSize: 24, marginBottom: 10 }}>⏳</div>
        Chargement…
      </div>
    );
  }

  return (
    <div>
      {/* Retour */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 10px', borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 2 }}>
        <button
          onClick={onBack}
          style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 18, padding: '4px 8px', borderRadius: 6, fontFamily: 'inherit', display: 'flex', alignItems: 'center', lineHeight: 1, transition: 'background .1s' }}
          onMouseEnter={e => { e.currentTarget.style.background = T.cardBg; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textMuted; }}
        >
          ←
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1 }}>Mon profil</span>
      </div>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 6px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: accent + '28', border: `2px solid ${accent}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: accent, letterSpacing: '-.02em', marginBottom: 8 }}>
          {initials}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{fullName}</div>
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>{user?.email || ''}</div>
      </div>

      <div style={{ padding: '0 2px' }}>

        {/* IDENTITÉ */}
        <SectionTitle T={T} icon="👤" label="Identité" />
        <Row>
          <Field T={T} label="Prénom" half>
            <input style={inp} value={profile.prenom} onChange={e => set('prenom', e.target.value)} placeholder="Jean" />
          </Field>
          <Field T={T} label="Nom" half>
            <input style={inp} value={profile.nom} onChange={e => set('nom', e.target.value)} placeholder="Dupont" />
          </Field>
        </Row>
        <Row>
          <Field T={T} label="Date de naissance" half>
            <input style={inp} type="date" value={profile.dateNaissance} onChange={e => set('dateNaissance', e.target.value)} />
          </Field>
          <Field T={T} label="Nationalité" half>
            <input style={inp} value={profile.nationalite} onChange={e => set('nationalite', e.target.value)} placeholder="Française" />
          </Field>
        </Row>
        <Row>
          <Field T={T} label="Situation familiale" half>
            <select style={inp} value={profile.situationFamiliale} onChange={e => set('situationFamiliale', e.target.value)}>
              <option value="">— Choisir —</option>
              {SITUATIONS_FAMILIALES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field T={T} label="Nb. d'enfants" half>
            <input style={inp} type="number" min="0" max="20" value={profile.nbEnfants} onChange={e => set('nbEnfants', e.target.value)} placeholder="0" />
          </Field>
        </Row>

        {/* COORDONNÉES */}
        <SectionTitle T={T} icon="📍" label="Coordonnées" />
        <Field T={T} label="Email">
          <input style={{ ...inp, color: T.textFaint, cursor: 'not-allowed', opacity: 0.7 }} value={user?.email || ''} disabled />
        </Field>
        <Field T={T} label="Téléphone">
          <input style={inp} type="tel" value={profile.telephone} onChange={e => set('telephone', e.target.value)} placeholder="+33 6 00 00 00 00" />
        </Field>
        <Field T={T} label="Adresse">
          <input style={inp} value={profile.adresse} onChange={e => set('adresse', e.target.value)} placeholder="1 rue de la Paix" />
        </Field>
        <Row>
          <Field T={T} label="Code postal" half>
            <input style={inp} value={profile.codePostal} onChange={e => set('codePostal', e.target.value)} placeholder="75001" />
          </Field>
          <Field T={T} label="Ville" half>
            <input style={inp} value={profile.ville} onChange={e => set('ville', e.target.value)} placeholder="Paris" />
          </Field>
        </Row>
        <Field T={T} label="Pays">
          <input style={inp} value={profile.pays} onChange={e => set('pays', e.target.value)} placeholder="France" />
        </Field>

        {/* SITUATION PROFESSIONNELLE */}
        <SectionTitle T={T} icon="💼" label="Situation professionnelle" />
        <Row>
          <Field T={T} label="Statut" half>
            <select style={inp} value={profile.statut} onChange={e => set('statut', e.target.value)}>
              <option value="">— Choisir —</option>
              {STATUTS_PRO.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field T={T} label="Ancienneté (ans)" half>
            <input style={inp} type="number" min="0" value={profile.anciennete} onChange={e => set('anciennete', e.target.value)} placeholder="0" />
          </Field>
        </Row>
        <Row>
          <Field T={T} label="Employeur" half>
            <input style={inp} value={profile.employeur} onChange={e => set('employeur', e.target.value)} placeholder="Entreprise" />
          </Field>
          <Field T={T} label="Revenu mensuel net (€)" half>
            <input style={inp} type="number" min="0" value={profile.revenuMensuel} onChange={e => set('revenuMensuel', e.target.value)} placeholder="2 500" />
          </Field>
        </Row>

        {/* SÉCURITÉ */}
        <SectionTitle T={T} icon="🔒" label="Sécurité" />
        <Field T={T} label="Nouveau mot de passe">
          <input
            style={inp} type="password" value={newPwd}
            onChange={e => { setNewPwd(e.target.value); setMsg(null); }}
            placeholder="Laisser vide pour ne pas modifier"
            autoComplete="new-password"
          />
        </Field>
        {newPwd && (
          <Field T={T} label="Confirmer le mot de passe">
            <input
              style={{ ...inp, borderColor: confirmPwd && confirmPwd !== newPwd ? '#f87171' : T.inputBorder }}
              type="password" value={confirmPwd}
              onChange={e => { setConfirmPwd(e.target.value); setMsg(null); }}
              placeholder="Répéter le nouveau mot de passe"
              autoComplete="new-password"
            />
          </Field>
        )}

        {/* PRÉFÉRENCES */}
        <SectionTitle T={T} icon="⚙️" label="Préférences" />
        <Row>
          <Field T={T} label="Devise" half>
            <select style={inp} value={currency} onChange={e => setCurrency(e.target.value)}>
              {['EUR','USD','GBP','CHF','JPY','CAD','AUD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field T={T} label="Langue" half>
            <select style={inp} value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </Field>
        </Row>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 10px' }}>
          <div>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>Notifications</div>
            <div style={{ fontSize: 11, color: T.textFaint }}>Alertes et rappels</div>
          </div>
          <button
            onClick={handleNotif}
            style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: notifEnabled ? accent : T.cardBorder, border: 'none', cursor: 'pointer', transition: 'background .2s', padding: 0, flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 2, left: notifEnabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
          </button>
        </div>

        {/* Feedback */}
        {msg && (
          <div style={{ margin: '8px 0 10px', padding: '9px 12px', background: msg.type === 'ok' ? 'rgba(74,222,128,.1)' : 'rgba(248,113,113,.1)', border: `1px solid ${msg.type === 'ok' ? 'rgba(74,222,128,.25)' : 'rgba(248,113,113,.25)'}`, borderRadius: 8, fontSize: 12, color: msg.type === 'ok' ? '#4ade80' : '#f87171', fontWeight: 600 }}>
            {msg.text}
          </div>
        )}

        {/* Bouton enregistrer */}
        <button
          onClick={save}
          disabled={saving}
          style={{ width: '100%', background: `linear-gradient(135deg,${accent},${accent}cc)`, border: 'none', borderRadius: 10, color: '#fff', padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1, marginBottom: 6 }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
        </button>
      </div>
    </div>
  );
}
