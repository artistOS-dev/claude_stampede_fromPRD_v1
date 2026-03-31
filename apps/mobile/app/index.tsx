import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function IndexScreen() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace('/(main)/home')
      } else {
        router.replace('/(auth)/signup')
      }
    }

    checkAuth()
  }, [])

  return (
    <View className="flex-1 items-center justify-center bg-orange-500">
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  )
}
