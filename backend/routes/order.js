import express from 'express';
import Order from '../models/Order.js';
import Shop from '../models/Shop.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { shopId, sessionTokenId, tableNumber, items, totalAmount } = req.body;
        let order = await Order.findOne({ sessionTokenId, status: 'active' });

        if (order) {
            order.items.push(...items);
            order.totalAmount += totalAmount;
            await order.save();
        } else {
            order = new Order({ shopId, sessionTokenId, tableNumber, items, totalAmount });
            await order.save();
        }

        // Update table status in shop model to 'ordered'
        await Shop.updateOne(
            { _id: shopId, 'tables.tableNumber': tableNumber },
            { $set: { 'tables.$.status': 'ordered' } }
        );

        res.status(201).json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
