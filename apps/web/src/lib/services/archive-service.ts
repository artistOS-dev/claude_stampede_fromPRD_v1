// ============================================================
// Stampede — ArchiveService
// Wraps RodeoService with the archive-phase naming from the spec:
//   finalizeResult()     → closes voting and computes result
//   writeToCircleHistory() → permanently archives to both Circle timelines
// ============================================================

import { RodeoService } from './rodeo-service'

export const ArchiveService = {

  // ────────────────────────────────────────────────────────────
  // finalizeResult — close voting and compute winner + credit
  // distributions. Transitions rodeo: voting → closed.
  // Only the rodeo creator can call this.
  // ────────────────────────────────────────────────────────────
  async finalizeResult(rodeo_id: string) {
    return RodeoService.closeRodeo(rodeo_id)
  },

  // ────────────────────────────────────────────────────────────
  // writeToCircleHistory — permanently archive a closed rodeo.
  // Sets archived_to_circle_history = true on the result row.
  // Transitions rodeo: closed → archived.
  // Rodeo history is permanent and cannot be edited or deleted.
  // ────────────────────────────────────────────────────────────
  async writeToCircleHistory(rodeo_id: string) {
    return RodeoService.archiveRodeo(rodeo_id)
  },
}
