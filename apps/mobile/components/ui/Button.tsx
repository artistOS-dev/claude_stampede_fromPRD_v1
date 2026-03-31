import { ActivityIndicator, Pressable, Text, View } from 'react-native'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  size = 'md',
}: ButtonProps) {
  const isDisabled = disabled || loading

  const containerBase = fullWidth ? 'w-full' : 'self-start'

  const sizeClasses = {
    sm: 'px-4 py-2',
    md: 'px-6 py-3',
    lg: 'px-8 py-4',
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const variantClasses = {
    primary: isDisabled
      ? 'bg-orange-300 rounded-xl items-center justify-center flex-row'
      : 'bg-orange-500 rounded-xl items-center justify-center flex-row',
    secondary: isDisabled
      ? 'bg-white border border-gray-200 rounded-xl items-center justify-center flex-row opacity-50'
      : 'bg-white border border-orange-500 rounded-xl items-center justify-center flex-row',
    ghost: isDisabled
      ? 'rounded-xl items-center justify-center flex-row opacity-50'
      : 'rounded-xl items-center justify-center flex-row',
  }

  const textVariantClasses = {
    primary: 'text-white font-semibold',
    secondary: isDisabled ? 'text-gray-400 font-semibold' : 'text-orange-500 font-semibold',
    ghost: 'text-orange-500 font-semibold',
  }

  return (
    <View className={containerBase}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => ({ opacity: pressed && !isDisabled ? 0.85 : 1 })}
        className={`${variantClasses[variant]} ${sizeClasses[size]}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? '#ffffff' : '#F97316'}
            style={{ marginRight: label ? 8 : 0 }}
          />
        ) : null}
        {label ? (
          <Text className={`${textVariantClasses[variant]} ${textSizeClasses[size]}`}>
            {label}
          </Text>
        ) : null}
      </Pressable>
    </View>
  )
}
