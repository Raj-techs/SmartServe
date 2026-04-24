import express from 'express';
import Order from '../models/Order.js';
import Shop from '../models/Shop.js';

const router = express.Router();

// Cancel all pending (non-served) items for a specific user in a session
// Called on tab close / session end
router.put('/cancel-user-items', async (req, res) => {
    try {
        const { sessionTokenId, username } = req.body;
        if (!sessionTokenId || !username) return res.status(400).json({ error: 'Missing fields' });

        const orders = await Order.find({ sessionTokenId, status: 'active' });
        for (const order of orders) {
            let changed = false;
            for (const item of order.items) {
                // Cancel items that haven't been prepared yet (including pending_waiter)
                if (item.username === username && ['received', 'pending_waiter'].includes(item.status)) {
                    item.status = 'cancelled';
                    changed = true;
                }
            }
            if (changed) await order.save();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { shopId, sessionTokenId, tableNumber, items, totalAmount } = req.body;
        // Items start as pending_waiter — waiter must verify before going to kitchen
        const pendingItems = items.map(i => ({ ...i, status: 'pending_waiter' }));
        let order = await Order.findOne({ sessionTokenId, status: 'active' });

        if (order) {
            order.items.push(...pendingItems);
            order.totalAmount += totalAmount;
            await order.save();
        } else {
            order = new Order({ shopId, sessionTokenId, tableNumber, items: pendingItems, totalAmount });
            await order.save();
        }

        await Shop.updateOne(
            { _id: shopId, 'tables.tableNumber': tableNumber },
            { $set: { 'tables.$.status': 'ordered' } }
        );

        res.status(201).json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Waiter verifies pending items → sends to kitchen (status: received)
router.put('/:orderId/verify', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        order.items.forEach(item => {
            if (item.status === 'pending_waiter') item.status = 'received';
        });
        await order.save();
        res.json(order);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Waiter rejects pending items → cancelled
router.put('/:orderId/reject', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        order.items.forEach(item => {
            if (item.status === 'pending_waiter') item.status = 'cancelled';
        });
        const allCancelled = order.items.every(i => i.status === 'cancelled');
        if (allCancelled) { order.status = 'cancelled'; }
        await order.save();
        res.json(order);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get ACTIVE orders for kitchen/waiter/tables
router.get('/shop/:shopId/active', async (req, res) => {
    try {
        const orders = await Order.find({ shopId: req.params.shopId, status: 'active' }).populate('items.productId');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get ALL orders (active + completed) for analytics/revenue
router.get('/shop/:shopId/all', async (req, res) => {
    try {
        const orders = await Order.find({ shopId: req.params.shopId }).populate('items.productId').sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:orderId/item/:itemId', async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const item = order.items.id(req.params.itemId);
        if (item) item.status = status;

        await order.save();
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:orderId/pay', async (req, res) => {
    try {
        const { method } = req.body;
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        order.paymentStatus = 'paid';
        order.paymentMethod = method;
        order.status = 'completed';
        await order.save();

        // Update table status in shop model to 'payment_pending' or 'idle'
        // Since order is completed, it should be idle.
        await Shop.updateOne(
            { _id: order.shopId, 'tables.tableNumber': order.tableNumber },
            { $set: { 'tables.$.status': 'idle' } }
        );

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
