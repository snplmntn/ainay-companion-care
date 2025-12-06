// ============================================
// Drug-to-Food Interactions Service
// Provides food interaction data for medications
// OPTIMIZED: Added prefix index for faster fuzzy matching
//
// DATA SOURCE:
// Drug-Food Interactions Dataset (Kaggle)
// https://www.kaggle.com/datasets/shayanhusain/drug-food-interactions-dataset
// ============================================

/**
 * Drug-to-food interaction entry from the dataset
 */
export interface DrugFoodInteraction {
  name: string;
  reference: string;
  food_interactions: string[];
}

// Cache for loaded interactions
let foodInteractionsCache: DrugFoodInteraction[] | null = null;
let foodInteractionsMap: Map<string, DrugFoodInteraction> | null = null;
// OPTIMIZATION: Prefix index for faster fuzzy matching (first word -> entries)
let prefixIndex: Map<string, DrugFoodInteraction[]> | null = null;
// OPTIMIZATION: Loading promise to prevent concurrent loads
let loadingPromise: Promise<DrugFoodInteraction[]> | null = null;

/**
 * Build prefix index for faster fuzzy lookups
 * Maps first word and common prefixes to entries
 */
function buildPrefixIndex(
  interactions: DrugFoodInteraction[]
): Map<string, DrugFoodInteraction[]> {
  const index = new Map<string, DrugFoodInteraction[]>();

  for (const entry of interactions) {
    const normalized = normalizeDrugName(entry.name);
    const words = normalized.split(" ");

    // Index by first word (most common lookup)
    const firstWord = words[0];
    if (firstWord && firstWord.length >= 3) {
      const existing = index.get(firstWord) || [];
      existing.push(entry);
      index.set(firstWord, existing);

      // Also index prefixes of first word (for partial matching)
      for (let len = 3; len < firstWord.length; len++) {
        const prefix = firstWord.slice(0, len);
        const prefixEntries = index.get(prefix) || [];
        if (!prefixEntries.includes(entry)) {
          prefixEntries.push(entry);
          index.set(prefix, prefixEntries);
        }
      }
    }

    // Index by significant words (length > 4)
    for (const word of words.slice(1)) {
      if (word.length >= 4) {
        const existing = index.get(word) || [];
        if (!existing.includes(entry)) {
          existing.push(entry);
          index.set(word, existing);
        }
      }
    }
  }

  return index;
}

/**
 * Load drug-to-food interactions from the JSON file
 */
async function loadFoodInteractions(): Promise<DrugFoodInteraction[]> {
  if (foodInteractionsCache) {
    return foodInteractionsCache;
  }

  // Return existing loading promise to prevent concurrent loads
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const response = await fetch("/Drug to Food interactions Dataset.json");
      if (!response.ok) {
        console.error(
          "Failed to load drug-food interactions:",
          response.statusText
        );
        return [];
      }
      const data = await response.json();
      foodInteractionsCache = data as DrugFoodInteraction[];

      // Build lookup map for exact matching (O(1))
      foodInteractionsMap = new Map();
      for (const entry of foodInteractionsCache) {
        foodInteractionsMap.set(normalizeDrugName(entry.name), entry);
      }

      // OPTIMIZATION: Build prefix index for fuzzy matching
      prefixIndex = buildPrefixIndex(foodInteractionsCache);
      console.log(
        `✅ Drug-food interactions indexed: ${foodInteractionsCache.length} entries`
      );

      return foodInteractionsCache;
    } catch (error) {
      console.error("Error loading drug-food interactions:", error);
      return [];
    }
  })();

  return loadingPromise;
}

/**
 * Normalize drug name for comparison
 */
function normalizeDrugName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove dosage info
    .replace(
      /\s*\d+(\.\d+)?\s*(mg|mcg|ml|g|iu|units?|tablets?|caps?|capsules?)\s*$/gi,
      ""
    )
    // Remove parenthetical info
    .replace(/\s*\([^)]*\)\s*/g, " ")
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Common drug name aliases (brand to generic mappings)
 */
const DRUG_ALIASES: Record<string, string[]> = {
  // Common brand-generic mappings
  tylenol: ["acetaminophen", "paracetamol"],
  advil: ["ibuprofen"],
  motrin: ["ibuprofen"],
  aleve: ["naproxen"],
  lipitor: ["atorvastatin"],
  zocor: ["simvastatin"],
  crestor: ["rosuvastatin"],
  coumadin: ["warfarin"],
  glucophage: ["metformin"],
  zestril: ["lisinopril"],
  prinivil: ["lisinopril"],
  norvasc: ["amlodipine"],
  lasix: ["furosemide"],
  synthroid: ["levothyroxine"],
  plavix: ["clopidogrel"],
  xanax: ["alprazolam"],
  valium: ["diazepam"],
  ambien: ["zolpidem"],
  prozac: ["fluoxetine"],
  zoloft: ["sertraline"],
  lexapro: ["escitalopram"],
  prilosec: ["omeprazole"],
  nexium: ["esomeprazole"],
  lantus: ["insulin glargine"],
  humalog: ["insulin lispro"],
  novolog: ["insulin aspart"],
};

/**
 * Get possible drug names to search (includes aliases)
 */
function getDrugSearchNames(drugName: string): string[] {
  const normalized = normalizeDrugName(drugName);
  const names = [normalized];

  // Check if there's an alias
  for (const [brand, generics] of Object.entries(DRUG_ALIASES)) {
    if (normalized.includes(brand)) {
      names.push(...generics);
    }
    // Also check reverse (generic to brand)
    for (const generic of generics) {
      if (normalized.includes(generic)) {
        names.push(brand);
      }
    }
  }

  // Extract first word (often the main drug name)
  const firstWord = normalized.split(" ")[0];
  if (firstWord && firstWord.length > 3 && !names.includes(firstWord)) {
    names.push(firstWord);
  }

  return names;
}

/**
 * Find food interactions for a specific drug
 * OPTIMIZED: Uses prefix index for faster fuzzy matching
 */
export async function findFoodInteractions(
  drugName: string
): Promise<DrugFoodInteraction | null> {
  await loadFoodInteractions();

  if (!foodInteractionsMap || !prefixIndex) {
    return null;
  }

  const searchNames = getDrugSearchNames(drugName);

  // STEP 1: Try exact match first (O(1))
  for (const name of searchNames) {
    const exact = foodInteractionsMap.get(name);
    if (exact) {
      return exact;
    }
  }

  // STEP 2: Try indexed prefix/first-word match (O(1) lookup + small scan)
  const candidatesSet = new Set<DrugFoodInteraction>();

  for (const searchName of searchNames) {
    const searchFirstWord = searchName.split(" ")[0];

    // Look up by first word
    if (searchFirstWord && searchFirstWord.length >= 3) {
      const byFirstWord = prefixIndex.get(searchFirstWord);
      if (byFirstWord) {
        byFirstWord.forEach((entry) => candidatesSet.add(entry));
      }

      // Also try shorter prefixes
      for (let len = 3; len < searchFirstWord.length; len++) {
        const prefix = searchFirstWord.slice(0, len);
        const byPrefix = prefixIndex.get(prefix);
        if (byPrefix) {
          byPrefix.forEach((entry) => candidatesSet.add(entry));
        }
      }
    }

    // Look up by significant words in the search term
    const words = searchName.split(" ");
    for (const word of words) {
      if (word.length >= 4) {
        const byWord = prefixIndex.get(word);
        if (byWord) {
          byWord.forEach((entry) => candidatesSet.add(entry));
        }
      }
    }
  }

  // STEP 3: Check only the candidates (much smaller than full 11K scan)
  if (candidatesSet.size > 0) {
    for (const entry of candidatesSet) {
      const entryNormalized = normalizeDrugName(entry.name);

      for (const searchName of searchNames) {
        // Check if either contains the other
        if (
          entryNormalized.includes(searchName) ||
          searchName.includes(entryNormalized)
        ) {
          return entry;
        }

        // Check first word match
        const entryFirstWord = entryNormalized.split(" ")[0];
        const searchFirstWord = searchName.split(" ")[0];
        if (entryFirstWord === searchFirstWord && entryFirstWord.length > 3) {
          return entry;
        }
      }
    }
  }

  // STEP 4: Last resort - limited scan for substring matches (only if no candidates)
  // This handles edge cases where the drug name structure is unusual
  // Limit to first 100 entries to prevent full O(n) scan
  if (candidatesSet.size === 0 && foodInteractionsCache) {
    const maxScan = Math.min(100, foodInteractionsCache.length);
    for (let i = 0; i < maxScan; i++) {
      const entry = foodInteractionsCache[i];
      const entryNormalized = normalizeDrugName(entry.name);

      for (const searchName of searchNames) {
        if (
          entryNormalized.includes(searchName) ||
          searchName.includes(entryNormalized)
        ) {
          return entry;
        }
      }
    }
  }

  return null;
}

/**
 * Get food interactions for multiple drugs
 */
export async function getFoodInteractionsForMedications(
  medications: Array<{ name: string }>
): Promise<Map<string, string[]>> {
  // Ensure data is loaded once before processing all medications
  await loadFoodInteractions();

  const results = new Map<string, string[]>();

  for (const med of medications) {
    const interaction = await findFoodInteractions(med.name);
    if (interaction && interaction.food_interactions.length > 0) {
      results.set(med.name, interaction.food_interactions);
    }
  }

  return results;
}

/**
 * Build a context string for AI prompts with food interaction information
 */
export async function buildFoodInteractionsContext(
  medications: Array<{ name: string }>
): Promise<string> {
  const interactions = await getFoodInteractionsForMedications(medications);

  if (interactions.size === 0) {
    return "";
  }

  let context = "## Drug-to-Food Interaction Warnings\n\n";
  context +=
    "IMPORTANT: The following food and dietary interactions apply to the user's medications:\n\n";

  for (const [medName, foodInteractions] of interactions) {
    context += `### ${medName}\n`;
    for (const interaction of foodInteractions) {
      context += `- ${interaction}\n`;
    }
    context += "\n";
  }

  context += `\nWhen discussing these medications or diet/nutrition topics, proactively inform the user about relevant food interactions. Data source: Drug-Food Interactions Dataset (Kaggle).`;

  return context;
}

/**
 * Search for drugs with food interactions matching a query
 * OPTIMIZED: Uses prefix index for faster searching
 */
export async function searchFoodInteractions(
  query: string,
  limit: number = 10
): Promise<DrugFoodInteraction[]> {
  await loadFoodInteractions();

  if (!foodInteractionsCache || !prefixIndex) {
    return [];
  }

  const normalizedQuery = normalizeDrugName(query);
  const results: DrugFoodInteraction[] = [];
  const seen = new Set<string>();

  // STEP 1: Use prefix index for faster matching
  const queryFirstWord = normalizedQuery.split(" ")[0];
  if (queryFirstWord && queryFirstWord.length >= 3) {
    // Try exact first word match
    const byFirstWord = prefixIndex.get(queryFirstWord);
    if (byFirstWord) {
      for (const entry of byFirstWord) {
        if (results.length >= limit) break;
        if (!seen.has(entry.name)) {
          seen.add(entry.name);
          results.push(entry);
        }
      }
    }

    // Try prefix matches
    if (results.length < limit) {
      for (let len = 3; len < queryFirstWord.length; len++) {
        const prefix = queryFirstWord.slice(0, len);
        const byPrefix = prefixIndex.get(prefix);
        if (byPrefix) {
          for (const entry of byPrefix) {
            if (results.length >= limit) break;
            if (!seen.has(entry.name)) {
              seen.add(entry.name);
              results.push(entry);
            }
          }
        }
        if (results.length >= limit) break;
      }
    }
  }

  // STEP 2: If still need more results, do limited scan
  if (results.length < limit) {
    const maxScan = Math.min(500, foodInteractionsCache.length);
    for (let i = 0; i < maxScan && results.length < limit; i++) {
      const entry = foodInteractionsCache[i];
      if (seen.has(entry.name)) continue;

      const normalizedName = normalizeDrugName(entry.name);

      // Check name match
      if (
        normalizedName.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedName)
      ) {
        seen.add(entry.name);
        results.push(entry);
        continue;
      }

      // Check if any interaction mentions the query (for searching by food)
      const hasMatchingInteraction = entry.food_interactions.some(
        (interaction) => interaction.toLowerCase().includes(normalizedQuery)
      );
      if (hasMatchingInteraction) {
        seen.add(entry.name);
        results.push(entry);
      }
    }
  }

  return results;
}

/**
 * Preload food interactions (call early in app lifecycle)
 */
export async function preloadFoodInteractions(): Promise<void> {
  await loadFoodInteractions();
}
