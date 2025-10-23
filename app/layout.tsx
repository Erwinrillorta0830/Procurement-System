// app/layout.tsx
import './globals.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';

export const metadata = {
    title: 'Procurement System',
    description: 'Dashboard for Procurement System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body className="flex min-h-screen bg-gray-100">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-auto">
            <Header />
            <main className="p-6 flex-1">{children}</main>
            <Footer />
        </div>
        </body>
        </html>
    );
}
