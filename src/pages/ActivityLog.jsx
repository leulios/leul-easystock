import { useEffect, useState } from 'react';
import { Search, RefreshCw, ScrollText, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import Pagination from '../components/Pagination';

const ACTION_TYPES = ['all', 'in', 'out'];
const TYPE_LABELS = { in: '📥 Stock In', out: '📤 Stock Out' };

export default function ActivityLog() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 30;

    useEffect(() => { fetch(); }, []);

    async function fetch() {
        setLoading(true);
        const { data } = await supabase
            .from('transactions')
            .select('*, products(name), profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(500);
        setTransactions(data || []);
        setLoading(false);
    }

    const filtered = transactions.filter(t => {
        const matchSearch = (t.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.notes || '').toLowerCase().includes(search.toLowerCase());
        const matchType = !typeFilter || t.type === typeFilter;
        const matchFrom = !dateFrom || t.created_at >= dateFrom;
        const matchTo = !dateTo || t.created_at <= dateTo + 'T23:59:59';
        return matchSearch && matchType && matchFrom && matchTo;
    });

    // Reset page on search or filter
    useEffect(() => { setCurrentPage(1); }, [search, typeFilter, dateFrom, dateTo]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedTransactions = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Activity Log</h1>
                    <p>Complete audit trail of all stock movements · Read-only</p>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={fetch}><RefreshCw size={13} /> Refresh</button>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <div className="filters-bar" style={{ margin: 0 }}>
                        <div className="search-bar" style={{ width: 220 }}>
                            <Search size={14} style={{ color: 'var(--gray-400)' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, notes..." />
                        </div>
                        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="">All Types</option>
                            <option value="in">Stock In</option>
                            <option value="out">Stock Out</option>
                        </select>
                        <input type="date" className="filter-select" style={{ appearance: 'auto', paddingRight: 8 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
                        <input type="date" className="filter-select" style={{ appearance: 'auto', paddingRight: 8 }} value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
                        {(search || typeFilter || dateFrom || dateTo) && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); }}>
                                Clear filters
                            </button>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{filtered.length} records</div>
                </div>

                {loading ? (
                    <div style={{ padding: 24 }}>
                        {Array(8).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, marginBottom: 8 }} />)}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Type</th>
                                    <th>Product</th>
                                    <th>Quantity</th>
                                    <th>Notes / Reference</th>
                                    <th>Performed By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTransactions.length === 0 ? (
                                    <tr><td colSpan={6}>
                                        <div className="empty-state">
                                            <ScrollText className="empty-state-icon" />
                                            <h3>No activity records</h3>
                                            <p>All stock movements will appear here.</p>
                                        </div>
                                    </td></tr>
                                ) : paginatedTransactions.map(tx => (
                                    <tr key={tx.id}>
                                        <td style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                                            {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${tx.type === 'in' ? 'received' : 'pending'}`}>
                                                <span className="status-dot" />
                                                {tx.type === 'in' ? 'STOCK IN' : 'STOCK OUT'}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{tx.products?.name || '—'}</td>
                                        <td>
                                            <span className="amount" style={{ fontWeight: 700, color: tx.type === 'in' ? 'var(--success)' : 'var(--danger)', fontSize: 14 }}>
                                                {tx.type === 'in' ? '+' : '-'}{tx.quantity}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{tx.notes || '—'}</td>
                                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{tx.profiles?.full_name || 'System'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} />}
            </div>
        </div>
    );
}
