import { useEffect, useState } from 'react';
import { Search, RefreshCw, UserPlus, X, Shield, Users as UsersIcon, Copy, CheckCircle, Eye, EyeOff, Building2, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

function CredentialsModal({ credentials, onClose }) {
    const [copied, setCopied] = useState(null);
    const [showPass, setShowPass] = useState(false);

    const copy = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const rows = [
        { label: 'Company Code', value: credentials.company_code, key: 'code', mono: true, highlight: true },
        { label: 'Full Name', value: credentials.full_name, key: 'name' },
        { label: 'Employee ID', value: credentials.employee_id, key: 'eid', mono: true },
    ];

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-sm">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Account Created ✓</h2>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            Share these credentials with the shopkeeper
                        </p>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={13} />
                        Shopkeeper account is ready to use immediately.
                    </div>

                    {rows.map(({ label, value, key, mono, highlight }) => (
                        <div key={key}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: highlight ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : 'var(--gray-50)',
                                border: `1px solid ${highlight ? '#bfdbfe' : 'var(--gray-200)'}`,
                                borderRadius: 8, padding: '8px 12px'
                            }}>
                                <span style={{
                                    flex: 1, fontSize: highlight ? 18 : 13,
                                    fontWeight: 700,
                                    color: highlight ? '#1e40af' : 'var(--gray-800)',
                                    letterSpacing: mono ? 3 : 0,
                                    fontFamily: mono ? 'monospace' : 'inherit'
                                }}>{value}</span>
                                <button onClick={() => copy(value, key)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: copied === key ? 'var(--success)' : 'var(--gray-400)', display: 'flex' }}>
                                    {copied === key ? <CheckCircle size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Password row with show/hide */}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Password</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '8px 12px' }}>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', letterSpacing: showPass ? 0 : 3 }}>
                                {showPass ? credentials.password : '••••••••'}
                            </span>
                            <button onClick={() => setShowPass(s => !s)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button onClick={() => copy(credentials.password, 'pass')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: copied === 'pass' ? 'var(--success)' : 'var(--gray-400)', display: 'flex' }}>
                                {copied === 'pass' ? <CheckCircle size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--gray-400)', background: 'var(--warning-light)', borderRadius: 8, padding: '8px 12px' }}>
                        ⚠ Save these credentials now — the password cannot be retrieved later.
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
}

function AddShopkeeperModal({ onClose, onSaved, ownerShopId, ownerCompanyCode }) {
    const [form, setForm] = useState({ full_name: '', password: '' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const validate = () => {
        const e = {};
        if (!form.full_name) e.full_name = 'Full name is required';
        if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
        return e;
    };

    const handleSave = async () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setLoading(true);

        // Generate a unique 6-digit employee ID
        const employeeId = String(Math.floor(100000 + Math.random() * 900000));
        const shopCode = ownerCompanyCode ?? '000000';

        // Call the Edge Function — uses Admin API server-side so the owner's
        // session is NEVER replaced by the new shopkeeper's session.
        const { data, error: fnErr } = await supabase.functions.invoke('create-shopkeeper', {
            body: {
                full_name: form.full_name,
                password: form.password,
                shop_id: ownerShopId,
                company_code: shopCode,
                employee_id: employeeId,
            },
        });

        if (fnErr || data?.error) {
            setErrors({ _: data?.error ?? fnErr?.message ?? 'Failed to create account.' });
            setLoading(false);
            return;
        }

        setLoading(false);
        onSaved({ full_name: form.full_name, password: form.password, company_code: ownerCompanyCode ?? '—', employee_id: employeeId });
    };

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-sm">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Add Shopkeeper</h2>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            You set their login credentials
                        </p>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    {errors._ && <div className="alert alert-error">{errors._}</div>}

                    <div className="form-group">
                        <label className="form-label required">Full Name</label>
                        <input className={`form-control ${errors.full_name ? 'error' : ''}`}
                            value={form.full_name} onChange={e => f('full_name', e.target.value)} placeholder="e.g. Abebe Kebede" autoFocus />
                        {errors.full_name && <div className="form-error">{errors.full_name}</div>}
                    </div>

                    <div className="form-group">
                        <label className="form-label required">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input type={showPass ? 'text' : 'password'} className={`form-control ${errors.password ? 'error' : ''}`}
                                value={form.password} onChange={e => f('password', e.target.value)}
                                placeholder="Min. 6 characters" style={{ paddingRight: 40 }} />
                            <button type="button" onClick={() => setShowPass(s => !s)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        {errors.password && <div className="form-error">{errors.password}</div>}
                    </div>

                    {/* Company code info box */}
                    {ownerCompanyCode && (
                        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                            <div style={{ color: '#3b82f6', fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Hash size={11} /> Company Code
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e40af', letterSpacing: 3, fontFamily: 'monospace' }}>
                                {ownerCompanyCode}
                            </div>
                            <div style={{ color: '#64748b', marginTop: 4 }}>
                                The shopkeeper will need this code to sign in.
                            </div>
                        </div>
                    )}

                    <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--primary)', marginTop: 8 }}>
                        <Shield size={12} style={{ display: 'inline', marginRight: 4 }} />
                        This creates a <strong>Shopkeeper</strong> account — access is limited to Sales only.
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Creating...' : 'Create Account'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Users() {
    const { profile, shop } = useAuth();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [credentials, setCredentials] = useState(null);
    const [search, setSearch] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => { fetchUsers(); }, []);

    async function fetchUsers() {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setProfiles(data || []);
        setLoading(false);
    }

    const copyCode = () => {
        if (shop?.code) {
            navigator.clipboard.writeText(shop.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const filtered = profiles.filter(p =>
        (p.full_name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Users &amp; Roles</h1>
                    <p>Owner-only · Create and manage shopkeeper accounts</p>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                        <UserPlus size={13} /> Add Shopkeeper
                    </button>
                </div>
            </div>

            {/* Company Code Banner */}
            {shop?.code && (
                <div style={{
                    background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                    borderRadius: 12, padding: '16px 20px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
                }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Building2 size={11} /> {shop.name} · Company Code
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: 5, fontFamily: 'monospace' }}>
                            {shop.code}
                        </div>
                        <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 4 }}>
                            Share this code with shopkeepers so they can log in to your shop.
                        </div>
                    </div>
                    <button
                        onClick={copyCode}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.15)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: 8, padding: '8px 14px',
                            color: copied ? '#6ee7b7' : 'white', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, transition: 'all 0.2s'
                        }}
                    >
                        {copied ? <><CheckCircle size={13} /> Copied!</> : <><Copy size={13} /> Copy Code</>}
                    </button>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <div className="search-bar" style={{ width: 240 }}>
                        <Search size={14} style={{ color: 'var(--gray-400)' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." />
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={fetchUsers}><RefreshCw size={13} /></button>
                </div>

                {loading ? (
                    <div style={{ padding: 24 }}>{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}</div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Member Since</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={3}>
                                        <div className="empty-state">
                                            <UsersIcon className="empty-state-icon" />
                                            <h3>No users yet</h3>
                                            <p>Add shopkeepers to grant them access.</p>
                                        </div>
                                    </td></tr>
                                ) : filtered.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.role === 'owner' ? 'linear-gradient(135deg, #3b82f6, #1e40af)' : 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>
                                                    {(p.full_name || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{p.full_name || 'Unnamed User'}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>ID: {p.id.slice(0, 8)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span className={`role-badge ${p.role}`}>{p.role}</span></td>
                                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                                            {p.created_at ? format(new Date(p.created_at), 'MMM d, yyyy') : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAdd && (
                <AddShopkeeperModal
                    onClose={() => setShowAdd(false)}
                    onSaved={(creds) => {
                        setShowAdd(false);
                        fetchUsers();
                        setCredentials(creds);
                    }}
                    ownerShopId={profile?.shop_id ?? null}
                    ownerCompanyCode={shop?.code ?? null}
                />
            )}
            {credentials && (
                <CredentialsModal
                    credentials={credentials}
                    onClose={() => setCredentials(null)}
                />
            )}
        </div>
    );
}
