// app/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
    const router = useRouter();
    useEffect(() => {
        try {
            const user = localStorage.getItem('user');
            router.replace(user ? '/app/dashboard' : '/login');
        } catch {
            router.replace('/login');
        }
    }, [router]);
    return <div className="p-6 text-slate-600">Checking session…</div>;
}
