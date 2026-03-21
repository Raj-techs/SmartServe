import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket } from '../../hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChefHat, Utensils, CheckCircle2, CreditCard } from 'lucide-react';

const PHASE_CONFIG = {
    placed:    { label: 'Order Placed',    icon: <Clock className="w-3.5 h-3.5" />,         bar: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    preparing: { label: 'Being Prepared',  icon: <ChefHat className="w-3.5 h-3.5" />,       bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    ready:     { label: 'Ready to Serve',  icon: <Utensils className="w-3.5 h-3.5" />,      bar: 'bg-blue-500',   text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30'   },
    served:    { label: 'Enjoy Your Meal', icon: <span className="text-sm">😊</span>,        bar: 'bg-green-500',  text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  },
    paid:      { label: 'Payment Done ✓',  icon: <CheckCircle2 className="w-3.5 h-3.5" />,  bar: 'bg-emerald-500',text: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30'},
};

export default function FloatingStatusBar() {
    const { shopId, tableNumber } = useParams();
    const navigate = useNavigate();
    const [phase, setPhase] = useState(null); // null = no orders yet, don't show
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const socket = getSocket();
        socket.emit('join_table', { shopId, tableNumber });
        socket.on('order_status_changed', ({ phase: p }) => { setPhase(p); setVisible(true); });
        socket.on('order_updated',        () => setVisible(true));
        socket.on('payment_done',         () => { setPhase('paid'); setVisible(true); });
        return () => {
            socket.off('order_status_changed');
            socket.off('order_updated');
            socket.off('payment_done');
        };
    }, [shopId, tableNumber]);

    if (!phase) return null;
    const cfg = PHASE_CONFIG[phase] || PHASE_CONFIG.placed;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    className={`fixed bottom-24 left-4 right-4 max-w-md mx-auto z-40 rounded-2xl border ${cfg.bg} ${cfg.border} px-4 py-3 flex items-center gap-3 shadow-xl backdrop-blur-sm`}
                    onClick={() => navigate(`/order-status/${shopId}/${tableNumber}`)}
                    style={{ cursor: 'pointer' }}
                >
                    <div className={`w-2 h-2 rounded-full ${cfg.bar} animate-pulse shrink-0`} />
                    <span className={`${cfg.text}`}>{cfg.icon}</span>
                    <div className="flex-1">
                        <p className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}>Order Status</p>
                        <p className="text-white font-bold text-sm">{cfg.label}</p>
                    </div>
                    <span className="text-slate-400 text-xs font-semibold">Tap →</span>
                    <button onClick={e => { e.stopPropagation(); setVisible(false); }}
                        className="text-slate-500 hover:text-slate-300 ml-1 text-lg leading-none">×</button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
