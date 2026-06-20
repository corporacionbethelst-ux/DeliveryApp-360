import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Delivery360 - Sistema de Gestión de Deliveries',
  description: 'Plataforma enterprise para gestión de deliveries, repartidores y órdenes en tiempo real',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* 
           ✅ CORRECCIÓN: 
           Zustand no necesita Provider. El estado es global por defecto 
           al importar useAuthStore desde cualquier componente.
        */}
        {children}
      </body>
    </html>
  );
}