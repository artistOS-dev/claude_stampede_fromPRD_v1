'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function DuelsNavLink() {
  const [unvoted, setUnvoted] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch('/api/duels?unvoted=true')
        if (!res.ok || cancelled) return
        const json: { unvoted_count: number } = await res.json()
        if (!cancelled) setUnvoted(json.unvoted_count ?? 0)
      } catch { /* ignore */ }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [pathname])

  const isActive = pathname.startsWith('/duels')

  return (
    <a
      href="/duels"
      className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5
        ${isActive
          ? 'text-amber-400 bg-amber-950/30'
          : 'text-stone-300 hover:text-amber-400 hover:bg-amber-950/20'}`}
    >
      Duels
      {unvoted > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
          {unvoted > 9 ? '9+' : unvoted}
        </span>
      )}
    </a>
  )
}
