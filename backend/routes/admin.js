import express from 'express';
import Shop from '../models/Shop.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require superadmin role
router.use(authMiddleware, roleMiddleware('superadmin'));

// GET /api/admin/stats — platform overview
router.get('/stats', async (req, res) => {
    try {
        const [shops, users, orders] = await Promise.all([
            Shop.find(),
            User.find(),
            Order.find(),
        ]);
        const revenue = orders
            .filter(o => o.paymentStatus === 'paid')
            .reduce((a, o) => a + (o.totalAmount || 0), 0);
        res.json({
            totalShops: shops.length,
            activeShops: shops.filter(s => s.isActive).length,
            totalUsers: users.length,
            totalOrders: orders.length,
            totalRevenue: revenue,
            commission: Math.floor(revenue * 0.1),
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/shops — all shops with revenue
router.get('/shops', async (req, res) => {
    try {
        const shops = await Shop.find().populate('ownerId', 'name email');
        const shopData = await Promise.all(shops.map(async (shop) => {
            const orders = await Order.find({ shopId: shop._id, paymentStatus: 'paid' });
            const revenue = orders.reduce((a, o) => a + (o.totalAmount || 0), 0);
            return { ...shop.toObject(), revenue, commission: Math.floor(revenue * 0.1), orderCount: orders.length };
        }));
        res.json(shopData);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/shop/:shopId/toggle — activate/deactivate shop
router.put('/shop/:shopId/toggle', async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.shopId);
        shop.isActive = !shop.isActive;
        await shop.save();
        res.json(shop);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
