"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DepartmentObject {
    id: number;
    department_name: string;
}

interface User {
    user_fname: string;
    user_mname?: string;
    user_lname: string;
    user_department: number | DepartmentObject;
    expiresAt?: number;
}

interface DepartmentResponse {
    data?: {
        department_name?: string;
    };
}

function isDepartmentObject(value: unknown): value is DepartmentObject {
    if (typeof value !== "object" || value === null) return false;

    const record = value as Record<string, unknown>;
    return (
        typeof record.id === "number" &&
        typeof record.department_name === "string"
    );
}

function parseStoredUser(raw: string | null): User | null {
    if (!raw) return null;

    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;

        const record = parsed as Record<string, unknown>;

        if (
            typeof record.user_fname !== "string" ||
            typeof record.user_lname !== "string"
        ) {
            return null;
        }

        const userDepartment = record.user_department;
        const normalizedDepartment =
            typeof userDepartment === "number" || isDepartmentObject(userDepartment)
                ? userDepartment
                : 0;

        return {
            user_fname: record.user_fname,
            user_mname:
                typeof record.user_mname === "string" ? record.user_mname : undefined,
            user_lname: record.user_lname,
            user_department: normalizedDepartment,
            expiresAt:
                typeof record.expiresAt === "number" ? record.expiresAt : undefined,
        };
    } catch {
        return null;
    }
}

export default function Header() {
    const [user, setUser] = useState<User | null>(null);
    const [departmentName, setDepartmentName] = useState<string>("");
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;

        const storedUser = localStorage.getItem("user");
        const parsedUser = parseStoredUser(storedUser);

        if (!parsedUser) return;

        setUser(parsedUser);

        const loadDepartment = async (): Promise<void> => {
            if (isDepartmentObject(parsedUser.user_department)) {
                if (mounted) {
                    setDepartmentName(parsedUser.user_department.department_name);
                }
                return;
            }

            if (
                typeof parsedUser.user_department !== "number" ||
                parsedUser.user_department <= 0
            ) {
                if (mounted) {
                    setDepartmentName("");
                }
                return;
            }

            try {
                const res = await fetch(
                    `/api/items/department/${parsedUser.user_department}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                if (!res.ok) {
                    throw new Error(`Failed to fetch department: ${res.status}`);
                }

                const json: unknown = await res.json();

                if (!mounted) return;

                const payload = json as DepartmentResponse;
                setDepartmentName(payload.data?.department_name ?? "");
            } catch (error: unknown) {
                console.error("Failed to fetch department:", error);
                if (mounted) {
                    setDepartmentName("");
                }
            }
        };

        void loadDepartment();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            const session = parseStoredUser(localStorage.getItem("user"));
            if (!session) return;

            if (session.expiresAt && Date.now() > session.expiresAt) {
                localStorage.removeItem("user");
                document.cookie = "user=; path=/; max-age=0;";
                window.location.href = "/login";
            }
        }, 10_000);

        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const fullName = useMemo(() => {
        if (!user) return "";

        return `${user.user_fname} ${user.user_mname ?? ""} ${user.user_lname}`
            .replace(/\s+/g, " ")
            .trim();
    }, [user]);

    const handleLogout = (): void => {
        localStorage.removeItem("user");
        document.cookie = "user=; path=/; max-age=0;";
        router.push("/login");
    };

    const openSidebar = (): void => {
        window.dispatchEvent(new CustomEvent("toggle-sidebar"));
    };

    return (
        <header className="sticky top-0 z-50 border-b border-blue-200 bg-blue-50/90 backdrop-blur-md">
            <div className="mx-auto flex items-center gap-3 px-4 py-3 md:px-6">
                <button
                    onClick={openSidebar}
                    className="rounded-md border border-blue-200 bg-white px-3 py-2 outline-none hover:bg-slate-50 focus:ring-2 ring-blue-500 lg:hidden"
                    aria-label="Open sidebar"
                    type="button"
                >
                    ☰
                </button>

                <h1 className="text-base font-semibold tracking-wide text-slate-800 md:text-lg">
                    Procurement System
                </h1>

                <div className="ml-auto flex items-center gap-2">
                    <input
                        placeholder="Search…"
                        className="hidden w-64 rounded-md border border-slate-300 bg-white px-3 py-2 outline-none placeholder:text-slate-400 focus:ring-2 ring-blue-500 md:block"
                        aria-label="Search"
                    />

                    {user ? (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setDropdownOpen((prev) => !prev)}
                                className="flex items-center gap-2 rounded-md border border-blue-200 bg-white px-2 py-1.5 outline-none hover:bg-slate-50 focus:ring-2 ring-blue-500"
                                aria-expanded={dropdownOpen}
                                aria-haspopup="menu"
                                type="button"
                            >
                                <div className="hidden flex-col items-end text-right leading-tight sm:flex">
                                    <span className="text-sm font-medium text-slate-800">
                                        {fullName}
                                    </span>
                                    <span className="text-[11px] text-slate-600">
                                        {departmentName}
                                    </span>
                                </div>
                                <img
                                    src="/profile-avatar.png"
                                    alt={`${fullName} avatar`}
                                    className="h-8 w-8 rounded-full border border-slate-300"
                                />
                            </button>

                            {dropdownOpen && (
                                <div
                                    role="menu"
                                    className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-blue-200 bg-white p-2 shadow-lg"
                                >
                                    <div className="border-b border-slate-200 px-3 py-2">
                                        <p className="text-sm font-medium text-slate-800">
                                            {fullName}
                                        </p>
                                        <p className="text-[11px] text-slate-600">
                                            {departmentName}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => router.push("/settings")}
                                        className="w-full rounded px-3 py-2 text-left text-sm outline-none hover:bg-blue-50 focus:ring-2 ring-blue-500"
                                        role="menuitem"
                                        type="button"
                                    >
                                        ⚙️ Settings
                                    </button>

                                    <button
                                        onClick={handleLogout}
                                        className="w-full rounded px-3 py-2 text-left text-sm text-red-600 outline-none hover:bg-red-50 focus:ring-2 ring-blue-500"
                                        role="menuitem"
                                        type="button"
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