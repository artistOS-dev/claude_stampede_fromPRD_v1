import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  Users, Music2, Trophy, Star, Crown, Activity,
  CheckCircle2, Clock, AlertCircle, TrendingUp,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: number | string; icon: React.ReactNode; color: string
}) {
  return (
    <div className={`bg-zinc-900 rounded-xl border ${color} p-5 flex items-center gap-4`}>
      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950">
        {icon}
        <h2 className="font-semibold text-zinc-100 text-sm">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

const TIER_COLORS: Record<string, string> = {
  free:      'text-zinc-500',
  fan:       'text-blue-400',
  superfan:  'text-purple-400',
  artist:    'text-pink-400',
  producer:  'text-yellow-400',
}

const RODEO_STATUS: Record<string, { dot: string; label: string }> = {
  pending:  { dot: 'bg-yellow-400', label: 'Pending' },
  open:     { dot: 'bg-blue-400',   label: 'Open' },
  voting:   { dot: 'bg-green-400 animate-pulse', label: 'Voting' },
  closed:   { dot: 'bg-zinc-500',   label: 'Closed' },
  archived: { dot: 'bg-zinc-700',   label: 'Archived' },
}

// ── Page ──────────────────────────────────────────────────────

export default async function AdminPage() {
  // Auth check — must be a logged-in super admin
  const userClient = createClient()
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) redirect('/login')

  const { data: me } = await userClient
    .from('profiles')
    .select('display_name, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!me?.is_super_admin) redirect('/home')

  // All data fetched with service client (bypasses RLS)
  const db = createServiceClient()

  const [
    { count: userCount },
    { count: circleCount },
    { count: rodeoCount },
    { count: nominationCount },
    { data: recentUsers },
    { data: circles },
    { data: rodeos },
    { data: nominations },
    { data: feedEvents },
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('circles').select('id', { count: 'exact', head: true }),
    db.from('rodeos').select('id', { count: 'exact', head: true }),
    db.from('nominations').select('id', { count: 'exact', head: true }),

    // 20 most recent users
    db.from('profiles')
      .select('id, email, display_name, subscription_tier, role, is_super_admin, created_at')
      .order('created_at', { ascending: false })
      .limit(20),

    // All circles with member count
    db.from('circles')
      .select('id, name, description, member_count, created_at')
      .order('member_count', { ascending: false })
      .limit(30),

    // All non-archived rodeos
    db.from('rodeos')
      .select('id, title, type, status, start_date, end_date, created_at')
      .neq('status', 'archived')
      .order('created_at', { ascending: false }),

    // All pending/board_review nominations
    db.from('nominations')
      .select('id, circle_id, artist_name, status, nominator_id, created_at, circles(name)')
      .in('status', ['pending', 'board_review', 'approved'])
      .order('created_at', { ascending: false })
      .limit(30),

    // 30 most recent feed events
    db.from('circle_rodeo_events')
      .select('id, circle_id, event_type, payload, created_at, circles(name)')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Super Admin</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Logged in as {me.display_name ?? user.email}</p>
        </div>
        <div className="text-xs text-zinc-600">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Users"       value={userCount ?? 0}       icon={<Users   className="w-5 h-5 text-pink-400"   />} color="border-pink-900/50" />
        <StatCard label="Circles"     value={circleCount ?? 0}     icon={<Music2  className="w-5 h-5 text-purple-400" />} color="border-purple-900/50" />
        <StatCard label="Rodeos"      value={rodeoCount ?? 0}      icon={<Trophy  className="w-5 h-5 text-yellow-400" />} color="border-yellow-900/50" />
        <StatCard label="Nominations" value={nominationCount ?? 0} icon={<Star    className="w-5 h-5 text-blue-400"   />} color="border-blue-900/50" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Recent Users ─────────────────────────────────────── */}
        <Section title={`Users (last 20 of ${userCount ?? 0})`} icon={<Users className="w-4 h-4 text-pink-400" />}>
          <div className="space-y-1">
            {(recentUsers ?? []).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                  {(u.display_name ?? u.email ?? '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">
                      {u.display_name ?? '(no name)'}
                    </span>
                    {u.is_super_admin && (
                      <Crown className="w-3 h-3 text-yellow-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 truncate">{u.email}</p>
                </div>
                <span className={`text-xs font-medium shrink-0 ${TIER_COLORS[u.subscription_tier] ?? 'text-zinc-500'}`}>
                  {u.subscription_tier}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Circles ──────────────────────────────────────────── */}
        <Section title={`Circles (${circleCount ?? 0} total)`} icon={<Music2 className="w-4 h-4 text-purple-400" />}>
          <div className="space-y-1">
            {(circles ?? []).map((c) => (
              <a
                key={c.id}
                href={`/circles/${c.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Music2 className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white group-hover:text-pink-400 transition-colors truncate">{c.name}</p>
                  <p className="text-xs text-zinc-600 truncate">{c.description}</p>
                </div>
                <span className="text-xs text-zinc-500 shrink-0 tabular-nums">{c.member_count ?? 0} members</span>
              </a>
            ))}
          </div>
        </Section>

        {/* ── Active Rodeos ─────────────────────────────────────── */}
        <Section title="Active Rodeos" icon={<Trophy className="w-4 h-4 text-yellow-400" />}>
          {(rodeos ?? []).length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-4">No active rodeos.</p>
          ) : (
            <div className="space-y-1">
              {(rodeos ?? []).map((r) => {
                const s = RODEO_STATUS[r.status] ?? RODEO_STATUS.pending
                return (
                  <a
                    key={r.id}
                    href={`/rodeos/${r.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white group-hover:text-pink-400 transition-colors truncate">{r.title}</p>
                      <p className="text-xs text-zinc-600">{r.type} · {s.label}</p>
                    </div>
                    {r.end_date && (
                      <span className="text-xs text-zinc-600 shrink-0">
                        {new Date(r.end_date).toLocaleDateString()}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>
          )}
        </Section>

        {/* ── Nominations ───────────────────────────────────────── */}
        <Section title="Pending Nominations" icon={<TrendingUp className="w-4 h-4 text-blue-400" />}>
          {(nominations ?? []).length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-4">No pending nominations.</p>
          ) : (
            <div className="space-y-1">
              {(nominations ?? []).map((n) => {
                const statusIcon =
                  n.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> :
                  n.status === 'board_review' ? <Clock className="w-3.5 h-3.5 text-yellow-400" /> :
                  <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />
                return (
                  <div key={n.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                    {statusIcon}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{n.artist_name}</p>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <p className="text-xs text-zinc-600 truncate">{(n as any).circles?.name ?? n.circle_id}</p>
                    </div>
                    <span className="text-xs text-zinc-600 shrink-0 capitalize">{n.status}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

      </div>

      {/* ── Platform Feed ─────────────────────────────────────────── */}
      <Section title="Platform Activity Feed (last 30)" icon={<Activity className="w-4 h-4 text-green-400" />}>
        <div className="space-y-1">
          {(feedEvents ?? []).length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-4">No feed events yet.</p>
          ) : (
            (feedEvents ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono text-pink-400">{e.event_type}</span>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <span className="text-xs text-zinc-500 ml-2">{(e as any).circles?.name}</span>
                </div>
                <span className="text-xs text-zinc-600 shrink-0">
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

    </div>
  )
}
