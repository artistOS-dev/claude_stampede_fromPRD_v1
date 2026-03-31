import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email'
    }
    if (!password) {
      newErrors.password = 'Password is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleLogin = async () => {
    if (!validate()) return
    setLoading(true)
    setErrors({})

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrors({ general: 'Incorrect email or password. Please try again.' })
      } else if (error.message.includes('Email not confirmed')) {
        setErrors({ general: 'Please verify your email before logging in.' })
      } else {
        setErrors({ general: error.message })
      }
    } else {
      router.replace('/(main)/home')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-8">
            {/* Header */}
            <View className="mb-8">
              <View className="w-12 h-12 bg-orange-500 rounded-xl items-center justify-center mb-4">
                <Text className="text-white text-xl font-bold">S</Text>
              </View>
              <Text className="text-gray-900 font-bold text-3xl mb-2">Welcome back</Text>
              <Text className="text-gray-500 text-base">Sign in to your Stampede account</Text>
            </View>

            {/* General Error */}
            {errors.general && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex-row items-start">
                <Text className="text-red-500 mr-2 text-base">!</Text>
                <Text className="text-red-700 flex-1 text-sm">{errors.general}</Text>
              </View>
            )}

            {/* Form */}
            <View className="gap-4 mb-6">
              <Input
                label="Email address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text)
                  if (errors.email) setErrors((e) => ({ ...e, email: undefined }))
                }}
                error={errors.email}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Input
                label="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text)
                  if (errors.password) setErrors((e) => ({ ...e, password: undefined }))
                }}
                error={errors.password}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                rightElement={
                  <Pressable onPress={() => setShowPassword(!showPassword)} className="px-3 py-2">
                    <Text className="text-orange-500 text-sm font-medium">
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                }
              />
            </View>

            <Button
              label="Sign in"
              onPress={handleLogin}
              loading={loading}
              variant="primary"
              fullWidth
            />

            {/* Footer Links */}
            <View className="mt-8 items-center gap-4">
              <Pressable>
                <Text className="text-orange-500 font-medium text-sm">Forgot your password?</Text>
              </Pressable>

              <View className="flex-row items-center gap-1">
                <Text className="text-gray-500 text-sm">Don't have an account?</Text>
                <Pressable onPress={() => router.replace('/(auth)/signup')}>
                  <Text className="text-orange-500 font-medium text-sm">Sign up</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
