import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orkesta Voice — Agentes de IA para ventas telefónicas',
  description: 'Automatiza tus cold calls con agentes de IA que suenan como vendedores humanos profesionales.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
