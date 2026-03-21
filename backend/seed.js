// Run once: node seed.js
// Creates superadmin account for you to log in
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const UserSchema = new mongoose.Schema({
    name: String, email: String, password: String, role: String, shopId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Remove existing superadmin if any
    await User.deleteOne({ email: 'admin@smartserve.com' });

    const hashed = await bcrypt.hash('admin123', 10);
    await User.create({ name: 'Super Admin', email: 'admin@smartserve.com', password: hashed, role: 'superadmin' });

    console.log('✅ Superadmin created:');
    console.log('   Email:    admin@smartserve.com');
    console.log('   Password: admin123');
    console.log('   Role:     superadmin');

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
