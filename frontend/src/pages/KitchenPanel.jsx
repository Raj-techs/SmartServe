import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, CheckCircle2, Clock, ChefHat, RefreshCw } from 'lucide-react';
import { getShopOrders, updateItemStatus } from '../services/api';
import { getSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

const STATUS_NEXT = { received: 'preparing', preparing: 'ready', ready: 'served' };
const STATUS_LABEL = { received: 'Accept', preparing: 'Mark Ready', ready: 'Mark Served' };
const STATUS_COLOR = {
    received:  'bg-orange-100 text-orange-700 border-orange-200',
    preparing: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    ready:     'bg-blue-100 text-blue-600 border-blue-200',
    served:    'bg-green-100 text-green-700 border-green-200',
};

export default function KitchenDashboard() {
    const { shopId } = useParams();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | received | preparing | ready

    const fetchOrders = useCallback(async () => {
        try {
            const { data } = await getShopOrders(shopId);
            setOrders(data);
        } catch { toast.error('Refresh failed'); }
        finally { setLoading(false); }
    }, [shopId]);

    useEffect(() => {
        fetchOrders();
        const socket = getSocket();
        socket.emit('join_shop', shopId);
        socket.on('new_order', () => { fetchOrders(); toast('🛎️ New order!', { icon: '🔔' }); });
        socket.on('order_updated', () => fetchOrders());
        const poll = setInterval(fetchOrders, 15000);
        return () => { socket.off('new_order'); socket.off('order_updated'); clearInterval(poll); };
    }, [shopId, fetchOrders]);

    const handleStatusUpdate = async (orderId, itemId, currentStatus) => {
        const next = STATUS_NEXT[currentStatus];
        if (!next) return;
        try {
            await updateItemStatus(orderId, itemId, next);
            getSocket().emit('order_status_update', {
                shopId, tableNumber: orders.find(o => o._id === orderId)?.tableNumber,
                orderId, status: next,
            });
            fetchOrders();
            toast.success(`Marked as ${next}!`);
        } catch { toast.error('Update failed'); }
    };

    // Flatten all items with their parent order info
    const allItems = orders.flatMap(order =>
        (order.items || []).map(item => ({
            ...item, orderId: order._id, tableNumber: order.tableNumber,
        }))
    ).filter(item => item.status !== 'served');

    const filtered = filter === 'all' ? allItems : allItems.filter(i => i.status === filter);

    // Group by category
    const grouped = filtered.reduce((acc, item) => {
        const cat = item.productId?.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    const counts = {
        received: allItems.filter(i => i.status === 'received').length,
        preparing: allItems.filter(i => i.status === 'preparing').length,
        ready: allItems.filter(i => i.status === 'ready').length,
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-5 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <Flame className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold text-white">Kitchen Display</h1>
                        <p className="text-xs text-slate-400">{allItems.length} pending items</p>
                    </div>
                </div>
                <button onClick={fetchOrders} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 p-4">
                {[
                    { key: 'received', label: 'New', icon: '🛎️', color: 'border-orange-500/40 bg-orange-500/10' },
                    { key: 'preparing', label: 'Cooking', icon: '🔥', color: 'border-yellow-500/40 bg-yellow-500/10' },
                    { key: 'ready', label: 'Ready', icon: '✅', color: 'border-blue-500/40 bg-blue-500/10' },
                ].map(s => (
                    <button key={s.key} onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
                        className={`rounded-2xl border-2 p-3 text-center transition ${s.color} ${filter === s.key ? 'ring-2 ring-white/20' : ''}`}>
                        <div className="text-2xl font-extrabold text-white">{counts[s.key]}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{s.icon} {s.label}</div>
                    </button>
                ))}
            </div>

            {/* Orders */}
            <div className="p-4 space-y-6">
                {loading && <div className="text-center text-slate-500 py-10">Loading orders...</div>}
                {!loading && allItems.length === 0 && (
                    <div className="text-center py-20">
                        <ChefHat className="w-14 h-14 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium text-lg">All caught up! 🎉</p>
                        <p className="text-slate-600 text-sm mt-1">No pending orders right now.</p>
                    </div>
                )}
                {Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{category}</h2>
                        <div className="space-y-3">
                        {items.map((item, idx) => (
                                <motion.div key={`${item.orderId}-${item._id}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                                    {/* Product image */}
                                    <div className={`w-3 h-full min-h-[3rem] rounded-full shrink-0 ${item.status === 'received' ? 'bg-orange-500' : item.status === 'preparing' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                                    {item.productId?.image
                                        ? <img src={item.productId.image} alt={item.productId.name} className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-700" />
                                        : <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-2xl">🍽️</div>
                                    }
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                            <p className="font-bold text-white">{item.productId?.name || 'Item'}</p>
                                            {item.orderType === 'parcel' && (
                                                <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">📦 Parcel</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400">Table {item.tableNumber} • ×{item.quantity} • {item.username}</p>
                                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border mt-1.5 ${STATUS_COLOR[item.status]}`}>
                                            {item.status.toUpperCase()}
                                        </span>
                                    </div>
                                    {item.status !== 'served' && (
                                        <button onClick={() => handleStatusUpdate(item.orderId, item._id, item.status)}
                                            className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-sm transition ${item.status === 'received' ? 'bg-orange-500 hover:bg-orange-400 text-white' : item.status === 'preparing' ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900' : 'bg-blue-500 hover:bg-blue-400 text-white'}`}>
                                            {STATUS_LABEL[item.status]}
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
