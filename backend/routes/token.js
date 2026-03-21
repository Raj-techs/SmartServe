import express from 'express';
import { createToken, validateToken } from '../services/tokenService.js';
import SessionToken from '../models/SessionToken.js';
import Shop from '../models/Shop.js';

const router = express.Router();

// Owner generates token for a table
router.post('/generate', async (req, res) => {
    try {
        const { shopId, tableNumber } = req.body;
        if (!shopId || !tableNumber) return res.status(400).json({ error: 'shopId and tableNumber required' });

        // Deactivate old tokens for this table
        await SessionToken.updateMany(
            { shopId, tableNumber, isActive: true },
            { isActive: false }
        );

        const token = await createToken(shopId, tableNumber);

        // Update table status in shop model to 'active'
        await Shop.updateOne(
            { _id: shopId, 'tables.tableNumber': tableNumber },
            { $set: { 'tables.$.status': 'active' } }
        );

        res.status(201).json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Customer validates token (enter PIN)
router.post('/validate', async (req, res) => {
    try {
        const { pin, shopId, username } = req.body;
        const result = await validateToken(pin, shopId);

        if (!result.valid) return res.status(400).json({ error: result.message });

        // Add member if not already in session
        const token = result.token;
        if (username && username !== 'temp') {
            const alreadyJoined = token.members.some(m => m.username === username);
            if (!alreadyJoined) {
                token.members.push({ username });
                await token.save();
            }
        }

        res.json({ success: true, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get active token for a table
router.get('/active/:shopId/:tableNumber', async (req, res) => {
    try {
        const { shopId, tableNumber } = req.params;
        const token = await SessionToken.findOne({ shopId, tableNumber, isActive: true });
        res.json(token || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Close/deactivate a token (when table is cleared)
router.put('/close/:tokenId', async (req, res) => {
    try {
        const token = await SessionToken.findByIdAndUpdate(
            req.params.tokenId,
            { isActive: false },
            { new: true }
        );

        if (token) {
            await Shop.updateOne(
                { _id: token.shopId, 'tables.tableNumber': token.tableNumber },
                { $set: { 'tables.$.status': 'idle' } }
            );
        }

        res.json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
