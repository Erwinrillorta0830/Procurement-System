'use client';

import React from 'react';
import ProcurementCreateForm from '../components/ProcurementCreateForm';

export default function ProcurementCreatePage() {
    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Create Procurement</h1>
            </header>
            <ProcurementCreateForm />
        </div>
    );
}
