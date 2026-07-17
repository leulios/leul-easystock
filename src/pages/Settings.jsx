import { useState } from 'react';
import { Settings as SettingsIcon, Building2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { profile } = useAuth();

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Settings</h1>
                    <p>System configuration · Admin only</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Business Info */}
                <div className="card">
                    <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Building2 size={16} style={{ color: 'var(--primary)' }} />
                            <div className="card-title">Business Information</div>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label className="form-label">Business Name</label>
                            <input className="form-control" placeholder="Your Business Name" defaultValue="EasyStock Business" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Business Address</label>
                            <textarea className="form-control" rows={3} placeholder="123 Business Street" />
                        </div>
                        <div className="form-row cols-2">
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-control" placeholder="+1 234 567 890" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-control" placeholder="info@business.com" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Default Tax Rate (%)</label>
                            <input type="number" min="0" max="100" step="0.1" className="form-control" defaultValue="0" />
                        </div>
                        <button className="btn btn-primary btn-sm">Save Business Info</button>
                    </div>
                </div>

                {/* Account Info */}
                <div className="card">
                    <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <SettingsIcon size={16} style={{ color: 'var(--primary)' }} />
                            <div className="card-title">Account Settings</div>
                        </div>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', background: 'var(--gray-50)', borderRadius: 8, marginBottom: 20 }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1e40af)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700 }}>
                                {(profile?.full_name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{profile?.full_name || 'Administrator'}</div>
                                <span className={`role-badge ${profile?.role}`}>{profile?.role}</span>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="form-control" defaultValue={profile?.full_name || ''} />
                        </div>
                        <div className="divider" />
                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input type="password" className="form-control" placeholder="Leave blank to keep current" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm New Password</label>
                            <input type="password" className="form-control" placeholder="Re-enter new password" />
                        </div>
                        <button className="btn btn-secondary btn-sm">Update Password</button>
                    </div>
                </div>

                {/* System Info */}
                <div className="card">
                    <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Info size={16} style={{ color: 'var(--gray-500)' }} />
                            <div className="card-title">System Information</div>
                        </div>
                    </div>
                    <div className="card-body">
                        {[
                            { label: 'Application', value: 'EasyStock v1.0.0' },
                            { label: 'Backend', value: 'Supabase (PostgreSQL 17)' },
                            { label: 'Region', value: 'EU Central (eu-central-1)' },
                            { label: 'Plan', value: profile?.plan || 'free' },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                                <span style={{ color: 'var(--gray-500)' }}>{label}</span>
                                <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Low Stock Config */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Inventory Alerts</div>
                    </div>
                    <div className="card-body">
                        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
                            Each product has its own low stock threshold configured in the Inventory module.
                        </p>
                        <div className="alert alert-info">
                            <Info size={14} />
                            Low stock alerts are automatically calculated per product based on its configured threshold. Navigate to <strong>Inventory → Edit Product</strong> to adjust individual thresholds.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
