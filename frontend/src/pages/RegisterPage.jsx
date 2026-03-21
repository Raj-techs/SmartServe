import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChefHat, Mail, Lock, User, Store } from 'lucide-react';
import { registerAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIES = ['Restaurant', 'Cafe', 'Juice Shop', 'Fast Food', 'Dhaba', 'Bakery', 'Other'];

export default function RegisterPage() {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ name: '', email: '', password: '', shopName: '', shopCategory: 'Restaurant' });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await registerAPI({ name: form.name, email: form.email, password: form.password });
            login(data.token, data.user);
            toast.success('Account created! Set up your shop now.');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg">
                        <ChefHat className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Create Account</h1>
                    <p className="text-slate-500 mt-1">Step {step} of 2</p>
                    <div className="flex gap-2 justify-center mt-3">
                        {[1, 2].map(s => (
                            <div key={s} className={`h-2 rounded-full transition-all ${s <= step ? 'bg-orange-500 w-12' : 'bg-slate-200 w-6'}`} />
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl p-8">
                    <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleRegister} className="space-y-5">
                        {step === 1 && (
                            <>
                                <Field icon={<User />} label="Your Name" type="text" value={form.name} onChange={v => f('name', v)} placeholder="Rajesh Kumar" />
                                <Field icon={<Mail />} label="Email" type="email" value={form.email} onChange={v => f('email', v)} placeholder="owner@shop.com" />
                                <Field icon={<Lock />} label="Password" type="password" value={form.password} onChange={v => f('password', v)} placeholder="Min 6 characters" />
                            </>
                        )}
                        {step === 2 && (
                            <>
                                <Field icon={<Store />} label="Shop Name" type="text" value={form.shopName} onChange={v => f('shopName', v)} placeholder="Rajesh Biryani House" />
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Shop Category</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {CATEGORIES.map(c => (
                                            <button key={c} type="button" onClick={() => f('shopCategory', c)}
                                                className={`py-2 px-3 rounded-xl text-sm font-medium border-2 transition ${form.shopCategory === c ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-200 text-slate-600 hover:border-orange-300'}`}>
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                        <button type="submit" disabled={loading}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-orange-200 disabled:opacity-60">
                            {step === 1 ? 'Continue →' : loading ? 'Creating...' : 'Create Account'}
                        </button>
                        {step === 2 && (
                            <button type="button" onClick={() => setStep(1)} className="w-full text-slate-500 text-sm font-medium hover:text-slate-700">
                                ← Back
                            </button>
                        )}
                    </form>
                    <p className="text-center text-slate-500 mt-6 text-sm">
                        Already have an account? <Link to="/login" className="text-orange-500 font-semibold hover:underline">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

function Field({ icon, label, type, value, onChange, placeholder }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400">{icon}</span>
                <input type={type} required value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition text-slate-800" />
            </div>
        </div>
    );
}
