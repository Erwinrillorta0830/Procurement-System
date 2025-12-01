'use client';

import React, { useMemo, useState } from 'react';
import { useItems } from '../provider/ItemsProvider';

type Picked = {
    item_template_id: number;
    item_variant_id: number | null;
    name: string;
    uom: string;
    unit_price: number;
};

export default function ItemPicker({ onPick }: { onPick: (p: Picked) => void }) {
    const {
        templates,
        variants,
        setActiveModal, // 'template' | 'variant'
    } = useItems();

    const [q, setQ] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

    // client-side search over templates your provider already loaded
    const filteredTemplates = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return templates;
        return (templates as any[]).filter(
            (t) =>
                String(t.name || '').toLowerCase().includes(needle) ||
                String(t.uom || '').toLowerCase().includes(needle)
        );
    }, [q, templates]);

    const template = useMemo(
        () => (templates as any[]).find((t) => t.id === selectedTemplateId),
        [templates, selectedTemplateId]
    );

    // filter preloaded variants for the chosen template
    const templateVariants = useMemo(
        () => (variants as any[]).filter((v) => v.item_tmpl_id === selectedTemplateId),
        [variants, selectedTemplateId]
    );

    const picked = useMemo<Picked | null>(() => {
        if (!template) return null;
        const variant = templateVariants.find((v) => v.id === selectedVariantId);
        const unit_price = Number(
            variant?.list_price ?? template?.base_price ?? 0
        );
        return {
            item_template_id: template.id,
            item_variant_id: variant?.id ?? null,
            name: variant?.name || template.name,
            uom: String(template.uom || ''),
            unit_price,
        };
    }, [template, templateVariants, selectedVariantId]);

    return (
        <div className="space-y-3">
            {/* search + create template */}
            <div className="flex gap-2">
                <input
                    className="border rounded px-3 py-2 w-full"
                    placeholder="Search item template…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <button
                    type="button"
                    className="px-3 py-2 rounded bg-blue-600 text-white"
                    onClick={() => setActiveModal('template')}
                    title="Create new item template"
                >
                    + New Item
                </button>
            </div>

            {/* template list */}
            <div className="border rounded">
                <div className="bg-slate-50 px-3 py-2 text-xs uppercase tracking-wide">Templates</div>
                <div className="max-h-56 overflow-auto divide-y">
                    {filteredTemplates.map((t: any) => (
                        <label key={t.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                            <input
                                type="radio"
                                name="tmpl"
                                checked={selectedTemplateId === t.id}
                                onChange={() => {
                                    setSelectedTemplateId(t.id);
                                    setSelectedVariantId(null);
                                }}
                            />
                            <div className="flex-1">
                                <div className="font-medium">{t.name}</div>
                                <div className="text-xs text-slate-600">
                                    UOM: {t.uom || '—'} • Base: ₱ {Number(t.base_price || 0).toFixed(2)}
                                </div>
                            </div>
                        </label>
                    ))}
                    {filteredTemplates.length === 0 && (
                        <div className="px-3 py-3 text-sm text-slate-500">No results.</div>
                    )}
                </div>
            </div>

            {/* variants + add variant */}
            {selectedTemplateId && (
                <div className="border rounded">
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide">Variants</div>
                        <button
                            type="button"
                            className="text-xs underline"
                            onClick={() => setActiveModal('variant')}
                            title="Add Variant for selected template"
                        >
                            + Add Variant
                        </button>
                    </div>
                    <div className="max-h-56 overflow-auto divide-y">
                        {templateVariants.map((v: any) => (
                            <label key={v.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="variant"
                                    checked={selectedVariantId === v.id}
                                    onChange={() => setSelectedVariantId(v.id)}
                                />
                                <div className="flex-1">
                                    <div className="font-medium">{v.name}</div>
                                    <div className="text-xs text-slate-600">
                                        List: ₱ {Number(v.list_price || 0).toFixed(2)}
                                    </div>
                                </div>
                            </label>
                        ))}
                        {templateVariants.length === 0 && (
                            <div className="px-3 py-3 text-sm text-slate-500">
                                No variants. Click “Add Variant”.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    type="button"
                    disabled={!picked}
                    className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
                    onClick={() => picked && onPick(picked)}
                >
                    Add to Lines
                </button>
            </div>
        </div>
    );
}
