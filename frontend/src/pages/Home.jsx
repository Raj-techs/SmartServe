import { useNavigate } from 'react-router-dom';
import { ChefHat, QrCode, MonitorPlay, Zap, Utensils, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-white text-slate-800 font-sans">
            <nav className="flex justify-between items-center px-6 py-5 lg:px-16 border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
                        <ChefHat className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-extrabold tracking-tight">SmartServe</span>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/login')} className="font-semibold text-slate-600 hover:text-orange-500 transition px-4 py-2">Login</button>
                    <button onClick={() => navigate('/register')} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 transition">Get Started</button>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-20 text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-full text-sm font-bold mb-8 border border-orange-100">
                        <Zap className="w-4 h-4" /> India's smartest restaurant platform
                    </span>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
                        QR Ordering,<br /><span className="text-orange-500">Real-Time</span> Kitchen
                    </h1>
                    <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto">
                        Customers scan, order, and pay from their phones. Kitchen, waiter, and owner — all synced live.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
                        <button onClick={() => navigate('/register')}
                            className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-extrabold text-lg shadow-xl shadow-orange-200 hover:-translate-y-1 transition">
                            🚀 Register Your Shop — Free
                        </button>
                        <button onClick={() => navigate('/login')}
                            className="border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold text-lg hover:border-orange-300 transition">
                            Sign In to Dashboard
                        </button>
                    </div>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-6 text-left">
                    {[
                        { icon: <QrCode />, title: 'QR + Token Ordering', desc: 'Customer scans table QR, enters PIN, browses menu and places order — all from their phone.' },
                        { icon: <MonitorPlay />, title: 'Live Kitchen Screen', desc: 'Orders appear instantly on kitchen display. Accept → Prepare → Ready with one tap.' },
                        { icon: <CreditCard />, title: 'Payment Tracking', desc: 'Cash and online payments tracked per table. Waiter collects and marks as done.' },
                    ].map(f => (
                        <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-50 p-7 rounded-2xl border border-slate-100 hover:shadow-lg hover:border-orange-100 transition">
                            <div className="w-11 h-11 bg-orange-100 text-orange-500 rounded-xl flex items-center justify-center mb-5">{f.icon}</div>
                            <h3 className="text-lg font-extrabold mb-2">{f.title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-20 bg-orange-500 rounded-3xl p-10 text-white text-center">
                    <h2 className="text-3xl font-extrabold mb-3">Ready to modernise your restaurant?</h2>
                    <p className="text-orange-100 mb-6">Set up in under 5 minutes. No hardware needed.</p>
                    <button onClick={() => navigate('/register')}
                        className="bg-white text-orange-500 font-extrabold px-8 py-4 rounded-2xl text-lg hover:scale-105 transition shadow-xl">
                        Start Free Today →
                    </button>
                </div>
            </main>
        </div>
    );
}
