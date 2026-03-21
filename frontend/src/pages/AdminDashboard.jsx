import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Store, Users, ShoppingBag, TrendingUp, LogOut,
    ToggleLeft, ToggleRight, RefreshCw, ShieldCheck
} from 'lucide-react';
import { getAdminStats, getAdminShops, toggleShop } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('overview');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, shopsRes] = await Promise.all([
                getAdminStats(), getAdminShops(),
            ]);
            setStats(statsRes.data);
            setShops(shopsRes.data);
        } catch { toast.error('Failed to load admin data'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleToggle = async (shopId, name, isActive) => {
        try {
            await toggleShop(shopId);
            toast.success(`${name} ${isActive ? 'deactivated' : 'activated'}`);
            fetchData();
        } catch { toast.error('Failed to toggle'); }
    };

    const handleLogout = () => { logout(); navigate('/login'); };

    const STAT_CARDS = stats ? [
        { label: 'Total Shops',    value: stats.totalShops,    sub: `${stats.activeShops} active`,          icon: '🏪', color: 'border-blue-500/30 bg-blue-500/10',    text: 'text-blue-400'   },
        { label: 'Total Users',    value: stats.totalUsers,    sub: 'registered accounts',                  icon: '👥', color: 'border-purple-500/30 bg-purple-500/10', text: 'text-purple-400' },
        { label: 'Total Orders',   value: stats.totalOrders,   sub: 'all time',                             icon: '🛎️', color: 'border-orange-500/30 bg-orange-500/10', text: 'text-orange-400' },
        { label: 'Platform Revenue', value: `₹${stats.totalRevenue}`, sub: `Commission: ₹${stats.commission}`, icon: '💰', color: 'border-green-500/30 bg-green-500/10',  text: 'text-green-400'  },
    ] : [];

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold text-white">Super Admin</h1>
                        <p className="text-xs text-slate-400">SmartServe Platform</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchData} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 font-bold text-sm transition">
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 pt-5">
                {[
                    { key: 'overview', label: '📊 Overview' },
                    { key: 'shops',    label: '🏪 Shops'    },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${tab === t.key ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="p-6">
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* ── Overview Tab ── */}
                {!loading && tab === 'overview' && (
                    <div className="space-y-6">
                        {/* Stat cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {STAT_CARDS.map(s => (
                                <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className={`rounded-2xl border p-5 ${s.color}`}>
                                    <div className="text-3xl mb-2">{s.icon}</div>
                                    <p className={`text-2xl font-extrabold ${s.text}`}>{s.value}</p>
                                    <p className="text-white font-bold text-sm mt-1">{s.label}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{s.sub}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Commission info */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="font-extrabold text-white mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-green-400" /> Commission Summary
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Platform Revenue',  value: `₹${stats?.totalRevenue || 0}`, color: 'text-white' },
                                    { label: 'Commission Rate',   value: '10%',                           color: 'text-purple-400' },
                                    { label: 'Commission Earned', value: `₹${stats?.commission || 0}`,   color: 'text-green-400' },
                                ].map(c => (
                                    <div key={c.label} className="bg-slate-800 rounded-xl p-4 text-center">
                                        <p className={`text-xl font-extrabold ${c.color}`}>{c.value}</p>
                                        <p className="text-slate-400 text-xs mt-1">{c.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top shops preview */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="font-extrabold text-white mb-4">Top Shops by Revenue</h3>
                            <div className="space-y-3">
                                {[...shops].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((shop, i) => (
                                    <div key={shop._id} className="flex items-center gap-4">
                                        <span className="text-slate-600 font-black w-5 text-center">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white truncate">{shop.name}</p>
                                            <p className="text-xs text-slate-500">{shop.category} • {shop.orderCount} orders</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-green-400 font-extrabold">₹{shop.revenue}</p>
                                            <p className="text-slate-500 text-xs">₹{shop.commission} commission</p>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${shop.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                                    </div>
                                ))}
                                {shops.length === 0 && <p className="text-slate-500 text-sm">No shops registered yet.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Shops Tab ── */}
                {!loading && tab === 'shops' && (
                    <div className="space-y-3">
                        <p className="text-slate-400 text-sm mb-4">Manage all registered shops. Toggle active/inactive to control platform access.</p>
                        {shops.length === 0 && (
                            <div className="text-center py-20">
                                <Store className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500">No shops registered yet.</p>
                            </div>
                        )}
                        {shops.map(shop => (
                            <motion.div key={shop._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-extrabold text-white">{shop.name}</h3>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${shop.isActive ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
                                                {shop.isActive ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400">{shop.category} • Owner: {shop.ownerId?.name || 'N/A'}</p>
                                        <p className="text-xs text-slate-500 font-mono mt-0.5">{shop.ownerId?.email}</p>
                                        <div className="flex gap-4 mt-3">
                                            <div>
                                                <p className="text-green-400 font-extrabold text-base">₹{shop.revenue}</p>
                                                <p className="text-slate-500 text-[10px]">Revenue</p>
                                            </div>
                                            <div>
                                                <p className="text-purple-400 font-extrabold text-base">₹{shop.commission}</p>
                                                <p className="text-slate-500 text-[10px]">Commission</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-400 font-extrabold text-base">{shop.orderCount}</p>
                                                <p className="text-slate-500 text-[10px]">Orders</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-300 font-extrabold text-base">{shop.tables?.length || 0}</p>
                                                <p className="text-slate-500 text-[10px]">Tables</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleToggle(shop._id, shop.name, shop.isActive)}
                                        className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition border ${shop.isActive
                                            ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                            : 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>
                                        {shop.isActive
                                            ? <><ToggleRight className="w-4 h-4" /> Deactivate</>
                                            : <><ToggleLeft className="w-4 h-4" /> Activate</>}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
