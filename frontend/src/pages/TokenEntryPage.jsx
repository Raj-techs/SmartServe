import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChefHat, ArrowRight, User, Users, Copy, CheckCircle2, RefreshCw, Hash } from 'lucide-react';
import { joinSession, rejoinSession, getShopById } from '../services/api';
import { whenConnected } from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Steps: 1=check_rejoin, 2=name, 3=people, 4=guest_code
export default function TokenEntryPage() {
    const { shopId, tableNumber } = useParams();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [people, setPeople] = useState(1);
    const [guestCode, setGuestCode] = useState('');
    const [tokenId, setTokenId] = useState('');
    const [loading, setLoading] = useState(false);
    const [shopInfo, setShopInfo] = useState(null);
    const [codeCopied, setCodeCopied] = useState(false);
    // Rejoin paste state
    const [rejoinCode, setRejoinCode] = useState('');
    const [rejoinName, setRejoinName] = useState('');
    const [showRejoinBox, setShowRejoinBox] = useState(false);
    const [checkingStorage, setCheckingStorage] = useState(true);

    // On mount: check localStorage for existing session
    useEffect(() => {
        const load = async () => {
            try {
                const shopRes = await getShopById(shopId);
                setShopInfo(shopRes.data);
            } catch { /* silent */ }

            const saved = localStorage.getItem('customer_session');
            if (saved) {
                const sess = JSON.parse(saved);
                // Same table & shop → auto rejoin
                if (sess.shopId === shopId && sess.tableNumber === tableNumber && sess.tokenId && sess.guestCode) {
                    try {
                        const { data } = await rejoinSession(shopId, tableNumber, sess.guestCode, sess.username);
                        if (data.success) {
                            // Update localStorage with fresh tokenId
                            localStorage.setItem('customer_session', JSON.stringify({
                                ...sess, tokenId: data.tokenId, startedAt: sess.startedAt || Date.now(),
                            }));
                            whenConnected(s => s.emit('join_table', { shopId, tableNumber }));
                            toast.success(`Welcome back, ${sess.username}! 👋`);
                            navigate(`/menu/${shopId}/${tableNumber}`);
                            return;
                        }
                    } catch { /* code expired — fall through to normal flow */ }
                    localStorage.removeItem('customer_session');
                }
            }
            setCheckingStorage(false);
            setStep(2); // go to name entry
        };
        load();
    }, []);

    // Step 2: Enter name → Step 3: People count
    const handleNameSubmit = () => {
        if (!username.trim()) return toast.error('Please enter your name');
        setStep(3);
    };

    // Step 3: People count → call /token/join → get guestCode
    const handleJoin = async () => {
        setLoading(true);
        try {
            const { data } = await joinSession(shopId, tableNumber, username.trim(), people);
            setGuestCode(data.guestCode);
            setTokenId(data.tokenId);
            setStep(4);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not join. Try again.');
        } finally { setLoading(false); }
    };

    // Remember code: copy to clipboard + save to localStorage
    const handleRememberCode = () => {
        navigator.clipboard.writeText(guestCode).catch(() => {});
        localStorage.setItem('customer_session', JSON.stringify({
            shopId, tableNumber, tokenId,
            guestCode, username: username.trim(), people,
            startedAt: Date.now(),
        }));
        setCodeCopied(true);
        toast.success('Code copied & saved! 🎉');
    };

    // Proceed to menu (session already saved via handleRememberCode or save now)
    const handleEnterMenu = () => {
        // Save even if they didn't click "Remember" button
        if (!codeCopied) {
            localStorage.setItem('customer_session', JSON.stringify({
                shopId, tableNumber, tokenId,
                guestCode, username: username.trim(), people,
                startedAt: Date.now(),
            }));
        }
        whenConnected(s => {
            s.emit('join_table', { shopId, tableNumber });
            s.emit('customer_seated', { shopId, tableNumber, username: username.trim() });
        });
        navigate(`/menu/${shopId}/${tableNumber}`);
    };

    // Rejoin via manually pasted code
    const handleRejoin = async () => {
        if (!rejoinCode.trim() || !rejoinName.trim()) return toast.error('Enter your name and code');
        setLoading(true);
        try {
            const { data } = await rejoinSession(shopId, tableNumber, rejoinCode.trim(), rejoinName.trim());
            localStorage.setItem('customer_session', JSON.stringify({
                shopId, tableNumber, tokenId: data.tokenId,
                guestCode: data.guestCode, username: rejoinName.trim(),
                startedAt: Date.now(),
            }));
            whenConnected(s => s.emit('join_table', { shopId, tableNumber }));
            toast.success(`Welcome back, ${rejoinName}! 👋`);
            navigate(`/menu/${shopId}/${tableNumber}`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Invalid code. Ask staff for your code.');
        } finally { setLoading(false); }
    };

    if (checkingStorage) return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center p-5">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center text-white mb-8">
                <div className="w-16 h-16 bg-orange-500/20 border border-orange-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <ChefHat className="w-8 h-8 text-orange-400" />
                </div>
                <h1 className="text-2xl font-extrabold">{shopInfo?.name || 'SmartServe'}</h1>
                <p className="text-slate-400 mt-1 text-sm">Table {tableNumber}</p>
            </motion.div>

            <AnimatePresence mode="wait">
                {/* STEP 2 — Enter Name */}
                {step === 2 && (
                    <StepCard key="name" title="Welcome! 👋" subtitle="Enter your name to get started">
                        <div className="relative mb-5">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input autoFocus type="text" value={username}
                                onChange={e => setUsername(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
                                placeholder="e.g. Rajesh" maxLength={20}
                                className="w-full pl-12 pr-4 py-4 text-lg rounded-2xl border-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:border-orange-500 outline-none font-semibold" />
                        </div>
                        <button onClick={handleNameSubmit}
                            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition">
                            Next <ArrowRight className="w-5 h-5" />
                        </button>
                        {/* Rejoin toggle */}
                        <button onClick={() => setShowRejoinBox(v => !v)}
                            className="w-full mt-3 text-slate-500 text-sm font-medium underline underline-offset-2">
                            {showRejoinBox ? 'Hide' : 'Have a code? Rejoin here'}
                        </button>
                        {showRejoinBox && (
                            <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
                                <input type="text" value={rejoinName} onChange={e => setRejoinName(e.target.value)}
                                    placeholder="Your name" maxLength={20}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:border-orange-500 outline-none font-semibold text-sm" />
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" value={rejoinCode} onChange={e => setRejoinCode(e.target.value)}
                                        placeholder="Paste 6-digit code" maxLength={6}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:border-orange-500 outline-none font-bold tracking-widest text-center text-lg" />
                                </div>
                                <button onClick={handleRejoin} disabled={loading}
                                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-sm transition disabled:opacity-50">
                                    {loading ? 'Rejoining...' : '🔁 Rejoin Session'}
                                </button>
                            </div>
                        )}
                    </StepCard>
                )}

                {/* STEP 3 — How many people */}
                {step === 3 && (
                    <StepCard key="people" title="How many people?" subtitle={`Including yourself, ${username}`}>
                        <div className="flex items-center justify-center gap-8 my-6">
                            <button onClick={() => setPeople(p => Math.max(1, p - 1))}
                                className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-2xl font-bold text-white hover:bg-slate-700 transition">−</button>
                            <div className="text-center">
                                <div className="text-5xl font-extrabold text-white">{people}</div>
                                <div className="text-slate-500 text-sm mt-1">guests</div>
                            </div>
                            <button onClick={() => setPeople(p => Math.min(12, p + 1))}
                                className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-2xl font-bold text-white hover:bg-slate-700 transition">+</button>
                        </div>
                        <div className="flex gap-2 mb-5">
                            {[1,2,3,4,5,6].map(n => (
                                <button key={n} onClick={() => setPeople(n)}
                                    className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 transition ${people === n ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-slate-700 text-slate-500'}`}>{n}</button>
                            ))}
                        </div>
                        <button onClick={handleJoin} disabled={loading}
                            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition">
                            <Users className="w-5 h-5" /> {loading ? 'Setting up...' : 'See the Menu'}
                        </button>
                        <button onClick={() => setStep(2)} className="w-full mt-3 text-slate-500 text-sm font-medium">← Back</button>
                    </StepCard>
                )}

                {/* STEP 4 — Show Guest Code */}
                {step === 4 && (
                    <StepCard key="code" title="You're all set! 🎉" subtitle="Save your code to rejoin if you close the tab">
                        <div className="flex flex-col items-center gap-2 py-3 mb-4">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Your Guest Code</p>
                            <div className="flex gap-2">
                                {guestCode.split('').map((d, i) => (
                                    <div key={i} className="w-11 h-14 bg-slate-800 border-2 border-orange-500/50 rounded-xl flex items-center justify-center text-2xl font-black text-orange-400 tracking-widest">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <p className="text-slate-500 text-xs text-center mt-1">If you close the app, scan QR again and paste this code to rejoin your session.</p>
                        </div>
                        <button onClick={handleRememberCode}
                            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition mb-3 ${codeCopied ? 'bg-green-500/20 border-2 border-green-500/50 text-green-400' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}>
                            {codeCopied ? <><CheckCircle2 className="w-5 h-5" /> Saved to clipboard!</> : <><Copy className="w-5 h-5" /> Remember this code</>}
                        </button>
                        <button onClick={handleEnterMenu}
                            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition">
                            Continue to Menu <ArrowRight className="w-5 h-5" />
                        </button>
                    </StepCard>
                )}
            </AnimatePresence>
        </div>
    );
}

function StepCard({ title, subtitle, children }) {
    return (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-7">
            <h2 className="text-xl font-extrabold text-white mb-1">{title}</h2>
            <p className="text-slate-400 text-sm mb-6">{subtitle}</p>
            {children}
        </motion.div>
    );
}
