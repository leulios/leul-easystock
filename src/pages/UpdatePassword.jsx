import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, CheckCircle, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function UpdatePassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    // Supabase sends the user here with a session already set via the URL hash.
    // We wait for the auth state to settle so we know we have a valid session.
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            // If the link was invalid / expired, send back to login
            if (event === 'SIGNED_OUT') {
                navigate('/login', { replace: true });
            }
        });
        return () => subscription.unsubscribe();
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password) { setError('Please enter a new password.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        if (password !== confirm) { setError('Passwords do not match.'); return; }

        setLoading(true);
        setError('');

        const { error: err } = await supabase.auth.updateUser({ password });
        setLoading(false);

        if (err) { setError(err.message); return; }

        setDone(true);
        // Redirect to login after 2.5 seconds
        setTimeout(() => navigate('/login', { replace: true }), 2500);
    };

    if (done) {
        return (
            <div className="login-page">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 16 }}>
                        <CheckCircle size={48} style={{ color: 'var(--success)' }} />
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
                        Password Updated!
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                        Redirecting you to sign in…
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-brand">
                    <div className="login-brand-logo">E</div>
                    <h1>Easy<span>Stock</span></h1>
                    <p>Set a new password</p>
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--primary-50)', border: '1px solid var(--primary-100)',
                    borderRadius: 'var(--radius)', padding: '10px 14px',
                    marginBottom: 20, fontSize: 13, color: 'var(--primary)',
                }}>
                    <Lock size={14} style={{ flexShrink: 0 }} />
                    Choose a strong password for your account.
                </div>

                {error && (
                    <div className="alert alert-error">
                        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label required">New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPass ? 'text' : 'password'}
                                className="form-control"
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                disabled={loading}
                                autoFocus
                                style={{ paddingRight: 40 }}
                            />
                            <button type="button" onClick={() => setShowPass(s => !s)}
                                style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    border: 'none', background: 'none', cursor: 'pointer',
                                    color: 'var(--gray-400)', display: 'flex', alignItems: 'center'
                                }}>
                                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label required">Confirm Password</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="Re-enter password"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            disabled={loading}
                        />
                        {confirm && password === confirm && (
                            <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={11} /> Passwords match
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                        disabled={loading}>
                        {loading
                            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Updating…</>
                            : 'Update Password'
                        }
                    </button>
                </form>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-400)', marginTop: 20 }}>
                    EasyStock · Secure Business Operations
                </p>
            </div>
        </div>
    );
}
