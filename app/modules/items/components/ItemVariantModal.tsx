"use client";
import { useState, useEffect } from "react";
import { useItems } from "../provider/ItemsProvider";

interface Form {
    item_tmpl_id: string;
    name: string;
    list_price: string;
    valueIds: number[];
}

interface Template {
    id: number;
    name: string;
}

interface Attribute {
    id: number;
    name: string;
}

interface AttributeValue {
    id: number;
    attribute_id: number;
    name: string;
    extra_price: number;
}

interface Props {
    variant?: {
        id: number;
        item_tmpl_id: number;
        name: string;
        list_price: number;
        valueIds: number[];
    };
}

export default function ItemVariantModal({ variant }: Props) {
    const { activeModal, setActiveModal, templates, attributes, attributeValues, addVariant, updateVariant } = useItems();
        useItems();

    const [form, setForm] = useState<Form>({
        item_tmpl_id: "",
        name: "",
        list_price: "",
        valueIds: [],
    });

    // Prefill form when editing
    useEffect(() => {
        if (variant) {
            setForm({
                item_tmpl_id: variant.item_tmpl_id.toString(),
                name: variant.name,
                list_price: variant.list_price.toString(),
                valueIds: variant.valueIds || [],
            });
        } else {
            setForm({ item_tmpl_id: "", name: "", list_price: "", valueIds: [] });
        }
    }, [variant]);

    // Update variant name dynamically based on template + selected attributes
    useEffect(() => {
        const template = (templates as Template[]).find((t) => t.id === Number(form.item_tmpl_id));
        if (!template) return setForm((prev) => ({ ...prev, name: "" }));

        const selectedValues = form.valueIds
            .map((id) => (attributeValues as AttributeValue[]).find((v) => v.id === id))
            .filter((v): v is AttributeValue => Boolean(v))
            .map((v) => v.name);

        const variantName = [template.name, ...selectedValues].join(" ");
        setForm((prev) => ({ ...prev, name: variantName }));
    }, [form.item_tmpl_id, form.valueIds, templates, attributeValues]);

    const handleSelectValue = (attributeId: number, valueId: number) => {
        const filtered = form.valueIds.filter((id) => {
            const val = (attributeValues as AttributeValue[]).find((v) => v.id === id);
            return val?.attribute_id !== attributeId;
        });

        setForm({ ...form, valueIds: valueId ? [...filtered, valueId] : filtered });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.item_tmpl_id) return alert("Please select a template");

        const payload = {
            item_tmpl_id: Number(form.item_tmpl_id),
            name: form.name.trim(),
            list_price: Number(form.list_price) || 0,
            active: true,
        };

        try {
            if (variant?.id) {
                await updateVariant(variant.id, payload);
            } else {
                await addVariant(payload, form.valueIds);
            }


            setActiveModal(null);
            setForm({ item_tmpl_id: "", name: "", list_price: "", valueIds: [] });
        } catch (err) {
            console.error("Failed to save variant:", err);
        }
    };

    if (activeModal !== "variant") return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-[500px] max-h-[80vh] overflow-auto">
                <h2 className="text-lg font-semibold mb-4">{variant ? "Edit Variant" : "Add Variant"}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Template Select */}
                    <select
                        name="item_tmpl_id"
                        value={form.item_tmpl_id}
                        onChange={(e) => setForm({ ...form, item_tmpl_id: e.target.value })}
                        className="border p-2 w-full rounded"
                        required
                    >
                        <option value="">Select Template</option>
                        {(templates as Template[]).map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>

                    {/* Variant Name (readonly) */}
                    <input
                        name="name"
                        placeholder="Variant Name"
                        value={form.name}
                        readOnly
                        className="border p-2 w-full rounded bg-gray-100 cursor-not-allowed"
                    />

                    {/* List Price */}
                    <input
                        name="list_price"
                        type="number"
                        placeholder="List Price"
                        value={form.list_price}
                        onChange={(e) => setForm({ ...form, list_price: e.target.value })}
                        className="border p-2 w-full rounded"
                        step="0.01"
                        min="0"
                    />

                    {/* Attribute dropdowns */}
                    {(attributes as Attribute[]).map((attr) => {
                        const options = (attributeValues as AttributeValue[]).filter(
                            (v) => v.attribute_id === attr.id
                        );
                        return (
                            <div key={attr.id}>
                                <label className="block font-medium mb-1">{attr.name} (optional)</label>
                                <select
                                    className="border p-2 w-full rounded"
                                    value={
                                        form.valueIds
                                            .map((id) => (attributeValues as AttributeValue[]).find((v) => v.id === id))
                                            .find((v) => v?.attribute_id === attr.id)?.id || ""
                                    }
                                    onChange={(e) => handleSelectValue(attr.id, Number(e.target.value))}
                                >
                                    <option value="">-- None --</option>
                                    {options.map((val) => (
                                        <option key={val.id} value={val.id}>
                                            {val.name} {val.extra_price > 0 && `( +${val.extra_price} )`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={() => setActiveModal(null)}
                            className="border px-4 py-2 rounded hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                        >
                            {variant ? "Update" : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
