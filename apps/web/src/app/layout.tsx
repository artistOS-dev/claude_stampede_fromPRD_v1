import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Stampede — The home of country music',
  description: 'Join Stampede — the ultimate community for country music fans. Discover artists, join circles, and connect with fans like you.',
  openGraph: {
    title: 'Stampede — The home of country music',
    description: 'Join Stampede — the ultimate community for country music fans.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-stone-950 min-h-screen`}
      >
        {children}
      </body>
    </html>
  )
}
