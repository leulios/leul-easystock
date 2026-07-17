import { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw, X, Building2, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

function SupplierModal({ supplier, onClose, onSaved }) {
    const { shop } = useAuth();
    const [form, setForm] = useState(supplier || { name: '', contact: '', email: '', phone: '', address: '' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!form.name) { setErrors({ name: 'Supplier name is required' }); return; }
        setLoading(true);
        const payload = { name: form.name, contact: form.contact || null, email: form.email || null, phone: form.phone || null, address: form.address || null };
        let err;
        if (supplier?.id) {
            ({ error: err } = await supabase.from('suppliers').update(payload).eq('id', supplier.id));
        } else {
            ({ error: err } = await supabase.from('suppliers').insert({ ...payload, shop_id: shop?.id ?? null }));
        }
        setLoading(false);
        if (err) { setErrors({ _: err.message }); return; }
        onSaved(); onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-md">
                <div className="modal-header">
                    <h2 className="modal-title">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    {errors._ && <div className="alert alert-error">{errors._}</div>}
                    <div className="form-group">
                        <label className="form-label required">Supplier Name</label>
                        <input className={`form-control ${errors.name ? 'error' : ''}`} value={form.name} onChange={e => f('name', e.target.value)} placeholder="Company name" />
                        {errors.name && <div className="form-error">{errors.name}</div>}
                    </div>
                    <div className="form-row cols-2">
                        <div className="form-group">
                            <label className="form-label">Contact Person</label>
                            <input className="form-control" value={form.contact || ''} onChange={e => f('contact', e.target.value)} placeholder="Full name" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input type="email" className="form-control" value={form.email || ''} onChange={e => f('email', e.target.value)} placeholder="email@company.com" />
                        </div>
                    </div>
                    <div className="form-row cols-2">
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-control" value={form.phone || ''} onChange={e => f('phone', e.target.value)} placeholder="+1 234 567 890" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Address</label>
                        <textarea className="form-control" rows={2} value={form.address || ''} onChange={e => f('address', e.target.value)} placeholder="Full address" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : (supplier ? 'Update' : 'Add Supplier')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SupplierDetailModal({ supplier, onClose }) {
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.from('purchase_orders').select('*, products(name)').eq('supplier_id', supplier.id)
            .order('created_at', { ascending: false }).then(({ data }) => { setPurchases(data || []); setLoading(false); });
    }, [supplier.id]);

    const totalValue = purchases.reduce((s, p) => s + (p.total_cost || 0), 0);

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-lg">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{supplier.name}</h2>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            {supplier.email || ''} {supplier.phone ? `· ${supplier.phone}` : ''}
                        </p>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    <div className="summary-panel" style={{ marginBottom: 20 }}>
                        <div className="summary-row"><span>Total Orders</span><span>{purchases.length}</span></div>
                        <div className="summary-row"><span>Total Purchased</span><span className="amount">${totalValue.toFixed(2)}</span></div>
                        <div className="summary-row"><span>Pending Orders</span><span>{purchases.filter(p => p.status === 'pending').length}</span></div>
                    </div>
                    <div className="card-title" style={{ marginBottom: 12 }}>Purchase History</div>
                    {loading ? <div className="spinner" style={{ margin: '24px auto' }} /> : (
                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>PO #</th><th>Product</th><th>Qty</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                                <tbody>
                                    {purchases.length === 0
                                        ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No purchases</td></tr>
                                        : purchases.map(p => (
                                            <tr key={p.id}>
                                                <td><span className="tag">{p.order_number || p.id.slice(0, 8)}</span></td>
                                                <td>{p.products?.name || '—'}</td>
                                                <td>{p.quantity}</td>
                                                <td className="amount">${parseFloat(p.total_cost).toFixed(2)}</td>
                                                <td><span className={`status-badge ${p.status}`}>{p.status}</span></td>
                                                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{format(new Date(p.created_at), 'MMM d, yyyy')}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [purchaseSummary, setPurchaseSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [viewItem, setViewItem] = useState(null);
    const [search, setSearch] = useState('');
    const { isStaff } = useAuth();

    useEffect(() => { fetch(); }, []);

    async function fetch() {
        setLoading(true);
        const [s, p] = await Promise.all([
            supabase.from('suppliers').select('*').order('name'),
            supabase.from('purchase_orders').select('supplier_id, total_cost, status'),
        ]);
        setSuppliers(s.data || []);
        const summary = {};
        (p.data || []).forEach(po => {
            if (!summary[po.supplier_id]) summary[po.supplier_id] = { total: 0, pending: 0, count: 0 };
            summary[po.supplier_id].total += po.total_cost || 0;
            summary[po.supplier_id].count++;
            if (po.status === 'pending') summary[po.supplier_id].pending += po.total_cost || 0;
        });
        setPurchaseSummary(summary);
        setLoading(false);
    }

    const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Suppliers</h1>
                    <p>{suppliers.length} suppliers registered</p>
                </div>
                <div className="page-header-actions">
                    {isStaff && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={13} /> Add Supplier</button>}
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <div className="search-bar" style={{ width: 240 }}>
                        <Search size={14} style={{ color: 'var(--gray-400)' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." />
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={fetch}><RefreshCw size={13} /></button>
                </div>

                {loading ? (
                    <div style={{ padding: 24 }}>
                        {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Supplier Name</th>
                                    <th>Contact</th>
                                    <th>Phone</th>
                                    <th>Total Orders</th>
                                    <th>Total Purchased</th>
                                    <th>Outstanding</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={7}>
                                        <div className="empty-state">
                                            <Building2 className="empty-state-icon" />
                                            <h3>No suppliers</h3>
                                            <p>Add your first supplier to track purchasing.</p>
                                        </div>
                                    </td></tr>
                                ) : filtered.map(s => {
                                    const sum = purchaseSummary[s.id] || {};
                                    return (
                                        <tr key={s.id}>
                                            <td><div style={{ fontWeight: 600 }}>{s.name}</div>{s.email && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.email}</div>}</td>
                                            <td>{s.contact || '—'}</td>
                                            <td>{s.phone || '—'}</td>
                                            <td>{sum.count || 0}</td>
                                            <td className="amount">${(sum.total || 0).toFixed(2)}</td>
                                            <td className="amount">${(sum.pending || 0).toFixed(2)}</td>
                                            <td>
                                                <div className="table-actions">
                                                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewItem(s)}><Eye size={14} /></button>
                                                    {isStaff && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditItem(s)}>Edit</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAdd && <SupplierModal onClose={() => setShowAdd(false)} onSaved={fetch} />}
            {editItem && <SupplierModal supplier={editItem} onClose={() => setEditItem(null)} onSaved={fetch} />}
            {viewItem && <SupplierDetailModal supplier={viewItem} onClose={() => setViewItem(null)} />}
        </div>
    );
}
