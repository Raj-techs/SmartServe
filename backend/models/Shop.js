import mongoose from 'mongoose';

const tableConfigSchema = new mongoose.Schema({
    tableNumber: { type: String, required: true },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    shape: { type: String, enum: ['circle', 'rectangle'], default: 'rectangle' },
    seats: { type: Number, default: 4 },
    status: {
        type: String,
        enum: ['idle', 'active', 'ordered', 'preparing', 'served', 'payment_pending'],
        default: 'idle'
    }
});

const shopSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String },
    logo: { type: String }, // cloudinary url
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tables: [tableConfigSchema],
    isActive: { type: Boolean, default: true },
    commissionRate: { type: Number, default: 10 }
}, { timestamps: true });

export default mongoose.model('Shop', shopSchema);
