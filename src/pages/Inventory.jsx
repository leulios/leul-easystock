import { useEffect, useState, useCallback } from 'react';
import {
    Plus, Search, Download, Package, AlertTriangle, RefreshCw, X,
    Eye, Edit, ChevronRight, ChevronDown, Layers, FlaskConical, Printer, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { useAuth } from '../context/AuthContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import Pagination from '../components/Pagination';
import BarcodeScanner from '../components/BarcodeScanner';

const DEFAULT_CATEGORIES = ['Electronics', 'Clothing', 'Food & Beverage', 'Office Supplies', 'Hardware', 'Other'];
const CATEGORIES_KEY = 'inventory_categories';

function useCategories() {
    const [categories, setCategories] = useState(() => {
        try {
            const saved = localStorage.getItem(CATEGORIES_KEY);
            return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
        } catch { return DEFAULT_CATEGORIES; }
    });

    const saveCategories = useCallback((cats) => {
        setCategories(cats);
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
    }, []);

    const addCategory = useCallback((name) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        setCategories(prev => {
            if (prev.some(c => c.toLowerCase() === trimmed.toLowerCase())) return prev;
            const next = [...prev, trimmed].sort();
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
            return next;
        });
        return true;
    }, []);

    const removeCategory = useCallback((name) => {
        setCategories(prev => {
            const next = prev.filter(c => c !== name);
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    return { categories, addCategory, removeCategory, saveCategories };
}

/* ─── Variant Row ─────────────────────────────────────────── */
function VariantRow({ variant, onEdit }) {
    return (
        <tr style={{ background: 'var(--gray-50)' }}>
            <td style={{ paddingLeft: 40, fontSize: 12, color: 'var(--gray-600)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={11} style={{ color: 'var(--primary)' }} />
                    {variant.name}
                </div>
            </td>
            <td><span className="tag" style={{ fontSize: 11 }}>{variant.sku || '—'}</span></td>
            <td>—</td>
            <td><span style={{ fontWeight: 600, fontSize: 13 }}>{variant.quantity}</span></td>
            <td className="amount">${parseFloat(variant.unit_price || 0).toFixed(2)}</td>
            <td className="amount">${(variant.quantity * (variant.unit_price || 0)).toFixed(2)}</td>
            <td>
                {variant.quantity === 0
                    ? <span className="status-badge out-of-stock"><span className="status-dot" />Out of Stock</span>
                    : <span className="status-badge in-stock"><span className="status-dot" />In Stock</span>}
            </td>
            <td>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onEdit(variant)}>
                    <Edit size={13} />
                </button>
            </td>
        </tr>
    );
}

/* ─── Category Selector ───────────────────────────────── */
function CategorySelector({ value, onChange, categories, onAdd, onRemove }) {
    const [adding, setAdding] = useState(false);
    const [newCat, setNewCat] = useState('');

    const handleAdd = () => {
        if (!newCat.trim()) return;
        onAdd(newCat);
        onChange(newCat.trim());
        setNewCat('');
        setAdding(false);
    };

    return (
        <div>
            {!adding ? (
                <div style={{ display: 'flex', gap: 8 }}>
                    <select
                        className="form-control"
                        style={{ flex: 1 }}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                    >
                        <option value="">Select category</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        title="Add custom category"
                        onClick={() => setAdding(true)}
                    >
                        <Plus size={14} />
                    </button>
                    {value && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            title={`Delete "${value}" category`}
                            style={{ color: 'var(--danger)' }}
                            onClick={() => { onRemove(value); onChange(''); }}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        className="form-control"
                        style={{ flex: 1 }}
                        autoFocus
                        placeholder="New category name"
                        value={newCat}
                        onChange={e => setNewCat(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewCat(''); } }}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newCat.trim()}>Add</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setNewCat(''); }}>Cancel</button>
                </div>
            )}
        </div>
    );
}

/* ─── Product Modal (add/edit + variants tab) ─────────────── */
function ProductModal({ product, onClose, onSaved, categories, onAddCategory, onRemoveCategory }) {
    const { shop } = useAuth();
    const [tab, setTab] = useState('details');
    const [form, setForm] = useState(product || {
        name: '', sku: '', category: '', description: '',
        unit_price: '', quantity: 0, low_stock_threshold: 10
    });
    const [variants, setVariants] = useState([]);
    const [variantForm, setVariantForm] = useState({ name: '', sku: '', unit_price: '', quantity: 0 });
    const [editingVariant, setEditingVariant] = useState(null);
    const isNew = !product?.id;
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [scanMode, setScanMode] = useState(false);
    const [scanTarget, setScanTarget] = useState(''); // 'product' or 'variant'

    useEffect(() => {
        if (product?.id) loadVariants();
    }, [product?.id]);

    async function loadVariants() {
        const { data } = await supabase.from('product_variants').select('*').eq('product_id', product.id).order('name');
        setVariants(data || []);
    }

    const validate = () => {
        const e = {};
        if (!form.name) e.name = 'Product name is required';
        if (form.unit_price === '' || isNaN(form.unit_price)) e.unit_price = 'Valid price required';
        return e;
    };

    const handleSave = async () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setLoading(true);
        const payload = {
            name: form.name, sku: form.sku || null, category: form.category || null,
            description: form.description || null,
            unit_price: parseFloat(form.unit_price) || 0,
            low_stock_threshold: parseInt(form.low_stock_threshold) || 10,
        };
        let err;
        if (product?.id) {
            ({ error: err } = await supabase.from('products').update(payload).eq('id', product.id));
        } else {
            ({ error: err } = await supabase.from('products').insert({ ...payload, quantity: parseInt(form.quantity) || 0, shop_id: shop?.id ?? null }));
        }
        setLoading(false);
        if (err) { setErrors({ _: err.message }); return; }
        cache.invalidate('products', 'dashboard');
        onSaved();
        onClose();
    };

    const saveVariant = async () => {
        if (!variantForm.name) return;
        setLoading(true);
        const payload = {
            product_id: product.id,
            name: variantForm.name,
            sku: variantForm.sku || null,
            unit_price: parseFloat(variantForm.unit_price) || null,
            quantity: parseInt(variantForm.quantity) || 0,
            shop_id: shop?.id ?? null,
        };
        if (editingVariant) {
            await supabase.from('product_variants').update(payload).eq('id', editingVariant.id);
        } else {
            await supabase.from('product_variants').insert(payload);
        }
        setVariantForm({ name: '', sku: '', unit_price: '', quantity: 0 });
        setEditingVariant(null);
        setLoading(false);
        loadVariants();
    };

    const startEditVariant = (v) => {
        setEditingVariant(v);
        setVariantForm({ name: v.name, sku: v.sku || '', unit_price: v.unit_price || '', quantity: v.quantity });
    };

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
    const vf = (k, v) => setVariantForm(p => ({ ...p, [k]: v }));

    const handleScan = (sku) => {
        if (scanTarget === 'product') f('sku', sku);
        if (scanTarget === 'variant') vf('sku', sku);
        setScanMode(false);
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            {scanMode && <BarcodeScanner onScan={handleScan} onClose={() => setScanMode(false)} />}
            <div className="modal modal-md">
                <div className="modal-header">
                    <h2 className="modal-title">{product ? 'Edit Product' : 'Add New Product'}</h2>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>

                {!isNew && (
                    <div className="tabs" style={{ padding: '0 20px', borderBottom: '1px solid var(--gray-100)' }}>
                        {[{ key: 'details', label: 'Details' }, { key: 'variants', label: `Variants (${variants.length})` }].map(t => (
                            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
                        ))}
                    </div>
                )}

                <div className="modal-body">
                    {tab === 'details' && (
                        <>
                            {errors._ && <div className="alert alert-error">{errors._}</div>}
                            <div className="form-row cols-2">
                                <div className="form-group">
                                    <label className="form-label required">Product Name</label>
                                    <input className={`form-control ${errors.name ? 'error' : ''}`} value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Office Chair" />
                                    {errors.name && <div className="form-error">{errors.name}</div>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SKU / Barcode</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input className="form-control" value={form.sku || ''} onChange={e => f('sku', e.target.value)} placeholder="e.g. 123456789" />
                                        <button type="button" className="btn btn-secondary btn-icon" onClick={() => { setScanTarget('product'); setScanMode(true); }} title="Scan Barcode">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><path d="M8 7v10"></path><path d="M12 7v10"></path><path d="M16 7v10"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="form-row cols-2">
                                <div className="form-group">
                                    <label className="form-label required">Selling Price (Br)</label>
                                    <input type="number" min="0" step="0.01" className={`form-control ${errors.unit_price ? 'error' : ''}`}
                                        value={form.unit_price} onChange={e => f('unit_price', e.target.value)} placeholder="0.00" />
                                    {errors.unit_price && <div className="form-error">{errors.unit_price}</div>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <CategorySelector
                                        value={form.category || ''}
                                        onChange={val => f('category', val)}
                                        categories={categories}
                                        onAdd={onAddCategory}
                                        onRemove={onRemoveCategory}
                                    />
                                </div>
                            </div>
                            <div className="form-row cols-2">
                                {isNew && (
                                    <div className="form-group">
                                        <label className="form-label">Initial Quantity</label>
                                        <input type="number" min="0" className="form-control" value={form.quantity}
                                            onChange={e => f('quantity', e.target.value)} placeholder="0" />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Low Stock Threshold</label>
                                    <input type="number" min="0" className="form-control" value={form.low_stock_threshold}
                                        onChange={e => f('low_stock_threshold', e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-control" rows={2} value={form.description || ''}
                                    onChange={e => f('description', e.target.value)} placeholder="Optional product description" />
                            </div>
                        </>
                    )}

                    {tab === 'variants' && (
                        <>
                            <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid var(--gray-200)' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 10 }}>
                                    {editingVariant ? `Editing: ${editingVariant.name}` : 'Add New Variant'}
                                </div>
                                <div className="form-row cols-2">
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Variant Name</label>
                                        <input className="form-control" value={variantForm.name} onChange={e => vf('name', e.target.value)} placeholder="e.g. Small, Red, 250ml" />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">SKU / Barcode</label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input className="form-control" value={variantForm.sku} onChange={e => vf('sku', e.target.value)} placeholder="e.g. 123456789" />
                                            <button type="button" className="btn btn-secondary btn-icon" onClick={() => { setScanTarget('variant'); setScanMode(true); }} title="Scan Barcode">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><path d="M8 7v10"></path><path d="M12 7v10"></path><path d="M16 7v10"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="form-row cols-2" style={{ marginTop: 8 }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Price Override (Br)</label>
                                        <input type="number" min="0" step="0.01" className="form-control" value={variantForm.unit_price} onChange={e => vf('unit_price', e.target.value)} placeholder="Leave blank = product price" />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Quantity</label>
                                        <input type="number" min="0" className="form-control" value={variantForm.quantity} onChange={e => vf('quantity', e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <button className="btn btn-primary btn-sm" onClick={saveVariant} disabled={loading || !variantForm.name}>
                                        {editingVariant ? 'Update Variant' : 'Add Variant'}
                                    </button>
                                    {editingVariant && (
                                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingVariant(null); setVariantForm({ name: '', sku: '', unit_price: '', quantity: 0 }); }}>Cancel</button>
                                    )}
                                </div>
                            </div>

                            {variants.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)', fontSize: 13 }}>
                                    <Layers size={28} style={{ marginBottom: 8, opacity: 0.4 }} /><br />
                                    No variants yet. Add one above.
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="table">
                                        <thead><tr><th>Variant</th><th>SKU</th><th>Price</th><th>Stock</th><th></th></tr></thead>
                                        <tbody>
                                            {variants.map(v => (
                                                <tr key={v.id}>
                                                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                                                    <td><span className="tag">{v.sku || '—'}</span></td>
                                                    <td className="amount">Br {parseFloat(v.unit_price || 0).toFixed(2)}</td>
                                                    <td style={{ fontWeight: 600 }}>{v.quantity}</td>
                                                    <td>
                                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startEditVariant(v)}><Edit size={13} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {tab === 'details' && (
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Saving...' : (product ? 'Update Product' : 'Add Product')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Stock Ledger + Lots Modal ───────────────────────────── */
function StockLedgerModal({ product, onClose }) {
    const [ledger, setLedger] = useState([]);
    const [lots, setLots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('ledger');

    useEffect(() => {
        async function load() {
            const [{ data: txns }, { data: lotData }] = await Promise.all([
                supabase.from('transactions').select('*, profiles(full_name)').eq('product_id', product.id).order('created_at', { ascending: false }),
                supabase.from('stock_lots').select('*').eq('product_id', product.id).order('expiry_date', { ascending: true }),
            ]);
            setLedger(txns || []);
            setLots(lotData || []);
            setLoading(false);
        }
        load();
    }, [product.id]);

    const getLotStatus = (lot) => {
        if (!lot.expiry_date) return 'ok';
        const days = differenceInDays(parseISO(lot.expiry_date), new Date());
        if (days < 0) return 'expired';
        if (days <= 30) return 'expiring';
        return 'ok';
    };

    const ledgerWithBalance = (() => {
        let balance = product.quantity;
        return [...ledger].reverse().map(tx => { const row = { ...tx, balance_after: balance }; return row; }).reverse();
    })();

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-xl">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{product.name}</h2>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            SKU: {product.sku || 'N/A'} · Current Stock: <strong>{product.quantity}</strong>
                            {lots.some(l => getLotStatus(l) !== 'ok') && (
                                <span style={{ marginLeft: 8, color: 'var(--warning)', fontSize: 11 }}>⚠ Expiry Warning</span>
                            )}
                        </p>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    <div className="tabs">
                        {[{ key: 'ledger', label: 'Stock Ledger' }, { key: 'lots', label: `Lots & Expiry (${lots.length})` }, { key: 'overview', label: 'Overview' }].map(t => (
                            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
                        ))}
                    </div>

                    {tab === 'overview' && (
                        <div className="form-row cols-3">
                            {[
                                { label: 'Current Stock', value: product.quantity },
                                { label: 'Selling Price', value: `Br ${parseFloat(product.unit_price).toFixed(2)}` },
                                { label: 'Stock Value', value: `Br ${(product.quantity * product.unit_price).toFixed(2)}` },
                                { label: 'Category', value: product.category || '—' },
                                { label: 'Low Stock At', value: product.low_stock_threshold },
                                { label: 'Status', value: product.is_low_stock ? '⚠ Low Stock' : '✓ Normal' },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>{value}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'lots' && (
                        loading ? <div className="spinner" style={{ margin: '32px auto' }} /> : (
                            lots.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)' }}>
                                    <FlaskConical size={32} style={{ marginBottom: 8, opacity: 0.4 }} /><br />
                                    No lots recorded for this product.<br />
                                    <span style={{ fontSize: 12 }}>Add lot numbers when receiving stock via Purchases.</span>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Lot #</th>
                                                <th>Received</th>
                                                <th>Expiry Date</th>
                                                <th>Days Left</th>
                                                <th>Qty Remaining</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lots.map(lot => {
                                                const status = getLotStatus(lot);
                                                const daysLeft = lot.expiry_date ? differenceInDays(parseISO(lot.expiry_date), new Date()) : null;
                                                return (
                                                    <tr key={lot.id} style={{ background: status === 'expired' ? '#fff1f2' : status === 'expiring' ? '#fffbeb' : 'white' }}>
                                                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{lot.lot_number}</td>
                                                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{lot.received_date ? format(parseISO(lot.received_date), 'MMM d, yyyy') : '—'}</td>
                                                        <td style={{ fontSize: 12 }}>{lot.expiry_date ? format(parseISO(lot.expiry_date), 'MMM d, yyyy') : <span style={{ color: 'var(--gray-400)' }}>No expiry</span>}</td>
                                                        <td>
                                                            {daysLeft !== null ? (
                                                                <span style={{ fontWeight: 600, color: daysLeft < 0 ? 'var(--danger)' : daysLeft <= 30 ? 'var(--warning)' : 'var(--success)' }}>
                                                                    {daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`}
                                                                </span>
                                                            ) : '—'}
                                                        </td>
                                                        <td style={{ fontWeight: 600 }}>{lot.quantity}</td>
                                                        <td>
                                                            {status === 'expired' && <span className="status-badge out-of-stock"><span className="status-dot" />Expired</span>}
                                                            {status === 'expiring' && <span className="status-badge low-stock"><span className="status-dot" />Expiring Soon</span>}
                                                            {status === 'ok' && <span className="status-badge in-stock"><span className="status-dot" />Good</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )
                    )}

                    {tab === 'ledger' && (
                        loading ? <div className="spinner" style={{ margin: '32px auto' }} /> : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Date</th><th>Type</th><th>Qty In</th><th>Qty Out</th><th>Balance After</th><th>Notes</th><th>Performed By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ledgerWithBalance.length === 0 ? (
                                            <tr><td colSpan={7} className="empty-state">No stock movements recorded</td></tr>
                                        ) : ledgerWithBalance.map(tx => (
                                            <tr key={tx.id}>
                                                <td style={{ fontSize: 12 }}>{format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}</td>
                                                <td><span className={`status-badge ${tx.type === 'in' ? 'received' : 'pending'}`}>{tx.type === 'in' ? 'STOCK IN' : 'STOCK OUT'}</span></td>
                                                <td className="amount">{tx.type === 'in' ? <strong style={{ color: 'var(--success)' }}>+{tx.quantity}</strong> : '—'}</td>
                                                <td className="amount">{tx.type === 'out' ? <strong style={{ color: 'var(--danger)' }}>-{tx.quantity}</strong> : '—'}</td>
                                                <td className="amount" style={{ fontWeight: 600 }}>{tx.balance_after}</td>
                                                <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{tx.notes || '—'}</td>
                                                <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{tx.profiles?.full_name || 'System'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Main Inventory Page ─────────────────────────────────── */
export default function Inventory() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('');
    const [stockFilter, setStockFilter] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [viewProduct, setViewProduct] = useState(null);
    const [expanded, setExpanded] = useState({});
    const [variantMap, setVariantMap] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [scanMode, setScanMode] = useState(false);
    const ITEMS_PER_PAGE = 30;
    const { isStaff } = useAuth();
    const { categories, addCategory, removeCategory } = useCategories();

    useEffect(() => { fetchProducts(); }, []);

    async function fetchProducts(force = false) {
        if (!force) {
            const cached = cache.get('products');
            if (cached) { setProducts(cached); setLoading(false); return; }
        }
        setLoading(true);
        const { data } = await supabase.from('products').select('*').order('name');
        const result = data || [];
        cache.set('products', result);
        setProducts(result);
        setLoading(false);
    }

    // Reset page on search or filter
    useEffect(() => { setCurrentPage(1); }, [search, catFilter, stockFilter]);

    async function loadVariants(productId) {
        const { data } = await supabase.from('product_variants').select('*').eq('product_id', productId).order('name');
        setVariantMap(m => ({ ...m, [productId]: data || [] }));
    }

    const toggleExpand = async (productId) => {
        const isOpen = !!expanded[productId];
        if (!isOpen && !variantMap[productId]) await loadVariants(productId);
        setExpanded(e => ({ ...e, [productId]: !isOpen }));
    };

    const filtered = products.filter(p => {
        const query = search.toLowerCase();
        const matchSearch = (p.name || '').toLowerCase().includes(query) ||
            (p.sku || '').toLowerCase().includes(query) ||
            (p.description || '').toLowerCase().includes(query);
        const matchCat = !catFilter || p.category === catFilter;
        const matchStock = !stockFilter || (stockFilter === 'out' ? p.quantity === 0 : p.is_low_stock);
        return matchSearch && matchCat && matchStock;
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedProducts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const getStockStatus = (p) => {
        if (p.quantity === 0) return 'out-of-stock';
        if (p.is_low_stock) return 'low-stock';
        return 'in-stock';
    };

    const exportCSV = () => {
        const rows = [['Product', 'SKU', 'Category', 'Stock', 'Price', 'Status']];
        filtered.forEach(p => rows.push([p.name, p.sku || '', p.category || '', p.quantity, p.unit_price, getStockStatus(p)]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'inventory.csv'; a.click();
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Inventory</h1>
                    <p>{products.length} products · {products.filter(p => p.is_low_stock).length} low stock alerts</p>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={13} /> Export CSV</button>
                    {isStaff && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}><Plus size={13} /> Add Product</button>}
                </div>
            </div>

            {scanMode && (
                <BarcodeScanner
                    onScan={(code) => {
                        setSearch(code);
                        setScanMode(false);
                    }}
                    onClose={() => setScanMode(false)}
                />
            )}

            <div className="card">
                <div className="card-header">
                    <div className="filters-bar" style={{ margin: 0 }}>
                        <div className="search-bar" style={{ width: 260, display: 'flex', alignItems: 'center' }}>
                            <Search size={14} style={{ color: 'var(--gray-400)' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, barcode..." style={{ flex: 1 }} />
                            <button className="icon-btn" style={{ padding: 4 }} onClick={() => setScanMode(true)} title="Scan Barcode to Search">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><path d="M8 7v10"></path><path d="M12 7v10"></path><path d="M16 7v10"></path></svg>
                            </button>
                        </div>
                        <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="filter-select" value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
                            <option value="">All Stock</option>
                            <option value="low">Low Stock</option>
                            <option value="normal">Normal Stock</option>
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={() => fetchProducts(true)}><RefreshCw size={13} /> Refresh</button>
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
                                    <th style={{ width: 24 }}></th>
                                    <th>Product Name</th>
                                    <th>SKU</th>
                                    <th>Category</th>
                                    <th>Current Stock</th>
                                    <th>Selling Price</th>
                                    <th>Stock Value</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.length === 0 ? (
                                    <tr><td colSpan={9}>
                                        <div className="empty-state">
                                            <Package className="empty-state-icon" />
                                            <h3>No products found</h3>
                                            <p>Add your first product to start tracking inventory.</p>
                                        </div>
                                    </td></tr>
                                ) : paginatedProducts.map(p => {
                                    const status = getStockStatus(p);
                                    const isOpen = !!expanded[p.id];
                                    return (
                                        <>
                                            <tr key={p.id}>
                                                <td>
                                                    <button onClick={() => toggleExpand(p.id)}
                                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', padding: 2 }}>
                                                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{p.name}</div>
                                                    {p.description && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.description.slice(0, 40)}</div>}
                                                </td>
                                                <td><span className="tag">{p.sku || '—'}</span></td>
                                                <td>{p.category || '—'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontWeight: 600 }}>{p.quantity}</span>
                                                        {p.is_low_stock && <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />}
                                                    </div>
                                                </td>
                                                <td className="amount">Br {parseFloat(p.unit_price).toFixed(2)}</td>
                                                <td className="amount">Br {(p.quantity * p.unit_price).toFixed(2)}</td>
                                                <td>
                                                    <span className={`status-badge ${status}`}>
                                                        <span className="status-dot" />
                                                        {status === 'out-of-stock' ? 'Out of Stock' : status === 'low-stock' ? 'Low Stock' : 'In Stock'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="table-actions">
                                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewProduct(p)} data-tooltip="View Details">
                                                            <Eye size={14} />
                                                        </button>
                                                        {isStaff && (
                                                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditProduct(p)} data-tooltip="Edit">
                                                                <Edit size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isOpen && (variantMap[p.id] || []).map(v => (
                                                <VariantRow key={v.id} variant={v} onEdit={() => setEditProduct(p)} />
                                            ))}
                                            {isOpen && (variantMap[p.id] || []).length === 0 && (
                                                <tr style={{ background: 'var(--gray-50)' }}>
                                                    <td colSpan={9} style={{ paddingLeft: 40, fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>
                                                        No variants — edit the product to add some.
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={ITEMS_PER_PAGE} />}
            </div>

            {showAdd && <ProductModal onClose={() => setShowAdd(false)} onSaved={() => fetchProducts(true)} categories={categories} onAddCategory={addCategory} onRemoveCategory={removeCategory} />}
            {editProduct && <ProductModal product={editProduct} onClose={() => setEditProduct(null)} onSaved={() => fetchProducts(true)} categories={categories} onAddCategory={addCategory} onRemoveCategory={removeCategory} />}
            {viewProduct && <StockLedgerModal product={viewProduct} onClose={() => setViewProduct(null)} />}
        </div>
    );
}
