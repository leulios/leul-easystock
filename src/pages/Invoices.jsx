import { useEffect, useState } from 'react';
import { FileText, Search, RefreshCw, Printer, X, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { printInvoice } from '../lib/printInvoice';

/* ─── Invoice Modal ───────────────────────────────────────── */
function InvoiceModal({ sale, shop, onClose }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadItems(); }, [sale.id]);

    async function loadItems() {
        const { data } = await supabase
            .from('sales_order_items')
            .select('*, products(name, sku)')
            .eq('order_id', sale.id);
        setItems(data || []);
        setLoading(false);
    }

    const subtotal = parseFloat(sale.subtotal || 0);
    const taxAmt = parseFloat(sale.tax_amount || 0);
    const total = parseFloat(sale.total || 0);
    const taxRate = parseFloat(sale.tax_rate || 0);

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 1000 }}>
            <div className="modal" style={{ maxWidth: 720, width: '95vw', margin: '20px auto' }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Invoice — {sale.order_number || sale.id.slice(0, 8)}</h2>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            {sale.customers?.name || 'Walk-in Customer'} · {format(new Date(sale.created_at), 'MMMM d, yyyy')}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn btn-primary btn-sm"
                            disabled={loading}
                            onClick={() => printInvoice(sale, shop, items)}
                        >
                            <Printer size={13} /> Print / Save PDF
                        </button>
                        <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                    </div>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="spinner" style={{ margin: '40px auto' }} />
                    ) : (
                        <>
                            {/* Quick summary inside the modal (screen only) */}
                            <div className="form-row cols-3" style={{ marginBottom: 20 }}>
                                {[
                                    { label: 'Subtotal', value: `Br ${subtotal.toFixed(2)}` },
                                    { label: `Tax (${taxRate}%)`, value: `Br ${taxAmt.toFixed(2)}` },
                                    { label: 'Total', value: `Br ${total.toFixed(2)}` },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--gray-200)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>{value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Line items preview */}
                            <div className="table-container" style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th style={{ textAlign: 'center' }}>Qty</th>
                                            <th style={{ textAlign: 'right' }}>Unit Price</th>
                                            <th style={{ textAlign: 'right' }}>Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length > 0 ? items.map((item, i) => (
                                            <tr key={item.id || i}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{item.products?.name || 'Item'}</div>
                                                    {item.products?.sku && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>SKU: {item.products.sku}</div>}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                                <td className="amount">Br {parseFloat(item.unit_price || 0).toFixed(2)}</td>
                                                <td className="amount" style={{ fontWeight: 700 }}>Br {(item.quantity * parseFloat(item.unit_price || 0)).toFixed(2)}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-400)', fontStyle: 'italic', fontSize: 12 }}>
                                                    No line item detail recorded for this order.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                                <span className={`status-badge ${sale.status}`}>
                                    <span className="status-dot" />{sale.status}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Invoices Page ───────────────────────────────────────── */
export default function Invoices() {
    const { shop } = useAuth();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [printSale, setPrintSale] = useState(null);

    useEffect(() => { fetchSales(); }, []);

    async function fetchSales() {
        setLoading(true);
        const { data } = await supabase
            .from('sales_orders')
            .select('*, customers(name, phone)')
            .order('created_at', { ascending: false });
        setSales(data || []);
        setLoading(false);
    }

    const filtered = sales.filter(s => {
        const q = search.toLowerCase();
        const matchSearch = (s.order_number || '').toLowerCase().includes(q) || (s.customers?.name || '').toLowerCase().includes(q);
        const matchStatus = !statusFilter || s.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalInvoiced = sales.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.total || 0), 0);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Invoices</h1>
                    <p>{sales.length} invoices · Br {totalInvoiced.toFixed(2)} collected</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
                {[
                    { label: 'Total Invoices', value: sales.length, color: 'var(--primary)' },
                    { label: 'Paid', value: sales.filter(s => s.status === 'paid').length, color: 'var(--success)' },
                    { label: 'Pending', value: sales.filter(s => s.status === 'pending').length, color: 'var(--warning)' },
                    { label: 'Revenue Collected', value: `Br ${totalInvoiced.toFixed(2)}`, color: 'var(--primary)' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="stat-card">
                        <div className="stat-card-label">{label}</div>
                        <div className="stat-card-value" style={{ color }}>{value}</div>
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="card-header">
                    <div className="filters-bar" style={{ margin: 0 }}>
                        <div className="search-bar" style={{ width: 240 }}>
                            <Search size={14} style={{ color: 'var(--gray-400)' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice # or customer..." />
                        </div>
                        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={fetchSales}><RefreshCw size={13} /></button>
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
                                    <th>Invoice #</th>
                                    <th>Customer</th>
                                    <th>Date</th>
                                    <th>Subtotal</th>
                                    <th>Tax</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={8}>
                                        <div className="empty-state">
                                            <ShoppingCart className="empty-state-icon" />
                                            <h3>No invoices found</h3>
                                            <p>Invoices are created automatically from sales orders.</p>
                                        </div>
                                    </td></tr>
                                ) : filtered.map(s => (
                                    <tr key={s.id}>
                                        <td><span className="tag">{s.order_number || s.id.slice(0, 8)}</span></td>
                                        <td style={{ fontWeight: 600 }}>{s.customers?.name || <span style={{ color: 'var(--gray-400)' }}>Walk-in</span>}</td>
                                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{format(new Date(s.created_at), 'MMM d, yyyy')}</td>
                                        <td className="amount">Br {parseFloat(s.subtotal || 0).toFixed(2)}</td>
                                        <td className="amount">Br {parseFloat(s.tax_amount || 0).toFixed(2)}</td>
                                        <td className="amount" style={{ fontWeight: 700 }}>Br {parseFloat(s.total || 0).toFixed(2)}</td>
                                        <td><span className={`status-badge ${s.status}`}><span className="status-dot" />{s.status}</span></td>
                                        <td>
                                            <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                                                <button className="btn btn-primary btn-sm btn-icon" onClick={() => setPrintSale(s)} data-tooltip="Print Invoice">
                                                    <Printer size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {printSale && <InvoiceModal sale={printSale} shop={shop} onClose={() => setPrintSale(null)} />}
        </div>
    );
}
