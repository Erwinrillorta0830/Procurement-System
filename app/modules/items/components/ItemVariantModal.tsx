"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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

interface VariantInput {
    id: number;
    item_tmpl_id: number;
    name: string;
    list_price: number;
    valueIds: number[];
}

interface Props {
    variant?: VariantInput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback = 0): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeTemplate(value: unknown): Template | null {
    if (!isRecord(value)) return null;

    const id = toNumber(value.id, NaN);
    const name = typeof value.name === "string" ? value.name : "";

    if (!Number.isFinite(id) || !name) return null;

    return { id, name };
}

function normalizeAttribute(value: unknown): Attribute | null {
    if (!isRecord(value)) return null;

    const id = toNumber(value.id, NaN);
    const name = typeof value.name === "string" ? value.name : "";

    if (!Number.isFinite(id) || !name) return null;

    return { id, name };
}

function normalizeAttributeValue(value: unknown): AttributeValue | null {
    if (!isRecord(value)) return null;

    const id = toNumber(value.id, NaN);
    const attributeId = toNumber(value.attribute_id, NaN);
    const name = typeof value.name === "string" ? value.name : "";
    const extraPrice = toNumber(value.extra_price, 0);

    if (!Number.isFinite(id) || !Number.isFinite(attributeId) || !name) return null;

    return {
        id,
        attribute_id: attributeId,
        name,
        extra_price: extraPrice,
    };
}

export default function ItemVariantModal({ variant }: Props) {
    const {
        activeModal,
        setActiveModal,
        templates,
        attributes,
        attributeValues,
        addVariant,
        updateVariant,
    } = useItems();

    const templateList = useMemo<Template[]>(
        () => templates.map(normalizeTemplate).filter((v): v is Template => v !== null),
        [templates]
    );

    const attributeList = useMemo<Attribute[]>(
        () => attributes.map(normalizeAttribute).filter((v): v is Attribute => v !== null),
        [attributes]
    );

    const attributeValueList = useMemo<AttributeValue[]>(
        () =>
            attributeValues
                .map(normalizeAttributeValue)
                .filter((v): v is AttributeValue => v !== null),
        [attributeValues]
    );

    const [form, setForm] = useState<Form>({
        item_tmpl_id: "",
        name: "",
        list_price: "",
        valueIds: [],
    });

    useEffect(() => {
        if (variant) {
            setForm({
                item_tmpl_id: String(variant.item_tmpl_id),
                name: variant.name,
                list_price: String(variant.list_price),
                valueIds: variant.valueIds ?? [],
            });
            return;
        }

        setForm({
            item_tmpl_id: "",
            name: "",
            list_price: "",
            valueIds: [],
        });
    }, [variant]);

    useEffect(() => {
        const template = templateList.find((item) => item.id === Number(form.item_tmpl_id));

        if (!template) {
            setForm((prev) => ({ ...prev, name: "" }));
            return;
        }

        const selectedValues = form.valueIds
            .map((id) => attributeValueList.find((value) => value.id === id))
            .filter((value): value is AttributeValue => value !== undefined)
            .map((value) => value.name);

        const variantName = [template.name, ...selectedValues].join(" ").trim();

        setForm((prev) => ({ ...prev, name: variantName }));
    }, [form.item_tmpl_id, form.valueIds, templateList, attributeValueList]);

    const handleSelectValue = (attributeId: number, valueId: number): void => {
        const filtered = form.valueIds.filter((id) => {
            const value = attributeValueList.find((item) => item.id === id);
            return value?.attribute_id !== attributeId;
        });

        setForm((prev) => ({
            ...prev,
            valueIds: valueId ? [...filtered, valueId] : filtered,
        }));
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        if (!form.item_tmpl_id) {
            alert("Please select a template");
            return;
        }

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
            setForm({
                item_tmpl_id: "",
                name: "",
                list_price: "",
                valueIds: [],
            });
        } catch (error: unknown) {
            console.error("Failed to save variant:", error);
        }
    };

    if (activeModal !== "variant") return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="max-h-[80vh] w-[500px] overflow-auto rounded-lg bg-white p-6 shadow-lg">
                <h2 className="mb-4 text-lg font-semibold">
                    {variant ? "Edit Variant" : "Add Variant"}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <select
                        name="item_tmpl_id"
                        value={form.item_tmpl_id}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, item_tmpl_id: e.target.value }))
                        }
                        className="w-full rounded border p-2"
                        required
                    >
                        <option value="">Select Template</option>
                        {templateList.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </select>

                    <input
                        name="name"
                        placeholder="Variant Name"
                        value={form.name}
                        readOnly
                        className="w-full cursor-not-allowed rounded border bg-gray-100 p-2"
                    />

                    <input
                        name="list_price"
                        type="number"
                        placeholder="List Price"
                        value={form.list_price}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, list_price: e.target.value }))
                        }
                        className="w-full rounded border p-2"
                        step="0.01"
                        min="0"
                    />

                    {attributeList.map((attribute) => {
                        const options = attributeValueList.filter(
                            (value) => value.attribute_id === attribute.id
                        );

                        const selectedValueId =
                            form.valueIds
                                .map((id) =>
                                    attributeValueList.find((value) => value.id === id)
                                )
                                .find((value) => value?.attribute_id === attribute.id)?.id ?? "";

                        return (
                            <div key={attribute.id}>
                                <label className="mb-1 block font-medium">
                                    {attribute.name} (optional)
                                </label>
                                <select
                                    className="w-full rounded border p-2"
                                    value={selectedValueId}
                                    onChange={(e) =>
                                        handleSelectValue(
                                            attribute.id,
                                            Number(e.target.value)
                                        )
                                    }
                                >
                                    <option value="">-- None --</option>
                                    {options.map((value) => (
                                        <option key={value.id} value={value.id}>
                                            {value.name}{" "}
                                            {value.extra_price > 0
                                                ? `( +${value.extra_price} )`
                                                : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}

                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setActiveModal(null)}
                            className="rounded border px-4 py-2 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                        >
                            {variant ? "Update" : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}