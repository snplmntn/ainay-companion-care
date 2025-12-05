// Drug Database Service
// Uses the cleaned_drug_database.csv for medicine recognition and validation
// OPTIMIZED: Synchronous index building with Promise-based ready state

export interface Drug {
  regId: string;
  genericName: string;
  brandName: string;
  strength: string;
  form: string;
  category: string;
}

// Optimized data structures
let drugsCache: Drug[] | null = null;
let searchIndex: Map<string, Set<number>> | null = null; // word -> drug indices
let loadingPromise: Promise<Drug[]> | null = null;
// OPTIMIZATION: Promise to track when index is ready
let indexReadyPromise: Promise<void> | null = null;
let indexReadyResolve: (() => void) | null = null;

/**
 * Build search index for fast lookups
 */
function buildSearchIndex(drugs: Drug[]): Map<string, Set<number>> {
  const index = new Map<string, Set<number>>();

  drugs.forEach((drug, idx) => {
    // Index brand name words
    const brandWords = (drug.brandName || "").toLowerCase().split(/\s+/);
    const genericWords = (drug.genericName || "").toLowerCase().split(/\s+/);

    [...brandWords, ...genericWords].forEach((word) => {
      if (word.length < 2) return;

      // Index full word
      if (!index.has(word)) index.set(word, new Set());
      index.get(word)!.add(idx);

      // Index prefixes (for autocomplete)
      for (let len = 2; len < word.length; len++) {
        const prefix = word.slice(0, len);
        if (!index.has(prefix)) index.set(prefix, new Set());
        index.get(prefix)!.add(idx);
      }
    });
  });

  return index;
}

/**
 * Load and parse the drug database CSV
 */
export async function loadDrugDatabase(): Promise<Drug[]> {
  // Return cached data if available
  if (drugsCache) {
    return drugsCache;
  }

  // Return existing loading promise to prevent multiple fetches
  if (loadingPromise) {
    return loadingPromise;
  }

  // Create index ready promise before loading
  indexReadyPromise = new Promise((resolve) => {
    indexReadyResolve = resolve;
  });

  loadingPromise = (async () => {
    try {
      const response = await fetch("/cleaned_drug_database.csv");
      const csvText = await response.text();

      const lines = csvText.split("\n");
      const drugs: Drug[] = [];

      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line (handle quoted fields with commas)
        const fields = parseCSVLine(line);

        // CSV columns: Reg_ID, Generic_Name, Brand_Name, Strength, Form, Category
        if (fields.length >= 6) {
          drugs.push({
            regId: fields[0] || "",
            genericName: fields[1] || "",
            brandName: fields[2] || "",
            strength: fields[3] || "",
            form: fields[4] || "",
            category: fields[5] || "",
          });
        }
      }

      drugsCache = drugs;

      // OPTIMIZATION: Build index synchronously before returning
      // This ensures index is always ready when data is available
      searchIndex = buildSearchIndex(drugs);
      console.log(`✅ Drug database indexed: ${drugs.length} drugs`);

      // Signal that index is ready
      if (indexReadyResolve) {
        indexReadyResolve();
      }

      return drugs;
    } catch (error) {
      console.error("Failed to load drug database:", error);
      // Signal ready even on error to prevent deadlock
      if (indexReadyResolve) {
        indexReadyResolve();
      }
      return [];
    }
  })();

  return loadingPromise;
}

/**
 * Wait for the search index to be ready
 * OPTIMIZATION: Use this before searches if you want guaranteed indexed results
 */
export async function waitForIndex(): Promise<void> {
  if (searchIndex) return;
  if (!indexReadyPromise) {
    // Start loading if not started
    await loadDrugDatabase();
    return;
  }
  await indexReadyPromise;
}

/**
 * Check if the index is ready (non-blocking)
 */
export function isIndexReady(): boolean {
  return searchIndex !== null;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Search drugs by name (generic or brand) - uses index for fast lookups
 */
export async function searchDrugs(
  query: string,
  limit: number = 10
): Promise<Drug[]> {
  const drugs = await loadDrugDatabase();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery || lowerQuery.length < 2) return [];

  // OPTIMIZATION: Wait for index if searching immediately after load
  // This is non-blocking if index is already ready
  if (!searchIndex) {
    await waitForIndex();
  }

  // Use index if available for fast lookup
  let candidateIndices: Set<number>;

  if (searchIndex) {
    // Fast indexed search
    candidateIndices = new Set<number>();
    const queryWords = lowerQuery.split(/\s+/);

    for (const word of queryWords) {
      if (word.length < 2) continue;

      // Check index for this word/prefix
      const indices = searchIndex.get(word);
      if (indices) {
        indices.forEach((idx) => candidateIndices.add(idx));
      }
    }

    // If no results from index, return empty (faster than full scan)
    if (candidateIndices.size === 0) return [];
  } else {
    // Fallback: check all drugs (should rarely happen now)
    candidateIndices = new Set(drugs.map((_, i) => i));
  }

  // Score only the candidates (much faster than scoring all 32K)
  const scored: Array<{ drug: Drug; score: number }> = [];

  for (const idx of candidateIndices) {
    const drug = drugs[idx];
    const genericLower = drug.genericName.toLowerCase();
    const brandLower = drug.brandName.toLowerCase();

    let score = 0;

    // Exact match (highest priority)
    if (genericLower === lowerQuery || brandLower === lowerQuery) {
      score = 100;
    }
    // Starts with query
    else if (
      genericLower.startsWith(lowerQuery) ||
      brandLower.startsWith(lowerQuery)
    ) {
      score = 80;
    }
    // Contains query
    else if (
      genericLower.includes(lowerQuery) ||
      brandLower.includes(lowerQuery)
    ) {
      score = 60;
    }
    // Word prefix match
    else {
      score = 40; // From index match
    }

    if (score > 0) {
      scored.push({ drug, score });
    }

    // Early exit if we have enough high-quality results
    if (scored.length >= limit * 3 && scored.some((s) => s.score >= 80)) {
      break;
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.drug);
}

/**
 * Find exact drug by brand or generic name
 */
export async function findDrug(name: string): Promise<Drug | null> {
  const drugs = await loadDrugDatabase();
  const lowerName = name.toLowerCase().trim();

  return (
    drugs.find(
      (drug) =>
        drug.genericName.toLowerCase() === lowerName ||
        drug.brandName.toLowerCase() === lowerName
    ) || null
  );
}

/**
 * Get drug suggestions for autocomplete
 */
export async function getDrugSuggestions(
  partialName: string,
  limit: number = 5
): Promise<string[]> {
  const drugs = await searchDrugs(partialName, limit);

  // Return unique names (prefer brand name, include generic)
  const suggestions = new Set<string>();
  for (const drug of drugs) {
    if (drug.brandName) suggestions.add(drug.brandName);
    if (drug.genericName) suggestions.add(drug.genericName);
    if (suggestions.size >= limit) break;
  }

  return Array.from(suggestions).slice(0, limit);
}

/**
 * Validate if a drug name exists in the database
 */
export async function validateDrugName(
  name: string
): Promise<{ valid: boolean; drug: Drug | null; suggestions: string[] }> {
  const drug = await findDrug(name);

  if (drug) {
    return { valid: true, drug, suggestions: [] };
  }

  // Not found - provide suggestions
  const suggestions = await getDrugSuggestions(name, 5);
  return { valid: false, drug: null, suggestions };
}

/**
 * Get drug info formatted for AI context
 */
export async function getDrugContext(drugNames: string[]): Promise<string> {
  const drugInfos: string[] = [];

  for (const name of drugNames) {
    const drug = await findDrug(name);
    if (drug) {
      drugInfos.push(
        `- ${drug.brandName} (${drug.genericName}): ${drug.strength} ${drug.form}, Category: ${drug.category}`
      );
    }
  }

  if (drugInfos.length === 0) {
    return "";
  }

  return `\n\nRelevant drug information from database:\n${drugInfos.join(
    "\n"
  )}`;
}

/**
 * Get common drug names for AI prompt context
 */
export async function getCommonDrugNames(limit: number = 100): Promise<string> {
  const drugs = await loadDrugDatabase();

  // Get unique brand names
  const brandNames = [...new Set(drugs.map((d) => d.brandName).filter(Boolean))]
    .slice(0, limit)
    .join(", ");

  return brandNames;
}
