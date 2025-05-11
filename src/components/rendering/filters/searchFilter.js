/**
 * @file searchFilter.js
 * @description Utility functions for filtering and searching entries based on keywords.
 *              Includes support for exact matches, multi-word fuzzy terms, plurals and related experts.
 *
 * FUNCTIONS:
 * - getRelatedExperts(entry): Normalizes related experts for both works and grants.
 * - matchesKeyword(keyword, entry): Checks if a given entry matches the provided keyword.
 * - getMatchedFields(keyword, entry): Returns a list of fields in the entry where the keyword matched.
 *
 * Marina Mata, 2025
 */


//Normalize related experts for both works and grants.
export const getRelatedExperts = (entry) => {
  if (entry.relatedExperts) return entry.relatedExperts;
  if (entry.relatedExpert) return [entry.relatedExpert];
  return [];
};


//Check if the given entry matches the keyword.
export const matchesKeyword = (keyword, entry) => {
  const relatedExperts = getRelatedExperts(entry);
  if (!relatedExperts.length) return false;

  if (!keyword?.trim()) return true;

  const lowerKeyword = keyword.toLowerCase();
  const quoteMatch = keyword.match(/^"(.*)"$/);
  const rawTerms = quoteMatch ? [quoteMatch[1].toLowerCase()] : lowerKeyword.split(/\s+/);

  // Basic plural stemmer
  const normalizeTerm = (word) =>
    word.endsWith("ies")
      ? word.slice(0, -3) + "y" //If the word ends in "ies" (e.g., "studies"), it becomes "study"
      : word.endsWith("es")
        ? word.slice(0, -2) //If the word ends in "es" (e.g., "boxes"), it becomes "box"
        : word.endsWith("s") 
          ? word.slice(0, -1) //If the word ends in "s" (e.g., "cats"), it becomes "cat"
          : word; //If none of the above match, it returns the word unchanged.

  const terms = rawTerms.map(normalizeTerm);


  // Fields to search across (excluding authors[] or deeply nested fields)
  const searchable = [
    entry.title,
    entry.abstract,
    entry.issued,
    entry.funder,
    entry.startDate,
    entry.endDate,
    entry.confidence,
    ...relatedExperts.map((e) => e.fullName || e.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeTerm)
    .join(" ");

  return terms.every((term) => searchable.includes(term));
};


//Returns a list of fields in the entry where the keyword matched.
export const getMatchedFields = (keyword, entry) => {
  if (!keyword?.trim() || !entry) return [];

  const relatedExperts = getRelatedExperts(entry);
  const lowerKeyword = keyword.toLowerCase();
  const quoteMatch = keyword.match(/^"(.*)"$/);
  const rawTerms = quoteMatch ? [quoteMatch[1].toLowerCase()] : lowerKeyword.split(/\s+/);

  const normalizeTerm = (word) =>
    word.endsWith("ies")
      ? word.slice(0, -3) + "y" //If the word ends in "ies" (e.g., "studies"), it becomes "study"
      : word.endsWith("es")
        ? word.slice(0, -2) //If the word ends in "es" (e.g., "boxes"), it becomes "box"
        : word.endsWith("s")
          ? word.slice(0, -1) //If the word ends in "s" (e.g., "cats"), it becomes "cat"
          : word; //If none of the above match, it returns the word unchanged.

  const terms = rawTerms.map(normalizeTerm);
  const matched = [];

  const check = (field, name) => {
    if (!field) return;
    const text = field.toString().toLowerCase();
    if (terms.every((term) => text.includes(term))) {
      matched.push(name);
    }
  };

  check(entry.title, "title");
  check(entry.abstract, "abstract");
  check(entry.issued, "issued");
  check(entry.funder, "funder");
  check(entry.startDate, "startDate");
  check(entry.endDate, "endDate");
  check(entry.confidence, "confidence");

  if (
    relatedExperts.length &&
    relatedExperts.some((e) => {
      const name = (e.fullName || e.name || "").toLowerCase();
      const normalized = name.split(/\s+/).map(normalizeTerm).join(" ");
      return terms.every((term) => normalized.includes(term));
    })
  ) {
    matched.push("relatedExperts");
  }

  return matched;
};

