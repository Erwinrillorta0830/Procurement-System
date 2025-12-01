'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`http://100.126.246.124:8060/items/user?filter[user_email][_eq]=${email}`);
            const data = await res.json();

            if (!data.data || data.data.length === 0) {
                setError('User not found');
                setLoading(false);
                return;
            }

            const user = data.data[0];
            if (user.user_password !== password) {
                setError('Incorrect password');
                setLoading(false);
                return;
            }

            // Save user to cookie & localStorage
            document.cookie = `user=${encodeURIComponent(
                JSON.stringify({
                    id: user.id,
                    email: user.user_email,
                    role: user.user_role || 'user',
                })
            )}; path=/; max-age=${60 * 60 * 24};`;

            localStorage.setItem('user', JSON.stringify(user));

            router.push('/app/dashboard');
        } catch (err) {
            console.error(err);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-semibold text-center text-gray-800 mb-2">
                    Welcome Back
                </h2>
                <p className="text-center text-gray-500 mb-8 text-sm">
                    Sign in to access the Procurement System
                </p>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            required
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2.5 rounded-lg font-medium text-white transition ${
                            loading
                                ? 'bg-blue-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                        }`}
                    >
                        {loading ? 'Signing in...' : 'Login'}
                    </button>
                </form>

                <div className="text-center mt-6 text-sm text-gray-500">
                    <p>
                        Forgot your password?{' '}
                        <a href="#" className="text-blue-600 hover:underline">
                            Reset it
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
