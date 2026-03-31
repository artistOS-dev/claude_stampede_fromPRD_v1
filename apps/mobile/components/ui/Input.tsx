import { ReactNode } from 'react'
import {
  KeyboardTypeOptions,
  NativeSyntheticEvent,
  ReturnKeyTypeOptions,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
} from 'react-native'

interface InputProps {
  label?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  error?: string
  secureTextEntry?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?: string
  autoFocus?: boolean
  returnKeyType?: ReturnKeyTypeOptions
  onSubmitEditing?: (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void
  rightElement?: ReactNode
  leftElement?: ReactNode
  editable?: boolean
  multiline?: boolean
  numberOfLines?: number
  maxLength?: number
  hint?: string
}

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  autoFocus = false,
  returnKeyType,
  onSubmitEditing,
  rightElement,
  leftElement,
  editable = true,
  multiline = false,
  numberOfLines,
  maxLength,
  hint,
}: InputProps) {
  const hasError = !!error

  return (
    <View className="w-full">
      {label ? (
        <Text className="text-gray-700 font-medium text-sm mb-1.5" accessibilityRole="text">
          {label}
        </Text>
      ) : null}

      <View
        className={`flex-row items-center border rounded-xl bg-white overflow-hidden ${
          hasError
            ? 'border-red-400'
            : editable
            ? 'border-gray-300'
            : 'border-gray-200 bg-gray-50'
        }`}
      >
        {leftElement ? (
          <View className="pl-3">{leftElement}</View>
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete as any}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          className={`flex-1 px-4 py-3 text-gray-900 text-base ${
            multiline ? 'h-24 text-top' : ''
          } ${!editable ? 'text-gray-500' : ''}`}
          style={{ textAlignVertical: multiline ? 'top' : 'center' }}
          accessibilityLabel={label}
          accessibilityHint={hint}
        />

        {rightElement ? (
          <View className="pr-1">{rightElement}</View>
        ) : null}
      </View>

      {hasError ? (
        <View className="flex-row items-center mt-1.5 gap-1">
          <Text className="text-red-500 text-sm font-bold" accessibilityRole="text">!</Text>
          <Text className="text-red-500 text-sm flex-1" accessibilityRole="alert">
            {error}
          </Text>
        </View>
      ) : null}

      {hint && !hasError ? (
        <Text className="text-gray-400 text-xs mt-1">{hint}</Text>
      ) : null}
    </View>
  )
}
