'use client';

import React, { useState } from 'react';
import { useProcurement } from '../provider/ProcurementProvider';

export default function ProcurementApproval() {
    const { selectedNo, master, approve, generatePO, refresh, details } = useProcurement();
    const [supplier_id, setSupplier] = useState<number>(0);
    const [busy, setBusy] = useState(false);
    const canApprove = !!selectedNo && master?.isApproved !== 1;
    const canGenPO = !!selectedNo && master?.isApproved === 1 && !master?.po_no;

    async function onApprove() {
        if (!selectedNo) return;
        setBusy(true);
        try {
            await approve(selectedNo);
            await refresh();
        } finally {
            setBusy(false);
        }
    }

    async function onGeneratePO() {
        if (!selectedNo || !supplier_id) return;
        setBusy(true);
        try {
            await generatePO({ procurement_no: selectedNo, supplier_id });
            await refresh();
            setSupplier(0);
        } finally {
            setBusy(false);
        }
    }

    const uniqueSuppliers = Array.from(
        new Set(details.map((d) => d.supplier).filter((s): s is number => !!s))
    );

    return (
        <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Approval & PO</h3>
                <div className="text-xs text-slate-500">
                    {selectedNo ? `Selected: ${selectedNo}` : 'No PR selected'}
                </div>
            </div>

            <div className="mt-4 grid gap-3">
                <button
                    disabled={!canApprove || busy}
                    onClick={onApprove}
                    className="rounded-xl px-4 py-2 bg-emerald-600 text-white disabled:opacity-50"
                >
                    {busy ? 'Working…' : 'Approve Procurement'}
                </button>

                <div className="rounded-xl border p-3 bg-slate-50">
                    <div className="text-sm font-medium mb-2">Generate Purchase Order</div>
                    <div className="flex flex-col md:flex-row gap-3">
                        <select
                            className="rounded-xl border px-3 py-2"
                            value={supplier_id || 0}
                            onChange={(e) => setSupplier(Number(e.target.value))}
                            disabled={!canGenPO || busy}
                            title="Select supplier (from details)"
                        >
                            <option value={0}>Select supplier</option>
                            {uniqueSuppliers.map((s) => (
                                <option key={s} value={s}>
                                    Supplier #{s}
                                </option>
                            ))}
                        </select>
                        <button
                            disabled={!canGenPO || !supplier_id || busy}
                            onClick={onGeneratePO}
                            className="rounded-xl px-4 py-2 bg-blue-600 text-white disabled:opacity-50"
                        >
                            {busy ? 'Generating…' : 'Create PO'}
                        </button>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                        • Only works once approved. • Supplier list comes from <b>procurement_details</b>.
                    </div>
                </div>
            </div>
        </div>
    );
}
