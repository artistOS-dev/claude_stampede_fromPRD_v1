import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { Music2, Users, Star, Headphones } from 'lucide-react'

export default async function HomePage() {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, role, subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'there'
  const avatarUrl = profile?.avatar_url ?? null
  const tier = profile?.subscription_tier ?? 'free'

  const initials = displayName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-8">
      {/* Welcome hero */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold border-2 border-white/30"
                aria-label={`Avatar for ${displayName}`}
              >
                {initials}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              Welcome to Stampede, {displayName}!
            </h1>
            <p className="text-orange-100 mt-1">
              {tier === 'superfan'
                ? 'Superfan member — you have full access'
                : tier === 'fan'
                ? 'Fan member — thanks for supporting Stampede'
                : 'Free member — the home of country music'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-orange-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Your circles</p>
            <p className="text-xl font-bold text-gray-900">0</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Headphones className="w-5 h-5 text-orange-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Songs shared</p>
            <p className="text-xl font-bold text-gray-900">0</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Star className="w-5 h-5 text-orange-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Artists following</p>
            <p className="text-xl font-bold text-gray-900">0</p>
          </div>
        </div>
      </div>

      {/* Getting started */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Get started</h2>
        <div className="space-y-3">
          <a
            href="/circles"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-orange-600" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                Browse Circles
              </p>
              <p className="text-xs text-gray-500">
                Find communities of fans who share your taste
              </p>
            </div>
            <svg
              className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>

          <a
            href="/feed"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Music2 className="w-4 h-4 text-orange-600" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                Explore the Feed
              </p>
              <p className="text-xs text-gray-500">
                See what the community is listening to
              </p>
            </div>
            <svg
              className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
