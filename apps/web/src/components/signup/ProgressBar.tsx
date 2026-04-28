interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const percentage = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="w-full" aria-label={`Step ${currentStep} of ${totalSteps}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-stone-500">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-xs font-medium text-amber-400">
          {Math.round(percentage)}%
        </span>
      </div>

      <div
        className="w-full h-2 bg-stone-800 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Step ${currentStep} of ${totalSteps}`}
      >
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Step dots */}
      <div className="flex justify-between mt-2" aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1
          const isDone = stepNum < currentStep
          const isCurrent = stepNum === currentStep

          return (
            <div
              key={stepNum}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                isDone
                  ? 'bg-amber-500'
                  : isCurrent
                  ? 'bg-amber-500 ring-2 ring-amber-500/30'
                  : 'bg-stone-700'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
