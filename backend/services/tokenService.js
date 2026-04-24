import SessionToken from '../models/SessionToken.js';

// Generate a random 6-digit PIN
export const generatePIN = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create a new token for a table
export const createToken = async (shopId, tableNumber) => {
    const pin = generatePIN();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

    const token = new SessionToken({
        shopId,
        tableNumber,
        pin,
        expiresAt,
        isActive: true,
        members: [],
    });

    await token.save();
    return token;
};

// Validate token entered by customer
export const validateToken = async (pin, shopId) => {
    const token = await SessionToken.findOne({
        pin,
        shopId,
        isActive: true,
        expiresAt: { $gt: new Date() },
    });

    if (!token) return { valid: false, message: 'Invalid or expired token' };
    return { valid: true, token };
};
