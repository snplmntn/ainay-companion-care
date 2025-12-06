// Drug Database Service
// Uses the cleaned_drug_database.csv for medicine recognition and validation
// OPTIMIZED: Synchronous index building with Promise-based ready state
// ENHANCED: Fuzzy matching with Levenshtein distance for voice recognition
//
// DATA SOURCE:
// Philippine FDA - List of Registered Drugs
// https://verification.fda.gov.ph/drug_productslist.php

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
let phoneticIndex: Map<string, Set<number>> | null = null; // phonetic code -> drug indices
let loadingPromise: Promise<Drug[]> | null = null;
// OPTIMIZATION: Promise to track when index is ready
let indexReadyPromise: Promise<void> | null = null;
let indexReadyResolve: (() => void) | null = null;

// Common medicine name variations and misspellings for correction
const MEDICINE_ALIASES: Record<string, string> = {
  // Common voice transcription errors
  metaflorin: "metformin",
  metofirmin: "metformin",
  metformine: "metformin",
  glucophage: "metformin",
  lisinoprill: "lisinopril",
  amlodipene: "amlodipine",
  atorvastatin: "atorvastatin",
  lipitor: "atorvastatin",
  omeprezole: "omeprazole",
  losec: "omeprazole",
  paracetamol: "paracetamol",
  acetaminophen: "paracetamol",
  tylenol: "paracetamol",
  biogesic: "paracetamol",
  ibuprofen: "ibuprofen",
  advil: "ibuprofen",
  motrin: "ibuprofen",
  medicol: "ibuprofen",
  aspirine: "aspirin",
  ascriptin: "aspirin",
  salospir: "aspirin",
  amoxicilin: "amoxicillin",
  amoxil: "amoxicillin",
  ciprofloxacine: "ciprofloxacin",
  cefalexine: "cefalexin",
  keflex: "cefalexin",
  // Filipino pronunciations
  lusartan: "losartan",
  cozar: "losartan",
  amlodapine: "amlodipine",
  norvasc: "amlodipine",
  simvastatin: "simvastatin",
  zocor: "simvastatin",
  metoprolole: "metoprolol",
  lopresor: "metoprolol",
};

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of medicine names
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Simple phonetic encoding (Soundex-inspired) for medicine names
 * Groups similar-sounding characters together
 */
function phoneticEncode(str: string): string {
  const s = str.toLowerCase().replace(/[^a-z]/g, "");
  if (s.length === 0) return "";

  // Keep first letter, encode rest
  let code = s[0].toUpperCase();

  // Simplified phonetic mapping
  const map: Record<string, string> = {
    b: "1",
    f: "1",
    p: "1",
    v: "1",
    c: "2",
    g: "2",
    j: "2",
    k: "2",
    q: "2",
    s: "2",
    x: "2",
    z: "2",
    d: "3",
    t: "3",
    l: "4",
    m: "5",
    n: "5",
    r: "6",
    // a, e, i, o, u, h, w, y are ignored
  };

  let prev = "";
  for (let i = 1; i < s.length && code.length < 6; i++) {
    const char = s[i];
    const mapped = map[char] || "";
    if (mapped && mapped !== prev) {
      code += mapped;
      prev = mapped;
    } else if (!mapped) {
      prev = "";
    }
  }

  return code.padEnd(6, "0");
}

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
 * Build phonetic index for fuzzy sound-based matching
 */
function buildPhoneticIndex(drugs: Drug[]): Map<string, Set<number>> {
  const index = new Map<string, Set<number>>();

  drugs.forEach((drug, idx) => {
    // Get phonetic codes for brand and generic names
    const brandCode = phoneticEncode(drug.brandName);
    const genericCode = phoneticEncode(drug.genericName);

    if (brandCode) {
      if (!index.has(brandCode)) index.set(brandCode, new Set());
      index.get(brandCode)!.add(idx);
    }

    if (genericCode && genericCode !== brandCode) {
      if (!index.has(genericCode)) index.set(genericCode, new Set());
      index.get(genericCode)!.add(idx);
    }
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
      phoneticIndex = buildPhoneticIndex(drugs);
      console.log(
        `✅ Drug database indexed: ${drugs.length} drugs (with phonetic index)`
      );

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
  let lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery || lowerQuery.length < 2) return [];

  // Check for known aliases/corrections first
  const correctedQuery = MEDICINE_ALIASES[lowerQuery] || lowerQuery;
  if (correctedQuery !== lowerQuery) {
    lowerQuery = correctedQuery;
  }

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

    // If no results from index, try phonetic search
    if (candidateIndices.size === 0 && phoneticIndex) {
      const queryPhonetic = phoneticEncode(lowerQuery);
      const phoneticMatches = phoneticIndex.get(queryPhonetic);
      if (phoneticMatches) {
        phoneticMatches.forEach((idx) => candidateIndices.add(idx));
      }
    }

    // If still no results, return empty
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
 * Fuzzy search drugs - handles misspellings and voice transcription errors
 * Uses Levenshtein distance and phonetic matching
 */
export async function fuzzySearchDrugs(
  query: string,
  limit: number = 5,
  maxDistance: number = 2
): Promise<Array<{ drug: Drug; score: number; matchType: string }>> {
  const drugs = await loadDrugDatabase();
  let lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery || lowerQuery.length < 2) return [];

  // Check for known aliases first
  const correctedQuery = MEDICINE_ALIASES[lowerQuery];
  if (correctedQuery) {
    const exactMatch = await findDrug(correctedQuery);
    if (exactMatch) {
      return [{ drug: exactMatch, score: 95, matchType: "alias" }];
    }
    lowerQuery = correctedQuery;
  }

  await waitForIndex();

  const results: Array<{ drug: Drug; score: number; matchType: string }> = [];
  const queryPhonetic = phoneticEncode(lowerQuery);

  // First, try standard search
  const standardResults = await searchDrugs(lowerQuery, limit);
  for (const drug of standardResults) {
    results.push({ drug, score: 90, matchType: "standard" });
  }

  // If we got good standard results, return them
  if (results.length >= limit) {
    return results.slice(0, limit);
  }

  // Otherwise, try phonetic matching
  if (phoneticIndex && queryPhonetic) {
    const phoneticMatches = phoneticIndex.get(queryPhonetic);
    if (phoneticMatches) {
      for (const idx of phoneticMatches) {
        const drug = drugs[idx];
        // Avoid duplicates
        if (!results.some((r) => r.drug.regId === drug.regId)) {
          results.push({ drug, score: 70, matchType: "phonetic" });
        }
        if (results.length >= limit * 2) break;
      }
    }
  }

  // If still not enough, try Levenshtein distance on first 1000 drugs
  if (results.length < limit) {
    const sampleSize = Math.min(1000, drugs.length);
    for (let i = 0; i < sampleSize; i++) {
      const drug = drugs[i];
      if (results.some((r) => r.drug.regId === drug.regId)) continue;

      const brandDist = levenshteinDistance(
        lowerQuery,
        drug.brandName.toLowerCase()
      );
      const genericDist = levenshteinDistance(
        lowerQuery,
        drug.genericName.toLowerCase()
      );
      const minDist = Math.min(brandDist, genericDist);

      // Only accept if edit distance is within threshold
      // Threshold scales with query length
      const threshold = Math.max(
        maxDistance,
        Math.floor(lowerQuery.length / 3)
      );
      if (minDist <= threshold) {
        const score = Math.max(20, 60 - minDist * 15);
        results.push({ drug, score, matchType: "fuzzy" });
      }

      if (results.length >= limit * 3) break;
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Correct potential medicine name from voice transcription
 * Returns the corrected name if found, otherwise returns original
 */
export async function correctMedicineName(
  transcribedName: string
): Promise<{ corrected: string; confidence: number; original: string }> {
  const original = transcribedName.trim();
  const lower = original.toLowerCase();

  // Check known aliases first
  if (MEDICINE_ALIASES[lower]) {
    return {
      corrected: MEDICINE_ALIASES[lower],
      confidence: 95,
      original,
    };
  }

  // Try exact match
  const exactMatch = await findDrug(original);
  if (exactMatch) {
    return {
      corrected: exactMatch.brandName || exactMatch.genericName,
      confidence: 100,
      original,
    };
  }

  // Try fuzzy search
  const fuzzyResults = await fuzzySearchDrugs(original, 1, 2);
  if (fuzzyResults.length > 0) {
    const best = fuzzyResults[0];
    return {
      corrected: best.drug.brandName || best.drug.genericName,
      confidence: best.score,
      original,
    };
  }

  // No match found
  return {
    corrected: original,
    confidence: 0,
    original,
  };
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

// Cache for Whisper prompt
let whisperPromptCache: string | null = null;

/**
 * Get a prompt string optimized for Whisper API to improve medicine name recognition
 * This provides common drug names as context to help Whisper transcribe them correctly
 */
export async function getWhisperMedicinePrompt(): Promise<string> {
  if (whisperPromptCache) {
    return whisperPromptCache;
  }

  const drugs = await loadDrugDatabase();

  // Get most common brand names (prioritize shorter, more recognizable names)
  const brandNames = [...new Set(drugs.map((d) => d.brandName).filter(Boolean))]
    .filter((name) => name.length >= 3 && name.length <= 20)
    .slice(0, 150);

  // Get common generic names
  const genericNames = [
    ...new Set(drugs.map((d) => d.genericName).filter(Boolean)),
  ]
    .filter((name) => name.length >= 4 && name.length <= 25)
    .slice(0, 100);

  // Common medication-related words to help with context
  const medicalTerms = [
    // Basic terms
    "medication",
    "medicine",
    "prescription",
    "Rx",
    // Dosage forms
    "tablet",
    "tablets",
    "tab",
    "capsule",
    "capsules",
    "cap",
    "caps",
    "drops",
    "drop",
    "gtts",
    "gtt",
    "syrup",
    "suspension",
    "solution",
    "cream",
    "ointment",
    "gel",
    "lotion",
    "patch",
    "spray",
    "inhaler",
    "puffs",
    "suppository",
    "injection",
    // Measurements
    "milligrams",
    "mg",
    "micrograms",
    "mcg",
    "grams",
    "g",
    "milliliters",
    "mL",
    "units",
    "IU",
    // Frequency - Latin abbreviations (critical for prescription parsing)
    "once daily",
    "twice daily",
    "three times daily",
    "four times daily",
    "QD",
    "q.d.",
    "OD",
    "o.d.", // once daily
    "BID",
    "b.i.d.",
    "twice a day", // twice daily
    "TID",
    "t.i.d.",
    "three times a day", // three times daily
    "QID",
    "q.i.d.",
    "four times a day", // four times daily
    "PRN",
    "p.r.n.",
    "as needed",
    "when needed", // as needed
    "every 4 hours",
    "every 6 hours",
    "every 8 hours",
    "every 12 hours",
    "Q4H",
    "q4h",
    "Q6H",
    "q6h",
    "Q8H",
    "q8h",
    "Q12H",
    "q12h",
    // Timing abbreviations
    "QAM",
    "q.a.m.",
    "every morning",
    "in the morning",
    "QPM",
    "q.p.m.",
    "every evening",
    "in the evening",
    "HS",
    "h.s.",
    "QHS",
    "at bedtime",
    "before sleep",
    "AC",
    "a.c.",
    "before meals",
    "before eating",
    "PC",
    "p.c.",
    "after meals",
    "after eating",
    "STAT",
    "immediately",
    // Route abbreviations
    "PO",
    "p.o.",
    "by mouth",
    "orally",
    "oral",
    "SL",
    "s.l.",
    "sublingual",
    "under the tongue",
    "PR",
    "p.r.",
    "rectally",
    "rectal",
    "IM",
    "i.m.",
    "intramuscular",
    "IV",
    "i.v.",
    "intravenous",
    "SC",
    "s.c.",
    "SubQ",
    "subcutaneous",
    "INH",
    "inhaled",
    "inhalation",
    "TOP",
    "topical",
    "topically",
    "apply",
    // Eye/Ear abbreviations
    "OD",
    "o.d.",
    "right eye",
    "oculus dexter",
    "OS",
    "o.s.",
    "left eye",
    "oculus sinister",
    "OU",
    "o.u.",
    "both eyes",
    "oculus uterque",
    "AD",
    "a.d.",
    "right ear",
    "auris dextra",
    "AS",
    "a.s.",
    "left ear",
    "auris sinistra",
    "AU",
    "a.u.",
    "both ears",
    "auris uterque",
    "ophthalmic",
    "eye drops",
    "otic",
    "ear drops",
    // Instructions
    "with food",
    "without food",
    "on empty stomach",
    "with water",
    "with meals",
    "before breakfast",
    "for pain",
    "for fever",
    "for inflammation",
    // Quantity
    "one tablet",
    "two tablets",
    "one capsule",
    "two capsules",
    "half tablet",
    "half a tablet",
    // Common medicines
    "paracetamol",
    "acetaminophen",
    "ibuprofen",
    "aspirin",
    "metformin",
    "amlodipine",
    "losartan",
    "omeprazole",
    "atorvastatin",
    "simvastatin",
    "lisinopril",
    "amoxicillin",
    "ciprofloxacin",
    "metoprolol",
    "hydrochlorothiazide",
    "gabapentin",
    "prednisone",
    "levothyroxine",
    "pantoprazole",
    "sertraline",
    "tramadol",
    "cetirizine",
    "loratadine",
  ];

  // Build the prompt - Whisper uses this as context for better transcription
  const prompt = `Medical prescription transcription with Latin abbreviations. Common terms: ${[
    ...medicalTerms,
    ...brandNames.slice(0, 40),
    ...genericNames.slice(0, 25),
  ].join(", ")}`;

  whisperPromptCache = prompt;
  return prompt;
}

/**
 * Get all drug names as a Set for fast lookup (used for post-transcription correction)
 */
export async function getAllDrugNamesSet(): Promise<Set<string>> {
  const drugs = await loadDrugDatabase();
  const names = new Set<string>();

  for (const drug of drugs) {
    if (drug.brandName) names.add(drug.brandName.toLowerCase());
    if (drug.genericName) names.add(drug.genericName.toLowerCase());
  }

  return names;
}
