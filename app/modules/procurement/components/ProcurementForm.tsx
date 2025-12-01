'use client';

import React, { useState } from 'react';
import { useProcurement } from '../provider/ProcurementProvider';

export default function ProcurementForm() {
    const { create, loading, setSearch, search } = useProcurement();

    const [item_description, setItem] = useState('');
    const [quantity, setQty] = useState<number>(1);
    const [estimated_cost, setCost] = useState<number>(0);
    const [purpose_text, setPurpose] = useState('');
    const [lead_date, setLeadDate] = useState<string>('');

    const estimated_total = Number(quantity || 0) * Number(estimated_cost || 0);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!item_description || !quantity || !estimated_cost) return;

        await create({
            item_description,
            quantity: Number(quantity),
            estimated_cost: Number(estimated_cost),
            purpose_text,
            lead_date: lead_date || undefined,
            status: 'Submitted',
        });

        setItem('');
        setQty(1);
        setCost(0);
        setPurpose('');
        setLeadDate('');
    }

    return (
        <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                {/* Search */}
                <input
                    className="w-full md:max-w-sm rounded-xl border px-3 py-2"
                    placeholder="Search (PR No. or Item)…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                {/* Quick Create */}
                <form onSubmit={onSubmit} className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input
                        className="rounded-xl border px-3 py-2 md:col-span-2"
                        placeholder="Item description"
                        value={item_description}
                        onChange={(e) => setItem(e.target.value)}
                        required
                    />
                    <input
                        type="number"
                        min={1}
                        className="rounded-xl border px-3 py-2"
                        placeholder="Qty"
                        value={quantity}
                        onChange={(e) => setQty(Number(e.target.value))}
                        required
                    />
                    <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="rounded-xl border px-3 py-2"
                        placeholder="Estimated Cost"
                        value={estimated_cost}
                        onChange={(e) => setCost(Number(e.target.value))}
                        required
                    />
                    <input
                        type="date"
                        className="rounded-xl border px-3 py-2"
                        value={lead_date}
                        onChange={(e) => setLeadDate(e.target.value)}
                        title="Lead Date (Manila)"
                    />
                    <input
                        className="rounded-xl border px-3 py-2 md:col-span-5"
                        placeholder="Purpose/Justification (optional)"
                        value={purpose_text}
                        onChange={(e) => setPurpose(e.target.value)}
                    />
                    <div className="md:col-span-5 flex items-center justify-end gap-4">
                        <div className="text-sm text-slate-500">
                            Est. Total: <span className="font-semibold">{estimated_total.toFixed(2)}</span>
                        </div>
                        <button
                            className="rounded-xl px-4 py-2 bg-blue-600 text-white disabled:opacity-50"
                            disabled={loading}
                            type="submit"
                        >
                            {loading ? 'Saving…' : 'Add to Procurement'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
