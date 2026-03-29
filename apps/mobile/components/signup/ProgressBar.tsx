import { useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current

  const progress = currentStep / totalSteps

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start()
  }, [progress])

  return (
    <View className="px-6 pt-4 pb-2">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-500 text-xs font-medium">
          Step {currentStep} of {totalSteps}
        </Text>
        <Text className="text-orange-500 text-xs font-semibold">
          {Math.round(progress * 100)}%
        </Text>
      </View>
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <Animated.View
          className="h-full bg-orange-500 rounded-full"
          style={{
            width: animatedWidth.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>
    </View>
  )
}
