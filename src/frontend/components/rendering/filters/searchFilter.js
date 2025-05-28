/**
 * @file searchFilter.js
 * @description Utility functions for filtering and searching entries based on keywords.
 *              Includes support for exact matches and limited fuzzy matching using Levenshtein distance.
 *
 * Features:
 * - Exact substring matching for keywords.
 * - Fuzzy matching using Levenshtein distance for typo tolerance.
 * - Normalization of terms to handle plural forms and variations.
 * - Support for searching across multiple fields, including related experts.

 * Marina Mata, 2025
 */

import { distance } from 'fastest-levenshtein';

/**
 * Retrieves related experts from an entry.
 * Supports both `relatedExperts` (array) and `relatedExpert` (single object).
 *
 * @param {Object} entry - The entry containing related experts.
 * @returns {Array} An array of related experts.
 */
export const getRelatedExperts = (entry) => {
  if (entry.relatedExperts) return entry.relatedExperts;
  if (entry.relatedExpert) return [entry.relatedExpert];
  return [];
};

/**
 * Normalizes a term by handling plural forms and suffixes.
 * Converts terms like "studies" to "study", "houses" to "house", etc.
 *
 * @param {string} word - The term to normalize.
 * @returns {string} The normalized term.
 */
const normalizeTerm = (word) =>
  word.endsWith("ies") ? word.slice(0, -3) + "y" :
  word.endsWith("es") ? word.slice(0, -2) :
  word.endsWith("s")  ? word.slice(0, -1) :
  word;

/**
 * Calculates the maximum allowed Levenshtein distance for fuzzy matching.
 * The distance is based on 25% of the length of the longer string.
 *
 * @param {string} word - The first string.
 * @param {string} keyword - The second string (keyword).
 * @returns {number} The maximum allowed distance.
 */
const maxAllowedDistance = (word, keyword) => {
  const len = Math.max(word.length, keyword.length);
  return Math.floor(len * 0.25); // 25% of word length
};

/**
 * Determines if a keyword matches any field in an entry.
 * Supports both exact substring matching and fuzzy matching with Levenshtein distance.
 *
 * @param {string} keyword - The keyword to search for.
 * @param {Object} entry - The entry to search within.
 * @returns {boolean} `true` if the keyword matches any field, otherwise `false`.
 */
export const matchesKeyword = (keyword, entry) => {
  if (!keyword?.trim() || !entry) return true;

  const normalizedKeyword = normalizeTerm(keyword.toLowerCase());

  // Prepare searchable fields
  const fields = [
    entry.title,
    entry.abstract,
    entry.funder,
    ...(entry.relatedExperts || []).map(e => e.fullName || e.name),
    entry.name,
  ].filter(Boolean); // Remove null/undefined fields

  for (const field of fields) {
    const lowerField = field.toLowerCase();

    // Exact match (substring)
    if (lowerField.includes(normalizedKeyword)) return true;

    // Fuzzy match: Check word-by-word with Levenshtein distance
    const words = lowerField.split(/\W+/);
    for (const word of words) {
      const normalizedWord = normalizeTerm(word);
      if (distance(normalizedWord, normalizedKeyword) <= maxAllowedDistance(normalizedWord, normalizedKeyword)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Retrieves fields that match a keyword, including exact and fuzzy matches.
 * Returns an array of matched fields with the field name and matched value.
 *
 * @param {string} keyword - The keyword to search for.
 * @param {Object} entry - The entry to search within.
 * @returns {Array} An array of matched fields, each containing the field name and matched value.
 */
export const getMatchedFields = (keyword, entry) => {
  if (!keyword?.trim()) {
    // console.warn("getMatchedFields: No keyword provided");
    return [];}
  if (!entry) {
    // console.warn("getMatchedFields: No entry provided");
    return [];
  }

  const normalizedKeyword = normalizeTerm(keyword.toLowerCase());
  const relatedExperts = getRelatedExperts(entry);

  // Prepare field data for searching
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

  const matchedFields = [];

  for (const [field, value] of Object.entries(fieldData)) {
    if (!value) continue;

    const lowerValue = value.toLowerCase();

    // Exact match (substring)
    if (lowerValue.includes(normalizedKeyword)) {
      matchedFields.push({ field, match: keyword });
      continue;
    }

    // Fuzzy match: Check word-by-word with Levenshtein distance
    const words = lowerValue.split(/\W+/);
    const match = words.find(word => {
      const normalizedWord = normalizeTerm(word);
      return distance(normalizedWord, normalizedKeyword) <= maxAllowedDistance(normalizedWord, normalizedKeyword);
    });

    if (match) matchedFields.push({ field, match });
  }

  return matchedFields;
};