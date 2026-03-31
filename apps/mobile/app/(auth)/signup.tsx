import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import SignupWizard from '../../components/signup/SignupWizard'

export default function SignupScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <SignupWizard />
    </SafeAreaView>
  )
}
