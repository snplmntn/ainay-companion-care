// ============================================
// Drug Interaction Checking Service
// OPTIMIZED: Uses indexed lookups for O(1) access
//
// DATA SOURCE:
// Drug-Drug Interactions Management and Safer Alternatives (Kaggle)
// https://www.kaggle.com/datasets/shayanhusain/drug-drug-interactions-management-and-safer-alters
// ============================================

import type { Medication } from "@/types";

/**
 * Severity levels for drug interactions
 */
export type InteractionSeverity = "Major" | "Moderate" | "Minor";

/**
 * Drug interaction data structure from cleaned_interactions.json
 */
export interface DrugInteraction {
  interaction_id: number;
  drug_a: string;
  drug_b: string;
  severity: InteractionSeverity;
  mechanism: string;
  clinical_effect: string;
  safer_alternative: string;
}

/**
 * Result of checking a drug against current medications
 */
export interface InteractionCheckResult {
  hasInteractions: boolean;
  interactions: DetectedInteraction[];
}

/**
 * A detected interaction between the new medicine and a current medication
 */
export interface DetectedInteraction {
  currentMedication: string;
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffect: string;
  saferAlternative: string;
}

// Cache for loaded interactions
let interactionsCache: DrugInteraction[] | null = null;
// OPTIMIZATION: Index for O(1) lookups by drug name
let interactionIndex: Map<string, DrugInteraction[]> | null = null;
let indexBuildPromise: Promise<void> | null = null;

/**
 * Build the interaction index for fast lookups
 * Maps normalized drug names to their interactions
 */
function buildInteractionIndex(
  interactions: DrugInteraction[]
): Map<string, DrugInteraction[]> {
  const index = new Map<string, DrugInteraction[]>();

  for (const interaction of interactions) {
    // Index by both drug names (normalized)
    const drugAKey = normalizeDrugName(interaction.drug_a);
    const drugBKey = normalizeDrugName(interaction.drug_b);

    // Also index by primary name (first word)
    const drugAPrimary = extractPrimaryName(interaction.drug_a);
    const drugBPrimary = extractPrimaryName(interaction.drug_b);

    const keysToIndex = [drugAKey, drugBKey, drugAPrimary, drugBPrimary];

    for (const key of keysToIndex) {
      if (key.length < 3) continue; // Skip very short keys
      const existing = index.get(key) || [];
      // Avoid duplicates
      if (
        !existing.some((i) => i.interaction_id === interaction.interaction_id)
      ) {
        existing.push(interaction);
        index.set(key, existing);
      }
    }
  }

  return index;
}

/**
 * Load drug interactions from the JSON file
 */
async function loadInteractions(): Promise<DrugInteraction[]> {
  if (interactionsCache) {
    return interactionsCache;
  }

  try {
    const response = await fetch("/cleaned_interactions.json");
    if (!response.ok) {
      console.error("Failed to load drug interactions:", response.statusText);
      return [];
    }
    const data = await response.json();
    interactionsCache = data as DrugInteraction[];

    // Build index synchronously to ensure it's ready for use
    interactionIndex = buildInteractionIndex(interactionsCache);
    console.log(
      `✅ Drug interactions indexed: ${interactionsCache.length} interactions`
    );

    return interactionsCache;
  } catch (error) {
    console.error("Error loading drug interactions:", error);
    return [];
  }
}

/**
 * Ensure index is ready before using it
 */
async function ensureIndexReady(): Promise<void> {
  if (interactionIndex) return;

  if (indexBuildPromise) {
    await indexBuildPromise;
    return;
  }

  indexBuildPromise = (async () => {
    await loadInteractions();
  })();

  await indexBuildPromise;
}

/**
 * Common salt forms and suffixes to remove from drug names
 */
const SALT_FORMS = [
  "sodium",
  "potassium",
  "calcium",
  "hydrochloride",
  "hcl",
  "sulfate",
  "sulphate",
  "phosphate",
  "acetate",
  "citrate",
  "maleate",
  "fumarate",
  "tartrate",
  "besylate",
  "mesylate",
  "succinate",
  "lactate",
  "bromide",
  "chloride",
  "nitrate",
  "oxide",
];

/**
 * Normalize drug name for comparison (handles common variations)
 */
function normalizeDrugName(name: string): string {
  let normalized = name
    .toLowerCase()
    .trim()
    // Remove dosage info at the end (e.g., "500mg", "10 mg")
    .replace(
      /\s*\d+(\.\d+)?\s*(mg|mcg|ml|g|iu|units?|tablets?|caps?|capsules?)\s*$/gi,
      ""
    )
    // Remove parenthetical info like "(As Sodium)", "(HCl)", "(Extended Release)"
    .replace(/\s*\([^)]*\)\s*/g, " ")
    // Remove "as" followed by salt form (e.g., "as sodium")
    .replace(/\s+as\s+\w+/gi, "")
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Remove trailing salt forms (e.g., "warfarin sodium" → "warfarin")
  for (const salt of SALT_FORMS) {
    const saltPattern = new RegExp(`\\s+${salt}\\s*$`, "i");
    normalized = normalized.replace(saltPattern, "");
  }

  return normalized.trim();
}

/**
 * Extract the primary drug name (first word or compound name)
 */
function extractPrimaryName(name: string): string {
  const normalized = normalizeDrugName(name);
  // Return the first word, which is usually the main drug name
  return normalized.split(" ")[0];
}

/**
 * Check if two drug names match (handles partial matches and common aliases)
 */
function drugNamesMatch(drugA: string, drugB: string): boolean {
  const normalizedA = normalizeDrugName(drugA);
  const normalizedB = normalizeDrugName(drugB);

  // Exact match after normalization
  if (normalizedA === normalizedB) {
    return true;
  }

  // Check if one contains the other (for brand vs generic names)
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    return true;
  }

  // Extract primary names and compare
  const primaryA = extractPrimaryName(drugA);
  const primaryB = extractPrimaryName(drugB);

  // If primary names match and are meaningful (> 3 chars)
  if (primaryA === primaryB && primaryA.length > 3) {
    return true;
  }

  // Check if primary name of one matches the full normalized name of the other
  if (primaryA === normalizedB || primaryB === normalizedA) {
    return true;
  }

  // Check word-by-word for partial matches
  const wordsA = normalizedA.split(" ");
  const wordsB = normalizedB.split(" ");

  // If the first significant word matches, consider it a match
  // This handles cases like "Warfarin Sodium" vs "Warfarin"
  if (wordsA[0] === wordsB[0] && wordsA[0].length > 3) {
    return true;
  }

  // Check if any significant word from A matches any significant word from B
  for (const wordA of wordsA) {
    if (wordA.length <= 3) continue; // Skip short words
    for (const wordB of wordsB) {
      if (wordB.length <= 3) continue;
      if (wordA === wordB) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get candidate interactions for a drug using the index
 * OPTIMIZATION: O(1) lookup instead of O(n) scan
 */
function getCandidateInteractions(drugName: string): DrugInteraction[] {
  if (!interactionIndex) return [];

  const candidates = new Set<DrugInteraction>();
  const normalized = normalizeDrugName(drugName);
  const primary = extractPrimaryName(drugName);

  // Look up by normalized name
  const byNormalized = interactionIndex.get(normalized);
  if (byNormalized) {
    byNormalized.forEach((i) => candidates.add(i));
  }

  // Look up by primary name
  const byPrimary = interactionIndex.get(primary);
  if (byPrimary) {
    byPrimary.forEach((i) => candidates.add(i));
  }

  return Array.from(candidates);
}

/**
 * Check a new medicine against current medications for interactions
 * OPTIMIZED: Uses indexed lookups instead of O(n*m) full scan
 */
export async function checkDrugInteractions(
  newMedicineName: string,
  currentMedications: Medication[]
): Promise<InteractionCheckResult> {
  // Ensure index is ready
  await ensureIndexReady();

  const detectedInteractions: DetectedInteraction[] = [];
  const normalizedNewDrug = normalizeDrugName(newMedicineName);

  // OPTIMIZATION: Get candidate interactions for the new drug using index
  const newDrugCandidates = getCandidateInteractions(newMedicineName);

  // Also get candidates for all current medications
  const currentMedCandidates = new Map<string, DrugInteraction[]>();
  for (const med of currentMedications) {
    currentMedCandidates.set(med.name, getCandidateInteractions(med.name));
  }

  // Check only relevant candidates (indexed) instead of all interactions
  const checkedPairs = new Set<string>();

  for (const currentMed of currentMedications) {
    const normalizedCurrentDrug = normalizeDrugName(currentMed.name);

    // Skip if comparing to itself
    if (normalizedNewDrug === normalizedCurrentDrug) {
      continue;
    }

    // Get all candidate interactions to check
    const candidatesToCheck = [
      ...newDrugCandidates,
      ...(currentMedCandidates.get(currentMed.name) || []),
    ];

    // Remove duplicates by interaction_id
    const uniqueCandidates = new Map<number, DrugInteraction>();
    for (const c of candidatesToCheck) {
      uniqueCandidates.set(c.interaction_id, c);
    }

    for (const interaction of uniqueCandidates.values()) {
      // Create a unique key for this pair to avoid duplicate checks
      const pairKey = `${normalizedNewDrug}|${normalizedCurrentDrug}|${interaction.interaction_id}`;
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Check if the new medicine and current medication match the interaction pair
      const newMatchesA = drugNamesMatch(newMedicineName, interaction.drug_a);
      const newMatchesB = drugNamesMatch(newMedicineName, interaction.drug_b);
      const currentMatchesA = drugNamesMatch(
        currentMed.name,
        interaction.drug_a
      );
      const currentMatchesB = drugNamesMatch(
        currentMed.name,
        interaction.drug_b
      );

      const isMatch =
        (newMatchesA && currentMatchesB) || (newMatchesB && currentMatchesA);

      if (isMatch) {
        // Check if we already have this interaction (avoid duplicates)
        const alreadyDetected = detectedInteractions.some(
          (d) =>
            normalizeDrugName(d.currentMedication) === normalizedCurrentDrug
        );

        if (!alreadyDetected) {
          detectedInteractions.push({
            currentMedication: currentMed.name,
            severity: interaction.severity,
            mechanism: interaction.mechanism,
            clinicalEffect: interaction.clinical_effect,
            saferAlternative: interaction.safer_alternative,
          });
        }
      }
    }
  }

  // Sort by severity (Major first, then Moderate, then Minor)
  const severityOrder: Record<InteractionSeverity, number> = {
    Major: 0,
    Moderate: 1,
    Minor: 2,
  };

  detectedInteractions.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return {
    hasInteractions: detectedInteractions.length > 0,
    interactions: detectedInteractions,
  };
}

/**
 * Get the color class for a severity level
 */
export function getSeverityColor(severity: InteractionSeverity): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (severity) {
    case "Major":
      return {
        bg: "bg-red-50 dark:bg-red-950/30",
        text: "text-red-700 dark:text-red-400",
        border: "border-red-300 dark:border-red-800",
        icon: "text-red-600 dark:text-red-500",
      };
    case "Moderate":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-300 dark:border-amber-800",
        icon: "text-amber-600 dark:text-amber-500",
      };
    case "Minor":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        text: "text-blue-700 dark:text-blue-400",
        border: "border-blue-300 dark:border-blue-800",
        icon: "text-blue-600 dark:text-blue-500",
      };
  }
}

/**
 * Get a severity-appropriate icon name
 */
export function getSeverityIcon(severity: InteractionSeverity): string {
  switch (severity) {
    case "Major":
      return "AlertOctagon";
    case "Moderate":
      return "AlertTriangle";
    case "Minor":
      return "Info";
  }
}

/**
 * Preload interactions index (call early in app lifecycle)
 */
export async function preloadInteractionsIndex(): Promise<void> {
  await ensureIndexReady();
}
