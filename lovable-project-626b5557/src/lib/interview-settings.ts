export type InterviewSettings = {
  resume: string;
  jobDescription: string;
  company: string;
  role: string;
  extraNotes: string;
};

export const emptySettings: InterviewSettings = {
  resume: "",
  jobDescription: "",
  company: "",
  role: "",
  extraNotes: "",
};

const STORAGE_KEY = "interview-assistant-settings";

export function loadSettings(): InterviewSettings {
  if (typeof window === "undefined") return emptySettings;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySettings;
    return { ...emptySettings, ...(JSON.parse(raw) as Partial<InterviewSettings>) };
  } catch {
    return emptySettings;
  }
}

export function saveSettings(settings: InterviewSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isSettingsFilled(settings: InterviewSettings) {
  return Boolean(settings.resume.trim() || settings.jobDescription.trim());
}
