import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    username: { type: String, required: true },
    orderType: { type: String, enum: ['dine-in', 'parcel'], default: 'dine-in' },
    status: {
        type: String,
        enum: ['received', 'preparing', 'ready', 'served'],
        default: 'received'
    }
});

const orderSchema = new mongoose.Schema({
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    sessionTokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionToken', required: true },
    tableNumber: { type: String, required: true },
    items: [orderItemSchema],
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paymentMethod: { type: String, enum: ['cash', 'online', 'none'], default: 'none' },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
