/**
 * @file App.js
 * @description This file contains the main `App` component, which serves as the entry point for the application.
 *              It provides the user interface for interacting with the research map, including search, filters,
 *              and toggles for displaying works and grants. The application integrates the `ResearchMap` component
 *              to visualize research-related data on a Leaflet map.
 *
 * Features:
 * - Header with navigation links and branding.
 * - Sidebar with search, toggles, and filters for refining map data.
 * - Interactive map displaying research works and grants.
 * - Footer for additional branding or information.
 *
 * Components:
 * - ResearchMap: Displays the interactive map with works and grants data.
 * - ReactSlider: Provides a slider for selecting a date range.
 *
 * State Variables:
 * - showGrants: Boolean to toggle the display of grant-related data.
 * - showWorks: Boolean to toggle the display of works-related data.
 * - searchKeyword: String used to filter data based on a search term.
 * - selectedDateRange: Array of two numbers representing the selected year range for filtering data.
 * - pendingDateRange: Array of two numbers representing the temporary date range before applying filters.
 *
 * Marina Mata, 2025
 */
import React, { useState } from "react";
import "./styles/index.css";
import ResearchMap from "./components/ResearchMap";
import ReactSlider from "react-slider";
import aggieExpertsLogo from "./assets/aggie-experts-logo-primary.png";

function App() {
  // State variables for toggles, search, and filters
  const [showGrants, setShowGrants] = useState(false);
  const [showWorks, setShowWorks] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState([1990, 2025]);
  const [pendingDateRange, setPendingDateRange] = useState([1990, 2025]);

  // Check if the pending date range differs from the applied date range
  const isFilterPending = JSON.stringify(pendingDateRange) !== JSON.stringify(selectedDateRange);

  /**
    * Handles changes to the search input field.
    * @param {object} e - The event object from the input field.
    */
  const handleSearchChange = (e) => {
    setSearchKeyword(e.target.value);
  };

  return (
    <div className="App flex flex-col min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Header */}
      <header className="flex items-center py-2 px-10 bg-white shadow-md fixed top-0 left-0 w-full z-50">
        <div className="flex items-center space-x-6">
          <img src={aggieExpertsLogo} alt="Aggie Experts Logo" className="h-16 w-auto ml-4" />
          <h1 className="text-xl font-semibold text-[#022851]">
            <a href="#" aria-label="Aggie Experts Interactive Map home">Aggie Experts Interactive Map</a>
          </h1>
        </div>
      </header>
      {/* Navigation Bar */}
      <nav className="flex flex-wrap items-center bg-[#022851] px-4 py-2 fixed top-[80px] left-0 w-full z-50" aria-label="Main navigation">
        {/* Links */}
        <div className="flex space-x-6 mb-2 sm:mb-0">
          <a href="https://experts.ucdavis.edu/browse/expert/a" className="text-lg text-white hover:underline">Experts</a>
          <a href="https://experts.ucdavis.edu/browse/grant/1" className="text-lg text-white hover:underline">Grants</a>
        </div>
        {/* Searchbar */}
          <div className="relative searchbar ml-auto" style={{ maxWidth: "200px" }}>
            <label htmlFor="search-input" className="sr-only">Search keyword</label>
            <input
              id="search-input"
              type="text"
              placeholder="Search keyword"
              value={searchKeyword}
              onChange={handleSearchChange}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#022851]"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2" aria-label="Search">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
      </nav>
      {/* Map Section */}
      <main className="w-full overflow-hidden bg-white" style={{ height: 'calc(100vh - 140px)', marginTop: '140px' }}>
      <div className="map-container flex w-full h-full">
        {/* Map */}
        <div id="map" className="flex-1 min-w-0 relative order-1" aria-label="Interactive map showing expert and grant locations">
          <ResearchMap
            showGrants={showGrants}
            showWorks={showWorks}
            searchKeyword={searchKeyword}
            selectedDateRange={selectedDateRange}
          />
        </div>

          {/* Sidebar */}
    <aside className="p-4 bg-gray-50 border-l border-gray-200 overflow-y-auto mt-4" aria-label="Search and filter controls">
        {/* Toggles */}
        <div className="mb-4">
          <div className="flex justify-center items-center gap-10">
            {/* Show Grants Toggle */}
            <div className="flex items-center">
              <span id="grants-label" className="text-gray-700 font-medium mr-2">Show Grants</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showGrants}
                  onChange={() => setShowGrants(!showGrants)}
                  aria-labelledby="grants-label"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#022851] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
              </label>
            </div>

            {/* Show Works Toggle */}
            <div className="flex items-center">
              <span id="works-label" className="text-gray-700 font-medium mr-2">Show Works</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showWorks}
                  onChange={() => setShowWorks(!showWorks)}
                  aria-labelledby="works-label"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#022851] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#022851]"></div>
              </label>
            </div>
          </div>
        </div>
        {/* Filters */}
      <div>
        <h2 className="text-lg font-medium mb-3">Filters</h2>
        {/* Date Filter */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          {/* Selected Dates */}
          <div className="flex justify-center items-center text-lg font-semibold mb-2">
            {pendingDateRange[0]} – {pendingDateRange[1]}
          </div>
          {/* Date Range Slider */}
          <ReactSlider
            min={1990}
            max={2025}
            value={pendingDateRange}
            onChange={(value) => setPendingDateRange(value)}
            step={1}
            className="custom-slider"
            thumbClassName="custom-thumb"
            trackClassName="custom-track"
            withTracks={true}
            ariaLabel={['Start year', 'End year']} // Add accessible names for the thumbs
            ariaValuetext={(state) => `Selected year: ${state.valueNow}`} // Optional: Add dynamic value text
          />
        </div>
      </div>
      {/* Apply + Clear Filters */}
      <div className="mt-4">
        <p className="text-sm text-gray-600 mb-2">Use the buttons below to apply or reset the date range filter:</p>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedDateRange([...pendingDateRange])}
            className={`w-1/2 font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 transition ${isFilterPending
                ? "bg-[#022851] text-white hover:bg-[#044073] focus:ring-[#022851]"
                : "bg-gray-300 text-gray-600 hover:bg-gray-400 focus:ring-gray-400"
              }`}
            aria-label="Apply selected date range filter"
          >
            Apply Filter
          </button>
          <button
            onClick={() => {
              setPendingDateRange([1990, 2025]);
              setSelectedDateRange([1990, 2025]);
            }}
            className="w-1/2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
            aria-label="Reset date range to default"
          >
            Reset Dates
          </button>
        </div>
      </div>

            <details className="group mt-6 text-sm bg-white p-4 rounded border border-gray-300 shadow">
              <summary className="font-semibold cursor-pointer text-[#022851] group-hover:text-blue-700 transition-colors">
                Map Guide
              </summary>
              <div className="mt-3 text-gray-800 space-y-6">
                {/* Location Colors */}
                <div>
                  <h3 className="text-base font-bold text-[#022851] mb-1">Location Colors</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><span className="text-yellow-500 font-semibold">Yellow</span> – Grant locations</li>
                    <li><span className="text-blue-600 font-semibold">Blue</span> – Research work locations</li>
                    <li><span className="text-green-600 font-semibold">Green</span> – Locations with both work and grant data</li>
                  </ul>
                </div>

                {/* Map Features */}
                <div>
                  <h3 className="text-base font-bold text-[#022851] mb-1">Map Features</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Number markers</strong> show how many entries are linked to that place</li>
                    <li><strong>Confidence score</strong> shows how confident the system is in mapping the extracted geographic name to the corresponding location</li>
                  </ul>
                </div>

                {/* Keyword Search */}
                <div>
                  <h3 className="text-base font-bold text-[#022851] mb-1">Keyword Search</h3>
                  <p>Type a word or phrase to find matches in:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Work or grant title</li>
                    <li>Abstract</li>
                    <li>Funder (for grants)</li>
                    <li>Issued year, start or end date</li>
                    <li>Expert names</li>
                  </ul>
                </div>

                {/* Date Filter */}
                <div>
                  <h3 className="text-base font-bold text-[#022851] mb-1">Date Filter</h3>
                  <p>Only shows research works published and grants funded within the selected year range.</p>
                </div>
              </div>
            </details>
          </aside>
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full h-10 bg-[#022851]" role="contentinfo"></footer>
    </div>
  );
}

export default App;