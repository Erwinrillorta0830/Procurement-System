"use client";
import { useState } from "react";
import { useItems } from "../provider/ItemsProvider";

export default function InventoryTable() {
    const {
        items = [],
        variants = [],
        addItem,
        addVariant,
        loading,
    } = useItems();

    const [expanded, setExpanded] = useState<number | null>(null);
    const [showItemModal, setShowItemModal] = useState(false);
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

    const [newItem, setNewItem] = useState({
        name: "",
        uom: "",
        description: "",
    });

    const [newVariant, setNewVariant] = useState({
        item_tmpl_id: 0,
        name: "",
        list_price: 0,
    });

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        await addItem(newItem);
        setNewItem({ name: "", uom: "", description: "" });
        setShowItemModal(false);
    };

    const handleAddVariant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemId) return alert("Select an item first!");
        await addVariant({ ...newVariant, item_tmpl_id: selectedItemId }, []);
        setNewVariant({ item_tmpl_id: 0, name: "", list_price: 0 });
        setShowVariantModal(false);
    };

    // Group variants by template
    const groupedVariants: Record<number, any[]> = {};
    (variants || []).forEach((v: any) => {
        if (!groupedVariants[v.item_tmpl_id]) groupedVariants[v.item_tmpl_id] = [];
        groupedVariants[v.item_tmpl_id].push(v);
    });

    if (loading) return <div className="p-6 text-gray-500">Loading inventory...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Variants</h2>

            </div>

            <div className="overflow-hidden rounded-xl shadow border border-gray-100">
                <table className="min-w-full text-sm text-left text-gray-700">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
                    <tr>
                        <th className="px-5 py-3 w-1/3">Item Name</th>
                        <th className="px-5 py-3 w-1/6">UoM</th>
                        <th className="px-5 py-3">Variants</th>
                    </tr>
                    </thead>
                    <tbody>
                    {Array.isArray(items) && items.length > 0 ? (
                        items.map((item: any) => (
                            <>
                                <tr
                                    key={item.id}
                                    onClick={() => {
                                        setExpanded(expanded === item.id ? null : item.id);
                                        setSelectedItemId(item.id);
                                    }}
                                    className="border-t hover:bg-gray-50 transition cursor-pointer"
                                >
                                    <td className="px-5 py-3 font-medium text-gray-900">
                                        {item.name}
                                    </td>
                                    <td className="px-5 py-3">{item.uom || "-"}</td>
                                    <td className="px-5 py-3">
                                        {groupedVariants[item.id]?.length || 0}
                                    </td>
                                </tr>

                                {/* Expanded Variant Section */}
                                {expanded === item.id && (
                                    <tr>
                                        <td colSpan={3} className="bg-gray-50 px-6 py-4">
                                            {groupedVariants[item.id]?.length ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {groupedVariants[item.id].map((v) => (
                                                        <div
                                                            key={v.id}
                                                            className="bg-white border border-gray-200 shadow-sm px-3 py-2 rounded-lg flex items-center gap-3 text-sm"
                                                        >
                                <span className="font-medium text-gray-800">
                                  {v.name}
                                </span>
                                                            <span className="text-gray-500">
                                  ₱{Number(v.list_price).toFixed(2)}
                                </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 italic">
                                                    No variants for this item.
                                                </p>
                                            )}


                                        </td>
                                    </tr>
                                )}
                            </>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={3} className="text-center text-gray-500 py-6">
                                No items found.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Add Variant Modal */}
            {showVariantModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-lg w-[400px] animate-fadeIn">
                        <h3 className="text-lg font-semibold mb-4">Add Variant</h3>
                        <form onSubmit={handleAddVariant} className="space-y-4">
                            <input
                                placeholder="Variant Name"
                                value={newVariant.name}
                                onChange={(e) =>
                                    setNewVariant({ ...newVariant, name: e.target.value })
                                }
                                className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                            <input
                                placeholder="List Price"
                                type="number"
                                step="0.01"
                                value={newVariant.list_price}
                                onChange={(e) =>
                                    setNewVariant({
                                        ...newVariant,
                                        list_price: Number(e.target.value),
                                    })
                                }
                                className="border p-2 w-full rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowVariantModal(false)}
                                    className="border px-4 py-2 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
