import { useState } from 'react';
import { supabase } from '../supabaseClient';
import logo from '../logo.png';

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const inp = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f1f5f9', padding: '11px 14px', fontSize: 14, width: '100%', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' };

  const handle = async e => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setSuccess(true);
      setTimeout(() => {
        window.location.hash = '';
        onDone();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <img src={logo} alt="Capitaly" style={{ width: 280, height: 'auto', marginBottom: 8 }} />
          <div style={{ fontSize: 14, color: '#4b5563', marginTop: 6 }}>Votre patrimoine, en clair</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Nouveau mot de passe</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Choisissez un nouveau mot de passe pour votre compte.</p>

          {success ? (
            <div style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, padding: '14px', fontSize: 14, color: '#4ade80', textAlign: 'center' }}>
              ✓ Mot de passe mis à jour ! Redirection…
            </div>
          ) : (
            <form onSubmit={handle}>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Nouveau mot de passe</label>
                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" style={inp} />
              </div>
              <div style={{ marginBottom: 22 }}>
                <label style={lbl}>Confirmer le mot de passe</label>
                <input type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Répétez le mot de passe" style={inp} />
              </div>
              {error && (
                <div style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f87171', marginBottom: 14 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 10, color: '#fff', padding: 13, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? '…' : 'Mettre à jour le mot de passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
