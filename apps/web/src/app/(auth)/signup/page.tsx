import { Suspense } from 'react'
import SignupWizard from '@/components/signup/SignupWizard'

interface SignupPageProps {
  searchParams: {
    step?: string
    entry?: string
    circle?: string
    inviter?: string
  }
}

function SignupWizardWrapper({ searchParams }: SignupPageProps) {
  const initialStep = searchParams.step ? parseInt(searchParams.step, 10) : undefined
  const entryPoint = searchParams.entry
  const preselectedCircleId = searchParams.circle
  const inviterName = searchParams.inviter

  return (
    <SignupWizard
      initialStep={initialStep && initialStep >= 1 && initialStep <= 6 ? initialStep as 1 | 2 | 3 | 4 | 5 | 6 : undefined}
      entryPoint={entryPoint}
      preselectedCircleId={preselectedCircleId}
      inviterName={inviterName}
    />
  )
}

export default function SignupPage({ searchParams }: SignupPageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    }>
      <SignupWizardWrapper searchParams={searchParams} />
    </Suspense>
  )
}
