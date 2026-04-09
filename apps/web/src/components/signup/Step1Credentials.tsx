'use client'

import { useState, useCallback } from 'react'
import { Eye, EyeOff, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { COMMON_PASSWORDS } from '@/lib/constants'
import Link from 'next/link'

interface Step1Props {
  initialEmail?: string
  onSuccess: (email: string, userId: string) => void
}

interface PasswordStrength {
  score: 0 | 1 | 2 | 3
  label: 'Weak' | 'Fair' | 'Good' | 'Strong'
  color: string
  width: string
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'Weak', color: 'bg-red-400', width: '0%' }
  }

  const isCommon = COMMON_PASSWORDS.includes(password.toLowerCase())
  if (isCommon) {
    return { score: 0, label: 'Weak', color: 'bg-red-400', width: '25%' }
  }

  let score = 0
  if (password.length >= 8) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (password.length >= 12) score++

  const levels: PasswordStrength[] = [
    { score: 0, label: 'Weak', color: 'bg-red-400', width: '25%' },
    { score: 1, label: 'Weak', color: 'bg-red-400', width: '25%' },
    { score: 2, label: 'Fair', color: 'bg-yellow-400', width: '50%' },
    { score: 3, label: 'Good', color: 'bg-blue-400', width: '75%' },
    { score: 3, label: 'Strong', color: 'bg-green-950/300', width: '100%' },
  ]

  return levels[Math.min(score, 4)] as PasswordStrength
}

function validateEmail(email: string): string | null {
  if (!email) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character'
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) return 'This password is too common. Please choose a stronger one.'
  return null
}

export default function Step1Credentials({ initialEmail = '', onSuccess }: Step1Props) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [emailExists, setEmailExists] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const strength = getPasswordStrength(password)
  const has8Chars = password.length >= 8
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)

  const handleEmailBlur = useCallback(() => {
    const err = validateEmail(email)
    setEmailError(err)
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setEmailExists(false)

    const emailErr = validateEmail(email)
    const passwordErr = validatePassword(password)

    setEmailError(emailErr)
    setPasswordError(passwordErr)

    if (emailErr || passwordErr) return

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        if (
          error.message.toLowerCase().includes('user already registered') ||
          error.message.toLowerCase().includes('already been registered') ||
          error.message.toLowerCase().includes('already exists')
        ) {
          setEmailExists(true)
          return
        }
        if (error.message.toLowerCase().includes('rate limit') || error.status === 429) {
          setServerError('Too many attempts. Please wait a minute and try again.')
          return
        }
        setServerError(error.message)
        return
      }

      if (data.user) {
        onSuccess(email, data.user.id)
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
      <p className="text-zinc-400 mb-8">Join thousands of country music fans on Stampede.</p>

      {serverError && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-800" role="alert">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-400">{serverError}</p>
        </div>
      )}

      {emailExists && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200" role="alert">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-amber-700">
            An account with this email exists.{' '}
            <Link
              href={`/login?email=${encodeURIComponent(email)}`}
              className="font-semibold underline underline-offset-2 hover:text-amber-800 transition-colors"
            >
              Log in instead &rarr;
            </Link>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input
          label="Email address"
          type="email"
          id="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (emailError) setEmailError(null)
            if (emailExists) setEmailExists(false)
          }}
          onBlur={handleEmailBlur}
          error={emailError ?? undefined}
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-required="true"
        />

        <div>
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (passwordError) setPasswordError(null)
              }}
              error={passwordError ?? undefined}
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              aria-required="true"
              aria-describedby="password-requirements"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-zinc-600 hover:text-zinc-400 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Strength meter */}
          {password && (
            <div className="mt-2" aria-live="polite" aria-atomic="true">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500">Password strength</span>
                <span
                  className={`text-xs font-medium ${
                    strength.label === 'Weak'
                      ? 'text-red-500'
                      : strength.label === 'Fair'
                      ? 'text-yellow-400'
                      : strength.label === 'Good'
                      ? 'text-blue-400'
                      : 'text-green-400'
                  }`}
                >
                  {strength.label}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: strength.width }}
                />
              </div>
            </div>
          )}

          {/* Requirements checklist */}
          <ul
            id="password-requirements"
            className="mt-3 space-y-1.5"
            aria-label="Password requirements"
          >
            <RequirementItem met={has8Chars} text="At least 8 characters" />
            <RequirementItem met={hasNumber} text="At least 1 number" />
            <RequirementItem met={hasSpecial} text="At least 1 special character (!@#$...)" />
          </ul>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          loading={isLoading}
        >
          Continue
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-400 mt-6">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-pink-400 hover:text-pink-300 font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      {met ? (
        <CheckCircle2
          className="w-3.5 h-3.5 text-green-500 flex-shrink-0"
          aria-hidden="true"
        />
      ) : (
        <XCircle
          className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0"
          aria-hidden="true"
        />
      )}
      <span
        className={`text-xs transition-colors ${met ? 'text-green-400' : 'text-zinc-600'}`}
        aria-label={`${text}: ${met ? 'met' : 'not met'}`}
      >
        {text}
      </span>
    </li>
  )
}
