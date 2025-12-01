'use client';

import * as React from 'react';
import {
    getPurchaseOrderById,
    findPOForProcurement,
    listPOItemsByPOId,
    PurchaseOrder,
    PurchaseOrderItem,
} from '../api/purchaseOrder';
import { getSupplierById, Supplier } from '../api/suppliers';
import { printNodeWithIframe } from '../../../lib/printNodeWithIframe';

export default function POModal({
                                    open,
                                    onClose,
                                    poId,
                                    fallbackProcurementId,
                                }: {
    open: boolean;
    onClose: () => void;
    poId: number | null;
    fallbackProcurementId: number | null;
}) {
    const [po, setPo] = React.useState<PurchaseOrder | null>(null);
    const [items, setItems] = React.useState<PurchaseOrderItem[]>([]);
    const [supplier, setSupplier] = React.useState<Supplier | null>(null);
    const [msg, setMsg] = React.useState('');

    // INNER print node
    const printRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!open) return;
        (async () => {
            setMsg(''); setPo(null); setItems([]); setSupplier(null);
            try {
                let header: PurchaseOrder | null = null;
                if (poId) header = await getPurchaseOrderById(poId).catch(() => null);
                if (!header && fallbackProcurementId) header = await findPOForProcurement(fallbackProcurementId);
                if (!header) { setMsg('Purchase Order not found.'); return; }
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
    }, [open, poId, fallbackProcurementId]);

    const toNum = (v: any) => Number(v || 0);
    const totalFromLines = items.reduce((a, b) => a + toNum(b.line_total), 0);
    const grand = totalFromLines || toNum(po?.total_amount);

    const handlePrint = () => {
        if (printRef.current) {
            printNodeWithIframe(printRef.current, `PO ${po?.purchase_order_no ?? ''}`);
        }
    };

    return (
        <>
            {/* SCREEN MODAL */}
            <div className={`fixed inset-0 z-[70] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
                <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}/>
                <div className={`absolute left-1/2 top-1/2 w-[min(100vw-24px,1000px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl transition-all ${open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <div className="font-semibold">Purchase Order</div>
                        <div className="flex gap-2">
                            <button onClick={handlePrint} className="rounded-xl border px-3 py-1.5 text-sm">Print</button>
                            <button onClick={onClose} className="rounded-xl border px-3 py-1.5 text-sm">Close</button>
                        </div>
                    </div>

                    {msg && <div className="mx-4 mt-3 rounded border bg-amber-50 p-2 text-sm">{msg}</div>}

                    <div className="max-h-[78vh] overflow-auto p-6">
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
            </div>

            {/* ===== OFF-SCREEN PRINT CONTENT ===== */}
            <div
                aria-hidden
                style={{ position: 'fixed', left: '-200vw', top: 0, width: '210mm', background: 'white' }}
            >
                <div ref={printRef}>
                    <POPrint po={po} items={items} supplier={supplier} />
                </div>
            </div>
        </>
    );
}

/** A4 PO Invoice block */
function POPrint({
                     po,
                     items,
                     supplier,
                 }: {
    po: PurchaseOrder | null;
    items: PurchaseOrderItem[];
    supplier: Supplier | null;
}) {
    const toNum = (v: any) => Number(v || 0);
    const totalFromLines = items.reduce((a, b) => a + toNum(b.line_total), 0);
    const grand = totalFromLines || toNum(po?.total_amount);

    return (
        <div className="w-a4">
            <header className="flex items-start justify-between">
                <div>
                    <div className="h1">PURCHASE ORDER</div>
                    <div className="muted">PO No: {po?.purchase_order_no || '—'}</div>
                    <div className="muted">Date: {po?.date}{po?.time ? ` · ${po?.time}` : ''}</div>
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

            <table>
                <thead>
                <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>UOM</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Line Total</th>
                </tr>
                </thead>
                <tbody>
                {items.map(it => (
                    <tr key={it.po_item_id}>
                        <td>{it.line_no}</td>
                        <td>
                            <div className="font-medium">{it.item_name}</div>
                            {it.item_description && <div className="text-slate-600">{it.item_description}</div>}
                        </td>
                        <td>{it.uom || '—'}</td>
                        <td className="text-right">{toNum(it.qty).toFixed(2)}</td>
                        <td className="text-right">₱ {toNum(it.unit_price).toFixed(2)}</td>
                        <td className="text-right">₱ {toNum(it.line_total).toFixed(2)}</td>
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
    );
}
