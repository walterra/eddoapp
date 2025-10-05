import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Briefing data structure
 */
export interface BriefingData {
  content: string;
  userId: string;
  timestamp: string;
}

/**
 * Load the latest briefing from file
 */
export async function loadLatestBriefing(): Promise<BriefingData | null> {
  try {
    const briefingPath = join(
      process.cwd(),
      '.claude',
      'tmp',
      'latest-briefing.json',
    );
    const data = JSON.parse(await readFile(briefingPath, 'utf-8'));
    return data as BriefingData;
  } catch (_error) {
    return null;
  }
}

/**
 * Sample/mock briefing for fallback
 */
export const SAMPLE_BRIEFING = `
🌅 Good morning! Here's your daily briefing:

**📅 Today's Tasks** (3)
• 15:00 Doctor appointment
• Review project proposal
• Buy groceries

**⚠️ Overdue** (2)
• Fix authentication bug
• Submit expense report

**✅ Next Actions** (5)
• Call client about contract
• Update documentation
• Review pull request
• Test printer integration
• Deploy to production

**⏳ Active Time Tracking** (1)
• Working on: Printer service implementation (Started 2h ago)

Have a productive day!
`;
