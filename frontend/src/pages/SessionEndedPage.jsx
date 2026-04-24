import { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function SessionEndedPage() {
    useEffect(() => {
        localStorage.removeItem('customer_session');
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
            <motion.div
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }} className="w-full max-w-sm"
            >
                <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="text-7xl mb-6"
                >🙏</motion.div>
                <h1 className="text-3xl font-extrabold text-white mb-2">Thank You!</h1>
                <p className="text-slate-400 text-base mb-1">Your payment is complete.</p>
                <p className="text-slate-500 text-sm mb-8">
                    We hope you enjoyed your meal.<br />See you again soon! 😊
                </p>
                <div className="flex items-center gap-3 mb-8">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-slate-700 text-lg">✦</span>
                    <div className="flex-1 h-px bg-slate-800" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5 text-left">
                    <div className="flex items-center gap-2 text-green-400 mb-3">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs font-black text-white">✓</div>
                        <span className="font-bold text-sm">Session Ended — Payment Confirmed</span>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">
                        This screen is safe to close.<br />
                        To dine again, scan the QR code on your table.
                    </p>
                </div>
                <p className="text-slate-700 text-xs mt-8">Powered by SmartServe</p>
            </motion.div>
        </div>
    );
}
