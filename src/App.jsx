import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import './styles/global.css';

// Eagerly load login/register since they are entry points
import LoginPage from './pages/LoginPage';
import CreateAccount from './pages/CreateAccount';
import UpdatePassword from './pages/UpdatePassword';

// Lazy-load all heavy pages so they only load when visited
const Dashboard   = lazy(() => import('./pages/Dashboard'));
const Inventory   = lazy(() => import('./pages/Inventory'));
const Sales       = lazy(() => import('./pages/Sales'));
const Purchases   = lazy(() => import('./pages/Purchases'));
const Suppliers   = lazy(() => import('./pages/Suppliers'));
const Reports     = lazy(() => import('./pages/Reports'));
const Users       = lazy(() => import('./pages/Users'));
const Settings    = lazy(() => import('./pages/Settings'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const Invoices    = lazy(() => import('./pages/Invoices'));

function PageLoader() {
  return (
    <div className="app-loading">
      <div className="spinner" />
    </div>
  );
}

function PrivateRoute({ children, requireOwner }) {
  const { user, loading, isOwner } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireOwner && !isOwner) return <Navigate to="/sales" replace />;
  return children;
}

// Shopkeepers land on /sales; owners/admins land on the Dashboard
function IndexRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner" /></div>;
  if (profile?.role === 'shopkeeper') return <Navigate to="/sales" replace />;
  return <Dashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner" /></div>;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!user ? <CreateAccount /> : <Navigate to="/" replace />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<IndexRoute />} />
          <Route path="inventory" element={<PrivateRoute requireOwner><Inventory /></PrivateRoute>} />
          <Route path="sales" element={<Sales />} />
          <Route path="invoices" element={<PrivateRoute requireOwner><Invoices /></PrivateRoute>} />
          <Route path="purchases" element={<PrivateRoute requireOwner><Purchases /></PrivateRoute>} />
          <Route path="suppliers" element={<PrivateRoute requireOwner><Suppliers /></PrivateRoute>} />
          <Route path="reports" element={<PrivateRoute requireOwner><Reports /></PrivateRoute>} />
          <Route path="users" element={<PrivateRoute requireOwner><Users /></PrivateRoute>} />
          <Route path="settings" element={<PrivateRoute requireOwner><Settings /></PrivateRoute>} />
          <Route path="activity" element={<PrivateRoute requireOwner><ActivityLog /></PrivateRoute>} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
