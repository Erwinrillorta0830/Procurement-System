"use client";
import { useState } from "react";
import { useItems } from "../provider/ItemsProvider";

export default function ItemAttributeManager() {
    const { attributes, attributeValues, addAttribute, addAttributeValue, loading } = useItems();

    const [showAttributeModal, setShowAttributeModal] = useState(false);
    const [newAttribute, setNewAttribute] = useState({ name: "", display_type: "select" });
    const [newValue, setNewValue] = useState({ attribute_id: 0, name: "", extra_price: 0 });

    // Group values by attribute
    const groupedValues: Record<number, any[]> = {};
    attributeValues.forEach((val: any) => {
        if (!groupedValues[val.attribute_id]) groupedValues[val.attribute_id] = [];
        groupedValues[val.attribute_id].push(val);
    });

    const handleAddAttribute = async (e: React.FormEvent) => {
        e.preventDefault();
        await addAttribute(newAttribute);
        setShowAttributeModal(false);
        setNewAttribute({ name: "", display_type: "select" });
    };

    const handleAddValue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newValue.attribute_id) return alert("Select an attribute first.");
        await addAttributeValue({
            attribute_id: newValue.attribute_id,
            name: newValue.name,
            extra_price: Number(newValue.extra_price),
        });
        setNewValue({ attribute_id: 0, name: "", extra_price: 0 });
    };

    if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-bold text-gray-800">Attributes & Values</h2>
                <button
                    onClick={() => setShowAttributeModal(true)}
                    className="bg-green-600 text-white px-5 py-2 rounded-lg shadow hover:bg-green-700 transition"
                >
                    + Add Attribute
                </button>
            </div>

            {/* Attribute List */}
            {attributes.length === 0 ? (
                <p className="text-gray-500 italic">No attributes found.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {attributes.map((attr: any) => (
                        <div key={attr.id} className="bg-white shadow-md rounded-lg p-5 hover:shadow-lg transition">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">{attr.name}</h3>
                                    <p className="text-sm text-gray-500">Type: {attr.display_type}</p>
                                </div>
                            </div>

                            {/* Values */}
                            <div className="mt-4">
                                <h4 className="font-medium text-sm mb-2 text-gray-700">Values:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {(groupedValues[attr.id] || []).map((val) => (
                                        <span
                                            key={val.id}
                                            className="px-3 py-1 border rounded-lg text-sm bg-gray-50 shadow-sm"
                                        >
                                            {val.name}
                                            {val.extra_price > 0 && (
                                                <span className="text-xs text-gray-500 ml-1">
                                                    (+{val.extra_price})
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                    {(!groupedValues[attr.id] || groupedValues[attr.id].length === 0) && (
                                        <span className="text-gray-400 text-sm italic">No values</span>
                                    )}
                                </div>
                            </div>

                            {/* Add Value */}
                            <form
                                onSubmit={(e) => {
                                    setNewValue({ ...newValue, attribute_id: attr.id });
                                    handleAddValue(e);
                                }}
                                className="flex flex-col sm:flex-row gap-2 items-center mt-4"
                            >
                                <input
                                    type="text"
                                    placeholder="New Value"
                                    className="border p-2 rounded-lg w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    value={newValue.attribute_id === attr.id ? newValue.name : ""}
                                    onChange={(e) =>
                                        setNewValue({
                                            attribute_id: attr.id,
                                            name: e.target.value,
                                            extra_price: newValue.extra_price,
                                        })
                                    }
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Extra Price"
                                    className="border p-2 rounded-lg w-full sm:w-1/4 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    value={newValue.attribute_id === attr.id ? newValue.extra_price : ""}
                                    onChange={(e) =>
                                        setNewValue({
                                            ...newValue,
                                            attribute_id: attr.id,
                                            extra_price: Number(e.target.value),
                                        })
                                    }
                                />
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition w-full sm:w-auto"
                                >
                                    + Add
                                </button>
                            </form>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Attribute Modal */}
            {showAttributeModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-4">Add Attribute</h2>
                        <form onSubmit={handleAddAttribute} className="space-y-4">
                            <input
                                name="name"
                                placeholder="Attribute Name"
                                value={newAttribute.name}
                                onChange={(e) =>
                                    setNewAttribute({ ...newAttribute, name: e.target.value })
                                }
                                className="border p-2 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                                required
                            />
                            <select
                                name="display_type"
                                value={newAttribute.display_type}
                                onChange={(e) =>
                                    setNewAttribute({ ...newAttribute, display_type: e.target.value })
                                }
                                className="border p-2 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                            >
                                <option value="select">Select</option>
                                <option value="radio">Radio</option>
                                <option value="color">Color</option>
                                <option value="text">Text</option>
                            </select>
                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAttributeModal(false)}
                                    className="border px-4 py-2 rounded-lg hover:bg-gray-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
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
