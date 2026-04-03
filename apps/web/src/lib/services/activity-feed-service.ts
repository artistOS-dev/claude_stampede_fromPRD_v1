import { createClient } from '@/lib/supabase/server'

export type FeedEventType =
  | 'challenge_sent'
  | 'challenge_received'
  | 'challenge_accepted'
  | 'challenge_declined'
  | 'rodeo_opened'
  | 'vote_milestone'
  | 'result_posted'
  | 'artist_promoted'
  | 'credits_distributed'
  | 'budget_reset'
  | 'board_approval_pending'
  | 'nomination_passed'
  | 'nomination_inducted'

export interface FeedEvent {
  id: string
  circle_id: string
  rodeo_id: string | null
  nomination_id: string | null
  event_type: FeedEventType
  actor_id: string | null
  payload: Record<string, unknown>
  board_only: boolean
  created_at: string
}

export interface LogEventParams {
  circle_id: string
  event_type: FeedEventType
  rodeo_id?: string
  nomination_id?: string
  actor_id?: string
  payload?: Record<string, unknown>
  board_only?: boolean
}

export const ActivityFeedService = {
  async log(params: LogEventParams): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('circle_rodeo_events').insert({
      circle_id: params.circle_id,
      event_type: params.event_type,
      rodeo_id: params.rodeo_id ?? null,
      nomination_id: params.nomination_id ?? null,
      actor_id: params.actor_id ?? null,
      payload: params.payload ?? {},
      board_only: params.board_only ?? false,
    })
    if (error) {
      console.error('[ActivityFeedService.log] error:', error.message)
    }
  },

  async getCircleEvents(
    circle_id: string,
    options?: { board_member?: boolean; limit?: number; offset?: number }
  ): Promise<FeedEvent[]> {
    const supabase = await createClient()
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    let query = supabase
      .from('circle_rodeo_events')
      .select('*')
      .eq('circle_id', circle_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!options?.board_member) {
      query = query.eq('board_only', false)
    }

    const { data, error } = await query
    if (error) {
      console.error('[ActivityFeedService.getCircleEvents] error:', error.message)
      return []
    }
    return (data ?? []) as FeedEvent[]
  },
}
