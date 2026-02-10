
export interface NewsItem {
  id: string;
  topic: string;
  title: string;
  summary: string;
  date: string;
  links: { title: string; uri: string }[];
  fullText: string;
}

export interface ScheduleSettings {
  enabled: boolean;
  startTime: string; // HH:mm format
  timesPerDay: number; // 1, 2, 4, 8
  daysOfWeek: number[]; // 0 (Dom) a 6 (Sab)
  lastRun: string | null; // ISO string
}

export interface AppSettings {
  googleChatWebhook: string;
  selectedTopics: string[];
  schedule: ScheduleSettings;
  lastReportText: string;
}

export enum Topic {
  SAT = 'SAT',
  IMSS = 'IMSS',
  INFONAVIT = 'Infonavit',
  UMA = 'UMA',
  IDSE = 'IDSE',
  CFDI = 'CFDI',
  SUA = 'SUA'
}

export const TOPICS_LIST = Object.values(Topic);
