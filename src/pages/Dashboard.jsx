import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { cache } from '../lib/cache';
import {
    Package, TrendingUp, DollarSign, AlertTriangle,
    ShoppingCart, ArrowUpRight, RefreshCw
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfDay } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function StatCard({ label, value, icon: Icon, iconBg, iconColor, meta, to }) {
    const navigate = useNavigate();
    return (
        <div className="stat-card" onClick={() => to && navigate(to)}>
            <div className="stat-header">
                <span className="stat-label">{label}</span>
                <div className="stat-icon" style={{ background: iconBg }}>
                    <Icon size={18} style={{ color: iconColor }} />
                </div>
            </div>
            <div className="stat-value amount">{value}</div>
            {meta && <div className="stat-meta">{meta}</div>}
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow)' }}>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color }}>
                    {p.name}: <span style={{ color: 'var(--gray-800)' }}>{p.value.toLocaleString()}</span>
                </p>
            ))}
        </div>
    );
};

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalProducts: 0, lowStockCount: 0, totalValue: 0, totalTransactions: 0, salesOrders: 0, purchaseOrders: 0
    });
    const [salesData, setSalesData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [recentTx, setRecentTx] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDashboard(); }, []);

    async function fetchDashboard(force = false) {
        const CACHE_KEY = 'dashboard';
        if (!force) {
            const cached = cache.get(CACHE_KEY);
            if (cached) {
                setStats(cached.stats);
                setSalesData(cached.salesData);
                setTopProducts(cached.topProducts);
                setCategoryData(cached.categoryData);
                setRecentTx(cached.recentTx);
                setLoading(false);
                return;
            }
        }
        setLoading(true);
        try {
            const fourteenDaysAgo = startOfDay(subDays(new Date(), 13)).toISOString();

            const [products, transactions, sales, purchases] = await Promise.all([
                supabase.from('products').select('*'),
                supabase.from('transactions').select('*, products(name)').gte('created_at', fourteenDaysAgo).order('created_at', { ascending: false }),
                supabase.from('sales_orders').select('*', { count: 'exact', head: true }),
                supabase.from('purchase_orders').select('*', { count: 'exact', head: true }),
            ]);

            const prods = products.data || [];
            const txs = transactions.data || [];

            const totalValue = prods.reduce((s, p) => s + (p.unit_price * p.quantity), 0);
            const lowStock = prods.filter(p => p.is_low_stock).length;

            const newStats = {
                totalProducts: prods.length,
                lowStockCount: lowStock,
                totalValue,
                totalTransactions: txs.length,
                salesOrders: sales.count || 0,
                purchaseOrders: purchases.count || 0,
            };

            // Sales trend (last 14 days)
            const last14 = Array.from({ length: 14 }, (_, i) => {
                const d = subDays(new Date(), 13 - i);
                const key = format(d, 'yyyy-MM-dd');
                const dayTx = txs.filter(t => t.created_at?.startsWith(key));
                return {
                    date: format(d, 'MMM d'),
                    In: dayTx.filter(t => t.type === 'in').reduce((s, t) => s + t.quantity, 0),
                    Out: dayTx.filter(t => t.type === 'out').reduce((s, t) => s + t.quantity, 0),
                };
            });

            // Top products by quantity
            const sorted = [...prods].sort((a, b) => b.quantity - a.quantity).slice(0, 6);
            const newTopProducts = sorted.map(p => ({ name: p.name.slice(0, 15), qty: p.quantity }));

            // Category distribution
            const cats = {};
            prods.forEach(p => {
                const c = p.category || 'Uncategorized';
                cats[c] = (cats[c] || 0) + 1;
            });
            const newCategoryData = Object.entries(cats).map(([name, value]) => ({ name, value }));
            const newRecentTx = txs.slice(0, 8);

            const payload = { stats: newStats, salesData: last14, topProducts: newTopProducts, categoryData: newCategoryData, recentTx: newRecentTx };
            cache.set(CACHE_KEY, payload);

            setStats(newStats);
            setSalesData(last14);
            setTopProducts(newTopProducts);
            setCategoryData(newCategoryData);
            setRecentTx(newRecentTx);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }

    if (loading) return (
        <div>
            <div className="stats-grid">
                {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="stat-card">
                        <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 16 }} />
                        <div className="skeleton" style={{ height: 28, width: '40%', marginBottom: 8 }} />
                        <div className="skeleton" style={{ height: 10, width: '80%' }} />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Operations Dashboard</h1>
                    <p>Real-time overview of your inventory and operations</p>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => fetchDashboard(true)}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>
            </div>

            <div className="stats-grid">
                <StatCard label="Total Products" value={stats.totalProducts.toLocaleString()} icon={Package}
                    iconBg="var(--primary-100)" iconColor="var(--primary)" meta="Active catalog items" to="/inventory" />
                <StatCard label="Low Stock Alerts" value={stats.lowStockCount} icon={AlertTriangle}
                    iconBg="var(--warning-light)" iconColor="var(--warning)" meta="Below threshold" to="/inventory" />
                <StatCard label="Stock Value" value={`$${stats.totalValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={DollarSign} iconBg="var(--success-light)" iconColor="var(--success)" meta="Total inventory value" />
                <StatCard label="Transactions" value={stats.totalTransactions.toLocaleString()} icon={TrendingUp}
                    iconBg="var(--info-light)" iconColor="var(--info)" meta="All time movements" to="/activity" />
                <StatCard label="Sales Orders" value={stats.salesOrders} icon={ShoppingCart}
                    iconBg="#ede9fe" iconColor="#7c3aed" meta="Total orders" to="/sales" />
                <StatCard label="Purchase Orders" value={stats.purchaseOrders} icon={ArrowUpRight}
                    iconBg="#fce7f3" iconColor="#db2777" meta="Total POs" to="/purchases" />
            </div>

            <div className="charts-grid">
                {/* Sales Trend Chart */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Stock Movement Trend</div>
                            <div className="card-subtitle">Last 14 days — Items In vs Out</div>
                        </div>
                    </div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={salesData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="In" stroke="#3b82f6" strokeWidth={2} fill="url(#inGrad)" />
                                <Area type="monotone" dataKey="Out" stroke="#10b981" strokeWidth={2} fill="url(#outGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Category Pie */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">By Category</div>
                            <div className="card-subtitle">Product distribution</div>
                        </div>
                    </div>
                    <div className="card-body">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                                        paddingAngle={3} dataKey="value">
                                        {categoryData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ padding: '40px 0' }}>
                                <p>No product data yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Top Products */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Top Products by Stock</div>
                    </div>
                    <div className="card-body" style={{ padding: '12px 20px' }}>
                        {topProducts.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={topProducts} layout="vertical" margin={{ left: 0, right: 16 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--gray-600)' }} width={80} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ padding: '24px 0' }}><p>No products yet</p></div>
                        )}
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Recent Transactions</div>
                        <Link to="/activity" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>View all</Link>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Type</th>
                                    <th>Qty</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTx.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>No transactions</td></tr>
                                ) : recentTx.map(tx => (
                                    <tr key={tx.id}>
                                        <td style={{ fontWeight: 500 }}>{tx.products?.name?.slice(0, 18) || '—'}</td>
                                        <td>
                                            <span className={`status-badge ${tx.type === 'in' ? 'received' : 'pending'}`}>
                                                {tx.type === 'in' ? '↑ IN' : '↓ OUT'}
                                            </span>
                                        </td>
                                        <td className="amount">{tx.quantity}</td>
                                        <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>
                                            {format(new Date(tx.created_at), 'MMM d')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
