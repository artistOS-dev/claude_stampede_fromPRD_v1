'use client'

import { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react'
import Image from 'next/image'
import { Upload, CheckCircle2, XCircle, Loader2, AlertCircle, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type Role = 'fan' | 'artist_manager' | 'stampede_producer'

interface Step3Props {
  userId: string
  initialDisplayName?: string
  initialAvatarUrl?: string | null
  initialRole?: Role | null
  onSuccess: (displayName: string, avatarUrl: string | null, role: Role) => void
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
type KeyStatus = 'idle' | 'checking' | 'valid' | 'invalid'

const ROLE_OPTIONS: { id: Role; label: string; description: string; emoji: string; privileged?: true }[] = [
  { id: 'fan',               label: 'Fan',               description: "I'm here to discover and celebrate music",        emoji: '🎵' },
  { id: 'artist_manager',    label: 'Artist Manager',    description: "I manage artists or perform country music",       emoji: '🎸', privileged: true },
  { id: 'stampede_producer', label: 'Stampede Producer', description: "I create circles and curate the community",      emoji: '🎙️', privileged: true },
]

const PRIVILEGED_ROLES: Role[] = ['artist_manager', 'stampede_producer']

function generateInitialsAvatar(name: string): string {
  const initials = name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const colors = ['#F97316', '#EA580C', '#C2410C', '#FB923C', '#FDBA74']
  const bg = colors[name.charCodeAt(0) % colors.length]
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
  const [displayName, setDisplayName]         = useState(initialDisplayName)
  const [avatarUrl, setAvatarUrl]             = useState<string | null>(initialAvatarUrl)
  const [avatarFile, setAvatarFile]           = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview]     = useState<string | null>(initialAvatarUrl)
  const [role, setRole]                       = useState<Role | null>(initialRole)
  const [roleKey, setRoleKey]                 = useState('')
  const [keyStatus, setKeyStatus]             = useState<KeyStatus>('idle')
  const [keyError, setKeyError]               = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus]   = useState<UsernameStatus>('idle')
  const [usernameError, setUsernameError]     = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting]       = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [serverError, setServerError]         = useState<string | null>(null)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const debounceRef   = useRef<NodeJS.Timeout | null>(null)

  // Reset key state when role changes
  useEffect(() => {
    setRoleKey('')
    setKeyStatus('idle')
    setKeyError(null)
  }, [role])

  const isPrivilegedRole = role !== null && PRIVILEGED_ROLES.includes(role)

  const checkUsername = useCallback(async (name: string) => {
    if (!name || name.length < 3) { setUsernameStatus('idle'); return }
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
    } catch { setUsernameStatus('idle') }
  }, [])

  const handleDisplayNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDisplayName(value)
    setUsernameStatus('idle')
    setUsernameError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => checkUsername(value), 400)
  }

  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current) } }, [])

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setServerError('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setServerError('Image must be less than 5MB.'); return }
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
      const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
      if (error) { console.error('Avatar upload error:', error); return null }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      return urlData.publicUrl
    } finally { setIsUploadingAvatar(false) }
  }

  const validateRoleKey = async (): Promise<boolean> => {
    if (!role || !isPrivilegedRole) return true
    if (!roleKey.trim()) {
      setKeyError('Role access code is required')
      return false
    }
    setKeyStatus('checking')
    setKeyError(null)
    try {
      const res = await fetch('/api/auth/validate-role-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, key: roleKey.trim() }),
      })
      const data: { valid?: boolean } = await res.json()
      if (data.valid) {
        setKeyStatus('valid')
        return true
      } else {
        setKeyStatus('invalid')
        setKeyError('Invalid access code. Contact your Stampede administrator.')
        return false
      }
    } catch {
      setKeyStatus('invalid')
      setKeyError('Could not verify access code. Please try again.')
      return false
    }
  }

  const handleSubmit = async () => {
    setServerError(null)
    if (!displayName || displayName.length < 3) { setUsernameError('Display name must be at least 3 characters'); return }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return
    if (!role) return

    setIsSubmitting(true)
    try {
      // Validate privileged role key before saving anything
      if (isPrivilegedRole) {
        const keyOk = await validateRoleKey()
        if (!keyOk) { setIsSubmitting(false); return }
      }

      let finalAvatarUrl = avatarUrl
      if (avatarFile) {
        const uploaded = await uploadAvatar(avatarFile)
        if (uploaded) { finalAvatarUrl = uploaded; setAvatarUrl(uploaded) }
      }

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, role, avatar_url: finalAvatarUrl }),
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
    (usernameStatus === 'available' || usernameStatus === 'idle') &&
    (!isPrivilegedRole || roleKey.trim().length > 0)

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Set up your profile</h2>
      <p className="text-stone-400 mb-8">How should the Stampede community know you?</p>

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
            className="w-24 h-24 rounded-full overflow-hidden border-4 border-stone-700 shadow-md cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            role="button" tabIndex={0} aria-label="Upload avatar photo"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          >
            {isUploadingAvatar ? (
              <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" aria-hidden="true" />
              </div>
            ) : avatarDisplay ? (
              <Image src={avatarDisplay} alt="Your avatar" width={96} height={96} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                <Upload className="w-8 h-8 text-stone-600" aria-hidden="true" />
              </div>
            )}
          </div>
          <div
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => fileInputRef.current?.click()} aria-hidden="true"
          >
            <Upload className="w-6 h-6 text-white" />
          </div>
        </div>
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="mt-3 text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors">
          {avatarPreview ? 'Change photo' : 'Upload photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange}
          className="hidden" aria-label="Upload avatar image" />
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
            hint={usernameStatus === 'available' ? undefined : 'Letters, numbers, and underscores only (3–30 characters)'}
            autoComplete="username"
            maxLength={30}
          />
          {displayName.length >= 3 && (
            <div className="absolute right-3 top-9 flex items-center" aria-live="polite" aria-atomic="true">
              {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-stone-600 animate-spin" aria-label="Checking availability" />}
              {usernameStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-green-500" aria-label="Name is available" />}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <XCircle className="w-4 h-4 text-red-500" aria-label="Name is not available" />}
            </div>
          )}
        </div>
        {usernameStatus === 'available' && (
          <p className="mt-1.5 text-xs text-green-400 flex items-center gap-1" role="status">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> That name is available!
          </p>
        )}
      </div>

      {/* Role selector */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-medium text-stone-300 mb-3">I am a…</legend>
        <div className="space-y-3">
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                role === option.id
                  ? 'border-amber-500 bg-amber-950/20'
                  : 'border-stone-700 bg-stone-900 hover:border-amber-800 hover:bg-amber-950/20/30'
              }`}
            >
              <input type="radio" name="role" value={option.id} checked={role === option.id}
                onChange={() => setRole(option.id)} className="sr-only" />
              <span className="text-2xl flex-shrink-0" aria-hidden="true">{option.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{option.label}</p>
                  {option.privileged && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700">
                      <Lock className="w-2.5 h-2.5" aria-hidden="true" /> Privileged
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{option.description}</p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  role === option.id ? 'border-amber-500 bg-amber-500' : 'border-stone-700'
                }`}
                aria-hidden="true"
              >
                {role === option.id && <div className="w-2 h-2 rounded-full bg-stone-900" />}
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Role access code — shown only for privileged roles */}
      {isPrivilegedRole && (
        <div className="mb-8 p-4 rounded-xl border border-amber-800 bg-amber-950/10">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-amber-300">Role Access Code Required</p>
          </div>
          <p className="text-xs text-stone-400 mb-3">
            This role requires a secret access code provided by a Stampede administrator.
          </p>
          <div className="relative">
            <input
              type="password"
              value={roleKey}
              onChange={(e) => {
                setRoleKey(e.target.value)
                setKeyStatus('idle')
                setKeyError(null)
              }}
              placeholder="Enter your access code"
              autoComplete="off"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-stone-900 text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors ${
                keyStatus === 'invalid' ? 'border-red-600' : keyStatus === 'valid' ? 'border-green-600' : 'border-stone-700'
              }`}
              aria-label="Role access code"
              aria-describedby={keyError ? 'key-error' : undefined}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {keyStatus === 'checking' && <Loader2 className="w-4 h-4 text-stone-500 animate-spin" aria-hidden="true" />}
              {keyStatus === 'valid'    && <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden="true" />}
              {keyStatus === 'invalid'  && <XCircle className="w-4 h-4 text-red-500" aria-hidden="true" />}
            </div>
          </div>
          {keyError && (
            <p id="key-error" className="mt-2 text-xs text-red-400 flex items-center gap-1" role="alert">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /> {keyError}
            </p>
          )}
        </div>
      )}

      <Button variant="primary" className="w-full" disabled={!canContinue} loading={isSubmitting} onClick={handleSubmit}>
        Continue
      </Button>
    </div>
  )
}
