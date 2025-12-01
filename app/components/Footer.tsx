'use client';

export default function Footer() {
    return (
        <footer className="border-t border-slate-200 bg-white text-slate-500">
            <div className="mx-auto px-4 md:px-6 py-4 text-center text-sm">
                © {new Date().getFullYear()} Procurement System • All rights reserved.
            </div>
        </footer>
    );
}
