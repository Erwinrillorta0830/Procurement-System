'use client';

import React, { useEffect, useState } from 'react';
import {
    getProcurement,
    getProcurementDetails,
    Procurement,
    ProcurementDetail
} from '../api/procurement';
import { getSupplierById, Supplier } from '../api/suppliers';
import {
    getItemTemplateName,
    getItemVariantName,
    getItemTemplateUom,
} from '../api/ItemCatalog';

export default function ProcurementPrintPage({ id }: { id: string }) {
    const numericId = Number(id);

    const [master, setMaster] = useState<Procurement | null>(null);
    const [details, setDetails] = useState<ProcurementDetail[]>([]);
    const [supplier, setSupplier] = useState<Supplier | null>(null);

    const [itemNames, setItemNames] = useState<Record<number, string>>({});
    const [variantNames, setVariantNames] = useState<Record<number, string>>({});
    const [tmplUoms, setTmplUoms] = useState<Record<number, string>>({});

    async function loadNames(rows: ProcurementDetail[]) {
        const tmplIds = Array.from(new Set(rows.map(d => d.item_template_id).filter((v): v is number => !!v)));
        const variantIds = Array.from(new Set(rows.map(d => d.item_variant_id).filter((v): v is number => !!v)));

        const tmplEntries = await Promise.all(
            tmplIds.map(async (tid) => [tid, await getItemTemplateName(tid)] as [number, string])
        );
        const variantEntries = await Promise.all(
            variantIds.map(async (vid) => [vid, await getItemVariantName(vid)] as [number, string])
        );

        setItemNames(Object.fromEntries(tmplEntries));
        setVariantNames(Object.fromEntries(variantEntries));
    }

    async function loadUoms(rows: ProcurementDetail[]) {
        const needTmpl = rows
            .filter((r) => !(r as any).uom && r.item_template_id)
            .map((r) => r.item_template_id as number);

        const unique = Array.from(new Set(needTmpl));
        if (unique.length === 0) return;

        const pairs = await Promise.all(
            unique.map(async (tid) => [tid, await getItemTemplateUom(tid)] as [number, string])
        );
        setTmplUoms(Object.fromEntries(pairs));
    }

    useEffect(() => {
        (async () => {
            if (!Number.isFinite(numericId)) return;

            const m = await getProcurement(numericId);
            setMaster(m);

            const d = await getProcurementDetails(numericId);
            setDetails(d);

            await Promise.all([loadNames(d), loadUoms(d)]);

            if (m?.supplier_id) {
                const s = await getSupplierById(m.supplier_id);
                setSupplier(s);
            }
        })();
    }, [numericId]);


    const total =
        master?.total_amount ??
        details.reduce((a, b) => a + Number(b.total_amount || (b.qty || 0) * (b.unit_price || 0)), 0);

    return (
        <div className="p-8 print:p-0">
            {/* Print only the #print-area content */}
            <style>{`
        @media print {
          :root { color-scheme: light; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Hide everything by default */
          body * { visibility: hidden !important; }
          /* Show the print area only */
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute;
            inset: 0;
            margin: 0 !important;
          }
          .no-print { display: none !important; }
        }
        @page {
          size: A4;
          margin: 12mm;
        }
      `}</style>

            <div className="no-print mb-4 flex gap-2">
                <button onClick={() => window.print()} className="rounded px-3 py-2 border">Print</button>
                {/* Optional: navigate back etc. */}
            </div>

            {/* Everything inside this DIV is what gets printed */}
            <div id="print-area" className="max-w-4xl mx-auto border p-6 bg-white">
                <header className="flex items-start justify-between">
                    <div>
                        <div className="text-2xl font-bold">PROCUREMENT</div>
                        <div className="text-sm text-slate-600">Reference: {master?.procurement_no}</div>
                        <div className="text-sm text-slate-600">Lead Date: {master?.lead_date ?? '—'}</div>
                        <div className="text-sm text-slate-600">
                            Status: {master?.status}{master?.isApproved ? ' (Approved)' : ''}
                        </div>
                    </div>
                    <div className="text-right text-sm">
                        <div className="font-semibold">
                            {supplier?.supplier_name ?? `Supplier #${master?.supplier_id ?? ''}`}
                        </div>
                        <div>{supplier?.address}</div>
                        <div>{supplier?.email_address} {supplier?.phone_number ? `· ${supplier?.phone_number}` : ''}</div>
                        <div>TIN: {supplier?.tin_number}</div>
                        <div>Terms: {supplier?.payment_terms}</div>
                    </div>
                </header>

                <hr className="my-4" />

                <table className="w-full text-sm">
                    <thead>
                    <tr className="text-left border-b">
                        <th className="py-2">Item Template</th>
                        <th className="py-2">Variant</th>
                        <th className="py-2">UOM</th>
                        <th className="py-2 text-right">Qty</th>
                        <th className="py-2 text-right">Unit Price</th>
                        <th className="py-2 text-right">Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    {details.map((l) => {
                        const uom = (l as any).uom
                            || (l.item_template_id ? tmplUoms[l.item_template_id] : '')
                            || '—';
                        return (
                            <tr key={l.id} className="border-b">
                                <td className="py-2">{(l.item_template_id && itemNames[l.item_template_id]) || '—'}</td>
                                <td className="py-2">{(l.item_variant_id && variantNames[l.item_variant_id]) || '—'}</td>
                                <td className="py-2">{uom}</td>
                                <td className="py-2 text-right">{l.qty}</td>
                                <td className="py-2 text-right">₱ {Number(l.unit_price).toFixed(2)}</td>
                                <td className="py-2 text-right">
                                    ₱ {Number(l.total_amount || (l.qty || 0) * (l.unit_price || 0)).toFixed(2)}
                                </td>
                            </tr>
                        );
                    })}
                    {details.length === 0 && (
                        <tr><td colSpan={6} className="py-6 text-center text-slate-500">No lines.</td></tr>
                    )}
                    </tbody>
                    <tfoot>
                    <tr>
                        <td colSpan={5} className="pt-4 text-right font-semibold">Grand Total</td>
                        <td className="pt-4 text-right font-bold">₱ {Number(total || 0).toFixed(2)}</td>
                    </tr>
                    </tfoot>
                </table>

                <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
                    <div>
                        <div className="font-semibold">Prepared By</div>
                        <div className="mt-12 border-t w-56"></div>
                    </div>
                    <div>
                        <div className="font-semibold">Approved By</div>
                        <div className="mt-12 border-t w-56"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
