'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mail, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'

interface Step2Props {
  email: string
  onVerified: () => void
  onChangeEmail: () => void
}

const RESEND_COOLDOWN_SECONDS = 60
const MAX_RESENDS = 5
const POLL_INTERVAL_MS = 5000

export default function Step2Verify({ email, onVerified, onChangeEmail }: Step2Props) {
  const [resendCount, setResendCount] = useState(0)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS)
  const [isResending, setIsResending] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState(false)

  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const onVerifiedRef = useRef(onVerified)
  onVerifiedRef.current = onVerified

  // Start initial cooldown
  useEffect(() => {
    setCountdown(RESEND_COOLDOWN_SECONDS)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Poll for session
  const checkVerification = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email_confirmed_at) {
      onVerifiedRef.current()
    }
  }, [])

  useEffect(() => {
    pollRef.current = setInterval(checkVerification, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [checkVerification])

  const handleResend = async () => {
    if (countdown > 0 || resendCount >= MAX_RESENDS || isResending) return

    setIsResending(true)
    setResendError(null)
    setResendSuccess(false)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        if (error.message.toLowerCase().includes('rate limit') || error.status === 429) {
          setResendError('Too many attempts. Please wait before resending.')
        } else {
          setResendError(error.message)
        }
        return
      }

      setResendCount((prev) => prev + 1)
      setResendSuccess(true)
      setCountdown(RESEND_COOLDOWN_SECONDS)

      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch {
      setResendError('Failed to resend. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  const canResend = countdown === 0 && resendCount < MAX_RESENDS && !isResending

  return (
    <div className="text-center">
      {/* Animated envelope */}
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pink-900/30 mb-6 animate-envelope-float"
        aria-hidden="true"
      >
        <Mail className="w-10 h-10 text-pink-400" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">Check your inbox</h2>
      <p className="text-zinc-400 mb-2">
        We sent a verification link to:
      </p>
      <p className="text-white font-semibold mb-6 break-all">{email}</p>

      <div className="bg-pink-950/20 border border-pink-800 rounded-xl p-4 mb-6 text-left">
        <p className="text-sm text-pink-200">
          <span className="font-medium">Next step:</span> Open the email and click the link
          to verify your address. This page will update automatically.
        </p>
      </div>

      {/* Status messages */}
      {resendError && (
        <div
          className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-800"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-400">{resendError}</p>
        </div>
      )}

      {resendSuccess && (
        <div
          className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-green-950/30 border border-green-800"
          role="status"
        >
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-green-400">Verification email resent successfully.</p>
        </div>
      )}

      {/* Resend button */}
      <div className="space-y-3">
        {resendCount < MAX_RESENDS ? (
          <Button
            variant="secondary"
            onClick={handleResend}
            disabled={!canResend}
            loading={isResending}
            className="w-full"
            aria-label={
              countdown > 0
                ? `Resend email, available in ${countdown} seconds`
                : 'Resend verification email'
            }
          >
            {isResending ? (
              'Sending…'
            ) : countdown > 0 ? (
              <>
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Resend in {countdown}s
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Resend email
              </>
            )}
          </Button>
        ) : (
          <p className="text-sm text-zinc-500">
            Maximum resends reached. Check your spam folder.
          </p>
        )}

        <button
          type="button"
          onClick={onChangeEmail}
          className="w-full text-sm text-pink-400 hover:text-pink-300 font-medium transition-colors py-2"
        >
          Change email address
        </button>
      </div>

      {/* Spam note */}
      <p className="mt-4 text-xs text-zinc-600">
        Can&apos;t find it? Check your spam or junk folder.
      </p>
    </div>
  )
}
