import React from "react";
import "./styles/index.css";
import Map from './components/Map';

import topImage from './assets/topImage.png';
import aggieExpertsLogo from './assets/aggie-experts-logo-primary.png';

function App() {
  return (
    <div className="App flex flex-col min-h-screen">
      {/* Navbar */}
      <nav className="flex items-center py-4 px-10 bg-white shadow-md">
        <div className="flex items-center space-x-8">
          <img src={aggieExpertsLogo} alt="Aggie Experts Logo" className="h-16 w-auto ml-4" />
          <div className="flex items-center space-x-10">
            <a href="#" className="map-title" style={{ color: '#022851' }}>
              Aggie Experts Interactive Map
            </a>
          </div>
        </div>
      </nav>

      {/* Blue Section with Links */}
      <div className="flex justify-between items-center bg-blue-900 px-10 py-1" style={{ backgroundColor: '#022851' }}>
        <div className="flex space-x-12">
          <a href="https://experts.ucdavis.edu/browse/expert/a" className="text-1.5xl text-white">Experts</a>
          <a href="https://experts.ucdavis.edu/browse/grant/1" className="text-1.5xl text-white">Grants</a>
        </div>
        <a href="https://www.ucdavis.edu/" className="text-1.5xl text-white flex items-center">
          My Account
          <span className="ml-2 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
              <circle cx="12" cy="8" r="4" fill="white" stroke="white" strokeWidth="2"/>
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="white" stroke="white" strokeWidth="2"/>
            </svg>
          </span>
        </a>
      </div>

      {/* Map Section */}
      <div className="w-full h-full">
        <Map />
      </div>

     <div
       className="w-full"
       style={{
         height: '4em',  // or any desired height
         backgroundColor: '#022851',  // your solid color
       }}
     ></div>


    </div>
  );
}

export default App;
