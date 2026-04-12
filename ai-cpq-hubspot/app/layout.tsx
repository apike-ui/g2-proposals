import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI CPQ | Configure Price Quote',
  description: 'AI-powered Configure Price Quote system with HubSpot integration',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
