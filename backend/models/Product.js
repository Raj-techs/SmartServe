import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, default: 'General' },
    image: { type: String, default: '' },
    isVeg: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
