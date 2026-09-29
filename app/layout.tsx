import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Catalog AI — Automatización de Fotografía de Moda',
  description: 'Plataforma para automatizar la creación de fotografías profesionales de prendas con consistencia garantizada de producto y modelo.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[#090a0f] text-gray-100 antialiased selection:bg-blue-600 selection:text-white" suppressHydrationWarning>
        <Navbar />
        <main className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
