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

const app = express();
const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: {
        origin: [
            'http://localhost:5173',
            process.env.FRONTEND_URL,
        ].filter(Boolean),
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
    },
});

app.use(cors({
    origin: [
        'http://localhost:5173',
        process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/product', productRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/admin', adminRoutes);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('MongoDB error:', err));

io.on('connection', (socket) => {

    // ── Room joins ──────────────────────────────────────────
    socket.on('join_shop', (shopId) => socket.join(`shop_${shopId}`));
    socket.on('join_table', ({ shopId, tableNumber }) => {
        socket.join(`table_${shopId}_${tableNumber}`);
        socket.data = { shopId, tableNumber }; // store for disconnect
    });

    // ── STEP 1: Customer scans QR → sends seat request to owner ──
    // Customer arrives, scans table QR, enters name → owner sees popup
    socket.on('seat_request', ({ shopId, tableNumber, username, socketId }) => {
        io.to(`shop_${shopId}`).emit('seat_request', {
            tableNumber, username,
            socketId: socket.id, // so owner can respond to this exact socket
        });
    });

    // ── STEP 2: Owner accepts seat request → customer gets approved ──
    socket.on('seat_accepted', ({ customerSocketId, shopId, tableNumber }) => {
        io.to(customerSocketId).emit('seat_accepted', { shopId, tableNumber });
        io.to(`shop_${shopId}`).emit('seat_confirmed', { tableNumber });
    });

    // ── STEP 3: Owner rejects seat request ──
    socket.on('seat_rejected', ({ customerSocketId }) => {
        io.to(customerSocketId).emit('seat_rejected');
    });

    // ── Order placed → notify shop ──────────────────────────
    socket.on('order_placed', ({ shopId, tableNumber, order }) => {
        io.to(`shop_${shopId}`).emit('new_order', { tableNumber, order });
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase: 'placed' });
    });

    // ── Order item status updated ───────────────────────────
    socket.on('order_status_update', ({ shopId, tableNumber, orderId, status }) => {
        io.to(`table_${shopId}_${tableNumber}`).emit('order_updated', { orderId, status });
        io.to(`shop_${shopId}`).emit('order_updated', { orderId, status });
        // Also emit phase update so floating bar updates
        const phase = status === 'served' ? 'served' : status === 'ready' ? 'ready' : 'preparing';
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase });
    });

    // ── Customer confirms order received ────────────────────
    socket.on('order_received_confirm', ({ shopId, tableNumber }) => {
        io.to(`shop_${shopId}`).emit('order_received_confirm', { tableNumber });
    });

    // ── Payment done ────────────────────────────────────────
    socket.on('payment_done', ({ shopId, tableNumber }) => {
        io.to(`shop_${shopId}`).emit('payment_done', { tableNumber });
        io.to(`table_${shopId}_${tableNumber}`).emit('order_status_changed', { phase: 'paid' });
    });

    socket.on('disconnect', () => {});
});

app.get('/', (req, res) => res.send('SmartServe API Running ✅'));

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
