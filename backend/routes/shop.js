import express from 'express';
import Shop from '../models/Shop.js';
import { authMiddleware } from '../middleware/auth.js';
import QRCode from 'qrcode';

const router = express.Router();

// Create shop
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, category, tables } = req.body;
        const shop = new Shop({
            name,
            category,
            ownerId: req.user.id,
            tables: tables || [],
        });
        await shop.save();
        res.status(201).json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get my shop
router.get('/mine', authMiddleware, async (req, res) => {
    try {
        const shop = await Shop.findOne({ ownerId: req.user.id });
        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update shop tables
router.put('/:shopId/tables', authMiddleware, async (req, res) => {
    try {
        const { tables } = req.body;
        const shop = await Shop.findByIdAndUpdate(req.params.shopId, { tables }, { new: true });
        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update single table status
router.put('/:shopId/table/:tableNumber/status', async (req, res) => {
    try {
        const { status } = req.body;
        const shop = await Shop.findById(req.params.shopId);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });

        const table = shop.tables.find(t => t.tableNumber === req.params.tableNumber);
        if (!table) return res.status(404).json({ error: 'Table not found' });

        table.status = status;
        await shop.save();
        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get shop by ID (public - for customers)
router.get('/:shopId', async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.shopId);
        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate QR code for a table
router.get('/:shopId/qr/:tableNumber', async (req, res) => {
    try {
        const { shopId, tableNumber } = req.params;
        const url = `${process.env.FRONTEND_URL}/scan/${shopId}/${tableNumber}`;
        const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
        res.json({ qr: qrDataUrl, url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Offers CRUD ────────────────────────────────────────────
// Get all offers for a shop (public)
router.get('/:shopId/offers', async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.shopId);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });
        const now = new Date();
        const active = (shop.offers || []).filter(o =>
            o.status === 'active' && (!o.expiryDate || new Date(o.expiryDate) > now)
        );
        res.json(active);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get ALL offers for owner management
router.get('/:shopId/offers/all', authMiddleware, async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.shopId);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });
        res.json(shop.offers || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add offer
router.post('/:shopId/offers', authMiddleware, async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.shopId);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });
        const { title, description, image, specialPrice, originalPrice, discountPercent, status, expiryDate } = req.body;
        const discount = discountPercent || (originalPrice ? Math.round(((originalPrice - specialPrice) / originalPrice) * 100) : 0);
        shop.offers.push({ title, description, image, specialPrice, originalPrice, discountPercent: discount, status: status || 'active', expiryDate: expiryDate || null });
        await shop.save();
        res.status(201).json(shop.offers[shop.offers.length - 1]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update offer
router.put('/:shopId/offers/:offerId', authMiddleware, async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.shopId);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });
        const offer = shop.offers.id(req.params.offerId);
        if (!offer) return res.status(404).json({ error: 'Offer not found' });
        Object.assign(offer, req.body);
        await shop.save();
        res.json(offer);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete offer
router.delete('/:shopId/offers/:offerId', authMiddleware, async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.shopId);
        if (!shop) return res.status(404).json({ error: 'Shop not found' });
        shop.offers = shop.offers.filter(o => o._id.toString() !== req.params.offerId);
        await shop.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update UPI ID
router.put('/:shopId/upi', authMiddleware, async (req, res) => {
    try {
        const { upiId } = req.body;
        const shop = await Shop.findByIdAndUpdate(req.params.shopId, { upiId }, { new: true });
        res.json(shop);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
