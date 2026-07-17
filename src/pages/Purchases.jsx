import { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw, X, Eye, Truck, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import Pagination from '../components/Pagination';

function PurchaseModal({ onClose, onSaved }) {
    const { shop } = useAuth();
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState({
        supplier_id: '', product_id: '', quantity: 1, unit_cost: '',
        expected_at: '', notes: '', status: 'pending'
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function load() {
            const [s, p] = await Promise.all([
                supabase.from('suppliers').select('*').order('name'),
                supabase.from('products').select('*').order('name'),
            ]);
            setSuppliers(s.data || []);
            setProducts(p.data || []);
        }
        load();
    }, []);

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
    const total = (parseInt(form.quantity) || 0) * (parseFloat(form.unit_cost) || 0);

    const validate = () => {
        const e = {};
        if (!form.product_id) e.product_id = 'Product is required';
        if (!form.unit_cost || isNaN(form.unit_cost)) e.unit_cost = 'Valid cost required';
        if (form.quantity < 1) e.quantity = 'Quantity must be at least 1';
        return e;
    };

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setLoading(true);

        const orderNum = `PO-${Date.now()}`;
        const { data: po, error: poErr } = await supabase.from('purchase_orders').insert({
            order_number: orderNum,
            supplier_id: form.supplier_id || null,
            product_id: form.product_id,
            quantity: parseInt(form.quantity),
            unit_cost: parseFloat(form.unit_cost),
            total_cost: total,
            status: form.status,
            expected_at: form.expected_at || null,
            notes: form.notes || null,
            shop_id: shop?.id ?? null,
        }).select().single();

        if (poErr) { setErrors({ _: poErr.message }); setLoading(false); return; }

        // If received, immediately update stock
        if (form.status === 'received') {
            const prod = products.find(p => p.id === form.product_id);
            if (prod) {
                await supabase.from('products').update({ quantity: prod.quantity + parseInt(form.quantity) }).eq('id', form.product_id);
                await supabase.from('transactions').insert({
                    product_id: form.product_id, type: 'in', quantity: parseInt(form.quantity),
                    notes: `PO ${orderNum}`, shop_id: shop?.id ?? null,
                });
            }
        }

        cache.invalidate('purchase_orders', 'products', 'dashboard');
        setLoading(false);
        onSaved();
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-lg">
                <div className="modal-header">
                    <h2 className="modal-title">Create Purchase Order</h2>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    {errors._ && <div className="alert alert-error">{errors._}</div>}

                    <div className="form-row cols-2">
                        <div className="form-group">
                            <label className="form-label">Supplier</label>
                            <select className="form-control" value={form.supplier_id} onChange={e => f('supplier_id', e.target.value)}>
                                <option value="">Select supplier</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Product</label>
                            <select className={`form-control ${errors.product_id ? 'error' : ''}`} value={form.product_id} onChange={e => f('product_id', e.target.value)}>
                                <option value="">Select product</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            {errors.product_id && <div className="form-error">{errors.product_id}</div>}
                        </div>
                    </div>

                    <div className="form-row cols-3">
                        <div className="form-group">
                            <label className="form-label required">Quantity</label>
                            <input type="number" min="1" className={`form-control ${errors.quantity ? 'error' : ''}`}
                                value={form.quantity} onChange={e => f('quantity', e.target.value)} />
                            {errors.quantity && <div className="form-error">{errors.quantity}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Unit Cost ($)</label>
                            <input type="number" min="0" step="0.01" className={`form-control ${errors.unit_cost ? 'error' : ''}`}
                                value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} placeholder="0.00" />
                            {errors.unit_cost && <div className="form-error">{errors.unit_cost}</div>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Total Cost</label>
                            <div style={{ padding: '8px 12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 16, fontWeight: 700 }}>
                                ${total.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div className="form-row cols-2">
                        <div className="form-group">
                            <label className="form-label">Expected Delivery</label>
                            <input type="date" className="form-control" value={form.expected_at} onChange={e => f('expected_at', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-control" value={form.status} onChange={e => f('status', e.target.value)}>
                                <option value="pending">Pending</option>
                                <option value="received">Mark as Received (updates stock)</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {form.status === 'received' && (
                        <div className="alert alert-success">
                            <CheckCircle size={14} />
                            Stock will be updated immediately upon saving this order.
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-control" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional notes" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : 'Create Purchase Order'}
                    </button>
                </div>
            </div>
        </div>
    );
}

async function confirmReceipt(po, products, onSaved, shopId) {
    const prod = products.find(p => p.id === po.product_id);
    if (!prod) return;
    await Promise.all([
        supabase.from('purchase_orders').update({ status: 'received' }).eq('id', po.id),
        supabase.from('products').update({ quantity: prod.quantity + po.quantity }).eq('id', po.product_id),
        supabase.from('transactions').insert({
            product_id: po.product_id, type: 'in', quantity: po.quantity,
            notes: `PO ${po.order_number}`, shop_id: shopId ?? null,
        }),
    ]);
    cache.invalidate('purchase_orders', 'products', 'dashboard');
    onSaved();
}

export default function Purchases() {
    const [orders, setOrders] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 30;
    const { isStaff, shop } = useAuth();

    useEffect(() => { fetch(); }, []);

    async function fetch(force = false) {
        if (!force) {
            const cached = cache.get('purchase_orders');
            if (cached) {
                setOrders(cached.orders);
                setAllProducts(cached.products);
                setLoading(false);
                return;
            }
        }
        setLoading(true);
        const [pos, prods] = await Promise.all([
            supabase.from('purchase_orders').select('*, suppliers(name), products(name, quantity)').order('created_at', { ascending: false }),
            supabase.from('products').select('*'),
        ]);
        const orders = pos.data || [];
        const products = prods.data || [];
        cache.set('purchase_orders', { orders, products });
        setOrders(orders);
        setAllProducts(products);
        setLoading(false);
    }

    // Reset page on search or filter
    useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

    const filtered = orders.filter(o => {
        const matchSearch = (o.order_number || '').toLowerCase().includes(search.toLowerCase()) ||
            (o.suppliers?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (o.products?.name || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = !statusFilter || o.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedOrders = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Purchases</h1>
                    <p>{orders.length} purchase orders · {orders.filter(o => o.status === 'pending').length} pending</p>
                </div>
                <div className="page-header-actions">
                    {isStaff && <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={13} /> Create Purchase Order</button>}
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <div className="filters-bar" style={{ margin: 0 }}>
                        <div className="search-bar" style={{ width: 220 }}>
                            <Search size={14} style={{ color: 'var(--gray-400)' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search POs..." />
                        </div>
                        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="received">Received</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={fetch}><RefreshCw size={13} /></button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 24 }}>
                        {Array(5).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />)}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>PO Number</th>
                                    <th>Supplier</th>
                                    <th>Product</th>
                                    <th>Quantity</th>
                                    <th>Unit Cost</th>
                                    <th>Total Cost</th>
                                    <th>Expected</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.length === 0 ? (
                                    <tr><td colSpan={9}>
                                        <div className="empty-state">
                                            <Truck className="empty-state-icon" />
                                            <h3>No purchase orders</h3>
                                            <p>Create a purchase order to add stock.</p>
                                        </div>
                                    </td></tr>
                                ) : paginatedOrders.map(o => (
                                    <tr key={o.id}>
                                        <td><span className="tag">{o.order_number || o.id.slice(0, 8)}</span></td>
                                        <td>{o.suppliers?.name || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                                        <td style={{ fontWeight: 500 }}>{o.products?.name || '—'}</td>
                                        <td className="amount">{o.quantity}</td>
                                        <td className="amount">${parseFloat(o.unit_cost).toFixed(2)}</td>
                                        <td className="amount" style={{ fontWeight: 600 }}>${parseFloat(o.total_cost).toFixed(2)}</td>
                                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                                            {o.expected_at ? format(new Date(o.expected_at), 'MMM d, yyyy') : '—'}
                                        </td>
                                        <td><span className={`status-badge ${o.status}`}><span className="status-dot" />{o.status}</span></td>
                                        <td>
                                            <div className="table-actions">
                                                {o.status === 'pending' && isStaff && (
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        style={{ fontSize: 11, gap: 4 }}
                                                        onClick={() => confirmReceipt(o, allProducts, fetch, shop?.id)}
                                                    >
                                                        <CheckCircle size={12} /> Receive
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} />}
            </div>

            {showCreate && <PurchaseModal onClose={() => setShowCreate(false)} onSaved={fetch} />}
        </div>
    );
}
