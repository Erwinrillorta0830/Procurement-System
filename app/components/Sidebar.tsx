'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type MenuItem = {
    name: string;
    path: string;
    subItems?: { name: string; path: string }[];
    icon?: React.ReactNode;
};

// Minimal inline icons (no extra deps)
const Icon = {
    dashboard: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm10 8h8v-6h-8v6zM3 21h8v-6H3v6zm10-8h8V3h-8v10z"/>
        </svg>
    ),
    briefcase: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M3 10v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        </svg>
    ),
    boxes: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
    ),
    file: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6"/>
        </svg>
    ),
    settings: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.07a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.07a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.05-.05A2 2 0 1 1 6.03 3.4l.05.05c.47.47 1.14.61 1.82.33A1.65 1.65 0 0 0 9.4 2.27V2a2 2 0 1 1 4 0v.07c0 .66.39 1.26 1 1.51.68.28 1.35.14 1.82-.33l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05c-.47.47-.61 1.14-.33 1.82.25.61.85 1 1.51 1H22a2 2 0 1 1 0 4h-.07c-.66 0-1.26.39-1.51 1z"/>
        </svg>
    ),
    user: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-3-3.87M4 21v-2a4 4 0 0 1 3-3.87m9-6.13a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/>
        </svg>
    ),
};

const menu: MenuItem[] = [
    { name: 'Dashboard', path: '/app/dashboard' , icon: Icon.dashboard },
    {
        name: 'Procurements',
        path: '/procurements',
        icon: Icon.briefcase,
        subItems: [
            { name: 'List', path: '/app/procurement' },
            { name: 'Create', path: '/app/procurement/create' },
        ],
    },
    {
        name: 'Purchase Order',
        path: '/app/procurement/po',
        icon: Icon.briefcase,

    },
    {
        name: 'Items',
        path: '/app/items',
        icon: Icon.boxes,
        subItems: [
            { name: 'Items', path: '/app/items' },
            { name: 'Attributes', path: '/app/items/attributes' },
            { name: 'Variants', path: '/app/items/inventory' },
        ],
    },
    { name: 'Suppliers', path: '/app/supplier', icon: Icon.user },
    { name: 'Assets and Equipment', path: '/app/assets', icon: Icon.user },

];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const [openMenus, setOpenMenus] = useState<string[]>([]);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Mobile drawer toggle via event from Header
    useEffect(() => {
        const handler = () => setMobileOpen((v) => !v);
        window.addEventListener('toggle-sidebar', handler as EventListener);
        return () => window.removeEventListener('toggle-sidebar', handler as EventListener);
    }, []);

    // Login guard (no early return)
    useEffect(() => {
        const user = localStorage.getItem('user');
        setIsLoggedIn(!!user);
        if (!user && pathname !== '/login') router.push('/login');
    }, [pathname, router]);

    // Auto-expand parent with active sub-route
    useEffect(() => {
        if (!pathname) return;
        const menuWithActiveSub = menu.find((item) =>
            item.subItems?.some((sub) => pathname.startsWith(sub.path)),
        );
        if (menuWithActiveSub) {
            setOpenMenus((prev) =>
                prev.includes(menuWithActiveSub.name) ? prev : [...prev, menuWithActiveSub.name],
            );
        }
    }, [pathname]);

    const isActive = (path: string) =>
        pathname === path || (path !== '/' && !!pathname?.startsWith(path));

    const toggleMenu = (name: string) => {
        setOpenMenus((prev) => (prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]));
    };

    // Modern nav item (parent)
    const ParentButton = ({
                              label,
                              active,
                              hasSub,
                              open,
                              onClick,
                              icon,
                              controlsId,
                          }: {
        label: string;
        active: boolean;
        hasSub: boolean;
        open: boolean;
        onClick: () => void;
        icon?: React.ReactNode;
        controlsId?: string;
    }) => (
        <button
            onClick={onClick}
            className={[
                'group w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition',
                'outline-none focus:ring-2 ring-blue-500',
                active
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white/80 hover:bg-white border-blue-100 text-slate-800',
            ].join(' ')}
            aria-expanded={hasSub ? open : undefined}
            aria-controls={controlsId}
        >
            <span className={active ? 'opacity-100' : 'text-blue-600 group-hover:text-blue-700'}>{icon}</span>
            <span className="text-sm font-medium">{label}</span>
            {hasSub && (
                <svg
                    className={`ml-auto w-4 h-4 transition-transform duration-200 ${
                        open ? 'rotate-90' : ''
                    } ${active ? 'text-white' : 'text-slate-500'}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                >
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            )}
        </button>
    );

    // Rendered navigation list (memoized)
    const NavList = useMemo(
        () => (
            <div className="p-4">
                {/* Brand */}
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 grid place-items-center text-blue-600 border border-blue-200">
                        {Icon.briefcase}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-slate-800 leading-tight">VOS • Procurement</div>
                        <div className="text-[11px] text-slate-500">Manage purchasing & inventory</div>
                    </div>
                </div>

                {/* Section: Main */}
                <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase px-1 mb-2">
                    Main
                </div>
                <nav className="space-y-1">
                    {menu.slice(0, 3).map((item) => {
                        const parentActive = isActive(item.path);
                        const isOpen = openMenus.includes(item.name);
                        const hasSub = !!item.subItems?.length;

                        return (
                            <div key={item.name} className="select-none">
                                <ParentButton
                                    label={item.name}
                                    active={parentActive}
                                    hasSub={hasSub}
                                    open={isOpen}
                                    onClick={() => (hasSub ? toggleMenu(item.name) : router.push(item.path))}
                                    icon={item.icon}
                                    controlsId={hasSub ? `sub-${item.name}` : undefined}
                                />
                                {hasSub && isOpen && (
                                    <div id={`sub-${item.name}`} className="ml-2 mt-1 grid gap-1">
                                        {item.subItems!.map((sub) => {
                                            const active = isActive(sub.path);
                                            return (
                                                <Link
                                                    key={sub.name}
                                                    href={sub.path}
                                                    className={[
                                                        'flex items-center gap-2 pl-9 pr-3 py-2 rounded-lg text-sm border transition',
                                                        'outline-none focus:ring-2 ring-blue-500',
                                                        active
                                                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                            : 'hover:bg-blue-50 text-slate-700 border-blue-100',
                                                    ].join(' ')}
                                                    aria-current={active ? 'page' : undefined}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                    {sub.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Divider */}
                <div className="my-4 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

                {/* Section: Catalog */}
                <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase px-1 mb-2">
                    Catalog
                </div>
                <nav className="space-y-1">
                    {menu.slice(3, 6).map((item) => {
                        const parentActive = isActive(item.path);
                        const isOpen = openMenus.includes(item.name);
                        const hasSub = !!item.subItems?.length;

                        return (
                            <div key={item.name} className="select-none">
                                <ParentButton
                                    label={item.name}
                                    active={parentActive}
                                    hasSub={hasSub}
                                    open={isOpen}
                                    onClick={() => (hasSub ? toggleMenu(item.name) : router.push(item.path))}
                                    icon={item.icon}
                                    controlsId={hasSub ? `sub-${item.name}` : undefined}
                                />
                                {hasSub && isOpen && (
                                    <div id={`sub-${item.name}`} className="ml-2 mt-1 grid gap-1">
                                        {item.subItems!.map((sub) => {
                                            const active = isActive(sub.path);
                                            return (
                                                <Link
                                                    key={sub.name}
                                                    href={sub.path}
                                                    className={[
                                                        'flex items-center gap-2 pl-9 pr-3 py-2 rounded-lg text-sm border transition',
                                                        'outline-none focus:ring-2 ring-blue-500',
                                                        active
                                                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                            : 'hover:bg-blue-50 text-slate-700 border-blue-100',
                                                    ].join(' ')}
                                                    aria-current={active ? 'page' : undefined}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                    {sub.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Divider */}
                <div className="my-4 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

                {/* Section: System */}
                <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase px-1 mb-2">
                    System
                </div>
                <nav className="space-y-1">
                    {menu.slice(6).map((item) => {
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.name}
                                href={item.path}
                                className={[
                                    'flex items-center gap-3 px-3 py-2 rounded-xl border transition',
                                    'outline-none focus:ring-2 ring-blue-500',
                                    active
                                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                        : 'bg-white/80 hover:bg-white border-blue-100 text-slate-800',
                                ].join(' ')}
                                aria-current={active ? 'page' : undefined}
                            >
                                <span className={active ? 'opacity-100' : 'text-blue-600'}>{item.icon}</span>
                                <span className="text-sm font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer / meta */}
                <div className="mt-6 rounded-xl border border-blue-100 bg-white/70 p-3 text-[12px] text-slate-600">
                    <div className="flex items-center justify-between">
                        <span>Environment</span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Production
            </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <span>Version</span>
                        <span className="text-slate-700">v1.0.0</span>
                    </div>
                </div>
            </div>
        ),
        [openMenus, pathname, router],
    );

    return (
        <>
            {/* Desktop sidebar (light blue surface) */}
            <div className="h-full overflow-y-auto hidden lg:block bg-blue-50 border-r border-blue-200">
                <div className="sticky top-0 z-10 bg-gradient-to-b from-blue-100/70 to-transparent h-4" />
                <div className="pb-6">{isLoggedIn ? NavList : null}</div>
            </div>

            {/* Mobile drawer */}
            <div
                className={`lg:hidden fixed inset-0 z-[60] transition ${
                    mobileOpen && isLoggedIn ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                aria-hidden={!mobileOpen || !isLoggedIn}
            >
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-black/30 transition-opacity ${
                        mobileOpen && isLoggedIn ? 'opacity-100' : 'opacity-0'
                    }`}
                    onClick={() => setMobileOpen(false)}
                />
                {/* Panel */}
                <div
                    className={`absolute left-0 top-0 h-full w-[84%] max-w-[300px] border-r border-blue-200 bg-blue-50 shadow-xl transition-transform duration-300 ${
                        mobileOpen && isLoggedIn ? 'translate-x-0' : '-translate-x-full'
                    }`}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-center justify-between p-4 border-b border-blue-200 bg-blue-100/40">
                        <div className="text-base font-semibold text-slate-800">VOS • Procurement</div>
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="px-2 py-1 rounded-md bg-white hover:bg-slate-50 border border-blue-200 outline-none focus:ring-2 ring-blue-500"
                            aria-label="Close sidebar"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="h-[calc(100%-56px)] overflow-y-auto">{isLoggedIn ? NavList : null}</div>
                </div>
            </div>
        </>
    );
}
