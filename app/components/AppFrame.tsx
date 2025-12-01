// app/components/AppFrame.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function AppFrame({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

    const readAuth = () => setIsLoggedIn(!!localStorage.getItem('user'));

    useEffect(() => {
        // on mount
        readAuth();

        // Cross-tab updates (note: doesn't fire in same tab)
        const onStorage = () => readAuth();
        window.addEventListener('storage', onStorage);

        // Custom same-tab auth event
        const onAuthChanged = () => readAuth();
        window.addEventListener('auth-changed', onAuthChanged as EventListener);

        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('auth-changed', onAuthChanged as EventListener);
        };
    }, []);

    // Re-check auth whenever the route changes (covers redirect after login)
    useEffect(() => {
        readAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const hideChrome = pathname === '/login' || !isLoggedIn;

    if (hideChrome) {
        return (
            <div className="min-h-screen">
                <main id="main" className="p-4 md:p-6">{children}</main>
            </div>
        );
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-[264px_1fr]">
            <aside className="hidden lg:block h-screen sticky top-0 border-r border-slate-200 bg-white">
                <Sidebar />
            </aside>
            <div className="flex min-h-screen flex-col">
                <Header />
                <main id="main" className="flex-1 p-4 md:p-6">
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        {children}
                    </div>
                </main>
                <Footer />
            </div>
        </div>
    );
}
