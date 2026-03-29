'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Music2 } from 'lucide-react'
import ProgressBar from './ProgressBar'
import Step1Credentials from './Step1Credentials'
import Step2Verify from './Step2Verify'
import Step3Profile from './Step3Profile'
import Step4Subscription from './Step4Subscription'
import Step5Quiz from './Step5Quiz'
import Step6Circles from './Step6Circles'

const SESSION_STORAGE_KEY = 'stampede_signup_state'

type Step = 1 | 2 | 3 | 4 | 5 | 6

interface SignupState {
  step: Step
  email: string
  userId: string | null
  displayName: string
  avatarUrl: string | null
  role: 'fan' | 'artist' | 'producer' | null
  tier: 'free' | 'fan' | 'superfan' | null
  personalityTypes: string[]
  joinedCircles: string[]
}

const DEFAULT_STATE: SignupState = {
  step: 1,
  email: '',
  userId: null,
  displayName: '',
  avatarUrl: null,
  role: null,
  tier: null,
  personalityTypes: [],
  joinedCircles: [],
}

interface SignupWizardProps {
  initialStep?: Step
  entryPoint?: string
  preselectedCircleId?: string
  inviterName?: string
}

function loadState(): SignupState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<SignupState>
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state: SignupState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

function clearState() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Ignore
  }
}

export default function SignupWizard({
  initialStep,
  entryPoint,
  preselectedCircleId,
  inviterName,
}: SignupWizardProps) {
  const router = useRouter()
  const [state, setStateRaw] = useState<SignupState>(DEFAULT_STATE)
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate from sessionStorage after mount
  useEffect(() => {
    const saved = loadState()
    // If initialStep is provided via URL (e.g., from email callback), override
    if (initialStep && initialStep > saved.step) {
      setStateRaw({ ...saved, step: initialStep })
    } else {
      setStateRaw(saved)
    }
    setIsHydrated(true)
  }, [initialStep])

  const setState = useCallback((updater: Partial<SignupState> | ((prev: SignupState) => SignupState)) => {
    setStateRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      saveState(next)
      return next
    })
  }, [])

  const goToStep = useCallback((step: Step) => {
    setState((prev) => ({ ...prev, step }))
  }, [setState])

  // Step 1 → 2
  const handleStep1Success = useCallback((email: string, userId: string) => {
    setState((prev) => ({ ...prev, email, userId, step: 2 }))
  }, [setState])

  // Step 2 → 3 (email verified)
  const handleVerified = useCallback(() => {
    setState((prev) => ({ ...prev, step: 3 }))
  }, [setState])

  // Step 3 → 4
  const handleStep3Success = useCallback(
    (displayName: string, avatarUrl: string | null, role: 'fan' | 'artist' | 'producer') => {
      setState((prev) => ({ ...prev, displayName, avatarUrl, role, step: 4 }))
    },
    [setState]
  )

  // Step 4 → 5
  const handleStep4Success = useCallback(
    (tier: 'free' | 'fan' | 'superfan') => {
      setState((prev) => ({ ...prev, tier, step: 5 }))
    },
    [setState]
  )

  // Step 5 → 6
  const handleStep5Success = useCallback(
    (personalityTypes: string[]) => {
      setState((prev) => ({ ...prev, personalityTypes, step: 6 }))
    },
    [setState]
  )

  // Step 6 → complete
  const handleStep6Success = useCallback(
    (joinedCircles: string[]) => {
      setState((prev) => ({ ...prev, joinedCircles }))
      clearState()
      router.push('/home')
    },
    [setState, router]
  )

  // Skip handlers
  const handleSkipSubscription = useCallback(() => {
    setState((prev) => ({ ...prev, tier: 'free', step: 5 }))
  }, [setState])

  const handleSkipQuiz = useCallback(() => {
    setState((prev) => ({ ...prev, personalityTypes: [], step: 6 }))
  }, [setState])

  const handleSkipCircles = useCallback(() => {
    clearState()
    router.push('/home')
  }, [router])

  const handleChangeEmail = useCallback(() => {
    setState((prev) => ({ ...prev, step: 1, email: '' }))
  }, [setState])

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"
          aria-label="Loading"
          role="status"
        />
      </div>
    )
  }

  const { step, email, userId, displayName, avatarUrl, role, personalityTypes } = state

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-4 px-4 sm:px-6">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center" aria-hidden="true">
            <Music2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-gray-900">Stampede</span>
          {entryPoint && (
            <span className="ml-auto text-xs text-gray-400">
              via {entryPoint}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-start py-8 px-4 sm:px-6">
        <div className="w-full max-w-lg">
          {/* Progress bar (shown on steps 1-6) */}
          <div className="mb-8">
            <ProgressBar currentStep={step} totalSteps={6} />
          </div>

          {/* Step card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            {step === 1 && (
              <Step1Credentials
                initialEmail={email}
                onSuccess={handleStep1Success}
              />
            )}

            {step === 2 && (
              <Step2Verify
                email={email}
                onVerified={handleVerified}
                onChangeEmail={handleChangeEmail}
              />
            )}

            {step === 3 && userId && (
              <Step3Profile
                userId={userId}
                initialDisplayName={displayName}
                initialAvatarUrl={avatarUrl}
                initialRole={role}
                onSuccess={handleStep3Success}
              />
            )}

            {step === 3 && !userId && (
              // Edge case: userId lost somehow, restart from step 1
              <Step1Credentials
                initialEmail={email}
                onSuccess={handleStep1Success}
              />
            )}

            {step === 4 && (
              <Step4Subscription
                onSuccess={handleStep4Success}
                onSkip={handleSkipSubscription}
              />
            )}

            {step === 5 && (
              <Step5Quiz
                onSuccess={handleStep5Success}
                onSkip={handleSkipQuiz}
              />
            )}

            {step === 6 && (
              <Step6Circles
                personalityTypes={personalityTypes}
                preselectedCircleId={preselectedCircleId}
                inviterName={inviterName}
                onSuccess={handleStep6Success}
                onSkip={handleSkipCircles}
              />
            )}
          </div>

          {/* Back navigation (steps 3+) */}
          {step >= 3 && step <= 5 && (
            <button
              type="button"
              onClick={() => goToStep((step - 1) as Step)}
              className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-2 text-center"
              aria-label="Go back to previous step"
            >
              ← Back
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
