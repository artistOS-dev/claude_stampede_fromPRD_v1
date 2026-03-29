'use client'

import { useState } from 'react'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import { QUIZ_QUESTIONS, PERSONALITY_TYPES } from '@/lib/constants'
import Button from '@/components/ui/Button'

interface Step5Props {
  onSuccess: (personalityTypes: string[]) => void
  onSkip: () => void
}

type QuizPhase = 'questions' | 'personality-pick'

export default function Step5Quiz({ onSuccess, onSkip }: Step5Props) {
  const [phase, setPhase] = useState<QuizPhase>('questions')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([])

  const question = QUIZ_QUESTIONS[currentQuestion]
  const totalQuestions = QUIZ_QUESTIONS.length
  const isLastQuestion = currentQuestion === totalQuestions - 1

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = { ...answers, [question.id]: optionIndex }
    setAnswers(newAnswers)

    if (isLastQuestion) {
      // Small delay so user sees selected state before transitioning
      setTimeout(() => setPhase('personality-pick'), 200)
    } else {
      setTimeout(() => setCurrentQuestion((prev) => prev + 1), 200)
    }
  }

  const handleBack = () => {
    if (phase === 'personality-pick') {
      setPhase('questions')
      setCurrentQuestion(totalQuestions - 1)
      return
    }
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1)
    }
  }

  const togglePersonality = (id: string) => {
    setSelectedPersonalities((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id)
      }
      if (prev.length >= 3) {
        // Replace the oldest selection
        return [...prev.slice(1), id]
      }
      return [...prev, id]
    })
  }

  const handleDone = () => {
    onSuccess(selectedPersonalities)
  }

  if (phase === 'questions') {
    return (
      <div>
        {/* Question progress */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {currentQuestion > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Previous question"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            <span className="text-sm font-medium text-gray-500">
              Question {currentQuestion + 1} of {totalQuestions}
            </span>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip quiz
          </button>
        </div>

        {/* Question progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
            role="progressbar"
            aria-valuenow={currentQuestion + 1}
            aria-valuemin={1}
            aria-valuemax={totalQuestions}
            aria-label={`Question ${currentQuestion + 1} of ${totalQuestions}`}
          />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-6">{question.question}</h2>

        <div className="space-y-3" role="group" aria-label="Answer options">
          {question.options.map((option, idx) => {
            const isSelected = answers[question.id] === idx

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleAnswer(idx)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50 text-gray-900'
                    : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 text-gray-700'
                }`}
                aria-pressed={isSelected}
              >
                <span className="font-medium text-sm">{option}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Personality pick phase
  return (
    <div>
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        aria-label="Back to questions"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        Back
      </button>

      <div className="text-center mb-6">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4"
          aria-hidden="true"
        >
          <span className="text-3xl">🎸</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          You&apos;re a country music fan!
        </h2>
        <p className="text-gray-600">
          Pick up to 3 personality types that describe how you experience country music.
        </p>
      </div>

      <div
        className="grid grid-cols-1 gap-3 mb-6"
        role="group"
        aria-label="Select up to 3 personality types"
      >
        {PERSONALITY_TYPES.map((type) => {
          const isSelected = selectedPersonalities.includes(type.id)

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => togglePersonality(type.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'
              }`}
              aria-pressed={isSelected}
              aria-label={`${type.label}: ${type.description}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{type.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="text-center text-xs text-gray-400 mb-4" aria-live="polite" aria-atomic="true">
        {selectedPersonalities.length === 0
          ? 'Select up to 3 types'
          : selectedPersonalities.length === 1
          ? '1 selected — pick up to 2 more'
          : selectedPersonalities.length === 2
          ? '2 selected — pick 1 more if you like'
          : '3 selected'}
      </div>

      <Button
        variant="primary"
        className="w-full"
        onClick={handleDone}
        disabled={selectedPersonalities.length === 0}
      >
        Continue
      </Button>

      <button
        type="button"
        onClick={onSkip}
        className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors py-2"
      >
        Skip this step
      </button>
    </div>
  )
}
