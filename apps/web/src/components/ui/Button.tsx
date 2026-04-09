import React from 'react'
import clsx from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
  children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading = false, disabled, className, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 px-5 py-2.5'

    const variants = {
      primary:
        'bg-pink-500 text-white hover:bg-pink-600 active:bg-pink-700 focus-visible:ring-pink-500',
      secondary:
        'bg-zinc-900 text-zinc-100 border border-zinc-700 hover:bg-zinc-800 active:bg-zinc-800 focus-visible:ring-zinc-600',
      ghost:
        'bg-transparent text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700 focus-visible:ring-zinc-600',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(base, variants[variant], className)}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
