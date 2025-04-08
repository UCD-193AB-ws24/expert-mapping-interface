/**
 * App Component – Main Layout for Aggie Experts Interactive Map
 * 
 * This component serves as the entry point of the frontend application. It defines
 * the full-page layout including:
 * - A branded header with logo and title
 * - A navigation bar linking to external expert and grant pages
 * - The main map interface, loaded via the <Map /> component
 * - A styled footer bar (placeholder for future use)
 * 
 * Styling is handled using Tailwind CSS utility classes and imported global styles.
 * Assets (like the logo and header image) are loaded from local `/assets`.
 *
 * @module App
 */

import React from "react";
import "./styles/index.css";
import Map from "./components/Map";

import topImage from "./assets/topImage.png";
import aggieExpertsLogo from "./assets/aggie-experts-logo-primary.png";

function App() {
  return (
    <div className="App flex flex-col min-h-screen"
    style={{ backgroundColor: "#FFFFFF" }}>
    {/* 🔷 Header: UC Davis logo and map title */}
    <nav className="flex items-center py-2 px-10 bg-white shadow-md fixed top-0 left-0 w-full z-50">

        <div className="flex items-center space-x-6">
          <img
            src={aggieExpertsLogo}
            alt="Aggie Experts Logo"
            className="h-16 w-auto ml-4"
          />
          <a href="#" className="text-xl font-semibold text-[#022851]">
            Aggie Experts Interactive Map
          </a>
        </div>
      </nav>

      {/* 🔗 Navigation Bar: Links to Experts and Grants */}
      {/* <div className="flex justify-between items-center bg-[#022851] px-10 py-2"> */}
      <div className="flex justify-between items-center bg-[#022851] px-10 py-2 fixed top-[80px] left-0 w-full z-50">
        <div className="flex space-x-12">
          <a
            href="https://experts.ucdavis.edu/browse/expert/a"
            className="text-lg text-white hover:underline"
          >
            Experts
          </a>
          <a
            href="https://experts.ucdavis.edu/browse/grant/1"
            className="text-lg text-white hover:underline"
          >
            Grants
          </a>
        </div>
        {/* 👤 My Account Button (links to UC Davis homepage for now) */}
        <a
          href="https://www.ucdavis.edu/"
          className="text-lg text-white flex items-center hover:underline"
          aria-label="My Account"
        >
          My Account
          <span className="ml-2 p-2 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="white"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </span>
        </a>
      </div>

       {/*🗺️ Map Section: Main interface powered by Leaflet*/}
      <div className="relative mx-auto w-full max-w-[1200px] bg-white overflow-hidden"
     style={{ height: 'calc(100vh - 140px)', marginTop: '140px' }}>
  <Map />
</div>

      {/* 🔻 Footer Bar (currently a placeholder) */}
      <div className="w-full h-10 bg-[#022851]"></div>
    </div>
  );
}

export default App;
