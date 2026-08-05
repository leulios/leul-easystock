import { useEffect, useState } from 'react';
import { Search, RefreshCw, UserPlus, X, Shield, Users as UsersIcon, Copy, CheckCircle, Eye, EyeOff, Building2, Hash } from 'lucide-react';
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

    const isOwner = credentials.role === 'owner';

    const rows = isOwner ? [
        { label: 'Full Name', value: credentials.fullName, key: 'name' },
        { label: 'Email', value: credentials.email, key: 'email', highlight: true },
        { label: 'Role', value: 'Owner', key: 'role', mono: true }
    ] : [
        { label: 'Company Code', value: credentials.companyCode, key: 'code', mono: true, highlight: true },
        { label: 'Full Name', value: credentials.fullName, key: 'name' },
        { label: 'Employee ID', value: credentials.employeeId, key: 'eid', mono: true },
    ];

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-sm">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Account Created ✓</h2>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            Share these credentials with the user
                        </p>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={13} />
                        Account is ready to use immediately.
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

function AddUserModal({ onClose, onSaved, ownerCompanyCode }) {
    const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'shopkeeper' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const validate = () => {
        const e = {};
        if (!form.fullName) e.fullName = 'Full name is required';
        if (form.role === 'owner') {
            if (!form.email) e.email = 'Email is required';
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
        }
        if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
        return e;
    };

    const handleSave = async () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setLoading(true);

        const employeeId = String(Math.floor(100000 + Math.random() * 900000));
        const shopCode = ownerCompanyCode ?? '000000';

        try {
            const res = await fetch('/api/auth?action=create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password,
                    fullName: form.fullName,
                    role: form.role,
                    employeeId,
                    companyCode: shopCode
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create user');

            setLoading(false);
            onSaved({ 
                fullName: form.fullName, 
                email: form.email, 
                password: form.password, 
                role: form.role,
                employeeId,
                companyCode: shopCode
            });
        } catch (err) {
            setErrors({ _: err.message });
            setLoading(false);
        }
    };

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-sm">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Add User</h2>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            Create a new account for your team
                        </p>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    {errors._ && <div className="alert alert-error">{errors._}</div>}

                    <div className="form-group">
                        <label className="form-label required">Role</label>
                        <select className="form-control" value={form.role} onChange={e => { f('role', e.target.value); setErrors({}); }}>
                            <option value="shopkeeper">Shopkeeper (Logs in via Employee ID)</option>
                            <option value="owner">Owner (Logs in via Email)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label required">Full Name</label>
                        <input className={`form-control ${errors.fullName ? 'error' : ''}`}
                            value={form.fullName} onChange={e => f('fullName', e.target.value)} placeholder="e.g. Abebe Kebede" autoFocus />
                        {errors.fullName && <div className="form-error">{errors.fullName}</div>}
                    </div>

                    {form.role === 'owner' && (
                        <div className="form-group">
                            <label className="form-label required">Email Address</label>
                            <input type="email" className={`form-control ${errors.email ? 'error' : ''}`}
                                value={form.email} onChange={e => f('email', e.target.value)} placeholder="name@example.com" />
                            {errors.email && <div className="form-error">{errors.email}</div>}
                        </div>
                    )}

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

                    {form.role === 'shopkeeper' && ownerCompanyCode && (
                        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                            <div style={{ color: '#3b82f6', fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Hash size={11} /> Company Code
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e40af', letterSpacing: 3, fontFamily: 'monospace' }}>
                                {ownerCompanyCode}
                            </div>
                            <div style={{ color: '#64748b', marginTop: 4 }}>
                                A unique 6-digit Employee ID will be generated upon creation.
                            </div>
                        </div>
                    )}

                    {form.role === 'shopkeeper' && (
                        <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--primary)', marginTop: 8 }}>
                            <Shield size={12} style={{ display: 'inline', marginRight: 4 }} />
                            <strong>Shopkeepers</strong> have limited access. They cannot view reports, users, or settings.
                        </div>
                    )}
                    {form.role === 'owner' && (
                        <div style={{ background: 'var(--warning-light)', border: '1px solid #fde047', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#b45309', marginTop: 8 }}>
                            <Shield size={12} style={{ display: 'inline', marginRight: 4 }} />
                            <strong>Owners</strong> have full access to everything in your shop, including deleting data.
                        </div>
                    )}
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
        try {
            const res = await fetch('/api/db?table=profiles');
            const data = await res.json();
            if (data.data) {
                setProfiles(data.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            }
        } catch (e) {
            console.error(e);
        }
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
        (p.fullName || '').toLowerCase().includes(search.toLowerCase()) || 
        (p.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Users &amp; Roles</h1>
                    <p>Owner-only · Create and manage team accounts</p>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                        <UserPlus size={13} /> Add User
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
                                            <h3>No users found</h3>
                                        </div>
                                    </td></tr>
                                ) : filtered.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.role === 'owner' ? 'linear-gradient(135deg, #3b82f6, #1e40af)' : 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>
                                                    {(p.fullName || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{p.fullName || 'Unnamed User'}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                                                        {p.role === 'owner' ? p.email : `EMP ID: ${p.email.match(/emp(\d+)/)?.[1] || 'Unknown'}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span className={`role-badge ${p.role}`}>{p.role}</span></td>
                                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                                            {p.createdAt ? format(new Date(p.createdAt), 'MMM d, yyyy') : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAdd && (
                <AddUserModal
                    onClose={() => setShowAdd(false)}
                    onSaved={(creds) => {
                        setShowAdd(false);
                        fetchUsers();
                        setCredentials(creds);
                    }}
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
