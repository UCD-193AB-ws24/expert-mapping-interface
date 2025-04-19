import React, { useState } from "react";
import "./styles/index.css";
import ResearchMap from "./components/ResearchMap";

import topImage from "./assets/topImage.png";
import aggieExpertsLogo from "./assets/aggie-experts-logo-primary.png";

function App() {
  const [showGrants, setShowGrants] = useState(false);
  const [showWorks, setShowWorks] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const [selectedDate, setSelectedDate] = useState("");
  const [pendingDateSelection, setPendingDateSelection] = useState("");

  const handleSearchChange = (e) => {
    setSearchKeyword(e.target.value);
  };

  return (
    <div className="App flex flex-col min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
      {/* 🔷 Header */}
      <header className="flex items-center py-2 px-10 bg-white shadow-md fixed top-0 left-0 w-full z-50">
        <div className="flex items-center space-x-6">
          <img src={aggieExpertsLogo} alt="Aggie Experts Logo" className="h-16 w-auto ml-4" />
          <h1 className="text-xl font-semibold text-[#022851]">
            <a href="#" aria-label="Aggie Experts Interactive Map home">Aggie Experts Interactive Map</a>
          </h1>
        </div>
      </header>

      {/* 🔗 Navigation Bar */}
      <nav className="flex justify-between items-center bg-[#022851] px-10 py-2 fixed top-[80px] left-0 w-full z-50" aria-label="Main navigation">
        <div className="flex space-x-12">
          <a href="https://experts.ucdavis.edu/browse/expert/a" className="text-lg text-white hover:underline">Experts</a>
          <a href="https://experts.ucdavis.edu/browse/grant/1" className="text-lg text-white hover:underline">Grants</a>
        </div>
        <a href="https://www.ucdavis.edu/" className="text-lg text-white flex items-center hover:underline">
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
            <ResearchMap
              showGrants={showGrants}
              showWorks={showWorks}
              searchKeyword={searchKeyword}
              selectedDate={selectedDate}
            />
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
            </div>

            {/* Toggles */}
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

            {/* Filters */}
            <div>
              <h2 className="text-lg font-medium mb-3">Filters</h2>

              {/* Date Filter */}
              <div className="mb-3">
                <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <div className="relative">
                  <select
                    id="date-filter"
                    value={pendingDateSelection}
                    onChange={(e) => setPendingDateSelection(e.target.value)}
                    className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-[#022851]"
                  >
                    <option value="">Issued Date (All)</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                    <option value="2021">2021</option>
                    <option value="2020">2020</option>
                    <option value="2019">2019</option>
                    <option value="2018">2018</option>
                    <option value="2017">2017</option>
                    <option value="2016">2016</option>
                    <option value="2015">2015</option>
                    <option value="2014">2014</option>
                    <option value="2013">2013</option>
                    <option value="2012">2012</option>
                    <option value="2011">2011</option>
                    <option value="2010">2010</option>
                    <option value="2009">2009</option>
                    <option value="2008">2008</option>
                    <option value="2007">2007</option>
                    <option value="2006">2006</option>
                    <option value="2005">2005</option>
                    <option value="2004">2004</option>
                    <option value="2003">2003</option>
                    <option value="2002">2002</option>
                    <option value="2001">2001</option>
                    <option value="2000">2000</option>
                    <option value="1900s">1900s</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                  </div>
                </div>
              </div>

              {/* Apply + Clear Filters */}
              <div className={`flex gap-2 mt-2 p-2 rounded ${selectedDate ? "bg-yellow-100 border border-yellow-400" : ""}`}> {/*highlight the filter box while filters are box to let user know filters are applied*/}
                <button
                  onClick={() => setSelectedDate(pendingDateSelection)}
                  className="w-1/2 bg-[#022851] hover:bg-[#033a73] text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#022851]"
                  aria-label="Apply selected filters"
                >
                  Apply
                </button>

                <button
                  onClick={() => {
                    setPendingDateSelection("");
                    setSelectedDate("");
                  }}
                  className="w-1/2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                  aria-label="Clear all filters"
                >
                  Clear
                </button>
              </div>

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
