// ============================================
// Morning Briefing Component (Re-export from module)
// ============================================
// This file re-exports the MorningBriefingPlayer from the morning-briefing module
// for backward compatibility with existing imports.

import { MorningBriefingPlayer } from '@/modules/morning-briefing';

export function MorningBriefing() {
  return <MorningBriefingPlayer />;
}
