import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Minus, Plus, X, ChefHat, Clock, Search, Tag } from 'lucide-react';
import { getProducts, placeOrder, getShopById, cancelUserItems, leaveSession, getOffers } from '../services/api';
import { getSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';
import FloatingStatusBar from '../components/common/FloatingStatusBar';

const CATS = ['All', 'Veg', 'Non-Veg', 'Starters', 'Biryani', 'Drinks', 'Desserts'];

export default function MenuPage() {
    const { shopId, tableNumber } = useParams();
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [offers, setOffers] = useState([]);
    const [shop, setShop] = useState(null);
    const [cart, setCart] = useState([]);
    const [activeCat, setActiveCat] = useState('All');
    const [loading, setLoading] = useState(true);
    const [placing, setPlacing] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [session, setSession] = useState(null);
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        const s = localStorage.getItem('customer_session');
        if (!s) { navigate(`/scan/${shopId}/${tableNumber}`); return; }
        const parsed = JSON.parse(s);
        setSession(parsed);

        const handleUnload = () => {
            const sess = JSON.parse(localStorage.getItem('customer_session') || '{}');
            if (sess.tokenId && sess.username) {
                const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');
                navigator.sendBeacon(`${base}/order/cancel-user-items`,
                    new Blob([JSON.stringify({ sessionTokenId: sess.tokenId, username: sess.username })], { type: 'application/json' }));
                navigator.sendBeacon(`${base}/token/leave/${sess.tokenId}/${encodeURIComponent(sess.username)}`,
                    new Blob([], { type: 'application/json' }));
                localStorage.removeItem('customer_session');
            }
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prodRes, shopRes, offersRes] = await Promise.all([
                    getProducts(shopId), getShopById(shopId), getOffers(shopId),
                ]);
                setProducts(prodRes.data);
                setShop(shopRes.data);
                setOffers(offersRes.data || []);
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

    const filtered = (() => {
        let list = activeCat === 'All' ? products : products.filter(p => p.category === activeCat);
        if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
        return list;
    })();

    // Group by category for display
    const grouped = filtered.reduce((acc, p) => {
        const cat = p.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
    }, {});

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
            toast.success('Order sent! Waiter will verify shortly 🛎️', { duration: 3000 });
            setCart([]);
            setShowCart(false);
            navigate(`/order-status/${shopId}/${tableNumber}`);
        } catch { toast.error('Failed to place order.'); }
        finally { setPlacing(false); }
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
            <ChefHat className="w-12 h-12 text-orange-500 animate-bounce" />
            <p className="text-slate-400 font-medium">Loading menu...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 max-w-md mx-auto relative pb-32 font-sans">

            {/* ── Header ── */}
            <div className="bg-slate-900/95 backdrop-blur-md px-4 pt-6 pb-3 sticky top-0 z-20 border-b border-slate-800/60">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-orange-500/20 border border-orange-500/30 rounded-xl flex items-center justify-center shrink-0">
                        <ChefHat className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-extrabold text-white leading-tight truncate">{shop?.name || 'Restaurant'}</h1>
                        <p className="text-xs text-slate-500 font-medium">Table {tableNumber} • {session?.username}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowSearch(v => !v)}
                            className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
                            <Search className="w-4 h-4 text-slate-400" />
                        </button>
                        <button onClick={() => navigate(`/order-status/${shopId}/${tableNumber}`)}
                            className="flex items-center gap-1.5 text-xs text-orange-400 font-bold bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-xl">
                            <Clock className="w-3.5 h-3.5" /> Orders
                        </button>
                    </div>
                </div>

                {/* Search bar */}
                <AnimatePresence>
                    {showSearch && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-3">
                            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search dishes..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500 text-sm" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Category pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {CATS.map(c => (
                        <button key={c} onClick={() => setActiveCat(c)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-xs transition-all ${activeCat === c
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}>
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 pt-4 space-y-6">

                {/* ── Offers Carousel ── */}
                {offers.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Tag className="w-4 h-4 text-orange-400" />
                            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Special Offers</h2>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                            {offers.map(offer => {
                                const discount = offer.discountPercent || (offer.originalPrice
                                    ? Math.round(((offer.originalPrice - offer.specialPrice) / offer.originalPrice) * 100) : 0);
                                return (
                                    <motion.div key={offer._id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                        className="relative shrink-0 w-52 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
                                        {offer.image ? (
                                            <div className="relative h-24 overflow-hidden">
                                                <img src={offer.image} alt={offer.title} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
                                                {discount > 0 && (
                                                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow">
                                                        {discount}% OFF
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-16 bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center relative">
                                                <span className="text-3xl">🔥</span>
                                                {discount > 0 && (
                                                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
                                                        {discount}% OFF
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div className="p-3">
                                            <p className="font-extrabold text-white text-sm leading-tight mb-1 line-clamp-2">{offer.title}</p>
                                            {offer.description && <p className="text-[10px] text-slate-400 mb-2 line-clamp-1">{offer.description}</p>}
                                            <div className="flex items-center gap-2">
                                                <span className="text-orange-400 font-extrabold">₹{offer.specialPrice}</span>
                                                {offer.originalPrice > 0 && (
                                                    <span className="text-slate-500 line-through text-xs">₹{offer.originalPrice}</span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Menu Items ── */}
                {filtered.length === 0 && (
                    <div className="text-center text-slate-500 py-16 font-medium">
                        <p className="text-4xl mb-3">🍽️</p>
                        <p>No items found</p>
                    </div>
                )}

                {activeCat === 'All' ? (
                    Object.entries(grouped).map(([cat, items]) => (
                        <div key={cat}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-px flex-1 bg-slate-800" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2">{cat}</span>
                                <div className="h-px flex-1 bg-slate-800" />
                            </div>
                            <div className="space-y-3">
                                {items.map(p => <ProductCard key={p._id} product={p} cart={cart} onAdd={addToCart} onUpdate={updateQty} />)}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="space-y-3">
                        {filtered.map(p => <ProductCard key={p._id} product={p} cart={cart} onAdd={addToCart} onUpdate={updateQty} />)}
                    </div>
                )}
            </div>

            {/* Floating Order Status Bar */}
            <FloatingStatusBar />

            {/* ── Cart FAB ── */}
            <AnimatePresence>
                {cartCount > 0 && !showCart && (
                    <motion.button initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                        onClick={() => setShowCart(true)}
                        className="fixed bottom-6 left-4 right-4 max-w-md mx-auto bg-orange-500 hover:bg-orange-400 text-white px-5 py-4 rounded-2xl shadow-xl shadow-orange-500/30 flex justify-between items-center z-30 transition">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <div className="font-extrabold leading-tight">{cartCount} item{cartCount > 1 ? 's' : ''}</div>
                                <div className="text-orange-100 text-xs">View Cart</div>
                            </div>
                        </div>
                        <div className="font-extrabold text-xl">₹{cartTotal} →</div>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Cart Drawer ── */}
            <AnimatePresence>
                {showCart && (
                    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25 }}
                        className="fixed inset-0 z-40 flex flex-col justify-end max-w-md mx-auto">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
                        <div className="relative bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
                            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5" />
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-xl font-extrabold text-white">Your Cart</h2>
                                <button onClick={() => setShowCart(false)} className="p-2 bg-slate-800 rounded-xl">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                            {cart.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 py-3 border-b border-slate-800">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-white">{item.name}</p>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.orderType === 'parcel' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                                                {item.orderType === 'parcel' ? '📦 Parcel' : '🍽️ Dine-In'}
                                            </span>
                                        </div>
                                        <p className="text-orange-400 font-bold text-sm mt-0.5">₹{item.price * item.qty}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateQty(item._id, item.orderType, -1)} className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center hover:bg-slate-700 transition"><Minus className="w-3.5 h-3.5" /></button>
                                        <span className="font-extrabold text-white w-5 text-center">{item.qty}</span>
                                        <button onClick={() => updateQty(item._id, item.orderType, 1)} className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center hover:bg-orange-400 transition"><Plus className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <button onClick={() => removeFromCart(item._id, item.orderType)} className="p-1.5 text-slate-600 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between text-lg font-extrabold">
                                <span className="text-slate-300">Total</span>
                                <span className="text-orange-400">₹{cartTotal}</span>
                            </div>
                            <button onClick={handlePlaceOrder} disabled={placing}
                                className="w-full mt-4 bg-orange-500 hover:bg-orange-400 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-orange-500/20 text-lg disabled:opacity-60 transition">
                                {placing ? 'Placing Order...' : '🛎️ Place Order'}
                            </button>
                            <p className="text-center text-xs text-slate-600 mt-3">Waiter will verify your order before it goes to kitchen</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Product Card ──────────────────────────────────────────
function ProductCard({ product: p, cart, onAdd, onUpdate }) {
    const dineIn = cart.find(c => c._id === p._id && c.orderType === 'dine-in');
    const parcel = cart.find(c => c._id === p._id && c.orderType === 'parcel');
    const inCart = (dineIn?.qty || 0) + (parcel?.qty || 0);

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`bg-slate-900 rounded-2xl p-3 flex gap-3 border transition ${inCart > 0 ? 'border-orange-500/40' : 'border-slate-800'}`}>
            {/* Image */}
            <div className="relative w-24 h-24 shrink-0">
                <img src={p.image || `https://placehold.co/96x96/1e293b/ea580c?text=${encodeURIComponent(p.name[0] || '?')}`}
                    alt={p.name} className="w-full h-full object-cover rounded-xl" />
                {/* Veg/Non-Veg indicator */}
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full border-2 ${p.isVeg ? 'border-green-500 bg-green-500/20' : 'border-red-500 bg-red-500/20'}`} />
                {inCart > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-slate-900">
                        {inCart}
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                <div>
                    <h3 className="font-extrabold text-white text-sm leading-tight truncate">{p.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.category}</p>
                    <p className="text-orange-400 font-extrabold text-base mt-1">₹{p.price}</p>
                </div>

                {/* Add buttons */}
                <div className="flex flex-col gap-1.5 mt-2">
                    {/* Dine-In */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 w-10 shrink-0">🍽️ Dine</span>
                        {!dineIn ? (
                            <button onClick={() => onAdd(p, 'dine-in')}
                                className="text-xs font-bold bg-slate-800 hover:bg-orange-500/10 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-lg transition">
                                + Add
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => onUpdate(p._id, 'dine-in', -1)} className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm hover:bg-orange-400 transition">−</button>
                                <span className="font-extrabold text-orange-400 w-5 text-center text-sm">{dineIn.qty}</span>
                                <button onClick={() => onUpdate(p._id, 'dine-in', 1)} className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm hover:bg-orange-400 transition">+</button>
                            </div>
                        )}
                    </div>
                    {/* Parcel */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 w-10 shrink-0">📦 Pack</span>
                        {!parcel ? (
                            <button onClick={() => onAdd(p, 'parcel')}
                                className="text-xs font-bold bg-slate-800 hover:bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg transition">
                                + Add
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => onUpdate(p._id, 'parcel', -1)} className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm hover:bg-blue-400 transition">−</button>
                                <span className="font-extrabold text-blue-400 w-5 text-center text-sm">{parcel.qty}</span>
                                <button onClick={() => onUpdate(p._id, 'parcel', 1)} className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm hover:bg-blue-400 transition">+</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}


