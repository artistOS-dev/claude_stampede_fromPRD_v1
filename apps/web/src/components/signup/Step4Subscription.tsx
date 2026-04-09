'use client'

import { useState, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Check, Star, Zap, AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

type TierKey = 'free' | 'fan' | 'superfan'
type BillingPeriod = 'monthly' | 'annual'

interface TierConfig {
  name: string
  monthlyPrice: number
  annualPrice: number
  description: string
  features: string[]
  badge?: string
  icon: React.ReactNode
}

const TIER_CONFIG: Record<Exclude<TierKey, 'free'> | 'free', TierConfig> = {
  free: {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Explore the community',
    features: [
      'Browse public circles',
      'Discover new artists',
      'Basic profile',
      'Read community posts',
    ],
    icon: <span className="text-2xl" aria-hidden="true">🎵</span>,
  },
  fan: {
    name: 'Fan',
    monthlyPrice: 4.99,
    annualPrice: 3.99,
    description: 'Full community access',
    features: [
      'Everything in Free',
      'Join unlimited circles',
      'Post & comment',
      'Fan badge on profile',
      'Exclusive fan content',
    ],
    badge: 'Most Popular',
    icon: <Star className="w-6 h-6 text-pink-400" aria-hidden="true" />,
  },
  superfan: {
    name: 'Superfan',
    monthlyPrice: 9.99,
    annualPrice: 7.99,
    description: 'The ultimate experience',
    features: [
      'Everything in Fan',
      'Early access to features',
      'Direct artist Q&As',
      'Superfan badge',
      'Priority support',
      'Exclusive superfan events',
    ],
    icon: <Zap className="w-6 h-6 text-pink-400" aria-hidden="true" />,
  },
}

interface Step4Props {
  onSuccess: (tier: TierKey) => void
  onSkip: () => void
}

interface PaymentFormProps {
  selectedTier: Exclude<TierKey, 'free'>
  billingPeriod: BillingPeriod
  onSuccess: (tier: TierKey) => void
  onCancel: () => void
}

function PaymentForm({ selectedTier, billingPeriod, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceId =
    selectedTier === 'fan'
      ? process.env.NEXT_PUBLIC_STRIPE_FAN_PRICE_ID
      : process.env.NEXT_PUBLIC_STRIPE_SUPERFAN_PRICE_ID

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !priceId) return

    setError(null)
    setIsProcessing(true)

    try {
      const card = elements.getElement(CardElement)
      if (!card) {
        setError('Card element not found.')
        return
      }

      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
      })

      if (pmError) {
        setError(pmError.message ?? 'Failed to process card.')
        return
      }

      const res = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: selectedTier,
          price_id: priceId,
          payment_method_id: paymentMethod.id,
        }),
      })

      const data: {
        success?: boolean
        requires_action?: boolean
        client_secret?: string
        subscription_id?: string
        error?: string
      } = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Subscription failed.')
        return
      }

      // Handle 3DS
      if (data.requires_action && data.client_secret) {
        const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret)
        if (confirmError) {
          setError(confirmError.message ?? '3D Secure authentication failed.')
          return
        }
      }

      onSuccess(selectedTier)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const tier = TIER_CONFIG[selectedTier]
  const price = billingPeriod === 'annual' ? tier.annualPrice : tier.monthlyPrice

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-700 text-sm text-zinc-400">
        Subscribing to{' '}
        <span className="font-semibold text-white">{tier.name}</span> at{' '}
        <span className="font-semibold text-white">
          ${price}/mo{billingPeriod === 'annual' ? ' (billed annually)' : ''}
        </span>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 p-3 rounded-lg bg-red-950/30 border border-red-800"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Card details
        </label>
        <div className="px-4 py-3 border border-zinc-700 rounded-xl bg-zinc-900 focus-within:ring-2 focus-within:ring-pink-500 focus-within:border-pink-600 transition-all">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '14px',
                  color: '#111827',
                  '::placeholder': { color: '#9CA3AF' },
                  fontFamily: 'system-ui, sans-serif',
                },
                invalid: { color: '#EF4444' },
              },
            }}
          />
        </div>
        <p className="mt-1.5 text-xs text-zinc-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          Secured by Stripe. We never store your card details.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="flex-1"
          disabled={isProcessing}
        >
          Back
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          loading={isProcessing}
          disabled={!stripe}
        >
          Subscribe
        </Button>
      </div>
    </form>
  )
}

export default function Step4Subscription({ onSuccess, onSkip }: Step4Props) {
  const [selectedTier, setSelectedTier] = useState<TierKey>('fan')
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const handleContinue = useCallback(() => {
    if (selectedTier === 'free') {
      onSuccess('free')
    } else {
      setShowPaymentForm(true)
    }
  }, [selectedTier, onSuccess])

  const tiers: TierKey[] = ['free', 'fan', 'superfan']

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Choose your plan</h2>
      <p className="text-zinc-400 mb-6">Upgrade anytime. Cancel anytime.</p>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setBillingPeriod('monthly')}
          className={`text-sm font-medium transition-colors ${
            billingPeriod === 'monthly' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
          }`}
          aria-pressed={billingPeriod === 'monthly'}
        >
          Monthly
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={billingPeriod === 'annual'}
          onClick={() => setBillingPeriod((p) => (p === 'monthly' ? 'annual' : 'monthly'))}
          className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
            billingPeriod === 'annual' ? 'bg-pink-500' : 'bg-zinc-700'
          }`}
          aria-label="Toggle annual billing"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-zinc-900 rounded-full shadow transition-transform ${
              billingPeriod === 'annual' ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setBillingPeriod('annual')}
          className={`text-sm font-medium transition-colors ${
            billingPeriod === 'annual' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
          }`}
          aria-pressed={billingPeriod === 'annual'}
        >
          Annual{' '}
          <span className="text-xs text-green-400 font-semibold">Save 20%</span>
        </button>
      </div>

      {!showPaymentForm ? (
        <>
          {/* Tier cards */}
          <div className="space-y-3 mb-6">
            {tiers.map((tierKey) => {
              const tier = TIER_CONFIG[tierKey]
              const price =
                tierKey === 'free'
                  ? 0
                  : billingPeriod === 'annual'
                  ? tier.annualPrice
                  : tier.monthlyPrice
              const isSelected = selectedTier === tierKey

              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => setSelectedTier(tierKey)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-pink-500 bg-pink-950/20'
                      : 'border-zinc-700 bg-zinc-900 hover:border-pink-800'
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`Select ${tier.name} plan`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{tier.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">{tier.name}</span>
                        {tier.badge && (
                          <span className="text-xs font-bold text-pink-400 bg-pink-900/30 px-2 py-0.5 rounded-full">
                            {tier.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{tier.description}</p>
                      <ul className="mt-2 space-y-1">
                        {tier.features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <Check className="w-3 h-3 text-green-500 flex-shrink-0" aria-hidden="true" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {tierKey === 'free' ? (
                        <span className="text-lg font-bold text-white">Free</span>
                      ) : (
                        <div>
                          <span className="text-lg font-bold text-white">${price}</span>
                          <span className="text-xs text-zinc-500">/mo</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <Button variant="primary" className="w-full" onClick={handleContinue}>
            {selectedTier === 'free' ? 'Continue for free' : `Subscribe to ${TIER_CONFIG[selectedTier].name}`}
          </Button>

          <button
            type="button"
            onClick={onSkip}
            className="w-full mt-3 text-sm text-zinc-500 hover:text-zinc-200 font-medium transition-colors py-2"
          >
            Skip for now
          </button>
        </>
      ) : (
        <>
          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <PaymentForm
                selectedTier={selectedTier as Exclude<TierKey, 'free'>}
                billingPeriod={billingPeriod}
                onSuccess={onSuccess}
                onCancel={() => setShowPaymentForm(false)}
              />
            </Elements>
          ) : (
            <div className="p-4 bg-red-950/30 rounded-xl border border-red-800" role="alert">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                Payment processing is not configured. Please try again later.
              </p>
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="mt-3 text-sm text-red-400 underline"
              >
                Go back
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
