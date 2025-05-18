/**
 * @file searchFilter.js
 * @description Utility functions for filtering and searching entries based on keywords.
 *              Includes support for exact matches, multi-word fuzzy terms, plurals, and related experts.
 *
 * FUNCTIONS:
 * - getRelatedExperts(entry): Normalizes related experts for both works and grants.
 * - getFuzzyScoreExplanation(score): Provides a human-readable explanation for a fuzzy match score.
 * - matchesKeyword(keyword, entry): Checks if a given entry matches the provided keyword.
 * - getMatchedFields(keyword, entry): Returns a list of fields in the entry where the keyword matched.
 *
 * Marina Mata, 2025
 */

import Fuse from "fuse.js";

/**
 * Normalizes related experts for both works and grants.
 * @param {Object} entry - The entry object containing expert-related data.
 * @returns {Array} - An array of related experts. If `relatedExperts` is present, it returns the array.
 *                    If `relatedExpert` is present, it wraps it in an array. Otherwise, it returns an empty array.
 */
export const getRelatedExperts = (entry) => {
  if (entry.relatedExperts) return entry.relatedExperts;
  if (entry.relatedExpert) return [entry.relatedExpert];
  return [];
};

/**
 * Provides a human-readable explanation for a fuzzy match score.
 * @param {Number} score - The fuzzy match score (0.0 to 1.0).
 * @returns {String} - A string describing the match quality:
 *                     - "exact or nearly exact match" for scores < 0.1.
 *                     - "very close match (1-2 letter difference)" for scores < 0.2.
 *                     - "moderate match" for scores < 0.3.
 *                     - "low match" for scores >= 0.3.
 */

/**
 * Checks if a given entry matches the provided keyword using fuzzy search.
 * @param {String} keyword - The search keyword.
 * @param {Object} entry - The entry object to be searched.
 * @returns {Boolean} - `true` if the keyword matches any field in the entry, `false` otherwise.
 */
export const matchesKeyword = (keyword, entry) => {
  if (!keyword?.trim() || !entry) return true;

  console.log("Testing matchesKeyword for entry:", entry);
  console.log("Keyword:", keyword);

  const relatedExperts = getRelatedExperts(entry);

  // Prepare searchable fields from the entry
  const searchableFields = [
    { name: 'title', value: entry.title },
    { name: 'abstract', value: entry.abstract },
    { name: 'issued', value: entry.issued },
    { name: 'funder', value: entry.funder },
    { name: 'startDate', value: entry.startDate },
    { name: 'endDate', value: entry.endDate },
    { name: 'confidence', value: entry.confidence },
    ...relatedExperts.map((e) => ({
      name: 'relatedExperts',
      value: e.fullName || e.name,
    })),
  ].filter(f => f.value); // Filter out fields with no value

  console.log("Searchable Fields:", searchableFields);

  // Configure Fuse.js for fuzzy searching
  const fuse = new Fuse(searchableFields, {
    keys: ['value'],
    threshold: 0.7, // Controls match tolerance (higher = more lenient)
    ignoreLocation: true, // Ignore match position in the string
    minMatchCharLength: 1, // Allow matching short words
  });

  const results = fuse.search(keyword);
  console.log(`[Fuse] "${keyword}" results:`, results);

  if (results.length === 0) {
    console.log("No matches found for entry:", entry);
    console.log("Searchable Fields for this entry:", searchableFields);
  }

  return results.length > 0;
};

/**
 * Returns a list of fields in the entry where the keyword matched.
 * @param {String} keyword - The search keyword.
 * @param {Object} entry - The entry object to be searched.
 * @returns {Array} - An array of field names where the keyword matched.
 */
export const getMatchedFields = (keyword, entry) => {
  if (!keyword?.trim() || !entry) return [];

  const relatedExperts = getRelatedExperts(entry);

  const fieldData = {
    title: entry.title,
    abstract: entry.abstract,
    issued: entry.issued,
    funder: entry.funder,
    startDate: entry.startDate,
    endDate: entry.endDate,
    confidence: entry.confidence,
    relatedExperts: relatedExperts.map(e => e.fullName || e.name).join(" "),
  };

  const fuse = new Fuse(
    Object.entries(fieldData).map(([key, value]) => ({ field: key, value })),
    {
      keys: ["value"],
      includeMatches: true,
      threshold: 0.5,
      minMatchCharLength: 3,
    }
  );

  const results = fuse.search(keyword);

  return results.map(result => ({
    field: result.item.field,
    value: result.item.value,
    keyword: keyword,
  }));
};
