import express from 'express';
import Product from '../models/Product.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Add product
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { shopId, name, price, category, image, isVeg } = req.body;
        const product = new Product({ shopId, name, price, category, image, isVeg });
        await product.save();
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get products for a shop
router.get('/shop/:shopId', async (req, res) => {
    try {
        const products = await Product.find({ shopId: req.params.shopId, isAvailable: true });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update product
router.put('/:productId', authMiddleware, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.productId, req.body, { new: true });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete product
router.delete('/:productId', authMiddleware, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.productId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
