/**
 * Normalize related experts for both works and grants.
 */
export const getRelatedExperts = (entry) => {
    if (entry.relatedExperts) return entry.relatedExperts;
    if (entry.relatedExpert) return [entry.relatedExpert];
    return [];
  };
  
  /**
   * Check if the given entry matches the keyword.
   * Supports quoted exact matches and multi-word fuzzy terms.
   */
  export const matchesKeyword = (keyword, feature, entry) => {
    const relatedExperts = getRelatedExperts(entry);
    if (!relatedExperts.length) return false;
  
    if (!keyword?.trim()) return true;
  
    const lowerKeyword = keyword.toLowerCase();
    const quoteMatch = keyword.match(/^"(.*)"$/);
    const terms = quoteMatch ? [quoteMatch[1].toLowerCase()] : lowerKeyword.split(/\s+/);
  
    // Fields to search across (excluding authors[] or deeply nested fields)
    const searchable = [
      entry.title,
      entry.abstract,
      entry.issued,
      entry.funder,
      entry.startDate,
      entry.endDate,
      entry.confidence,
      ...relatedExperts.map((e) => e.fullName || e.name),,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  
    return terms.every((term) => searchable.includes(term));
  };
  