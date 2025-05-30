/**
 * Returns true if the entry's confidence is >= 80.
 * @param {object} entry - The entry object with a confidence property.
 * @returns {boolean}
 */
function isHighConfidence(entry) {
  // Parse as number in case it's a string
  const confidence = Number(entry.confidence);
  return !isNaN(confidence) && confidence >= 60;
}

module.exports = { isHighConfidence };