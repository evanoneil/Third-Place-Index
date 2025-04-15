// Main application script for Third Place Index Map

// Global variables
let map;
let tractsData;
let placesData;
let currentPopup = null;
let activeLayer = 'overall-index';
let selectedTract = null;
let selectedTractId = null;
let tractsRanking = [];
let buildings3DEnabled = true;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initEventListeners();
});

// Initialize Mapbox map
function initMap() {
    mapboxgl.accessToken = CONFIG.mapboxToken;
    
    map = new mapboxgl.Map({
        container: 'map',
        style: CONFIG.map.style,
        center: CONFIG.map.center,
        zoom: CONFIG.map.zoom,
        pitch: CONFIG.map.pitch,
        bearing: CONFIG.map.bearing,
        minZoom: 9,
        antialias: true // Enable antialiasing for smoother rendering
    });
    
    map.on('load', () => {
        // Add navigation control
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Hide city labels
        hideCityLabels();
        
        // Enable 3D buildings
        add3DBuildings();
        
        // Load data
        loadData();
    });
}

// Hide city labels on the map
function hideCityLabels() {
    const style = map.getStyle();
    
    // Find and modify layers containing city labels
    style.layers.forEach(layer => {
        // Target city and place labels in the style
        if (layer.type === 'symbol' && 
            (layer.id.includes('label') || layer.id.includes('place') || layer.id.includes('settlement'))) {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
    });
}

// Toggle city labels visibility
function toggleCityLabels(visible) {
    const style = map.getStyle();
    
    // Find and modify layers containing city labels
    style.layers.forEach(layer => {
        if (layer.type === 'symbol' && 
            (layer.id.includes('label') || layer.id.includes('place') || layer.id.includes('settlement'))) {
            map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
        }
    });
}

// Add 3D building layer
function add3DBuildings() {
    // Check if the map style has 'building' layer
    const layers = map.getStyle().layers;
    
    // Find the first symbol layer to insert the buildings layer before it
    let firstSymbolId;
    for (const layer of layers) {
        if (layer.type === 'symbol') {
            firstSymbolId = layer.id;
            break;
        }
    }
    
    // Add 3D buildings layer
    map.addLayer({
        'id': 'buildings-3d',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 14,
        'paint': CONFIG.buildings3D
    }, firstSymbolId);
}

// Toggle 3D buildings visibility
function toggle3DBuildings(enabled) {
    if (map.getLayer('buildings-3d')) {
        map.setLayoutProperty('buildings-3d', 'visibility', enabled ? 'visible' : 'none');
    }
    
    // Also adjust pitch if toggling buildings
    if (enabled && map.getPitch() < 30) {
        map.easeTo({
            pitch: CONFIG.map.pitch,
            duration: 1000
        });
    } else if (!enabled && map.getPitch() > 0) {
        map.easeTo({
            pitch: 0,
            duration: 1000
        });
    }
}

// Load GeoJSON data
function loadData() {
    // Create a data directory if it doesn't exist
    const dataDir = document.createElement('div');
    dataDir.style.display = 'none';
    document.body.appendChild(dataDir);
    
    // Load tracts data
    fetch(CONFIG.data.tracts)
        .then(response => response.json())
        .then(data => {
            tractsData = data;
            prepareRankings(data);
            addTractsLayer();
        })
        .catch(error => {
            console.error('Error loading tracts data:', error);
            alert('Error loading tract data. Please check your file paths in config.js.');
        });
    
    // Load places data
    fetch(CONFIG.data.places)
        .then(response => response.json())
        .then(data => {
            placesData = data;
            addPlacesLayers();
        })
        .catch(error => {
            console.error('Error loading places data:', error);
            alert('Error loading places data. Please check your file paths in config.js.');
        });
}

// Prepare tract rankings data
function prepareRankings(data) {
    tractsRanking = data.features.map(feature => ({
        id: feature.properties.GEOID,
        overall: feature.properties.third_place_index,
        traditional: feature.properties.traditional_index,
        community: feature.properties.community_index,
        modern: feature.properties.modern_index
    }));
    
    // Sort by overall score (descending)
    tractsRanking.sort((a, b) => b.overall - a.overall);
    
    // Calculate statistics for each metric
    calculateDistributionStats();
}

// Calculate distribution statistics
function calculateDistributionStats() {
    // Overall index distribution
    const overallValues = tractsRanking.map(tract => tract.overall);
    const traditionalValues = tractsRanking.map(tract => tract.traditional);
    const communityValues = tractsRanking.map(tract => tract.community);
    const modernValues = tractsRanking.map(tract => tract.modern);
    
    // Store distribution data globally
    window.distributionData = {
        overall: overallValues,
        traditional: traditionalValues,
        community: communityValues,
        modern: modernValues
    };
}

// Add census tracts layer to map
function addTractsLayer() {
    // Add source for tracts
    map.addSource('tracts', {
        type: 'geojson',
        data: tractsData
    });
    
    // Add fill layer
    map.addLayer({
        id: 'tracts-fill',
        type: 'fill',
        source: 'tracts',
        paint: {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'third_place_index'],
                0, CONFIG.colors.overall[0],
                0.2, CONFIG.colors.overall[1],
                0.4, CONFIG.colors.overall[2],
                0.6, CONFIG.colors.overall[3],
                0.8, CONFIG.colors.overall[4]
            ],
            'fill-opacity': 0.8
        }
    });
    
    // Add outline layer
    map.addLayer({
        id: 'tracts-outline',
        type: 'line',
        source: 'tracts',
        paint: {
            'line-color': '#555',
            'line-width': 1,
            'line-opacity': 0.5
        }
    });
    
    // Add selected tract highlight layer
    map.addLayer({
        id: 'selected-tract',
        type: 'line',
        source: 'tracts',
        paint: CONFIG.selectedTract,
        filter: ['==', 'GEOID', '']
    });
    
    // Add click interaction for tracts
    map.on('click', 'tracts-fill', (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0];
            selectedTract = feature;
            selectedTractId = feature.properties.GEOID;
            
            // Update the selected tract highlight
            map.setFilter('selected-tract', ['==', 'GEOID', selectedTractId]);
            
            // Show details panel
            showTractDetails(feature);
        }
    });
    
    // Change cursor on hover
    map.on('mouseenter', 'tracts-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'tracts-fill', () => {
        map.getCanvas().style.cursor = '';
    });
    
    // Add legend
    addLegend();
}

// Add places layers to map
function addPlacesLayers() {
    // Add source for places
    map.addSource('places', {
        type: 'geojson',
        data: placesData
    });
    
    ['traditional', 'community', 'modern'].forEach(category => {
        const categorySettings = CONFIG.placeCategories[category];
        
        map.addLayer({
            id: `places-${category}`,
            type: 'circle',
            source: 'places',
            paint: categorySettings.paint,
            filter: ['==', 'category', category],
            layout: {
                visibility: 'none'
            }
        });
        
        // Add hover interaction
        map.on('mouseenter', `places-${category}`, (e) => {
            map.getCanvas().style.cursor = 'pointer';
            
            // Close previous popup if exists
            if (currentPopup) {
                currentPopup.remove();
            }
            
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            
            // Ensure coordinates are in the correct format
            const lngLat = {
                lng: coordinates[0],
                lat: coordinates[1]
            };
            
            // Create popup content
            const placeName = feature.properties.name || 'Unnamed Place';
            const placeType = feature.properties.osm_value.replace(/_/g, ' ');
            const categoryDisplay = category.charAt(0).toUpperCase() + category.slice(1);
            
            const popupContent = `
                <div class="place-popup">
                    <h4>${placeName}</h4>
                    <p>${placeType}</p>
                    <span class="place-category category-${category}">
                        ${categoryDisplay}
                    </span>
                </div>
            `;
            
            // Create and display popup
            currentPopup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: true,
                maxWidth: '300px',
                offset: 10
            })
                .setLngLat(lngLat)
                .setHTML(popupContent)
                .addTo(map);
        });
        
        map.on('mouseleave', `places-${category}`, () => {
            map.getCanvas().style.cursor = '';
        });
    });
}

// Initialize event listeners
function initEventListeners() {
    // Layer toggle handlers
    document.querySelectorAll('input[name="index-layer"]').forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.checked) {
                activeLayer = e.target.id;
                updateChoroplethLayer();
                
                // If selecting a tract, make sure the distribution chart updates too
                if (selectedTractId) {
                    const selectedTractFeature = tractsData.features.find(f => f.properties.GEOID === selectedTractId);
                    if (selectedTractFeature) {
                        let value;
                        switch (activeLayer) {
                            case 'traditional-score':
                                value = selectedTractFeature.properties.traditional_index;
                                break;
                            case 'community-score':
                                value = selectedTractFeature.properties.community_index;
                                break;
                            case 'modern-score':
                                value = selectedTractFeature.properties.modern_index;
                                break;
                            case 'overall-index':
                            default:
                                value = selectedTractFeature.properties.third_place_index;
                                break;
                        }
                        createDistributionChart(value);
                    }
                }
            }
        });
    });
    
    // Place category toggle handlers
    document.getElementById('places-layer').addEventListener('change', (e) => {
        const visible = e.target.checked;
        
        // Update all category checkboxes
        document.querySelectorAll('#traditional-places, #community-places, #modern-places')
            .forEach(checkbox => {
                checkbox.checked = visible;
                updatePlaceLayer(checkbox.id.replace('-places', ''), visible);
            });
    });
    
    ['traditional-places', 'community-places', 'modern-places'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            const category = id.replace('-places', '');
            updatePlaceLayer(category, e.target.checked);
            
            // Check if all categories are checked/unchecked
            updateMainPlacesCheckbox();
        });
    });
    
    // 3D buildings toggle
    const buildings3DCheckbox = document.getElementById('buildings-3d');
    if (buildings3DCheckbox) {
        buildings3DCheckbox.addEventListener('change', (e) => {
            buildings3DEnabled = e.target.checked;
            toggle3DBuildings(buildings3DEnabled);
        });
    }
    
    // City labels toggle
    const cityLabelsCheckbox = document.getElementById('city-labels');
    if (cityLabelsCheckbox) {
        cityLabelsCheckbox.addEventListener('change', (e) => {
            toggleCityLabels(e.target.checked);
        });
    }
    
    // Panel toggle buttons
    document.getElementById('layers-btn').addEventListener('click', () => {
        const layersPanel = document.querySelector('.layers-panel');
        layersPanel.classList.toggle('hidden');
    });
    
    // Close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const panel = e.target.closest('.panel');
            panel.classList.add('hidden');
            
            // Clear selected tract if closing details panel
            if (panel.classList.contains('details-panel')) {
                clearSelectedTract();
            }
        });
    });
    
    // Handle clicks outside of panels to close them
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.panel') && !e.target.closest('#layers-btn')) {
            const layersPanel = document.querySelector('.layers-panel');
            if (!layersPanel.classList.contains('hidden')) {
                layersPanel.classList.add('hidden');
            }
        }
    });
}

// Clear selected tract highlight
function clearSelectedTract() {
    selectedTract = null;
    selectedTractId = null;
    map.setFilter('selected-tract', ['==', 'GEOID', '']);
}

// Add a legend to the map
function addLegend() {
    // Get current colors based on active layer
    let colors;
    let title;
    
    switch (activeLayer) {
        case 'traditional-score':
            colors = CONFIG.colors.traditional;
            title = 'Traditional Index';
            break;
        case 'community-score':
            colors = CONFIG.colors.community;
            title = 'Community Index';
            break;
        case 'modern-score':
            colors = CONFIG.colors.modern;
            title = 'Modern Index';
            break;
        case 'overall-index':
        default:
            colors = CONFIG.colors.overall;
            title = 'Third Place Index';
            break;
    }
    
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    
    // Create legend title
    const legendTitle = document.createElement('div');
    legendTitle.className = 'legend-title';
    legendTitle.textContent = title;
    legend.appendChild(legendTitle);
    
    // Create color blocks and labels
    const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
    const values = ['0', '0.2', '0.4', '0.6', '0.8+'];
    
    colors.forEach((color, i) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        
        const colorBlock = document.createElement('span');
        colorBlock.className = 'legend-color';
        colorBlock.style.backgroundColor = color;
        
        const label = document.createElement('span');
        label.className = 'legend-label';
        label.textContent = `${labels[i]} (${values[i]})`;
        
        item.appendChild(colorBlock);
        item.appendChild(label);
        legend.appendChild(item);
    });
    
    // Remove existing legend if any
    const existingLegend = document.querySelector('.map-legend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    // Add legend to the map
    document.querySelector('.content-area').appendChild(legend);
}

// Update choropleth layer based on selected metric
function updateChoroplethLayer() {
    if (!map.getSource('tracts')) return;
    
    let metric;
    let colorScale;
    
    switch (activeLayer) {
        case 'overall-index':
            metric = 'third_place_index';
            colorScale = CONFIG.colors.overall;
            break;
        case 'traditional-score':
            metric = 'traditional_index';
            colorScale = CONFIG.colors.traditional;
            break;
        case 'community-score':
            metric = 'community_index';
            colorScale = CONFIG.colors.community;
            break;
        case 'modern-score':
            metric = 'modern_index';
            colorScale = CONFIG.colors.modern;
            break;
        default:
            metric = 'third_place_index';
            colorScale = CONFIG.colors.overall;
            break;
    }
    
    // Check if colorScale exists and has the required array items
    if (!colorScale || !Array.isArray(colorScale) || colorScale.length < 5) {
        console.error("Invalid color scale for layer:", activeLayer);
        // Use a default color scale if the specified one is invalid
        colorScale = ['#e5f5f9', '#99d8c9', '#41b6c4', '#2c7fb8', '#253494'];
    }
    
    map.setPaintProperty('tracts-fill', 'fill-color', [
        'interpolate',
        ['linear'],
        ['get', metric],
        0, colorScale[0],
        0.2, colorScale[1],
        0.4, colorScale[2],
        0.6, colorScale[3],
        0.8, colorScale[4]
    ]);
    
    // Update legend by recreating it
    addLegend();
}

// Update place layer visibility
function updatePlaceLayer(category, visible) {
    const visibility = visible ? 'visible' : 'none';
    if (map.getLayer(`places-${category}`)) {
        map.setLayoutProperty(`places-${category}`, 'visibility', visibility);
    }
}

// Update the main places checkbox based on category checkboxes
function updateMainPlacesCheckbox() {
    const categoryCheckboxes = [
        document.getElementById('traditional-places'),
        document.getElementById('community-places'),
        document.getElementById('modern-places')
    ];
    
    const allChecked = categoryCheckboxes.every(cb => cb.checked);
    const allUnchecked = categoryCheckboxes.every(cb => !cb.checked);
    
    const mainCheckbox = document.getElementById('places-layer');
    mainCheckbox.checked = allChecked;
    mainCheckbox.indeterminate = !allChecked && !allUnchecked;
}

// Show tract details in side panel
function showTractDetails(feature) {
    const props = feature.properties;
    const detailsPanel = document.querySelector('.details-panel');
    
    // Ensure all required elements exist before setting their content
    const elements = {
        'tract-id': props.GEOID,
        'density-category': props.density_category,
        'overall-score': props.third_place_index.toFixed(2),
        'traditional-score-value': props.traditional_index.toFixed(2),
        'community-score-value': props.community_index.toFixed(2),
        'modern-score-value': props.modern_index.toFixed(2)
    };
    
    // Safely set content for each element
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
    
    // Set score bars
    const overallScoreBar = document.getElementById('overall-score-bar');
    if (overallScoreBar) {
        overallScoreBar.style.width = `${props.third_place_index * 100}%`;
    }
    
    const scoreBars = {
        'traditional-score-bar': props.traditional_index,
        'community-score-bar': props.community_index,
        'modern-score-bar': props.modern_index
    };
    
    Object.entries(scoreBars).forEach(([id, value]) => {
        const bar = document.getElementById(id);
        if (bar) {
            bar.style.width = `${value * 100}%`;
        }
    });
    
    // Set demographic information
    setDemographicInfo(props);
    
    // Set ranking info
    const tractIndex = tractsRanking.findIndex(t => t.id === props.GEOID);
    const rankElement = document.getElementById('overall-rank');
    const totalElement = document.getElementById('total-tracts');
    
    if (rankElement) {
        rankElement.textContent = tractIndex + 1;
    }
    if (totalElement) {
        totalElement.textContent = tractsRanking.length;
    }
    
    // Create charts
    createPlacesChart({
        traditional: props.traditional_count || 0,
        community: props.community_count || 0,
        modern: props.modern_count || 0
    });
    
    createPlaceTypesChart(props.GEOID);
    createDistributionChart(props.third_place_index);
    
    // Show panel if hidden
    detailsPanel.classList.remove('hidden');
}

// Helper function to get density category
function getDensityCategory(props) {
    return props.density_category || 'N/A';
}

// Helper function to format numbers with commas and handle undefined values
function formatNumber(value, decimals = 0) {
    if (value === undefined || value === null) {
        return 'N/A';
    }
    return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// Set demographic information in the details panel
function setDemographicInfo(props) {
    const demoInfoContainer = document.getElementById('demographic-info');
    demoInfoContainer.innerHTML = ''; // Clear existing content
    
    // Define demographic items with labels and formatters
    const demographicItems = [
        {
            label: 'Population Density',
            value: props.population_density,
            formatter: (val) => val ? Math.round(val).toLocaleString() + ' people/sq mi' : 'N/A'
        },
        {
            label: 'Total Population',
            value: props.total_population,
            formatter: (val) => val !== null ? val.toLocaleString() : 'N/A'
        },
        {
            label: 'Total Places',
            value: props.total_places,
            formatter: (val) => val !== null ? val.toLocaleString() : 'N/A'
        },
        {
            label: 'Median Household Income',
            value: props.median_income,
            formatter: (val) => val ? '$' + Math.round(val).toLocaleString() : 'N/A'
        },
        {
            label: 'Bachelor\'s Degree or Higher',
            value: props.pct_bachelors,
            formatter: (val) => val ? Math.round(val) + '%' : 'N/A'
        }
    ];
    
    // Create and append demographic items
    demographicItems.forEach(item => {
        if (item.value !== undefined && item.value !== null) {
            const element = document.createElement('div');
            element.className = 'demographic-item';
            element.innerHTML = `<strong>${item.label}:</strong> ${item.formatter(item.value)}`;
            demoInfoContainer.appendChild(element);
        }
    });
}

// Create places breakdown chart using D3.js
function createPlacesChart(data) {
    const chartContainer = document.getElementById('places-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 220;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const svg = d3.select('#places-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Convert data to array format and ensure it's a whole number
    const chartData = [
        { type: 'Traditional', count: Math.round(data.traditional) },
        { type: 'Community', count: Math.round(data.community) },
        { type: 'Modern', count: Math.round(data.modern) }
    ];
    
    // Set scales
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d.type))
        .range([0, innerWidth])
        .padding(0.3);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.count) * 1.1])
        .range([innerHeight, 0]);
    
    // Define colors based on category
    const colorScale = d3.scaleOrdinal()
        .domain(['Traditional', 'Community', 'Modern'])
        .range([
            '#d35400', // Orange - consistent across the app
            '#2ecc71', // Green - consistent across the app
            '#c51b8a'  // Pink - consistent across the app
        ]);
    
    // Add x-axis
    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .style('font-family', '"Libre Franklin", sans-serif')
        .style('font-size', '12px');
    
    // Add y-axis
    g.append('g')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('d')))
        .style('font-family', '"Libre Franklin", sans-serif')
        .style('font-size', '12px');
    
    // Add y-axis title
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 15)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-family', '"Libre Franklin", sans-serif')
        .style('fill', '#555')
        .text('Places Count');
    
    // Add bars with animation
    g.selectAll('.bar')
        .data(chartData)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.type))
        .attr('width', xScale.bandwidth())
        .attr('y', innerHeight)
        .attr('height', 0)
        .attr('fill', d => colorScale(d.type))
        .transition()
        .duration(800)
        .attr('y', d => yScale(d.count))
        .attr('height', d => innerHeight - yScale(d.count));
    
    // Add value labels
    g.selectAll('.value-label')
        .data(chartData)
        .enter().append('text')
        .attr('class', 'value-label')
        .attr('x', d => xScale(d.type) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.count) - 5)
        .attr('text-anchor', 'middle')
        .text(d => d.count)
        .style('font-family', '"Libre Franklin", sans-serif')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('opacity', 0)
        .transition()
        .duration(800)
        .style('opacity', 1);
}

// Create distribution chart
function createDistributionChart(selectedValue) {
    const chartContainer = document.getElementById('distribution-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 180;
    const margin = { top: 20, right: 20, bottom: 30, left: 25 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const svg = d3.select('#distribution-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Get the data for the current active layer
    let data, title;
    
    switch (activeLayer) {
        case 'traditional-score':
            data = window.distributionData.traditional;
            title = 'Traditional Index';
            break;
        case 'community-score':
            data = window.distributionData.community;
            title = 'Community Index';
            break;
        case 'modern-score':
            data = window.distributionData.modern;
            title = 'Modern Index';
            break;
        case 'overall-index':
        default:
            data = window.distributionData.overall;
            title = 'Third Place Index';
            break;
    }
    
    // Create histogram bins
    const numBins = 20;
    const x = d3.scaleLinear()
        .domain([0, 1])
        .range([0, innerWidth]);
    
    const histogram = d3.histogram()
        .domain(x.domain())
        .thresholds(x.ticks(numBins));
    
    const bins = histogram(data);
    
    // Y scale for the histogram
    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .range([innerHeight, 0]);
    
    // Add x axis
    g.append('g')
        .attr('class', 'distribution-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.1f')));
    
    // Add y axis
    g.append('g')
        .attr('class', 'distribution-axis')
        .call(d3.axisLeft(y).ticks(5));
    
    // Add bars
    g.selectAll('.distribution-bar')
        .data(bins)
        .enter()
        .append('rect')
        .attr('class', d => {
            // Check if the selected value falls within this bin
            if (selectedValue >= d.x0 && selectedValue < d.x1) {
                return 'distribution-bar selected-bar';
            }
            return 'distribution-bar';
        })
        .attr('x', d => x(d.x0) + 1) // +1 for spacing
        .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
        .attr('y', d => y(d.length))
        .attr('height', d => innerHeight - y(d.length));
    
    // Add a vertical line at the selected value
    g.append('line')
        .attr('class', 'distribution-marker')
        .attr('x1', x(selectedValue))
        .attr('x2', x(selectedValue))
        .attr('y1', 0)
        .attr('y2', innerHeight);
    
    // Add a label for the selected value
    g.append('text')
        .attr('x', x(selectedValue))
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('fill', '#ff3b30')
        .text(`${selectedValue.toFixed(2)}`);
}

// Create detailed place types chart
function createPlaceTypesChart(tractId) {
    const chartContainer = document.getElementById('place-types-chart');
    chartContainer.innerHTML = '';
    
    if (!placesData || !placesData.features || !tractId) {
        chartContainer.innerHTML = '<div class="no-data">No detailed place data available</div>';
        return;
    }
    
    // Get the selected tract feature from the tract data (same source as Places Breakdown chart)
    const selectedTractFeature = tractsData.features.find(f => f.properties.GEOID === tractId);
    if (!selectedTractFeature) {
        chartContainer.innerHTML = '<div class="no-data">Selected tract not found</div>';
        return;
    }
    
    // Get the place counts directly from the tract properties to ensure consistency with Places Breakdown
    const traditionalCount = Math.round(selectedTractFeature.properties.traditional_count || 0);
    const communityCount = Math.round(selectedTractFeature.properties.community_count || 0);
    const modernCount = Math.round(selectedTractFeature.properties.modern_count || 0);
    const totalPlaces = traditionalCount + communityCount + modernCount;
    
    if (totalPlaces === 0) {
        chartContainer.innerHTML = '<div class="no-data">No places found in this tract</div>';
        return;
    }
    
    // Get actual places within the tract to determine specific place types
    // We'll use these to distribute the counts proportionally
    let tractPlaces = placesData.features.filter(place => {
        return (place.properties.tract_id === tractId || place.properties.GEOID === tractId);
    });
    
    // If no direct matches, use spatial filtering with a small buffer to avoid including too many nearby places
    if (tractPlaces.length === 0 && selectedTractFeature.geometry) {
        try {
            const coordinates = selectedTractFeature.geometry.coordinates[0][0];
            
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            coordinates.forEach(coord => {
                minX = Math.min(minX, coord[0]);
                minY = Math.min(minY, coord[1]);
                maxX = Math.max(maxX, coord[0]);
                maxY = Math.max(maxY, coord[1]);
            });
            
            // Use a smaller buffer to avoid including too many places from neighboring tracts
            const buffer = 0.002; // Reduced from 0.005 to 0.002 (roughly 200m instead of 500m)
            minX -= buffer;
            minY -= buffer;
            maxX += buffer;
            maxY += buffer;
            
            placesData.features.forEach(place => {
                const coords = place.geometry.coordinates;
                if (coords[0] >= minX && coords[0] <= maxX && 
                    coords[1] >= minY && coords[1] <= maxY) {
                    tractPlaces.push(place);
                }
            });
        } catch (e) {
            console.error("Error in bounding box calculation:", e);
        }
    }
    
    // Create a distribution of place types
    const placeTypes = {};
    
    // If we have identified specific places, use them to determine the distribution
    if (tractPlaces.length > 0) {
        // First count the places by type and category
        const typesByCategory = {
            traditional: {},
            community: {},
            modern: {}
        };
        
        tractPlaces.forEach(place => {
            const type = place.properties.osm_value;
            const category = place.properties.category;
            
            if (!type || !category) return;
            
            if (!typesByCategory[category]) {
                typesByCategory[category] = {};
            }
            
            // Format display name
            const displayName = type.replace(/_/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
                
            if (!typesByCategory[category][displayName]) {
                typesByCategory[category][displayName] = 0;
            }
            
            typesByCategory[category][displayName]++;
        });
        
        // Now scale the counts to match the tract's official counts
        ['traditional', 'community', 'modern'].forEach(category => {
            const typesInCategory = typesByCategory[category];
            const officialCount = category === 'traditional' ? traditionalCount : 
                                 (category === 'community' ? communityCount : modernCount);
            
            if (officialCount === 0 || Object.keys(typesInCategory).length === 0) return;
            
            // Calculate the total count for this category from our sample
            let sampleTotal = 0;
            for (const type in typesInCategory) {
                sampleTotal += typesInCategory[type];
            }
            
            // Scale each type count, but track the total to ensure we match exactly
            let scaledTotal = 0;
            const scaledTypes = [];
            
            // First pass: calculate scaled values but don't round yet
            for (const type in typesInCategory) {
                const exactScaledCount = (typesInCategory[type] / sampleTotal) * officialCount;
                const roundedCount = Math.round(exactScaledCount);
                
                scaledTypes.push({
                    type,
                    exactCount: exactScaledCount,
                    roundedCount,
                    diff: exactScaledCount - roundedCount // how much rounding changed the value
                });
                
                scaledTotal += roundedCount;
            }
            
            // Adjust for rounding errors to ensure total matches exactly
            let diff = officialCount - scaledTotal;
            
            // Sort by the difference between exact and rounded values
            // This ensures we add/subtract from the types where rounding had the biggest impact
            if (diff > 0) {
                // We need to add some counts
                scaledTypes.sort((a, b) => b.diff - a.diff); // Sort descending by diff
                
                // Add the difference to the types with the largest negative diff
                for (let i = 0; i < diff && i < scaledTypes.length; i++) {
                    scaledTypes[i].roundedCount += 1;
                }
            } else if (diff < 0) {
                // We need to subtract some counts
                scaledTypes.sort((a, b) => a.diff - b.diff); // Sort ascending by diff
                
                // Subtract from the types with the largest positive diff
                for (let i = 0; i < -diff && i < scaledTypes.length; i++) {
                    // Don't allow counts to go below 1
                    if (scaledTypes[i].roundedCount > 1) {
                        scaledTypes[i].roundedCount -= 1;
                    }
                }
            }
            
            // Now add the adjusted counts to the final placeTypes object
            for (const item of scaledTypes) {
                if (item.roundedCount > 0) {
                    placeTypes[item.type] = {
                        count: item.roundedCount,
                        category: category
                    };
                }
            }
        });
    } else {
        // If no specific places found, create estimated type distribution
        // Create estimated place types distribution
        if (traditionalCount > 0) {
            placeTypes['Restaurants'] = {
                count: Math.round(traditionalCount * 0.6),
                category: 'traditional'
            };
            placeTypes['Cafes'] = {
                count: Math.round(traditionalCount * 0.3),
                category: 'traditional'
            };
            placeTypes['Bars'] = {
                count: Math.round(traditionalCount * 0.1),
                category: 'traditional'
            };
        }
        
        if (communityCount > 0) {
            placeTypes['Places of Worship'] = {
                count: Math.round(communityCount * 0.5),
                category: 'community'
            };
            placeTypes['Community Centers'] = {
                count: Math.round(communityCount * 0.3),
                category: 'community'
            };
            placeTypes['Libraries'] = {
                count: Math.round(communityCount * 0.2),
                category: 'community'
            };
        }
        
        if (modernCount > 0) {
            placeTypes['Coworking Spaces'] = {
                count: Math.round(modernCount * 0.5),
                category: 'modern'
            };
            placeTypes['Marketplaces'] = {
                count: Math.round(modernCount * 0.5),
                category: 'modern'
            };
        }
    }
    
    // Convert to array and sort by count
    const placeTypesArray = Object.entries(placeTypes)
        .map(([name, data]) => ({
            name,
            count: data.count,
            category: data.category
        }))
        .filter(item => item.count > 0) // Filter out any with zero counts
        .sort((a, b) => b.count - a.count);
    
    if (placeTypesArray.length === 0) {
        chartContainer.innerHTML = '<div class="no-data">No detailed place data available</div>';
        return;
    }
    
    // Create styled list
    const listContainer = document.createElement('div');
    listContainer.className = 'place-types-list';
    
    // Add title element inside the list
    const titleElement = document.createElement('h4');
    titleElement.className = 'place-types-title';
    titleElement.textContent = 'Detailed Place Types';
    listContainer.appendChild(titleElement);
    
    // Create category totals element
    const totalsElement = document.createElement('div');
    totalsElement.className = 'place-types-totals';
    
    // Calculate total places from the category totals, not the individual types sum
    // This ensures it's consistent with the Places Breakdown chart
    const calculatedTotal = traditionalCount + communityCount + modernCount;
    
    totalsElement.innerHTML = `
        <small>
            Total places: ${calculatedTotal}
            (Traditional: ${traditionalCount}, 
             Community: ${communityCount},
             Modern: ${modernCount})
        </small>
    `;
    listContainer.appendChild(totalsElement);
    
    // Add the items
    placeTypesArray.forEach(type => {
        const itemElement = document.createElement('div');
        itemElement.className = 'place-type-item';
        
        // Get the category color
        let color;
        switch(type.category) {
            case 'traditional': color = '#d35400'; break; // Orange - consistent across the app
            case 'community': color = '#2ecc71'; break;   // Green - consistent across the app
            case 'modern': color = '#c51b8a'; break;      // Pink - consistent across the app
            default: color = '#999';
        }
        
        itemElement.innerHTML = `
            <div class="place-type-item-content">
                <div class="place-type-name" style="color: ${color};">${type.name}</div>
                <div class="place-type-count">${type.count}</div>
            </div>
        `;
        
        listContainer.appendChild(itemElement);
    });
    
    chartContainer.appendChild(listContainer);
} 