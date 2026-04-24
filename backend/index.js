import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import shopRoutes from './routes/shop.js';
import productRoutes from './routes/product.js';
import tokenRoutes from './routes/token.js';
import orderRoutes from './routes/order.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://smart-serve-two.vercel.app',
    process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, true); // allow all in production for now
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();
const httpServer = createServer(app);

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/product', productRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.send('SmartServe API Running ✅'));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('MongoDB error:', err));

const io = new Server(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
    },
});

io.on('connection', (socket) => {

    socket.on('join_shop', (shopId) => socket.join(`shop_${shopId}`));

    socket.on('join_table', ({ shopId, tableNumber }) => {
        socket.join(`table_${shopId}_${tableNumber}`);
    });

    socket.on('seat_request', ({ shopId, tableNumber, username }) => {
        io.to(`shop_${shopId}`).emit('seat_request', {
            tableNumber, username, socketId: socket.id,
        });
    });

    socket.on('seat_accepted', ({ customerSocketId, shopId, tableNumber }) => {
        io.to(customerSocketId).emit('seat_accepted', { shopId, tableNumber });
        io.to(`shop_${shopId}`).emit('seat_confirmed', { tableNumber });
    });

    socket.on('seat_rejected', ({ customerSocketId }) => {
        io.to(customerSocketId).emit('seat_rejected');
    });

    socket.on('order_placed', ({ shopId, tableNumber, order }) => {
        // Notify waiter for verification (not kitchen yet)
        io.to(`shop_${shopId}`).emit('order_pending_waiter', { tableNumber, order });
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase: 'pending_waiter' });
    });

    // Waiter accepted → notify customer, notify kitchen
    socket.on('order_accepted_by_waiter', ({ shopId, tableNumber, orderId, username }) => {
        io.to(`shop_${shopId}`).emit('new_order', { tableNumber });
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase: 'placed', username: username || null });
        io.to(`shop_${shopId}`).emit('order_updated', { orderId });
    });

    // Waiter rejected → notify customer
    socket.on('order_rejected_by_waiter', ({ shopId, tableNumber, orderId, username }) => {
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase: 'rejected', username: username || null });
        io.to(`shop_${shopId}`).emit('order_updated', { orderId });
    });

    socket.on('order_status_update', ({ shopId, tableNumber, orderId, status, username }) => {
        io.to(`table_${shopId}_${tableNumber}`).emit('order_updated', { orderId, status });
        io.to(`shop_${shopId}`).emit('order_updated', { orderId, status });
        const phase = status === 'served' ? 'served' : status === 'ready' ? 'ready' : 'preparing';
        // Pass username so FloatingStatusBar only activates for the correct user
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase, username: username || null });
    });

    socket.on('order_received_confirm', ({ shopId, tableNumber }) => {
        io.to(`shop_${shopId}`).emit('order_received_confirm', { tableNumber });
    });

    // ── Customer requests cash collection ──────────────────
    socket.on('cash_payment_request', ({ shopId, tableNumber, username, amount, orderId, customerSocketId }) => {
        io.to(`shop_${shopId}`).emit('cash_payment_request', {
            tableNumber, username, amount, orderId,
            customerSocketId: customerSocketId || socket.id,
        });
    });

    // ── Waiter collected cash → notify customer ────────────
    socket.on('cash_collected', ({ customerSocketId, shopId, tableNumber, orderId, username }) => {
        io.to(customerSocketId).emit('cash_collected', { orderId });
        io.to(`shop_${shopId}`).emit('payment_done', { tableNumber });
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase: 'paid', username: username || null });
    });

    socket.on('payment_done', ({ shopId, tableNumber, username }) => {
        io.to(`shop_${shopId}`).emit('payment_done', { tableNumber });
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase: 'paid', username: username || null });
    });

    socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
