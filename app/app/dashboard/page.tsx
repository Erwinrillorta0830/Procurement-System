"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Supplier = {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string;
    contact_person?: string;
    city?: string;
    state_province?: string;
    country?: string;
    date_added?: string;
};

type DirectusListResponse<T> = {
    data?: T[];
    meta?: {
        total_count?: number;
    };
};

async function fetchDirectusList<T>(
    path: string,
    params?: Record<string, string>
): Promise<DirectusListResponse<T>> {
    const search = new URLSearchParams(params ?? {});
    const url = `/api/items/${path}${search.toString() ? `?${search.toString()}` : ""}`;

    const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
    }

    const json: unknown = await res.json();
    return (json as DirectusListResponse<T>) ?? {};
}

export default function DashboardPage() {
    const [nonTradeCount, setNonTradeCount] = useState<number | null>(null);
    const [recentSuppliers, setRecentSuppliers] = useState<Supplier[]>([]);
    const [procurementsCount, setProcurementsCount] = useState<number | null>(null);
    const [itemsCount, setItemsCount] = useState<number | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;

        const load = async (): Promise<void> => {
            setLoading(true);

            try {
                const nonTradePromise = fetchDirectusList<Supplier>("suppliers", {
                    "filter[supplier_type][_eq]": "NON-TRADE",
                    limit: "0",
                    meta: "total_count",
                });

                const recentPromise = fetchDirectusList<Supplier>("suppliers", {
                    "filter[supplier_type][_eq]": "NON-TRADE",
                    sort: "-date_added",
                    limit: "5",
                });

                const procurementsPromise = fetchDirectusList<Record<string, unknown>>(
                    "procurement",
                    {
                        limit: "0",
                        meta: "total_count",
                    }
                ).catch(() => ({ meta: { total_count: 0 } }));

                const itemsPromise = fetchDirectusList<Record<string, unknown>>("items", {
                    limit: "0",
                    meta: "total_count",
                }).catch(() => ({ meta: { total_count: 0 } }));

                const [nonTrade, recent, procurements, items] = await Promise.all([
                    nonTradePromise,
                    recentPromise,
                    procurementsPromise,
                    itemsPromise,
                ]);

                if (cancelled) return;

                setNonTradeCount(nonTrade.meta?.total_count ?? 0);
                setRecentSuppliers(Array.isArray(recent.data) ? recent.data : []);
                setProcurementsCount(procurements.meta?.total_count ?? 0);
                setItemsCount(items.meta?.total_count ?? 0);
            } catch (error: unknown) {
                console.error("Failed to load dashboard data:", error);

                if (cancelled) return;

                setNonTradeCount(0);
                setRecentSuppliers([]);
                setProcurementsCount(0);
                setItemsCount(0);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <section className="p-4 md:p-6">
            <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>

                <div className="ml-auto flex items-center gap-2">
                    <Link
                        href="/app/procurement/create"
                        className="rounded-md bg-blue-600 px-3 py-2 text-white outline-none hover:bg-blue-700 focus:ring-2 ring-blue-500"
                    >
                        + New Procurement
                    </Link>
                    <Link
                        href="/app/supplier/create"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none hover:bg-slate-100 focus:ring-2 ring-blue-500"
                    >
                        + New Supplier
                    </Link>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Kpi
                    label="Non-Trade Suppliers"
                    value={loading ? "—" : nonTradeCount ?? "—"}
                    hint="Suppliers used for procurement"
                />
                <Kpi
                    label="Procurements"
                    value={loading ? "—" : procurementsCount ?? "—"}
                    hint="All procurement records"
                />
                <Kpi
                    label="Items"
                    value={loading ? "—" : itemsCount ?? "—"}
                    hint="Total items in catalog"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-2">
                    <div className="border-b border-slate-200 bg-blue-50 px-4 py-3">
                        <h3 className="font-medium text-slate-800">
                            Recent Non-Trade Suppliers
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-left text-slate-700">
                                <th className="px-4 py-2">Name</th>
                                <th className="px-4 py-2">Shortcut</th>
                                <th className="px-4 py-2">Contact</th>
                                <th className="px-4 py-2">Location</th>
                                <th className="px-4 py-2">Date Added</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                                        Loading…
                                    </td>
                                </tr>
                            ) : recentSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                                        No recent suppliers.
                                    </td>
                                </tr>
                            ) : (
                                recentSuppliers.map((supplier) => (
                                    <tr
                                        key={supplier.id}
                                        className="border-b hover:bg-slate-50 last:border-b-0"
                                    >
                                        <td className="px-4 py-2 font-medium text-slate-800">
                                            {supplier.supplier_name}
                                        </td>
                                        <td className="px-4 py-2">
                                            {supplier.supplier_shortcut || "—"}
                                        </td>
                                        <td className="px-4 py-2">
                                            {supplier.contact_person || "—"}
                                        </td>
                                        <td className="px-4 py-2">
                                            {[
                                                supplier.city,
                                                supplier.state_province,
                                                supplier.country,
                                            ]
                                                .filter(Boolean)
                                                .join(", ") || "—"}
                                        </td>
                                        <td className="px-4 py-2">
                                            {supplier.date_added
                                                ? new Date(
                                                    supplier.date_added
                                                ).toLocaleDateString()
                                                : "—"}
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-right">
                        <Link
                            href="/app/supplier"
                            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-800 outline-none hover:bg-slate-100 focus:ring-2 ring-blue-500"
                        >
                            View all suppliers →
                        </Link>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 font-medium text-slate-800">Quick Actions</h3>

                    <div className="grid gap-2">
                        <Link
                            href="/app/procurement"
                            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800 outline-none hover:bg-blue-100 focus:ring-2 ring-blue-500"
                        >
                            Go to Procurements
                        </Link>
                        <Link
                            href="/app/procurement/create"
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none hover:bg-slate-100 focus:ring-2 ring-blue-500"
                        >
                            Create Procurement
                        </Link>
                        <Link
                            href="/app/supplier/create"
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none hover:bg-slate-100 focus:ring-2 ring-blue-500"
                        >
                            Add Supplier
                        </Link>
                        <Link
                            href="/app/items"
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none hover:bg-slate-100 focus:ring-2 ring-blue-500"
                        >
                            View Items
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Kpi({
                 label,
                 value,
                 hint,
             }: {
    label: string;
    value: number | string | null;
    hint?: string;
}) {
    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm text-slate-600">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
                {value ?? "—"}
            </div>
            {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </div>
    );
}