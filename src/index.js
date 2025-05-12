/**
 * @file index.js
 * @description This is the main entry point for the React application. It initializes the React app by rendering
 *              the `App` component into the root DOM element. The file also includes global styles and enables
 *              React's strict mode for highlighting potential issues in the application.
 *
 * Features:
 * - Imports global CSS styles for the application.
 * - Renders the `App` component inside the `<div id="root"></div>` element in `index.html`.
 * - Uses `React.StrictMode` to help identify potential problems in the application.
 *
 * Marina Mata, 2025
 */

import React from 'react';
import ReactDOM from 'react-dom';
import './styles/index.css';
import App from './App';

// Render the main App component into the root DOM element
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);