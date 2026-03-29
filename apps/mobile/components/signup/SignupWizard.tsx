import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  SignupState,
  clearSignupState,
  loadSignupState,
  saveSignupState,
} from '../../lib/signupState'
import ProgressBar from './ProgressBar'
import Step1Credentials from './Step1Credentials'
import Step2Verify from './Step2Verify'
import Step3Profile from './Step3Profile'
import Step4Subscription from './Step4Subscription'
import Step5Quiz from './Step5Quiz'
import Step6Circles from './Step6Circles'

const TOTAL_STEPS = 6

export default function SignupWizard() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<Partial<SignupState>>({
    step: 1,
    email: '',
    userId: null,
    displayName: '',
    avatarUrl: null,
    role: null,
    tier: null,
    personalityTypes: [],
    joinedCircles: [],
  })

  // Load persisted state on mount
  useEffect(() => {
    const init = async () => {
      const saved = await loadSignupState()
      if (saved) {
        setState(saved)
      }
      setReady(true)
    }
    init()
  }, [])

  const currentStep = state.step ?? 1

  const updateState = async (updates: Partial<SignupState>) => {
    const merged = { ...state, ...updates }
    setState(merged)
    await saveSignupState(updates)
  }

  // Step 1 → Step 2
  const handleStep1Success = async (email: string, userId: string) => {
    await updateState({ step: 2, email, userId })
  }

  // Step 2 → Step 3 (email verified)
  const handleStep2Verified = async () => {
    await updateState({ step: 3 })
  }

  // Go back to step 1 from step 2
  const handleChangeEmail = async () => {
    await updateState({ step: 1 })
  }

  // Step 3 → Step 4
  const handleStep3Success = async (
    displayName: string,
    avatarUrl: string | null,
    role: 'fan' | 'artist' | 'producer'
  ) => {
    await updateState({ step: 4, displayName, avatarUrl, role })
  }

  // Step 4 → Step 5
  const handleStep4Success = async (tier: 'free' | 'fan' | 'superfan') => {
    await updateState({ step: 5, tier })
  }

  // Step 5 → Step 6
  const handleStep5Success = async (personalityTypes: string[]) => {
    await updateState({ step: 6, personalityTypes })
  }

  // Step 5 skip
  const handleStep5Skip = async () => {
    await updateState({ step: 6, personalityTypes: [] })
  }

  // Step 6 → Done
  const handleStep6Success = async (joinedCircles: string[]) => {
    await updateState({ joinedCircles })
    await clearSignupState()
    router.replace('/(main)/home')
  }

  // Step 6 skip
  const handleStep6Skip = async () => {
    await clearSignupState()
    router.replace('/(main)/home')
  }

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center">
        <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center">
          <Text className="text-orange-500 text-xs font-bold">S</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1">
      {/* Logo row */}
      <View className="px-6 pt-6 pb-2 flex-row items-center gap-3">
        <View className="w-8 h-8 bg-orange-500 rounded-lg items-center justify-center">
          <Text className="text-white font-bold text-sm">S</Text>
        </View>
        <Text className="text-gray-900 font-bold text-base">Stampede</Text>
      </View>

      {/* Progress bar — hidden on step 6 celebration */}
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      {/* Step content */}
      <View className="flex-1">
        {currentStep === 1 && (
          <Step1Credentials
            initialEmail={state.email}
            onSuccess={handleStep1Success}
          />
        )}
        {currentStep === 2 && (
          <Step2Verify
            email={state.email ?? ''}
            onVerified={handleStep2Verified}
            onChangeEmail={handleChangeEmail}
          />
        )}
        {currentStep === 3 && (
          <Step3Profile
            initialDisplayName={state.displayName}
            initialAvatarUrl={state.avatarUrl}
            initialRole={state.role}
            userId={state.userId ?? ''}
            onSuccess={handleStep3Success}
          />
        )}
        {currentStep === 4 && (
          <Step4Subscription
            initialTier={state.tier}
            onSuccess={handleStep4Success}
          />
        )}
        {currentStep === 5 && (
          <Step5Quiz
            initialPersonalityTypes={state.personalityTypes}
            onSuccess={handleStep5Success}
            onSkip={handleStep5Skip}
          />
        )}
        {currentStep === 6 && (
          <Step6Circles
            userId={state.userId ?? ''}
            initialJoined={state.joinedCircles}
            onSuccess={handleStep6Success}
            onSkip={handleStep6Skip}
          />
        )}
      </View>
    </View>
  )
}
