import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthScreen({ onDemo }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handle = async e => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Compte créé ! Vérifiez votre email pour activer votre compte.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const inp = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f1f5f9', padding: '11px 14px', fontSize: 14, width: '100%', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' };

  return (
    <div style={{ minHeight: '100vh', background: '#080e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ width: 60, height: 60, background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>💰</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.04em', color: '#f1f5f9' }}>CashTrack</div>
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
            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>Mot de passe</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" style={inp} />
            </div>
            {error && <div style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f87171', marginBottom: 14 }}>{error}</div>}
            {success && <div style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#4ade80', marginBottom: 14 }}>{success}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 10, color: '#fff', padding: 13, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
              {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
            </button>
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
