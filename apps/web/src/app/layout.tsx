import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-gray-50 min-h-screen`}
      >
        {children}
      </body>
    </html>
  )
}
