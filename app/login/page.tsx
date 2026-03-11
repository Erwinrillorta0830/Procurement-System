"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginUser = {
    id?: number;
    user_id?: number;
    user_email?: string;
    user_password?: string;
    user_role?: string;
};

type DirectusListResponse<T> = {
    data?: T[];
};

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (
        e: React.FormEvent<HTMLFormElement>
    ): Promise<void> => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const params = new URLSearchParams({
                "filter[user_email][_eq]": email,
                limit: "1",
            });

            const response = await fetch(`/api/items/user?${params.toString()}`, {
                method: "GET",
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error(`Login request failed (${response.status})`);
            }

            const json = (await response.json()) as DirectusListResponse<LoginUser>;
            const users = Array.isArray(json.data) ? json.data : [];

            if (users.length === 0) {
                setError("User not found");
                return;
            }

            const user = users[0];

            if ((user.user_password ?? "") !== password) {
                setError("Incorrect password");
                return;
            }

            const cookiePayload = {
                id: user.id ?? user.user_id ?? null,
                email: user.user_email ?? "",
                role: user.user_role || "user",
            };

            document.cookie = `user=${encodeURIComponent(
                JSON.stringify(cookiePayload)
            )}; path=/; max-age=${60 * 60 * 24};`;

            localStorage.setItem("user", JSON.stringify(user));

            router.push("/app/dashboard");
        } catch (err: unknown) {
            console.error(err);
            setError(getErrorMessage(err, "Something went wrong. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-white">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
                <h2 className="mb-2 text-center text-2xl font-semibold text-gray-800">
                    Welcome Back
                </h2>
                <p className="mb-8 text-center text-sm text-gray-500">
                    Sign in to access the Procurement System
                </p>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-center text-sm text-red-500">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full rounded-lg py-2.5 font-medium text-white transition ${
                            loading
                                ? "cursor-not-allowed bg-blue-400"
                                : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
                        }`}
                    >
                        {loading ? "Signing in..." : "Login"}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>
                        Forgot your password?{" "}
                        <a href="#" className="text-blue-600 hover:underline">
                            Reset it
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}