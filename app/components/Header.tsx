// app/components/Header.tsx
'use client';

export default function Header() {
    return (
        <header className="w-full bg-gray-900 text-white p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Procurement System</h1>
            <nav>
                {/* Example right-side links */}
                <a href="#" className="ml-4 hover:underline">Profile</a>
                <a href="#" className="ml-4 hover:underline">Logout</a>
            </nav>
        </header>
    );
}
