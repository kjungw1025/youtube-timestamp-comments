// Chrome Storage 타입 정의

export type Theme = 'light' | 'dark';

export type Language = 'en' | 'ko' | 'zh' | 'ja';

export type ViewMode = 'popup' | 'sidepanel';

export interface StorageData {
  apiKey?: string;
  theme?: Theme;
  language?: Language;
  viewMode?: ViewMode;
}

export type StorageKey = keyof StorageData;
