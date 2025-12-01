'use client';
import React from 'react';
import { ProcurementProvider } from './provider/ProcurementProvider';
import ProcurementForm from './components/ProcurementForm';
import ProcurementList from './components/ProcurementList';
import ProcurementDetails from './components/ProcurementDetails';
import ProcurementApproval from './components/ProcurementApproval';

export default function ProcurementModule() {
    return (
        <ProcurementProvider>
            <div className="p-6 space-y-6">
                <header className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">Procurement</h1>
                </header>

                <ProcurementForm />
                <ProcurementList />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ProcurementDetails />
                    <ProcurementApproval />
                </div>
            </div>
        </ProcurementProvider>
    );
}
