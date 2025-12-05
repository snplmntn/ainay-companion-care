// ============================================
// Enhanced Medicine Extraction Service
// ============================================

import type {
  ExtractedMedicineData,
  MedicationCategory,
  FrequencyType,
} from "../types";
import { generateId } from "./scheduleService";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function getApiKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenAI API key. Set VITE_OPENAI_API_KEY in your .env file.");
  }
  return apiKey;
}

function getModel(): string {
  return import.meta.env.VITE_OPENAI_MODEL || "gpt-4o";
}

/**
 * Enhanced extraction prompt that captures all required fields
 */
const ENHANCED_EXTRACTION_PROMPT = `You are analyzing medical prescriptions or medicine information. Extract ALL medicines mentioned with complete details.

For each medicine found, extract these fields:
1. name: The medicine name (prefer brand name if recognized, or generic name)
2. dosage: The dosage amount (e.g., "500mg", "10mg", "1 tablet")
3. category: One of: "medicine", "vitamin", "supplement", "herbal", "other"
   - Use "medicine" for prescription drugs, antibiotics, pain relievers, etc.
   - Use "vitamin" for vitamins (A, B, C, D, E, multivitamins)
   - Use "supplement" for minerals, fish oil, probiotics, protein
   - Use "herbal" for herbal medicines, traditional remedies
   - Use "other" if unclear
4. frequency: One of: "once_daily", "twice_daily", "three_times_daily", "four_times_daily", "every_other_day", "weekly", "as_needed", "custom"
   - Map common instructions: "once a day" → "once_daily", "BID" → "twice_daily", "TID" → "three_times_daily", "QID" → "four_times_daily"
5. timePeriod: Duration of treatment (e.g., "7 days", "14 days", "30 days", "ongoing")
   - If not specified, use "ongoing" for maintenance medications, vitamins, supplements
   - Use specific days for antibiotics or short-term medications
6. instructions: Special instructions (e.g., "Take with food", "Before meals", "Avoid alcohol")

Return a JSON array. If no medicines are found, return an empty array [].
Return ONLY the JSON array, no other text.

Example output:
[
  {
    "name": "Metformin",
    "dosage": "500mg",
    "category": "medicine",
    "frequency": "twice_daily",
    "timePeriod": "ongoing",
    "instructions": "Take with meals"
  },
  {
    "name": "Vitamin D3",
    "dosage": "1000 IU",
    "category": "vitamin",
    "frequency": "once_daily",
    "timePeriod": "ongoing",
    "instructions": "Take with breakfast"
  }
]`;

interface OpenAIMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

/**
 * Parse frequency string to enum value
 */
function parseFrequency(freq: string): FrequencyType {
  const normalized = freq.toLowerCase().replace(/[_\s-]/g, "");

  if (normalized.includes("oncedaily") || normalized === "once" || normalized === "1x") {
    return "once_daily";
  }
  if (normalized.includes("twicedaily") || normalized === "twice" || normalized === "2x" || normalized === "bid") {
    return "twice_daily";
  }
  if (normalized.includes("threetimesdaily") || normalized === "3x" || normalized === "tid") {
    return "three_times_daily";
  }
  if (normalized.includes("fourtimesdaily") || normalized === "4x" || normalized === "qid") {
    return "four_times_daily";
  }
  if (normalized.includes("everyotherday") || normalized.includes("alternateday")) {
    return "every_other_day";
  }
  if (normalized.includes("weekly") || normalized.includes("onceaweek")) {
    return "weekly";
  }
  if (normalized.includes("asneeded") || normalized === "prn") {
    return "as_needed";
  }

  return "once_daily"; // Default
}

/**
 * Parse category string to enum value
 */
function parseCategory(cat: string): MedicationCategory {
  const normalized = cat.toLowerCase();

  if (normalized === "vitamin" || normalized.includes("vitamin")) {
    return "vitamin";
  }
  if (normalized === "supplement" || normalized.includes("supplement")) {
    return "supplement";
  }
  if (normalized === "herbal" || normalized.includes("herbal")) {
    return "herbal";
  }
  if (normalized === "medicine" || normalized === "medication" || normalized === "drug") {
    return "medicine";
  }

  return "other";
}

/**
 * Extract enhanced medicine data from text (voice transcription)
 */
export async function extractEnhancedMedicinesFromText(
  text: string
): Promise<ExtractedMedicineData[]> {
  const apiKey = getApiKey();

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: "system", content: ENHANCED_EXTRACTION_PROMPT },
        { role: "user", content: `Extract all medicines from: "${text}"` },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const apiError = data?.error?.message ?? response.statusText;
    throw new Error(`OpenAI request failed: ${apiError}`);
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI did not return any content.");
  }

  try {
    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(jsonStr);
    const medicines = Array.isArray(result) ? result : [result];

    return medicines
      .filter((m: any) => m.name)
      .map((m: any): ExtractedMedicineData => ({
        id: generateId(),
        name: m.name || "",
        dosage: m.dosage || "",
        category: parseCategory(m.category || "medicine"),
        frequency: parseFrequency(m.frequency || "once_daily"),
        timePeriod: m.timePeriod || "ongoing",
        instructions: m.instructions || "",
        source: "voice",
        confirmed: false,
      }));
  } catch {
    return [];
  }
}

/**
 * Extract enhanced medicine data from images (prescription scan)
 */
export async function extractEnhancedMedicinesFromImages(
  imageDataUrls: string[]
): Promise<ExtractedMedicineData[]> {
  const apiKey = getApiKey();

  const content: OpenAIMessageContent[] = [
    {
      type: "text",
      text: `Analyze these prescription/medicine images and extract ALL medicine information. ${ENHANCED_EXTRACTION_PROMPT}`,
    },
    ...imageDataUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    })),
  ];

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 3000,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const apiError = data?.error?.message ?? response.statusText;
    throw new Error(`OpenAI request failed: ${apiError}`);
  }

  const responseContent = data?.choices?.[0]?.message?.content?.trim();
  if (!responseContent) {
    throw new Error("OpenAI did not return any content.");
  }

  try {
    const jsonStr = responseContent.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(jsonStr);
    const medicines = Array.isArray(result) ? result : [result];

    return medicines
      .filter((m: any) => m.name)
      .map((m: any): ExtractedMedicineData => ({
        id: generateId(),
        name: m.name || "",
        dosage: m.dosage || "",
        category: parseCategory(m.category || "medicine"),
        frequency: parseFrequency(m.frequency || "once_daily"),
        timePeriod: m.timePeriod || "ongoing",
        instructions: m.instructions || "",
        source: "scan",
        confirmed: false,
      }));
  } catch {
    return [];
  }
}

/**
 * Convert simple extracted medicine to enhanced format
 */
export function convertToEnhancedMedicine(
  simpleMedicine: { name: string; dosage: string; time?: string; instructions?: string },
  source: "scan" | "voice" | "manual" = "manual"
): ExtractedMedicineData {
  // Try to detect category from name
  const nameLower = simpleMedicine.name.toLowerCase();
  let category: MedicationCategory = "medicine";

  if (nameLower.includes("vitamin") || nameLower.match(/\b(b1|b2|b6|b12|c|d|e|k)\b/i)) {
    category = "vitamin";
  } else if (
    nameLower.includes("supplement") ||
    nameLower.includes("fish oil") ||
    nameLower.includes("omega") ||
    nameLower.includes("calcium") ||
    nameLower.includes("iron") ||
    nameLower.includes("zinc") ||
    nameLower.includes("magnesium")
  ) {
    category = "supplement";
  } else if (
    nameLower.includes("herbal") ||
    nameLower.includes("lagundi") ||
    nameLower.includes("sambong")
  ) {
    category = "herbal";
  }

  return {
    id: generateId(),
    name: simpleMedicine.name,
    dosage: simpleMedicine.dosage,
    category,
    frequency: "once_daily",
    timePeriod: "ongoing",
    instructions: simpleMedicine.instructions || "",
    source,
    confirmed: false,
  };
}

