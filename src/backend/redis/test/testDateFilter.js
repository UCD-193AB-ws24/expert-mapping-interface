const fetch = require('node-fetch');
const RAW_MAPS_API_URL = 'http://localhost:3001/api/redis/getRawMaps';

// Helper to extract year from YYYY-MM-DD or YYYY
function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

// Filter works by issued year range (inclusive)
function filterWorksByIssuedYear(worksMap, startYear, endYear) {
  const worksArray = worksMap instanceof Map
    ? Array.from(worksMap.values())
    : Object.values(worksMap);

  return worksArray.filter(work => {
    const year = extractYear(work.issued);
    return year && year >= startYear && year <= endYear;
  });
}

// Filter grants that overlap with the selected year range
function filterGrantsByYearOverlap(grantsMap, selectedStart, selectedEnd) {
  const grantsArray = grantsMap instanceof Map
    ? Array.from(grantsMap.values())
    : Object.values(grantsMap);

  return grantsArray.filter(grant => {
    const grantStart = extractYear(grant.startDate);
    const grantEnd = extractYear(grant.endDate);
    // Overlap if grantEnd >= selectedStart AND grantStart <= selectedEnd
    return (
      grantStart && grantEnd &&
      grantEnd >= selectedStart &&
      grantStart <= selectedEnd
    );
  });
}

async function fetchAndFilterByDate(selectedStart, selectedEnd) {
  try {
    const response = await fetch(RAW_MAPS_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    const worksMemoMap = new Map(Object.entries(data.worksMap));
    const grantsMemoMap = new Map(Object.entries(data.grantsMap));

    // Filter works by issued year
    const filteredWorks = filterWorksByIssuedYear(worksMemoMap, selectedStart, selectedEnd);
    console.log(`Works issued between ${selectedStart} and ${selectedEnd}:`);
    // filteredWorks.forEach(work => {
    //   console.log(`- ${work.id || work.title} (issued: ${work.issued})`);
    // });
    console.log(`Total filtered works: ${filteredWorks.length}`);

    // Filter grants by overlapping date range
    const filteredGrants = filterGrantsByYearOverlap(grantsMemoMap, selectedStart, selectedEnd);
    console.log(`Grants overlapping with ${selectedStart}–${selectedEnd}:`);
    // filteredGrants.forEach(grant => {
    //   console.log(
    //     `- ${grant.title || grant.grantID} (start: ${grant.startDate}, end: ${grant.endDate})`
    //   );
    // });
    console.log(`Total filtered grants: ${filteredGrants.length}`);

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

// Example: filter works and grants overlapping 2018–2022
fetchAndFilterByDate(2018, 2022);