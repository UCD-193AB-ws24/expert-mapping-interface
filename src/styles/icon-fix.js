/**
 * @file icon-fix.js
 * @description This file fixes the default marker icon issue in Leaflet by explicitly setting the default marker icon
 *              and shadow images. This ensures that the Leaflet markers are displayed correctly when using the library
 *              in a React application or a build environment where the default assets might not be resolved properly.
 *
 * Features:
 * - Imports the default marker icon and shadow images from the Leaflet package.
 * - Configures the default Leaflet marker icon with appropriate size and anchor settings.
 * - Applies the custom default icon to all Leaflet markers globally.
 *
 * Marina Mata, 2025
 */

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Define the default Leaflet marker icon
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41], // Size of the icon
    iconAnchor: [12, 41] // Anchor point of the icon
});

// Set the default icon for all Leaflet markers
L.Marker.prototype.options.icon = DefaultIcon;