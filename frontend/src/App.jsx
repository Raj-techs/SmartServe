import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ShopDashboard from './pages/ShopDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TokenEntryPage from './pages/TokenEntryPage';
import MenuPage from './pages/MenuPage';
import OrderStatusPage from './pages/OrderStatusPage';
import KitchenPanel from './pages/KitchenPanel';
import WaiterPanel from './pages/WaiterPanel';

function PrivateRoute({ children, role }) {
    const { user, loading } = useAuth();
    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
    if (!user) return <Navigate to="/login" replace />;
    if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
    return children;
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Customer — no auth needed */}
            <Route path="/scan/:shopId/:tableNumber" element={<TokenEntryPage />} />
            <Route path="/menu/:shopId/:tableNumber" element={<MenuPage />} />
            <Route path="/order-status/:shopId/:tableNumber" element={<OrderStatusPage />} />

            {/* Owner */}
            <Route path="/dashboard" element={<PrivateRoute><ShopDashboard /></PrivateRoute>} />

            {/* Kitchen */}
            <Route path="/kitchen/:shopId" element={<PrivateRoute><KitchenPanel /></PrivateRoute>} />

            {/* Waiter */}
            <Route path="/waiter/:shopId" element={<PrivateRoute><WaiterPanel /></PrivateRoute>} />

            {/* Super Admin */}
            <Route path="/admin" element={<PrivateRoute role="superadmin"><AdminDashboard /></PrivateRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Toaster
                    position="top-center"
                    toastOptions={{
                        style: { borderRadius: '12px', fontWeight: 600, fontSize: '14px' },
                        success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
                    }}
                />
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
