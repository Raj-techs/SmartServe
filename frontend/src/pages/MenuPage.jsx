import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Minus, Plus, X, ChefHat, Clock } from 'lucide-react';
import { getProducts, placeOrder, getShopById } from '../services/api';
import { getSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';
import FloatingStatusBar from '../components/common/FloatingStatusBar';

const CATS = ['All', 'Veg', 'Non-Veg', 'Starters', 'Biryani', 'Drinks', 'Desserts'];

export default function MenuPage() {
    const { shopId, tableNumber } = useParams();
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [shop, setShop] = useState(null);
    const [cart, setCart] = useState([]);
    const [activeCat, setActiveCat] = useState('All');
    const [loading, setLoading] = useState(true);
    const [placing, setPlacing] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [session, setSession] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null); // seconds remaining

    useEffect(() => {
        const s = localStorage.getItem('customer_session');
        if (!s) { navigate(`/scan/${shopId}/${tableNumber}`); return; }
        const parsed = JSON.parse(s);
        setSession(parsed);
        // Start 35-min countdown from session start
        if (parsed.startedAt) {
            const tick = () => {
                const elapsed = (Date.now() - parsed.startedAt) / 1000;
                const remaining = Math.max(0, 35 * 60 - elapsed);
                setTimeLeft(Math.floor(remaining));
                if (remaining <= 0) {
                    localStorage.removeItem('customer_session');
                    navigate(`/scan/${shopId}/${tableNumber}`);
                }
            };
            tick();
            const t = setInterval(tick, 1000);
            return () => clearInterval(t);
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prodRes, shopRes] = await Promise.all([
                    getProducts(shopId), getShopById(shopId),
                ]);
                setProducts(prodRes.data);
                setShop(shopRes.data);
            } catch { toast.error('Failed to load menu'); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [shopId]);

    const addToCart = (product, orderType = 'dine-in') => {
        setCart(prev => {
            const ex = prev.find(c => c._id === product._id && c.orderType === orderType);
            if (ex) return prev.map(c =>
                (c._id === product._id && c.orderType === orderType) ? { ...c, qty: c.qty + 1 } : c
            );
            return [...prev, { ...product, qty: 1, orderType }];
        });
        toast.success(`${orderType === 'parcel' ? '📦 Parcel' : '🍽️ Dine-In'} added!`, { duration: 900 });
    };

    const updateQty = (id, orderType, delta) => setCart(prev =>
        prev.map(c => (c._id === id && c.orderType === orderType) ? { ...c, qty: Math.max(1, c.qty + delta) } : c)
            .filter(c => c.qty > 0)
    );
    const removeFromCart = (id, orderType) => setCart(prev => prev.filter(c => !(c._id === id && c.orderType === orderType)));
    const cartTotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
    const cartCount = cart.reduce((a, c) => a + c.qty, 0);
    const filtered = activeCat === 'All' ? products : products.filter(p => p.category === activeCat);

    const handlePlaceOrder = async () => {
        if (!cart.length || !session) return;
        setPlacing(true);
        try {
            const orderRes = await placeOrder({
                shopId, tableNumber,
                sessionTokenId: session.tokenId,
                items: cart.map(c => ({ productId: c._id, quantity: c.qty, username: session.username, orderType: c.orderType || 'dine-in' })),
                totalAmount: cartTotal,
            });
            getSocket().emit('order_placed', { shopId, tableNumber, order: orderRes.data });
            toast.success('Order placed! 🎉');
            setCart([]);
            setShowCart(false);
            navigate(`/order-status/${shopId}/${tableNumber}`);
        } catch { toast.error('Failed to place order.'); }
        finally { setPlacing(false); }
    };

    if (loading) return (
        <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center gap-3">
            <ChefHat className="w-12 h-12 text-orange-500 animate-bounce" />
            <p className="text-slate-500 font-medium">Loading menu...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 max-w-md mx-auto relative pb-28 font-sans shadow-2xl">
            {/* Header */}
            <div className="bg-white px-5 pt-8 pb-4 rounded-b-3xl shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <ChefHat className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold text-slate-800 leading-tight">{shop?.name || 'Restaurant'}</h1>
                        <p className="text-xs text-slate-400 font-medium">
                            Table {tableNumber} • {session?.username}
                            {timeLeft !== null && (
                                <span className={`ml-2 font-bold ${timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
                                    ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                </span>
                            )}
                        </p>
                    </div>
                    <button onClick={() => navigate(`/order-status/${shopId}/${tableNumber}`)}
                        className="ml-auto flex items-center gap-1 text-xs text-orange-500 font-bold bg-orange-50 px-3 py-1.5 rounded-full">
                        <Clock className="w-3.5 h-3.5" /> My Orders
                    </button>
                </div>
                <div className="flex gap-2 overflow-x-auto mt-4 pb-1 scrollbar-hide">
                    {CATS.map(c => (
                        <button key={c} onClick={() => setActiveCat(c)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-xs transition ${activeCat === c ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-orange-50'}`}>
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product list */}
            <div className="p-4 space-y-3">
                {filtered.length === 0 && (
                    <div className="text-center text-slate-400 py-16 font-medium">No items in this category</div>
                )}
                {filtered.map(p => (
                    <motion.div key={p._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl p-3 flex gap-3 shadow-sm border border-slate-100">
                        <div className="relative w-24 h-24 shrink-0">
                            <img src={p.image || `https://placehold.co/96x96/fff3e0/ea580c?text=${encodeURIComponent(p.name)}`}
                                alt={p.name} className="w-full h-full object-cover rounded-xl" />
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full border-2 ${p.isVeg ? 'border-green-600 bg-green-100' : 'border-red-500 bg-red-100'}`} />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                                <h3 className="font-bold text-slate-800 leading-tight">{p.name}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{p.category}</p>
                                <p className="text-orange-500 font-extrabold text-base mt-1">₹{p.price}</p>
                            </div>
                            <AddButton product={p} cart={cart} onAdd={addToCart} onUpdate={updateQty} />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Cart FAB */}
            <AnimatePresence>
                {cartCount > 0 && !showCart && (
                    <motion.button initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
                        onClick={() => setShowCart(true)}
                        className="fixed bottom-6 left-4 right-4 max-w-md mx-auto bg-orange-500 text-white px-5 py-4 rounded-2xl shadow-xl flex justify-between items-center z-30">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl"><ShoppingBag className="w-5 h-5" /></div>
                            <div className="text-left">
                                <div className="font-extrabold">{cartCount} item{cartCount > 1 ? 's' : ''}</div>
                                <div className="text-orange-100 text-xs">View Cart</div>
                            </div>
                        </div>
                        <div className="font-extrabold text-xl">₹{cartTotal} →</div>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Floating Order Status Bar */}
            <FloatingStatusBar />

            {/* Cart Drawer */}
            <AnimatePresence>
                {showCart && (
                    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25 }}
                        className="fixed inset-0 z-40 flex flex-col justify-end max-w-md mx-auto">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
                        <div className="relative bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-xl font-extrabold">Your Cart</h2>
                                <button onClick={() => setShowCart(false)} className="p-2 bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
                            </div>
                            {cart.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 py-3 border-b border-slate-100">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-slate-800">{item.name}</p>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.orderType === 'parcel' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {item.orderType === 'parcel' ? '📦 Parcel' : '🍽️ Dine-In'}
                                            </span>
                                        </div>
                                        <p className="text-orange-500 font-bold">₹{item.price * item.qty}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateQty(item._id, item.orderType, -1)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                                        <span className="font-bold w-5 text-center">{item.qty}</span>
                                        <button onClick={() => updateQty(item._id, item.orderType, 1)} className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                                    </div>
                                    <button onClick={() => removeFromCart(item._id, item.orderType)} className="p-1.5 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between text-lg font-extrabold text-slate-800">
                                <span>Total</span><span className="text-orange-500">₹{cartTotal}</span>
                            </div>
                            <button onClick={handlePlaceOrder} disabled={placing}
                                className="w-full mt-4 bg-orange-500 text-white font-extrabold py-4 rounded-2xl shadow-lg text-lg disabled:opacity-60">
                                {placing ? 'Placing Order...' : '🛎️ Place Order'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function AddButton({ product, cart, onAdd, onUpdate }) {
    const dineIn = cart.find(c => c._id === product._id && c.orderType === 'dine-in');
    const parcel = cart.find(c => c._id === product._id && c.orderType === 'parcel');

    return (
        <div className="flex flex-col gap-1.5 self-start">
            {/* Dine-In row */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 w-12">🍽️ Dine</span>
                {!dineIn ? (
                    <button onClick={() => onAdd(product, 'dine-in')}
                        className="text-xs font-bold bg-orange-50 text-orange-500 border border-orange-200 px-3 py-1 rounded-lg hover:bg-orange-100 transition">
                        + Add
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => onUpdate(product._id, 'dine-in', -1)} className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">−</button>
                        <span className="font-extrabold text-orange-500 w-4 text-center text-sm">{dineIn.qty}</span>
                        <button onClick={() => onUpdate(product._id, 'dine-in', 1)} className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">+</button>
                    </div>
                )}
            </div>
            {/* Parcel row */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 w-12">📦 Pack</span>
                {!parcel ? (
                    <button onClick={() => onAdd(product, 'parcel')}
                        className="text-xs font-bold bg-blue-50 text-blue-500 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-100 transition">
                        + Add
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => onUpdate(product._id, 'parcel', -1)} className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">−</button>
                        <span className="font-extrabold text-blue-500 w-4 text-center text-sm">{parcel.qty}</span>
                        <button onClick={() => onUpdate(product._id, 'parcel', 1)} className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">+</button>
                    </div>
                )}
            </div>
        </div>
    );
}
