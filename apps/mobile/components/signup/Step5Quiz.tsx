import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { PERSONALITY_TYPES, QUIZ_QUESTIONS } from '../../lib/constants'
import { saveSignupState } from '../../lib/signupState'
import Button from '../ui/Button'

interface Step5Props {
  initialAnswers?: number[]
  initialPersonalityTypes?: string[]
  onSuccess: (personalityTypes: string[]) => void
  onSkip: () => void
}

type Phase = 'quiz' | 'personality'

export default function Step5Quiz({
  initialAnswers = [],
  initialPersonalityTypes = [],
  onSuccess,
  onSkip,
}: Step5Props) {
  const [phase, setPhase] = useState<Phase>('quiz')
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<number[]>(initialAnswers)
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>(
    initialPersonalityTypes
  )
  const [submitting, setSubmitting] = useState(false)

  const question = QUIZ_QUESTIONS[currentQ]
  const isLastQuestion = currentQ === QUIZ_QUESTIONS.length - 1
  const currentAnswer = answers[currentQ] ?? -1

  const handleAnswer = (optionIndex: number) => {
    const updated = [...answers]
    updated[currentQ] = optionIndex
    setAnswers(updated)
  }

  const handleNext = () => {
    if (currentAnswer === -1) return
    if (isLastQuestion) {
      setPhase('personality')
    } else {
      setCurrentQ((q) => q + 1)
    }
  }

  const handleBack = () => {
    if (currentQ > 0) {
      setCurrentQ((q) => q - 1)
    }
  }

  const togglePersonality = (id: string) => {
    setSelectedPersonalities((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= 3) {
        // Replace the last selected with the new one
        return [...prev.slice(0, 2), id]
      }
      return [...prev, id]
    })
  }

  const handleFinishQuiz = async () => {
    setSubmitting(true)
    await saveSignupState({ step: 6, personalityTypes: selectedPersonalities })
    setSubmitting(false)
    onSuccess(selectedPersonalities)
  }

  const handleSkip = async () => {
    await saveSignupState({ step: 6, personalityTypes: [] })
    onSkip()
  }

  if (phase === 'personality') {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6 pb-8">
          {/* Header */}
          <View className="mb-2">
            <Text className="text-gray-900 font-bold text-2xl mb-2">
              Your music personality
            </Text>
            <Text className="text-gray-500 text-base">
              Pick up to 3 that resonate with you most.
            </Text>
          </View>

          {/* Selected count */}
          <View className="flex-row items-center gap-2 mb-6">
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  selectedPersonalities.length >= n ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedPersonalities.length >= n ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {n}
                </Text>
              </View>
            ))}
            <Text className="text-gray-500 text-sm ml-1">
              {selectedPersonalities.length}/3 selected
            </Text>
          </View>

          {/* Personality grid */}
          <View className="gap-3 mb-8">
            {PERSONALITY_TYPES.map((pt) => {
              const isSelected = selectedPersonalities.includes(pt.id)
              return (
                <Pressable
                  key={pt.id}
                  onPress={() => togglePersonality(pt.id)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  className={`flex-row items-center p-4 rounded-2xl border-2 ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={pt.label}
                >
                  <View className="flex-1">
                    <Text
                      className={`font-semibold text-base ${
                        isSelected ? 'text-orange-600' : 'text-gray-900'
                      }`}
                    >
                      {pt.label}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-0.5">{pt.description}</Text>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                    }`}
                  >
                    {isSelected ? (
                      <Text className="text-white text-xs font-bold">✓</Text>
                    ) : null}
                  </View>
                </Pressable>
              )
            })}
          </View>

          <Button
            label={submitting ? 'Saving…' : 'Continue'}
            onPress={handleFinishQuiz}
            loading={submitting}
            disabled={selectedPersonalities.length === 0}
            variant="primary"
            fullWidth
            size="lg"
          />

          <Pressable onPress={handleSkip} className="mt-4 items-center" accessibilityRole="button">
            <Text className="text-gray-400 text-sm">Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>
    )
  }

  return (
    <View className="flex-1 px-6 pt-6 pb-8">
      {/* Question header */}
      <View className="mb-8">
        <Text className="text-orange-500 font-semibold text-sm mb-2">
          Question {currentQ + 1} of {QUIZ_QUESTIONS.length}
        </Text>
        <Text className="text-gray-900 font-bold text-2xl leading-8">
          {question.question}
        </Text>
      </View>

      {/* Question progress dots */}
      <View className="flex-row gap-2 mb-8">
        {QUIZ_QUESTIONS.map((_, idx) => (
          <View
            key={idx}
            className={`rounded-full ${
              idx === currentQ
                ? 'bg-orange-500 w-6 h-2'
                : idx < currentQ
                ? 'bg-orange-300 w-2 h-2'
                : 'bg-gray-200 w-2 h-2'
            }`}
          />
        ))}
      </View>

      {/* Answer options */}
      <View className="gap-3 flex-1">
        {question.options.map((option, idx) => {
          const isSelected = currentAnswer === idx
          return (
            <Pressable
              key={idx}
              onPress={() => handleAnswer(idx)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              className={`p-4 rounded-2xl border-2 flex-row items-center gap-3 ${
                isSelected
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={option}
            >
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                }`}
              >
                {isSelected ? (
                  <View className="w-2.5 h-2.5 rounded-full bg-white" />
                ) : null}
              </View>
              <Text
                className={`flex-1 text-base font-medium ${
                  isSelected ? 'text-orange-700' : 'text-gray-800'
                }`}
              >
                {option}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Navigation */}
      <View className="flex-row gap-3 mt-6">
        {currentQ > 0 ? (
          <Pressable
            onPress={handleBack}
            className="flex-1 py-4 rounded-xl border-2 border-gray-200 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Previous question"
          >
            <Text className="text-gray-700 font-semibold text-base">Back</Text>
          </Pressable>
        ) : null}

        <View className={currentQ > 0 ? 'flex-1' : 'flex-1'}>
          <Button
            label={isLastQuestion ? 'See results' : 'Next'}
            onPress={handleNext}
            disabled={currentAnswer === -1}
            variant="primary"
            fullWidth
            size="lg"
          />
        </View>
      </View>

      {/* Skip */}
      <Pressable onPress={handleSkip} className="mt-4 items-center" accessibilityRole="button">
        <Text className="text-gray-400 text-sm">Skip quiz</Text>
      </Pressable>
    </View>
  )
}
