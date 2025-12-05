import { searchDrugs, getDrugContext, type Drug } from "./drugDatabase";
import { SupportedLanguage, getLanguagePrompt } from "./language";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_MODEL = "gpt-4o";
const FAST_MODEL = "gpt-4o-mini"; // Faster & cheaper for extraction tasks
const WHISPER_MODEL = "whisper-1";

const BASE_SYSTEM_PROMPT = `You are AInay, a friendly health companion for seniors. Your role is to help users understand their medications and maintain healthy routines.

When analyzing medicine images:
- Identify ALL medicines visible in the image (there may be multiple)
- For each medicine, provide: name, typical dosage, purpose, and any important warnings
- Match medicine names against the Philippine FDA drug database when possible
- If you cannot identify a medicine with certainty, say so clearly
- Always remind users to verify with their pharmacist or doctor
- Format your response clearly, listing each medicine separately

For general health questions:
- Keep answers concise, supportive, and easy to understand
- Focus on medication guidance, safety, and healthy routines
- Encourage users to consult their clinician for medical decisions
- Use simple language appropriate for seniors

You have access to a Philippine FDA drug database. When users mention medicine names, try to match them to known drugs in this database for accurate information.`;

/**
 * User context for personalized AI responses
 */
export interface UserContext {
  userName?: string;
  language?: SupportedLanguage;
  medications?: Array<{
    name: string;
    dosage: string;
    time: string;
    taken: boolean;
    instructions?: string;
  }>;
}

/**
 * Build the system prompt with user context
 */
export function buildSystemPrompt(userContext?: UserContext): string {
  let prompt = BASE_SYSTEM_PROMPT;

  // Add language instructions
  const language = userContext?.language || "en";
  prompt += `\n\n## LANGUAGE INSTRUCTIONS\n${getLanguagePrompt(language)}`;

  if (userContext?.userName) {
    prompt += `\n\nThe user's name is ${userContext.userName}. Address them warmly by name when appropriate.`;
  }

  if (userContext?.medications && userContext.medications.length > 0) {
    const medList = userContext.medications
      .map((med) => {
        const status = med.taken ? "✅ Taken" : "⏳ Pending";
        const instructions = med.instructions ? ` - ${med.instructions}` : "";
        return `- ${med.name} (${med.dosage}) at ${med.time} [${status}]${instructions}`;
      })
      .join("\n");

    const takenCount = userContext.medications.filter((m) => m.taken).length;
    const pendingCount = userContext.medications.length - takenCount;

    prompt += `\n\n## User's Current Medication Schedule

The user has ${userContext.medications.length} medication(s) in their list:
${medList}

Summary: ${takenCount} taken today, ${pendingCount} pending.

IMPORTANT CONTEXT:
- When discussing medications, check if they're already in the user's list
- If they ask to add a medicine that's already listed, let them know
- Provide reminders about pending medications when relevant
- If they scan a medicine already in their list, confirm it and mention when they should take it
- Be proactive about medication adherence and safety`;
  } else {
    prompt += `\n\nThe user hasn't added any medications to their list yet. Encourage them to add their medicines so you can help track their schedule and provide reminders.`;
  }

  return prompt;
}

// Re-export Drug type for other modules
export type { Drug };

function getApiKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OpenAI API key. Set VITE_OPENAI_API_KEY in your .env file."
    );
  }
  return apiKey;
}

function getModel(): string {
  return import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL;
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAIMessageContent[];
}

export interface OpenAIMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

export interface ChatCompletionOptions {
  messages: OpenAIMessage[];
  temperature?: number;
  userContext?: UserContext;
}

/**
 * Send a chat completion request to OpenAI (supports vision when images are included)
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<string> {
  const apiKey = getApiKey();
  const { messages, temperature = 0.7, userContext } = options;

  const systemPrompt = buildSystemPrompt(userContext);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature,
      max_tokens: 1500,
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

  return content;
}

/**
 * Analyze one or more medicine images using GPT-4o Vision
 */
export async function analyzeMedicineImages(
  imageDataUrls: string[],
  userPrompt?: string,
  userContext?: UserContext
): Promise<string> {
  const defaultPrompt =
    imageDataUrls.length === 1
      ? "Please identify this medicine and tell me what it is used for, the typical dosage, and any important warnings."
      : `Please identify ALL the medicines in these ${imageDataUrls.length} images. For each medicine, tell me: name, what it's used for, typical dosage, and any important warnings.`;

  const content: OpenAIMessageContent[] = [
    { type: "text", text: userPrompt || defaultPrompt },
    ...imageDataUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    })),
  ];

  return chatCompletion({
    messages: [{ role: "user", content }],
    temperature: 0.3, // Lower temperature for more factual responses
    userContext,
  });
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", WHISPER_MODEL);
  formData.append("language", "en");

  const response = await fetch(WHISPER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const apiError = data?.error?.message ?? response.statusText;
    throw new Error(`Whisper transcription failed: ${apiError}`);
  }

  const text = data?.text?.trim();
  if (!text) {
    throw new Error("Whisper did not return any transcription.");
  }

  return text;
}

/**
 * Convert a File to a base64 data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extract medicines mentioned in AI response text for quick-add feature
 * Uses fast model (gpt-4o-mini) for speed
 */
export async function extractMedicinesFromAIResponse(
  responseText: string
): Promise<ExtractedMedicine[]> {
  const apiKey = getApiKey();

  const extractPrompt = `Analyze this AI assistant response about medicines and extract ALL medicines mentioned.
For each medicine found, extract: name, dosage, time to take, and instructions.

Return a JSON array. If no medicines are found, return an empty array [].
Return ONLY the JSON array, no other text.

Example output:
[{"name": "Metformin", "dosage": "500mg", "time": "After breakfast", "instructions": "Take with food"}]`;

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: FAST_MODEL,
      messages: [
        { role: "system", content: extractPrompt },
        { role: "user", content: responseText },
      ],
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return [];
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return [];
  }

  try {
    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(jsonStr);
    const medicines = Array.isArray(result)
      ? result.filter((m: ExtractedMedicine) => m.name)
      : [];

    // Enhance with drug database matches
    return await enhanceMedicinesWithDatabase(medicines);
  } catch {
    return [];
  }
}

/**
 * Build OpenAI messages from conversation history (handles images)
 */
export function buildMessagesFromHistory(
  history: Array<{
    role: "user" | "assistant";
    content: string;
    imageUrls?: string[];
  }>
): OpenAIMessage[] {
  return history.map((msg) => {
    if (msg.imageUrls && msg.imageUrls.length > 0) {
      const content: OpenAIMessageContent[] = [
        { type: "text", text: msg.content },
        ...msg.imageUrls.map((url) => ({
          type: "image_url" as const,
          image_url: { url, detail: "high" as const },
        })),
      ];
      return { role: msg.role, content };
    }
    return { role: msg.role, content: msg.content };
  });
}

export interface ExtractedMedicine {
  name: string;
  dosage: string;
  time: string;
  instructions: string;
}

const EXTRACTION_PROMPT = `Extract medicine information from the provided input. Return a JSON object with these fields:`;

const MULTI_EXTRACTION_PROMPT = `Extract ALL medicine information from the provided input. The user may mention multiple medicines.

You have access to a Philippine FDA drug database. Match medicine names to their proper brand or generic names when possible.

Return a JSON array of objects, where each object has these fields:
- name: The medicine name (prefer brand name if recognized, or generic name)
- dosage: The dosage amount (e.g., "500mg", "10mg")
- time: Suggested time to take (e.g., "8:00 AM", "After breakfast", "Twice daily")
- instructions: Any special instructions (e.g., "Take with food", "Avoid alcohol")

If any field cannot be determined for a medicine, use an empty string.
Return ONLY the JSON array, no other text.

Example output for multiple medicines:
[
  {"name": "Metformin", "dosage": "500mg", "time": "8:00 AM", "instructions": "Take with food"},
  {"name": "Lisinopril", "dosage": "10mg", "time": "9:00 PM", "instructions": ""}
]

Example output for single medicine:
[{"name": "Aspirin", "dosage": "81mg", "time": "Morning", "instructions": "Take with water"}]`;

const SINGLE_EXTRACTION_PROMPT = `Extract medicine information from the provided input. Return a JSON object with these fields:
- name: The medicine name (generic or brand name)
- dosage: The dosage amount (e.g., "500mg", "10mg")
- time: Suggested time to take (e.g., "8:00 AM", "After breakfast", "Twice daily")
- instructions: Any special instructions (e.g., "Take with food", "Avoid alcohol")

If any field cannot be determined, use an empty string.
Return ONLY the JSON object, no other text.

Example output:
{"name": "Metformin", "dosage": "500mg", "time": "8:00 AM", "instructions": "Take with food"}`;

/**
 * Extract structured medicine data from text (voice transcription) - single medicine
 */
export async function extractMedicineFromText(
  text: string
): Promise<ExtractedMedicine> {
  const apiKey = getApiKey();

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: FAST_MODEL, // Fast model for extraction
      messages: [
        { role: "system", content: SINGLE_EXTRACTION_PROMPT },
        { role: "user", content: `Extract medicine info from: "${text}"` },
      ],
      temperature: 0.1,
      max_tokens: 300,
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
    const medicine = JSON.parse(jsonStr) as ExtractedMedicine;

    // Enhance with drug database match
    const enhanced = await enhanceMedicinesWithDatabase([medicine]);
    return enhanced[0] || { name: "", dosage: "", time: "", instructions: "" };
  } catch {
    return { name: "", dosage: "", time: "", instructions: "" };
  }
}

/**
 * Extract multiple medicines from text (voice transcription)
 * Uses fast model (gpt-4o-mini) for speed
 */
export async function extractMultipleMedicinesFromText(
  text: string
): Promise<ExtractedMedicine[]> {
  const apiKey = getApiKey();

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: FAST_MODEL, // Use fast model for extraction
      messages: [
        { role: "system", content: MULTI_EXTRACTION_PROMPT },
        { role: "user", content: `Extract all medicines from: "${text}"` },
      ],
      temperature: 0.1,
      max_tokens: 800,
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

    // Enhance with drug database matches
    return await enhanceMedicinesWithDatabase(medicines);
  } catch {
    return [];
  }
}

/**
 * Extract structured medicine data from an image (label scan) - single medicine
 */
export async function extractMedicineFromImage(
  imageDataUrl: string
): Promise<ExtractedMedicine> {
  const apiKey = getApiKey();

  const content: OpenAIMessageContent[] = [
    {
      type: "text",
      text: `Look at this medicine label/packaging image and extract the medicine information. ${SINGLE_EXTRACTION_PROMPT}`,
    },
    {
      type: "image_url",
      image_url: { url: imageDataUrl, detail: "high" },
    },
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
      max_tokens: 500,
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
    return JSON.parse(jsonStr) as ExtractedMedicine;
  } catch {
    return { name: "", dosage: "", time: "", instructions: "" };
  }
}

/**
 * Extract multiple medicines from multiple images
 */
export async function extractMultipleMedicinesFromImages(
  imageDataUrls: string[]
): Promise<ExtractedMedicine[]> {
  const apiKey = getApiKey();

  const content: OpenAIMessageContent[] = [
    {
      type: "text",
      text: `Look at these medicine images and extract ALL medicine information. ${MULTI_EXTRACTION_PROMPT}`,
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
      max_tokens: 2000,
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

    // Enhance with drug database matches
    return await enhanceMedicinesWithDatabase(medicines);
  } catch {
    return [];
  }
}

/**
 * Enhance extracted medicines with data from the drug database
 */
export async function enhanceMedicinesWithDatabase(
  medicines: ExtractedMedicine[]
): Promise<ExtractedMedicine[]> {
  const enhanced: ExtractedMedicine[] = [];

  for (const med of medicines) {
    if (!med.name) {
      enhanced.push(med);
      continue;
    }

    // Search for the medicine in the database
    const matches = await searchDrugs(med.name, 1);

    if (matches.length > 0) {
      const match = matches[0];

      // Use the database name (prefer brand name)
      const enhancedMed: ExtractedMedicine = {
        name: match.brandName || match.genericName || med.name,
        dosage: med.dosage || match.strength || "",
        time: med.time,
        instructions: med.instructions,
      };

      enhanced.push(enhancedMed);
    } else {
      enhanced.push(med);
    }
  }

  return enhanced;
}

/**
 * Search the drug database for medicine suggestions
 */
export async function searchMedicineDatabase(
  query: string,
  limit: number = 10
): Promise<Drug[]> {
  return searchDrugs(query, limit);
}

/**
 * Get drug context for AI prompts
 */
export async function getMedicineContext(drugNames: string[]): Promise<string> {
  return getDrugContext(drugNames);
}
