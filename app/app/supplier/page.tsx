'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

type DirectusListResponse<T> = {
    data?: T[];
    meta?: {
        total?: number;
        total_count?: number;
        filter_count?: number;
    };
};

const PAGE_SIZE = 10;

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export default function SuppliersPage() {
    const [items, setItems] = useState<Supplier[]>([]);
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
        [total]
    );

    async function fetchSuppliers(): Promise<void> {
        try {
            setLoading(true);
            setErr(null);

            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                offset: String(offset),
                sort: '-date_added',
                'filter[supplier_type][_eq]': 'NON-TRADE',
                meta: 'filter_count',
            });

            if (q.trim()) {
                params.set('search', q.trim());
            }

            const response = await fetch(`/api/items/suppliers?${params.toString()}`, {
                method: 'GET',
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch suppliers (${response.status})`);
            }

            const json = (await response.json()) as DirectusListResponse<Supplier>;

            const data = (json.data ?? []).filter(
                (supplier) =>
                    String(supplier.supplier_type ?? '').toUpperCase() === 'NON-TRADE'
            );

            setItems(data);

            const resolvedTotal =
                json.meta?.filter_count ??
                json.meta?.total_count ??
                json.meta?.total ??
                data.length + offset;

            setTotal(resolvedTotal);
        } catch (error: unknown) {
            setErr(getErrorMessage(error, 'Failed to load suppliers'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void fetchSuppliers();
    }, [offset]);

    const onSearch = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        if (page !== 1) {
            setPage(1);
            return;
        }

        await fetchSuppliers();
    };

    return (
        <section className="p-4 md:p-6">
            <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-800">
                    Suppliers (Non-Trade)
                </h2>

                <div className="ml-auto flex items-center gap-2">
                    <form onSubmit={onSearch} className="flex items-center gap-2">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search non-trade suppliers…"
                            className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 outline-none placeholder:text-slate-400 focus:ring-2 ring-blue-500"
                        />
                        <button
                            type="submit"
                            className="rounded-md bg-blue-600 px-3 py-2 text-white outline-none hover:bg-blue-700 focus:ring-2 ring-blue-500"
                        >
                            Search
                        </button>
                    </form>

                    <Link
                        href="/app/supplier/create"
                        className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-800 outline-none hover:bg-slate-200 focus:ring-2 ring-blue-500"
                    >
                        + New Supplier
                    </Link>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-blue-200 bg-blue-50">
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
                            <tr>
                                <td className="px-4 py-4 text-slate-500" colSpan={8}>
                                    Loading…
                                </td>
                            </tr>
                        ) : err ? (
                            <tr>
                                <td className="px-4 py-4 text-red-600" colSpan={8}>
                                    {err}
                                </td>
                            </tr>
                        ) : items.length === 0 ? (
                            <tr>
                                <td className="px-4 py-4 text-slate-500" colSpan={8}>
                                    No non-trade suppliers found.
                                </td>
                            </tr>
                        ) : (
                            items.map((supplier) => {
                                const location = [
                                    supplier.city,
                                    supplier.state_province,
                                    supplier.country,
                                ]
                                    .filter(Boolean)
                                    .join(', ');

                                const active =
                                    typeof supplier.isActive === 'boolean'
                                        ? supplier.isActive
                                        : Number(supplier.isActive) === 1;

                                return (
                                    <tr
                                        key={supplier.id}
                                        className="border-b hover:bg-slate-50 last:border-b-0"
                                    >
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {supplier.supplier_name}
                                            <span className="ml-2 inline-flex items-center rounded border border-blue-200 bg-blue-100 px-1.5 py-0.5 text-[11px] text-blue-800">
                                                    NON-TRADE
                                                </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {supplier.supplier_shortcut || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {supplier.contact_person || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {supplier.phone_number || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {supplier.email_address || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {location || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                                <span
                                                    className={[
                                                        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs',
                                                        active
                                                            ? 'border-green-200 bg-green-50 text-green-700'
                                                            : 'border-slate-300 bg-slate-100 text-slate-700',
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

                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm text-slate-600">
                        Page <span className="font-medium">{page}</span> of{' '}
                        <span className="font-medium">{totalPages}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1 || loading}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 outline-none hover:bg-slate-100 focus:ring-2 ring-blue-500 disabled:opacity-50"
                            type="button"
                        >
                            Prev
                        </button>

                        <button
                            onClick={() =>
                                setPage((prev) => Math.min(totalPages, prev + 1))
                            }
                            disabled={loading || page >= totalPages}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 outline-none hover:bg-slate-100 focus:ring-2 ring-blue-500 disabled:opacity-50"
                            type="button"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}