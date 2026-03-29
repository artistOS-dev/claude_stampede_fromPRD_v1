import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'

interface Step2Props {
  email: string
  onVerified: () => void
  onChangeEmail: () => void
}

const RESEND_COOLDOWN = 60
const MAX_RESENDS = 5

export default function Step2Verify({ email, onVerified, onChangeEmail }: Step2Props) {
  const [countdown, setCountdown] = useState(0)
  const [resendCount, setResendCount] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll for session every 5 seconds
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        clearInterval(pollRef.current!)
        onVerified()
      }
    }, 5000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [onVerified])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timerRef.current!)
            return 0
          }
          return c - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [countdown])

  const handleResend = async () => {
    if (resendCount >= MAX_RESENDS) {
      setResendError('Maximum resend attempts reached. Please try again later or contact support.')
      return
    }

    setResending(true)
    setResendMessage('')
    setResendError('')

    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)

    if (error) {
      setResendError(error.message)
    } else {
      setResendCount((c) => c + 1)
      setCountdown(RESEND_COOLDOWN)
      setResendMessage('Verification email sent! Check your inbox.')
    }
  }

  const canResend = countdown === 0 && resendCount < MAX_RESENDS && !resending

  return (
    <View className="flex-1 px-6 pt-8 pb-8">
      {/* Icon */}
      <View className="items-center mb-8">
        <View className="w-20 h-20 bg-orange-50 rounded-full items-center justify-center mb-4">
          <Text style={{ fontSize: 36 }}>📧</Text>
        </View>
        <Text className="text-gray-900 font-bold text-2xl text-center mb-3">
          Check your inbox
        </Text>
        <Text className="text-gray-500 text-base text-center leading-6">
          We've sent a verification link to
        </Text>
        <Text className="text-orange-500 font-semibold text-base text-center mt-1">{email}</Text>
        <Text className="text-gray-500 text-base text-center mt-2 leading-6">
          Click the link in the email to verify your account and continue.
        </Text>
      </View>

      {/* Status messages */}
      {resendMessage ? (
        <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex-row items-start">
          <Text className="text-green-600 font-bold mr-2">✓</Text>
          <Text className="text-green-700 flex-1 text-sm">{resendMessage}</Text>
        </View>
      ) : null}
      {resendError ? (
        <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex-row items-start">
          <Text className="text-red-500 font-bold mr-2">!</Text>
          <Text className="text-red-700 flex-1 text-sm">{resendError}</Text>
        </View>
      ) : null}

      {/* Polling indicator */}
      <View className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex-row items-center gap-3">
        <View className="w-2 h-2 bg-orange-400 rounded-full" />
        <Text className="text-orange-700 text-sm flex-1">
          Waiting for verification… this page will automatically continue once you verify.
        </Text>
      </View>

      {/* Resend */}
      <View className="items-center gap-3">
        <Text className="text-gray-500 text-sm">Didn't receive the email?</Text>

        {countdown > 0 ? (
          <Text className="text-gray-400 text-sm">
            Resend available in {countdown}s
          </Text>
        ) : null}

        <Button
          label={resending ? 'Sending…' : `Resend email${resendCount > 0 ? ` (${MAX_RESENDS - resendCount} left)` : ''}`}
          onPress={handleResend}
          loading={resending}
          disabled={!canResend}
          variant="secondary"
        />

        {resendCount >= MAX_RESENDS ? (
          <Text className="text-gray-400 text-xs text-center">
            Maximum resend attempts reached.
          </Text>
        ) : null}
      </View>

      {/* Change email */}
      <View className="mt-8 items-center">
        <Pressable onPress={onChangeEmail} accessibilityRole="link">
          <Text className="text-orange-500 font-medium text-sm">
            Change email address
          </Text>
        </Pressable>
      </View>

      {/* Hint */}
      <View className="mt-6">
        <Text className="text-gray-400 text-xs text-center leading-5">
          Check your spam folder if you don't see it. The link expires in 24 hours.
        </Text>
      </View>
    </View>
  )
}
