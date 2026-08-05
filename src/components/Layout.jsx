import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Package, ShoppingCart, Truck, Building2,
    BarChart3, Users, Settings, ScrollText, ChevronLeft,
    ChevronRight, Bell, Search, LogOut, ChevronDown, X, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ownerOnly = hidden from shopkeeper
// adminOnly = hidden from non-owner (same effect, kept for clarity)
const navSections = [
    {
        label: 'Operations',
        items: [
            { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, ownerOnly: true },
            { to: '/inventory', icon: Package, label: 'Inventory', ownerOnly: true },
            { to: '/sales', icon: ShoppingCart, label: 'Sales' },
            { to: '/invoices', icon: FileText, label: 'Invoices', ownerOnly: true },
            { to: '/purchases', icon: Truck, label: 'Purchases', ownerOnly: true },
            { to: '/suppliers', icon: Building2, label: 'Suppliers', ownerOnly: true },
        ]
    },
    {
        label: 'Analytics',
        items: [
            { to: '/reports', icon: BarChart3, label: 'Reports', ownerOnly: true },
            { to: '/activity', icon: ScrollText, label: 'Activity Log', ownerOnly: true },
        ]
    },
    {
        label: 'Administration',
        items: [
            { to: '/users', icon: Users, label: 'Users', ownerOnly: true },
            { to: '/settings', icon: Settings, label: 'Settings', ownerOnly: true },
        ]
    },
];

const pageTitles = {
    '/': 'Dashboard',
    '/inventory': 'Inventory',
    '/sales': 'Sales',
    '/invoices': 'Invoices',
    '/purchases': 'Purchases',
    '/suppliers': 'Suppliers',
    '/reports': 'Reports',
    '/activity': 'Activity Log',
    '/users': 'Users & Roles',
    '/settings': 'Settings',
};

export default function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const { profile, signOut, isAdmin, isOwner } = useAuth();
    const location = useLocation();
    const menuRef = useRef(null);

    const pageTitle = pageTitles[location.pathname] || 'EasyStock';

    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const initials = profile?.fullName
        ? profile.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">E</div>
                    {!collapsed && (
                        <span className="sidebar-logo-text">Easy<span>Stock</span></span>
                    )}
                </div>

                <nav className="sidebar-nav">
                    {navSections.map(section => (
                        <div key={section.label}>
                            <div className="sidebar-section-label">{section.label}</div>
                            {section.items.map(item => {
                                if (item.ownerOnly && !isOwner) return null;
                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        end={item.end}
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                        data-tooltip={collapsed ? item.label : undefined}
                                    >
                                        <item.icon className="nav-icon" />
                                        <span className="nav-label">{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
                        {collapsed
                            ? <ChevronRight size={16} />
                            : <><ChevronLeft size={16} /><span>Collapse</span></>
                        }
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className="main-area">
                {/* Header */}
                <header className="header">
                    <div className="header-title">{pageTitle}</div>

                    <div className="search-bar">
                        <Search size={14} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                        <input type="text" placeholder="Search..." />
                    </div>

                    <div className="header-actions">
                        <button className="icon-btn" data-tooltip="Notifications">
                            <Bell size={18} />
                            <span className="badge">3</span>
                        </button>

                        <div className="dropdown" ref={menuRef}>
                            <button className="user-menu" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                                <div className="user-avatar">{initials}</div>
                                <div className="user-info">
                                    <div className="user-name">{profile?.fullName || 'User'}</div>
                                    <span className={`role-badge ${profile?.role || 'viewer'}`}>
                                        {profile?.role || 'viewer'}
                                    </span>
                                </div>
                                <ChevronDown size={14} style={{ color: 'var(--gray-400)' }} />
                            </button>

                            {userMenuOpen && (
                                <div className="dropdown-menu">
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>
                                            {profile?.fullName}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                                            {profile?.role}
                                        </div>
                                    </div>
                                    <button className="dropdown-item danger" onClick={signOut}>
                                        <LogOut size={14} />
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="page-content">
                    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><div className="spinner" /></div>}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
}
