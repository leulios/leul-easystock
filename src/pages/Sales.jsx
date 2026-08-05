import { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw, X, Eye, ShoppingCart, Printer } from 'lucide-react';
import { cache } from '../lib/cache';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import InvoiceModal from './Invoices';
import Pagination from '../components/Pagination';
import BarcodeScanner from '../components/BarcodeScanner';

// ─── helpers ──────────────────────────────────────────────────────────────────
async function apiGet(table, params = {}) {
    const qs = new URLSearchParams({ table, ...params }).toString();
    const res = await fetch(`/api/db?${qs}`);
    const json = await res.json();
    return json.data || [];
}

async function apiPost(table, body) {
    const res = await fetch(`/api/db?table=${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json.data;
}

async function apiPut(table, body) {
    const res = await fetch(`/api/db?table=${table}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json.data;
}

// ─── CreateSaleModal ──────────────────────────────────────────────────────────
function CreateSaleModal({ onClose, onSaved }) {
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState({
        customer_id: '', notes: '', tax_rate: 0, payment_status: 'pending',
        items: [{ product_id: '', product: null, quantity: 1, unit_price: 0 }]
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [scanMode, setScanMode] = useState(false);

    useEffect(() => {
        Promise.all([
            apiGet('customers'),
            apiGet('products'),
        ]).then(([c, p]) => { setCustomers(c); setProducts(p); });
    }, []);

    const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_id: '', product: null, quantity: 1, unit_price: 0 }] }));
    const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

    const updateItem = (i, key, value) => {
        setForm(f => {
            const items = [...f.items];
            items[i] = { ...items[i], [key]: value };
            if (key === 'product_id') {
                const prod = products.find(p => p.id === value);
                items[i].product = prod || null;
                items[i].unit_price = prod ? parseFloat(prod.unitPrice || 0) : 0;
            }
            return { ...f, items };
        });
    };

    const handleScan = (sku) => {
        setScanMode(false);
        const prod = products.find(p => p.sku === sku);
        if (!prod) { alert(`Product with barcode/SKU "${sku}" not found.`); return; }
        setForm(f => {
            const items = [...f.items];
            const existingIndex = items.findIndex(it => it.product_id === prod.id);
            if (existingIndex >= 0) {
                items[existingIndex].quantity += 1;
            } else {
                if (items.length === 1 && items[0].product_id === '') items.pop();
                items.push({ product_id: prod.id, product: prod, quantity: 1, unit_price: parseFloat(prod.unitPrice || 0) });
            }
            return { ...f, items };
        });
    };

    const subtotal = form.items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
    const taxAmt = subtotal * (parseFloat(form.tax_rate) / 100 || 0);
    const total = subtotal + taxAmt;

    const validate = () => {
        const e = {};
        if (form.items.some(it => !it.product_id || it.quantity < 1)) e.items = 'All line items must have a valid product and quantity > 0';
        const stockErrors = form.items.filter(it => it.product).filter(it => it.quantity > parseInt(it.product.quantity)).map(it => `${it.product.name}: requested ${it.quantity}, available ${it.product.quantity}`);
        if (stockErrors.length) e.stock = stockErrors.join('; ');
        return e;
    };

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setLoading(true);
        try {
            const orderNum = `SO-${Date.now()}`;
            const order = await apiPost('sales_orders', {
                orderNumber: orderNum,
                customerId: form.customer_id || null,
                status: form.payment_status,
                subtotal, taxRate: parseFloat(form.tax_rate) || 0,
                taxAmount: taxAmt, total, notes: form.notes || null,
            });

            await Promise.all([
                ...form.items.map(item =>
                    apiPost('sales_order_items', {
                        orderId: order.id,
                        productId: item.product_id,
                        quantity: parseInt(item.quantity),
                        unitPrice: item.unit_price,
                    })
                ),
                ...form.items.map(item =>
                    apiPost('transactions', {
                        productId: item.product_id,
                        type: 'out',
                        quantity: parseInt(item.quantity),
                        notes: `Sale ${orderNum}`,
                    })
                ),
                ...form.items.map(item =>
                    apiPut('products', {
                        id: item.product_id,
                        quantity: parseInt(item.product.quantity) - parseInt(item.quantity),
                    })
                ),
            ]);

            cache.invalidate('sales_orders', 'products', 'dashboard');
            setLoading(false);
            onSaved();
            onClose();
        } catch (err) {
            setErrors({ _: err.message });
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            {scanMode && <BarcodeScanner onScan={handleScan} onClose={() => setScanMode(false)} />}
            <div className="modal modal-xl">
                <div className="modal-header">
                    <h2 className="modal-title">Create New Sale</h2>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    {errors._ && <div className="alert alert-error">{errors._}</div>}
                    {errors.stock && <div className="alert alert-error"><strong>Insufficient stock:</strong><br />{errors.stock}</div>}
                    {errors.items && <div className="alert alert-warning">{errors.items}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
                        <div>
                            <div className="form-row cols-2">
                                <div className="form-group">
                                    <label className="form-label">Customer</label>
                                    <select className="form-control" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                                        <option value="">Walk-in Customer</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Payment Status</label>
                                    <select className="form-control" value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
                                        <option value="pending">Pending</option>
                                        <option value="paid">Paid</option>
                                    </select>
                                </div>
                            </div>

                            <div className="card" style={{ marginBottom: 16 }}>
                                <div className="card-header" style={{ justifyContent: 'space-between' }}>
                                    <span className="card-title">Line Items</span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setScanMode(true)} title="Scan Barcode">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><path d="M8 7v10"></path><path d="M12 7v10"></path><path d="M16 7v10"></path></svg>
                                            Scan Item
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={12} /> Add Item</button>
                                    </div>
                                </div>
                                <div className="card-body" style={{ padding: '12px 16px' }}>
                                    {form.items.map((item, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                            <select className="form-control" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                                                <option value="">Select product...</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>)}
                                            </select>
                                            <input type="number" min="1" className="form-control" value={item.quantity}
                                                onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} placeholder="Qty" />
                                            <div style={{ padding: '8px 12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                                                ${(item.quantity * item.unit_price).toFixed(2)}
                                            </div>
                                            {form.items.length > 1 && (
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeItem(i)}>
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="form-row cols-2">
                                <div className="form-group">
                                    <label className="form-label">Tax Rate (%)</label>
                                    <input type="number" min="0" max="100" step="0.1" className="form-control"
                                        value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea className="form-control" rows={2} value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
                            </div>
                        </div>

                        {/* Summary */}
                        <div>
                            <div className="summary-panel">
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 12 }}>Order Summary</div>
                                <div className="summary-row"><span>Subtotal</span><span className="amount">${subtotal.toFixed(2)}</span></div>
                                <div className="summary-row"><span>Tax ({form.tax_rate}%)</span><span className="amount">${taxAmt.toFixed(2)}</span></div>
                                <div className="summary-row total"><span>Total</span><span className="amount">${total.toFixed(2)}</span></div>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gray-400)' }}>
                                Stock will be deducted automatically when the sale is confirmed.
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : 'Confirm Sale'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── SaleDetailModal ──────────────────────────────────────────────────────────
function SaleDetailModal({ sale, onClose }) {
    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-md">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{sale.orderNumber || `Order #${sale.id.slice(0, 8)}`}</h2>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{format(new Date(sale.createdAt), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    <div className="summary-panel">
                        <div className="summary-row"><span>Customer</span><span>{sale.customerName || 'Walk-in'}</span></div>
                        <div className="summary-row"><span>Subtotal</span><span className="amount">${parseFloat(sale.subtotal || 0).toFixed(2)}</span></div>
                        <div className="summary-row"><span>Tax</span><span className="amount">${parseFloat(sale.taxAmount || 0).toFixed(2)}</span></div>
                        <div className="summary-row total"><span>Total</span><span className="amount">${parseFloat(sale.total || 0).toFixed(2)}</span></div>
                    </div>
                    {sale.notes && <div style={{ marginTop: 16, fontSize: 13, color: 'var(--gray-600)' }}><strong>Notes:</strong> {sale.notes}</div>}
                </div>
            </div>
        </div>
    );
}

// ─── Main Sales page ──────────────────────────────────────────────────────────
export default function Sales() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [viewSale, setViewSale] = useState(null);
    const [printSale, setPrintSale] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 30;
    const { isStaff, isOwner, shop } = useAuth();

    useEffect(() => { loadSales(); }, []);

    async function loadSales(force = false) {
        if (!force) {
            const cached = cache.get('sales_orders');
            if (cached) { setSales(cached); setLoading(false); return; }
        }
        setLoading(true);
        try {
            const [salesData, customersData] = await Promise.all([
                apiGet('sales_orders'),
                apiGet('customers'),
            ]);
            const customerMap = Object.fromEntries(customersData.map(c => [c.id, c.name]));
            const enriched = salesData
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(s => ({
                    ...s,
                    customerName: s.customerId ? customerMap[s.customerId] || 'Walk-in' : 'Walk-in',
                }));
            cache.set('sales_orders', enriched);
            setSales(enriched);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

    const filtered = sales.filter(s => {
        const matchSearch =
            (s.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (s.customerName || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = !statusFilter || s.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedSales = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalRevenue = sales.filter(s => s.status === 'paid').reduce((sum, s) => sum + parseFloat(s.total || 0), 0);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Sales</h1>
                    <p>{sales.length} orders · ${totalRevenue.toFixed(2)} total revenue</p>
                </div>
                <div className="page-header-actions">
                    {isStaff && <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={13} /> Create Sale</button>}
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <div className="filters-bar" style={{ margin: 0 }}>
                        <div className="search-bar" style={{ width: 220 }}>
                            <Search size={14} style={{ color: 'var(--gray-400)' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." />
                        </div>
                        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={() => loadSales(true)}><RefreshCw size={13} /></button>
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
                                    <th>Invoice ID</th>
                                    <th>Customer</th>
                                    <th>Date</th>
                                    <th>Subtotal</th>
                                    <th>Total</th>
                                    <th>Payment</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedSales.length === 0 ? (
                                    <tr><td colSpan={7}>
                                        <div className="empty-state">
                                            <ShoppingCart className="empty-state-icon" />
                                            <h3>No sales orders</h3>
                                            <p>Create your first sale to get started.</p>
                                        </div>
                                    </td></tr>
                                ) : paginatedSales.map(s => (
                                    <tr key={s.id}>
                                        <td><span className="tag">{s.orderNumber || s.id.slice(0, 8)}</span></td>
                                        <td>{s.customerName || <span style={{ color: 'var(--gray-400)' }}>Walk-in</span>}</td>
                                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{format(new Date(s.createdAt), 'MMM d, yyyy')}</td>
                                        <td className="amount">${parseFloat(s.subtotal || 0).toFixed(2)}</td>
                                        <td className="amount" style={{ fontWeight: 600 }}>${parseFloat(s.total || 0).toFixed(2)}</td>
                                        <td><span className={`status-badge ${s.status}`}><span className="status-dot" />{s.status}</span></td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewSale(s)}>
                                                    <Eye size={14} />
                                                </button>
                                                {isOwner && (
                                                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setPrintSale(s)} data-tooltip="Print Invoice">
                                                        <Printer size={14} />
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

            {showCreate && <CreateSaleModal onClose={() => setShowCreate(false)} onSaved={() => loadSales(true)} />}
            {viewSale && <SaleDetailModal sale={viewSale} onClose={() => setViewSale(null)} />}
            {printSale && <InvoiceModal sale={printSale} shop={shop} onClose={() => setPrintSale(null)} />}
        </div>
    );
}
