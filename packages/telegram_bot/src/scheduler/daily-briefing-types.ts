export interface DailyBriefingSchedulerConfig {
  checkIntervalMs: number;
}

export interface DailyBriefingSchedulerStatus {
  isRunning: boolean;
  currentDatesByTimeZone: Record<string, string>;
  sentBriefingsToday: number;
  sentRecapsToday: number;
  checkIntervalMs: number;
}
