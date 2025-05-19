/**
 * @file searchFilter.js
 * @description Utility functions for filtering and searching entries based on keywords.
 *              Includes support for exact matches, multi-word fuzzy terms, plurals, and related experts.
 *
 * FUNCTIONS:
 * - getRelatedExperts(entry): Normalizes related experts for both works and grants.
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
    threshold: 0.2, // Controls match tolerance (higher = more lenient)
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
 * @returns {Array} - An array of objects containing the field name and the matched text.
 *                    Each object has the structure: { field: <field name>, match: <matched text> }.
 */
export const getMatchedFields = (keyword, entry) => {
  if (!keyword?.trim() || !entry) return [];

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

  // Configure Fuse.js for fuzzy searching
  const fuse = new Fuse(
    Object.entries(fieldData).map(([key, value]) => ({ key, value })),
    {
      keys: ["value"],
      includeMatches: true, // Include match details in the results
      threshold: 0.6, // Controls match tolerance (lower = stricter)
      minMatchCharLength: 3, // Ignore very short words
    }
  );

  const results = fuse.search(keyword);

  // Collect matched field names and matched text
  const matchedFields = [];
  for (const result of results) {
    if (result?.item?.key && result?.matches?.length > 0) {
      const field = result.item.key;
      const matchText = result.matches[0]?.value?.substring(
        result.matches[0]?.indices[0][0],
        result.matches[0]?.indices[0][1] + 1
      );
      matchedFields.push({
        field,
        match: matchText,
      });
    }
  }

  return matchedFields;
};