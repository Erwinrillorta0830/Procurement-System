'use client';

import React from 'react';
import { useProcurement } from '../provider/ProcurementProvider';
import ProcurementModal from './ProcurementModal';

export default function ProcurementList() {
    const { groups, rows, selectedNo, setSelectedNo, loading, error } = useProcurement();

    // If your rows contain a header id, store it here when clicking "View".
    const [activeId, setActiveId] = React.useState<number | null>(null);
    const [modalOpen, setModalOpen] = React.useState(false);

    const openById = (id: number) => {
        setActiveId(id);
        setModalOpen(true);
    };
    const openByNo = (no: string) => {
        setActiveId(null);
        setSelectedNo(no);
        setModalOpen(true);
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Groups */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="px-4 py-3 border-b text-sm font-semibold">Requests (Grouped)</div>
                    <ul className="max-h-[420px] overflow-auto divide-y">
                        {groups.map((g) => (
                            <li
                                key={g.procurement_no}
                                className={`px-4 py-3 cursor-pointer hover:bg-slate-50 ${
                                    selectedNo === g.procurement_no ? 'bg-slate-50' : ''
                                }`}
                                onClick={() => setSelectedNo(g.procurement_no)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">{g.procurement_no}</div>
                                    <div className="text-xs text-slate-500">{g.total_items} items</div>
                                </div>
                                <div className="text-sm text-slate-600">₱ {g.total_estimate.toFixed(2)}</div>

                                <div className="mt-2">
                                    <button
                                        className="rounded-xl border px-3 py-1.5 text-xs"
                                        onClick={(e) => { e.stopPropagation(); openByNo(g.procurement_no); }}
                                    >
                                        View / Print
                                    </button>
                                </div>
                            </li>
                        ))}
                        {groups.length === 0 && (
                            <li className="px-4 py-6 text-sm text-slate-500">No records found.</li>
                        )}
                    </ul>
                </div>

                {/* Flat rows */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
                    <div className="px-4 py-3 border-b text-sm font-semibold">Items</div>
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left bg-slate-50">
                                <th className="p-3">PR No</th>
                                <th className="p-3">Item</th>
                                <th className="p-3">Qty</th>
                                <th className="p-3">Est. Cost</th>
                                <th className="p-3">Est. Total</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((r) => (
                                <tr
                                    key={r.pr_id}
                                    className="border-t hover:bg-slate-50"
                                    onClick={() => setSelectedNo(r.procurement_no)}
                                >
                                    <td className="p-3 font-medium">{r.procurement_no}</td>
                                    <td className="p-3">{r.item_description}</td>
                                    <td className="p-3">{r.quantity}</td>
                                    <td className="p-3">₱ {Number(r.estimated_cost).toFixed(2)}</td>
                                    <td className="p-3">₱ {Number(r.estimated_total).toFixed(2)}</td>
                                    <td className="p-3">{r.status}</td>
                                    <td className="p-3">
                                        <div className="flex justify-end">
                                            {/* If you have header id on each row, e.g. r.procurement_id, use openById(r.procurement_id) */}
                                            <button
                                                className="rounded-xl border px-3 py-1.5"
                                                onClick={(e) => { e.stopPropagation(); openByNo(r.procurement_no); }}
                                                title="View / Print"
                                            >
                                                View / Print
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-6 text-center text-slate-500">
                                        No items.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                    {(loading || error) && (
                        <div className="px-4 py-3 border-t text-sm">
                            {loading ? 'Loading…' : <span className="text-rose-600">{error}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal (prefers id; if null, uses selectedNo) */}
            <ProcurementModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                id={activeId}
                procurementNo={activeId ? null : (selectedNo || null)}
            />
        </>
    );
}
