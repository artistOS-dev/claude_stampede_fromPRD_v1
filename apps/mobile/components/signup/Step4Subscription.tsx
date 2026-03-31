import { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { saveSignupState } from '../../lib/signupState'
import Button from '../ui/Button'

type Tier = 'free' | 'fan' | 'superfan'
type BillingCycle = 'monthly' | 'annual'

interface Step4Props {
  initialTier?: Tier | null
  onSuccess: (tier: Tier) => void
}

interface TierConfig {
  id: Tier
  label: string
  monthlyPrice: number
  annualPrice: number
  description: string
  features: string[]
  popular: boolean
  cta: string
}

const TIERS: TierConfig[] = [
  {
    id: 'free',
    label: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Get started with the community',
    features: [
      'Join public circles',
      'Browse events',
      'Basic profile',
      'Community feed',
    ],
    popular: false,
    cta: 'Start free',
  },
  {
    id: 'fan',
    label: 'Fan',
    monthlyPrice: 5.99,
    annualPrice: 4.99,
    description: 'The full Stampede experience',
    features: [
      'Everything in Free',
      'Exclusive fan circles',
      'Early ticket access',
      'Artist Q&A sessions',
      'Ad-free browsing',
    ],
    popular: true,
    cta: 'Get Fan',
  },
  {
    id: 'superfan',
    label: 'Superfan',
    monthlyPrice: 12.99,
    annualPrice: 10.99,
    description: 'For the most dedicated fans',
    features: [
      'Everything in Fan',
      'Backstage content',
      'Direct artist messages',
      'Physical merch discounts',
      'Priority support',
      'Superfan badge',
    ],
    popular: false,
    cta: 'Go Superfan',
  },
]

export default function Step4Subscription({ initialTier = null, onSuccess }: Step4Props) {
  const [selected, setSelected] = useState<Tier>(initialTier ?? 'free')
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const [loading, setLoading] = useState(false)

  const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? 'https://stampede.app'

  const handleSelect = async (tier: Tier) => {
    if (tier === 'free') {
      setLoading(true)
      await saveSignupState({ step: 5, tier: 'free' })
      setLoading(false)
      onSuccess('free')
      return
    }

    setSelected(tier)
    const price = billing === 'annual' ? getTier(tier)?.annualPrice : getTier(tier)?.monthlyPrice
    const paymentUrl = `${appUrl}/subscribe?tier=${tier}&billing=${billing}&price=${price}`

    /**
     * NOTE: Full native Stripe integration requires the @stripe/stripe-react-native SDK
     * and a server-side payment intent. For now we open the Stripe checkout page in the
     * device browser. A future iteration should use stripe-react-native's <PaymentSheet>
     * for a fully native payment experience.
     */
    await Linking.openURL(paymentUrl)

    // Optimistically advance — in production, listen for a deep-link callback
    // from the web payment flow to confirm the subscription before advancing.
    setLoading(true)
    await saveSignupState({ step: 5, tier })
    setLoading(false)
    onSuccess(tier)
  }

  const getTier = (id: Tier) => TIERS.find((t) => t.id === id)

  const formatPrice = (tier: TierConfig) => {
    const price = billing === 'annual' ? tier.annualPrice : tier.monthlyPrice
    if (price === 0) return 'Free'
    return `$${price.toFixed(2)}/mo`
  }

  const annualSavingsPct = (tier: TierConfig) => {
    if (tier.monthlyPrice === 0) return 0
    return Math.round(((tier.monthlyPrice - tier.annualPrice) / tier.monthlyPrice) * 100)
  }

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-6 pt-6 pb-8">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-gray-900 font-bold text-2xl mb-2">Choose your plan</Text>
          <Text className="text-gray-500 text-base">
            Upgrade any time. Cancel any time.
          </Text>
        </View>

        {/* Billing toggle */}
        <View className="flex-row bg-gray-100 rounded-xl p-1 mb-6">
          <Pressable
            onPress={() => setBilling('monthly')}
            className={`flex-1 py-2 rounded-lg items-center ${
              billing === 'monthly' ? 'bg-white shadow-sm' : ''
            }`}
            accessibilityRole="radio"
            accessibilityState={{ checked: billing === 'monthly' }}
          >
            <Text
              className={`text-sm font-semibold ${
                billing === 'monthly' ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              Monthly
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBilling('annual')}
            className={`flex-1 py-2 rounded-lg items-center flex-row justify-center gap-2 ${
              billing === 'annual' ? 'bg-white shadow-sm' : ''
            }`}
            accessibilityRole="radio"
            accessibilityState={{ checked: billing === 'annual' }}
          >
            <Text
              className={`text-sm font-semibold ${
                billing === 'annual' ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              Annual
            </Text>
            <View className="bg-green-100 px-1.5 py-0.5 rounded">
              <Text className="text-green-700 text-xs font-bold">Save 17%</Text>
            </View>
          </Pressable>
        </View>

        {/* Tier cards */}
        <View className="gap-4 mb-6">
          {TIERS.map((tier) => {
            const isSelected = selected === tier.id
            return (
              <View key={tier.id} className="relative">
                {/* Popular badge */}
                {tier.popular ? (
                  <View className="absolute -top-3 left-0 right-0 items-center z-10">
                    <View className="bg-orange-500 px-4 py-1 rounded-full">
                      <Text className="text-white text-xs font-bold">Most Popular</Text>
                    </View>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => setSelected(tier.id)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  className={`rounded-2xl border-2 p-5 ${
                    tier.popular ? 'mt-3' : ''
                  } ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${tier.label} plan: ${formatPrice(tier)}`}
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <Text
                        className={`font-bold text-xl ${
                          isSelected ? 'text-orange-600' : 'text-gray-900'
                        }`}
                      >
                        {tier.label}
                      </Text>
                      <Text className="text-gray-500 text-sm mt-0.5">{tier.description}</Text>
                    </View>
                    <View className="items-end ml-4">
                      <Text
                        className={`font-bold text-xl ${
                          isSelected ? 'text-orange-600' : 'text-gray-900'
                        }`}
                      >
                        {formatPrice(tier)}
                      </Text>
                      {billing === 'annual' && tier.annualPrice > 0 ? (
                        <Text className="text-green-600 text-xs font-medium">
                          Save {annualSavingsPct(tier)}%
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Features */}
                  <View className="gap-2">
                    {tier.features.map((feature) => (
                      <View key={feature} className="flex-row items-center gap-2">
                        <View
                          className={`w-4 h-4 rounded-full items-center justify-center ${
                            isSelected ? 'bg-orange-500' : 'bg-gray-300'
                          }`}
                        >
                          <Text className="text-white text-xs font-bold">✓</Text>
                        </View>
                        <Text className="text-gray-700 text-sm flex-1">{feature}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Selection indicator */}
                  {isSelected ? (
                    <View className="mt-4 pt-3 border-t border-orange-200 flex-row items-center gap-2">
                      <View className="w-4 h-4 rounded-full bg-orange-500 items-center justify-center">
                        <Text className="text-white text-xs font-bold">✓</Text>
                      </View>
                      <Text className="text-orange-600 text-sm font-medium">Selected</Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            )
          })}
        </View>

        {/* Payment note for paid tiers */}
        {selected !== 'free' ? (
          <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex-row items-start gap-3">
            <Text className="text-blue-500 text-base">ℹ</Text>
            <Text className="text-blue-700 text-sm flex-1 leading-5">
              Payment will open securely in your browser via Stripe. You'll be redirected back to
              Stampede once payment is complete.
            </Text>
          </View>
        ) : null}

        {/* CTA */}
        <Button
          label={loading ? 'Please wait…' : getTier(selected)?.cta ?? 'Continue'}
          onPress={() => handleSelect(selected)}
          loading={loading}
          variant="primary"
          fullWidth
          size="lg"
        />

        {/* Skip link */}
        {selected !== 'free' ? (
          <Pressable
            onPress={async () => {
              await saveSignupState({ step: 5, tier: 'free' })
              onSuccess('free')
            }}
            className="mt-4 items-center"
            accessibilityRole="button"
          >
            <Text className="text-gray-400 text-sm">Skip for now — start with Free</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  )
}
