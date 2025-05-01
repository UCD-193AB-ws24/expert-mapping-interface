const fs = require('fs');
const path = require('path');
const {
  extractExpertIdFromUrl,
  parseAuthors,
  prepareExpertMaps,
  findMatchingExperts,
  formatExpertForOutput
} = require('../utils/matchingUtils');

/**
 * Generic matching service for works, grants, etc.
 * @param {Object} options
 * @param {Array} experts - List of experts
 * @param {Array} items - List of items to match (works, grants, etc.)
 * @param {Object} config - Config for matching
 * @param {boolean} [saveToFile] - Whether to save results to file
 * @returns {Object}
 */
async function matchItems({ experts, items, config, saveToFile = true }) {
  // config: {
  //   itemIdField: 'id' or function(item),
  //   authorField: 'authors' or function(item),
  //   expertField: 'inheresIn' or function(item),
  //   outputFile: 'expertMatchedWorks.json',
  //   matchBy: 'authorName' | 'expertId',
  // }

  const { itemIdField, authorField, expertField, outputFile, matchBy } = config;

  // Prepare expert maps
  const { expertNameMap, expertItemsMap, expertsById } = prepareExpertMaps(experts);

  const matchedItems = [];
  let matchCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    let matchedExpertIds = [];
    let itemId = typeof itemIdField === 'function' ? itemIdField(item) : item[itemIdField];
    if (!itemId && item.url) itemId = extractExpertIdFromUrl(item.url);
    if (!itemId) {
      skippedCount++;
      continue;
    }

    if (matchBy === 'authorName') {
      // Works: match by author names
      const authors = typeof authorField === 'function' ? authorField(item) : item[authorField];
      const parsedAuthors = parseAuthors(authors);
      if (!parsedAuthors.length) {
        skippedCount++;
        continue;
      }
      const matchedExpertsForItem = new Set();
      for (const author of parsedAuthors) {
        if (!author.fullName) continue;
        const found = findMatchingExperts(author.fullName, expertNameMap);
        found.forEach(eid => matchedExpertsForItem.add(eid));
      }
      matchedExpertIds = Array.from(matchedExpertsForItem);
    } else if (matchBy === 'expertId') {
      // Grants: match by inheresIn field
      const expertRef = typeof expertField === 'function' ? expertField(item) : item[expertField];
      const eid = extractExpertIdFromUrl(expertRef);
      if (eid && expertsById[eid]) matchedExpertIds = [eid];
    }

    if (matchedExpertIds.length > 0) {
      matchCount++;
      for (const eid of matchedExpertIds) {
        if (expertItemsMap.has(eid)) {
          expertItemsMap.get(eid).push(itemId);
        }
      }
      // Add related experts for output
      const relatedExperts = matchedExpertIds.map(eid => formatExpertForOutput(eid, expertsById)).filter(Boolean);
      matchedItems.push({ ...item, relatedExperts });
    }
  }

  // Deduplicate items for each expert
  const resultMap = {};
  let totalItemsMatched = 0;
  for (const [eid, itemList] of expertItemsMap.entries()) {
    const uniqueItems = [...new Set(itemList)];
    resultMap[eid] = uniqueItems;
    totalItemsMatched += uniqueItems.length;
  }
  const expertsWithItems = Object.keys(resultMap).filter(eid => resultMap[eid]?.length > 0).length;

  // Save results
  if (saveToFile && outputFile) {
    const saveDir = path.join(__dirname, '../matchedFeatures');
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
    const outPath = path.join(saveDir, outputFile);
    fs.writeFileSync(outPath, JSON.stringify(matchedItems, null, 2));
  }

  return {
    expertItemsMap: resultMap,
    matchedItems,
    matchCount,
    skippedCount,
    totalItemsMatched,
    expertsWithItems,
    totalProcessed: items.length
  };
}

module.exports = { matchItems };