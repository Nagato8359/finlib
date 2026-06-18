import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import logo from '../logo.png';
import HCaptcha from '@hcaptcha/react-hcaptcha';

const BLOCKED_DOMAINS = new Set([
  'ozsaip.com','mailinator.com','tempmail.com','guerrillamail.com','throwam.com',
  'yopmail.com','sharklasers.com','trashmail.com','fakeinbox.com','maildrop.cc',
  'dispostable.com','spamgourmet.com','mytemp.email','temp-mail.org','getnada.com',
  'armyspy.com','cuvox.de','dayrep.com','einrot.com','fleckens.hu','gustr.com',
  'rhyta.com','superrito.com','teleworm.us',
]);

export default function AuthScreen({ onDemo }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const captchaRef = useRef(null);

  useEffect(() => {
    const refParam = new URLSearchParams(window.location.search).get('ref');
    if (refParam) {
      const code = refParam.trim().toUpperCase();
      setReferralCode(code);
      localStorage.setItem('capitaly_ref', code);
      setMode('register');
    } else {
      const stored = localStorage.getItem('capitaly_ref');
      if (stored) setReferralCode(stored);
    }
  }, []);

  const translateError = msg => {
    if (!msg) return 'Une erreur est survenue';
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials'))         return 'Email ou mot de passe incorrect';
    if (m.includes('email not confirmed'))               return 'Veuillez confirmer votre email avant de vous connecter';
    if (m.includes('user not found'))                    return 'Aucun compte trouvé avec cet email';
    if (m.includes('too many requests'))                 return 'Trop de tentatives, réessayez dans quelques minutes';
    if (m.includes('network') || m.includes('fetch'))   return 'Erreur réseau, vérifiez votre connexion';
    return msg;
  };

  const handle = async e => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (mode === 'register') {
        const domain = email.split('@')[1]?.toLowerCase() || '';
        if (BLOCKED_DOMAINS.has(domain)) { setError("Cette adresse email n'est pas acceptée."); setLoading(false); return; }
        if (!captchaToken) { setError('Veuillez compléter le CAPTCHA.'); setLoading(false); return; }
        const { data: signUpData, error } = await supabase.auth.signUp({ email, password, options: { captchaToken } });
        if (error) throw error;
        if (referralCode.trim() && signUpData?.user?.id) {
          fetch('/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referral_code: referralCode.trim().toUpperCase(), referred_id: signUpData.user.id }),
          }).catch(() => {});
        }
        setSuccess('Compte créé ! Vérifiez votre email pour activer votre compte.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { setError(translateError(err.message)); }
    finally { setLoading(false); }
  };

  const handleForgot = async () => {
    setError(''); setSuccess('');
    if (!email) { setError('Entrez votre email ci-dessus pour réinitialiser votre mot de passe'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setResetSent(true);
      setSuccess(`Un email de réinitialisation a été envoyé à ${email}`);
    } catch (err) { setError(translateError(err.message)); }
    finally { setLoading(false); }
  };

  const inp = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f1f5f9', padding: '11px 14px', fontSize: 14, width: '100%', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' };

  return (
    <div style={{ minHeight: '100vh', background: '#080e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <img src={logo} alt="Capitaly" style={{ width: 280, height: 'auto', marginBottom: 8 }} />
          <div style={{ fontSize: 14, color: '#4b5563', marginTop: 6 }}>Votre patrimoine, en clair</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, marginBottom: 24, gap: 3 }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                style={{ flex: 1, border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: mode === m ? 'rgba(16,185,129,.2)' : 'transparent', color: mode === m ? '#10b981' : '#4b5563', transition: 'all .15s' }}>
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={handle}>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" style={inp} />
            </div>
            <div style={{ marginBottom: mode === 'register' ? 14 : 22 }}>
              <label style={lbl}>Mot de passe</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" style={inp} />
            </div>
            {mode === 'register' && (
              <div style={{ marginBottom: 22 }}>
                <label style={lbl}>Code de parrainage <span style={{ color: '#4b5563', fontWeight: 400 }}>(optionnel)</span></label>
                <input type="text" value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} placeholder="Code de parrainage (optionnel)" style={{ ...inp, textTransform: 'uppercase', letterSpacing: '.08em' }} maxLength={12} />
              </div>
            )}
            {mode === 'register' && (
              <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
                <HCaptcha
                  sitekey={process.env.REACT_APP_HCAPTCHA_SITE_KEY}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  ref={captchaRef}
                  theme="dark"
                />
              </div>
            )}
            {error && <div style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f87171', marginBottom: 14 }}>{error}</div>}
            {success && <div style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#4ade80', marginBottom: 14 }}>{success}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 10, color: '#fff', padding: 13, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
              {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
            </button>
            {mode === 'login' && !resetSent && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button type="button" onClick={handleForgot} disabled={loading}
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
                  Mot de passe oublié ?
                </button>
              </div>
            )}
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={onDemo} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#6b7280', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '8px 20px', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
              Explorer en mode démo →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
