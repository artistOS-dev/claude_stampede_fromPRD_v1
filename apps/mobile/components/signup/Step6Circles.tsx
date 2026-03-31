import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { saveSignupState } from '../../lib/signupState'
import Button from '../ui/Button'

interface Step6Props {
  userId: string
  initialJoined?: string[]
  onSuccess: (joinedCircles: string[]) => void
  onSkip: () => void
}

interface Circle {
  id: string
  name: string
  description: string
  member_count: number
  emoji: string | null
  category: string | null
}

type JoinState = 'idle' | 'joining' | 'joined' | 'error'

export default function Step6Circles({
  userId,
  initialJoined = [],
  onSuccess,
  onSkip,
}: Step6Props) {
  const [circles, setCircles] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [joinStates, setJoinStates] = useState<Record<string, JoinState>>({})
  const [joinedIds, setJoinedIds] = useState<string[]>(initialJoined)
  const [celebrating, setCelebrating] = useState(false)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    fetchCircles()
  }, [])

  const fetchCircles = async () => {
    setLoading(true)
    setFetchError('')

    const { data, error } = await supabase
      .from('circles')
      .select('id, name, description, member_count, emoji, category')
      .order('member_count', { ascending: false })
      .limit(20)

    setLoading(false)

    if (error) {
      setFetchError('Could not load circles. You can skip and join later.')
    } else {
      setCircles(
        (data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name ?? 'Circle',
          description: c.description ?? '',
          member_count: c.member_count ?? 0,
          emoji: c.emoji ?? null,
          category: c.category ?? null,
        }))
      )
    }
  }

  const handleJoin = async (circleId: string) => {
    if (joinedIds.includes(circleId)) return

    setJoinStates((s) => ({ ...s, [circleId]: 'joining' }))

    const { error } = await supabase.from('circle_members').insert({
      circle_id: circleId,
      user_id: userId,
      joined_at: new Date().toISOString(),
    })

    if (error) {
      setJoinStates((s) => ({ ...s, [circleId]: 'error' }))
    } else {
      setJoinStates((s) => ({ ...s, [circleId]: 'joined' }))
      setJoinedIds((prev) => [...prev, circleId])
    }
  }

  const handleDone = async () => {
    setFinishing(true)
    await saveSignupState({ step: 6, joinedCircles: joinedIds })
    setFinishing(false)
    setCelebrating(true)

    // Auto-advance after celebration
    setTimeout(() => {
      onSuccess(joinedIds)
    }, 2500)
  }

  const handleSkip = async () => {
    await saveSignupState({ joinedCircles: [] })
    onSkip()
  }

  // Celebration screen
  if (celebrating) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text style={{ fontSize: 64 }} className="mb-6">🎉</Text>
        <Text className="text-gray-900 font-bold text-3xl text-center mb-3">
          Welcome to Stampede!
        </Text>
        <Text className="text-gray-500 text-base text-center leading-6">
          You're officially part of the home of country music. Let's go!
        </Text>
        {joinedIds.length > 0 ? (
          <View className="mt-6 bg-orange-50 border border-orange-100 rounded-2xl px-6 py-4 items-center">
            <Text className="text-orange-600 font-semibold text-base">
              Joined {joinedIds.length} {joinedIds.length === 1 ? 'circle' : 'circles'}
            </Text>
          </View>
        ) : null}
        <View className="mt-8">
          <ActivityIndicator color="#F97316" size="small" />
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="px-6 pt-6 pb-4">
        <Text className="text-gray-900 font-bold text-2xl mb-2">Join some circles</Text>
        <Text className="text-gray-500 text-base">
          Circles are communities built around artists, genres, and more.
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
          <Text className="text-gray-400 text-sm mt-3">Loading circles…</Text>
        </View>
      ) : fetchError ? (
        <View className="flex-1 px-6">
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex-row items-start">
            <Text className="text-red-500 font-bold mr-2">!</Text>
            <Text className="text-red-700 flex-1 text-sm">{fetchError}</Text>
          </View>
          <Button label="Try again" onPress={fetchCircles} variant="secondary" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        >
          {circles.length === 0 ? (
            <View className="py-12 items-center">
              <Text style={{ fontSize: 40 }} className="mb-3">🌾</Text>
              <Text className="text-gray-500 text-base text-center">
                No circles yet — be one of the first to join when they launch!
              </Text>
            </View>
          ) : (
            <View className="gap-3 mt-2">
              {circles.map((circle) => {
                const joinState = joinStates[circle.id] ?? 'idle'
                const isJoined = joinedIds.includes(circle.id)

                return (
                  <View
                    key={circle.id}
                    className={`rounded-2xl border-2 p-4 ${
                      isJoined
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <View className="flex-row items-start gap-3">
                      {/* Circle icon */}
                      <View
                        className={`w-12 h-12 rounded-full items-center justify-center ${
                          isJoined ? 'bg-orange-100' : 'bg-gray-100'
                        }`}
                      >
                        <Text style={{ fontSize: 22 }}>
                          {circle.emoji ?? '🎵'}
                        </Text>
                      </View>

                      {/* Info */}
                      <View className="flex-1">
                        <Text
                          className={`font-semibold text-base ${
                            isJoined ? 'text-orange-700' : 'text-gray-900'
                          }`}
                        >
                          {circle.name}
                        </Text>
                        {circle.description ? (
                          <Text className="text-gray-500 text-sm mt-0.5" numberOfLines={2}>
                            {circle.description}
                          </Text>
                        ) : null}
                        <Text className="text-gray-400 text-xs mt-1">
                          {circle.member_count.toLocaleString()}{' '}
                          {circle.member_count === 1 ? 'member' : 'members'}
                        </Text>
                      </View>

                      {/* Join button */}
                      <View className="ml-2">
                        {isJoined ? (
                          <View className="bg-orange-500 px-3 py-1.5 rounded-lg flex-row items-center gap-1">
                            <Text className="text-white text-xs font-bold">✓</Text>
                            <Text className="text-white text-xs font-semibold">Joined</Text>
                          </View>
                        ) : joinState === 'joining' ? (
                          <View className="bg-gray-100 px-3 py-1.5 rounded-lg">
                            <ActivityIndicator size="small" color="#F97316" />
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleJoin(circle.id)}
                            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                            className="bg-orange-500 px-3 py-1.5 rounded-lg"
                            accessibilityRole="button"
                            accessibilityLabel={`Join ${circle.name}`}
                          >
                            <Text className="text-white text-xs font-semibold">Join</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>

                    {/* Category tag */}
                    {circle.category ? (
                      <View className="mt-3">
                        <View className="self-start bg-gray-100 px-2.5 py-1 rounded-full">
                          <Text className="text-gray-500 text-xs">{circle.category}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                )
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom actions */}
      <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-white border-t border-gray-100">
        <Button
          label={finishing ? 'Almost there…' : `Done${joinedIds.length > 0 ? ` (${joinedIds.length} joined)` : ''}`}
          onPress={handleDone}
          loading={finishing}
          variant="primary"
          fullWidth
          size="lg"
        />
        <Pressable
          onPress={handleSkip}
          className="mt-3 items-center"
          accessibilityRole="button"
        >
          <Text className="text-gray-400 text-sm">Skip for now</Text>
        </Pressable>
      </View>
    </View>
  )
}
