import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, CheckCircle, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

/** Generate a random 6-digit numeric company code, e.g. "482910" */
function generateCompanyCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export default function CreateAccount() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        full_name: '',
        email: '',
        password: '',
        confirm_password: '',
        business_name: '',
        role: 'owner', // always owner; shopkeepers are invited via the Users page
    });
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [companyCode, setCompanyCode] = useState('');

    const f = (k, v) => {
        setForm(p => ({ ...p, [k]: v }));
        if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.full_name.trim()) e.full_name = 'Full name is required';
        if (!form.email.trim()) e.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
        if (!form.password) e.password = 'Password is required';
        else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
        if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }

        setLoading(true);
        setErrors({});

        const { data, error } = await supabase.auth.signUp({
            email: form.email.trim(),
            password: form.password,
            options: {
                data: { full_name: form.full_name.trim() },
            },
        });

        if (error) {
            setErrors({ _: error.message });
            setLoading(false);
            return;
        }

        // Upsert profile record with the chosen role
        if (data?.user) {
            await supabase.from('profiles').upsert({
                id: data.user.id,
                full_name: form.full_name.trim(),
                role: form.role,
            });

            // Create a shop if owner and business name is provided
            if (form.role === 'owner') {
                const code = generateCompanyCode();
                const shopName = form.business_name.trim() || `${form.full_name.trim()}'s Shop`;
                const { data: shop } = await supabase
                    .from('shops')
                    .insert({ name: shopName, code })
                    .select()
                    .single();
                if (shop) {
                    await supabase.from('profiles').update({ shop_id: shop.id }).eq('id', data.user.id);
                    setCompanyCode(code);
                }
            }
        }

        setLoading(false);
        setSuccess(true);
    };

    if (success) {
        return (
            <div className="login-page">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'var(--success-light)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
                    }}>
                        <CheckCircle size={32} style={{ color: 'var(--success)' }} />
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>
                        Account Created!
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
                        Your owner account is ready. You can sign in immediately.
                    </p>

                    {/* Show company code for owner registrations */}
                    {form.role === 'owner' && companyCode && (
                        <div style={{
                            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                            border: '1px solid #bfdbfe', borderRadius: 12,
                            padding: '16px 20px', marginBottom: 20, textAlign: 'left'
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                                🏢 Your Company Code
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: '#1e40af', letterSpacing: 4, fontFamily: 'monospace' }}>
                                {companyCode}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                                Share this with your shopkeepers so they can log in to your shop.
                            </div>
                        </div>
                    )}

                    <Link to="/login" className="btn btn-primary" style={{ justifyContent: 'center', width: '100%' }}>
                        Go to Sign In
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-card" style={{ maxWidth: 460 }}>
                {/* Brand */}
                <div className="login-brand" style={{ marginBottom: 16 }}>
                    <div className="login-brand-logo">E</div>
                    <h1>Easy<span>Stock</span></h1>
                    <p>Create your owner account to get started</p>
                </div>

                {/* Owner-only notice */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--primary-50), #ede9fe)',
                    border: '1px solid var(--primary-200, #c4b5fd)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '10px 14px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--primary-700, #6d28d9)',
                    fontWeight: 500,
                }}>
                    <Building2 size={14} style={{ flexShrink: 0 }} />
                    <span><strong>Owner Portal</strong> — This page is for business owners only. Shopkeepers are added by their owner.</span>
                </div>



                {errors._ && (
                    <div className="alert alert-error">
                        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{errors._}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    {/* Full Name */}
                    <div className="form-group">
                        <label className="form-label required">Full Name</label>
                        <input
                            type="text"
                            className={`form-control ${errors.full_name ? 'error' : ''}`}
                            placeholder="John Doe"
                            value={form.full_name}
                            onChange={e => f('full_name', e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                        {errors.full_name && <div className="form-error"><AlertCircle size={11} />{errors.full_name}</div>}
                    </div>

                    {/* Email */}
                    <div className="form-group">
                        <label className="form-label required">Email Address</label>
                        <input
                            type="email"
                            className={`form-control ${errors.email ? 'error' : ''}`}
                            placeholder="you@company.com"
                            value={form.email}
                            onChange={e => f('email', e.target.value)}
                            disabled={loading}
                        />
                        {errors.email && <div className="form-error"><AlertCircle size={11} />{errors.email}</div>}
                    </div>

                    {/* Password */}
                    <div className="form-group">
                        <label className="form-label required">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPass ? 'text' : 'password'}
                                className={`form-control ${errors.password ? 'error' : ''}`}
                                placeholder="Min. 6 characters"
                                value={form.password}
                                onChange={e => f('password', e.target.value)}
                                disabled={loading}
                                style={{ paddingRight: 40 }}
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}>
                                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        {errors.password && <div className="form-error"><AlertCircle size={11} />{errors.password}</div>}
                        {/* Strength indicator */}
                        {form.password && (
                            <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                                {[1, 2, 3].map(i => {
                                    const strength = form.password.length >= 10 ? 3 : form.password.length >= 6 ? 2 : 1;
                                    return (
                                        <div key={i} style={{
                                            flex: 1, height: 3, borderRadius: 2,
                                            background: i <= strength
                                                ? strength === 1 ? 'var(--danger)' : strength === 2 ? 'var(--warning)' : 'var(--success)'
                                                : 'var(--gray-200)',
                                            transition: 'background 0.2s'
                                        }} />
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="form-group">
                        <label className="form-label required">Confirm Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                className={`form-control ${errors.confirm_password ? 'error' : ''}`}
                                placeholder="Re-enter password"
                                value={form.confirm_password}
                                onChange={e => f('confirm_password', e.target.value)}
                                disabled={loading}
                                style={{ paddingRight: 40 }}
                            />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}>
                                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        {errors.confirm_password && (
                            <div className="form-error"><AlertCircle size={11} />{errors.confirm_password}</div>
                        )}
                        {form.confirm_password && !errors.confirm_password && form.password === form.confirm_password && (
                            <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={11} /> Passwords match
                            </div>
                        )}
                    </div>

                    {form.role === 'owner' && (
                        <>
                            <div className="divider" />
                            {/* Business Name */}
                            <div className="form-group">
                                <label className="form-label">
                                    <Building2 size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                    Business / Store Name
                                    <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400, marginLeft: 6 }}>(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. My General Store"
                                    value={form.business_name}
                                    onChange={e => f('business_name', e.target.value)}
                                    disabled={loading}
                                />
                                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                                    A unique Company Code will be auto-generated for your shop.
                                </div>
                            </div>
                        </>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                        disabled={loading}
                    >
                        {loading ? (
                            <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Creating Account...</>
                        ) : 'Create Account'}
                    </button>
                </form>

                {/* Footer Link */}
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)', marginTop: 20 }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
}
