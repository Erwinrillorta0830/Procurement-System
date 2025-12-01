"use client";
import { useState, useEffect } from "react";
import { useItems } from "../provider/ItemsProvider";
import axios from "axios";

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

interface Props {
    template?: { id: number; name: string; uom: string; base_price: number };
}

export default function ItemTemplateModal({ template }: Props) {
    const { activeModal, setActiveModal, addTemplate, updateTemplate } = useItems();
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);
    const [form, setForm] = useState<Form>({ name: "", uom: "", base_price: 0 });

    // Prefill form if editing
    useEffect(() => {
        if (template) {
            setForm({
                name: template.name || "",
                uom: template.uom || "",
                base_price: template.base_price || 0,
            });
        } else {
            setForm({ name: "", uom: "", base_price: 0 });
        }
    }, [template]);

    // Fetch UOMs
    useEffect(() => {
        const fetchUnits = async () => {
            setLoadingUnits(true);
            try {
                const res = await axios.get("http://100.126.246.124:8060/items/units");
                setUnits(res.data.data || []);
            } catch (err) {
                console.error("Failed to fetch units:", err);
            } finally {
                setLoadingUnits(false);
            }
        };
        fetchUnits();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...form, base_price: Number(form.base_price), is_active: true };

        try {
            if (template?.id) {
                // EDIT mode
                await updateTemplate(template.id, payload);
            } else {
                // CREATE mode
                await addTemplate(payload);
            }
            setActiveModal(null);
            setForm({ name: "", uom: "", base_price: 0 });
        } catch (err) {
            console.error("Failed to save template:", err);
        }
    };

    if (activeModal !== "template") return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-[400px] max-h-[80vh] overflow-auto">
                <h2 className="text-lg font-semibold mb-3">
                    {template ? "Edit Template" : "New Item Template"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-1">
                        Item Name
                    </label>
                    <input
                        name="name"
                        placeholder="Name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="border p-2 w-full rounded"
                        required
                    />
                    </div>
                    {/* UOM Dropdown */}
                    <div>
                        <label htmlFor="uom" className="block text-sm font-medium mb-1">
                            Unit of Measure (UOM)
                        </label>
                    <select
                        value={form.uom}
                        onChange={(e) => setForm({ ...form, uom: e.target.value })}
                        className="border p-2 w-full rounded"
                        required
                    >
                        <option value="">Select UOM</option>
                        {units.map((unit) => (
                            <option key={unit.unit_id} value={unit.unit_name}>
                                {unit.unit_name} ({unit.unit_shortcut})
                            </option>
                        ))}
                    </select>
                    </div>

                    <div>
                        <label htmlFor="base_price" className="block text-sm font-medium mb-1">
                            Base Price
                        </label>
                    <input
                        name="base_price"
                        type="number"
                        placeholder="Base Price"
                        value={form.base_price}
                        onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })}
                        className="border p-2 w-full rounded"
                        step="0.01"
                        min="0"
                        required
                    />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveModal(null)}
                            className="border px-4 py-2 rounded hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                            {template ? "Update" : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
