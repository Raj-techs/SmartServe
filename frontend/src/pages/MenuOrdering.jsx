import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ChevronLeft, CreditCard } from 'lucide-react';

export default function MenuOrdering() {
    const [cart, setCart] = useState([]);
    const [showPayment, setShowPayment] = useState(false);

    const categories = ['All', 'Starters', 'Biryani', 'Drinks'];
    const [activeCat, setActiveCat] = useState('All');

    const products = [
        { id: 1, name: 'Paneer Tikka', price: 250, cat: 'Starters', img: 'https://images.unsplash.com/photo-1599487405204-6178b677a299?q=80&w=200&auto=format&fit=crop' },
        { id: 2, name: 'Chicken Dum Biryani', price: 350, cat: 'Biryani', img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=200&auto=format&fit=crop' },
        { id: 3, name: 'Virgin Mojito', price: 150, cat: 'Drinks', img: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?q=80&w=200&auto=format&fit=crop' },
        { id: 4, name: 'Crispy Corn', price: 220, cat: 'Starters', img: 'https://images.unsplash.com/photo-1628294895950-98000780f2d7?q=80&w=200&auto=format&fit=crop' },
        { id: 5, name: 'Mutton Biryani', price: 450, cat: 'Biryani', img: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?q=80&w=200&auto=format&fit=crop' },
    ];

    const addToCart = (product) => {
        const existing = cart.find(c => c.id === product.id);
        if (existing) setCart(cart.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c));
        else setCart([...cart, { ...product, qty: 1 }]);
    };

    const filtered = activeCat === 'All' ? products : products.filter(p => p.cat === activeCat);
    const cartTotal = cart.reduce((acc, c) => acc + (c.price * c.qty), 0);

    const handlePay = () => {
        alert('Dummy Payment using Stripe Successful! Table status updated.');
        setCart([]);
        setShowPayment(false);
    };

    if (showPayment) {
        return (
            <div className="bg-slate-50 min-h-screen max-w-md mx-auto relative p-6 font-sans">
                <button onClick={() => setShowPayment(false)} className="mb-6 flex items-center text-slate-500 font-medium">
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back to Menu
                </button>
                <h2 className="text-2xl font-bold mb-6">Checkout</h2>
                <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                    <div className="flex justify-between font-medium text-slate-600 mb-2"><span>Subtotal</span><span>₹{cartTotal}</span></div>
                    <div className="flex justify-between font-medium text-slate-600 mb-4 pb-4 border-b border-slate-100"><span>Taxes & Fees</span><span>₹{Math.floor(cartTotal * 0.05)}</span></div>
                    <div className="flex justify-between font-bold text-xl text-slate-800"><span>Total</span><span>₹{cartTotal + Math.floor(cartTotal * 0.05)}</span></div>
                </div>
                <button onClick={handlePay} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 shadow-lg hover:bg-slate-800 transition">
                    <CreditCard className="w-5 h-5" /> Pay Now
                </button>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen text-slate-800 pb-24 font-sans max-w-md mx-auto relative shadow-2xl">
            <div className="bg-white p-6 pt-10 rounded-b-3xl shadow-sm sticky top-0 z-10">
                <h1 className="text-2xl font-extrabold tracking-tight">SmartServe Cafe</h1>
                <p className="text-slate-400 text-sm font-medium mt-1">Table T-3 • Session: #4912</p>

                <div className="flex gap-3 overflow-x-auto mt-6 pb-2 scrollbar-hide">
                    {categories.map(c => (
                        <button key={c} onClick={() => setActiveCat(c)} className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition shadow-sm ${activeCat === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {filtered.map(p => (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={p.id} className="bg-white rounded-2xl p-3 flex gap-4 shadow-sm border border-slate-100">
                        <img src={p.img} alt={p.name} className="w-28 h-28 object-cover rounded-xl" />
                        <div className="flex-1 py-1 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-lg leading-tight">{p.name}</h3>
                                <p className="text-brand-600 font-bold mt-1">₹{p.price}</p>
                            </div>
                            <button onClick={() => addToCart(p)} className="self-start text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-5 py-2 rounded-lg hover:bg-slate-200 transition">
                                + Add
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <AnimatePresence>
                {cartTotal > 0 && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto z-20">
                        <div onClick={() => setShowPayment(true)} className="bg-brand-600 text-white p-4 rounded-2xl shadow-xl shadow-brand-500/30 flex justify-between items-center cursor-pointer hover:bg-brand-700 transition">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2.5 rounded-xl"><ShoppingBag className="w-6 h-6" /></div>
                                <div>
                                    <div className="font-bold font-sans">{cart.reduce((a, c) => a + c.qty, 0)} Items</div>
                                    <div className="text-brand-100 text-xs font-semibold uppercase tracking-wide">View Cart</div>
                                </div>
                            </div>
                            <div className="font-bold text-2xl font-sans">₹{cartTotal} <span className="text-lg">&rarr;</span></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
