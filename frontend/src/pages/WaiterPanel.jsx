import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Utensils, CreditCard, CheckCircle2, Bell, RefreshCw, BellRing } from 'lucide-react';
import { getShopOrders, updateItemStatus, markOrderPaid } from '../services/api';
import { getSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

export default function WaiterPanel() {
    const { shopId } = useParams();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('serve'); // serve | payment

    const fetchOrders = useCallback(async () => {
        try {
            const { data } = await getShopOrders(shopId);
            setOrders(data);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [shopId]);

    useEffect(() => {
        fetchOrders();
        const socket = getSocket();
        socket.emit('join_shop', shopId);
        socket.on('new_order', () => { fetchOrders(); toast('🛎️ New order arrived!', { icon: '🔔' }); });
        socket.on('order_updated', () => fetchOrders());
        socket.on('payment_done', () => fetchOrders());
        const poll = setInterval(fetchOrders, 12000);
        return () => { socket.off('new_order'); socket.off('order_updated'); socket.off('payment_done'); clearInterval(poll); };
    }, [shopId, fetchOrders]);

    const handleServe = async (orderId, itemId) => {
        try {
            await updateItemStatus(orderId, itemId, 'served');
            getSocket().emit('order_status_update', { shopId, orderId, status: 'served' });
            toast.success('Marked as served!');
            fetchOrders();
        } catch { toast.error('Failed to update'); }
    };

    const handlePayment = async (orderId, method) => {
        try {
            await markOrderPaid(orderId, method);
            getSocket().emit('payment_done', { shopId });
            toast.success(`Payment (${method}) recorded!`);
            fetchOrders();
        } catch { toast.error('Payment update failed'); }
    };

    // Items ready to serve (status = 'ready')
    const readyItems = orders.flatMap(o =>
        (o.items || [])
            .filter(i => i.status === 'ready')
            .map(i => ({ ...i, orderId: o._id, tableNumber: o.tableNumber }))
    );

    // Orders pending payment
    const pendingPayment = orders.filter(o => o.status === 'active' && o.paymentStatus === 'pending'
        && (o.items || []).every(i => i.status === 'served'));

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-5 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <Utensils className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold text-white">Waiter Panel</h1>
                            <p className="text-xs text-slate-400">{readyItems.length} to serve • {pendingPayment.length} awaiting payment</p>
                        </div>
                    </div>
                    <button onClick={fetchOrders} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                {/* Tabs */}
                <div className="flex gap-2 mt-4">
                    {[
                        { key: 'serve', label: '🍽️ Serve Food', count: readyItems.length },
                        { key: 'payment', label: '💳 Collect Payment', count: pendingPayment.length },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t.label}
                            {t.count > 0 && <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 space-y-3">
                {loading && <p className="text-center text-slate-500 py-10">Loading...</p>}

                {/* Serve Food Tab */}
                {tab === 'serve' && !loading && (
                    <>
                        {readyItems.length === 0 && (
                            <div className="text-center py-20">
                                <CheckCircle2 className="w-14 h-14 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium text-lg">All food delivered!</p>
                                <p className="text-slate-600 text-sm mt-1">Waiting for kitchen...</p>
                            </div>
                        )}
                        {readyItems.map((item, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className={`bg-slate-900 rounded-2xl p-4 flex items-center gap-4 border ${item.orderType === 'parcel' ? 'border-blue-500/40' : 'border-blue-500/30'}`}>
                                {/* Product image */}
                                {item.productId?.image
                                    ? <img src={item.productId.image} alt={item.productId.name} className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-700" />
                                    : <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                        <BellRing className="w-5 h-5 text-blue-400 animate-bounce" />
                                      </div>
                                }
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <p className="font-bold text-white">{item.productId?.name || 'Item'}</p>
                                        {item.orderType === 'parcel' && (
                                            <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">📦 Parcel</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400">Table {item.tableNumber} • ×{item.quantity} • {item.username}</p>
                                    {item.orderType === 'parcel' && (
                                        <p className="text-[10px] text-blue-400 font-semibold mt-0.5">Pack & deliver to table</p>
                                    )}
                                </div>
                                <button onClick={() => handleServe(item.orderId, item._id)}
                                    className="shrink-0 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
                                    Served ✓
                                </button>
                            </motion.div>
                        ))}
                    </>
                )}

                {/* Payment Tab */}
                {tab === 'payment' && !loading && (
                    <>
                        {pendingPayment.length === 0 && (
                            <div className="text-center py-20">
                                <CreditCard className="w-14 h-14 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium text-lg">No pending payments</p>
                            </div>
                        )}
                        {pendingPayment.map(order => (
                            <motion.div key={order._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900 border border-green-500/30 rounded-2xl p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-extrabold text-white text-lg">Table {order.tableNumber}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{(order.items || []).length} items ordered</p>
                                    </div>
                                    <p className="text-2xl font-extrabold text-green-400">₹{order.totalAmount}</p>
                                </div>
                                <div className="space-y-2 mb-4">
                                    {(order.items || []).map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            {item.productId?.image
                                                ? <img src={item.productId.image} alt={item.productId.name} className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0" />
                                                : <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-sm">🍽️</div>
                                            }
                                            <p className="text-xs text-slate-300 flex-1 truncate">
                                                {item.productId?.name} ×{item.quantity}
                                                {item.orderType === 'parcel' && <span className="ml-1 text-blue-400">📦</span>}
                                            </p>
                                            <p className="text-xs text-slate-500 shrink-0">{item.username}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => handlePayment(order._id, 'cash')}
                                        className="py-3 rounded-xl font-bold border-2 border-slate-700 text-slate-300 hover:border-green-500 hover:text-green-400 transition text-sm">
                                        💵 Cash Received
                                    </button>
                                    <button onClick={() => handlePayment(order._id, 'online')}
                                        className="py-3 rounded-xl font-bold bg-green-500 hover:bg-green-400 text-white transition text-sm">
                                        ✅ Online Done
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
