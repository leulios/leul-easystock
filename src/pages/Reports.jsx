import { useEffect, useState } from 'react';
import { Download, RefreshCw, BarChart3, TrendingUp, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, parseISO } from 'date-fns';

function ReportCard({ title, icon: Icon, iconColor, children }) {
    return (
        <div className="card">
            <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${iconColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={16} style={{ color: iconColor }} />
                    </div>
                    <div className="card-title">{title}</div>
                </div>
            </div>
            <div className="card-body">{children}</div>
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow)', fontSize: 12 }}>
            <p style={{ color: 'var(--gray-500)', marginBottom: 6 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ fontWeight: 600, color: p.color }}>{p.name}: <span style={{ color: 'var(--gray-800)' }}>${typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span></p>
            ))}
        </div>
    );
};

// ── Preset ranges ──────────────────────────────────────────────
const today = () => new Date();
const PRESETS = [
    { label: 'Last 7 Days',  from: () => subDays(today(), 6),               to: () => today() },
    { label: 'Last 30 Days', from: () => subDays(today(), 29),              to: () => today() },
    { label: 'This Month',   from: () => startOfMonth(today()),             to: () => endOfMonth(today()) },
    { label: 'Last Month',   from: () => startOfMonth(subMonths(today(),1)),to: () => endOfMonth(subMonths(today(),1)) },
    { label: 'This Year',    from: () => startOfYear(today()),              to: () => endOfYear(today()) },
    { label: 'Last Year',    from: () => startOfYear(subYears(today(),1)),  to: () => endOfYear(subYears(today(),1)) },
];

const inRange = (dateStr, from, to) => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    return d >= from && d <= to;
};

export default function Reports() {
    const [activeReport, setActiveReport] = useState('stock');
    const [products, setProducts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [sales, setSales] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [activePreset, setActivePreset] = useState('Last 30 Days');

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true);
        const [p, t, s, po] = await Promise.all([
            supabase.from('products').select('*').order('name'),
            supabase.from('transactions').select('*, products(name)').order('created_at', { ascending: false }),
            supabase.from('sales_orders').select('*').order('created_at', { ascending: false }),
            supabase.from('purchase_orders').select('*, products(name), suppliers(name)').order('created_at', { ascending: false }),
        ]);
        setProducts(p.data || []);
        setTransactions(t.data || []);
        setSales(s.data || []);
        setPurchases(po.data || []);
        setLoading(false);
    }

    const applyPreset = (preset) => {
        setActivePreset(preset.label);
        setDateFrom(format(preset.from(), 'yyyy-MM-dd'));
        setDateTo(format(preset.to(), 'yyyy-MM-dd'));
    };

    // Filtered subsets for date-sensitive reports
    const filteredSales = sales.filter(s => inRange(s.created_at, dateFrom, dateTo));
    const filteredPurchases = purchases.filter(p => inRange(p.created_at, dateFrom, dateTo));

    // Summary stats (always all-time for top cards)
    const totalStockValue = products.reduce((s, p) => s + (p.unit_price * p.quantity), 0);
    const totalSalesRevenue = sales.filter(s => s.status === 'paid').reduce((s, o) => s + (o.total || 0), 0);
    const totalPurchaseCost = purchases.filter(p => p.status === 'received').reduce((s, p) => s + (p.total_cost || 0), 0);
    const grossProfit = totalSalesRevenue - totalPurchaseCost;

    // P&L filtered by date
    const pnlSalesRevenue = filteredSales.filter(s => s.status === 'paid').reduce((s, o) => s + (o.total || 0), 0);
    const pnlPurchaseCost = filteredPurchases.filter(p => p.status === 'received').reduce((s, p) => s + (p.total_cost || 0), 0);
    const pnlGrossProfit = pnlSalesRevenue - pnlPurchaseCost;

    // Movement chart: generate one bar per day in the selected range (capped at 60 days)
    const movementData = (() => {
        const from = parseISO(dateFrom);
        const to = parseISO(dateTo);
        const diffDays = Math.round((to - from) / 86400000) + 1;
        const days = Math.min(diffDays, 60);
        const startDay = diffDays > 60 ? subDays(to, 59) : from;
        return Array.from({ length: days }, (_, i) => {
            const d = new Date(startDay);
            d.setDate(d.getDate() + i);
            const key = format(d, 'yyyy-MM-dd');
            const dayTx = transactions.filter(t => t.created_at?.startsWith(key));
            return {
                date: format(d, 'MMM d'),
                'Stock In': dayTx.filter(t => t.type === 'in').reduce((s, t) => s + t.quantity, 0),
                'Stock Out': dayTx.filter(t => t.type === 'out').reduce((s, t) => s + t.quantity, 0),
            };
        });
    })();

    const exportData = (data, filename) => {
        if (!data.length) return;
        const keys = Object.keys(data[0]);
        const rows = [keys, ...data.map(row => keys.map(k => row[k] ?? ''))];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${filename}.csv`; a.click();
    };

    const tabs = [
        { key: 'stock', label: 'Stock Valuation' },
        { key: 'sales', label: 'Sales Report' },
        { key: 'purchases', label: 'Purchase Report' },
        { key: 'pnl', label: 'Profit & Loss' },
        { key: 'movement', label: 'Inventory Movement' },
    ];

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Reports</h1>
                    <p>All reports are read-only and reflect live data</p>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={fetchAll}><RefreshCw size={13} /> Refresh</button>
                </div>
            </div>

            {/* ── Date Filter Bar ── */}
            <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginRight: 4 }}>Period:</span>
                    {PRESETS.map(p => (
                        <button
                            key={p.label}
                            onClick={() => applyPreset(p)}
                            className={`btn btn-sm ${activePreset === p.label ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ fontSize: 12 }}
                        >
                            {p.label}
                        </button>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>From</span>
                        <input
                            type="date"
                            className="form-control"
                            style={{ width: 140, fontSize: 12, padding: '5px 8px' }}
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }}
                        />
                        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>To</span>
                        <input
                            type="date"
                            className="form-control"
                            style={{ width: 140, fontSize: 12, padding: '5px 8px' }}
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setActivePreset(''); }}
                        />
                    </div>
                    {activePreset && (
                        <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 4 }}>
                            {format(parseISO(dateFrom), 'MMM d, yyyy')} – {format(parseISO(dateTo), 'MMM d, yyyy')}
                        </span>
                    )}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
                {[
                    { label: 'Total Stock Value', value: `$${totalStockValue.toFixed(2)}`, sub: 'Live snapshot', color: 'var(--primary)' },
                    { label: 'Sales Revenue', value: `$${totalSalesRevenue.toFixed(2)}`, sub: 'All-time paid', color: 'var(--success)' },
                    { label: 'Purchase Cost', value: `$${totalPurchaseCost.toFixed(2)}`, sub: 'All-time received', color: 'var(--warning)' },
                    { label: 'Gross Profit', value: `$${grossProfit.toFixed(2)}`, sub: 'All-time', color: grossProfit >= 0 ? 'var(--success)' : 'var(--danger)' },
                ].map(({ label, value, sub, color }) => (
                    <div key={label} className="stat-card">
                        <div className="stat-label">{label}</div>
                        <div className="stat-value amount" style={{ color, fontSize: 20 }}>{value}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2 }}>{sub}</div>
                    </div>
                ))}
            </div>

            <div className="tabs">
                {tabs.map(t => <button key={t.key} className={`tab ${activeReport === t.key ? 'active' : ''}`} onClick={() => setActiveReport(t.key)}>{t.label}</button>)}
            </div>

            {loading ? <div className="spinner" style={{ margin: '48px auto' }} /> : (
                <>
                    {activeReport === 'stock' && (
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">Stock Valuation Report <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--gray-400)' }}>(live — not date-filtered)</span></div>
                                <button className="btn btn-secondary btn-sm" onClick={() => exportData(products.map(p => ({ Name: p.name, SKU: p.sku, Category: p.category, Quantity: p.quantity, 'Unit Price': p.unit_price, 'Total Value': (p.quantity * p.unit_price).toFixed(2) })), 'stock-valuation')}>
                                    <Download size={13} /> Export CSV
                                </button>
                            </div>
                            <div className="table-container">
                                <table className="table">
                                    <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Quantity</th><th>Unit Price</th><th>Total Value</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {products.map(p => (
                                            <tr key={p.id}>
                                                <td style={{ fontWeight: 500 }}>{p.name}</td>
                                                <td><span className="tag">{p.sku || '—'}</span></td>
                                                <td>{p.category || '—'}</td>
                                                <td>{p.quantity}</td>
                                                <td className="amount">${parseFloat(p.unit_price).toFixed(2)}</td>
                                                <td className="amount" style={{ fontWeight: 600 }}>${(p.quantity * p.unit_price).toFixed(2)}</td>
                                                <td><span className={`status-badge ${p.is_low_stock ? 'low-stock' : 'in-stock'}`}><span className="status-dot" />{p.is_low_stock ? 'Low Stock' : 'Normal'}</span></td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td colSpan={5} style={{ fontWeight: 700, textAlign: 'right', padding: '16px' }}>Total Inventory Value</td>
                                            <td className="amount" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 15 }}>${totalStockValue.toFixed(2)}</td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeReport === 'sales' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Sales Report</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{filteredSales.length} orders · {format(parseISO(dateFrom), 'MMM d, yyyy')} – {format(parseISO(dateTo), 'MMM d, yyyy')}</div>
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={() => exportData(filteredSales.map(s => ({ 'Order #': s.order_number, Status: s.status, Subtotal: s.subtotal, Tax: s.tax_amount, Total: s.total, Date: format(new Date(s.created_at), 'yyyy-MM-dd') })), 'sales-report')}>
                                    <Download size={13} /> Export CSV
                                </button>
                            </div>
                            <div className="table-container">
                                <table className="table">
                                    <thead><tr><th>Order #</th><th>Date</th><th>Subtotal</th><th>Tax</th><th>Total</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {filteredSales.length === 0 ? (
                                            <tr><td colSpan={6} className="empty-state">No sales in this period</td></tr>
                                        ) : filteredSales.map(s => (
                                            <tr key={s.id}>
                                                <td><span className="tag">{s.order_number || s.id.slice(0, 8)}</span></td>
                                                <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{format(new Date(s.created_at), 'MMM d, yyyy')}</td>
                                                <td className="amount">${parseFloat(s.subtotal || 0).toFixed(2)}</td>
                                                <td className="amount">${parseFloat(s.tax_amount || 0).toFixed(2)}</td>
                                                <td className="amount" style={{ fontWeight: 600 }}>${parseFloat(s.total || 0).toFixed(2)}</td>
                                                <td><span className={`status-badge ${s.status}`}>{s.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeReport === 'purchases' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Purchase Report</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{filteredPurchases.length} orders · {format(parseISO(dateFrom), 'MMM d, yyyy')} – {format(parseISO(dateTo), 'MMM d, yyyy')}</div>
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={() => exportData(filteredPurchases.map(p => ({ 'PO #': p.order_number, Supplier: p.suppliers?.name, Product: p.products?.name, Quantity: p.quantity, 'Unit Cost': p.unit_cost, Total: p.total_cost, Status: p.status })), 'purchases-report')}>
                                    <Download size={13} /> Export CSV
                                </button>
                            </div>
                            <div className="table-container">
                                <table className="table">
                                    <thead><tr><th>PO #</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {filteredPurchases.length === 0 ? (
                                            <tr><td colSpan={7} className="empty-state">No purchases in this period</td></tr>
                                        ) : filteredPurchases.map(p => (
                                            <tr key={p.id}>
                                                <td><span className="tag">{p.order_number || p.id.slice(0, 8)}</span></td>
                                                <td>{p.suppliers?.name || '—'}</td>
                                                <td style={{ fontWeight: 500 }}>{p.products?.name || '—'}</td>
                                                <td>{p.quantity}</td>
                                                <td className="amount">${parseFloat(p.unit_cost || 0).toFixed(2)}</td>
                                                <td className="amount" style={{ fontWeight: 600 }}>${parseFloat(p.total_cost || 0).toFixed(2)}</td>
                                                <td><span className={`status-badge ${p.status}`}>{p.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeReport === 'pnl' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Profit & Loss Statement</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{format(parseISO(dateFrom), 'MMM d, yyyy')} – {format(parseISO(dateTo), 'MMM d, yyyy')}</div>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Read-only · Based on completed transactions</div>
                            </div>
                            <div className="card-body">
                                <div style={{ maxWidth: 480 }}>
                                    {[
                                        { label: 'Gross Sales Revenue', value: pnlSalesRevenue, highlight: true },
                                        { label: 'Cost of Goods (Purchases)', value: -pnlPurchaseCost },
                                        { label: 'Gross Profit', value: pnlGrossProfit, total: true },
                                    ].map(row => (
                                        <div key={row.label} style={{
                                            display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
                                            background: row.total ? 'var(--primary-50)' : row.highlight ? 'var(--gray-50)' : 'white',
                                            borderRadius: row.total ? 8 : 0,
                                            border: row.total ? '1px solid var(--primary-100)' : 'none',
                                            borderBottom: !row.total ? '1px solid var(--gray-100)' : 'none',
                                        }}>
                                            <span style={{ fontWeight: row.total ? 700 : 400, color: 'var(--gray-700)' }}>{row.label}</span>
                                            <span style={{
                                                fontWeight: 700, fontFamily: 'monospace',
                                                color: row.value >= 0 ? 'var(--success)' : 'var(--danger)',
                                                fontSize: row.total ? 18 : 14
                                            }}>
                                                {row.value < 0 ? `-$${Math.abs(row.value).toFixed(2)}` : `$${row.value.toFixed(2)}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: 16, fontSize: 11, color: 'var(--gray-400)' }}>
                                    Values reflect paid sales and received purchase orders within the selected period.
                                </div>
                            </div>
                        </div>
                    )}

                    {activeReport === 'movement' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">Inventory Movement</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{format(parseISO(dateFrom), 'MMM d, yyyy')} – {format(parseISO(dateTo), 'MMM d, yyyy')} · up to 60 days shown</div>
                                </div>
                            </div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={movementData} margin={{ left: -20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="Stock In" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Stock Out" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
