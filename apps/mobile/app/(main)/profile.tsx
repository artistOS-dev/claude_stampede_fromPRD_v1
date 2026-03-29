import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { PERSONALITY_TYPES } from '../../lib/constants'

interface Profile {
  id: string
  displayName: string
  avatarUrl: string | null
  role: string | null
  tier: string | null
  bio: string
  personalityTypes: string[]
}

export default function ProfileScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editAvatar, setEditAvatar] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      router.replace('/(auth)/login')
      return
    }

    const userId = session.session.user.id
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role, tier, bio, personality_types')
      .eq('id', userId)
      .maybeSingle()

    setLoading(false)

    const p: Profile = {
      id: userId,
      displayName: data?.display_name ?? session.session.user.email?.split('@')[0] ?? 'Fan',
      avatarUrl: data?.avatar_url ?? null,
      role: data?.role ?? null,
      tier: data?.tier ?? 'free',
      bio: data?.bio ?? '',
      personalityTypes: data?.personality_types ?? [],
    }
    setProfile(p)
    setEditName(p.displayName)
    setEditBio(p.bio)
    setEditAvatar(p.avatarUrl)
  }

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access to change your photo.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setEditAvatar(result.assets[0].uri)
    }
  }

  const uploadAvatar = async (uri: string): Promise<string | null> => {
    if (!profile) return null
    try {
      setUploading(true)
      const filename = `avatars/${profile.id}-${Date.now()}.jpg`
      const response = await fetch(uri)
      const blob = await response.blob()

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: true })

      if (error) return null

      const { data } = supabase.storage.from('avatars').getPublicUrl(filename)
      return data.publicUrl
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return
    setSaveError('')
    setSaving(true)

    let finalAvatarUrl = profile.avatarUrl
    if (editAvatar && editAvatar !== profile.avatarUrl && !editAvatar.startsWith('http')) {
      const uploaded = await uploadAvatar(editAvatar)
      if (uploaded) finalAvatarUrl = uploaded
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: profile.id,
        display_name: editName.trim(),
        avatar_url: finalAvatarUrl,
        bio: editBio.trim(),
        updated_at: new Date().toISOString(),
      })

    setSaving(false)

    if (error) {
      setSaveError(error.message)
    } else {
      setProfile((p) =>
        p
          ? { ...p, displayName: editName.trim(), avatarUrl: finalAvatarUrl, bio: editBio.trim() }
          : p
      )
      setEditing(false)
    }
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

  const currentAvatar = editing ? editAvatar : profile?.avatarUrl

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
        <Text className="text-gray-900 font-bold text-lg">Profile</Text>
        {editing ? (
          <Pressable onPress={() => setEditing(false)} accessibilityRole="button">
            <Text className="text-gray-500 font-medium text-sm">Cancel</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button">
            <Text className="text-orange-500 font-medium text-sm">Edit</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar & name section */}
          <View className="bg-white px-6 py-8 items-center border-b border-gray-100">
            <Pressable
              onPress={editing ? handlePickAvatar : undefined}
              className="relative mb-4"
              accessibilityLabel={editing ? 'Change profile photo' : undefined}
              accessibilityRole={editing ? 'button' : undefined}
            >
              {currentAvatar ? (
                <Image
                  source={{ uri: currentAvatar }}
                  style={{ width: 96, height: 96, borderRadius: 48 }}
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-orange-500 items-center justify-center">
                  <Text className="text-white text-3xl font-bold">{initials}</Text>
                </View>
              )}
              {editing ? (
                <View className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full border-2 border-gray-200 items-center justify-center">
                  <Text style={{ fontSize: 14 }}>📷</Text>
                </View>
              ) : null}
            </Pressable>

            {editing ? (
              <Pressable onPress={handlePickAvatar} className="mb-4">
                <Text className="text-orange-500 text-sm font-medium">Change photo</Text>
              </Pressable>
            ) : null}

            {!editing ? (
              <>
                <Text className="text-gray-900 font-bold text-2xl mb-1">
                  {profile?.displayName}
                </Text>
                {profile?.role ? (
                  <Text className="text-gray-500 text-sm capitalize">{profile.role}</Text>
                ) : null}
                {profile?.tier && profile.tier !== 'free' ? (
                  <View className="mt-2 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
                    <Text className="text-orange-600 text-xs font-semibold capitalize">
                      {profile.tier} member
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>

          {/* Edit form */}
          {editing ? (
            <View className="px-6 py-6 gap-4">
              {saveError ? (
                <View className="bg-red-50 border border-red-200 rounded-xl p-4 flex-row items-start">
                  <Text className="text-red-500 font-bold mr-2">!</Text>
                  <Text className="text-red-700 flex-1 text-sm">{saveError}</Text>
                </View>
              ) : null}

              <Input
                label="Display name"
                value={editName}
                onChangeText={setEditName}
                placeholder="Your display name"
                autoCapitalize="words"
                maxLength={30}
              />

              <Input
                label="Bio"
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell the community about yourself…"
                multiline
                numberOfLines={4}
                maxLength={200}
              />

              <Button
                label={saving || uploading ? 'Saving…' : 'Save changes'}
                onPress={handleSave}
                loading={saving || uploading}
                disabled={!editName.trim()}
                variant="primary"
                fullWidth
                size="lg"
              />
            </View>
          ) : (
            <View className="px-6 py-6 gap-6">
              {/* Bio */}
              <View>
                <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
                  Bio
                </Text>
                <View className="bg-white rounded-2xl border border-gray-200 p-4">
                  <Text className="text-gray-700 text-base leading-6">
                    {profile?.bio || 'No bio yet. Tap Edit to add one.'}
                  </Text>
                </View>
              </View>

              {/* Personality types */}
              {profile?.personalityTypes && profile.personalityTypes.length > 0 ? (
                <View>
                  <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
                    Music Personality
                  </Text>
                  <View className="gap-2">
                    {profile.personalityTypes.map((ptId) => {
                      const pt = PERSONALITY_TYPES.find((p) => p.id === ptId)
                      if (!pt) return null
                      return (
                        <View
                          key={ptId}
                          className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-row items-center gap-3"
                        >
                          <View className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                          <View>
                            <Text className="text-gray-900 font-semibold text-sm">
                              {pt.label}
                            </Text>
                            <Text className="text-gray-500 text-xs">{pt.description}</Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </View>
              ) : null}

              {/* Account section */}
              <View>
                <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
                  Account
                </Text>
                <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <AccountRow label="Role" value={profile?.role ?? 'Fan'} capitalize />
                  <View className="h-px bg-gray-100" />
                  <AccountRow label="Plan" value={profile?.tier ?? 'Free'} capitalize />
                </View>
              </View>

              {/* Sign out */}
              <Pressable
                onPress={handleSignOut}
                className="bg-white rounded-2xl border border-red-200 p-4 items-center"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Text className="text-red-500 font-semibold text-base">Sign out</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function AccountRow({
  label,
  value,
  capitalize,
}: {
  label: string
  value: string
  capitalize?: boolean
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className={`text-gray-900 text-sm font-medium ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </Text>
    </View>
  )
}
