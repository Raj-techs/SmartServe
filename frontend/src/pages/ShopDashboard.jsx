import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    LayoutGrid, ShoppingBag, QrCode, Settings, LogOut,
    Bell, Plus, Trash2, RefreshCw, Download, Package, BarChart3, Key, Tag, Edit2
} from 'lucide-react';
import {
    getMyShop, createShop, updateShopTables,
    getProducts, addProduct, deleteProduct,
    getShopOrders, getAllShopOrders, generateToken, getTableQR, updateTableStatus, getActiveToken,
    getAllOffers, addOffer, updateOffer, deleteOffer, updateUPI
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket, whenConnected } from '../hooks/useSocket';
import toast from 'react-hot-toast';

export default function ShopDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState('tables');
    const [shop, setShop] = useState(null);
    const [orders, setOrders] = useState([]);
    const [allOrders, setAllOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);
    const [showNotifDot, setShowNotifDot] = useState(false);
    const [pinModal, setPinModal] = useState(null); // { tableNumber, pin }

    const fetchData = useCallback(async () => {
        try {
            const shopRes = await getMyShop();
            setShop(shopRes.data);
            if (shopRes.data) {
                const [ordersRes, prodsRes, allOrdersRes] = await Promise.all([
                    getShopOrders(shopRes.data._id),
                    getProducts(shopRes.data._id),
                    getAllShopOrders(shopRes.data._id),
                ]);
                setOrders(ordersRes.data);
                setProducts(prodsRes.data);
                setAllOrders(allOrdersRes.data);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!shop) return;
        const socket = getSocket();
        // Join shop room — use whenConnected to be safe on production
        whenConnected((s) => s.emit('join_shop', shop._id));

        socket.on('customer_seated', ({ tableNumber, username }) => {
            setShowNotifDot(true);
            setNotifications(n => [`🪑 ${username} seated at Table ${tableNumber}`, ...n.slice(0, 9)]);
            fetchData();
        });
        socket.on('new_order', ({ tableNumber }) => {
            setShowNotifDot(true);
            setNotifications(n => [`🛎️ New order from Table ${tableNumber}`, ...n.slice(0, 9)]);
            fetchData();
        });
        socket.on('order_updated', () => {
            // Re-fetch so chair steps update immediately for all panels
            fetchData();
        });
        socket.on('payment_done', ({ tableNumber }) => {
            setNotifications(n => [`✅ Payment done — Table ${tableNumber}`, ...n.slice(0, 9)]);
            fetchData();
        });
        return () => { socket.off('customer_seated'); socket.off('new_order'); socket.off('order_updated'); socket.off('payment_done'); };
    }, [shop, fetchData]);

    const handleLogout = () => { logout(); navigate('/login'); };

    const handleActivateTable = async (tableNumber) => {
        try {
            const { data } = await generateToken(shop._id, tableNumber);
            setPinModal({ tableNumber, pin: data.pin });
            toast.success(`Table ${tableNumber} activated!`);
            fetchData();
        } catch {
            toast.error('Could not activate table');
        }
    };
    const handleTableStatus = async (tableNumber, status) => {
        await updateTableStatus(shop._id, tableNumber, status);
        fetchData();
    };

    // Compute live table data by merging shop.tables + active orders
    const enrichedTables = (shop?.tables || []).map(table => {
        const tableOrders = orders.filter(o => o.tableNumber === table.tableNumber && o.status === 'active');
        const hasOrders = tableOrders.length > 0;
        const allServed = hasOrders && tableOrders.every(o => o.items.every(i => i.status === 'served'));
        const isPaid = hasOrders && tableOrders.every(o => o.paymentStatus === 'paid');
        const isPreparing = hasOrders && tableOrders.some(o => o.items.some(i => i.status === 'preparing'));
        return { ...table, hasOrders, allServed, isPaid, isPreparing, tableOrders };
    });

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-400 font-medium">Loading dashboard...</p>
            </div>
        </div>
    );

    if (!shop) return <SetupShop onCreated={fetchData} />;

    const NAV = [
        { key: 'tables', icon: <LayoutGrid className="w-5 h-5" />, label: 'Tables' },
        { key: 'orders', icon: <ShoppingBag className="w-5 h-5" />, label: 'Orders' },
        { key: 'products', icon: <Package className="w-5 h-5" />, label: 'Products' },
        { key: 'offers', icon: <Tag className="w-5 h-5" />, label: 'Offers' },
        { key: 'qr', icon: <QrCode className="w-5 h-5" />, label: 'QR Codes' },
        { key: 'analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Revenue' },
        { key: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-[72px] lg:w-60 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-20">
                <div className="p-4 lg:p-5 border-b border-slate-800 flex justify-center lg:justify-start">
                    <span className="text-xl font-extrabold text-white hidden lg:block">
                        SmartServe<span className="text-orange-500">.</span>
                    </span>
                    <span className="text-xl font-extrabold text-white lg:hidden">S<span className="text-orange-500">.</span></span>
                </div>
                <div className="p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider hidden lg:block px-4 pt-4">Menu</div>
                <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                    {NAV.map(n => (
                        <button key={n.key} onClick={() => setTab(n.key)}
                            className={`flex items-center justify-center lg:justify-start gap-3 w-full p-3 rounded-xl transition font-medium ${tab === n.key ? 'bg-orange-500/15 text-orange-400' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}>
                            {n.icon}
                            <span className="hidden lg:block">{n.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-2 border-t border-slate-800">
                    <button onClick={handleLogout}
                        className="flex items-center justify-center lg:justify-start gap-3 w-full p-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-slate-800 transition font-medium">
                        <LogOut className="w-5 h-5" /><span className="hidden lg:block">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <header className="bg-slate-900/80 backdrop-blur px-5 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-lg font-extrabold text-white">{shop.name}</h1>
                        <p className="text-xs text-slate-400">{shop.category} • {user?.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchData} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition">
                            <RefreshCw className="w-4 h-4 text-slate-400" />
                        </button>
                        <button onClick={() => { setShowNotifDot(false); setTab('notifications'); }}
                            className="p-2.5 bg-slate-800 rounded-xl relative hover:bg-slate-700 transition">
                            <Bell className="w-4 h-4 text-slate-400" />
                            {showNotifDot && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900" />}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {tab === 'tables' && <TablesView tables={enrichedTables} shopId={shop._id} onActivate={handleActivateTable} onStatusChange={handleTableStatus} onShowPin={setPinModal} />}
                    {tab === 'orders' && <OrdersView orders={orders} />}
                    {tab === 'products' && <ProductsView products={products} shopId={shop._id} shopCategory={shop.category} onRefresh={fetchData} />}
                    {tab === 'offers' && <OffersView shopId={shop._id} />}
                    {tab === 'qr' && <QRView tables={shop.tables} shopId={shop._id} />}
                    {tab === 'analytics' && <AnalyticsView orders={allOrders} />}
                    {tab === 'settings' && <SettingsView shop={shop} />}
                    {tab === 'notifications' && (
                        <div className="space-y-2">
                            <h2 className="text-lg font-extrabold text-white mb-4">Notifications</h2>
                            {notifications.length === 0 && <p className="text-slate-500">No notifications yet.</p>}
                            {notifications.map((n, i) => (
                                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-300">{n}</div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
            {pinModal && <PinModal tableNumber={pinModal.tableNumber} pin={pinModal.pin} shopId={shop._id} onClose={() => setPinModal(null)} />}
        </div>
    );
}

// ─── Tables Tab — Visual Floor Layout ────────────────────
function TablesView({ tables, shopId, onActivate, onStatusChange, onShowPin }) {
    const [tokens, setTokens] = useState({});

    useEffect(() => {
        if (!tables.length) return;
        const fetchTokens = async () => {
            const results = {};
            await Promise.all(tables.map(async (t) => {
                try {
                    const { data } = await getActiveToken(shopId, t.tableNumber);
                    if (data) results[t.tableNumber] = data;
                } catch { /* none */ }
            }));
            setTokens(results);
        };
        fetchTokens();
        const interval = setInterval(fetchTokens, 15000);
        return () => clearInterval(interval);
    }, [tables, shopId]);

    if (tables.length === 0) return (
        <div className="text-center py-20 text-slate-500">
            <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-slate-700" />
            <p className="font-medium">No tables configured yet.</p>
            <p className="text-sm mt-1">Go to Settings to add tables.</p>
        </div>
    );

    // Legend
    const legend = [
        { color: 'bg-blue-500 border-blue-400',   label: 'Accepted' },
        { color: 'bg-orange-500 border-orange-400', label: 'Ordered' },
        { color: 'bg-yellow-500 border-yellow-400', label: 'Received' },
        { color: 'bg-green-500 border-green-400',  label: 'Paid' },
    ];

    return (
        <div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-6">
                {legend.map(l => (
                    <div key={l.label} className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-bold ${l.color} bg-opacity-20`}>
                        <span className={`w-2 h-2 rounded-full ${l.color.split(' ')[0]}`} />
                        <span className="text-white">{l.label}</span>
                    </div>
                ))}
            </div>

            {/* Floor Grid */}
            <div className="grid grid-cols-2 gap-8 justify-items-center">
                {tables.map(t => {
                    const token = tokens[t.tableNumber];
                    const members = token?.members || [];
                    const seats = t.seats || 4;
                    return (
                        <div key={t.tableNumber} className="flex flex-col items-center gap-3 w-full max-w-xs">
                            {/* Visual Table with Chairs */}
                            <div className="py-14 px-10 w-full flex items-center justify-center">
                                {t.shape === 'circle'
                                    ? <CircleTable tableNumber={t.tableNumber} seats={seats} members={members} table={t} />
                                    : <RectTable tableNumber={t.tableNumber} seats={seats} members={members} table={t} />
                                }
                            </div>

                            {/* Controls below table */}
                            {t.status === 'idle' ? (
                                <button onClick={() => onActivate(t.tableNumber)}
                                    className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 rounded-xl text-sm transition">
                                    🟢 Activate Table
                                </button>
                            ) : (
                                <button onClick={() => onStatusChange(t.tableNumber, 'idle')}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm transition border border-slate-700">
                                    Clear Table
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Chair step colour helper ─────────────────────────────
// step 0 = empty/grey
// step 1 = accepted / seated (blue)
// step 2 = ordered / item received by kitchen (orange)
// step 3 = preparing / ready / served — food journey (yellow)
// step 4 = payment done (green)
function getStepStyle(step) {
    const styles = {
        0: { bg: 'bg-slate-700',  border: 'border-slate-500',  text: 'text-slate-400'  },
        1: { bg: 'bg-blue-900',   border: 'border-blue-500',   text: 'text-blue-400'   },
        2: { bg: 'bg-orange-950', border: 'border-orange-500', text: 'text-orange-400' },
        3: { bg: 'bg-yellow-950', border: 'border-yellow-500', text: 'text-yellow-400' },
        4: { bg: 'bg-green-950',  border: 'border-green-500',  text: 'text-green-400'  },
    };
    return styles[step] || styles[0];
}

// ─── Single Chair with hover popup ───────────────────────
function Chair({ seatIndex, member, table, isCircle }) {
    const [hover, setHover] = useState(false);

    // ── PER-USER step: only look at items ordered by this specific member ──
    let step = 0;
    if (member) {
        step = 1; // seated / accepted

        if (!member.username?.startsWith('Guest')) {
            // Get ALL items across ALL active orders for this table that belong to this member
            const memberItems = (table.tableOrders || [])
                .flatMap(o => (o.items || []))
                .filter(i => i.username === member.username && i.status !== 'cancelled');

            if (memberItems.length > 0) {
                step = 2; // has ordered (received by kitchen)

                const anyInProgress = memberItems.some(
                    i => i.status === 'preparing' || i.status === 'ready' || i.status === 'served'
                );
                if (anyInProgress) step = 3; // kitchen working on it

                // Paid = every order that contains this user's items is paid
                const userOrders = (table.tableOrders || []).filter(
                    o => (o.items || []).some(i => i.username === member.username)
                );
                const allPaid = userOrders.length > 0 && userOrders.every(
                    o => o.paymentStatus === 'paid'
                );
                if (allPaid) step = 4;
            }
        }
    }

    const s = getStepStyle(step);
    const shape = isCircle ? 'rounded-full' : 'rounded-xl';

    const checks = [
        { label: 'Accepted',  done: step >= 1 },
        { label: 'Ordered',   done: step >= 2 },
        { label: 'Received',  done: step >= 3 },
        { label: 'Payment',   done: step >= 4 },
    ];

    return (
        <div className="relative flex items-center justify-center"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}>
            {/* Chair box */}
            <div className={`w-11 h-11 ${shape} border-2 ${s.bg} ${s.border} flex items-center justify-center cursor-pointer transition-all duration-200 shadow-lg`}>
                <svg viewBox="0 0 24 24" className={`w-5 h-5 ${s.text}`} fill="currentColor">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
            </div>

            {/* Hover popup */}
            {hover && (
                <div className="absolute bottom-[115%] left-1/2 -translate-x-1/2 z-50 w-36 bg-white text-slate-900 rounded-xl p-3 shadow-2xl text-xs pointer-events-none">
                    <p className="font-black text-center border-b border-slate-200 pb-1.5 mb-2 text-slate-600">
                        Seat {seatIndex + 1}
                    </p>
                    {member ? (
                        <>
                            <p className="font-bold text-center text-orange-600 mb-1 truncate">{member.username}</p>
                            {member.guestCode && (
                                <p className="text-center text-slate-500 text-[10px] font-mono font-bold tracking-widest mb-1">#{member.guestCode}</p>
                            )}
                            {member.people && (
                                <p className="text-center text-slate-500 text-[10px] mb-2">👥 {member.people} people</p>
                            )}
                        </>
                    ) : (
                        <p className="text-slate-400 text-center mb-2">Empty</p>
                    )}
                    {checks.map(c => (
                        <div key={c.label} className="flex items-center gap-1.5 mb-1">
                            {c.done
                                ? <span className="text-green-500 font-black">✓</span>
                                : <span className="text-red-400 font-black">✗</span>}
                            <span className={c.done ? 'text-slate-800 font-semibold' : 'text-slate-400'}>{c.label}</span>
                        </div>
                    ))}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white" />
                </div>
            )}
        </div>
    );
}

// ─── Rectangular Table ────────────────────────────────────
function RectTable({ tableNumber, seats, members, table }) {
    const top    = Math.ceil(seats / 3);
    const bottom = Math.ceil(seats / 3);
    const side   = Math.max(0, Math.ceil((seats - top - bottom) / 2));

    let seatIdx = 0;
    const topSeats    = Array.from({ length: top    }, () => seatIdx++);
    const bottomSeats = Array.from({ length: bottom }, () => seatIdx++);
    const leftSeats   = Array.from({ length: side   }, () => seatIdx++);
    const rightSeats  = Array.from({ length: side   }, () => seatIdx++);

    const getMember = (i) => members[i] || null;

    return (
        <div className="flex flex-col items-center gap-2">
            {/* Top chairs */}
            <div className="flex gap-2">
                {topSeats.map(i => <Chair key={i} seatIndex={i} member={getMember(i)} table={table} isCircle={false} />)}
            </div>

            {/* Middle row: left + table + right */}
            <div className="flex items-center gap-2">
                <div className="flex flex-col gap-2">
                    {leftSeats.map(i => <Chair key={i} seatIndex={i} member={getMember(i)} table={table} isCircle={false} />)}
                </div>

                {/* The table itself */}
                <div className="w-28 h-20 bg-slate-800/70 border-2 border-slate-600 rounded-2xl shadow-2xl flex items-center justify-center">
                    <span className="text-xs font-black text-slate-500 opacity-60">{tableNumber}</span>
                </div>

                <div className="flex flex-col gap-2">
                    {rightSeats.map(i => <Chair key={i} seatIndex={i} member={getMember(i)} table={table} isCircle={false} />)}
                </div>
            </div>

            {/* Bottom chairs */}
            <div className="flex gap-2">
                {bottomSeats.map(i => <Chair key={i} seatIndex={i} member={getMember(i)} table={table} isCircle={false} />)}
            </div>
        </div>
    );
}

// ─── Circular Table ───────────────────────────────────────
function CircleTable({ tableNumber, seats, members, table }) {
    const radius = 68;
    const center = 90;
    const getMember = (i) => members[i] || null;

    return (
        <div className="relative" style={{ width: center * 2, height: center * 2 }}>
            {/* Table circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-slate-800/70 border-2 border-slate-600 shadow-2xl flex items-center justify-center">
                <span className="text-xs font-black text-slate-500 opacity-60">{tableNumber}</span>
            </div>

            {/* Chairs around the circle */}
            {Array.from({ length: seats }, (_, i) => {
                const angle = (i / seats) * 2 * Math.PI - Math.PI / 2;
                const x = center + radius * Math.cos(angle) - 22;
                const y = center + radius * Math.sin(angle) - 22;
                return (
                    <div key={i} className="absolute" style={{ left: x, top: y }}>
                        <Chair seatIndex={i} member={getMember(i)} table={table} isCircle={true} />
                    </div>
                );
            })}
        </div>
    );
}

// ─── Orders Tab ───────────────────────────────────────────
function OrdersView({ orders }) {
    const [filter, setFilter] = useState('all');
    const filtered = filter === 'all' ? orders
        : filter === 'paid' ? orders.filter(o => o.paymentStatus === 'paid')
        : orders.filter(o => o.paymentStatus === 'pending');

    return (
        <div>
            <div className="flex gap-2 mb-5">
                {['all','pending','paid'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition ${filter === f ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                        {f}
                    </button>
                ))}
            </div>
            {filtered.length === 0 && <p className="text-slate-500 text-center py-16">No orders found.</p>}
            <div className="space-y-3">
                {filtered.map(order => (
                    <div key={order._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="font-extrabold text-white">Table {order.tableNumber}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{new Date(order.createdAt).toLocaleTimeString()} • {order.items?.length} items</p>
                            </div>
                            <div className="text-right">
                                <p className="font-extrabold text-orange-400 text-lg">₹{order.totalAmount}</p>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {order.paymentStatus}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            {(order.items || []).map((item, i) => (
                                <div key={i} className="flex items-center gap-2.5">
                                    {item.productId?.image
                                        ? <img src={item.productId.image} alt={item.productId.name} className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0" />
                                        : <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-xs">🍽️</div>
                                    }
                                    <span className="text-xs text-slate-400 flex-1 truncate">
                                        {item.productId?.name || 'Item'} × {item.quantity}
                                        {item.orderType === 'parcel' && <span className="ml-1 text-blue-400 font-bold">📦</span>}
                                    </span>
                                    <span className={`text-[10px] font-bold shrink-0 ${item.status === 'served' ? 'text-green-400' : item.status === 'preparing' ? 'text-yellow-400' : 'text-orange-400'}`}>{item.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Products Tab ─────────────────────────────────────────
const SHOP_CATEGORIES = {
    'Restaurant':  ['Veg', 'Non-Veg', 'Starters', 'Biryani', 'Meals', 'Drinks', 'Desserts'],
    'Cafe':        ['Coffee', 'Tea', 'Cold Beverages', 'Snacks', 'Sandwiches', 'Desserts'],
    'Juice Shop':  ['Fresh Juices', 'Milkshakes', 'Smoothies', 'Fruit Bowls', 'Ice Cream'],
    'Fast Food':   ['Burgers', 'Pizza', 'Fries', 'Wraps', 'Sandwiches', 'Drinks'],
    'Dhaba':       ['Veg', 'Non-Veg', 'Tandoori', 'Breads', 'Rice Items', 'Curries', 'Drinks'],
    'Bakery':      ['Cakes', 'Pastries', 'Breads', 'Cookies', 'Puffs', 'Desserts', 'Beverages'],
    'Other':       ['General'],
};

function ProductsView({ products, shopId, shopCategory, onRefresh }) {
    const CATS = SHOP_CATEGORIES[shopCategory] || SHOP_CATEGORIES['Other'];
    const [form, setForm] = useState({ name: '', price: '', category: CATS[0], image: '', isVeg: true });
    const [adding, setAdding] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const handleAdd = async (e) => {
        e.preventDefault();
        setAdding(true);
        try {
            await addProduct({ ...form, price: Number(form.price), shopId });
            toast.success('Product added!');
            setForm({ name: '', price: '', category: 'Veg', image: '', isVeg: true });
            setShowForm(false);
            onRefresh();
        } catch { toast.error('Failed to add product'); }
        finally { setAdding(false); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this product?')) return;
        try { await deleteProduct(id); toast.success('Deleted'); onRefresh(); }
        catch { toast.error('Delete failed'); }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-extrabold text-white">Products ({products.length})</h2>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
                    <Plus className="w-4 h-4" /> Add Product
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5 space-y-3">
                    <h3 className="font-bold text-white mb-2">New Product</h3>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="Product name" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                    <input required type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                        placeholder="Price (₹)" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-orange-500">
                        {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input value={form.image} onChange={e => setForm({...form, image: e.target.value})}
                        placeholder="Image URL (optional)" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                    <div className="flex items-center gap-3">
                        <label className="text-slate-400 text-sm font-medium">Type:</label>
                        {[true,false].map(v => (
                            <button key={String(v)} type="button" onClick={() => setForm({...form, isVeg: v})}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${form.isVeg === v ? (v ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-red-500 text-red-400 bg-red-500/10') : 'border-slate-700 text-slate-500'}`}>
                                {v ? '🟢 Veg' : '🔴 Non-Veg'}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button type="submit" disabled={adding}
                            className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60">
                            {adding ? 'Adding...' : 'Add Product'}
                        </button>
                        <button type="button" onClick={() => setShowForm(false)}
                            className="px-4 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white bg-slate-800 text-sm">
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products.map(p => (
                    <div key={p._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                        <img src={p.image || `https://placehold.co/56x56/1e293b/ea580c?text=${encodeURIComponent(p.name[0])}`}
                            alt={p.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.category} • {p.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}</p>
                            <p className="text-orange-400 font-extrabold mt-0.5">₹{p.price}</p>
                        </div>
                        <button onClick={() => handleDelete(p._id)} className="p-2 text-slate-600 hover:text-red-400 transition shrink-0">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── QR Codes Tab ─────────────────────────────────────────
function QRView({ tables, shopId }) {
    const [qrData, setQrData] = useState({});
    const [tokens, setTokens] = useState({});
    const [loading, setLoading] = useState({});

    // Fetch existing active tokens for all tables on mount
    useEffect(() => {
        if (!tables.length) return;
        const fetchTokens = async () => {
            const results = {};
            await Promise.all(tables.map(async (t) => {
                try {
                    const { data } = await getActiveToken(shopId, t.tableNumber);
                    if (data) results[t.tableNumber] = data;
                } catch { /* none */ }
            }));
            setTokens(results);
        };
        fetchTokens();
    }, [tables, shopId]);

    const fetchQR = async (tableNumber) => {
        setLoading(prev => ({ ...prev, [tableNumber]: true }));
        try {
            const { data } = await getTableQR(shopId, tableNumber);
            setQrData(prev => ({ ...prev, [tableNumber]: data }));
        } catch { toast.error('Failed to generate QR'); }
        finally { setLoading(prev => ({ ...prev, [tableNumber]: false })); }
    };

    const downloadQR = (tableNumber, dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `table-${tableNumber}-qr.png`;
        a.click();
    };

    return (
        <div>
            <p className="text-slate-400 text-sm mb-5">
                Generate QR codes for each table. The PIN shown here is the <strong className="text-slate-300">current active PIN</strong> — tell this to customers after they scan.
            </p>
            {tables.length === 0 && <p className="text-slate-500 text-center py-16">No tables configured. Add tables in Settings first.</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tables.map(t => {
                    const activePin = tokens[t.tableNumber]?.pin;
                    return (
                        <div key={t.tableNumber} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-3">
                            <p className="font-extrabold text-white">Table {t.tableNumber}</p>

                            {/* Active PIN badge */}
                            {activePin ? (
                                <div className="w-full bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2 text-center">
                                    <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Active PIN</p>
                                    <p className="text-xl font-black text-orange-400 tracking-widest">{activePin}</p>
                                </div>
                            ) : (
                                <div className="w-full bg-slate-800 rounded-xl px-3 py-2 text-center">
                                    <p className="text-[10px] text-slate-500 font-medium">No active PIN</p>
                                    <p className="text-xs text-slate-600">Activate table first</p>
                                </div>
                            )}

                            {/* QR Code */}
                            {qrData[t.tableNumber] ? (
                                <>
                                    <img src={qrData[t.tableNumber].qr} alt="QR" className="w-32 h-32 rounded-xl border-4 border-white" />
                                    <button onClick={() => downloadQR(t.tableNumber, qrData[t.tableNumber].qr)}
                                        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition w-full justify-center">
                                        <Download className="w-3.5 h-3.5" /> Download QR
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => fetchQR(t.tableNumber)} disabled={loading[t.tableNumber]}
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 w-full justify-center">
                                    <QrCode className="w-4 h-4" />
                                    {loading[t.tableNumber] ? 'Generating...' : 'Generate QR'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Analytics Tab ────────────────────────────────────────
function AnalyticsView({ orders }) {
    const paid = orders.filter(o => o.paymentStatus === 'paid');
    const pending = orders.filter(o => o.paymentStatus === 'pending');
    const cashTotal = paid.filter(o => o.paymentMethod === 'cash').reduce((a, o) => a + o.totalAmount, 0);
    const onlineTotal = paid.filter(o => o.paymentMethod === 'online').reduce((a, o) => a + o.totalAmount, 0);
    const totalRevenue = cashTotal + onlineTotal;
    const pendingTotal = pending.reduce((a, o) => a + o.totalAmount, 0);

    const stats = [
        { label: 'Total Revenue', value: `₹${totalRevenue}`, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
        { label: 'Cash Collected', value: `₹${cashTotal}`, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
        { label: 'Online Collected', value: `₹${onlineTotal}`, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
        { label: 'Pending Payment', value: `₹${pendingTotal}`, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
        { label: 'Orders Completed', value: paid.length, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
        { label: 'Orders Pending', value: pending.length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
    ];

    return (
        <div>
            <h2 className="text-lg font-extrabold text-white mb-5">Revenue Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {stats.map(s => (
                    <div key={s.label} className={`rounded-2xl border p-5 ${s.bg}`}>
                        <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-400 mt-1 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Paid Orders</h3>
            {paid.length === 0 && <p className="text-slate-600 text-sm">No paid orders yet today.</p>}
            <div className="space-y-2">
                {paid.slice(0, 10).map(o => (
                    <div key={o._id} className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm">
                        <div>
                            <span className="text-white font-semibold">Table {o.tableNumber}</span>
                            <span className="text-slate-500 ml-2">{new Date(o.updatedAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-xs">{o.paymentMethod}</span>
                            <span className="text-green-400 font-extrabold">₹{o.totalAmount}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Settings Tab ─────────────────────────────────────────
function SettingsView({ shop }) {
    const [tableCount, setTableCount] = useState(shop?.tables?.length || 4);
    const [defaultShape, setDefaultShape] = useState('rectangle');
    const [defaultSeats, setDefaultSeats] = useState(4);
    const [saving, setSaving] = useState(false);

    const handleSaveTables = async () => {
        setSaving(true);
        try {
            const tables = Array.from({ length: tableCount }, (_, i) => ({
                tableNumber: `T${i + 1}`,
                shape: defaultShape,
                seats: defaultSeats,
                status: shop?.tables?.[i]?.status || 'idle',
            }));
            await updateShopTables(shop._id, tables);
            toast.success('Tables updated! Refresh to see changes.');
        } catch { toast.error('Failed to save'); }
        finally { setSaving(false); }
    };

    return (
        <div className="max-w-lg space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-extrabold text-white mb-4">Shop Info</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="text-white font-semibold">{shop.name}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Category</span><span className="text-white font-semibold">{shop.category}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Shop ID</span><span className="text-slate-500 font-mono text-xs">{shop._id}</span></div>
                </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-extrabold text-white mb-4">Table Configuration</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-slate-400 font-medium block mb-2">Number of Tables: <span className="text-orange-400 font-bold">{tableCount}</span></label>
                        <input type="range" min="1" max="30" value={tableCount} onChange={e => setTableCount(Number(e.target.value))}
                            className="w-full accent-orange-500" />
                        <div className="flex justify-between text-xs text-slate-600 mt-1"><span>1</span><span>30</span></div>
                    </div>
                    <div>
                        <label className="text-sm text-slate-400 font-medium block mb-2">Seats per Table: <span className="text-orange-400 font-bold">{defaultSeats}</span></label>
                        <input type="range" min="2" max="12" value={defaultSeats} onChange={e => setDefaultSeats(Number(e.target.value))}
                            className="w-full accent-orange-500" />
                        <div className="flex justify-between text-xs text-slate-600 mt-1"><span>2</span><span>12</span></div>
                    </div>
                    <div>
                        <label className="text-sm text-slate-400 font-medium block mb-2">Default Table Shape</label>
                        <div className="flex gap-3">
                            {['rectangle', 'circle'].map(s => (
                                <button key={s} onClick={() => setDefaultShape(s)} type="button"
                                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 capitalize transition ${defaultShape === s ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                                    {s === 'rectangle' ? '⬜' : '⭕'} {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">Creates tables T1–T{tableCount}, each with {defaultSeats} seats ({defaultShape} shape).</p>
                    <button onClick={handleSaveTables} disabled={saving}
                        className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl transition disabled:opacity-60">
                        {saving ? 'Saving...' : 'Save Table Config'}
                    </button>
                </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-extrabold text-white mb-3">Staff Access Links</h3>
                <div className="space-y-2 text-sm">
                    {['kitchen', 'waiter'].map(role => (
                        <div key={role} className="flex justify-between items-center bg-slate-800 rounded-xl px-4 py-3">
                            <span className="text-slate-300 capitalize font-medium">{role} Panel</span>
                            <span className="text-orange-400 font-mono text-xs">/{role}/{shop._id}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Offers Tab ───────────────────────────────────────────
function OffersView({ shopId }) {
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editOffer, setEditOffer] = useState(null);
    const [saving, setSaving] = useState(false);
    const emptyForm = { title: '', description: '', image: '', specialPrice: '', originalPrice: '', discountPercent: '', status: 'active', expiryDate: '' };
    const [form, setForm] = useState(emptyForm);

    const fetchOffers = async () => {
        try {
            const { data } = await getAllOffers(shopId);
            setOffers(data);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchOffers(); }, [shopId]);

    const openAdd = () => { setForm(emptyForm); setEditOffer(null); setShowForm(true); };
    const openEdit = (offer) => {
        setForm({
            title: offer.title, description: offer.description || '', image: offer.image || '',
            specialPrice: offer.specialPrice, originalPrice: offer.originalPrice || '',
            discountPercent: offer.discountPercent || '', status: offer.status,
            expiryDate: offer.expiryDate ? offer.expiryDate.split('T')[0] : '',
        });
        setEditOffer(offer);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.specialPrice) return toast.error('Title and Special Price are required');
        setSaving(true);
        try {
            const payload = {
                ...form,
                specialPrice: Number(form.specialPrice),
                originalPrice: form.originalPrice ? Number(form.originalPrice) : 0,
                discountPercent: form.discountPercent ? Number(form.discountPercent) : 0,
                expiryDate: form.expiryDate || null,
            };
            if (editOffer) {
                await updateOffer(shopId, editOffer._id, payload);
                toast.success('Offer updated!');
            } else {
                await addOffer(shopId, payload);
                toast.success('Offer added!');
            }
            setShowForm(false);
            fetchOffers();
        } catch { toast.error('Failed to save offer'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (offerId) => {
        if (!confirm('Delete this offer?')) return;
        try { await deleteOffer(shopId, offerId); toast.success('Deleted'); fetchOffers(); }
        catch { toast.error('Delete failed'); }
    };

    const handleToggleStatus = async (offer) => {
        try {
            await updateOffer(shopId, offer._id, { ...offer, status: offer.status === 'active' ? 'inactive' : 'active' });
            fetchOffers();
        } catch { toast.error('Failed to update'); }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-extrabold text-white">Special Offers ({offers.length})</h2>
                <button onClick={openAdd}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
                    <Plus className="w-4 h-4" /> Add Offer
                </button>
            </div>

            {showForm && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5 space-y-3">
                    <h3 className="font-bold text-white mb-2">{editOffer ? 'Edit Offer' : 'New Offer'}</h3>
                    <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="Offer title (e.g. 50% OFF Chicken Biryani Combo)"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                    <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Short description (optional)"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                    <input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })}
                        placeholder="Background image URL (optional)"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Special Price (₹)*</label>
                            <input required type="number" value={form.specialPrice} onChange={e => setForm({ ...form, specialPrice: e.target.value })}
                                placeholder="99"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Original Price (₹)</label>
                            <input type="number" value={form.originalPrice} onChange={e => setForm({ ...form, originalPrice: e.target.value })}
                                placeholder="199"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Discount %</label>
                            <input type="number" value={form.discountPercent} onChange={e => setForm({ ...form, discountPercent: e.target.value })}
                                placeholder="Auto"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-orange-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Expiry Date (optional)</label>
                            <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Status</label>
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60">
                            {saving ? 'Saving...' : (editOffer ? 'Update Offer' : 'Save Offer')}
                        </button>
                        <button onClick={() => setShowForm(false)}
                            className="px-4 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white bg-slate-800 text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loading && <p className="text-slate-500 text-center py-10">Loading offers...</p>}
            {!loading && offers.length === 0 && (
                <div className="text-center py-20">
                    <Tag className="w-14 h-14 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium text-lg">No offers yet</p>
                    <p className="text-slate-600 text-sm mt-1">Add a special offer and it will appear live in customer menu.</p>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {offers.map(offer => {
                    const discount = offer.discountPercent || (offer.originalPrice
                        ? Math.round(((offer.originalPrice - offer.specialPrice) / offer.originalPrice) * 100) : 0);
                    return (
                        <div key={offer._id} className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            {offer.image && (
                                <div className="relative h-32 overflow-hidden">
                                    <img src={offer.image} alt={offer.title} className="w-full h-full object-cover opacity-60" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                                </div>
                            )}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-extrabold text-white leading-tight">{offer.title}</h3>
                                    {discount > 0 && (
                                        <span className="shrink-0 bg-red-500 text-white text-xs font-black px-2 py-1 rounded-lg">{discount}% OFF</span>
                                    )}
                                </div>
                                {offer.description && <p className="text-xs text-slate-400 mb-2">{offer.description}</p>}
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-orange-400 font-extrabold text-lg">₹{offer.specialPrice}</span>
                                    {offer.originalPrice > 0 && (
                                        <span className="text-slate-500 line-through text-sm">₹{offer.originalPrice}</span>
                                    )}
                                </div>
                                {offer.expiryDate && (
                                    <p className="text-[10px] text-slate-500 mb-3">Expires: {new Date(offer.expiryDate).toLocaleDateString()}</p>
                                )}
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleToggleStatus(offer)}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition ${offer.status === 'active' ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-slate-700 text-slate-500'}`}>
                                        {offer.status === 'active' ? '✅ Active' : '⭕ Inactive'}
                                    </button>
                                    <button onClick={() => openEdit(offer)}
                                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition">
                                        <Edit2 className="w-4 h-4 text-slate-400" />
                                    </button>
                                    <button onClick={() => handleDelete(offer._id)}
                                        className="p-2 bg-slate-800 hover:bg-red-500/20 rounded-xl transition">
                                        <Trash2 className="w-4 h-4 text-slate-600 hover:text-red-400" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── First-time Shop Setup ────────────────────────────────
function SetupShop({ onCreated }) {
    const [form, setForm] = useState({ name: '', category: 'Restaurant', tableCount: 5, seats: 4, shape: 'rectangle' });
    const [saving, setSaving] = useState(false);
    const CATS = ['Restaurant','Cafe','Juice Shop','Fast Food','Dhaba','Bakery','Other'];

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const tables = Array.from({ length: form.tableCount }, (_, i) => ({
                tableNumber: `T${i + 1}`, shape: form.shape, seats: form.seats, status: 'idle',
            }));
            await createShop({ name: form.name, category: form.category, tables });
            toast.success('Shop created! 🎉');
            onCreated();
        } catch { toast.error('Could not create shop'); }
        finally { setSaving(false); }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Package className="w-8 h-8 text-orange-400" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-white">Set Up Your Shop</h2>
                    <p className="text-slate-400 mt-1 text-sm">Let's get your restaurant on SmartServe</p>
                </div>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-slate-400 block mb-2">Shop Name</label>
                        <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                            placeholder="e.g. Rajesh Biryani House"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-orange-500 transition" />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-400 block mb-2">Category</label>
                        <div className="grid grid-cols-3 gap-2">
                            {CATS.map(c => (
                                <button key={c} type="button" onClick={() => setForm({...form, category: c})}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold border-2 transition ${form.category === c ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-400 block mb-2">
                            Number of Tables: <span className="text-orange-400">{form.tableCount}</span>
                        </label>
                        <input type="range" min="1" max="30" value={form.tableCount}
                            onChange={e => setForm({...form, tableCount: Number(e.target.value)})}
                            className="w-full accent-orange-500" />
                    </div>
                    <button type="submit" disabled={saving}
                        className="w-full bg-orange-500 hover:bg-orange-400 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-orange-500/20 transition disabled:opacity-60 text-base mt-2">
                        {saving ? 'Creating...' : '🚀 Launch My Shop'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── PIN Modal ────────────────────────────────────────────
// Shown to owner immediately after activating a table.
// Owner reads PIN aloud or shows screen to customer.
function PinModal({ tableNumber, pin, shopId, onClose }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(pin).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Split PIN into individual digits for big display
    const digits = pin.split('');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-8 text-center shadow-2xl"
            >
                {/* Header */}
                <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🪑</span>
                </div>
                <h2 className="text-xl font-extrabold text-white mb-1">Table {tableNumber} — Active!</h2>
                <p className="text-slate-400 text-sm mb-6">
                    Share this PIN with the customer so they can start ordering.
                </p>

                {/* Big PIN Display */}
                <div className="bg-slate-950 border-2 border-orange-500/40 rounded-2xl p-5 mb-3">
                    <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-3">
                        Customer PIN
                    </p>
                    <div className="flex justify-center gap-3">
                        {digits.map((d, i) => (
                            <div key={i}
                                className="w-11 h-14 bg-slate-800 border-2 border-orange-500/50 rounded-xl flex items-center justify-center text-2xl font-black text-orange-400">
                                {d}
                            </div>
                        ))}
                    </div>
                    <p className="text-slate-600 text-xs mt-4">
                        Expires in 4 hours • Table {tableNumber}
                    </p>
                </div>

                {/* Instructions */}
                <div className="bg-slate-800/50 rounded-xl p-3 mb-5 text-left">
                    <p className="text-xs font-bold text-slate-300 mb-2">How to give this to customer:</p>
                    <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                        <li>Customer scans the QR code on the table</li>
                        <li>They enter this 6-digit PIN</li>
                        <li>They enter their name and start ordering</li>
                    </ol>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button onClick={handleCopy}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition ${copied ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-slate-700 text-slate-300 hover:border-orange-500 hover:text-orange-400'}`}>
                        {copied ? '✅ Copied!' : '📋 Copy PIN'}
                    </button>
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-orange-500 hover:bg-orange-400 text-white transition">
                        Done
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
