import express from 'express';
import { createToken, validateToken } from '../services/tokenService.js';
import SessionToken from '../models/SessionToken.js';
import Shop from '../models/Shop.js';

const router = express.Router();

// Customer joins a table directly (no PIN entry) — gets guestCode back
router.post('/join', async (req, res) => {
    try {
        const { shopId, tableNumber, username, people } = req.body;
        if (!shopId || !tableNumber || !username) return res.status(400).json({ error: 'Missing fields' });

        // Find active token for this table (owner must have activated it first)
        let token = await SessionToken.findOne({ shopId, tableNumber, isActive: true });

        // If no active token, auto-create one (table auto-activate)
        if (!token) {
            token = await createToken(shopId, tableNumber);
            await Shop.updateOne(
                { _id: shopId, 'tables.tableNumber': tableNumber },
                { $set: { 'tables.$.status': 'active' } }
            );
        }

        // Add member if not already joined
        const alreadyJoined = token.members.some(m => m.username === username);
        if (!alreadyJoined) {
            token.members.push({ username });
            // Add guest placeholders for extra people
            if (people && people > 1) {
                for (let i = 2; i <= people; i++) {
                    const guestName = `Guest_${username}_${i}`;
                    if (!token.members.some(m => m.username === guestName)) {
                        token.members.push({ username: guestName });
                    }
                }
            }
            await token.save();
        }

        // Return token info — pin acts as guestCode
        res.json({
            success: true,
            tokenId: token._id,
            guestCode: token.pin, // 6-digit code for rejoin
            tableNumber: token.tableNumber,
            shopId: token.shopId,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Rejoin via guest code (6-digit pin)
router.post('/rejoin', async (req, res) => {
    try {
        const { shopId, tableNumber, guestCode, username } = req.body;
        if (!shopId || !tableNumber || !guestCode) return res.status(400).json({ error: 'Missing fields' });
        const token = await SessionToken.findOne({ shopId, tableNumber, pin: guestCode, isActive: true });
        if (!token) return res.status(404).json({ error: 'Invalid or expired code. Ask staff for help.' });
        const alreadyJoined = token.members.some(m => m.username === username);
        if (username && !alreadyJoined) { token.members.push({ username }); await token.save(); }
        res.json({ success: true, tokenId: token._id, guestCode: token.pin, tableNumber: token.tableNumber, shopId: token.shopId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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

// Remove a single member from a token (customer leaves)
router.put('/leave/:tokenId/:username', async (req, res) => {
    try {
        const token = await SessionToken.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ error: 'Token not found' });
        token.members = token.members.filter(m => m.username !== req.params.username);
        // If no members left, close token
        if (token.members.length === 0) token.isActive = false;
        await token.save();
        res.json({ success: true, membersLeft: token.members.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
