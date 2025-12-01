// modules/procurement/po/details.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    getPurchaseOrderById,
    findPOForProcurement,
    listPOItemsByPOId,
    PurchaseOrder,
    PurchaseOrderItem
} from '../api/purchaseOrder';
import { getSupplierById, Supplier } from '../api/suppliers';

export default function PODetailsPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params?.id); // this is expected to be the PO id in the route

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        (async () => {
            if (!Number.isFinite(id)) return;
            setMsg('');
            try {
                // 1) try direct by id
                let header = await getPurchaseOrderById(id).catch(() => null);

                // 2) if not found, try to interpret id as a procurement id and search by reference/remark
                if (!header) {
                    const asProcId = id;
                    header = await findPOForProcurement(asProcId);
                }

                if (!header) {
                    setMsg('Purchase Order not found.');
                    return;
                }
                setPo(header);

                const lines = await listPOItemsByPOId(header.purchase_order_id);
                setItems(lines);

                if (header?.supplier_name) {
                    const s = await getSupplierById(header.supplier_name);
                    setSupplier(s);
                }
            } catch (e: any) {
                setMsg(e?.message || 'Failed to load PO.');
            }
        })();
    }, [id]);

    const toNum = (v: any) => Number(v || 0);
    const totalFromLines = items.reduce((a, b) => a + toNum(b.line_total), 0);
    const grand = totalFromLines || toNum(po?.total_amount);

    return (
        <div className="p-6 space-y-4">
            <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute; inset: 0; margin: 0 !important; }
          .no-print { display: none !important; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>

            <div className="flex items-center justify-between no-print">
                <h1 className="text-2xl font-semibold">Purchase Order</h1>
                <div className="flex gap-2">
                    <Link href="/app/procurement/po" className="rounded px-3 py-2 border">Back to PO List</Link>
                    <button onClick={() => window.print()} className="rounded px-3 py-2 border">Print</button>
                </div>
            </div>

            {msg && <div className="text-sm rounded border p-2 bg-amber-50">{msg}</div>}

            <div id="print-area" className="max-w-4xl mx-auto border bg-white p-6">
                <header className="flex items-start justify-between">
                    <div>
                        <div className="text-2xl font-bold">PURCHASE ORDER</div>
                        <div className="text-sm text-slate-600">PO No: {po?.purchase_order_no || '—'}</div>
                        <div className="text-sm text-slate-600">Date: {po?.date}{po?.time ? ` · ${po.time}` : ''}</div>
                    </div>
                    <div className="text-right text-sm">
                        <div className="font-semibold">
                            {supplier?.supplier_name ?? (po ? `Supplier #${po.supplier_name}` : '—')}
                        </div>
                        <div>{supplier?.address}</div>
                        <div>{supplier?.email_address}{supplier?.phone_number ? ` · ${supplier?.phone_number}` : ''}</div>
                        <div>{supplier?.tin_number ? `TIN: ${supplier?.tin_number}` : ''}</div>
                        <div>{supplier?.payment_terms ? `Terms: ${supplier?.payment_terms}` : ''}</div>
                    </div>
                </header>

                <hr className="my-4" />

                <table className="w-full text-sm">
                    <thead>
                    <tr className="text-left border-b">
                        <th className="py-2">#</th>
                        <th className="py-2">Item</th>
                        <th className="py-2">UOM</th>
                        <th className="py-2 text-right">Qty</th>
                        <th className="py-2 text-right">Unit Price</th>
                        <th className="py-2 text-right">Line Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map(it => (
                        <tr key={it.po_item_id} className="border-b align-top">
                            <td className="py-2">{it.line_no}</td>
                            <td className="py-2">
                                <div className="font-medium">{it.item_name}</div>
                                {it.item_description && <div className="text-slate-600">{it.item_description}</div>}
                            </td>
                            <td className="py-2">{it.uom || '—'}</td>
                            <td className="py-2 text-right">{toNum(it.qty).toFixed(2)}</td>
                            <td className="py-2 text-right">₱ {toNum(it.unit_price).toFixed(2)}</td>
                            <td className="py-2 text-right">₱ {toNum(it.line_total).toFixed(2)}</td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr><td colSpan={6} className="py-6 text-center text-slate-500">No items.</td></tr>
                    )}
                    </tbody>
                    <tfoot>
                    <tr>
                        <td colSpan={5} className="pt-4 text-right font-semibold">Grand Total</td>
                        <td className="pt-4 text-right font-bold">₱ {grand.toFixed(2)}</td>
                    </tr>
                    </tfoot>
                </table>

                {po?.remark && <div className="mt-6 text-sm text-slate-600">Reference: {po.remark}</div>}
            </div>
        </div>
    );
}
