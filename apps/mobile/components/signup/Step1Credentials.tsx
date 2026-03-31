import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { saveSignupState } from '../../lib/signupState'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface Step1Props {
  initialEmail?: string
  onSuccess: (email: string, userId: string) => void
}

type PasswordStrength = 'none' | 'weak' | 'fair' | 'good' | 'strong'

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'none'
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (score <= 1) return 'weak'
  if (score === 2) return 'fair'
  if (score === 3) return 'good'
  return 'strong'
}

const strengthConfig: Record<
  Exclude<PasswordStrength, 'none'>,
  { label: string; barColor: string; bars: number }
> = {
  weak: { label: 'Weak', barColor: 'bg-red-400', bars: 1 },
  fair: { label: 'Fair', barColor: 'bg-yellow-400', bars: 2 },
  good: { label: 'Good', barColor: 'bg-blue-400', bars: 3 },
  strong: { label: 'Strong', barColor: 'bg-green-500', bars: 4 },
}

export default function Step1Credentials({ initialEmail = '', onSuccess }: Step1Props) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})

  const strength = getPasswordStrength(password)
  const meetsLength = password.length >= 8
  const meetsNumber = /[0-9]/.test(password)
  const meetsSpecial = /[^A-Za-z0-9]/.test(password)

  const validate = () => {
    const errs: typeof errors = {}
    if (!email.trim()) {
      errs.email = 'Email address is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Please enter a valid email address'
    }
    if (!password) {
      errs.password = 'Password is required'
    } else if (!meetsLength) {
      errs.password = 'Password must be at least 8 characters'
    } else if (!meetsNumber) {
      errs.password = 'Password must contain at least one number'
    } else if (!meetsSpecial) {
      errs.password = 'Password must contain at least one special character'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    setErrors({})

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    setLoading(false)

    if (error) {
      if (
        error.message.toLowerCase().includes('user already registered') ||
        error.message.toLowerCase().includes('already been registered') ||
        error.message.toLowerCase().includes('email address is already')
      ) {
        setErrors({ email: 'An account with this email already exists. Try logging in.' })
      } else {
        setErrors({ general: error.message })
      }
      return
    }

    const userId = data.user?.id ?? null
    await saveSignupState({ step: 2, email: email.trim(), userId })
    onSuccess(email.trim(), userId ?? '')
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
            <Text className="text-gray-900 font-bold text-2xl mb-2">Create your account</Text>
            <Text className="text-gray-500 text-base">
              Join the home of country music. It only takes a minute.
            </Text>
          </View>

          {/* General error */}
          {errors.general ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex-row items-start">
              <Text className="text-red-500 font-bold mr-2">!</Text>
              <Text className="text-red-700 flex-1 text-sm">{errors.general}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View className="gap-5 mb-6">
            <Input
              label="Email address"
              value={email}
              onChangeText={(t) => {
                setEmail(t)
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }))
              }}
              error={errors.email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />

            <View>
              <Input
                label="Password"
                value={password}
                onChangeText={(t) => {
                  setPassword(t)
                  if (errors.password) setErrors((e) => ({ ...e, password: undefined }))
                }}
                error={errors.password}
                placeholder="Create a strong password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                rightElement={
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    className="px-3 py-2"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Text className="text-orange-500 text-sm font-medium">
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                }
              />

              {/* Password strength meter */}
              {password.length > 0 && strength !== 'none' ? (
                <View className="mt-3">
                  <View className="flex-row gap-1.5 mb-2">
                    {[1, 2, 3, 4].map((bar) => (
                      <View
                        key={bar}
                        className={`flex-1 h-1.5 rounded-full ${
                          bar <= strengthConfig[strength].bars
                            ? strengthConfig[strength].barColor
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </View>
                  <Text
                    className={`text-xs font-medium ${
                      strength === 'weak'
                        ? 'text-red-500'
                        : strength === 'fair'
                        ? 'text-yellow-500'
                        : strength === 'good'
                        ? 'text-blue-500'
                        : 'text-green-600'
                    }`}
                  >
                    {strengthConfig[strength].label}
                  </Text>
                </View>
              ) : null}

              {/* Requirements checklist */}
              {password.length > 0 ? (
                <View className="mt-3 gap-1.5">
                  <RequirementRow met={meetsLength} text="At least 8 characters" />
                  <RequirementRow met={meetsNumber} text="At least 1 number" />
                  <RequirementRow met={meetsSpecial} text="At least 1 special character (!@#$...)" />
                </View>
              ) : null}
            </View>
          </View>

          <Button
            label="Continue"
            onPress={handleSubmit}
            loading={loading}
            variant="primary"
            fullWidth
            size="lg"
          />

          <Text className="text-gray-400 text-xs text-center mt-4 px-2">
            By continuing, you agree to Stampede's Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function RequirementRow({ met, text }: { met: boolean; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        className={`w-4 h-4 rounded-full items-center justify-center ${
          met ? 'bg-green-500' : 'bg-gray-200'
        }`}
      >
        {met ? <Text className="text-white text-xs font-bold">✓</Text> : null}
      </View>
      <Text className={`text-xs ${met ? 'text-green-600' : 'text-gray-500'}`}>{text}</Text>
    </View>
  )
}
