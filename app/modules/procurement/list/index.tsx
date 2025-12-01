'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { listProcurements, Procurement, listSuppliers } from '../api/procurement';
import type { Supplier } from '../api/procurement';
import ProcurementModal from '../components/ProcurementModal';

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-200 text-slate-700',
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-rose-100 text-rose-800',
    cancelled: 'bg-gray-200 text-gray-700',
};

export default function ProcurementListPage() {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'all'|'draft'|'pending'|'approved'|'rejected'|'cancelled'>('all');
    const [rows, setRows] = useState<Procurement[]>([]);
    const [suppliers, setSuppliers] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string>('');

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [activePRNo, setActivePRNo] = useState<string | null>(null);

    async function load() {
        setLoading(true); setErr('');
        try {
            const [procurements, suppliersData] = await Promise.all([
                listProcurements({ search, status }),
                listSuppliers()
            ]);

            const supplierMap: Record<number, string> = {};
            for (const s of suppliersData as Supplier[]) supplierMap[s.id] = s.supplier_name;

            setSuppliers(supplierMap);
            setRows(procurements);
        } catch (e: any) {
            setErr(e?.message ?? 'Failed to load');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [search, status]);

    const totalSum = useMemo(
        () => rows.reduce((a,b)=> a + Number(b.total_amount || 0), 0),
        [rows]
    );

    const openModalById = (id: number) => {
        setActiveId(id);
        setActivePRNo(null);
        setModalOpen(true);
    };
    const openModalByPRNo = (no: string) => {
        setActiveId(null);
        setActivePRNo(no);
        setModalOpen(true);
    };

    return (
        <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="text-2xl font-semibold">Procurements</div>
                <div className="flex gap-2">
                    <input
                        className="rounded-xl border px-3 py-2 w-64"
                        placeholder="Search (no/type/status)…"
                        value={search}
                        onChange={(e)=> setSearch(e.target.value)}
                    />
                    <select
                        className="rounded-xl border px-3 py-2"
                        value={status}
                        onChange={(e)=> setStatus(e.target.value as any)}
                    >
                        <option value="all">All</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <a href="/app/procurement/create" className="rounded-xl px-4 py-2 bg-blue-600 text-white">
                        New Procurement
                    </a>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b text-sm text-slate-600">
                    Total amount: <b>₱ {totalSum.toFixed(2)}</b> · Count: <b>{rows.length}</b>
                </div>
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-slate-50 text-left">
                            <th className="p-3">PR No</th>
                            <th className="p-3">Supplier</th>
                            <th className="p-3">Lead Date</th>
                            <th className="p-3">Total</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Approved</th>
                            <th className="p-3">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map(r => (
                            <tr key={r.id} className="border-t">
                                <td className="p-3 font-medium">{r.procurement_no}</td>
                                <td className="p-3">{suppliers[r.supplier_id] ?? `#${r.supplier_id}`}</td>
                                <td className="p-3">{r.lead_date ?? '—'}</td>
                                <td className="p-3">₱ {Number(r.total_amount || 0).toFixed(2)}</td>
                                <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[r.status || 'pending'] || 'bg-slate-200'}`}>
                      {r.status}
                    </span>
                                </td>
                                <td className="p-3">{r.isApproved ? 'Yes' : 'No'}</td>
                                <td className="p-3">
                                    <div className="flex gap-2">
                                        <button
                                            className="px-2 py-1 rounded border"
                                            onClick={() => openModalById(r.id)}
                                            title="View / Print"
                                        >
                                            View / Print
                                        </button>
                                        {/* If you ever need to open by PR No:
                      <button className="px-2 py-1 rounded border" onClick={() => openModalByPRNo(r.procurement_no)}>
                        View by PR No
                      </button>
                      */}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-6 text-center text-slate-500">
                                    {loading ? 'Loading…' : (err || 'No records found.')}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal (export-safe) */}
            <ProcurementModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                id={activeId ?? undefined}
                procurementNo={activePRNo ?? undefined}
            />
        </div>
    );
}
