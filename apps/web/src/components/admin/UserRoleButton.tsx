'use client'

import { useState } from 'react'

const ROLES = ['fan', 'artist_manager', 'stampede_producer'] as const
type Role = typeof ROLES[number]

const ROLE_LABELS: Record<Role, string> = {
  fan: 'Fan',
  artist_manager: 'Artist Mgr',
  stampede_producer: 'Producer',
}

const ROLE_COLORS: Record<Role, string> = {
  fan: 'text-stone-400 bg-stone-800 hover:bg-stone-700',
  artist_manager: 'text-amber-400 bg-amber-950/40 hover:bg-amber-950/70',
  stampede_producer: 'text-yellow-400 bg-yellow-950/40 hover:bg-yellow-950/70',
}

export default function UserRoleButton({ userId, currentRole }: { userId: string; currentRole: Role }) {
  const [role, setRole] = useState<Role>(currentRole)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const changeRole = async (newRole: Role) => {
    if (newRole === role) { setOpen(false); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) setRole(newRole)
    } finally { setSaving(false); setOpen(false) }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen((o) => !o)}
        className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors disabled:opacity-40 ${ROLE_COLORS[role]}`}
      >
        {saving ? '…' : ROLE_LABELS[role]}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => changeRole(r)}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-stone-800 ${
                  r === role ? 'text-amber-400' : 'text-stone-300'
                }`}
              >
                {ROLE_LABELS[r]}{r === role ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
