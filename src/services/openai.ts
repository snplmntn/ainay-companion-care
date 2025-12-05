import {
  searchDrugs,
  getDrugContext,
  getWhisperMedicinePrompt,
  correctMedicineName,
  fuzzySearchDrugs,
  type Drug,
} from "./drugDatabase";
import { SupportedLanguage, getLanguagePrompt, LANGUAGES } from "./language";
import { buildFoodInteractionsContext } from "./drugFoodInteractions";

// Backend proxy for chat (keeps API key secure for large payloads)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const OPENAI_CHAT_PROXY = `${API_BASE_URL}/api/openai/chat`;

const DEFAULT_MODEL = "gpt-4o";
const FAST_MODEL = "gpt-4o-mini"; // Faster & cheaper for extraction tasks
const WHISPER_MODEL = "whisper-1";

// OPTIMIZATION: Cache model at module level to avoid repeated env access
let cachedModel: string | null = null;

const BASE_SYSTEM_PROMPT = `You are AInay, a friendly health companion for seniors. Your role is to help users understand their medications and maintain healthy routines.

## IMPORTANT: MEDICAL DISCLAIMER RULES

When users ask about symptoms, health conditions, possible diagnoses, or seek medical advice, you MUST include a disclaimer at the START of your response. Use this format:

**⚠️ Medical Disclaimer:** I'm not a doctor and cannot provide medical diagnoses. However, I can help you understand potential causes based on your symptoms and offer general wellness tips. Always consult a healthcare professional for proper diagnosis and treatment.

Include this disclaimer when:
- User describes symptoms (pain, discomfort, unusual sensations)
- User asks "what could be wrong" or "what might cause this"
- User asks about diseases, conditions, or health concerns
- User asks for diagnosis or medical opinions
- User asks about drug interactions or side effects beyond basic info
- User describes feeling unwell or sick

Do NOT include the disclaimer when:
- User simply asks about their medication schedule
- User asks about general medication info (what a pill is for)
- User asks to add/remove medications from their list
- User asks about non-health topics
- User scans a medicine and just wants identification

## Medicine Image Analysis

When analyzing medicine images:
- Identify ALL medicines visible in the image (there may be multiple)
- For each medicine, provide: name, typical dosage, purpose, and any important warnings
- Match medicine names against the Philippine FDA drug database when possible
- If you cannot identify a medicine with certainty, say so clearly
- Always remind users to verify with their pharmacist or doctor
- Format your response clearly, listing each medicine separately

## General Health Questions

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
    frequency?: string;
    doses?: DoseContext[]; // Individual dose taken status for multi-dose medications
  }>;
}

/**
 * Dose information for multi-dose medications
 */
export interface DoseContext {
  time: string;
  label: string;
  taken: boolean;
  takenAt?: string;
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
    frequency?: string;
    doses?: DoseContext[]; // Individual dose taken status for multi-dose medications
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

  // Add current date and time so AI knows the context
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  const currentDate = now.toLocaleDateString("en-US", dateOptions);
  const currentTime = now.toLocaleTimeString("en-US", timeOptions);

  prompt += `\n\n## CURRENT DATE & TIME
Today is ${currentDate}.
The current local time is ${currentTime}.
Use this information when discussing medication schedules, reminders, and timing.`;

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

      // Calculate accurate dose counts
      let totalDoses = 0;
      let takenDoses = 0;
      patientMeds.forEach((med) => {
        if (med.doses && med.doses.length > 0) {
          totalDoses += med.doses.length;
          takenDoses += med.doses.filter((d) => d.taken).length;
        } else {
          totalDoses += 1;
          takenDoses += med.taken ? 1 : 0;
        }
      });

      prompt += `\n\n#### ${patient.name}`;
      if (patient.email) {
        prompt += ` (${patient.email})`;
      }
      prompt += `\n- Adherence Rate: ${patient.adherenceRate}%`;
      prompt += `\n- Today's Progress: ${takenDoses}/${totalDoses} doses taken`;

      if (patientMeds.length > 0) {
        prompt += `\n- Medications:`;
        for (const med of patientMeds) {
          // For multi-dose medications, show individual dose status
          if (med.doses && med.doses.length > 0) {
            const medTakenDoses = med.doses.filter((d) => d.taken).length;
            const medTotalDoses = med.doses.length;
            const overallStatus =
              medTakenDoses === medTotalDoses
                ? "✅ All doses taken"
                : `⏳ ${medTakenDoses}/${medTotalDoses}`;
            const instructions = med.instructions
              ? ` - ${med.instructions}`
              : "";
            prompt += `\n  • ${med.name} (${med.dosage}) [${overallStatus}]${instructions}`;
            for (const dose of med.doses) {
              const doseStatus = dose.taken ? "✅" : "⏳";
              prompt += `\n      - ${dose.label} at ${dose.time}: ${doseStatus}`;
            }
          } else {
            const status = med.taken ? "✅ Taken" : "⏳ Pending";
            const instructions = med.instructions
              ? ` - ${med.instructions}`
              : "";
            prompt += `\n  • ${med.name} (${med.dosage}) at ${med.time} [${status}]${instructions}`;
          }
        }

        // List pending medications/doses specifically
        const pendingItems: string[] = [];
        for (const med of patientMeds) {
          if (med.doses && med.doses.length > 0) {
            const pendingDoses = med.doses.filter((d) => !d.taken);
            if (pendingDoses.length > 0) {
              pendingItems.push(
                `${med.name} (${pendingDoses.length} pending doses)`
              );
            }
          } else if (!med.taken) {
            pendingItems.push(med.name);
          }
        }
        if (pendingItems.length > 0) {
          prompt += `\n- ⚠️ Pending: ${pendingItems.join(", ")}`;
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
- They can add medications for any of their patients

### CRITICAL MEDICATION CONTEXT RULES:
1. **NEVER remind about medications or doses marked as ✅ Taken** - those are COMPLETED for today
2. **Focus ONLY on ⏳ PENDING medications/doses** when giving reminders or status updates
3. When asked "what does [patient] need to take?", list ONLY pending items
4. If ALL doses are taken for a patient today, congratulate them - no reminders needed!
5. Don't spam or repeat the same reminders - if you've mentioned a pending med, don't keep mentioning it
6. Already-taken medicines are DONE - don't bring them up unless specifically asked about history
7. Be helpful and supportive, but don't be annoying with repetitive reminders`;

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
        // For multi-dose medications, show individual dose status
        if (med.doses && med.doses.length > 0) {
          const doseStatuses = med.doses
            .map((dose) => {
              const status = dose.taken ? "✅" : "⏳";
              const takenInfo =
                dose.taken && dose.takenAt
                  ? ` (taken at ${new Date(dose.takenAt).toLocaleTimeString()})`
                  : "";
              return `    - ${dose.label} at ${dose.time}: ${status}${takenInfo}`;
            })
            .join("\n");
          const takenDoses = med.doses.filter((d) => d.taken).length;
          const totalDoses = med.doses.length;
          const overallStatus =
            takenDoses === totalDoses
              ? "✅ All doses taken"
              : `⏳ ${takenDoses}/${totalDoses} doses taken`;
          const instructions = med.instructions ? ` - ${med.instructions}` : "";
          return `- **${med.name}** (${med.dosage}) [${overallStatus}]${instructions}\n${doseStatuses}`;
        }
        // Single dose medications
        const status = med.taken ? "✅ Taken" : "⏳ Pending";
        const instructions = med.instructions ? ` - ${med.instructions}` : "";
        return `- **${med.name}** (${med.dosage}) at ${med.time} [${status}]${instructions}`;
      })
      .join("\n");

    // Calculate accurate taken counts including doses
    let totalDoses = 0;
    let takenDoses = 0;
    userContext.medications.forEach((med) => {
      if (med.doses && med.doses.length > 0) {
        totalDoses += med.doses.length;
        takenDoses += med.doses.filter((d) => d.taken).length;
      } else {
        totalDoses += 1;
        takenDoses += med.taken ? 1 : 0;
      }
    });
    const pendingDoses = totalDoses - takenDoses;

    // Separate taken vs pending medications for clearer context
    const takenMeds = userContext.medications.filter((med) => {
      if (med.doses && med.doses.length > 0) {
        return med.doses.every((d) => d.taken);
      }
      return med.taken;
    });
    const pendingMeds = userContext.medications.filter((med) => {
      if (med.doses && med.doses.length > 0) {
        return med.doses.some((d) => !d.taken);
      }
      return !med.taken;
    });

    prompt += `\n\n## User's Current Medication Schedule (Today)

**Today's Progress: ${takenDoses}/${totalDoses} doses taken, ${pendingDoses} pending.**

${
  pendingMeds.length > 0
    ? `### ⏳ PENDING Medications (focus on these):
${pendingMeds
  .map((med) => {
    if (med.doses && med.doses.length > 0) {
      const pendingDoses = med.doses.filter((d) => !d.taken);
      const pendingDosesList = pendingDoses
        .map((d) => `${d.label} at ${d.time}`)
        .join(", ");
      return `- **${med.name}** (${med.dosage}) - ${pendingDoses.length} dose(s) pending: ${pendingDosesList}`;
    }
    return `- **${med.name}** (${med.dosage}) at ${med.time}${
      med.instructions ? ` - ${med.instructions}` : ""
    }`;
  })
  .join("\n")}`
    : ""
}

${
  takenMeds.length > 0
    ? `### ✅ ALREADY TAKEN Today (DO NOT remind about these):
${takenMeds.map((med) => `- ${med.name} (${med.dosage})`).join("\n")}

**IMPORTANT: The user has ALREADY TAKEN these ${
        takenMeds.length
      } medication(s). Do NOT remind them to take these again today.**`
    : ""
}

## CRITICAL MEDICATION CONTEXT RULES:
1. **NEVER remind about medications marked as ✅ ALREADY TAKEN** - the user has completed these for today
2. **Focus ONLY on PENDING (⏳) medications** when giving reminders
3. When asked "what do I need to take?", list ONLY the pending medications
4. If ALL medications are taken, congratulate them - no reminders needed!
5. Don't spam or repeat the same medication reminders in conversation
6. If they scan/mention a medicine they've already taken today, acknowledge it's done and move on
7. Be supportive but don't be annoying with repetitive reminders`;

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
 * Options for transcription
 */
export interface TranscribeOptions {
  language?: SupportedLanguage;
  useMedicinePrompt?: boolean;
}

// Direct OpenAI Whisper URL (called from frontend to avoid base64/payload size issues)
const OPENAI_WHISPER_DIRECT_URL =
  "https://api.openai.com/v1/audio/transcriptions";

/**
 * Get OpenAI API key for direct frontend calls
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OpenAI API key. Set VITE_OPENAI_API_KEY in your .env file."
    );
  }
  return apiKey;
}

/**
 * Transcribe audio directly via OpenAI Whisper API
 * Uses FormData to send audio directly (avoids base64 conversion and payload size limits)
 * Enhanced with medicine-aware prompting for better drug name recognition
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options: TranscribeOptions = {}
): Promise<string> {
  const { language = "en", useMedicinePrompt = true } = options;
  const apiKey = getApiKey();

  // Get the medicine-aware prompt to help Whisper recognize drug names
  let prompt: string | undefined;
  if (useMedicinePrompt) {
    try {
      prompt = await getWhisperMedicinePrompt();
    } catch (e) {
      console.warn("Could not load medicine prompt for Whisper:", e);
    }
  }

  // Map language code to Whisper-compatible format
  // Whisper uses ISO-639-1 codes, Philippine languages map to "tl" (Tagalog)
  const whisperLanguage = language === "en" ? "en" : "tl";

  // Use FormData to send audio directly (no base64 conversion needed)
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", WHISPER_MODEL);
  formData.append("language", whisperLanguage);
  if (prompt) {
    formData.append("prompt", prompt);
  }

  const response = await fetch(OPENAI_WHISPER_DIRECT_URL, {
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
  const extractPrompt = `Analyze this AI assistant response about medicines and extract ALL medicines mentioned.
For each medicine found, extract: name, dosage, time, frequency, route, and instructions.

You understand prescription/pharmacy abbreviations:
- Frequency: qd/od=once daily, bid=twice daily, tid=3x daily, qid=4x daily, prn/q4h=as needed
- Timing: qam=morning, qpm=evening, hs/qhs=bedtime, ac=before meals, pc=after meals
- Route: po=oral, sl=sublingual, top=topical, gtts=drops, inh=inhaled, pr=rectal
- Eyes/Ears: od=right eye, os=left eye, ou=both eyes, ad=right ear, as=left ear, au=both ears

Return a JSON array. If no medicines are found, return an empty array [].
Return ONLY the JSON array, no other text.

Fields:
- name: Medicine name (brand or generic)
- dosage: Amount with form (e.g., "500mg tablet", "2 drops", "1 capsule")
- time: Clock time in "H:MM AM/PM" format. Leave empty "" if not specified. Map: qam→"8:00 AM", hs→"9:00 PM"
- frequency: MUST be one of: "once_daily", "twice_daily", "three_times_daily", "four_times_daily", "as_needed"
  * q4h, prn, as needed, every 4 hours → "as_needed"
  * bid, q12h, twice daily → "twice_daily"
  * tid, q8h, 3x daily → "three_times_daily"
  * qid, q6h, 4x daily → "four_times_daily"
  * qd, od, daily, qam, qpm, hs → "once_daily"
- route: Optional. One of: oral, topical, ophthalmic, otic, inhalation, sublingual, rectal, nasal, injection, transdermal
- instructions: Special instructions in plain English. Translate abbreviations:
  * ac → "Take before meals"
  * pc → "Take after meals"
  * c food → "Take with food"
  * prn pain → "Take as needed for pain"

Example output:
[{"name": "Metformin", "dosage": "500mg tablet", "time": "8:00 AM", "frequency": "twice_daily", "route": "oral", "instructions": "Take with food"}]
[{"name": "Timolol", "dosage": "2 drops", "time": "", "frequency": "twice_daily", "route": "ophthalmic", "instructions": "Instill in both eyes"}]`;

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
  route?: string; // Route of administration (oral, topical, etc.)
}

/**
 * COMPREHENSIVE PRESCRIPTION ABBREVIATION REFERENCE
 * This is used to help AI models understand medical/pharmacy terminology
 */
const PRESCRIPTION_ABBREVIATIONS_REFERENCE = `
## PRESCRIPTION ABBREVIATIONS DICTIONARY

### FREQUENCY & TIMING (Latin Origins)
| Abbreviation | Meaning | Map To |
|--------------|---------|--------|
| qd, QD, q.d., od, OD (when meaning daily) | Once daily (quaque die) | once_daily |
| bid, BID, b.i.d., 2x daily | Twice daily (bis in die) | twice_daily |
| tid, TID, t.i.d., 3x daily | Three times daily (ter in die) | three_times_daily |
| qid, QID, q.i.d., 4x daily | Four times daily (quater in die) | four_times_daily |
| q4h, q4°, Q4H | Every 4 hours | as_needed |
| q6h, q6°, Q6H | Every 6 hours | four_times_daily |
| q8h, q8°, Q8H | Every 8 hours | three_times_daily |
| q12h, q12°, Q12H | Every 12 hours | twice_daily |
| qh, q1h, Q1H | Every hour | as_needed |
| q2h, Q2H | Every 2 hours | as_needed |
| q3h, Q3H | Every 3 hours | as_needed |
| prn, PRN, p.r.n. | As needed (pro re nata) | as_needed |
| hs, HS, h.s., qhs | At bedtime (hora somni) | once_daily, time: "9:00 PM" |
| ac, AC, a.c. | Before meals (ante cibum) | Instructions: "Take before meals" |
| pc, PC, p.c. | After meals (post cibum) | Instructions: "Take after meals" |
| qam, QAM | Every morning | once_daily, time: "8:00 AM" |
| qpm, QPM | Every evening/afternoon | once_daily, time: "6:00 PM" |
| qod, QOD, q.o.d., qad | Every other day | once_daily, Instructions: "Take every other day" |
| qw, qwk, QW | Once weekly | once_daily, Instructions: "Take once weekly" |
| biw, BIW | Twice weekly | once_daily, Instructions: "Take twice weekly" |
| tiw, TIW | Three times weekly | once_daily, Instructions: "Take three times weekly" |
| stat, STAT | Immediately (statim) | as_needed, Instructions: "Take immediately" |
| c, cum, c̄ | With | Instructions context |
| s, sine, s̄ | Without | Instructions context |
| ad lib, ad libitum | As desired/freely | as_needed |

### ROUTE OF ADMINISTRATION
| Abbreviation | Meaning | Route Value |
|--------------|---------|-------------|
| po, PO, p.o., per os | By mouth/orally | oral |
| pr, PR, p.r., per rectum | Rectally | rectal |
| im, IM, i.m. | Intramuscular injection | injection |
| iv, IV, i.v. | Intravenous injection | injection |
| sc, SC, sq, SQ, subq, SubQ, subcut | Subcutaneous injection | injection |
| sl, SL, s.l. | Sublingual (under tongue) | sublingual |
| inh, INH | Inhaled/inhalation | inhalation |
| neb, NEB | Nebulizer | inhalation |
| top, TOP, topical | Topically (on skin) | topical |
| ext, external | External use | topical |
| ad, AD, a.d. | Right ear (auris dextra) | otic (right ear) |
| as, AS, a.s. | Left ear (auris sinistra) | otic (left ear) |
| au, AU, a.u. | Both ears (auris uterque) | otic (both ears) |
| od, OD, o.d. (eye context) | Right eye (oculus dexter) | ophthalmic (right eye) |
| os, OS, o.s. (eye context) | Left eye (oculus sinister) | ophthalmic (left eye) |
| ou, OU, o.u. | Both eyes (oculus uterque) | ophthalmic (both eyes) |
| op, oph, opth | Ophthalmic/eye | ophthalmic |
| otic | Ear | otic |
| nasal, nas | Nasal | nasal |
| pv, PV, per vag, vag | Vaginally | vaginal |
| bucc, buccal | Buccal (inside cheek) | buccal |
| td, TD, transdermal | Transdermal (patch) | transdermal |
| id, ID, intradermal | Intradermal | injection |

### DOSAGE FORMS
| Abbreviation | Meaning |
|--------------|---------|
| tab, tabs, tablet | Tablet |
| cap, caps, capsule | Capsule |
| gtt, gtts | Drop(s) (guttae) |
| susp, suspension | Suspension |
| sol, soln, solution | Solution |
| syr, syrup | Syrup |
| elix, elixir | Elixir |
| amp, ampule | Ampule |
| vial | Vial |
| supp, suppository | Suppository |
| cr, cream | Cream |
| oint, ung, unguentum | Ointment |
| lot, lotion | Lotion |
| gel | Gel |
| patch | Transdermal patch |
| loz, lozenge | Lozenge |
| troche | Troche/lozenge |
| inj, injection | Injection |
| pdr, pwd, powder | Powder |
| aerosol, spray | Spray |
| MDI | Metered-dose inhaler |
| DPI | Dry powder inhaler |
| EC, enteric-coated | Enteric-coated (delayed release) |
| SR, XR, ER, LA, CR | Sustained/extended release |
| IR | Immediate release |
| ODT | Orally disintegrating tablet |
| SL tab | Sublingual tablet |

### QUANTITY & MEASUREMENT
| Abbreviation | Meaning |
|--------------|---------|
| i, I | 1 (Roman numeral) |
| ii, II | 2 |
| iii, III | 3 |
| iv, IV (quantity context) | 4 |
| v, V | 5 |
| ss, ½ | Half (semis) |
| mg | Milligram |
| mcg, μg, ug | Microgram |
| g, gm, gram | Gram |
| mL, ml, cc | Milliliter |
| L | Liter |
| tsp, t | Teaspoon (~5mL) |
| tbsp, T | Tablespoon (~15mL) |
| oz | Ounce |
| IU, iu | International unit |
| mEq, meq | Milliequivalent |
| U, units | Units |
| qs, QS | Quantity sufficient |
| ud, UD, ut dict | As directed (ut dictum) |
| aa, āā | Of each (ana) |
| disp, #30, #60, #90 | Dispense quantity |

### SPECIAL INSTRUCTIONS
| Abbreviation | Meaning |
|--------------|---------|
| c̄, c, cum | With (e.g., "c food" = with food) |
| s̄, s, sine | Without (e.g., "s food" = without food) |
| NR, nr | No refill |
| DAW | Dispense as written |
| sig, Sig | Write on label/directions |
| Rx | Prescription/take |
| NPO, npo | Nothing by mouth |
| MR, may repeat | May repeat |
| x1, x2, x3 | Times 1, times 2, times 3 |
| d/c, DC | Discontinue |
| w/, w | With |
| w/o | Without |
| w/f, wf | With food |
| bf | Before food |
| af | After food |
| aq | Water (aqua) |
| dil | Dilute |
| div | Divide |
| sos | If necessary (si opus sit) |
| NKA, NKDA | No known (drug) allergies |
| max, MAX | Maximum |
| min, MIN | Minimum |

### COMMON PHRASES
- "1 tab po bid" = 1 tablet by mouth twice daily
- "2 gtts ou q4h prn" = 2 drops in both eyes every 4 hours as needed
- "apply top tid" = apply topically three times daily
- "1 cap po ac" = 1 capsule by mouth before meals
- "10mg po qhs" = 10mg by mouth at bedtime
- "5mL po q6h" = 5mL by mouth every 6 hours
- "1 supp pr prn" = 1 suppository rectally as needed
- "2 puffs inh bid" = 2 puffs inhaled twice daily
- "1 patch td qw" = 1 patch transdermally once weekly
`;

const MULTI_EXTRACTION_PROMPT = `Extract ALL medicine information from the provided input. The user may mention multiple medicines.

You are an expert at parsing prescription and pharmacy terminology, including Latin abbreviations.

${PRESCRIPTION_ABBREVIATIONS_REFERENCE}

## EXTRACTION RULES

Return a JSON array of objects with these fields:
- name: The medicine name (prefer brand name if recognized, or generic name)
- dosage: The dosage amount with form (e.g., "500mg tablet", "10mg", "2 drops", "1 capsule")
- time: Specific clock time if mentioned. Map timing abbreviations:
  * qam, morning → "8:00 AM"
  * noon, midday → "12:00 PM"
  * qpm, afternoon, evening → "6:00 PM"
  * hs, qhs, bedtime, night → "9:00 PM"
  * Leave EMPTY "" if no specific time
- frequency: Map to EXACTLY one of these values:
  * "once_daily" ← qd, od, daily, qam, qpm, qhs, hs, once a day
  * "twice_daily" ← bid, b.i.d., q12h, every 12 hours, 2x daily
  * "three_times_daily" ← tid, t.i.d., q8h, every 8 hours, 3x daily
  * "four_times_daily" ← qid, q.i.d., q6h, every 6 hours, 4x daily
  * "as_needed" ← prn, p.r.n., q4h, q3h, q2h, qh, every 4 hours, as needed, when needed, for pain, for fever, stat, ad lib, sos
  * Default to "once_daily" ONLY if no frequency info at all
- route: Route of administration (optional but helpful):
  * "oral" ← po, by mouth, orally, tab, cap, syrup
  * "topical" ← top, apply, cream, ointment, gel, lotion, external
  * "ophthalmic" ← eye drops, od, os, ou, gtts (eye context)
  * "otic" ← ear drops, ad, as, au, gtts (ear context)
  * "inhalation" ← inh, neb, puffs, inhaler, MDI
  * "sublingual" ← sl, under tongue
  * "rectal" ← pr, suppository
  * "nasal" ← nasal spray, nasal drops
  * "injection" ← im, iv, sc, subq, inject
  * "transdermal" ← patch, td
- instructions: Human-readable special instructions. ALWAYS translate abbreviations:
  * ac → "Take before meals"
  * pc → "Take after meals"
  * c food, w/f → "Take with food"
  * s food, w/o food → "Take without food/on empty stomach"
  * c water → "Take with water"
  * prn pain → "Take as needed for pain"
  * prn fever → "Take as needed for fever"
  * stat → "Take immediately"
  * qod → "Take every other day"
  * qw → "Take once weekly"
  * NPO → "Do not eat or drink before taking"
  * Include original dosing schedule if it's "as needed" type (e.g., "Take every 4-6 hours as needed for pain")

## CRITICAL RULES
1. If frequency contains q1h-q4h or "every X hours" where X < 6, or prn/as needed → frequency = "as_needed"
2. Always translate Latin/medical abbreviations to plain English in instructions
3. Recognize "i tab" = 1 tablet, "ii caps" = 2 capsules, "gtt" = drops
4. Context matters: "od" before eye medicine = right eye, "od" for frequency = once daily
5. "gtts" for eye/ear = drops (include route: ophthalmic or otic)

Return ONLY the JSON array, no other text.

## EXAMPLES

Input: "Metformin 500mg po bid c food"
Output: [{"name": "Metformin", "dosage": "500mg tablet", "time": "", "frequency": "twice_daily", "route": "oral", "instructions": "Take with food"}]

Input: "Amoxicillin 500mg 1 cap po tid x 7 days"
Output: [{"name": "Amoxicillin", "dosage": "500mg capsule", "time": "", "frequency": "three_times_daily", "route": "oral", "instructions": "Take for 7 days"}]

Input: "Paracetamol 500mg i tab po q4-6h prn fever"
Output: [{"name": "Paracetamol", "dosage": "500mg tablet", "time": "", "frequency": "as_needed", "route": "oral", "instructions": "Take 1 tablet every 4-6 hours as needed for fever"}]

Input: "Timolol 0.5% ii gtts ou bid"
Output: [{"name": "Timolol", "dosage": "0.5% solution", "time": "", "frequency": "twice_daily", "route": "ophthalmic", "instructions": "Instill 2 drops in both eyes twice daily"}]

Input: "Ciprofloxacin otic 3 gtts ad tid x 7d"
Output: [{"name": "Ciprofloxacin Otic", "dosage": "3 drops", "time": "", "frequency": "three_times_daily", "route": "otic", "instructions": "Instill 3 drops in right ear three times daily for 7 days"}]

Input: "Omeprazole 20mg po qam ac"
Output: [{"name": "Omeprazole", "dosage": "20mg capsule", "time": "8:00 AM", "frequency": "once_daily", "route": "oral", "instructions": "Take in the morning before meals"}]

Input: "Nitroglycerin 0.4mg sl prn chest pain"
Output: [{"name": "Nitroglycerin", "dosage": "0.4mg tablet", "time": "", "frequency": "as_needed", "route": "sublingual", "instructions": "Place under tongue as needed for chest pain"}]

Input: "Insulin 10 units sc qam ac breakfast"
Output: [{"name": "Insulin", "dosage": "10 units", "time": "8:00 AM", "frequency": "once_daily", "route": "injection", "instructions": "Inject subcutaneously in the morning before breakfast"}]

Input: "Hydrocortisone cream apply top bid to affected area"
Output: [{"name": "Hydrocortisone", "dosage": "cream", "time": "", "frequency": "twice_daily", "route": "topical", "instructions": "Apply to affected area twice daily"}]

Input: "Albuterol MDI 2 puffs inh q4h prn SOB"
Output: [{"name": "Albuterol", "dosage": "2 puffs", "time": "", "frequency": "as_needed", "route": "inhalation", "instructions": "Inhale 2 puffs every 4 hours as needed for shortness of breath"}]

Input: "Melatonin 3mg po qhs"
Output: [{"name": "Melatonin", "dosage": "3mg tablet", "time": "9:00 PM", "frequency": "once_daily", "route": "oral", "instructions": "Take at bedtime"}]

Input: "Aspirin 81mg po qd c food"
Output: [{"name": "Aspirin", "dosage": "81mg tablet", "time": "", "frequency": "once_daily", "route": "oral", "instructions": "Take once daily with food"}]

Input: "Prednisone taper: 40mg x3d, 30mg x3d, 20mg x3d, 10mg x3d"
Output: [{"name": "Prednisone", "dosage": "Taper dose", "time": "", "frequency": "once_daily", "route": "oral", "instructions": "Taper: 40mg for 3 days, then 30mg for 3 days, then 20mg for 3 days, then 10mg for 3 days"}]`;

const SINGLE_EXTRACTION_PROMPT = `Extract medicine information from the provided input. You are an expert at parsing prescription and pharmacy terminology.

${PRESCRIPTION_ABBREVIATIONS_REFERENCE}

## EXTRACTION RULES

Return a JSON object with these fields:
- name: The medicine name (generic or brand name)
- dosage: The dosage amount with form (e.g., "500mg tablet", "2 drops")
- time: Specific clock time if mentioned:
  * qam, morning → "8:00 AM"
  * noon → "12:00 PM"
  * qpm, afternoon, evening → "6:00 PM"
  * hs, qhs, bedtime → "9:00 PM"
  * Leave EMPTY "" if no specific time
- frequency: Map to EXACTLY one of:
  * "once_daily" ← qd, od, daily, qam, qpm, qhs, hs
  * "twice_daily" ← bid, b.i.d., q12h, every 12 hours
  * "three_times_daily" ← tid, t.i.d., q8h, every 8 hours
  * "four_times_daily" ← qid, q.i.d., q6h, every 6 hours
  * "as_needed" ← prn, q4h or less, every 4 hours, as needed, for pain, stat
- route: Route of administration (oral, topical, ophthalmic, otic, inhalation, sublingual, rectal, nasal, injection, transdermal)
- instructions: Human-readable instructions. ALWAYS translate abbreviations:
  * ac → "Take before meals"
  * pc → "Take after meals"
  * c food → "Take with food"
  * prn pain → "Take as needed for pain"
  * Include original dosing if "as needed" type

## CRITICAL
- q1h-q4h or "every X hours" (X < 6) or prn → frequency = "as_needed"
- Translate ALL Latin abbreviations to plain English
- "i" = 1, "ii" = 2, "iii" = 3, "gtt/gtts" = drop(s)

Return ONLY the JSON object, no other text.

## EXAMPLES

Input: "Ibuprofen 400mg po q6h prn pain"
Output: {"name": "Ibuprofen", "dosage": "400mg tablet", "time": "", "frequency": "as_needed", "route": "oral", "instructions": "Take every 6 hours as needed for pain"}

Input: "Losartan 50mg po qam"
Output: {"name": "Losartan", "dosage": "50mg tablet", "time": "8:00 AM", "frequency": "once_daily", "route": "oral", "instructions": "Take in the morning"}

Input: "Artificial tears ii gtts ou q4h prn dry eyes"
Output: {"name": "Artificial Tears", "dosage": "2 drops", "time": "", "frequency": "as_needed", "route": "ophthalmic", "instructions": "Instill 2 drops in both eyes every 4 hours as needed for dry eyes"}`;

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
 * Uses fuzzy matching to handle voice transcription errors
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

    // First try standard search
    let matches = await searchDrugs(med.name, 1);

    // If no standard matches, try fuzzy search for voice transcription errors
    if (matches.length === 0) {
      const fuzzyMatches = await fuzzySearchDrugs(med.name, 1, 2);
      if (fuzzyMatches.length > 0 && fuzzyMatches[0].score >= 50) {
        matches = [fuzzyMatches[0].drug];
        console.log(
          `🔄 Medicine name corrected: "${med.name}" → "${
            fuzzyMatches[0].drug.brandName || fuzzyMatches[0].drug.genericName
          }" (${fuzzyMatches[0].matchType}, score: ${fuzzyMatches[0].score})`
        );
      }
    }

    // Also try the correctMedicineName function for known aliases
    if (matches.length === 0) {
      const correction = await correctMedicineName(med.name);
      if (
        correction.confidence >= 70 &&
        correction.corrected !== correction.original
      ) {
        const correctedMatches = await searchDrugs(correction.corrected, 1);
        if (correctedMatches.length > 0) {
          matches = correctedMatches;
          console.log(
            `🔄 Medicine name corrected via alias: "${med.name}" → "${correction.corrected}"`
          );
        }
      }
    }

    if (matches.length > 0) {
      const match = matches[0];

      // Use the database name (prefer brand name), preserve ALL extracted fields
      const enhancedMed: ExtractedMedicine = {
        name: match.brandName || match.genericName || med.name,
        dosage: med.dosage || match.strength || "",
        time: med.time,
        frequency: med.frequency, // IMPORTANT: preserve frequency!
        instructions: med.instructions,
        route: med.route, // Preserve route of administration
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
