// Language Service
// Supports Philippine languages for the AI assistant

export type SupportedLanguage =
  | "en"      // English
  | "tl"      // Tagalog / Filipino
  | "ceb"     // Cebuano / Bisaya
  | "ilo"     // Ilocano
  | "hil"     // Hiligaynon / Ilonggo
  | "war"     // Waray
  | "pam"     // Kapampangan
  | "bik";    // Bikol

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  greeting: string;
  flag: string;
  voiceCode: string; // For TTS
}

export const LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    greeting: "Hello",
    flag: "🇺🇸",
    voiceCode: "en-US",
  },
  tl: {
    code: "tl",
    name: "Tagalog",
    nativeName: "Tagalog / Filipino",
    greeting: "Kumusta",
    flag: "🇵🇭",
    voiceCode: "fil-PH",
  },
  ceb: {
    code: "ceb",
    name: "Cebuano",
    nativeName: "Cebuano / Bisaya",
    greeting: "Kumusta",
    flag: "🇵🇭",
    voiceCode: "fil-PH",
  },
  ilo: {
    code: "ilo",
    name: "Ilocano",
    nativeName: "Ilocano / Ilokano",
    greeting: "Naimbag nga aldaw",
    flag: "🇵🇭",
    voiceCode: "fil-PH",
  },
  hil: {
    code: "hil",
    name: "Hiligaynon",
    nativeName: "Hiligaynon / Ilonggo",
    greeting: "Kamusta",
    flag: "🇵🇭",
    voiceCode: "fil-PH",
  },
  war: {
    code: "war",
    name: "Waray",
    nativeName: "Waray / Winaray",
    greeting: "Maupay nga adlaw",
    flag: "🇵🇭",
    voiceCode: "fil-PH",
  },
  pam: {
    code: "pam",
    name: "Kapampangan",
    nativeName: "Kapampangan / Pampango",
    greeting: "Komusta",
    flag: "🇵🇭",
    voiceCode: "fil-PH",
  },
  bik: {
    code: "bik",
    name: "Bikol",
    nativeName: "Bikol / Bikolano",
    greeting: "Marhay na aldaw",
    flag: "🇵🇭",
    voiceCode: "fil-PH",
  },
};

/**
 * Get language prompt instructions for AI
 */
export function getLanguagePrompt(language: SupportedLanguage): string {
  if (language === "en") {
    return "Respond in English.";
  }

  const config = LANGUAGES[language];

  const languageInstructions: Record<SupportedLanguage, string> = {
    en: "Respond in English.",
    tl: `Respond in Tagalog (Filipino). Use natural, conversational Filipino that seniors can understand easily. You may include common English words that are commonly used in Taglish. Example greeting: "Kumusta po!"`,
    ceb: `Respond in Cebuano (Bisaya). Use natural, conversational Cebuano/Bisaya that seniors in Visayas can understand. You may include common English or Tagalog words when necessary. Example greeting: "Kumusta man ka?"`,
    ilo: `Respond in Ilocano (Ilokano). Use natural, conversational Ilocano that seniors in Northern Luzon can understand. Example greeting: "Naimbag nga aldaw!"`,
    hil: `Respond in Hiligaynon (Ilonggo). Use natural, conversational Hiligaynon that seniors in Western Visayas can understand. Example greeting: "Kamusta ka?"`,
    war: `Respond in Waray (Winaray). Use natural, conversational Waray that seniors in Eastern Visayas can understand. Example greeting: "Maupay nga adlaw!"`,
    pam: `Respond in Kapampangan (Pampango). Use natural, conversational Kapampangan that seniors in Central Luzon can understand. Example greeting: "Komusta ka?"`,
    bik: `Respond in Bikol (Bikolano). Use natural, conversational Bikol that seniors in Bicol region can understand. Example greeting: "Marhay na aldaw!"`,
  };

  return `${languageInstructions[language]}

IMPORTANT LANGUAGE GUIDELINES:
- Use respectful language appropriate for seniors (use "po" and "opo" equivalents)
- Keep medical terms in English for clarity, but explain them in ${config.name}
- If a specific word doesn't exist in ${config.name}, use the English term
- Be warm, patient, and supportive in tone
- Use simple, clear language that anyone can understand`;
}

/**
 * Get TTS-friendly language code
 */
export function getTTSLanguageCode(language: SupportedLanguage): string {
  return LANGUAGES[language].voiceCode;
}

/**
 * Get all available languages as options
 */
export function getLanguageOptions(): Array<{ value: SupportedLanguage; label: string }> {
  return Object.values(LANGUAGES).map((lang) => ({
    value: lang.code,
    label: `${lang.flag} ${lang.nativeName}`,
  }));
}

/**
 * Storage key for language preference
 */
export const LANGUAGE_STORAGE_KEY = "ainay-preferred-language";

/**
 * Save language preference to localStorage
 */
export function saveLanguagePreference(language: SupportedLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load language preference from localStorage
 */
export function loadLanguagePreference(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && saved in LANGUAGES) {
      return saved as SupportedLanguage;
    }
  } catch {
    // Ignore storage errors
  }
  return "en";
}

