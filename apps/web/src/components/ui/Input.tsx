import React from 'react'
import clsx from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, trailingIcon, id, className, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
    const errorId = error ? `${inputId}-error` : undefined
    const hintId = hint ? `${inputId}-hint` : undefined

    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-zinc-300 mb-1.5"
        >
          {label}
        </label>

        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-describedby={describedBy}
            aria-invalid={error ? 'true' : undefined}
            className={clsx(
              'block w-full rounded-xl border bg-zinc-900 text-white text-sm placeholder-zinc-500',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-pink-500',
              'transition-colors duration-150',
              icon ? 'pl-10 pr-4 py-3' : 'px-4 py-3',
              trailingIcon ? 'pr-10' : '',
              error
                ? 'border-red-400 focus-visible:ring-red-400'
                : 'border-zinc-700 focus-visible:border-pink-600',
              'disabled:bg-zinc-950 disabled:text-zinc-500 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          />

          {trailingIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600">
              {trailingIcon}
            </div>
          )}
        </div>

        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-xs text-zinc-500">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
