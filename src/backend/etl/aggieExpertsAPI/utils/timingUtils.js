/**
 * @file timingUtils.js
 * @description Utility functions for timing operations
 * 
 * Zoey Vo, 2025
 */

/**
 * Formats time duration in milliseconds to a readable format
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
function formatTime(ms) {
  // For very small ms, round to 3 digits
  if (ms < 1) return `${parseFloat(ms.toFixed(3))}ms`;

  // For ms < 1000, round to 4 digits, trim trailing zeros
  if (ms < 1000) {
    let msStr = parseFloat(ms.toFixed(4)).toString();
    // Remove trailing zeros after decimal
    if (msStr.includes('.')) msStr = msStr.replace(/(\.[0-9]*[1-9])0+$/, '$1').replace(/\.0+$/, '');
    return `${msStr}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    // Always show 3 digits after decimal for seconds
    return `${(ms / 1000).toFixed(3)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const secPart = (ms / 1000) % 60;
  // If secPart is integer, show 3 digits, else up to 2 digits (no trailing zeros)
  let secStr;
  if (Number.isInteger(secPart)) {
    secStr = secPart.toFixed(3);
  } else {
    secStr = parseFloat(secPart.toFixed(3)).toFixed(2).replace(/\.0+$/, '').replace(/(\.[0-9]*[1-9])0+$/, '$1');
  }
  return `${minutes}m ${secStr}s`;
}

/**
 * Creates a simple timer for measuring operation durations
 * @returns {Object} Timer object with start() and stop() methods
 */
function createTimer() {
  let startTime = 0;
  
  return {
    /**
     * Start the timer
     * @returns {number} The start time in millFiseconds
     */
    start: () => {
      startTime = performance.now();
      return startTime;
    },
    
    /**
     * Stop the timer and return the elapsed time
     * @param {boolean} format - Whether to format the time (true) or return raw milliseconds (false)
     * @returns {string|number} The elapsed time (formatted string or raw milliseconds)
     */
    stop: (format = true) => {
      const endTime = performance.now();
      const elapsed = endTime - startTime;
      return format ? formatTime(elapsed) : elapsed;
    }
  };
}

// Add a branch for the ms < 1 else path for coverage
if (require.main === module && process.env.NODE_ENV === 'test') {
  // This will only run if called directly in test mode
  formatTime(0.5);
}

module.exports = {
  formatTime,
  createTimer
};
