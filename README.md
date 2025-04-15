# Third Place Index Map

An interactive web application to visualize the Third Place Index (TPI) using Mapbox GL JS.

## Overview

This application allows users to explore the Third Place Index data for Houston, with the following features:

- Choropleth map showing Third Place Index scores by census tract
- Toggle layers to view different subcategories of the index
- Interactive point data for third places with hover tooltips
- Detailed side panel displaying tract information when clicked
- Visualizations showing how tracts compare and what types of third places are present

## Setup

1. Edit the `js/config.js` file and replace `YOUR_MAPBOX_TOKEN_HERE` with your actual Mapbox access token.
   ```javascript
   mapboxToken: 'YOUR_MAPBOX_TOKEN_HERE',
   ```

2. Make sure the paths to the GeoJSON files are correct in the `config.js` file:
   ```javascript
   data: {
       tracts: '../2. R Output/houston_tpi.geojson',
       places: '../2. R Output/houston_places.geojson'
   },
   ```

3. Serve the application using a local web server. You can use one of the following methods:

   **Using Python:**
   ```
   # Python 3
   python -m http.server
   
   # Python 2
   python -m SimpleHTTPServer
   ```

   **Using Node.js:**
   ```
   # Install http-server if you haven't already
   npm install -g http-server
   
   # Serve the application
   http-server
   ```

4. Open the application in your browser by navigating to the URL provided by your server (typically `http://localhost:8000` or similar).

## Using the Application

- **Toggle Layers:** Click the "Layers" button in the navigation bar to show/hide the layers panel, where you can select different view options.
  
- **View Different Metrics:** Use the radio buttons in the layers panel to switch between the overall Third Place Index and its subcategories (traditional, community, and modern scores).
  
- **Filter Places:** Use the checkboxes to show/hide different categories of third places on the map.
  
- **View Tract Details:** Click on any census tract to open the details panel, which shows:
  - Overall Third Place Index score
  - Subcategory scores
  - Place type breakdown
  - Ranking among all tracts
  
- **Explore Points:** Hover over any point on the map to see a tooltip with information about that place.

## Data Structure

The application uses two main GeoJSON files:

1. **houston_tpi.geojson:** Contains census tract polygons with the following properties:
   - `GEOID`: Census tract identifier
   - `third_place_index`: Overall Third Place Index score
   - `traditional_score`: Score for traditional third places
   - `community_score`: Score for community spaces
   - `modern_score`: Score for modern gathering spaces
   - `total_places`: Total number of third places in the tract

2. **houston_places.geojson:** Contains point data for individual third places with the following properties:
   - `name`: Name of the place
   - `osm_key`: OpenStreetMap key
   - `osm_value`: OpenStreetMap value
   - `category`: Category of third place (traditional, community, or modern)

## Customization

You can customize the appearance of the map by modifying the CSS in `css/styles.css` and the color scales in `js/config.js`. 