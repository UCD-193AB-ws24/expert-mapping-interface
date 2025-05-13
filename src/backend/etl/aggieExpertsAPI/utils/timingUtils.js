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
  // Cap at 4 digits past decimal
  ms = parseFloat(ms.toFixed(4));
  
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  const remainingMs = Math.floor(ms % 1000);
  
  if (seconds < 60) return `${seconds}.${String(remainingMs).padStart(3, '0').substring(0, 4)}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${minutes}m ${remainingSecs}.${String(remainingMs).padStart(3, '0').substring(0, 4)}s`;
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
     * @returns {number} The start time in milliseconds
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

module.exports = {
  formatTime,
  createTimer
};
