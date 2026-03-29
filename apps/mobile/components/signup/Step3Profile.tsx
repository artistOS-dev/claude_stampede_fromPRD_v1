import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { saveSignupState } from '../../lib/signupState'
import Button from '../ui/Button'
import Input from '../ui/Input'

type Role = 'fan' | 'artist' | 'producer'

interface Step3Props {
  initialDisplayName?: string
  initialAvatarUrl?: string | null
  initialRole?: Role | null
  userId: string
  onSuccess: (displayName: string, avatarUrl: string | null, role: Role) => void
}

const ROLES: { id: Role; label: string; icon: string; description: string }[] = [
  { id: 'fan', label: 'Fan', icon: '🎵', description: 'I love country music' },
  { id: 'artist', label: 'Artist', icon: '🎸', description: 'I make country music' },
  { id: 'producer', label: 'Producer', icon: '🎚️', description: 'I work behind the scenes' },
]

type NameAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'error'

export default function Step3Profile({
  initialDisplayName = '',
  initialAvatarUrl = null,
  initialRole = null,
  userId,
  onSuccess,
}: Step3Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [avatarUri, setAvatarUri] = useState<string | null>(initialAvatarUrl)
  const [role, setRole] = useState<Role | null>(initialRole)
  const [nameAvailability, setNameAvailability] = useState<NameAvailability>('idle')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [nameError, setNameError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initials = displayName
    ? displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = displayName.trim()
    if (!trimmed || trimmed.length < 2) {
      setNameAvailability('idle')
      return
    }

    setNameAvailability('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('display_name', trimmed)
          .neq('id', userId)
          .maybeSingle()

        if (error) {
          setNameAvailability('error')
        } else if (data) {
          setNameAvailability('taken')
        } else {
          setNameAvailability('available')
        }
      } catch {
        setNameAvailability('error')
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [displayName, userId])

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library to set a profile picture.',
        [{ text: 'OK' }]
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  const uploadAvatar = async (uri: string): Promise<string | null> => {
    try {
      setUploading(true)
      const filename = `avatars/${userId}-${Date.now()}.jpg`
      const response = await fetch(uri)
      const blob = await response.blob()

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: true })

      if (error) {
        console.warn('Avatar upload error:', error.message)
        return null
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filename)
      return data.publicUrl
    } catch (err) {
      console.warn('Avatar upload failed:', err)
      return null
    } finally {
      setUploading(false)
    }
  }

  const canContinue =
    displayName.trim().length >= 2 &&
    role !== null &&
    (nameAvailability === 'available' || nameAvailability === 'idle' || nameAvailability === 'error')

  const handleSubmit = async () => {
    setNameError('')

    const trimmed = displayName.trim()
    if (trimmed.length < 2) {
      setNameError('Display name must be at least 2 characters')
      return
    }
    if (nameAvailability === 'taken') {
      setNameError('This name is already taken')
      return
    }
    if (!role) return

    setSubmitting(true)

    let finalAvatarUrl: string | null = null
    if (avatarUri && !avatarUri.startsWith('http')) {
      finalAvatarUrl = await uploadAvatar(avatarUri)
    } else {
      finalAvatarUrl = avatarUri
    }

    await saveSignupState({
      step: 4,
      displayName: trimmed,
      avatarUrl: finalAvatarUrl,
      role,
    })

    setSubmitting(false)
    onSuccess(trimmed, finalAvatarUrl, role)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pt-6 pb-8">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-gray-900 font-bold text-2xl mb-2">Build your profile</Text>
            <Text className="text-gray-500 text-base">
              Tell the community who you are.
            </Text>
          </View>

          {/* Avatar picker */}
          <View className="items-center mb-8">
            <Pressable
              onPress={pickImage}
              className="relative"
              accessibilityLabel="Change profile photo"
              accessibilityRole="button"
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  className="w-24 h-24 rounded-full"
                  style={{ width: 96, height: 96, borderRadius: 48 }}
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-orange-500 items-center justify-center">
                  <Text className="text-white text-3xl font-bold">{initials}</Text>
                </View>
              )}
              {/* Edit badge */}
              <View className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full border-2 border-gray-200 items-center justify-center">
                <Text style={{ fontSize: 14 }}>📷</Text>
              </View>
            </Pressable>

            <Pressable onPress={pickImage} className="mt-3">
              <Text className="text-orange-500 text-sm font-medium">
                {avatarUri ? 'Change photo' : 'Add a photo'}
              </Text>
            </Pressable>

            {uploading ? (
              <Text className="text-gray-400 text-xs mt-1">Uploading…</Text>
            ) : null}
          </View>

          {/* Display name */}
          <View className="mb-6">
            <Input
              label="Display name"
              value={displayName}
              onChangeText={(t) => {
                setDisplayName(t)
                setNameError('')
              }}
              error={nameError || (nameAvailability === 'taken' ? 'This name is already taken' : undefined)}
              placeholder="How should the community know you?"
              autoCapitalize="words"
              maxLength={30}
              hint="2–30 characters"
            />

            {/* Name availability indicator */}
            {nameAvailability !== 'idle' && displayName.trim().length >= 2 ? (
              <View className="flex-row items-center gap-1.5 mt-1.5">
                {nameAvailability === 'checking' ? (
                  <Text className="text-gray-400 text-xs">Checking availability…</Text>
                ) : nameAvailability === 'available' ? (
                  <>
                    <Text className="text-green-500 text-xs font-bold">✓</Text>
                    <Text className="text-green-600 text-xs">Name is available</Text>
                  </>
                ) : nameAvailability === 'taken' ? (
                  <>
                    <Text className="text-red-500 text-xs font-bold">✗</Text>
                    <Text className="text-red-500 text-xs">Already taken — try another</Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Role selector */}
          <View className="mb-8">
            <Text className="text-gray-700 font-medium text-sm mb-3">I am a…</Text>
            <View className="gap-3">
              {ROLES.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setRole(r.id)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  className={`flex-row items-center p-4 rounded-2xl border-2 ${
                    role === r.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: role === r.id }}
                  accessibilityLabel={r.label}
                >
                  <Text style={{ fontSize: 24 }} className="mr-4">{r.icon}</Text>
                  <View className="flex-1">
                    <Text
                      className={`font-semibold text-base ${
                        role === r.id ? 'text-orange-600' : 'text-gray-900'
                      }`}
                    >
                      {r.label}
                    </Text>
                    <Text className="text-gray-500 text-sm">{r.description}</Text>
                  </View>
                  {role === r.id ? (
                    <View className="w-5 h-5 rounded-full bg-orange-500 items-center justify-center">
                      <Text className="text-white text-xs font-bold">✓</Text>
                    </View>
                  ) : (
                    <View className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          <Button
            label={submitting || uploading ? 'Saving…' : 'Continue'}
            onPress={handleSubmit}
            loading={submitting || uploading}
            disabled={!canContinue}
            variant="primary"
            fullWidth
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
