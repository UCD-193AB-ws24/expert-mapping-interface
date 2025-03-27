import React from "react";
import "./styles/index.css";
import Map from "./components/Map";

import topImage from "./assets/topImage.png";
import aggieExpertsLogo from "./assets/aggie-experts-logo-primary.png";

function App() {
  return (
    <div className="App flex flex-col min-h-screen">
      {/* Header */}
      <nav className="flex items-center py-4 px-10 bg-white shadow-md">
        <div className="flex items-center space-x-8">
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

      {/* Navbar */}
      <div className="flex justify-between items-center bg-[#022851] px-10 py-2">
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

      {/* Map Section */}
      <div className="flex-grow w-full">
        <Map />
      </div>

      {/* Footer Placeholder */}
      <div className="w-full h-10 bg-[#022851]"></div>
    </div>
  );
}

export default App;
