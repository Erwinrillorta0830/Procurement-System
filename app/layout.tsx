// app/layout.tsx
import './globals.css';
import AppFrame from './components/AppFrame';

export const metadata = {
    title: 'Procurement System',
    description: 'Dashboard for Procurement System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="h-full">
        <body className="h-full bg-slate-50 text-slate-900 antialiased">
        {/* Skip link */}
        <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-black focus:text-white"
        >
            Skip to content
        </a>

        <AppFrame>{children}</AppFrame>
        </body>
        </html>
    );
}
