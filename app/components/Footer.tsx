// app/components/Footer.tsx
'use client';

export default function Footer() {
    return (
        <footer className="w-full bg-gray-900 text-white p-4 text-center mt-auto">
            &copy; {new Date().getFullYear()} Procurement System. All rights reserved.
        </footer>
    );
}
