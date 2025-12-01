'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    user_fname: string;
    user_mname?: string;
    user_lname: string;
    user_department: number | { id: number; department_name: string };
    expiresAt?: number;
}

const API_BASE =
    process.env.NEXT_PUBLIC_DIRECTUS_URL?.replace(/\/$/, '') || 'http://100.126.246.124:8060';

export default function Header() {
    const [user, setUser] = useState<User | null>(null);
    const [departmentName, setDepartmentName] = useState<string>('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Load user + department
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);

        if (typeof parsedUser.user_department === 'object') {
            setDepartmentName(parsedUser.user_department.department_name);
        } else if (typeof parsedUser.user_department === 'number') {
            fetch(`${API_BASE}/items/department/${parsedUser.user_department}`)
                .then((res) => res.json())
                .then((data) => {
                    if (data?.data?.department_name) setDepartmentName(data.data.department_name);
                })
                .catch((err) => console.error('Failed to fetch department:', err));
        }
    }, []);

    // Session expiry watchdog
    useEffect(() => {
        const iv = setInterval(() => {
            const raw = localStorage.getItem('user');
            if (!raw) return;
            try {
                const session = JSON.parse(raw) as User;
                if (session.expiresAt && Date.now() > session.expiresAt) {
                    localStorage.removeItem('user');
                    document.cookie = 'user=; path=/; max-age=0;';
                    window.location.href = '/login';
                }
            } catch {
                /* ignore */
            }
        }, 10_000);
        return () => clearInterval(iv);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fullName = user
        ? `${user.user_fname} ${user.user_mname || ''} ${user.user_lname}`.replace(/\s+/g, ' ').trim()
        : '';

    const handleLogout = () => {
        localStorage.removeItem('user');
        router.push('/login');
    };

    const openSidebar = () => {
        window.dispatchEvent(new CustomEvent('toggle-sidebar'));
    };

    return (
        <header className="sticky top-0 z-50 border-b border-blue-200 bg-blue-50/90 backdrop-blur-md">
            <div className="mx-auto flex items-center gap-3 px-4 md:px-6 py-3">
                {/* Mobile menu */}
                <button
                    onClick={openSidebar}
                    className="lg:hidden px-3 py-2 rounded-md bg-white border border-blue-200 hover:bg-slate-50 outline-none focus:ring-2 ring-blue-500"
                    aria-label="Open sidebar"
                >
                    ☰
                </button>

                <h1 className="text-base md:text-lg font-semibold tracking-wide text-slate-800">
                    Procurement System
                </h1>

                <div className="ml-auto flex items-center gap-2">
                    {/* Search (visual) */}
                    <input
                        placeholder="Search…"
                        className="hidden md:block w-64 bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500 placeholder:text-slate-400"
                        aria-label="Search"
                    />

                    {/* Profile dropdown */}
                    {user ? (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setDropdownOpen((v) => !v)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white border border-blue-200 hover:bg-slate-50 outline-none focus:ring-2 ring-blue-500"
                                aria-expanded={dropdownOpen}
                                aria-haspopup="menu"
                            >
                                <div className="hidden sm:flex flex-col items-end text-right leading-tight">
                                    <span className="text-sm font-medium text-slate-800">{fullName}</span>
                                    <span className="text-[11px] text-slate-600">{departmentName}</span>
                                </div>
                                <img
                                    src="/profile-avatar.png"
                                    alt={`${fullName} avatar`}
                                    className="w-8 h-8 rounded-full border border-slate-300"
                                />
                            </button>

                            {dropdownOpen && (
                                <div
                                    role="menu"
                                    className="absolute right-0 mt-2 w-56 rounded-md border border-blue-200 bg-white shadow-lg p-2 z-50"
                                >
                                    <div className="px-3 py-2 border-b border-slate-200">
                                        <p className="text-sm font-medium text-slate-800">{fullName}</p>
                                        <p className="text-[11px] text-slate-600">{departmentName}</p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/settings')}
                                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-blue-50 outline-none focus:ring-2 ring-blue-500"
                                        role="menuitem"
                                    >
                                        ⚙️ Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-3 py-2 text-sm text-red-600 rounded hover:bg-red-50 outline-none focus:ring-2 ring-blue-500"
                                        role="menuitem"
                                    >
                                        🚪 Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-sm text-slate-600">Loading…</span>
                    )}
                </div>
            </div>
        </header>
    );
}
