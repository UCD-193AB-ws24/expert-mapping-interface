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
export const matchesKeyword = (keyword, entry) => {
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
    ...relatedExperts.map((e) => e.fullName || e.name), ,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.every((term) => searchable.includes(term));
};

/**
 * Returns a list of fields in the entry where the keyword matched.
 */
export const getMatchedFields = (keyword, entry) => {
  if (!keyword?.trim() || !entry) return [];

  const relatedExperts = getRelatedExperts(entry);
  const lowerKeyword = keyword.toLowerCase();
  const quoteMatch = keyword.match(/^"(.*)"$/);
  const terms = quoteMatch ? [quoteMatch[1].toLowerCase()] : lowerKeyword.split(/\s+/);

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
      return terms.every((term) => name.includes(term));
    })
  ) {
    matched.push("relatedExperts");
  }

  return matched;
};

