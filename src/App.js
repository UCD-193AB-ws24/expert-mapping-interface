import React, { useState } from "react";
import "./styles/index.css";
import Map from "./components/Map";

import topImage from "./assets/topImage.png";
import aggieExpertsLogo from "./assets/aggie-experts-logo-primary.png";

function App() {
const [showGrants, setShowGrants] = useState(false); // start OFF, initialize map to no markers
const [showWorks, setShowWorks] = useState(false);   // start OFF, initialize map to no markers


  return (
    <div className="App flex flex-col min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
      {/* 🔷 Header: UC Davis logo and map title */}
      <header className="flex items-center py-2 px-10 bg-white shadow-md fixed top-0 left-0 w-full z-50">
        <div className="flex items-center space-x-6">
          <img
            src={aggieExpertsLogo}
            alt="Aggie Experts Logo"
            className="h-16 w-auto ml-4"
          />
          <h1 className="text-xl font-semibold text-[#022851]">
            <a href="#" aria-label="Aggie Experts Interactive Map home">
              Aggie Experts Interactive Map
            </a>
          </h1>
        </div>
      </header>

      {/* 🔗 Navigation Bar */}
      <nav className="flex justify-between items-center bg-[#022851] px-10 py-2 fixed top-[80px] left-0 w-full z-50" aria-label="Main navigation">
        <div className="flex space-x-12">
          <a
            href="https://experts.ucdavis.edu/browse/expert/a"
            className="text-lg text-white hover:underline focus:outline-white focus:underline"
            aria-label="Browse Experts"
          >
            Experts
          </a>
          <a
            href="https://experts.ucdavis.edu/browse/grant/1"
            className="text-lg text-white hover:underline focus:outline-white focus:underline"
            aria-label="Browse Grants"
          >
            Grants
          </a>
        </div>
        <a
          href="https://www.ucdavis.edu/"
          className="text-lg text-white flex items-center hover:underline focus:outline-white focus:underline"
          aria-label="My Account"
        >
          My Account
          <span className="ml-2 p-2 rounded-full" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="white">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </span>
        </a>
      </nav>

      {/* 🗺️ Map Section */}
      <main className="w-full overflow-hidden bg-white" style={{ height: 'calc(100vh - 140px)', marginTop: '140px' }}>
        <div className="flex w-full h-full">
          {/* Map */}
          <div className="w-[80%] min-w-0 relative" aria-label="Interactive map showing expert and grant locations">
            <Map showGrants={showGrants} showWorks={showWorks} />
          </div>

          {/* Sidebar */}
          <aside className="w-[20%] p-4 bg-gray-50 border-l border-gray-200" aria-label="Search and filter controls">
            {/* Search Bar */}
            <div className="mb-6">
              <label htmlFor="search-input" className="sr-only">Search keyword</label>
              <div className="relative">
                <input 
                  id="search-input"
                  type="text" 
                  placeholder="Search keyword" 
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
            </div>

            {/* Toggle Filters */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <span id="grants-label" className="text-gray-700 font-medium">Show Grants</span>
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

              <div className="flex justify-between items-center mb-6">
                <span id="works-label" className="text-gray-700 font-medium">Show Works</span>
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

            {/* Filter Section (placeholder for future) */}
            <div>
              <h2 className="text-lg font-medium mb-3">Filters</h2>

              {/* Location Filter */}
              <div className="mb-3">
                <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <div className="relative">
                  <select id="location-filter" className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-[#022851]">
                    <option value="">Location (All)</option>
                    <option value="africa">Africa</option>
                    <option value="antarctica">Antarctica</option>
                    <option value="asia">Asia</option>
                    <option value="australia">Australia/Oceania</option>
                    <option value="europe">Europe</option>
                    <option value="north-america">North America</option>
                    <option value="south-america">South America</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Research Area Filter (placeholder) */}
              <div className="mb-6">
                <label htmlFor="research-area-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Research Area
                </label>
                <div className="relative">
                  <select id="research-area-filter" className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-[#022851]">
                    <option value="">Areas (All)</option>
                    <option value="agriculture">Agriculture & Environment</option>
                    <option value="engineering">Engineering</option>
                    <option value="health">Health & Medicine</option>
                    <option value="social-sciences">Social Sciences</option>
                    <option value="arts-humanities">Arts & Humanities</option>
                    <option value="data-science">Data Science / AI</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Apply Button (placeholder) */}
              <button className="w-full bg-[#022851] hover:bg-[#033a73] text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#022851]" aria-label="Apply selected filters">
                Apply Filters
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* 🔻 Footer */}
      <footer className="w-full h-10 bg-[#022851]" role="contentinfo"></footer>
    </div>
  );
}

export default App;
