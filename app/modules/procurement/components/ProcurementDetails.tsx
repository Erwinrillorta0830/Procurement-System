'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProcurement, getProcurementDetails, approveProcurementServer, Procurement, ProcurementDetail } from '../api/procurement';
import { getSupplierById, Supplier } from '../api/suppliers';

type SessionUser = { user_id?: number };

function getCurrentUserId(): number | null {
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return null;
        const u: SessionUser = JSON.parse(raw);
        return (u.user_id ?? null) as number | null;
    } catch { return null; }
}

export default function ProcurementDetailsPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const id = Number(params?.id);
    const [master, setMaster] = useState<Procurement | null>(null);
    const [details, setDetails] = useState<ProcurementDetail[]>([]);
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    async function load() {
        setMsg('');
        const m = await getProcurement(id);
        setMaster(m);
        const d = await getProcurementDetails(id);
        setDetails(d);
        if (m?.supplier_id) {
            const s = await getSupplierById(m.supplier_id);
            setSupplier(s);
        }
    }
    useEffect(()=> { if (Number.isFinite(id)) void load(); }, [id]);

    const canApprove = !!master && !master.isApproved && master.status !== 'approved';

    async function onApprove() {
        const uid = getCurrentUserId();
        if (!uid) { setMsg('No logged-in user found.'); return; }
        setBusy(true); setMsg('');
        try {
            await approveProcurementServer(id, uid);
            await load();
            setMsg('Approved successfully.');
        } catch (e:any) {
            setMsg(e?.message ?? 'Failed to approve');
        } finally {
            setBusy(false);
        }
    }

    const total = (master?.total_amount ?? details.reduce((a,b)=> a + Number(b.total_amount || (b.qty||0)*(b.unit_price||0)), 0));

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-2xl font-semibold">Procurement Details</div>
                <div className="flex gap-2">
                    <Link href="/procurement" className="rounded-xl px-3 py-2 border">Back</Link>
                    <Link href={`/procurement/${id}/print`} className="rounded-xl px-3 py-2 border">Print</Link>
                    <button
                        className="rounded-xl px-3 py-2 bg-emerald-600 text-white disabled:opacity-50"
                        onClick={onApprove}
                        disabled={!canApprove || busy}
                        title={canApprove ? 'Approve this procurement' : 'Already approved'}
                    >
                        {busy ? 'Working…' : (master?.isApproved ? 'Approved' : 'Approve')}
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`rounded-xl border p-3 ${msg.includes('Approved') ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-sm">{msg}</div>
                </div>
            )}

            {/* Header Card */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b text-sm font-semibold">Header</div>
                <div className="p-4 grid md:grid-cols-3 gap-3 text-sm">
                    <Info label="PR No" value={master?.procurement_no ?? ''} />
                    <Info label="Lead Date" value={master?.lead_date ?? ''} />
                    <Info label="Status" value={`${master?.status}${master?.isApproved ? ' (Approved)' : ''}`} />
                    <Info label="Supplier" value={supplier?.supplier_name ?? `#${master?.supplier_id ?? ''}`} />
                    <Info label="Payment Terms" value={supplier?.payment_terms ?? ''} />
                    <Info label="TIN" value={supplier?.tin_number ?? ''} />
                    <Info label="Email" value={supplier?.email_address ?? ''} />
                    <Info label="Phone" value={supplier?.phone_number ?? ''} />
                    <Info label="Address" value={supplier?.address ?? ''} />
                </div>
            </div>

            {/* Lines */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b text-sm font-semibold">Items</div>
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left bg-slate-50">
                            <th className="p-3">Template ID</th>
                            <th className="p-3">Variant ID</th>
                            <th className="p-3">Qty</th>
                            <th className="p-3">Unit Price</th>
                            <th className="p-3">Total</th>
                            <th className="p-3">Date Added</th>
                            <th className="p-3">Link</th>
                        </tr>
                        </thead>
                        <tbody>
                        {details.map(l => (
                            <tr key={l.id} className="border-t">
                                <td className="p-3">{l.item_template_id ?? '—'}</td>
                                <td className="p-3">{l.item_variant_id ?? '—'}</td>
                                <td className="p-3">{l.qty}</td>
                                <td className="p-3">₱ {Number(l.unit_price).toFixed(2)}</td>
                                <td className="p-3 font-medium">₱ {Number(l.total_amount || (l.qty||0)*(l.unit_price||0)).toFixed(2)}</td>
                                <td className="p-3">{l.date_added}</td>
                                <td className="p-3">
                                    {l.link ? <a className="text-blue-600 underline" href={l.link} target="_blank">file</a> : '—'}
                                </td>
                            </tr>
                        ))}
                        {details.length === 0 && (
                            <tr><td colSpan={7} className="p-6 text-center text-slate-500">No lines.</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-3 border-t text-right text-sm">
                    Grand Total:&nbsp;<b>₱ {Number(total || 0).toFixed(2)}</b>
                </div>
            </div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
            <div className="font-medium text-slate-800">{value || '—'}</div>
        </div>
    );
}
