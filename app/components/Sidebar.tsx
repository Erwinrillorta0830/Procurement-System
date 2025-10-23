// app/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const menu = [
    { name: 'Dashboard', path: '/' },
    {
        name: 'Procurements',
        path: '/procurements',
        subItems: [
            { name: 'Items', path: '/app/items' },
            { name: 'Attributes', path: '/app/items/attributes' },
            { name: 'Variants', path: '/app/items/inventory' },
        ]
    },
    { name: 'Reports', path: '/reports' },
    { name: 'Settings', path: '/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [openMenus, setOpenMenus] = useState<string[]>([]);

    useEffect(() => {
        const menuWithActiveSub = menu.find(item =>
            item.subItems?.some(sub => sub.path === pathname)
        );
        if (menuWithActiveSub) {
            setOpenMenus(prev => [...prev, menuWithActiveSub.name]);
        }
    }, [pathname]);

    const toggleMenu = (name: string) => {
        if (openMenus.includes(name)) {
            setOpenMenus(openMenus.filter(menu => menu !== name));
        } else {
            setOpenMenus([...openMenus, name]);
        }
    };

    return (
        <div className="w-64 bg-gray-800 text-white h-screen p-4 flex flex-col sticky top-0">
            <h1 className="text-2xl font-bold mb-6">Procurement</h1>
            {menu.map((item) => {
                const isActiveParent =
                    pathname === item.path ||
                    item.subItems?.some(sub => sub.path === pathname);

                const isOpen = openMenus.includes(item.name);

                return (
                    <div key={item.name}>
                        <button
                            onClick={() => item.subItems && toggleMenu(item.name)}
                            className={`w-full flex justify-between items-center p-2 rounded mb-2 hover:bg-gray-700 ${
                                isActiveParent ? 'bg-gray-700' : ''
                            }`}
                        >
                            <span>{item.name}</span>
                            {item.subItems && (
                                <svg
                                    className={`w-4 h-4 transform transition-transform duration-200 ${
                                        isOpen ? 'rotate-90' : ''
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </button>

                        {item.subItems && isOpen && (
                            <div className="ml-4 mt-1 flex flex-col">
                                {item.subItems.map((sub) => (
                                    <Link
                                        key={sub.name}
                                        href={sub.path}
                                        className={`p-2 rounded mb-1 hover:bg-gray-700 ${
                                            pathname === sub.path ? 'bg-gray-700' : ''
                                        }`}
                                    >
                                        {sub.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
