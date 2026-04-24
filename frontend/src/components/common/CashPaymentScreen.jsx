import { useEffect, useState } from 'react';
import { getSocket } from '../../hooks/useSocket';
import { leaveSession } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function CashPaymentScreen({ session, tableNumber, shopId, orderId, amount, onDone }) {
    const [paid, setPaid] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const socket = getSocket();

        // Listen for waiter confirming cash collected
        const handleCashCollected = ({ orderId: oid }) => {
            if (oid === orderId) {
                setPaid(true);
                triggerConfetti();
            }
        };
        socket.on('cash_collected', handleCashCollected);
        return () => socket.off('cash_collected', handleCashCollected);
    }, [orderId]);

    const triggerConfetti = () => {
        // Dynamically load confetti
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        script.onload = () => {
            const duration = 4000;
            const end = Date.now() + duration;
            const defaults = { startVelocity: 28, spread: 360, ticks: 60, zIndex: 9999 };
            const randomInRange = (min, max) => Math.random() * (max - min) + min;
            const interval = setInterval(() => {
                const timeLeft = end - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);
                const particleCount = 45 * (timeLeft / duration);
                window.confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#ff7800', '#ffbb00', '#ffffff', '#ff5500'] });
                window.confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#ff7800', '#ffbb00', '#ffffff', '#ff5500'] });
            }, 220);
        };
        document.body.appendChild(script);
    };

    const handleThankYou = async () => {
        try {
            if (session?.tokenId && session?.username) {
                await leaveSession(session.tokenId, session.username);
            }
        } catch { /* silent */ }
        localStorage.removeItem('customer_session');
        // Navigate to a safe session-ended page — NOT the landing page
        navigate(`/session-ended`, { replace: true });
    };

    return (
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#050505', color: 'white', height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet" />
            <style>{cashStyles}</style>

            <div className="app-container">
                {!paid ? (
                    /* ── Screen 1: Waiter Coming ── */
                    <div id="tracking-view" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', textAlign: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#ff7800', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Request Active</h2>
                            <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>Waiter is Coming</h1>
                            <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>Cash payment requested at Table {tableNumber}</p>
                        </div>

                        <div className="waiter-path">
                            <div className="service-start">🤵</div>
                            <div className="path-line"></div>
                            <div className="floating" style={{ left: '118px', top: '88px', animationDelay: '0.8s', fontSize: '26px' }}>💵</div>
                            <div className="floating" style={{ left: '174px', top: '52px', animationDelay: '2.4s' }}>🥂</div>
                            <div className="floating" style={{ left: '138px', top: '112px', animationDelay: '1.1s', fontSize: '24px' }}>💵</div>
                            <div className="waiter">🤵</div>
                            <div className="table">🪑<div className="table-label">{tableNumber}</div></div>
                        </div>

                        <div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                <div className="status-dot" style={{ width: '8px', height: '8px', background: '#ff7800', borderRadius: '50%', flexShrink: 0 }}></div>
                                <p style={{ fontSize: '13px', color: '#d1d5db', textAlign: 'left' }}>
                                    Your waiter is on the way to collect <strong style={{ color: 'white' }}>₹{amount}</strong> 😊<br />
                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>Please keep the cash ready...</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Screen 2: Payment Success ── */
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center' }}>
                        <div className="checkmark-wrapper">
                            <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
                                <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                            </svg>
                        </div>

                        <h2 style={{ color: '#ff7800', fontWeight: 800, letterSpacing: '0.2em', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Payment Success</h2>
                        <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>Thank You!</h1>

                        <div className="verification-card" style={{ width: '100%' }}>
                            <div className="owner-instruction">Show this to the Owner / Counter</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                    <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 700 }}>CUSTOMER</span>
                                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' }}>{session?.username}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                    <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 700 }}>TABLE NO</span>
                                    <span style={{ color: '#ff7800', fontSize: '14px', fontWeight: 900 }}>{tableNumber}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                    <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 700 }}>AMOUNT PAID</span>
                                    <span style={{ color: '#34d399', fontSize: '14px', fontWeight: 900 }}>₹24{amount}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 700 }}>PAYMENT</span>
                                    <span style={{ color: '#34d399', fontSize: '14px', fontWeight: 900 }}>CASH VERIFIED ✓</span>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleThankYou}
                            style={{ width: '100%', background: '#ff7800', color: 'white', fontWeight: 900, padding: '16px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '16px', marginTop: '16px', boxShadow: '0 8px 32px rgba(255,120,0,0.3)', letterSpacing: '0.05em' }}>
                            THANK YOU — DONE 🙏
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const cashStyles = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');
.app-container {
    width:100%; max-width:400px; height:92vh;
    background:rgba(255,255,255,0.03); backdrop-filter:blur(20px);
    border:1px solid rgba(255,255,255,0.1); border-radius:40px;
    display:flex; flex-direction:column; padding:2rem; position:relative;
    box-shadow:0 0 60px rgba(255,120,0,0.12);
}
.waiter-path {
    width:280px; height:220px; margin:2rem auto; position:relative;
    background:rgba(255,120,0,0.03); border-radius:28px; overflow:hidden;
    box-shadow:0 0 40px rgba(255,120,0,0.1);
}
.service-start { position:absolute; left:24px; top:50%; transform:translateY(-50%); font-size:42px; filter:drop-shadow(0 0 12px #ff7800); }
.table { position:absolute; right:24px; bottom:58px; font-size:52px; text-align:center; animation:tablePulse 2.2s ease-in-out infinite; filter:drop-shadow(0 0 15px #ff7800); }
.table-label { font-size:11px; font-weight:800; letter-spacing:1px; color:#ff7800; margin-top:-6px; }
.path-line { position:absolute; top:107px; left:78px; right:78px; height:4px; background:linear-gradient(to right,transparent,rgba(255,120,0,0.4),#ff7800,rgba(255,120,0,0.4),transparent); border-radius:9999px; }
.waiter { position:absolute; left:48px; top:82px; font-size:56px; filter:drop-shadow(0 0 25px #ff7800); z-index:20; animation:waiterWalk 7.5s linear infinite; }
.floating { position:absolute; font-size:28px; opacity:0.75; filter:drop-shadow(0 0 10px #ff7800); animation:floatUp 3.2s ease-in-out infinite; z-index:10; }
.status-dot { animation:pulseDot 1.8s ease-in-out infinite; }
.checkmark-wrapper { width:90px; height:90px; margin:0 auto 1.5rem; }
.checkmark { width:90px; height:90px; border-radius:50%; display:block; stroke-width:4; stroke:#fff; stroke-miterlimit:10; box-shadow:inset 0 0 0 #ff7800; animation:fill 0.5s ease-in-out 0.5s forwards, scale 0.35s ease-in-out 1s both; }
.checkmark__circle { stroke-dasharray:166; stroke-dashoffset:166; stroke-width:4; stroke-miterlimit:10; stroke:#ff7800; fill:none; animation:stroke 0.7s cubic-bezier(0.65,0,0.45,1) forwards; }
.checkmark__check { transform-origin:50% 50%; stroke-dasharray:48; stroke-dashoffset:48; animation:stroke 0.4s cubic-bezier(0.65,0,0.45,1) 0.9s forwards; }
.verification-card { background:linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01)); border:1px solid rgba(255,120,0,0.25); border-radius:24px; padding:24px; margin:1.5rem 0; position:relative; overflow:hidden; }
.verification-card::before { content:''; position:absolute; top:0; left:-100%; width:50%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent); animation:shimmer 3.5s infinite; }
.owner-instruction { background:#ff7800; color:#000; font-size:10px; font-weight:800; padding:6px 14px; border-radius:100px; display:inline-block; margin-bottom:12px; text-transform:uppercase; letter-spacing:1.2px; }
@keyframes floatUp { 0%{transform:translateY(0) scale(0.7);opacity:0.3;} 40%{transform:translateY(-38px) scale(1.05);opacity:1;} 70%{transform:translateY(-68px) scale(0.95);} 100%{transform:translateY(-105px) scale(0.6);opacity:0;} }
@keyframes waiterWalk { 0%{transform:translateX(0px) rotate(-6deg);} 22%{transform:translateX(48px) rotate(9deg) translateY(-9px);} 44%{transform:translateX(98px) rotate(-6deg);} 66%{transform:translateX(148px) rotate(9deg) translateY(-9px);} 88%{transform:translateX(192px) rotate(-4deg);} 100%{transform:translateX(210px) rotate(0deg);} }
@keyframes tablePulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.07);} }
@keyframes pulseDot { 0%,100%{opacity:0.4;} 50%{opacity:1;} }
@keyframes stroke { to{stroke-dashoffset:0;} }
@keyframes scale { 0%,100%{transform:none;} 50%{transform:scale3d(1.12,1.12,1);} }
@keyframes fill { to{box-shadow:inset 0 0 0 50px #ff7800;} }
@keyframes shimmer { to{left:200%;} }
`;
