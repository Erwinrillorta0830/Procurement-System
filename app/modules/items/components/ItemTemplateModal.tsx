"use client";

import { useEffect, useState } from "react";
import { useItems } from "../provider/ItemsProvider";

interface Form {
    name: string;
    uom: string;
    base_price: number;
}

interface Unit {
    unit_id: number;
    unit_name: string;
    unit_shortcut: string;
}

interface Template {
    id: number;
    name: string;
    uom: string;
    base_price: number;
}

interface Props {
    template?: Template;
}

interface DirectusItemsResponse<T> {
    data?: T[];
}

function isDirectusItemsResponse<T>(
    value: unknown
): value is DirectusItemsResponse<T> {
    return typeof value === "object" && value !== null;
}

export default function ItemTemplateModal({ template }: Props) {
    const { activeModal, setActiveModal, addTemplate, updateTemplate } = useItems();

    const [loadingUnits, setLoadingUnits] = useState<boolean>(false);
    const [units, setUnits] = useState<Unit[]>([]);
    const [form, setForm] = useState<Form>({
        name: "",
        uom: "",
        base_price: 0,
    });

    useEffect(() => {
        if (template) {
            setForm({
                name: template.name || "",
                uom: template.uom || "",
                base_price: Number(template.base_price) || 0,
            });
            return;
        }

        setForm({
            name: "",
            uom: "",
            base_price: 0,
        });
    }, [template]);

    useEffect(() => {
        let mounted = true;

        const fetchUnits = async (): Promise<void> => {
            setLoadingUnits(true);

            try {
                const res = await fetch("/api/items/units", {
                    method: "GET",
                    cache: "no-store",
                });

                if (!res.ok) {
                    throw new Error(`Failed to fetch units: ${res.status}`);
                }

                const json: unknown = await res.json();

                if (!mounted) return;

                if (isDirectusItemsResponse<Unit>(json) && Array.isArray(json.data)) {
                    setUnits(json.data);
                } else {
                    setUnits([]);
                }
            } catch (error: unknown) {
                console.error("Failed to fetch units:", error);
                if (mounted) {
                    setUnits([]);
                }
            } finally {
                if (mounted) {
                    setLoadingUnits(false);
                }
            }
        };

        fetchUnits();

        return () => {
            mounted = false;
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        const payload = {
            ...form,
            base_price: Number(form.base_price),
            is_active: true,
        };

        try {
            if (template?.id) {
                await updateTemplate(template.id, payload);
            } else {
                await addTemplate(payload);
            }

            setActiveModal(null);
            setForm({
                name: "",
                uom: "",
                base_price: 0,
            });
        } catch (error: unknown) {
            console.error("Failed to save template:", error);
        }
    };

    if (activeModal !== "template") return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[80vh] w-[400px] overflow-auto rounded-lg bg-white p-6">
                <h2 className="mb-3 text-lg font-semibold">
                    {template ? "Edit Template" : "New Item Template"}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label htmlFor="name" className="mb-1 block text-sm font-medium">
                            Item Name
                        </label>
                        <input
                            id="name"
                            name="name"
                            placeholder="Name"
                            value={form.name}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full rounded border p-2"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="uom" className="mb-1 block text-sm font-medium">
                            Unit of Measure (UOM)
                        </label>
                        <select
                            id="uom"
                            value={form.uom}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, uom: e.target.value }))
                            }
                            className="w-full rounded border p-2"
                            required
                            disabled={loadingUnits}
                        >
                            <option value="">
                                {loadingUnits ? "Loading units..." : "Select UOM"}
                            </option>
                            {units.map((unit) => (
                                <option key={unit.unit_id} value={unit.unit_name}>
                                    {unit.unit_name} ({unit.unit_shortcut})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label
                            htmlFor="base_price"
                            className="mb-1 block text-sm font-medium"
                        >
                            Base Price
                        </label>
                        <input
                            id="base_price"
                            name="base_price"
                            type="number"
                            placeholder="Base Price"
                            value={form.base_price}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    base_price: Number(e.target.value),
                                }))
                            }
                            className="w-full rounded border p-2"
                            step="0.01"
                            min="0"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveModal(null)}
                            className="rounded border px-4 py-2 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                        >
                            {template ? "Update" : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}