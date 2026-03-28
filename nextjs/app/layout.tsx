import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kratamex — Tecnología de primer nivel',
  description: 'Laptops y accesorios de alta gama para quienes exigen rendimiento sin compromisos.',
  keywords: ['laptops', 'hardware', 'tecnología', 'gaming', 'accesorios'],
  openGraph: {
    title: 'Kratamex',
    description: 'Tu tienda de tecnología profesional',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Prevent flash of light theme on dark-default sites */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kratamex_tema')||'dark';document.documentElement.dataset.tema=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
