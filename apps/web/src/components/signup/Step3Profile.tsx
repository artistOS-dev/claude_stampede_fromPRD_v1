'use client'

import { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react'
import Image from 'next/image'
import { Upload, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type Role = 'fan' | 'artist' | 'producer'

interface Step3Props {
  userId: string
  initialDisplayName?: string
  initialAvatarUrl?: string | null
  initialRole?: Role | null
  onSuccess: (displayName: string, avatarUrl: string | null, role: Role) => void
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

const ROLE_OPTIONS: { id: Role; label: string; description: string; emoji: string }[] = [
  { id: 'fan', label: 'Fan', description: "I'm here to discover and celebrate music", emoji: '🎵' },
  { id: 'artist', label: 'Artist', description: "I make or perform country music", emoji: '🎸' },
  { id: 'producer', label: 'Producer / Circle Founder', description: "I help build country music communities", emoji: '🎙️' },
]

function generateInitialsAvatar(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  const colors = ['#F97316', '#EA580C', '#C2410C', '#FB923C', '#FDBA74']
  const colorIndex = name.charCodeAt(0) % colors.length
  const bg = colors[colorIndex]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="64" fill="${bg}"/>
    <text x="64" y="76" font-family="system-ui,sans-serif" font-size="44" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
  </svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export default function Step3Profile({
  userId,
  initialDisplayName = '',
  initialAvatarUrl = null,
  initialRole = null,
  onSuccess,
}: Step3Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl)
  const [role, setRole] = useState<Role | null>(initialRole)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const checkUsername = useCallback(async (name: string) => {
    if (!name || name.length < 3) {
      setUsernameStatus('idle')
      return
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(name)) {
      setUsernameStatus('invalid')
      setUsernameError('3–30 characters: letters, numbers, underscores only')
      return
    }

    setUsernameStatus('checking')
    setUsernameError(null)

    try {
      const res = await fetch(`/api/profile/check-username?username=${encodeURIComponent(name)}`)
      const data: { available?: boolean; reason?: string } = await res.json()

      if (data.available === false) {
        setUsernameStatus('taken')
        setUsernameError(data.reason ?? 'This name is taken')
      } else {
        setUsernameStatus('available')
        setUsernameError(null)
      }
    } catch {
      setUsernameStatus('idle')
    }
  }, [])

  const handleDisplayNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDisplayName(value)
    setUsernameStatus('idle')
    setUsernameError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      checkUsername(value)
    }, 400)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setServerError('Please select an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setServerError('Image must be less than 5MB.')
      return
    }

    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const uploadAvatar = async (file: File): Promise<string | null> => {
    setIsUploadingAvatar(true)
    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const filePath = `${userId}/avatar.${fileExt}`

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (error) {
        console.error('Avatar upload error:', error)
        return null
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      return urlData.publicUrl
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSubmit = async () => {
    setServerError(null)

    if (!displayName || displayName.length < 3) {
      setUsernameError('Display name must be at least 3 characters')
      return
    }

    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return
    if (!role) return

    setIsSubmitting(true)

    try {
      let finalAvatarUrl = avatarUrl

      // Upload avatar if a file was selected
      if (avatarFile) {
        const uploaded = await uploadAvatar(avatarFile)
        if (uploaded) {
          finalAvatarUrl = uploaded
          setAvatarUrl(uploaded)
        }
      }

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          role,
          avatar_url: finalAvatarUrl,
        }),
      })

      const data: { success?: boolean; error?: string } = await res.json()

      if (!res.ok || !data.success) {
        if (data.error?.includes('taken')) {
          setUsernameStatus('taken')
          setUsernameError('This name is already taken')
          return
        }
        setServerError(data.error ?? 'Failed to save profile. Please try again.')
        return
      }

      onSuccess(displayName, finalAvatarUrl, role)
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const avatarDisplay = avatarPreview || (displayName ? generateInitialsAvatar(displayName) : null)
  const canContinue =
    displayName.length >= 3 &&
    role !== null &&
    (usernameStatus === 'available' || usernameStatus === 'idle')

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Set up your profile</h2>
      <p className="text-zinc-400 mb-8">How should the Stampede community know you?</p>

      {serverError && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-800" role="alert">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-400">{serverError}</p>
        </div>
      )}

      {/* Avatar upload */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative group">
          <div
            className="w-24 h-24 rounded-full overflow-hidden border-4 border-zinc-700 shadow-md cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload avatar photo"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
          >
            {isUploadingAvatar ? (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-pink-400 animate-spin" aria-hidden="true" />
              </div>
            ) : avatarDisplay ? (
              <Image
                src={avatarDisplay}
                alt="Your avatar"
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <Upload className="w-8 h-8 text-zinc-600" aria-hidden="true" />
              </div>
            )}
          </div>
          {/* Overlay */}
          <div
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            aria-hidden="true"
          >
            <Upload className="w-6 h-6 text-white" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 text-sm text-pink-400 hover:text-pink-300 font-medium transition-colors"
        >
          {avatarPreview ? 'Change photo' : 'Upload photo'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
          aria-label="Upload avatar image"
        />
      </div>

      {/* Display name */}
      <div className="mb-6">
        <div className="relative">
          <Input
            label="Display name"
            type="text"
            id="display-name"
            value={displayName}
            onChange={handleDisplayNameChange}
            error={usernameError ?? undefined}
            placeholder="e.g. CountryFan42"
            hint={
              usernameStatus === 'available'
                ? undefined
                : 'Letters, numbers, and underscores only (3–30 characters)'
            }
            autoComplete="username"
            maxLength={30}
          />
          {/* Status icon */}
          {displayName.length >= 3 && (
            <div
              className="absolute right-3 top-9 flex items-center"
              aria-live="polite"
              aria-atomic="true"
            >
              {usernameStatus === 'checking' && (
                <Loader2
                  className="w-4 h-4 text-zinc-600 animate-spin"
                  aria-label="Checking availability"
                />
              )}
              {usernameStatus === 'available' && (
                <CheckCircle2
                  className="w-4 h-4 text-green-500"
                  aria-label="Name is available"
                />
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <XCircle
                  className="w-4 h-4 text-red-500"
                  aria-label="Name is not available"
                />
              )}
            </div>
          )}
        </div>
        {usernameStatus === 'available' && (
          <p className="mt-1.5 text-xs text-green-400 flex items-center gap-1" role="status">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            That name is available!
          </p>
        )}
      </div>

      {/* Role selector */}
      <fieldset className="mb-8">
        <legend className="block text-sm font-medium text-zinc-300 mb-3">
          I am a…
        </legend>
        <div className="space-y-3">
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                role === option.id
                  ? 'border-pink-500 bg-pink-950/20'
                  : 'border-zinc-700 bg-zinc-900 hover:border-pink-800 hover:bg-pink-950/20/30'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option.id}
                checked={role === option.id}
                onChange={() => setRole(option.id)}
                className="sr-only"
              />
              <span className="text-2xl flex-shrink-0" aria-hidden="true">
                {option.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{option.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{option.description}</p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  role === option.id ? 'border-pink-500 bg-pink-500' : 'border-zinc-700'
                }`}
                aria-hidden="true"
              >
                {role === option.id && (
                  <div className="w-2 h-2 rounded-full bg-zinc-900" />
                )}
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <Button
        variant="primary"
        className="w-full"
        disabled={!canContinue}
        loading={isSubmitting}
        onClick={handleSubmit}
      >
        Continue
      </Button>
    </div>
  )
}
