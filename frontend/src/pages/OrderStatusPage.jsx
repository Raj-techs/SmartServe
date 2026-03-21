import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CreditCard, Plus, CheckCircle2 } from 'lucide-react';
import { getShopOrders, markOrderPaid } from '../services/api';
import { getSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

// ── Floating status bar config ───────────────────────────
const PHASES = [
    { key: 'placed',    label: 'Order Placed',    color: 'bg-orange-500',  text: 'text-orange-400',  border: 'border-orange-500/40',  bg: 'bg-orange-500/10'  },
    { key: 'preparing', label: 'Being Prepared',  color: 'bg-yellow-500',  text: 'text-yellow-400',  border: 'border-yellow-500/40',  bg: 'bg-yellow-500/10'  },
    { key: 'ready',     label: 'Ready to Serve',  color: 'bg-blue-500',    text: 'text-blue-400',    border: 'border-blue-500/40',    bg: 'bg-blue-500/10'    },
    { key: 'served',    label: 'Enjoy Your Meal', color: 'bg-green-500',   text: 'text-green-400',   border: 'border-green-500/40',   bg: 'bg-green-500/10'   },
    { key: 'paid',      label: 'Payment Done ✓',  color: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
];

// Orbit food icons fallback (used only when product has no image)
const FOOD_ICONS = ['🍛', '🥘', '🍲', '🍜', '🥗', '🍱', '🥤', '🧃', '☕'];

// Small image with fallback emoji
function ItemThumb({ item, size = 'md' }) {
    const img = item.productId?.image;
    const name = item.productId?.name || 'Item';
    const sz = size === 'sm' ? 'w-10 h-10 text-lg rounded-xl' : 'w-12 h-12 text-xl rounded-2xl';
    if (img) return <img src={img} alt={name} className={`${sz} object-cover border-2 border-blue-500/60 bg-slate-800 shrink-0`} />;
    return <div className={`${sz} bg-slate-800 border-2 border-blue-500/60 flex items-center justify-center shrink-0`}><span>{FOOD_ICONS[0]}</span></div>;
}

export default function OrderStatusPage() {
    const { shopId, tableNumber } = useParams();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [phase, setPhase] = useState('placed'); // current floating bar phase
    const [confirmedReceived, setConfirmedReceived] = useState(false);
    const [session] = useState(() => JSON.parse(localStorage.getItem('customer_session') || '{}'));

    const fetchOrders = useCallback(async () => {
        try {
            const { data } = await getShopOrders(shopId);
            const mine = data.filter(o => o.tableNumber === tableNumber);
            setOrders(mine);
            // Derive phase from order state
            if (mine.every(o => o.paymentStatus === 'paid')) { setPhase('paid'); return; }
            const items = mine.flatMap(o => o.items || []);
            if (items.every(i => i.status === 'served'))    { setPhase('served'); return; }
            if (items.some(i => i.status === 'ready'))       { setPhase('ready'); return; }
            if (items.some(i => i.status === 'preparing'))   { setPhase('preparing'); return; }
            if (items.length > 0)                            { setPhase('placed'); }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [shopId, tableNumber]);

    useEffect(() => {
        fetchOrders();
        const socket = getSocket();
        socket.emit('join_table', { shopId, tableNumber });
        socket.on('order_updated', fetchOrders);
        socket.on('payment_done', fetchOrders);
        socket.on('order_status_changed', ({ phase: p }) => { setPhase(p); fetchOrders(); });
        const poll = setInterval(fetchOrders, 10000);
        return () => {
            socket.off('order_updated', fetchOrders);
            socket.off('payment_done', fetchOrders);
            socket.off('order_status_changed');
            clearInterval(poll);
        };
    }, [shopId, tableNumber, fetchOrders]);

    const allItems  = orders.flatMap(o => o.items || []);
    const myItems   = session.username ? allItems.filter(i => i.username === session.username) : allItems;
    const total     = orders.reduce((a, o) => a + (o.totalAmount || 0), 0);
    const isPaid    = orders.length > 0 && orders.every(o => o.paymentStatus === 'paid');
    const activeOrder = orders.find(o => o.status === 'active');
    const currentPhase = PHASES.find(p => p.key === phase) || PHASES[0];

    // Orbit items — show items being prepared
    const preparingItems = myItems.filter(i => ['received','preparing','ready'].includes(i.status));

    const handlePay = async (method) => {
        if (!activeOrder) return;
        setPaying(true);
        try {
            await markOrderPaid(activeOrder._id, method);
            getSocket().emit('payment_done', { shopId, tableNumber });
            toast.success('Payment successful! Thank you 🙏');
            setPhase('paid');
            fetchOrders();
        } catch { toast.error('Payment failed. Try again.'); }
        finally { setPaying(false); }
    };

    const handleOrderReceived = () => {
        setConfirmedReceived(true);
        getSocket().emit('order_received_confirm', { shopId, tableNumber });
        toast.success('Thank you for confirming!');
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-md mx-auto relative overflow-hidden pb-4">

            {/* ── Floating Status Bar ────────────────────────── */}
            {myItems.length > 0 && (
                <motion.div
                    key={phase}
                    initial={{ y: -40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`sticky top-0 z-30 mx-4 mt-4 rounded-2xl border px-4 py-3 flex items-center gap-3 ${currentPhase.bg} ${currentPhase.border}`}
                >
                    <div className={`w-2.5 h-2.5 rounded-full ${currentPhase.color} animate-pulse shrink-0`} />
                    <div className="flex-1">
                        <p className={`text-xs font-black uppercase tracking-widest ${currentPhase.text}`}>Live Status</p>
                        <p className="text-white font-bold text-sm">{currentPhase.label}</p>
                    </div>
                    {/* Mini progress dots */}
                    <div className="flex gap-1">
                        {PHASES.map((p, i) => {
                            const currentIdx = PHASES.findIndex(ph => ph.key === phase);
                            return (
                                <div key={p.key}
                                    className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${currentIdx >= i ? currentPhase.color : 'bg-slate-700'}`} />
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* ── Header ────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <button onClick={() => navigate(`/menu/${shopId}/${tableNumber}`)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition font-medium text-sm">
                    <ArrowLeft className="w-4 h-4" /> Menu
                </button>
                <div className="text-center">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Table {tableNumber}</p>
                    <p className="text-white font-extrabold">{session?.username}</p>
                </div>
                <button onClick={() => navigate(`/menu/${shopId}/${tableNumber}`)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full hover:bg-blue-500/20 transition">
                    <Plus className="w-3 h-3" /> Add More
                </button>
            </div>

            {/* ── Orbit Animation Section ───────────────────── */}
            {myItems.length > 0 && (
                <div className="flex flex-col items-center py-2">
                    <p className="text-[10px] text-blue-400 font-black tracking-widest uppercase mb-1">Live Preparation</p>
                    <p className="text-lg font-bold text-white mb-4">
                        {phase === 'placed' && 'Order confirmed...' }
                        {phase === 'preparing' && 'Chef is working... 🔥'}
                        {phase === 'ready' && 'Food is ready! 🍽️'}
                        {phase === 'served' && 'Enjoy your meal! 😊'}
                        {phase === 'paid' && 'Thank you! See you again 🙏'}
                    </p>

                    {/* Orbit */}
                    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
                        {/* Sonar rings */}
                        <div className="absolute w-28 h-28 rounded-full border border-blue-500/30"
                            style={{ animation: 'sonarPulse 4s ease-out infinite' }} />
                        <div className="absolute w-28 h-28 rounded-full border border-blue-500/20"
                            style={{ animation: 'sonarPulse 4s ease-out infinite 2s' }} />

                        {/* Dashed orbit ring — spins */}
                        <div className="absolute w-52 h-52 rounded-full border border-dashed border-white/10"
                            style={{ animation: 'spinOrbit 15s linear infinite' }}>
                            {preparingItems.slice(0, 4).map((item, i) => {
                                const positions = [
                                    { top: '-26px', left: '50%', marginLeft: '-24px' },
                                    { bottom: '-26px', left: '50%', marginLeft: '-24px' },
                                    { left: '-26px', top: '50%', marginTop: '-24px' },
                                    { right: '-26px', top: '50%', marginTop: '-24px' },
                                ];
                                const pos = positions[i] || positions[0];
                                const img = item.productId?.image;
                                return (
                                    <div key={i} className="absolute" style={pos}>
                                        <div style={{ animation: 'counterSpin 15s linear infinite' }}>
                                            <div className="w-12 h-12 bg-slate-800 border-2 border-blue-500/60 rounded-2xl overflow-hidden shadow-lg relative">
                                                {img
                                                    ? <img src={img} alt={item.productId?.name} className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center text-xl">
                                                        {FOOD_ICONS[i % FOOD_ICONS.length]}
                                                      </div>
                                                }
                                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-slate-950">
                                                    ×{item.quantity}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Centre hub */}
                        <div className="absolute w-20 h-20 rounded-full flex items-center justify-center border-4 border-slate-900 shadow-2xl z-10"
                            style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 0 40px rgba(37,99,235,0.5)' }}>
                            <span className="text-3xl">🔥</span>
                        </div>
                    </div>

                    {/* CSS Keyframes via style tag */}
                    <style>{`
                        @keyframes sonarPulse {
                            0%   { transform: scale(1); opacity: 0.7; }
                            100% { transform: scale(3.2); opacity: 0; }
                        }
                        @keyframes spinOrbit {
                            from { transform: rotate(0deg); }
                            to   { transform: rotate(360deg); }
                        }
                        @keyframes counterSpin {
                            from { transform: rotate(0deg); }
                            to   { transform: rotate(-360deg); }
                        }
                    `}</style>
                </div>
            )}

            {/* ── Horizontal step cards ─────────────────────── */}
            <div className="flex overflow-x-auto gap-4 px-5 py-3 scrollbar-hide">
                {[
                    { step: 1, color: 'text-blue-400',   label: 'STEP 1: LOGIN',   body: `Logged in as ${session?.username || 'Guest'}. PIN Verified.` },
                    { step: 2, color: 'text-orange-400', label: 'STEP 2: ORDER',   body: 'Your rotating orders are shown above. Add more from the menu anytime.' },
                    { step: 3, color: 'text-purple-400', label: 'STEP 3: ADD ON',  body: 'Want more? Tap "+ Add More" above to go back to the menu.' },
                    { step: 4, color: 'text-green-400',  label: 'STEP 4: PAYMENT', body: 'Choose Cash or Online. Waiter collects cash at table.' },
                ].map(c => (
                    <div key={c.step} className="flex-none w-64 bg-slate-800/40 border border-white/10 backdrop-blur rounded-3xl p-5">
                        <h4 className={`text-xs font-black mb-2 ${c.color}`}>{c.label}</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{c.body}</p>
                    </div>
                ))}
            </div>

            {/* ── Order Items List ──────────────────────────── */}
            <div className="px-4 space-y-2 mt-2">
                {myItems.length === 0 && (
                    <div className="text-center py-10">
                        <p className="text-slate-500 text-sm">No orders yet.</p>
                        <button onClick={() => navigate(`/menu/${shopId}/${tableNumber}`)}
                            className="mt-3 bg-blue-500 text-white px-6 py-3 rounded-xl font-bold text-sm">
                            Browse Menu
                        </button>
                    </div>
                )}
                {myItems.map((item, idx) => {
                    const statusMap = {
                        received:  { label: 'Received',  cls: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
                        preparing: { label: 'Preparing', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
                        ready:     { label: 'Ready',     cls: 'text-blue-400   bg-blue-500/10   border-blue-500/30'   },
                        served:    { label: 'Served ✓',  cls: 'text-green-400  bg-green-500/10  border-green-500/30'  },
                    };
                    const s = statusMap[item.status] || statusMap.received;
                    return (
                        <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                            <ItemThumb item={item} size="sm" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-white truncate">{item.productId?.name || 'Item'}</p>
                                    {item.orderType === 'parcel' && (
                                        <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">📦 Parcel</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">Qty: {item.quantity} • {item.username}</p>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${s.cls}`}>{s.label}</span>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── ORDER RECEIVED button (shown when food is ready/served) ── */}
            <AnimatePresence>
                {(phase === 'ready' || phase === 'served') && !confirmedReceived && (
                    <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 60, opacity: 0 }} className="px-4 mt-4">
                        <button onClick={handleOrderReceived}
                            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-900/40 active:scale-95 transition-all flex items-center justify-center gap-3">
                            <CheckCircle2 className="w-6 h-6" />
                            ORDER RECEIVED
                        </button>
                        <p className="text-center text-slate-500 text-xs mt-2">Confirm that your food has arrived at the table</p>
                    </motion.div>
                )}
                {confirmedReceived && phase !== 'paid' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mx-4 mt-4 bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
                        <p className="text-green-400 font-bold">✅ Confirmed! Enjoy your meal 😊</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Payment Section — only shown AFTER ORDER RECEIVED clicked ── */}
            {myItems.length > 0 && !isPaid && (
                <div className="px-4 mt-4 mb-4">
                    {/* Always show total bill */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-slate-400 font-semibold">Total Bill</span>
                            <span className="text-2xl font-extrabold text-white">₹{total}</span>
                        </div>
                        {/* Payment buttons only after ORDER RECEIVED */}
                        {confirmedReceived ? (
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => handlePay('cash')} disabled={paying}
                                    className="py-3.5 rounded-2xl font-bold border-2 border-slate-700 text-slate-300 hover:border-blue-500 hover:text-blue-400 transition disabled:opacity-50 text-sm">
                                    💵 Pay Cash
                                </button>
                                <button onClick={() => handlePay('online')} disabled={paying}
                                    className="py-3.5 rounded-2xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 disabled:opacity-50 flex items-center justify-center gap-2 text-sm transition">
                                    <CreditCard className="w-4 h-4" />
                                    {paying ? 'Processing...' : 'Pay Online'}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                                <p className="text-slate-500 text-xs font-medium">Payment options will appear after you confirm food received</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Payment Complete ──────────────────────────── */}
            {isPaid && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="mx-4 mt-4 mb-4 bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="text-green-400 font-extrabold text-lg">Payment Complete!</p>
                    <p className="text-slate-400 text-sm mt-1">Thank you for dining with us. See you again!</p>
                </motion.div>
            )}
        </div>
    );
}
