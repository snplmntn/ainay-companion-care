import { searchDrugs, getDrugContext, type Drug } from "./drugDatabase";
import { SupportedLanguage, getLanguagePrompt } from "./language";
import { buildFoodInteractionsContext } from "./drugFoodInteractions";

// Use backend proxy instead of direct OpenAI calls (avoids CORS + keeps API key secure)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const OPENAI_CHAT_PROXY = `${API_BASE_URL}/api/openai/chat`;
const OPENAI_TRANSCRIBE_PROXY = `${API_BASE_URL}/api/openai/transcribe`;

const DEFAULT_MODEL = "gpt-4o";
const FAST_MODEL = "gpt-4o-mini"; // Faster & cheaper for extraction tasks
const WHISPER_MODEL = "whisper-1";

// OPTIMIZATION: Cache model at module level to avoid repeated env access
let cachedModel: string | null = null;

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
 * Linked patient info for companion context
 */
export interface LinkedPatientContext {
  id: string;
  name: string;
  email?: string;
  adherenceRate: number;
  medications: Array<{
    name: string;
    dosage: string;
    time: string;
    taken: boolean;
    instructions?: string;
  }>;
}

/**
 * User context for personalized AI responses
 */
export interface UserContext {
  userName?: string;
  language?: SupportedLanguage;
  userRole?: "patient" | "companion";
  medications?: Array<{
    name: string;
    dosage: string;
    time: string;
    taken: boolean;
    instructions?: string;
  }>;
  // For companions - their linked patients
  linkedPatients?: LinkedPatientContext[];
}

/**
 * Build the system prompt with user context (async to load food interactions)
 */
export async function buildSystemPrompt(
  userContext?: UserContext
): Promise<string> {
  let prompt = BASE_SYSTEM_PROMPT;

  // Add language instructions
  const language = userContext?.language || "en";
  prompt += `\n\n## LANGUAGE INSTRUCTIONS\n${getLanguagePrompt(language)}`;

  if (userContext?.userName) {
    prompt += `\n\nThe user's name is ${userContext.userName}. Address them warmly by name when appropriate.`;
  }

  // Check if user is a companion with linked patients
  const isCompanion = userContext?.userRole === "companion";

  if (
    isCompanion &&
    userContext?.linkedPatients &&
    userContext.linkedPatients.length > 0
  ) {
    // Companion mode - include linked patients information
    prompt += `\n\n## CAREGIVER MODE
    
You are assisting a CAREGIVER who monitors medications for ${userContext.linkedPatients.length} patient(s).

### Linked Patients:`;

    for (const patient of userContext.linkedPatients) {
      const patientMeds = patient.medications || [];
      const takenCount = patientMeds.filter((m) => m.taken).length;
      const pendingCount = patientMeds.length - takenCount;

      prompt += `\n\n#### ${patient.name}`;
      if (patient.email) {
        prompt += ` (${patient.email})`;
      }
      prompt += `\n- Adherence Rate: ${patient.adherenceRate}%`;
      prompt += `\n- Today's Progress: ${takenCount}/${patientMeds.length} medications taken`;

      if (patientMeds.length > 0) {
        prompt += `\n- Medications:`;
        for (const med of patientMeds) {
          const status = med.taken ? "✅ Taken" : "⏳ Pending";
          const instructions = med.instructions ? ` - ${med.instructions}` : "";
          prompt += `\n  • ${med.name} (${med.dosage}) at ${med.time} [${status}]${instructions}`;
        }

        // List pending medications specifically
        const pendingMeds = patientMeds.filter((m) => !m.taken);
        if (pendingMeds.length > 0) {
          prompt += `\n- ⚠️ Pending medications: ${pendingMeds
            .map((m) => m.name)
            .join(", ")}`;
        }
      } else {
        prompt += `\n- No medications added yet`;
      }
    }

    prompt += `\n\n### CAREGIVER CONTEXT:
- The caregiver can ask about ANY of their patients by name
- When they mention a patient's name, provide information about that specific patient
- They can ask questions like "How is [patient name] doing?" or "What medications does [patient name] have pending?"
- Help them monitor all patients' medication adherence
- Alert them if any patient has low adherence or many pending medications
- They can add medications for any of their patients`;

    // Add food interaction warnings for all patients' medications
    const allMeds = userContext.linkedPatients.flatMap(
      (p) => p.medications || []
    );
    if (allMeds.length > 0) {
      const foodInteractionsContext = await buildFoodInteractionsContext(
        allMeds
      );
      if (foodInteractionsContext) {
        prompt += `\n\n${foodInteractionsContext}`;
      }
    }
  } else if (userContext?.medications && userContext.medications.length > 0) {
    // Patient mode - their own medications
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

    // Add food interaction warnings for user's medications
    const foodInteractionsContext = await buildFoodInteractionsContext(
      userContext.medications
    );
    if (foodInteractionsContext) {
      prompt += `\n\n${foodInteractionsContext}`;
    }
  } else if (isCompanion) {
    prompt += `\n\nThe caregiver hasn't linked any patients yet. Encourage them to link patients using the patient's 6-digit link code so they can monitor medications.`;
  } else {
    prompt += `\n\nThe user hasn't added any medications to their list yet. Encourage them to add their medicines so you can help track their schedule and provide reminders.`;
  }

  return prompt;
}

// Re-export Drug type for other modules
export type { Drug };

/**
 * Get model with caching
 * OPTIMIZATION: Only reads from environment once
 */
function getModel(): string {
  if (cachedModel) {
    return cachedModel;
  }

  cachedModel = import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL;
  return cachedModel;
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
 * Send a chat completion request via backend proxy (supports vision when images are included)
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<string> {
  const { messages, temperature = 0.7, userContext } = options;

  const systemPrompt = await buildSystemPrompt(userContext);

  const response = await fetch(OPENAI_CHAT_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    const apiError = data?.error ?? response.statusText;
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
 * Transcribe audio via backend proxy (Whisper API)
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  // Convert blob to base64 for JSON transport
  const arrayBuffer = await audioBlob.arrayBuffer();
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  const response = await fetch(OPENAI_TRANSCRIBE_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio: base64Audio,
      filename: "recording.webm",
      model: WHISPER_MODEL,
      language: "en",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const apiError = data?.error ?? response.statusText;
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
  const extractPrompt = `Analyze this AI assistant response about medicines and extract ALL medicines mentioned.
For each medicine found, extract: name, dosage, time, frequency, and instructions.

Return a JSON array. If no medicines are found, return an empty array [].
Return ONLY the JSON array, no other text.

Fields:
- name: Medicine name
- dosage: Amount (e.g., "500mg")
- time: Clock time in "H:MM AM/PM" format. Default "8:00 AM"
- frequency: One of "once_daily", "twice_daily", "three_times_daily", "four_times_daily", "as_needed". Default "once_daily"
- instructions: Special instructions

Example output:
[{"name": "Metformin", "dosage": "500mg", "time": "8:00 AM", "frequency": "twice_daily", "instructions": "Take with food"}]`;

  const response = await fetch(OPENAI_CHAT_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
  frequency?: string;
  instructions: string;
}

const EXTRACTION_PROMPT = `Extract medicine information from the provided input. Return a JSON object with these fields:`;

const MULTI_EXTRACTION_PROMPT = `Extract ALL medicine information from the provided input. The user may mention multiple medicines.

You have access to a Philippine FDA drug database. Match medicine names to their proper brand or generic names when possible.

Return a JSON array of objects, where each object has these fields:
- name: The medicine name (prefer brand name if recognized, or generic name)
- dosage: The dosage amount (e.g., "500mg", "10mg")
- time: Leave EMPTY string "" if no specific time mentioned. Only fill if a specific time is stated (e.g., "morning" → "8:00 AM", "bedtime" → "9:00 PM").
- frequency: How often to take it. CRITICAL frequency mapping:
  * "once daily", "once a day", "1x daily" → "once_daily"
  * "twice daily", "twice a day", "2x daily", "every 12 hours" → "twice_daily"  
  * "three times daily", "3x daily", "every 8 hours" → "three_times_daily"
  * "four times daily", "4x daily", "every 6 hours" → "four_times_daily"
  * "as needed", "PRN", "every 4 hours", "every 4-6 hours", "when needed", "for pain", "for fever" → "as_needed"
  * Default to "once_daily" ONLY if truly no frequency info
- instructions: Any special instructions (e.g., "Take with food", "Avoid alcohol"). Include the original dosing instructions here (e.g., "Take every 4-6 hours for pain")

CRITICAL: If instructions say "every X hours" or "as needed" or "PRN", frequency MUST be "as_needed".

Return ONLY the JSON array, no other text.

Example output for multiple medicines:
[
  {"name": "Metformin", "dosage": "500mg", "time": "8:00 AM", "frequency": "twice_daily", "instructions": "Take with food"},
  {"name": "Lisinopril", "dosage": "10mg", "time": "9:00 PM", "frequency": "once_daily", "instructions": ""}
]

Example for "Take 1 tab every 4 hours or as needed":
[{"name": "Paracetamol", "dosage": "1 tab", "time": "", "frequency": "as_needed", "instructions": "Take every 4 hours or as needed"}]`;

const SINGLE_EXTRACTION_PROMPT = `Extract medicine information from the provided input. Return a JSON object with these fields:
- name: The medicine name (generic or brand name)
- dosage: The dosage amount (e.g., "500mg", "10mg")
- time: Leave EMPTY string "" if no specific time mentioned. Only fill if a specific time is stated.
- frequency: How often to take it. CRITICAL mapping:
  * "once daily", "1x daily" → "once_daily"
  * "twice daily", "2x daily", "every 12 hours" → "twice_daily"
  * "three times daily", "3x daily", "every 8 hours" → "three_times_daily"
  * "four times daily", "4x daily", "every 6 hours" → "four_times_daily"
  * "as needed", "PRN", "every 4 hours", "every 4-6 hours", "when needed" → "as_needed"
- instructions: Any special instructions. Include original dosing text (e.g., "Take every 4 hours as needed")

CRITICAL: "every X hours" or "as needed" or "PRN" → frequency MUST be "as_needed".

Return ONLY the JSON object, no other text.

Example for "Take 1 tab every 4 hours":
{"name": "Paracetamol", "dosage": "1 tab", "time": "", "frequency": "as_needed", "instructions": "Take every 4 hours"}`;

/**
 * Extract structured medicine data from text (voice transcription) - single medicine
 */
export async function extractMedicineFromText(
  text: string
): Promise<ExtractedMedicine> {
  const response = await fetch(OPENAI_CHAT_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    const apiError = data?.error ?? response.statusText;
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
  const response = await fetch(OPENAI_CHAT_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    const apiError = data?.error ?? response.statusText;
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

  const response = await fetch(OPENAI_CHAT_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    const apiError = data?.error ?? response.statusText;
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

  const response = await fetch(OPENAI_CHAT_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    const apiError = data?.error ?? response.statusText;
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

      // Use the database name (prefer brand name), preserve ALL extracted fields
      const enhancedMed: ExtractedMedicine = {
        name: match.brandName || match.genericName || med.name,
        dosage: med.dosage || match.strength || "",
        time: med.time,
        frequency: med.frequency, // IMPORTANT: preserve frequency!
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
