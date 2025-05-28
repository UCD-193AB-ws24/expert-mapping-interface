/**
    * Helper function to filter works by issued year.
    * @param {object} entry - A work entry object.
    * @returns {boolean} True if the work matches the selected date range, otherwise false.
    */
const isWorkInDate = (entry, selectedDateRange) => {
    if (!selectedDateRange || selectedDateRange.length !== 2) return true;
    const issuedYear = parseInt(entry.issued, 10);
    return issuedYear >= selectedDateRange[0] && issuedYear <= selectedDateRange[1];
  };

  /**
   * Helper function to filter grants by start or end date.
   * @param {object} entry - A grant entry object.
   * @returns {boolean} True if the grant matches the selected date range, otherwise false.
   */
const isGrantInDate = (entry, selectedDateRange) => {
    if (!selectedDateRange || selectedDateRange.length !== 2) return true;
    const start = parseInt(entry.startDate, 10);
    const end = parseInt(entry.endDate, 10);
    const [minYear, maxYear] = selectedDateRange;
    return (
      (!isNaN(start) && start >= minYear && start <= maxYear) ||
      (!isNaN(end) && end >= minYear && end <= maxYear)
    );
  };

  //export { isWorkInDate, isGrantInDate };
  module.exports = {
    isWorkInDate,
    isGrantInDate
  };