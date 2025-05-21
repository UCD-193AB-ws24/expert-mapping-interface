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
 * Marina Mata, 2025
 */

import React, { useState } from "react";
import "./styles/index.css";
import ResearchMap from "./components/ResearchMap";
import ReactSlider from "react-slider";
import aggieExpertsLogo from "./assets/aggie-experts-logo-primary.png";

/**
 * The main `App` component that serves as the entry point for the application.
 * It provides the layout and functionality for interacting with the research map.
 *
 * @returns {JSX.Element} The rendered `App` component.
 */
function App() {
  // State variables
  const [showGrants, setShowGrants] = useState(true); // Toggles visibility of grants on the map
  const [showWorks, setShowWorks] = useState(true); // Toggles visibility of works on the map
  const [searchKeyword, setSearchKeyword] = useState(""); // Stores the search keyword
  const [selectedDateRange, setSelectedDateRange] = useState([1990, 2025]); // Stores the selected date range
  // Mobile view state variables 
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  
  /**
   * Handles changes to the search input field.
   * @param {Object} e - The event object from the input field.
   */
  const handleSearchChange = (e) => {
    setSearchKeyword(e.target.value);
  };

  return (
    <div className="App flex flex-col min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Header Section */}
        <header className="flex items-center py-2 px-4 bg-white shadow-md fixed top-0 left-0 w-full z-50">
          <div className="flex items-center space-x-6">
            <img src={aggieExpertsLogo} alt="Aggie Experts Logo" className="h-16 w-auto ml-8" />
            <h1 className="text-xl font-semibold text-[#022851]">
          <a href="#" aria-label="Aggie Experts Interactive Map home">Aggie Experts Interactive Map</a>
            </h1>
          </div>
        </header>

        {/* Navigation Section */}
      <nav className="flex flex-wrap items-center bg-[#022851] px-4 py-2 fixed top-[80px] left-0 w-full z-50" aria-label="Main navigation">
        <div className="flex space-x-6 mb-2 sm:mb-0">
          <a href="https://experts.ucdavis.edu/browse/expert/a" className="text-lg text-white hover:underline">Experts</a>
          <a href="https://experts.ucdavis.edu/browse/grant/1" className="text-lg text-white hover:underline">Grants</a>
        </div>
        <div className="relative searchbar ml-auto">
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

      {/* Main Content Section */}
      <main className="w-full overflow-hidden bg-white" style={{ height: 'calc(100vh - 140px)', marginTop: '140px' }}>
        <div className="map-container flex w-full h-full">
          {/* Filter Mobile View Button */}
          {!isFilterModalOpen && !isGuideModalOpen && (
            <div className="fixed bottom-6 right-6 flex flex-col gap-4 z-[1200] md:hidden">
              <button
                className="bg-[#022851] text-white rounded-full shadow-lg p-4 flex items-center"
                onClick={() => setIsFilterModalOpen(true)}
                aria-label="Show filters"
              >
                {/* Funnel icon */}
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polygon points="3 4 21 4 14 14 14 21 10 21 10 14 3 4"/>
                </svg>
                <span className="ml-2">Filters</span>
              </button>
              <button
                className="bg-[#3879C7] text-white rounded-full shadow-lg p-4 flex items-center"
                onClick={() => setIsGuideModalOpen(true)}
                aria-label="Show map guide"
              >
                {/* Info/Guide icon */}
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span className="ml-2">Guide</span>
              </button>
            </div>
          )}

          {/* Map Section */}
          <div id="map" className="flex-1 min-w-0 relative order-1" aria-label="Interactive map showing expert and grant locations">
            <ResearchMap
              showGrants={showGrants}
              showWorks={showWorks}
              searchKeyword={searchKeyword}
              selectedDateRange={selectedDateRange}
            />
          </div>

          {/* Sidebar Section */}
          <aside className="hidden md:block p-4 bg-white border-l border-gray-200 overflow-y-auto mt-4"
            aria-label="Search and filter controls"
          >
            {/* Show Works/Grants Toggle Section */}
            <div className="mb-2">
              <span className="block text-lg font-bold text-[#022851] mb-2">Display Options</span>
            </div>
            <div className="mb-4">
              <div className="mt-2 flex flex-col gap-4">
                  <div className="flex items-center">
                    <span id="grants-label" className="text-black-600 font-medium mr-2">Show Grants</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={showGrants}
                        onChange={() => setShowGrants(!showGrants)}
                        aria-labelledby="grants-label"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#022851] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#eda012]"></div>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <span id="works-label" className="text-black-600 font-medium mr-2">Show Works</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={showWorks}
                        onChange={() => setShowWorks(!showWorks)}
                        aria-labelledby="works-label"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#022851] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3879C7]"></div>
                    </label>
                  </div>
                </div>
            </div>

            {/* Date Filter Section */}
            <div className="mb-4">
              <div className="mb-2">
                <span className="block text-lg font-bold text-[#022851] mb-2">Date Slider</span>
              </div>
              <div className="mt-3">
                  <p className="text-sm text-gray-500 font-semibold text-left mb-2">
                    Slide to filter experts by when their work and grants were active
                  </p>
                  <div className="text-center text-base font-semibold text-gray-800 mb-3">
                    {selectedDateRange[0]} – {selectedDateRange[1]}
                  </div>
                  <ReactSlider
                    min={1990}
                    max={2025}
                    value={selectedDateRange}
                    onChange={(value) => setSelectedDateRange(value)}
                    step={1}
                    className="custom-slider"
                    thumbClassName="custom-thumb"
                    trackClassName="custom-track"
                    withTracks={true}
                    ariaLabel={['Start year', 'End year']}
                    ariaValuetext={(state) => `Selected year: ${state.valueNow}`}
                  />
                </div>
            </div>

            {/* Map Guide Section */}
            <details open className="group mt-6 text-sm bg-white p-4 rounded border border-gray-300 shadow">
              <summary className="flex items-center justify-between font-bold cursor-pointer text-[#022851] group-hover:text-blue-700 transition-colors">
                <span className="block text-lg font-bold text-[#022851] mb-2">
                  Map Guide
                </span>
                <span className="text-sm text-gray-400">
                  <span className="group-open:hidden">(click to open)</span>
                  <span className="hidden group-open:inline">(click to close)</span>
                </span>
              </summary>
              <div className="mt-3 text-gray-800 font-medium space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#022851] mb-2">Location Colors</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><span style={{ color: "#eda012", fontWeight: 600 }}>Yellow</span> – Experts with Grants.</li>
                    <li><span style={{ color: "#3879C7", fontWeight: 600 }}>Blue</span> – Experts with Works.</li>
                    <li><span style={{ color: "#659c39", fontWeight: 600 }}>Green</span> – Experts with both works and grants.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#022851] mb-2">Map Features</h3>
                  <ul className="list-disc list-inside space-y-1">
                  <li><strong>Number markers</strong> show how many entries are linked to that place.</li>
                  <li><strong>Confidence score</strong> shows how confident the system is in mapping the extracted geographic name to the corresponding location.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#022851] mb-2">Keyword Search</h3>
                  <p>Type a word or phrase to find matches in:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Work or grant title</li>
                  <li>Abstract</li>
                  <li>Funder (for grants)</li>
                  <li>Issued year, start or end date</li>
                  <li>Expert names</li>
                  </ul>
                  <p className="mt-2 text-gray-700">
                  The system detects close matches — plurals and minor spelling errors are okay. One to two letter typos are accepted.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#022851] mb-2">Date Filter</h3>
                  <p>Only shows research works published and grants funded within the selected year range.</p>
                </div>
              </div>
            </details>
            </aside>

          {/* Filter Modal */}
          {isFilterModalOpen && (
            <div className="fixed inset-0 z-[1200] bg-black bg-opacity-40 flex justify-center items-center md:hidden">
              <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-md p-4 relative">
                <button
                  className="absolute top-2 right-2 text-gray-500 text-2xl"
                  onClick={() => setIsFilterModalOpen(false)}
                  aria-label="Close filters"
                >&times;</button>
                {/* Show Works/Grants Toggle Section */}
                <div className="mb-2">
                  <span className="block text-lg font-bold text-[#022851] mb-2">Display Options</span>
                </div>
                <div className="mb-4">
                  <div className="mt-2 flex flex-col gap-4">
                      <div className="flex items-center">
                        <span id="grants-label" className="text-black-600 font-medium mr-2">Show Grants</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={showGrants}
                            onChange={() => setShowGrants(!showGrants)}
                            aria-labelledby="grants-label"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#022851] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#eda012]"></div>
                        </label>
                      </div>
                      <div className="flex items-center">
                        <span id="works-label" className="text-black-600 font-medium mr-2">Show Works</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={showWorks}
                            onChange={() => setShowWorks(!showWorks)}
                            aria-labelledby="works-label"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#022851] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3879C7]"></div>
                        </label>
                      </div>
                    </div>
                </div>

                {/* Date Filter Section */}
                <div className="mb-4">
                  <div className="mb-2">
                    <span className="block text-lg font-bold text-[#022851] mb-2">Date Slider</span>
                  </div>
                  <div className="mt-3">
                      <p className="text-sm text-gray-500 text-left mb-2">
                        Slide to filter experts by when their work and grants were active
                      </p>
                      <div className="text-center text-base font-semibold text-gray-800 mb-3">
                        {selectedDateRange[0]} – {selectedDateRange[1]}
                      </div>
                      <ReactSlider
                        min={1990}
                        max={2025}
                        value={selectedDateRange}
                        onChange={(value) => setSelectedDateRange(value)}
                        step={1}
                        className="custom-slider"
                        thumbClassName="custom-thumb"
                        trackClassName="custom-track"
                        withTracks={true}
                        ariaLabel={['Start year', 'End year']}
                        ariaValuetext={(state) => `Selected year: ${state.valueNow}`}
                      />
                    </div>
            </div>

              </div>
            </div>
          )}

          {/* Guide Modal */}
          {isGuideModalOpen && (
            <div className="fixed inset-0 z-[1200] bg-black bg-opacity-40 flex justify-center items-center md:hidden">
              <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-md p-4 relative max-h-[90vh] overflow-y-auto">
                <button
                  className="absolute top-2 right-2 text-gray-500 text-2xl"
                  onClick={() => setIsGuideModalOpen(false)}
                  aria-label="Close guide"
                >&times;</button>
                {/* Map Guide content, with smaller font on mobile */}
                <div className="text-xs sm:text-sm text-gray-800 space-y-6">
                  
                  {/* Map Guide Section */}
                  <details open className="group mt-6 text-sm bg-white p-4 rounded border border-gray-300 shadow">
                    <summary className="flex items-center justify-between font-bold cursor-pointer text-[#022851] group-hover:text-blue-700 transition-colors">
                      <div className="mb-2">
                        <span className="block text-lg font-bold text-[#022851] mb-2">Map Guide</span>
                      </div>
                    </summary>
                    <div className="mt-3 text-gray-800 font-medium space-y-6">
                      <div>
                        <h3 className="text-base font-bold text-[#022851] mb-2">Location Colors</h3>
                        <ul className="list-disc list-inside space-y-1">
                          <li><span style={{ color: "#eda012", fontWeight: 600 }}>Yellow</span> – Experts with Grants.</li>
                          <li><span style={{ color: "#3879C7", fontWeight: 600 }}>Blue</span> – Experts with Works.</li>
                          <li><span style={{ color: "#659c39", fontWeight: 600 }}>Green</span> – Experts with both works and grants.</li>
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#022851] mb-2">Map Features</h3>
                        <ul className="list-disc list-inside space-y-1">
                          <li><strong>Number markers</strong> show how many entries are linked to that place.</li>
                          <li><strong>Confidence score</strong> shows how confident the system is in mapping the extracted geographic name to the corresponding location.</li>
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#022851] mb-2">Keyword Search</h3>
                        <p>Type a word or phrase to find matches in:</p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                          <li>Work or grant title</li>
                          <li>Abstract</li>
                          <li>Funder (for grants)</li>
                          <li>Issued year, start or end date</li>
                          <li>Expert names</li>
                        </ul>
                        <p className="mt-2 text-gray-700">
                          The system detects close matches — plurals and minor spelling errors are okay. One to two letter typos are accepted.
                        </p>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#022851] mb-2">Date Filter</h3>
                        <p>Only shows research works published and grants funded within the selected year range.</p>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Section */}
      <footer className="w-full h-10 bg-[#022851]" role="contentinfo"></footer>
    </div>
  );
}

export default App;