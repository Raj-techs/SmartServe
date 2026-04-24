import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Utensils, CreditCard, CheckCircle2, Bell, RefreshCw, BellRing, ClipboardCheck } from 'lucide-react';
import { getShopOrders, updateItemStatus, markOrderPaid, verifyOrder, rejectOrder } from '../services/api';
import { getSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

export default function WaiterPanel() {
    const { shopId } = useParams();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending');
    const [cashRequests, setCashRequests] = useState([]);
    const [pendingOrders, setPendingOrders] = useState([]); // orders awaiting waiter verification

    const fetchOrders = useCallback(async () => {
        try {
            const { data } = await getShopOrders(shopId);
            setOrders(data);
            // Extract orders that have at least one pending_waiter item
            const pending = data.filter(o =>
                o.status === 'active' && (o.items || []).some(i => i.status === 'pending_waiter')
            );
            setPendingOrders(pending);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [shopId]);

    useEffect(() => {
        fetchOrders();
        const socket = getSocket();
        socket.emit('join_shop', shopId);
        socket.on('new_order', () => { fetchOrders(); toast('🛎️ New order arrived!', { icon: '🔔' }); });
        socket.on('order_pending_waiter', ({ tableNumber, order }) => {
            fetchOrders();
            toast(`🔔 New order from Table ${tableNumber} — verify needed!`, { icon: '🛎️', duration: 5000 });
            setTab('pending');
        });
        socket.on('order_updated', () => fetchOrders());
        socket.on('payment_done', () => fetchOrders());
        // Cash payment request from customer
        socket.on('cash_payment_request', (req) => {
            setCashRequests(prev => {
                // avoid duplicates
                if (prev.find(r => r.orderId === req.orderId)) return prev;
                return [...prev, req];
            });
            toast('💵 Cash collection requested!', { icon: '🛎️' });
            setTab('cash');
        });
        const poll = setInterval(fetchOrders, 12000);
        return () => {
            socket.off('new_order');
            socket.off('order_pending_waiter');
            socket.off('order_updated');
            socket.off('payment_done');
            socket.off('cash_payment_request');
            clearInterval(poll);
        };
    }, [shopId, fetchOrders]);

    const handleVerifyOrder = async (order) => {
        try {
            await verifyOrder(order._id);
            // Notify customer → order goes to kitchen
            const pendingItems = (order.items || []).filter(i => i.status === 'pending_waiter');
            const username = pendingItems[0]?.username || null;
            getSocket().emit('order_accepted_by_waiter', {
                shopId, tableNumber: order.tableNumber, orderId: order._id, username,
            });
            toast.success(`✅ Order verified for Table ${order.tableNumber}!`);
            fetchOrders();
        } catch { toast.error('Failed to verify order'); }
    };

    const handleRejectOrder = async (order) => {
        try {
            await rejectOrder(order._id);
            const pendingItems = (order.items || []).filter(i => i.status === 'pending_waiter');
            const username = pendingItems[0]?.username || null;
            getSocket().emit('order_rejected_by_waiter', {
                shopId, tableNumber: order.tableNumber, orderId: order._id, username,
            });
            toast(`❌ Order cancelled for Table ${order.tableNumber}`, { icon: '🚫' });
            fetchOrders();
        } catch { toast.error('Failed to reject order'); }
    };

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

    const handleCashCollected = async (req) => {
        try {
            // Mark order as paid in DB
            await markOrderPaid(req.orderId, 'cash');
            // Notify customer socket → triggers success screen
            getSocket().emit('cash_collected', {
                customerSocketId: req.customerSocketId,
                shopId,
                tableNumber: req.tableNumber,
                orderId: req.orderId,
                username: req.username, // pass username for per-user filter
            });
            setCashRequests(prev => prev.filter(r => r.orderId !== req.orderId));
            toast.success(`Cash collected from ${req.username} ✅`);
            fetchOrders();
        } catch { toast.error('Failed to mark cash collected'); }
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
                            <p className="text-xs text-slate-400">{pendingOrders.length} to verify • {readyItems.length} to serve • {pendingPayment.length} awaiting payment</p>
                        </div>
                    </div>
                    <button onClick={fetchOrders} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                {/* Tabs */}
                <div className="flex gap-2 mt-4">
                    {[
                        { key: 'pending', label: '🔔 Verify Orders', count: pendingOrders.length },
                        { key: 'serve',   label: '🍽️ Serve Food',    count: readyItems.length },
                        { key: 'cash',    label: '💵 Cash',           count: cashRequests.length },
                        { key: 'payment', label: '💳 Payment',        count: pendingPayment.length },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t.label}
                            {t.count > 0 && <span className={`text-white text-xs px-1.5 py-0.5 rounded-full ${t.key === 'pending' ? 'bg-red-500' : 'bg-orange-500'}`}>{t.count}</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 space-y-3">
                {loading && <p className="text-center text-slate-500 py-10">Loading...</p>}

                {/* ── Pending Orders Tab (Verify / Cancel) ── */}
                {tab === 'pending' && !loading && (
                    <>
                        {pendingOrders.length === 0 && (
                            <div className="text-center py-20">
                                <ClipboardCheck className="w-14 h-14 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium text-lg">No orders pending</p>
                                <p className="text-slate-600 text-sm mt-1">New customer orders will appear here for verification</p>
                            </div>
                        )}
                        {pendingOrders.map(order => {
                            const pendingItems = (order.items || []).filter(i => i.status === 'pending_waiter');
                            const customer = pendingItems[0]?.username || 'Customer';
                            const total = pendingItems.reduce((a, i) => a + ((i.productId?.price || 0) * i.quantity), 0);
                            return (
                                <motion.div key={order._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-slate-900 border-2 border-orange-500/50 rounded-2xl p-5 mb-3">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-xs text-orange-400 font-black uppercase tracking-wider mb-0.5">🔔 New Order — Verify Required</p>
                                            <p className="font-extrabold text-white text-lg">Table {order.tableNumber}</p>
                                            <p className="text-slate-400 text-xs">{customer}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-extrabold text-orange-400">₹{total}</p>
                                            <p className="text-[10px] text-slate-500">{pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    {/* Items list */}
                                    <div className="bg-slate-800/60 rounded-xl p-3 mb-4 space-y-2">
                                        {pendingItems.map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                {item.productId?.image
                                                    ? <img src={item.productId.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
                                                    : <div className="w-10 h-10 rounded-lg bg-slate-700 border border-slate-600 shrink-0 flex items-center justify-center text-base">🍽️</div>
                                                }
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-white text-sm truncate">{item.productId?.name || 'Item'}</p>
                                                    <p className="text-xs text-slate-400">×{item.quantity} {item.orderType === 'parcel' ? '📦 Parcel' : '🍽️ Dine-In'} • ₹{(item.productId?.price || 0) * item.quantity}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Action buttons */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => handleRejectOrder(order)}
                                            className="py-3.5 rounded-xl font-bold border-2 border-red-500/30 text-red-400 hover:bg-red-500/10 transition text-sm active:scale-95">
                                            ❌ Cancel Order
                                        </button>
                                        <button onClick={() => handleVerifyOrder(order)}
                                            className="py-3.5 rounded-xl font-bold bg-green-500 hover:bg-green-400 text-white transition text-sm shadow-lg shadow-green-500/20 active:scale-95">
                                            ✅ Verify & Accept
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </>
                )}

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

                {/* Cash Collection Tab */}
                {tab === 'cash' && !loading && (
                    <>
                        {cashRequests.length === 0 && (
                            <div className="text-center py-20">
                                <div className="text-6xl mb-3">💵</div>
                                <p className="text-slate-500 font-medium text-lg">No cash requests</p>
                                <p className="text-slate-600 text-sm mt-1">Waiting for customers to request cash payment</p>
                            </div>
                        )}
                        {cashRequests.map((req, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900 border-2 border-orange-500/50 rounded-2xl p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center text-2xl">💵</div>
                                    <div>
                                        <p className="font-extrabold text-white text-lg">{req.username}</p>
                                        <p className="text-xs text-slate-400">Table {req.tableNumber} • Cash Payment Request</p>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <p className="text-2xl font-extrabold text-orange-400">₹{req.amount}</p>
                                        <p className="text-[10px] text-slate-500">Collect this amount</p>
                                    </div>
                                </div>
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4 text-center">
                                    <p className="text-orange-300 text-xs font-semibold">Go to Table {req.tableNumber} and collect ₹{req.amount} from {req.username}</p>
                                </div>
                                <button onClick={() => handleCashCollected(req)}
                                    className="w-full bg-orange-500 hover:bg-orange-400 text-white font-extrabold py-4 rounded-2xl text-base transition active:scale-95 shadow-lg shadow-orange-500/20">
                                    ✅ Cash Collected from {req.username}
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
