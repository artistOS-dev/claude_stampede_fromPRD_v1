import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

interface UserProfile {
  displayName: string
  avatarUrl: string | null
  role: string | null
  tier: string | null
}

export default function HomeScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      router.replace('/(auth)/signup')
      return
    }

    const userId = session.session.user.id
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, role, tier')
      .eq('id', userId)
      .maybeSingle()

    if (data) {
      setProfile({
        displayName: data.display_name ?? 'Country Fan',
        avatarUrl: data.avatar_url ?? null,
        role: data.role ?? null,
        tier: data.tier ?? 'free',
      })
    } else {
      // Fallback using auth metadata
      setProfile({
        displayName: session.session.user.email?.split('@')[0] ?? 'Country Fan',
        avatarUrl: null,
        role: null,
        tier: 'free',
      })
    }

    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/signup')
  }

  const initials = profile?.displayName
    ? profile.displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#F97316" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 bg-orange-500 rounded-lg items-center justify-center">
            <Text className="text-white font-bold text-sm">S</Text>
          </View>
          <Text className="text-gray-900 font-bold text-lg">Stampede</Text>
        </View>
        <Pressable
          onPress={handleSignOut}
          className="bg-gray-100 px-3 py-1.5 rounded-lg"
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text className="text-gray-600 text-sm font-medium">Sign out</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Welcome hero */}
        <View className="bg-orange-500 px-6 pt-8 pb-10">
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center">
              <Text className="text-white text-xl font-bold">{initials}</Text>
            </View>
            <View>
              <Text className="text-white/80 text-sm">Welcome back,</Text>
              <Text className="text-white font-bold text-xl">
                {profile?.displayName ?? 'Country Fan'}
              </Text>
            </View>
          </View>
          <Text className="text-white/90 text-base leading-6">
            The home of country music is waiting for you.
          </Text>

          {/* Tier badge */}
          {profile?.tier && profile.tier !== 'free' ? (
            <View className="mt-3 self-start bg-white/20 px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-semibold capitalize">
                {profile.tier} member
              </Text>
            </View>
          ) : null}
        </View>

        {/* Feature cards */}
        <View className="px-6 -mt-4">
          <View className="gap-4">
            {/* Circles teaser */}
            <FeatureCard
              emoji="🤠"
              title="Discover Circles"
              description="Find your tribe — join communities built around artists, genres, and events."
              actionLabel="Explore circles"
              onPress={() => {}}
            />

            {/* Events teaser */}
            <FeatureCard
              emoji="🎸"
              title="Upcoming Events"
              description="Never miss a show. Browse concerts, festivals, and fan meetups near you."
              actionLabel="Browse events"
              onPress={() => {}}
            />

            {/* Artists teaser */}
            <FeatureCard
              emoji="🎵"
              title="Follow Artists"
              description="Stay in the loop with your favourite country artists — news, releases, and more."
              actionLabel="Find artists"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Tagline */}
        <View className="items-center py-10 px-6">
          <Text className="text-gray-400 text-sm text-center italic">
            "The home of country music" — Stampede
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function FeatureCard({
  emoji,
  title,
  description,
  actionLabel,
  onPress,
}: {
  emoji: string
  title: string
  description: string
  actionLabel: string
  onPress: () => void
}) {
  return (
    <View
      className="bg-white rounded-2xl border border-gray-200 p-5"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View className="flex-row items-start gap-4">
        <View className="w-12 h-12 bg-orange-50 rounded-xl items-center justify-center">
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 font-bold text-base mb-1">{title}</Text>
          <Text className="text-gray-500 text-sm leading-5 mb-3">{description}</Text>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            className="self-start"
            accessibilityRole="button"
          >
            <Text className="text-orange-500 font-semibold text-sm">{actionLabel} →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
