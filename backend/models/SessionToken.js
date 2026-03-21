import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
    username: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
});

const sessionTokenSchema = new mongoose.Schema({
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    tableNumber: { type: String, required: true },
    pin: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    members: [memberSchema],
    expiresAt: { type: Date, required: true },
    startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('SessionToken', sessionTokenSchema);
