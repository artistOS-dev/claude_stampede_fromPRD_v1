import { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

interface CardProps {
  children: ReactNode
  onPress?: () => void
  selected?: boolean
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export default function Card({
  children,
  onPress,
  selected = false,
  className = '',
  padding = 'md',
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  const baseClasses = `bg-white rounded-2xl ${paddingClasses[padding]}`
  const borderClasses = selected
    ? 'border-2 border-orange-500'
    : 'border border-gray-200'

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        className={`${baseClasses} ${borderClasses} ${className}`}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View
      className={`${baseClasses} ${borderClasses} ${className}`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {children}
    </View>
  )
}
