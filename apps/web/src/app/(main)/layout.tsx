import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/auth/LogoutButton'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle()

  const isSuperAdmin = profile?.is_super_admin === true

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top nav */}
      <header className="bg-zinc-900 border-b border-zinc-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">Stampede</span>
          </div>

          <nav className="flex items-center gap-1">
            <a
              href="/home"
              className="px-3 py-2 text-sm font-medium text-zinc-300 hover:text-pink-400 hover:bg-pink-950/20 rounded-lg transition-colors"
            >
              Home
            </a>
            <a
              href="/circles"
              className="px-3 py-2 text-sm font-medium text-zinc-300 hover:text-pink-400 hover:bg-pink-950/20 rounded-lg transition-colors"
            >
              Circles
            </a>
            <a
              href="/rodeos"
              className="px-3 py-2 text-sm font-medium text-zinc-300 hover:text-pink-400 hover:bg-pink-950/20 rounded-lg transition-colors"
            >
              Rodeos
            </a>
            {isSuperAdmin && (
              <a
                href="/admin"
                className="px-3 py-2 text-sm font-medium text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/20 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Admin
              </a>
            )}
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
