'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
    fetchProcurementList,
    fetchProcurementGrouped,
    fetchProcurementByNo,
    fetchDetailsByProcurementNo,
} from '../api/getProcurement';
import { createProcurementRequest } from '../api/createProcurement';
import { approveProcurement } from '../api/approveProcurement';
import { generatePurchaseOrder } from '../api/generatePurchaseOrder';

export type ProcurementRequestRow = {
    pr_id: number;
    procurement_no: string;
    item_description: string;
    quantity: number;
    estimated_cost: number;
    estimated_total: number;
    requestor_user_id: number | null;
    department_id: number | null;
    transaction_type_id: number | null;
    purpose_text: string | null;
    status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Purchased' | 'Cancelled';
    created_at?: string | null;
    updated_at?: string | null;
};

export type ProcurementMaster = {
    id: number;
    procurement_no: string;
    lead_date: string | null;
    amount: number | null;
    date_created: string | null;
    encoder_id: number | null;
    department: number | null;
    po_no: number | null;
    isApproved: 0 | 1;
    transaction_type: string | null;
};

export type ProcurementDetail = {
    id: number;
    qty: number;
    unit_price: number;
    total_amount: number;
    created_date: string;
    supplier: number | null;
    link: string | null;
    procurement_no?: string;
};

type ContextState = {
    loading: boolean;
    error: string | null;

    search: string;
    setSearch: (v: string) => void;
    rows: ProcurementRequestRow[];
    groups: { procurement_no: string; total_items: number; total_estimate: number }[];

    selectedNo: string | null;
    setSelectedNo: (no: string | null) => void;
    master: ProcurementMaster | null;
    details: ProcurementDetail[];

    refresh: () => Promise<void>;
    create: (payload: {
        procurement_no?: string;
        item_description: string;
        quantity: number;
        estimated_cost: number;
        requestor_user_id?: number | null;
        department_id?: number | null;
        transaction_type_id?: number | null;
        purpose_text?: string | null;
        status?: ProcurementRequestRow['status'];
        lead_date?: string | null;
    }) => Promise<{ procurement_no: string }>;

    approve: (procurement_no: string) => Promise<void>;
    generatePO: (args: { procurement_no: string; supplier_id: number }) => Promise<{ po_id: number }>;
};

const ProcurementCtx = createContext<ContextState | null>(null);

export const ProcurementProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [loading, setLoading] = useState(false);
    const [error, setErr] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [rows, setRows] = useState<ProcurementRequestRow[]>([]);
    const [groups, setGroups] = useState<ContextState['groups']>([]);

    const [selectedNo, setSelectedNo] = useState<string | null>(null);
    const [master, setMaster] = useState<ProcurementMaster | null>(null);
    const [details, setDetails] = useState<ProcurementDetail[]>([]);

    const loadSelection = async (no: string | null) => {
        if (!no) {
            setMaster(null);
            setDetails([]);
            return;
        }
        const [m, d] = await Promise.all([
            fetchProcurementByNo(no),
            fetchDetailsByProcurementNo(no),
        ]);
        setMaster(m);
        setDetails(d);
    };

    const loadAll = async () => {
        setLoading(true);
        setErr(null);
        try {
            const [list, grouped] = await Promise.all([
                fetchProcurementList({ search }),
                fetchProcurementGrouped({ search }),
            ]);
            setRows(list);
            setGroups(grouped);
            await loadSelection(selectedNo);
        } catch (e: any) {
            setErr(e?.message ?? 'Failed to load procurement');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, selectedNo]);

    const refresh = async () => {
        await loadAll();
    };

    const create: ContextState['create'] = async (payload) => {
        setLoading(true);
        setErr(null);
        try {
            const res = await createProcurementRequest(payload);
            setSelectedNo(res.procurement_no);
            await loadAll();
            return res;
        } catch (e: any) {
            setErr(e?.message ?? 'Failed to create procurement request');
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const approve: ContextState['approve'] = async (procurement_no) => {
        setLoading(true);
        setErr(null);
        try {
            await approveProcurement(procurement_no);
            await loadAll();
        } catch (e: any) {
            setErr(e?.message ?? 'Failed to approve procurement');
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const generatePO: ContextState['generatePO'] = async ({ procurement_no, supplier_id }) => {
        setLoading(true);
        setErr(null);
        try {
            const out = await generatePurchaseOrder({ procurement_no, supplier_id });
            await loadAll();
            return out;
        } catch (e: any) {
            setErr(e?.message ?? 'Failed to generate Purchase Order');
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const value: ContextState = useMemo(
        () => ({
            loading,
            error,
            search,
            setSearch,
            rows,
            groups,
            selectedNo,
            setSelectedNo,
            master,
            details,
            refresh,
            create,
            approve,
            generatePO,
        }),
        [loading, error, search, rows, groups, selectedNo, master, details]
    );

    // ✅ No JSX here:
    return React.createElement(ProcurementCtx.Provider, { value }, children as React.ReactNode);
};

export const useProcurement = () => {
    const ctx = useContext(ProcurementCtx);
    if (!ctx) throw new Error('useProcurement must be used within ProcurementProvider');
    return ctx;
};
