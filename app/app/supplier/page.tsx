// app/suppliers/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API_ROOT =
    process.env.NEXT_PUBLIC_DIRECTUS_URL?.replace(/\/$/, '') || 'http://100.126.246.124:8060';
const API_BASE = `${API_ROOT}/items/suppliers`;

type Supplier = {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string;
    supplier_type?: string;
    contact_person?: string;
    phone_number?: string;
    email_address?: string;
    city?: string;
    state_province?: string;
    country?: string;
    isActive?: number | boolean;
    date_added?: string;
};

const PAGE_SIZE = 10;

export default function SuppliersPage() {
    const [items, setItems] = useState<Supplier[]>([]);
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

    async function fetchSuppliers() {
        try {
            setLoading(true);
            setErr(null);

            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                offset: String(offset),
                sort: '-date_added',
                'filter[supplier_type][_eq]': 'NON-TRADE',
            });
            if (q.trim()) params.set('search', q.trim());

            const res = await fetch(`${API_BASE}?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to fetch suppliers (${res.status})`);
            const json = await res.json();

            const data: Supplier[] = (json.data ?? []).filter(
                (s: Supplier) => (s.supplier_type ?? '').toUpperCase() === 'NON-TRADE',
            );

            setItems(data);
            setTotal(json?.meta?.total ?? data.length + offset);
        } catch (e: any) {
            setErr(e?.message || 'Failed to load suppliers');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchSuppliers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset]);

    const onSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        await fetchSuppliers();
    };

    return (
        <section className="p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Suppliers (Non-Trade)</h2>
                <div className="ml-auto flex items-center gap-2">
                    <form onSubmit={onSearch} className="flex items-center gap-2">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search non-trade suppliers…"
                            className="w-64 bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 ring-blue-500 placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white outline-none focus:ring-2 ring-blue-500"
                        >
                            Search
                        </button>
                    </form>
                    <Link
                        href="/app/supplier/create"
                        className="px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 outline-none focus:ring-2 ring-blue-500"
                    >
                        + New Supplier
                    </Link>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-blue-50 border-b border-blue-200">
                        <tr className="text-left text-slate-700">
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Shortcut</th>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {loading ? (
                            <tr><td className="px-4 py-4 text-slate-500" colSpan={8}>Loading…</td></tr>
                        ) : err ? (
                            <tr><td className="px-4 py-4 text-red-600" colSpan={8}>{err}</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td className="px-4 py-4 text-slate-500" colSpan={8}>No non-trade suppliers found.</td></tr>
                        ) : (
                            items.map((s) => {
                                const location = [s.city, s.state_province, s.country].filter(Boolean).join(', ');
                                const active =
                                    typeof s.isActive === 'boolean' ? s.isActive : Number(s.isActive) === 1;
                                return (
                                    <tr key={s.id} className="border-b last:border-b-0 hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {s.supplier_name}
                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 text-[11px]">
                          NON-TRADE
                        </span>
                                        </td>
                                        <td className="px-4 py-3">{s.supplier_shortcut || '—'}</td>
                                        <td className="px-4 py-3">{s.contact_person || '—'}</td>
                                        <td className="px-4 py-3">{s.phone_number || '—'}</td>
                                        <td className="px-4 py-3">{s.email_address || '—'}</td>
                                        <td className="px-4 py-3">{location || '—'}</td>
                                        <td className="px-4 py-3">
                        <span
                            className={[
                                'inline-flex items-center px-2 py-0.5 rounded-md text-xs border',
                                active
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-300',
                            ].join(' ')}
                        >
                          {active ? 'Active' : 'Inactive'}
                        </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-slate-400">—</span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                    <div className="text-sm text-slate-600">
                        Page <span className="font-medium">{page}</span> of{' '}
                        <span className="font-medium">{totalPages}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                            className="px-3 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 disabled:opacity-50 hover:bg-slate-100 outline-none focus:ring-2 ring-blue-500"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => setPage((p) => p + 1)}  // ✅ removed the extra ')'
                            disabled={loading || items.length < PAGE_SIZE}
                            className="px-3 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 disabled:opacity-50 hover:bg-slate-100 outline-none focus:ring-2 ring-blue-500"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
