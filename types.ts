
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
  DOF = 'DOF',
  SAT_CFDI = 'SAT CFDI',
  SAT_RMF = 'SAT RMF',
  IMSS_IDSE = 'IMSS IDSE',
  IMSS_SUA = 'IMSS SUA',
  INFONAVIT = 'Infonavit',
  STPS = 'STPS',
  CONASAMI = 'CONASAMI',
  INEGI = 'INEGI',
  UMA = 'UMA',
  JORNADA_LABORAL = 'Jornada Laboral'
}

export const TOPICS_LIST = Object.values(Topic);
