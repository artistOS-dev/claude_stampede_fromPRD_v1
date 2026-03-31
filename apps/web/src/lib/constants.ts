export const PERSONALITY_TYPES = [
  { id: 'trailblazer', label: 'The Trailblazer', description: 'Always first to find new artists' },
  { id: 'storyteller', label: 'The Storyteller', description: 'Connects deeply with lyrics and meaning' },
  { id: 'traditionalist', label: 'The Traditionalist', description: 'Roots in classic country' },
  { id: 'community', label: 'The Community Builder', description: 'Country music is about togetherness' },
  { id: 'melodist', label: 'The Melodist', description: 'The melody moves you first' },
  { id: 'superfan', label: 'The Superfan', description: 'All in for one or two artists' },
  { id: 'explorer', label: 'The Explorer', description: 'Drawn across genres and subgenres' },
  { id: 'loyalist', label: 'The Loyalist', description: 'Once a fan, always a fan' },
]

export const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "When a song hits you, what hits first?",
    options: ["The lyrics", "The melody", "The instrumentation", "The feeling it gives me"]
  },
  {
    id: 2,
    question: "How do you discover new music?",
    options: ["I hunt for hours", "Friends share it with me", "I stumble onto it", "I stick to what I know"]
  },
  {
    id: 3,
    question: "Your perfect country music moment is:",
    options: ["Live at a small venue", "Driving alone on a highway", "Sitting around a fire", "A packed stadium"]
  },
  {
    id: 4,
    question: "What matters most in a country artist?",
    options: ["Their story", "Their voice", "Their live show", "Their authenticity"]
  },
  {
    id: 5,
    question: "How do you feel about emerging artists?",
    options: ["I love finding them early", "I prefer proven talent", "I follow wherever the music leads", "Mix of both"]
  },
]

export const TIERS = {
  free: { name: 'Free', price: 0, priceId: null },
  fan: { name: 'Fan', price: null, priceId: process.env.NEXT_PUBLIC_STRIPE_FAN_PRICE_ID },
  superfan: { name: 'Superfan', price: null, priceId: process.env.NEXT_PUBLIC_STRIPE_SUPERFAN_PRICE_ID },
}

export const COMMON_PASSWORDS = [
  'password',
  'password1',
  '12345678',
  'qwerty123',
  'letmein1',
  'welcome1',
  'monkey123',
  'dragon123',
  'master123',
  'sunshine1',
]
