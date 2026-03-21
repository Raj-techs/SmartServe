import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChefHat, ArrowRight, User, Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { validateToken } from '../services/api';
import { getSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Steps: 1=name, 2=waiting_approval, 3=approved/pin, 4=people
export default function TokenEntryPage() {
    const { shopId, tableNumber } = useParams();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [people, setPeople] = useState(1);
    const [tokenData, setTokenData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [rejected, setRejected] = useState(false);
    const [mySocketId, setMySocketId] = useState('');

    useEffect(() => {
        const socket = getSocket();
        setMySocketId(socket.id);
        socket.emit('join_table', { shopId, tableNumber });

        // Owner accepted → move to PIN step
        socket.on('seat_accepted', ({ shopId: sid, tableNumber: tn }) => {
            toast.success('✅ Owner accepted! Now enter your PIN.');
            setStep(3);
        });
        // Owner rejected
        socket.on('seat_rejected', () => {
            setRejected(true);
            setStep(2); // stay on waiting but show rejected state
            toast.error('Request rejected. Please ask the owner.');
        });

        return () => { socket.off('seat_accepted'); socket.off('seat_rejected'); };
    }, [shopId, tableNumber]);

    // Step 1: Customer enters name → emit seat_request to owner
    const handleNameSubmit = () => {
        if (!username.trim()) return toast.error('Please enter your name');
        const socket = getSocket();
        socket.emit('seat_request', { shopId, tableNumber, username, socketId: socket.id });
        setStep(2); // waiting for owner approval
    };

    // Step 3: Customer enters PIN after approval
    const handlePinSubmit = async () => {
        if (pin.length !== 6) return toast.error('Enter the 6-digit PIN');
        setLoading(true);
        try {
            const { data } = await validateToken(pin, shopId, username);
            setTokenData(data.token);
            setStep(4); // people count
        } catch (err) {
            toast.error(err.response?.data?.error || 'Invalid PIN. Ask the owner.');
        } finally { setLoading(false); }
    };

    // Step 4: Final entry — also add guest seats
    const handleEnter = async () => {
        setLoading(true);
        try {
            // Validate token once more with username (already done in step 3)
            // Now add guest placeholder members for extra seats (people - 1)
            // We do this by calling validate for each "Guest N" silently
            const guestPromises = [];
            for (let i = 2; i <= people; i++) {
                guestPromises.push(
                    validateToken(pin, shopId, `Guest ${i}`).catch(() => {})
                );
            }
            await Promise.all(guestPromises);

            localStorage.setItem('customer_session', JSON.stringify({
                shopId, tableNumber, pin,
                tokenId: tokenData._id,
                username, people,
                startedAt: Date.now(),
            }));
            const socket = getSocket();
            socket.emit('customer_seated', { shopId, tableNumber, username });
            toast.success(`Welcome, ${username}! 🎉`);
            navigate(`/menu/${shopId}/${tableNumber}`);
        } catch { toast.error('Could not join. Try again.'); }
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center p-5">
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center text-white mb-8">
                <div className="w-16 h-16 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <ChefHat className="w-8 h-8 text-blue-400" />
                </div>
                <h1 className="text-2xl font-extrabold">SmartServe</h1>
                <p className="text-slate-400 mt-1 text-sm">Table {tableNumber}</p>
            </motion.div>

            <AnimatePresence mode="wait">
                {/* STEP 1 — Enter name */}
                {step === 1 && (
                    <StepCard key="name" title="Welcome!" subtitle="Enter your name to request a seat">
                        <div className="relative mb-5">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input autoFocus type="text" value={username}
                                onChange={e => setUsername(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
                                placeholder="e.g. Rajesh" maxLength={20}
                                className="w-full pl-12 pr-4 py-4 text-lg rounded-2xl border-2 border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:border-blue-500 outline-none font-semibold" />
                        </div>
                        <button onClick={handleNameSubmit}
                            className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition">
                            Request Seat <ArrowRight className="w-5 h-5" />
                        </button>
                    </StepCard>
                )}

                {/* STEP 2 — Waiting for owner approval */}
                {step === 2 && !rejected && (
                    <StepCard key="waiting" title="Waiting for Approval" subtitle={`Owner has been notified about Table ${tableNumber}`}>
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="relative w-20 h-20">
                                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping" />
                                <div className="absolute inset-0 rounded-full border-4 border-blue-500/40 animate-pulse" />
                                <div className="w-20 h-20 rounded-full bg-blue-500/10 border-2 border-blue-500/50 flex items-center justify-center">
                                    <Clock className="w-8 h-8 text-blue-400 animate-pulse" />
                                </div>
                            </div>
                            <p className="text-slate-300 text-sm text-center font-medium">
                                Hi <span className="text-white font-bold">{username}</span>! The owner is reviewing your request for Table {tableNumber}.
                            </p>
                            <p className="text-slate-500 text-xs text-center">Please wait a moment...</p>
                        </div>
                        <button onClick={() => { setStep(1); setRejected(false); }}
                            className="w-full mt-2 py-3 rounded-2xl font-bold text-slate-400 border border-slate-700 hover:border-slate-600 text-sm transition">
                            ← Go Back
                        </button>
                    </StepCard>
                )}

                {/* STEP 2 — Rejected state */}
                {step === 2 && rejected && (
                    <StepCard key="rejected" title="Request Rejected" subtitle="The owner declined your request">
                        <div className="flex flex-col items-center gap-3 py-4">
                            <XCircle className="w-16 h-16 text-red-400" />
                            <p className="text-slate-300 text-sm text-center">Please speak to the owner or try a different table.</p>
                        </div>
                        <button onClick={() => { setStep(1); setRejected(false); }}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-2xl transition">
                            Try Again
                        </button>
                    </StepCard>
                )}

                {/* STEP 3 — Enter PIN after approval */}
                {step === 3 && (
                    <StepCard key="pin" title="You're Approved! 🎉" subtitle="Enter the 6-digit PIN from the owner">
                        <div className="mb-3 flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                            <p className="text-green-300 text-xs font-semibold">Owner approved your seat at Table {tableNumber}</p>
                        </div>
                        <div className="flex gap-2 justify-center mb-5">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className={`w-10 h-13 rounded-xl border-2 flex items-center justify-center text-xl font-bold
                                    ${pin[i] ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 bg-slate-800 text-slate-600'}`}>
                                    {pin[i] ? '●' : ''}
                                </div>
                            ))}
                        </div>
                        <NumPad value={pin} onChange={setPin} max={6} />
                        <button onClick={handlePinSubmit} disabled={loading || pin.length < 6}
                            className="w-full mt-4 bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 transition">
                            {loading ? 'Verifying...' : <><span>Verify PIN</span><ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </StepCard>
                )}

                {/* STEP 4 — People count */}
                {step === 4 && (
                    <StepCard key="people" title="How many people?" subtitle="Including yourself">
                        <div className="flex items-center justify-center gap-8 my-5">
                            <button onClick={() => setPeople(p => Math.max(1, p - 1))}
                                className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-2xl font-bold text-white hover:bg-slate-700 transition">−</button>
                            <div className="text-center">
                                <div className="text-5xl font-extrabold text-white">{people}</div>
                                <div className="text-slate-500 text-sm mt-1">guests</div>
                            </div>
                            <button onClick={() => setPeople(p => Math.min(12, p + 1))}
                                className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-2xl font-bold text-white hover:bg-slate-700 transition">+</button>
                        </div>
                        <div className="flex gap-2 mb-3">
                            {[1,2,3,4,5,6].map(n => (
                                <button key={n} onClick={() => setPeople(n)}
                                    className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 transition ${people === n ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-500'}`}>{n}</button>
                            ))}
                        </div>
                        <button onClick={handleEnter} disabled={loading}
                            className="w-full mt-2 bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition">
                            <Users className="w-5 h-5" /> See the Menu
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

function NumPad({ value, onChange, max }) {
    const press = (key) => {
        if (key === 'del') { onChange(value.slice(0, -1)); return; }
        if (value.length < max) onChange(value + key);
    };
    const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];
    return (
        <div className="grid grid-cols-3 gap-3">
            {keys.map((k, i) => k === '' ? <div key={i} /> :
                <button key={i} type="button" onClick={() => press(k)}
                    className={`py-4 rounded-2xl font-bold text-xl transition ${k === 'del' ? 'bg-slate-800 text-slate-400 text-base' : 'bg-slate-800 hover:bg-slate-700 text-white active:scale-95'}`}>
                    {k === 'del' ? '⌫' : k}
                </button>
            )}
        </div>
    );
}
