import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, ShieldCheck, ShoppingBag, CheckCircle, Hash } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const [role, setRole] = useState('owner');
    const [email, setEmail] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [companyCode, setCompanyCode] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resetMode, setResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const { signIn, signOut } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (role === 'owner') {
            if (!email || !password) { setError('Email and password are required.'); return; }
        } else {
            if (!companyCode.trim()) { setError('Company code is required.'); return; }
            if (!employeeId.trim()) { setError('Employee ID is required.'); return; }
            if (!password) { setError('Password is required.'); return; }
        }

        setLoading(true);
        setError('');

        // For shopkeepers, reconstruct the synthetic email used at creation
        const loginEmail = role === 'shopkeeper'
            ? `emp${employeeId.trim()}@shop${companyCode.trim()}.local`
            : email;

        const { data, error: err } = await signIn(loginEmail, password);
        if (err) {
            setError(
                role === 'shopkeeper'
                    ? 'Invalid Company Code, Employee ID, or Password.'
                    : (err.message || 'Invalid credentials. Please try again.')
            );
            setLoading(false);
            return;
        }

        // Login successful — AuthContext has already updated the user state.
        // App.jsx routing will handle the redirect automatically.
        setLoading(false);
    };

    const handleReset = async (e) => {
        e.preventDefault();
        if (!email) { setError('Enter your email address above.'); return; }
        setLoading(true);
        setError('');
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/update-password`,
        });
        setLoading(false);
        if (err) { setError(err.message); return; }
        setResetSent(true);
    };

    const isOwner = role === 'owner';

    if (resetSent) {
        return (
            <div className="login-page">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 16 }}>
                        <CheckCircle size={48} style={{ color: 'var(--success)' }} />
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>Check your email</h2>
                    <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>
                        We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
                    </p>
                    <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => { setResetSent(false); setResetMode(false); }}>
                        Back to Sign In
                    </button>
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
                    <p>Inventory &amp; Operations Management</p>
                </div>

                {/* Role Toggle */}
                <div style={{
                    display: 'flex', background: 'var(--gray-100)',
                    borderRadius: 'var(--radius-lg)', padding: 4, marginBottom: 24, gap: 4,
                }}>
                    {[
                        { key: 'owner', label: 'Owner', Icon: ShieldCheck },
                        { key: 'shopkeeper', label: 'Shopkeeper', Icon: ShoppingBag },
                    ].map(({ key, label, Icon }) => (
                        <button key={key} type="button"
                            onClick={() => { setRole(key); setError(''); setCompanyCode(''); setEmployeeId(''); }}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 6, padding: '8px 12px', borderRadius: 'var(--radius)', border: 'none',
                                cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                                transition: 'all 0.2s ease',
                                background: role === key ? (key === 'owner' ? 'var(--primary)' : 'var(--success)') : 'transparent',
                                color: role === key ? 'white' : 'var(--gray-500)',
                                boxShadow: role === key ? 'var(--shadow-sm)' : 'none',
                            }}>
                            <Icon size={14} />{label}
                        </button>
                    ))}
                </div>

                {/* Role hint */}
                <div style={{
                    fontSize: 12, color: 'var(--gray-500)',
                    background: isOwner ? 'var(--primary-50)' : 'var(--success-light)',
                    borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    {isOwner
                        ? <><ShieldCheck size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />Sign in with your <strong>owner</strong> account to access the full dashboard.</>
                        : <><ShoppingBag size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />Use your <strong>Company Code</strong>, <strong>Employee ID</strong> and password — no email needed.</>
                    }
                </div>

                {error && (
                    <div className="alert alert-error">
                        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={resetMode ? handleReset : handleSubmit}>
                    {/* Shopkeeper login fields */}
                    {!isOwner && !resetMode && (
                        <>
                            <div className="form-group">
                                <label className="form-label required" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Hash size={12} /> Company Code
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className="form-control"
                                    placeholder="e.g. 482910"
                                    value={companyCode}
                                    onChange={e => setCompanyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    disabled={loading}
                                    autoFocus
                                    maxLength={6}
                                    style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 4 }}
                                />
                                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                                    6-digit code from your owner.
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label required" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Hash size={12} /> Employee ID
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className="form-control"
                                    placeholder="e.g. 482910"
                                    value={employeeId}
                                    onChange={e => setEmployeeId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    disabled={loading}
                                    maxLength={6}
                                    style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 4 }}
                                />
                                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                                    6-digit ID shown when your account was created.
                                </div>
                            </div>
                        </>
                    )}

                    {/* Email — owner only */}
                    {isOwner && (
                        <div className="form-group">
                            <label className="form-label required">Email Address</label>
                            <input type="email" className="form-control" placeholder="you@company.com"
                                value={email} onChange={e => setEmail(e.target.value)}
                                autoFocus={isOwner} disabled={loading} />
                        </div>
                    )}

                    {!resetMode && (
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label className="form-label required" style={{ margin: 0 }}>Password</label>
                                <button type="button" onClick={() => { setResetMode(true); setError(''); }}
                                    style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                                    Forgot password?
                                </button>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input type={showPass ? 'text' : 'password'} className="form-control"
                                    placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                                    disabled={loading} style={{ paddingRight: 40 }} />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        border: 'none', background: 'none', cursor: 'pointer',
                                        color: 'var(--gray-400)', display: 'flex', alignItems: 'center'
                                    }}>
                                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-lg"
                        style={{
                            width: '100%', justifyContent: 'center', marginTop: 8,
                            background: resetMode ? 'var(--primary)' : (isOwner ? 'var(--primary)' : 'var(--success)'),
                        }}
                        disabled={loading}>
                        {loading
                            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />{resetMode ? 'Sending...' : 'Signing in...'}</>
                            : resetMode ? 'Send Reset Link' : `Sign in as ${isOwner ? 'Owner' : 'Shopkeeper'}`
                        }
                    </button>

                    {resetMode && (
                        <button type="button" className="btn btn-ghost"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                            onClick={() => { setResetMode(false); setError(''); }}>
                            Back to Sign In
                        </button>
                    )}
                </form>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-400)', marginTop: 20 }}>
                    EasyStock · Secure Business Operations
                </p>

                {!resetMode && isOwner && (
                    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-500)', marginTop: 10 }}>
                        New business?{' '}
                        <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                            Create an owner account →
                        </Link>
                    </p>
                )}
            </div>
        </div>
    );
}
