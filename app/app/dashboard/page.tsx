// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_ROOT =
    process.env.NEXT_PUBLIC_DIRECTUS_URL?.replace(/\/$/, '') || 'http://100.126.246.124:8060';

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

export default function DashboardPage() {
    const [nonTradeCount, setNonTradeCount] = useState<number | null>(null);
    const [recentSuppliers, setRecentSuppliers] = useState<Supplier[]>([]);
    const [procurementsCount, setProcurementsCount] = useState<number | null>(null);
    const [itemsCount, setItemsCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                // Non-Trade suppliers count
                const nonTrade = await fetch(
                    `${API_ROOT}/items/suppliers?` +
                    new URLSearchParams({
                        'filter[supplier_type][_eq]': 'NON-TRADE',
                        limit: '0',
                        meta: 'total_count',
                    }),
                    { cache: 'no-store' }
                );
                if (nonTrade.ok) {
                    const j = await nonTrade.json();
                    if (!cancelled) setNonTradeCount(j?.meta?.total_count ?? 0);
                }

                // Recent non-trade suppliers (last 5)
                const recent = await fetch(
                    `${API_ROOT}/items/suppliers?` +
                    new URLSearchParams({
                        'filter[supplier_type][_eq]': 'NON-TRADE',
                        sort: '-date_added',
                        limit: '5',
                    }),
                    { cache: 'no-store' }
                );
                if (recent.ok) {
                    const j = await recent.json();
                    if (!cancelled) setRecentSuppliers(j?.data ?? []);
                }

                // Optional: counts for procurements & items (if collections exist)
                try {
                    const pr = await fetch(
                        `${API_ROOT}/items/procurement?` + new URLSearchParams({ limit: '0', meta: 'total_count' }),
                        { cache: 'no-store' }
                    );
                    if (pr.ok) {
                        const j = await pr.json();
                        if (!cancelled) setProcurementsCount(j?.meta?.total_count ?? 0);
                    }
                } catch {}

                try {
                    const it = await fetch(
                        `${API_ROOT}/items/items?` + new URLSearchParams({ limit: '0', meta: 'total_count' }),
                        { cache: 'no-store' }
                    );
                    if (it.ok) {
                        const j = await it.json();
                        if (!cancelled) setItemsCount(j?.meta?.total_count ?? 0);
                    }
                } catch {}
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <section className="p-4 md:p-6">
            {/* Title + quick actions */}
            <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
                <div className="ml-auto flex items-center gap-2">
                    <Link
                        href="/app/procurement/create"
                        className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white outline-none focus:ring-2 ring-blue-500"
                    >
                        + New Procurement
                    </Link>
                    <Link
                        href="/app/supplier/create"
                        className="px-3 py-2 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 outline-none focus:ring-2 ring-blue-500"
                    >
                        + New Supplier
                    </Link>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Kpi
                    label="Non-Trade Suppliers"
                    value={loading ? '—' : nonTradeCount ?? '—'}
                    hint="Suppliers used for procurement"
                />
                <Kpi
                    label="Procurements"
                    value={loading ? '—' : procurementsCount ?? '—'}
                    hint="All procurement records"
                />
                <Kpi
                    label="Items"
                    value={loading ? '—' : itemsCount ?? '—'}
                    hint="Total items in catalog"
                />
            </div>

            {/* Two-column layout: recent + shortcuts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-blue-50">
                        <h3 className="font-medium text-slate-800">Recent Non-Trade Suppliers</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
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
                                recentSuppliers.map((s) => (
                                    <tr key={s.id} className="border-b last:border-b-0 hover:bg-slate-50">
                                        <td className="px-4 py-2 font-medium text-slate-800">{s.supplier_name}</td>
                                        <td className="px-4 py-2">{s.supplier_shortcut || '—'}</td>
                                        <td className="px-4 py-2">{s.contact_person || '—'}</td>
                                        <td className="px-4 py-2">
                                            {[s.city, s.state_province, s.country].filter(Boolean).join(', ') || '—'}
                                        </td>
                                        <td className="px-4 py-2">
                                            {s.date_added ? new Date(s.date_added).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-right">
                        <Link
                            href="/app/supplier"
                            className="inline-flex items-center px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 outline-none focus:ring-2 ring-blue-500"
                        >
                            View all suppliers →
                        </Link>
                    </div>
                </div>

                {/* Quick shortcuts / “what’s next” */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="font-medium text-slate-800 mb-3">Quick Actions</h3>
                    <div className="grid gap-2">
                        <Link
                            href="/app/procurement"
                            className="px-3 py-2 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 outline-none focus:ring-2 ring-blue-500"
                        >
                            Go to Procurements
                        </Link>
                        <Link
                            href="/app/procurement/create"
                            className="px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 outline-none focus:ring-2 ring-blue-500"
                        >
                            Create Procurement
                        </Link>
                        <Link
                            href="/app/supplier/create"
                            className="px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 outline-none focus:ring-2 ring-blue-500"
                        >
                            Add Supplier
                        </Link>
                        <Link
                            href="/app/items"
                            className="px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 outline-none focus:ring-2 ring-blue-500"
                        >
                            View Items
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

/** Small presentational KPI card */
function Kpi({ label, value, hint }: { label: string; value: number | string | null; hint?: string }) {
    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm text-slate-600">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{value ?? '—'}</div>
            {hint ? <div className="text-xs text-slate-500 mt-1">{hint}</div> : null}
        </div>
    );
}
