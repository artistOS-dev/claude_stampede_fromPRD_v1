import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'stampede_signup_state'

export type SignupState = {
  step: number
  email: string
  userId: string | null
  displayName: string
  avatarUrl: string | null
  role: 'fan' | 'artist' | 'producer' | null
  tier: 'free' | 'fan' | 'superfan' | null
  personalityTypes: string[]
  joinedCircles: string[]
  savedAt: number
}

export const saveSignupState = async (state: Partial<SignupState>) => {
  const existing = await loadSignupState()
  const updated = { ...existing, ...state, savedAt: Date.now() }
  await AsyncStorage.setItem(KEY, JSON.stringify(updated))
}

export const loadSignupState = async (): Promise<SignupState | null> => {
  const raw = await AsyncStorage.getItem(KEY)
  if (!raw) return null
  const state = JSON.parse(raw) as SignupState
  // Clear if older than 48 hours
  if (Date.now() - state.savedAt > 48 * 60 * 60 * 1000) {
    await AsyncStorage.removeItem(KEY)
    return null
  }
  return state
}

export const clearSignupState = async () => {
  await AsyncStorage.removeItem(KEY)
}
