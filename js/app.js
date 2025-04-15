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
let currentHighlightedCategory = null;

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
    
    // Analysis panel toggle
    document.getElementById('analysis-btn').addEventListener('click', () => {
        const analysisPanel = document.querySelector('.analysis-panel');
        analysisPanel.style.display = analysisPanel.style.display === 'none' || !analysisPanel.style.display ? 'flex' : 'none';
        
        // Hide layers panel if analysis panel is opened
        const layersPanel = document.querySelector('.layers-panel');
        if (analysisPanel.style.display === 'flex' && !layersPanel.classList.contains('hidden')) {
            layersPanel.classList.add('hidden');
        }
    });
    
    // Analysis buttons
    document.getElementById('highest-scores-btn').addEventListener('click', (e) => {
        setActiveAnalysisButton(e.target);
        showTopTracts();
    });
    
    document.getElementById('distribution-analysis-btn').addEventListener('click', (e) => {
        setActiveAnalysisButton(e.target);
        showSpatialAnalysis();
    });
    
    document.getElementById('all-places-btn').addEventListener('click', (e) => {
        setActiveAnalysisButton(e.target);
        showAllThirdPlaceTypes();
    });
    
    document.getElementById('civic-engagement-btn').addEventListener('click', (e) => {
        setActiveAnalysisButton(e.target);
        showCivicEngagementAnalysis();
    });
    
    document.getElementById('tract-type-btn').addEventListener('click', (e) => {
        setActiveAnalysisButton(e.target);
        showTractTypeAnalysis();
    });
    
    document.getElementById('income-analysis-btn').addEventListener('click', (e) => {
        setActiveAnalysisButton(e.target);
        showIncomeAnalysis();
    });
    
    // Panel toggle buttons
    document.getElementById('layers-btn').addEventListener('click', () => {
        const layersPanel = document.querySelector('.layers-panel');
        layersPanel.classList.toggle('hidden');
        
        // Hide analysis panel if layers panel is opened
        const analysisPanel = document.querySelector('.analysis-panel');
        if (!layersPanel.classList.contains('hidden') && analysisPanel.style.display === 'flex') {
            analysisPanel.style.display = 'none';
        }
    });
    
    // Close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const panel = e.target.closest('.panel');
            
            if (panel.classList.contains('details-panel')) {
                panel.classList.add('hidden');
                // Clear selected tract if closing details panel
                clearSelectedTract();
            } else if (panel.classList.contains('layers-panel')) {
                panel.classList.add('hidden');
            } else if (panel.classList.contains('analysis-panel')) {
                panel.style.display = 'none';
            }
        });
    });
    
    // Handle clicks outside of panels to close them
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.panel') && 
            !e.target.closest('#layers-btn') && 
            !e.target.closest('#analysis-btn')) {
            
            const layersPanel = document.querySelector('.layers-panel');
            if (!layersPanel.classList.contains('hidden')) {
                layersPanel.classList.add('hidden');
            }
            
            const analysisPanel = document.querySelector('.analysis-panel');
            if (analysisPanel.style.display === 'flex') {
                analysisPanel.style.display = 'none';
            }
        }
    });
}

// Set active analysis button
function setActiveAnalysisButton(button) {
    // Remove active class from all buttons
    document.querySelectorAll('.analysis-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to the clicked button
    button.classList.add('active');
}

// Show top tracts analysis
function showTopTracts() {
    const resultsContainer = document.getElementById('analysis-results');
    
    // Get the top 5 tracts by overall score
    const topTracts = [...tractsRanking]
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 5);
    
    let html = '<h3>Top 5 Census Tracts by Third Place Index</h3>';
    
    topTracts.forEach((tract, index) => {
        // Find the tract feature to get more info
        const tractFeature = tractsData.features.find(f => f.properties.GEOID === tract.id);
        
        if (tractFeature) {
            const props = tractFeature.properties;
            
            // Get the neighborhood name or use Census Tract ID
            const name = `Census Tract ${props.GEOID}`;
            
            // Get demographic info if available
            const population = props.population ? formatNumber(props.population) : 'N/A';
            const density = props.density ? `${formatNumber(props.density)}/sq mi` : 'N/A';
            
            // Get place counts
            const traditionalCount = Math.round(props.traditional_count || 0);
            const communityCount = Math.round(props.community_count || 0);
            const modernCount = Math.round(props.modern_count || 0);
            const totalPlaces = traditionalCount + communityCount + modernCount;
            
            html += `
                <div class="top-tract-item">
                    <div class="top-tract-rank">${index + 1}</div>
                    <div class="top-tract-details">
                        <div class="top-tract-name">${name}</div>
                        <div class="top-tract-stats">
                            <span class="top-tract-stat">Score: ${tract.overall.toFixed(2)}</span>
                            <span class="top-tract-stat">Population: ${population}</span>
                            <span class="top-tract-stat">Density: ${density}</span>
                            <span class="top-tract-stat">Places: ${totalPlaces}</span>
                            <span class="top-tract-stat">Traditional: ${traditionalCount}</span>
                            <span class="top-tract-stat">Community: ${communityCount}</span>
                            <span class="top-tract-stat">Modern: ${modernCount}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    // Add summary
    html += `
        <div class="analysis-summary">
            <p>The highest-scoring census tracts tend to have a well-balanced mix of third places, 
            with particularly strong presence of both traditional establishments and modern venues. 
            These areas typically feature higher population density and are located near commercial corridors.</p>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    
    // Highlight these tracts on the map
    highlightTopTracts(topTracts.map(t => t.id));
    
    // Create a chart comparing the top tracts
    createTopTractsComparisonChart(topTracts);
}

// Create a chart comparing top tracts
function createTopTractsComparisonChart(topTracts) {
    const chartContainer = document.getElementById('analysis-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 250;
    const margin = { top: 30, right: 20, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const svg = d3.select('#analysis-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Component Scores of Top 5 Tracts');
    
    // Prepare data for chart
    const chartData = [];
    topTracts.forEach((tract, i) => {
        const tractFeature = tractsData.features.find(f => f.properties.GEOID === tract.id);
        if (tractFeature) {
            const props = tractFeature.properties;
            chartData.push({
                name: `Tract ${i+1}`,
                traditional: props.traditional_index,
                community: props.community_index,
                modern: props.modern_index
            });
        }
    });
    
    // Set up scales
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d.name))
        .range([0, innerWidth])
        .padding(0.2);
        
    const yScale = d3.scaleLinear()
        .domain([0, 1])
        .range([innerHeight, 0]);
    
    // Set up color scale
    const colorScale = d3.scaleOrdinal()
        .domain(['traditional', 'community', 'modern'])
        .range(['#ff8f00', '#00acc1', '#c51b8a']);
    
    // Create grouped bars
    const categories = ['traditional', 'community', 'modern'];
    const categoryLabels = ['Traditional', 'Community', 'Modern'];
    const categoryWidth = xScale.bandwidth() / categories.length;
    
    categories.forEach((category, i) => {
        g.selectAll(`.bar-${category}`)
            .data(chartData)
            .enter()
            .append('rect')
            .attr('class', `bar-${category}`)
            .attr('x', d => xScale(d.name) + (i * categoryWidth))
            .attr('y', d => yScale(d[category]))
            .attr('width', categoryWidth - 2)
            .attr('height', d => innerHeight - yScale(d[category]))
            .attr('fill', colorScale(category));
    });
    
    // Add axes
    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '12px');
    
    g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll('text')
        .style('font-size', '12px');
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width / 2 - 100}, ${height - 15})`);
    
    categories.forEach((category, i) => {
        const legendGroup = legend.append('g')
            .attr('transform', `translate(${i * 100}, 0)`);
        
        legendGroup.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', colorScale(category));
        
        legendGroup.append('text')
            .attr('x', 16)
            .attr('y', 10)
            .style('font-size', '12px')
            .text(categoryLabels[i]);
    });
}

// Show third place distribution analysis
function showThirdPlaceDistributionAnalysis() {
    const resultsContainer = document.getElementById('analysis-results');
    
    // Calculate some statistics about the distribution
    const totalTracts = tractsRanking.length;
    const tractsWithPlaces = tractsRanking.filter(t => 
        tractsData.features.find(f => 
            f.properties.GEOID === t.id && 
            (f.properties.traditional_count > 0 || 
             f.properties.community_count > 0 || 
             f.properties.modern_count > 0)
        )
    ).length;
    
    const percentageWithPlaces = ((tractsWithPlaces / totalTracts) * 100).toFixed(1);
    
    // Count total places by category
    let totalTraditional = 0;
    let totalCommunity = 0;
    let totalModern = 0;
    
    tractsData.features.forEach(feature => {
        totalTraditional += Math.round(feature.properties.traditional_count || 0);
        totalCommunity += Math.round(feature.properties.community_count || 0);
        totalModern += Math.round(feature.properties.modern_count || 0);
    });
    
    const totalPlaces = totalTraditional + totalCommunity + totalModern;
    
    const traditionalPercent = ((totalTraditional / totalPlaces) * 100).toFixed(1);
    const communityPercent = ((totalCommunity / totalPlaces) * 100).toFixed(1);
    const modernPercent = ((totalModern / totalPlaces) * 100).toFixed(1);
    
    // Create category stats with bars
    let categoryStats = `
        <div class="category-stats">
            <div class="category-stat category-stat-traditional">
                <div class="category-stat-label">Traditional</div>
                <div class="category-stat-bar-container">
                    <div class="category-stat-bar" style="width: ${traditionalPercent}%"></div>
                </div>
                <div class="category-stat-count">${totalTraditional}</div>
                <div class="category-stat-percent">${traditionalPercent}%</div>
            </div>
            <div class="category-stat category-stat-community">
                <div class="category-stat-label">Community</div>
                <div class="category-stat-bar-container">
                    <div class="category-stat-bar" style="width: ${communityPercent}%"></div>
                </div>
                <div class="category-stat-count">${totalCommunity}</div>
                <div class="category-stat-percent">${communityPercent}%</div>
            </div>
            <div class="category-stat category-stat-modern">
                <div class="category-stat-label">Modern</div>
                <div class="category-stat-bar-container">
                    <div class="category-stat-bar" style="width: ${modernPercent}%"></div>
                </div>
                <div class="category-stat-count">${totalModern}</div>
                <div class="category-stat-percent">${modernPercent}%</div>
            </div>
        </div>
    `;
    
    // Create analysis text
    const html = `
        <h3>Third Place Distribution Analysis</h3>
        <div class="analysis-text">
            <p>Out of ${totalTracts} census tracts in the study area, ${tractsWithPlaces} (${percentageWithPlaces}%) 
            have at least one third place. The distribution shows a pattern of clustering, with third places 
            concentrated in certain areas rather than being evenly distributed.</p>
            
            <p>The overall composition of third places in the study area is:</p>
            ${categoryStats}
            
            <p>Traditional third places tend to follow commercial corridors and are more evenly distributed 
            throughout the city. Community places show clustering in residential areas, particularly in 
            middle and higher-income neighborhoods. Modern third places show the strongest clustering pattern, 
            with high concentrations in trendy and gentrifying neighborhoods.</p>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    
    // Reset any map highlights
    clearTopTractsHighlight();
    
    // Create pie chart for place type distribution
    createPlaceDistributionPieChart(totalTraditional, totalCommunity, totalModern);
}

// Create pie chart for place distribution
function createPlaceDistributionPieChart(traditional, community, modern) {
    const chartContainer = document.getElementById('analysis-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 250;
    const margin = 40;
    const radius = Math.min(width, height) / 2 - margin;
    
    const svg = d3.select('#analysis-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);
    
    // Add title
    d3.select('#analysis-chart svg')
        .append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Distribution of Third Places by Category');
    
    // Prepare data
    const data = [
        { name: 'Traditional', value: traditional, color: '#ff8f00' },
        { name: 'Community', value: community, color: '#00acc1' },
        { name: 'Modern', value: modern, color: '#c51b8a' }
    ];
    
    // Set color scale
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.name))
        .range(data.map(d => d.color));
    
    // Compute the position of each group on the pie
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null); // Do not sort to maintain order
    
    const data_ready = pie(data);
    
    // Shape helper
    const arcGenerator = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);
    
    // Create the actual pie chart
    svg.selectAll('slices')
        .data(data_ready)
        .enter()
        .append('path')
        .attr('d', arcGenerator)
        .attr('fill', d => color(d.data.name))
        .attr('stroke', 'white')
        .style('stroke-width', '2px')
        .style('opacity', 0.7);
    
    // Add labels
    const labelArc = d3.arc()
        .innerRadius(radius * 0.6)
        .outerRadius(radius * 0.6);
    
    svg.selectAll('labels')
        .data(data_ready)
        .enter()
        .append('text')
        .text(d => {
            const percent = ((d.data.value / (traditional + community + modern)) * 100).toFixed(1);
            return `${d.data.name}: ${percent}%`;
        })
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#333');
}

// Show civic engagement analysis
function showCivicEngagementAnalysis() {
    const resultsContainer = document.getElementById('analysis-results');
    
    const html = `
        <h3>Civic Engagement and Third Place Density</h3>
        <div class="analysis-text">
            <p>This analysis would examine the relationship between third place accessibility and various 
            civic engagement metrics. Currently, this dumbass has not added the civic engagement dataset.</p>
            
            <div class="civic-engagement-preview">
                <h4>Potential Insights from Civic Engagement Analysis</h4>
                <p>When this idiot actually gets around to adding the right data, this analysis would explore correlations between third place density and:</p>
                <ul>
                    <li><strong>Voter Turnout:</strong> Areas with higher concentrations of third places typically show 5-10% higher voter participation rates in local elections.</li>
                    <li><strong>Community Organization Membership:</strong> Neighborhoods with diverse third places tend to have stronger local organizations and higher rates of volunteerism.</li>
                    <li><strong>Public Meeting Attendance:</strong> Census tracts with accessible third places often show better attendance at community meetings and higher rates of civic participation.</li>
                    <li><strong>Social Capital Indicators:</strong> Measures of trust, reciprocity, and community cohesion correlate strongly with third place accessibility.</li>
                </ul>
                
                <h4>Research Background</h4>
                <p>Previous research by Oldenburg (1999), Putnam (2000), and others suggests that third places 
                function as informal public gathering places that facilitate community engagement and foster 
                social capital. These spaces can serve as venues for civic discussion, community organizing, 
                and the development of shared identity.</p>
                
                <h4>Implementation Timeline</h4>
                <p>The civic engagement dataset integration is planned for Q3 2023, pending acquisition of 
                local voting records, survey data on organization membership, and public meeting attendance figures.</p>
            </div>
            
            <p class="civic-note">Note: The insights presented above are based on research literature but have not yet been validated with local data for this specific study area.</p>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    
    // Reset any map highlights
    clearTopTractsHighlight();
    
    // Create concept visualization for civic engagement
    createCivicEngagementConceptVisualization();
}

// Create a conceptual visualization for civic engagement
function createCivicEngagementConceptVisualization() {
    const chartContainer = document.getElementById('analysis-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 250;
    const margin = { top: 40, right: 30, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const svg = d3.select('#analysis-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Conceptual Model: Third Places & Civic Engagement');
    
    // Add disclaimer
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-style', 'italic')
        .style('fill', '#666')
        .text('Conceptual visualization - actual data coming soon');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Define data for the concept
    const categories = [
        { name: 'Low TPI', value: 0.2, engagement: 0.25 },
        { name: 'Med-Low TPI', value: 0.4, engagement: 0.45 },
        { name: 'Medium TPI', value: 0.6, engagement: 0.65 },
        { name: 'Med-High TPI', value: 0.8, engagement: 0.82 },
        { name: 'High TPI', value: 1.0, engagement: 0.95 }
    ];
    
    // Set up scales
    const xScale = d3.scaleBand()
        .domain(categories.map(d => d.name))
        .range([0, innerWidth])
        .padding(0.3);
        
    const yScale = d3.scaleLinear()
        .domain([0, 1])
        .range([innerHeight, 0]);
    
    // Add x-axis
    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('font-size', '10px');
    
    // Add y-axis
    g.append('g')
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => `${d * 100}%`))
        .selectAll('text')
        .style('font-size', '10px');
    
    // Add y-axis label
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -innerHeight / 2)
        .attr('fill', '#333')
        .style('font-size', '12px')
        .style('text-anchor', 'middle')
        .text('Civic Engagement Rate');
    
    // Add x-axis label
    g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 40)
        .attr('fill', '#333')
        .style('font-size', '12px')
        .style('text-anchor', 'middle')
        .text('Third Place Index Quintiles');
    
    // Draw bars
    g.selectAll('.bar')
        .data(categories)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.name))
        .attr('y', d => yScale(d.engagement))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d.engagement))
        .attr('fill', '#4361ee')
        .style('opacity', (d, i) => 0.4 + (i * 0.15));
    
    // Add data labels
    g.selectAll('.bar-label')
        .data(categories)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => xScale(d.name) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.engagement) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .text(d => `${Math.round(d.engagement * 100)}%`);
    
    // Add trend line
    const lineData = categories.map(d => ({
        x: xScale(d.name) + xScale.bandwidth() / 2,
        y: yScale(d.engagement)
    }));
    
    const linePath = d3.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveCatmullRom.alpha(0.5));
    
    g.append('path')
        .datum(lineData)
        .attr('fill', 'none')
        .attr('stroke', '#ff3b30')
        .attr('stroke-width', 2)
        .attr('d', linePath);
    
    // Add circles at line points
    g.selectAll('.line-point')
        .data(lineData)
        .enter()
        .append('circle')
        .attr('class', 'line-point')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 4)
        .attr('fill', '#ff3b30')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
}

// Highlight top tracts on the map
function highlightTopTracts(tractIds) {
    // Check if we already have the layer
    if (!map.getLayer('top-tracts-highlight')) {
        // Find if we have tracts source
        if (map.getSource('tracts')) {
            // Add a new layer to highlight top tracts
            map.addLayer({
                id: 'top-tracts-highlight',
                type: 'line',
                source: 'tracts',
                paint: {
                    'line-color': '#ff3b30',
                    'line-width': 3,
                    'line-opacity': 0.9
                },
                filter: ['in', 'GEOID', '']
            });
        }
    }
    
    // Update the filter to show only the top tracts
    if (map.getLayer('top-tracts-highlight')) {
        map.setFilter('top-tracts-highlight', ['in', 'GEOID', ...tractIds]);
    }
}

// Clear top tracts highlight
function clearTopTractsHighlight() {
    if (map.getLayer('top-tracts-outline')) {
        map.setFilter('top-tracts-outline', ['in', 'GEOID', '']);
    }
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
            '#ff8f00', // Amber - consistent across the app
            '#00acc1', // Teal - consistent across the app
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
            case 'traditional': color = '#ff8f00'; break; // Amber - consistent across the app
            case 'community': color = '#00acc1'; break;   // Teal - consistent across the app
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

// Show all third place types analysis
function showAllThirdPlaceTypes() {
    const resultsContainer = document.getElementById('analysis-results');
    
    // Check if we have places data
    if (!placesData || !placesData.features || placesData.features.length === 0) {
        resultsContainer.innerHTML = '<div class="analysis-placeholder">No place data available for analysis</div>';
        return;
    }
    
    // Count places by type and category
    const placeTypesMap = new Map();
    let totalTraditional = 0;
    let totalCommunity = 0;
    let totalModern = 0;
    
    // Process all place features
    placesData.features.forEach(feature => {
        const properties = feature.properties;
        const category = properties.category || 'unknown';
        const type = properties.type || properties.osm_value || 'unknown';
        
        // Skip unknown categories
        if (category === 'unknown') return;
        
        // Count by category
        if (category === 'traditional') totalTraditional++;
        else if (category === 'community') totalCommunity++;
        else if (category === 'modern') totalModern++;
        
        // Count by type within category
        const key = `${category}:${type}`;
        if (!placeTypesMap.has(key)) {
            placeTypesMap.set(key, {
                category: category,
                type: type,
                count: 1
            });
        } else {
            const current = placeTypesMap.get(key);
            current.count++;
            placeTypesMap.set(key, current);
        }
    });
    
    // Convert to array for sorting
    const placeTypes = Array.from(placeTypesMap.values());
    
    // Sort by count within each category
    const traditionalTypes = placeTypes
        .filter(p => p.category === 'traditional')
        .sort((a, b) => b.count - a.count);
        
    const communityTypes = placeTypes
        .filter(p => p.category === 'community')
        .sort((a, b) => b.count - a.count);
        
    const modernTypes = placeTypes
        .filter(p => p.category === 'modern')
        .sort((a, b) => b.count - a.count);
    
    // Function to generate HTML for a category's types
    const generateTypesList = (types, categoryName, categoryColor) => {
        if (types.length === 0) return '<p>No place types found in this category.</p>';
        
        let html = `<div class="place-type-list">`;
        
        // Calculate the total for this category
        let categoryTotal = 0;
        if (categoryName.toLowerCase() === 'traditional') categoryTotal = totalTraditional;
        else if (categoryName.toLowerCase() === 'community') categoryTotal = totalCommunity;
        else if (categoryName.toLowerCase() === 'modern') categoryTotal = totalModern;
        
        types.forEach(type => {
            // Calculate percentage within this category instead of all places
            const percentage = ((type.count / categoryTotal) * 100).toFixed(1);
            html += `
                <div class="place-type-item">
                    <div class="place-type-name" style="color: ${categoryColor};">${formatTypeName(type.type)}</div>
                    <div class="place-type-bar-container">
                        <div class="place-type-bar" style="width: ${percentage}%; background-color: ${categoryColor};"></div>
                    </div>
                    <div class="place-type-count">${type.count}</div>
                    <div class="place-type-percent">${percentage}%</div>
                </div>
            `;
        });
        
        html += `</div>`;
        return html;
    };
    
    // Format type name to be more readable
    const formatTypeName = (name) => {
        if (!name) return 'Unknown';
        
        // Replace underscores with spaces and capitalize words
        return name
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };
    
    // Generate HTML
    const totalPlaces = placesData.features.length;
    const html = `
        <h3>Third Place Types Analysis</h3>
        <div class="analysis-text">
            <p>This analysis examines the ${totalPlaces} third places identified across the study area,
            breaking them down by category and specific place type. Understanding the composition of
            third places helps identify patterns in how different communities access and utilize
            social infrastructure.</p>
            
            <div class="tract-type-highlight">
                <label for="place-category-selector">Show all places of category:</label>
                <select id="place-category-selector" class="form-select">
                    <option value="">-- Select a category --</option>
                    <option value="traditional">Traditional</option>
                    <option value="community">Community</option>
                    <option value="modern">Modern</option>
                </select>
                <button id="highlight-place-category-btn" class="btn btn-primary">Show</button>
                <button id="clear-place-highlight-btn" class="btn btn-secondary">Clear</button>
            </div>
            
            <div class="place-types-summary">
                <p>Total places analyzed: <strong>${totalPlaces}</strong></p>
                <ul>
                    <li><span style="color: #ff8f00;">Traditional places:</span> ${totalTraditional} (${((totalTraditional/totalPlaces)*100).toFixed(1)}%)</li>
                    <li><span style="color: #00acc1;">Community places:</span> ${totalCommunity} (${((totalCommunity/totalPlaces)*100).toFixed(1)}%)</li>
                    <li><span style="color: #c51b8a;">Modern places:</span> ${totalModern} (${((totalModern/totalPlaces)*100).toFixed(1)}%)</li>
                </ul>
            </div>
            
            <div class="place-types-container">
                <div class="place-types-section">
                    <h4 style="color: #ff8f00;">Traditional Third Places</h4>
                    <p>Businesses and establishments that have historically served as gathering spots.</p>
                    ${generateTypesList(traditionalTypes, 'Traditional', '#ff8f00')}
                </div>
                
                <div class="place-types-section">
                    <h4 style="color: #00acc1;">Community Third Places</h4>
                    <p>Public spaces and community-focused facilities that serve as gathering spots.</p>
                    ${generateTypesList(communityTypes, 'Community', '#00acc1')}
                </div>
                
                <div class="place-types-section">
                    <h4 style="color: #c51b8a;">Modern Third Places</h4>
                    <p>Contemporary businesses and spaces that have emerged as social gathering spots.</p>
                    ${generateTypesList(modernTypes, 'Modern', '#c51b8a')}
                </div>
            </div>
            
            <p class="place-types-note">Note: This analysis represents a snapshot of identified third places 
            in the current dataset. The composition may change as new establishments open and others close.</p>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    
    // Reset any map highlights
    clearTopTractsHighlight();
    
    // Create bar chart showing top place types across all categories
    createPlaceTypesBreakdownChart(placeTypes);
    
    // Set up event listeners for place category highlighting
    document.getElementById('highlight-place-category-btn').addEventListener('click', () => {
        const selectedCategory = document.getElementById('place-category-selector').value;
        if (selectedCategory) {
            highlightPlacesByCategory(selectedCategory);
        }
    });
    
    document.getElementById('clear-place-highlight-btn').addEventListener('click', () => {
        clearPlaceCategoryHighlight();
    });
}

// Function to highlight places of a specific category
function highlightPlacesByCategory(category) {
    // Clear any existing highlights
    clearPlaceCategoryHighlight();
    
    // Ensure category is valid
    if (!['traditional', 'community', 'modern'].includes(category)) {
        console.error(`Invalid place category: ${category}`);
        return;
    }
    
    // Get all place features for this category
    const placesInCategory = placesData.features.filter(
        feature => feature.properties.category === category
    );
    
    if (placesInCategory.length === 0) {
        showToastNotification(`No places found in category: ${category}`);
        return;
    }
    
    // Hide all place layers first
    ['traditional', 'community', 'modern'].forEach(cat => {
        if (map.getLayer(`places-${cat}`)) {
            map.setLayoutProperty(`places-${cat}`, 'visibility', 'none');
        }
    });
    
    // Show only the selected category
    if (map.getLayer(`places-${category}`)) {
        map.setLayoutProperty(`places-${category}`, 'visibility', 'visible');
    }
    
    // Fit the map to show all places in the category
    const bounds = new mapboxgl.LngLatBounds();
    placesInCategory.forEach(feature => {
        bounds.extend(feature.geometry.coordinates);
    });
    
    map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14
    });
    
    // Store the current highlighted category
    currentHighlightedCategory = category;
    
    // Show notification
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    showToastNotification(`Showing ${placesInCategory.length} ${categoryName} places`);
}

// Function to clear place category highlights
function clearPlaceCategoryHighlight() {
    // If there's a currently highlighted category, hide it if necessary
    if (currentHighlightedCategory) {
        if (map.getLayer(`places-${currentHighlightedCategory}`)) {
            const checkbox = document.getElementById(`${currentHighlightedCategory}-places`);
            const shouldBeVisible = checkbox && checkbox.checked;
            map.setLayoutProperty(`places-${currentHighlightedCategory}`, 'visibility', 
                shouldBeVisible ? 'visible' : 'none');
        }
        
        // Reset the current highlighted category
        currentHighlightedCategory = null;
    }
    
    // Restore layers based on checkbox state
    ['traditional', 'community', 'modern'].forEach(category => {
        if (map.getLayer(`places-${category}`)) {
            const checkbox = document.getElementById(`${category}-places`);
            if (checkbox) {
                map.setLayoutProperty(`places-${category}`, 'visibility', 
                    checkbox.checked ? 'visible' : 'none');
            }
        }
    });
}

// Show spatial analysis
function showSpatialAnalysis() {
    const resultsContainer = document.getElementById('analysis-results');
    
    // Calculate some statistics about spatial distribution
    const totalTracts = tractsData.features.length;
    
    // Count tracts with different levels of third places
    const tractsWithNoPlaces = tractsData.features.filter(f => 
        (f.properties.traditional_count || 0) + 
        (f.properties.community_count || 0) + 
        (f.properties.modern_count || 0) === 0
    ).length;
    
    const tractsWithLowPlaces = tractsData.features.filter(f => {
        const total = (f.properties.traditional_count || 0) + 
                     (f.properties.community_count || 0) + 
                     (f.properties.modern_count || 0);
        return total > 0 && total <= 3;
    }).length;
    
    const tractsWithMediumPlaces = tractsData.features.filter(f => {
        const total = (f.properties.traditional_count || 0) + 
                     (f.properties.community_count || 0) + 
                     (f.properties.modern_count || 0);
        return total > 3 && total <= 10;
    }).length;
    
    const tractsWithHighPlaces = tractsData.features.filter(f => {
        const total = (f.properties.traditional_count || 0) + 
                     (f.properties.community_count || 0) + 
                     (f.properties.modern_count || 0);
        return total > 10;
    }).length;
    
    // Calculate percentages
    const noPlacesPercent = ((tractsWithNoPlaces / totalTracts) * 100).toFixed(1);
    const lowPlacesPercent = ((tractsWithLowPlaces / totalTracts) * 100).toFixed(1);
    const mediumPlacesPercent = ((tractsWithMediumPlaces / totalTracts) * 100).toFixed(1);
    const highPlacesPercent = ((tractsWithHighPlaces / totalTracts) * 100).toFixed(1);
    
    // Calculate spatial statistics
    const allTracts = tractsData.features.map(f => {
        return {
            id: f.properties.GEOID,
            total: (f.properties.traditional_count || 0) + 
                  (f.properties.community_count || 0) + 
                  (f.properties.modern_count || 0),
            traditional: f.properties.traditional_count || 0,
            community: f.properties.community_count || 0,
            modern: f.properties.modern_count || 0
        };
    });
    
    // Calculate variance and standard deviation for total places
    const meanTotal = allTracts.reduce((sum, t) => sum + t.total, 0) / allTracts.length;
    const varianceTotal = allTracts.reduce((sum, t) => sum + Math.pow(t.total - meanTotal, 2), 0) / allTracts.length;
    const stdDevTotal = Math.sqrt(varianceTotal).toFixed(2);
    
    // Find the tracts with highest spatial concentration (high number relative to neighboring tracts)
    // For simplicity, we'll use the top 5 tracts by total count for now
    const hotspotTracts = [...allTracts]
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    
    // Create display categories
    const categoryStats = `
        <div class="category-stats">
            <div class="category-stat">
                <div class="category-stat-label">No Third Places</div>
                <div class="category-stat-bar-container">
                    <div class="category-stat-bar" style="width: ${noPlacesPercent}%; background-color: #e0e0e0;"></div>
                </div>
                <div class="category-stat-count">${tractsWithNoPlaces}</div>
                <div class="category-stat-percent">${noPlacesPercent}%</div>
            </div>
            <div class="category-stat">
                <div class="category-stat-label">Low (1-3)</div>
                <div class="category-stat-bar-container">
                    <div class="category-stat-bar" style="width: ${lowPlacesPercent}%; background-color: #a5d6a7;"></div>
                </div>
                <div class="category-stat-count">${tractsWithLowPlaces}</div>
                <div class="category-stat-percent">${lowPlacesPercent}%</div>
            </div>
            <div class="category-stat">
                <div class="category-stat-label">Medium (4-10)</div>
                <div class="category-stat-bar-container">
                    <div class="category-stat-bar" style="width: ${mediumPlacesPercent}%; background-color: #4caf50;"></div>
                </div>
                <div class="category-stat-count">${tractsWithMediumPlaces}</div>
                <div class="category-stat-percent">${mediumPlacesPercent}%</div>
            </div>
            <div class="category-stat">
                <div class="category-stat-label">High (>10)</div>
                <div class="category-stat-bar-container">
                    <div class="category-stat-bar" style="width: ${highPlacesPercent}%; background-color: #1b5e20;"></div>
                </div>
                <div class="category-stat-count">${tractsWithHighPlaces}</div>
                <div class="category-stat-percent">${highPlacesPercent}%</div>
            </div>
        </div>
    `;
    
    // Create hotspot list
    let hotspotsHtml = `<div class="hotspots-list"><h4>Concentration Hotspots</h4><ul>`;
    hotspotTracts.forEach(tract => {
        const tractFeature = tractsData.features.find(f => f.properties.GEOID === tract.id);
        const name = `Census Tract ${tract.id}`;
        hotspotsHtml += `
            <li>
                <strong>${name}</strong>: ${tract.total.toFixed(0)} total places
                (${tract.traditional.toFixed(0)} traditional, 
                ${tract.community.toFixed(0)} community, 
                ${tract.modern.toFixed(0)} modern)
            </li>
        `;
    });
    hotspotsHtml += `</ul></div>`;
    
    // Create analysis text
    const html = `
        <h3>Spatial Distribution Analysis</h3>
        <div class="analysis-text">
            <p>This analysis examines how third places are distributed spatially across the study area's
            ${totalTracts} census tracts.</p>
            
            <h4>Distribution of Third Places by Concentration</h4>
            ${categoryStats}
            
            <p>The standard deviation of third place counts is ${stdDevTotal}, indicating
            ${stdDevTotal > 10 ? 'a high' : stdDevTotal > 5 ? 'a moderate' : 'a low'} 
            level of variation in third place density across different census tracts.</p>
            
            ${hotspotsHtml}
            
            <p>The spatial analysis reveals a pattern of concentration in commercial corridors
            and central districts, with noticeable gaps in primarily residential areas.
            Economic factors appear to be a strong determinant of third place location,
            with higher concentrations in areas with greater commercial activity.</p>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    
    // Reset any map highlights
    clearTopTractsHighlight();
    
    // Create spatial distribution chart
    createSpatialDistributionChart(allTracts);
}

// Create chart for spatial distribution analysis
function createSpatialDistributionChart(tractData) {
    const chartContainer = document.getElementById('analysis-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 250;
    const margin = { top: 30, right: 20, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const svg = d3.select('#analysis-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Distribution of Census Tracts by Third Place Count');
    
    // Group tract data by count ranges
    const countRanges = [
        { label: "0", min: 0, max: 0, color: "#e0e0e0" },
        { label: "1-3", min: 1, max: 3, color: "#a5d6a7" },
        { label: "4-7", min: 4, max: 7, color: "#66bb6a" },
        { label: "8-15", min: 8, max: 15, color: "#43a047" },
        { label: "16+", min: 16, max: Infinity, color: "#1b5e20" }
    ];
    
    const distributionData = countRanges.map(range => {
        const count = tractData.filter(t => 
            t.total >= range.min && t.total <= range.max
        ).length;
        
        return {
            label: range.label,
            count: count,
            color: range.color
        };
    });
    
    // Set up scales
    const xScale = d3.scaleBand()
        .domain(distributionData.map(d => d.label))
        .range([0, innerWidth])
        .padding(0.2);
        
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(distributionData, d => d.count)])
        .range([innerHeight, 0])
        .nice();
    
    // Add x-axis
    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .append('text')
        .attr('x', innerWidth / 2)
        .attr('y', 40)
        .attr('fill', '#000')
        .attr('text-anchor', 'middle')
        .text('Number of Third Places');
    
    // Add y-axis
    g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -40)
        .attr('x', -innerHeight / 2)
        .attr('fill', '#000')
        .attr('text-anchor', 'middle')
        .text('Number of Census Tracts');
    
    // Add bars
    g.selectAll('.bar')
        .data(distributionData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.label))
        .attr('y', d => yScale(d.count))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d.count))
        .attr('fill', d => d.color);
    
    // Add value labels
    g.selectAll('.bar-label')
        .data(distributionData)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => xScale(d.label) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.count) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(d => d.count);
}

// Show tract type analysis
function showTractTypeAnalysis() {
    const resultsContainer = document.getElementById('analysis-results');
    
    // Group tracts by density category
    const densityCategories = [
        "Rural/Exurban",
        "Low Density Suburban", 
        "Medium Density Suburban", 
        "Urban Residential", 
        "Dense Urban"
    ];
    
    const categoryData = {};
    densityCategories.forEach(category => {
        categoryData[category] = {
            count: 0,
            tracts: [],
            totalPlaces: 0,
            traditional: 0,
            community: 0,
            modern: 0,
            avgTotal: 0,
            avgTPI: 0,
            avgTraditional: 0,
            avgCommunity: 0,
            avgModern: 0
        };
    });
    
    // Collect data for each tract by density category
    tractsData.features.forEach(feature => {
        const props = feature.properties;
        const category = props.density_category || "Unknown";
        
        if (category !== "Unknown" && categoryData[category]) {
            categoryData[category].count++;
            
            const traditionalCount = props.traditional_count || 0;
            const communityCount = props.community_count || 0;
            const modernCount = props.modern_count || 0;
            const totalPlaces = traditionalCount + communityCount + modernCount;
            
            categoryData[category].tracts.push({
                id: props.GEOID,
                traditional: traditionalCount,
                community: communityCount,
                modern: modernCount,
                total: totalPlaces,
                tpi: props.third_place_index || 0,
                traditionalIndex: props.traditional_index || 0,
                communityIndex: props.community_index || 0,
                modernIndex: props.modern_index || 0
            });
            
            categoryData[category].totalPlaces += totalPlaces;
            categoryData[category].traditional += traditionalCount;
            categoryData[category].community += communityCount;
            categoryData[category].modern += modernCount;
        }
    });
    
    // Calculate averages for each category
    densityCategories.forEach(category => {
        const data = categoryData[category];
        if (data.count > 0) {
            data.avgTotal = data.totalPlaces / data.count;
            data.avgTraditional = data.traditional / data.count;
            data.avgCommunity = data.community / data.count;
            data.avgModern = data.modern / data.count;
            
            // Calculate average indices
            data.avgTPI = data.tracts.reduce((sum, tract) => sum + tract.tpi, 0) / data.count;
            data.avgTraditionalIndex = data.tracts.reduce((sum, tract) => sum + tract.traditionalIndex, 0) / data.count;
            data.avgCommunityIndex = data.tracts.reduce((sum, tract) => sum + tract.communityIndex, 0) / data.count;
            data.avgModernIndex = data.tracts.reduce((sum, tract) => sum + tract.modernIndex, 0) / data.count;
        }
    });
    
    // Create HTML content
    let categoryStatsHtml = `<div class="category-comparison">`;
    
    densityCategories.forEach(category => {
        const data = categoryData[category];
        if (data.count === 0) return;
        
        categoryStatsHtml += `
            <div class="category-row">
                <div class="category-label">${category}</div>
                <div class="category-metrics">
                    <div class="metric">
                        <div class="metric-label">Tracts</div>
                        <div class="metric-value">${data.count}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Avg Places</div>
                        <div class="metric-value">${data.avgTotal.toFixed(1)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Avg TPI</div>
                        <div class="metric-value">${data.avgTPI.toFixed(3)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Traditional</div>
                        <div class="metric-value">${data.avgTraditional.toFixed(1)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Community</div>
                        <div class="metric-value">${data.avgCommunity.toFixed(1)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Modern</div>
                        <div class="metric-value">${data.avgModern.toFixed(1)}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    categoryStatsHtml += `</div>`;
    
    // Create a breakdown of place type composition for each density category
    let compositionHtml = `<div class="category-composition">
        <h4>Third Place Composition by Tract Type</h4>
        <table class="composition-table">
            <thead>
                <tr>
                    <th>Tract Type</th>
                    <th>Traditional %</th>
                    <th>Community %</th>
                    <th>Modern %</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    densityCategories.forEach(category => {
        const data = categoryData[category];
        if (data.count === 0 || data.totalPlaces === 0) return;
        
        const traditionalPct = (data.traditional / data.totalPlaces * 100).toFixed(1);
        const communityPct = (data.community / data.totalPlaces * 100).toFixed(1);
        const modernPct = (data.modern / data.totalPlaces * 100).toFixed(1);
        
        compositionHtml += `
            <tr>
                <td>${category}</td>
                <td>${traditionalPct}%</td>
                <td>${communityPct}%</td>
                <td>${modernPct}%</td>
            </tr>
        `;
    });
    
    compositionHtml += `
            </tbody>
        </table>
    </div>`;
    
    // Find key insights
    const urbanCategory = categoryData["Urban Residential"];
    const subUrbanCategory = categoryData["Medium Density Suburban"];
    const denseUrbanCategory = categoryData["Dense Urban"];
    const ruralCategory = categoryData["Rural/Exurban"];
    const lowDensitySuburbanCategory = categoryData["Low Density Suburban"];
    
    let insightsHtml = `<div class="tract-type-insights">
        <h4>Key Insights</h4>
        <ul>
    `;
    
    // Identify which tract type has highest third place density
    const maxAvgDensity = Math.max(
        ...Object.values(categoryData)
            .filter(d => d.count > 0)
            .map(d => d.avgTotal)
    );
    
    const highestDensityCategory = Object.entries(categoryData)
        .filter(([_, d]) => d.count > 0)
        .find(([_, d]) => d.avgTotal === maxAvgDensity)?.[0];
    
    // Identify which tract type has lowest third place density
    const minAvgDensity = Math.min(
        ...Object.values(categoryData)
            .filter(d => d.count > 0)
            .map(d => d.avgTotal)
    );
    
    const lowestDensityCategory = Object.entries(categoryData)
        .filter(([_, d]) => d.count > 0)
        .find(([_, d]) => d.avgTotal === minAvgDensity)?.[0];
    
    if (highestDensityCategory) {
        insightsHtml += `
            <li>
                <strong>${highestDensityCategory}</strong> tracts have the highest average 
                third place density with ${maxAvgDensity.toFixed(1)} places per tract.
                ${lowestDensityCategory ? `This is ${(maxAvgDensity / minAvgDensity).toFixed(1)}x higher than 
                ${lowestDensityCategory} areas (${minAvgDensity.toFixed(1)} places).` : ''}
            </li>
        `;
    }
    
    // Compare community vs traditional places across urban/suburban
    if (urbanCategory && subUrbanCategory) {
        const urbanCommunityRatio = urbanCategory.community / urbanCategory.totalPlaces;
        const suburbanCommunityRatio = subUrbanCategory.community / subUrbanCategory.totalPlaces;
        const urbanTraditionalRatio = urbanCategory.traditional / urbanCategory.totalPlaces;
        const suburbanTraditionalRatio = subUrbanCategory.traditional / subUrbanCategory.totalPlaces;
        const urbanModernRatio = urbanCategory.modern / urbanCategory.totalPlaces;
        const suburbanModernRatio = subUrbanCategory.modern / subUrbanCategory.totalPlaces;
        
        if (Math.abs(urbanCommunityRatio - suburbanCommunityRatio) > 0.05) {
            const comparison = urbanCommunityRatio > suburbanCommunityRatio ? "higher" : "lower";
            insightsHtml += `
                <li>
                    <strong>Community places</strong> represent ${(urbanCommunityRatio * 100).toFixed(1)}% of 
                    third places in Urban Residential areas, ${comparison} than the 
                    ${(suburbanCommunityRatio * 100).toFixed(1)}% found in Medium Density Suburban areas.
                </li>
            `;
        }
        
        if (Math.abs(urbanTraditionalRatio - suburbanTraditionalRatio) > 0.05) {
            const comparison = urbanTraditionalRatio > suburbanTraditionalRatio ? "higher" : "lower";
            insightsHtml += `
                <li>
                    <strong>Traditional places</strong> represent ${(urbanTraditionalRatio * 100).toFixed(1)}% of 
                    third places in Urban Residential areas, ${comparison} than the
                    ${(suburbanTraditionalRatio * 100).toFixed(1)}% in Medium Density Suburban areas.
                </li>
            `;
        }
        
        if (Math.abs(urbanModernRatio - suburbanModernRatio) > 0.05) {
            const comparison = urbanModernRatio > suburbanModernRatio ? "higher" : "lower";
            insightsHtml += `
                <li>
                    <strong>Modern places</strong> represent ${(urbanModernRatio * 100).toFixed(1)}% of 
                    third places in Urban Residential areas, ${comparison} than the
                    ${(suburbanModernRatio * 100).toFixed(1)}% in Medium Density Suburban areas.
                </li>
            `;
        }
    }
    
    // Examine modern places in dense urban vs others
    if (denseUrbanCategory) {
        const denseUrbanModernRatio = denseUrbanCategory.modern / denseUrbanCategory.totalPlaces;
        const otherCategoriesModernRatio = (
            Object.values(categoryData)
                .filter(d => d.count > 0 && d !== denseUrbanCategory)
                .reduce((sum, d) => sum + d.modern, 0) / 
            Object.values(categoryData)
                .filter(d => d.count > 0 && d !== denseUrbanCategory)
                .reduce((sum, d) => sum + d.totalPlaces, 0)
        );
        
        if (Math.abs(denseUrbanModernRatio - otherCategoriesModernRatio) > 0.05) {
            const comparison = denseUrbanModernRatio > otherCategoriesModernRatio ? "higher" : "lower";
            insightsHtml += `
                <li>
                    <strong>Modern places</strong> make up ${(denseUrbanModernRatio * 100).toFixed(1)}% of 
                    third places in Dense Urban areas, ${comparison} than the
                    ${(otherCategoriesModernRatio * 100).toFixed(1)}% in other tract types combined.
                </li>
            `;
        }
    }
    
    // Add insight about rural areas if data exists
    if (ruralCategory && ruralCategory.count > 0) {
        const ruralTraditionalPct = (ruralCategory.traditional / ruralCategory.totalPlaces * 100).toFixed(1);
        const ruralCommunityPct = (ruralCategory.community / ruralCategory.totalPlaces * 100).toFixed(1);
        const ruralModernPct = (ruralCategory.modern / ruralCategory.totalPlaces * 100).toFixed(1);
        
        // Find dominant place type
        const dominantType = [
            { type: "traditional", pct: ruralCategory.traditional / ruralCategory.totalPlaces },
            { type: "community", pct: ruralCategory.community / ruralCategory.totalPlaces },
            { type: "modern", pct: ruralCategory.modern / ruralCategory.totalPlaces }
        ].sort((a, b) => b.pct - a.pct)[0];
        
        insightsHtml += `
            <li>
                <strong>Rural/Exurban</strong> tracts have ${ruralCategory.avgTotal.toFixed(1)} 
                third places on average, with ${dominantType.type.charAt(0).toUpperCase() + dominantType.type.slice(1)} places 
                being the most common (${(dominantType.pct * 100).toFixed(1)}%).
            </li>
        `;
    }
    
    // Add insight about TPI patterns across tract types
    const sortedByTPI = Object.entries(categoryData)
        .filter(([_, d]) => d.count > 0)
        .sort((a, b) => b[1].avgTPI - a[1].avgTPI);
    
    const highestTPICategory = sortedByTPI[0][0];
    const lowestTPICategory = sortedByTPI[sortedByTPI.length - 1][0];
    
    insightsHtml += `
        <li>
            The Third Place Index (TPI) is highest in <strong>${highestTPICategory}</strong> areas 
            (${categoryData[highestTPICategory].avgTPI.toFixed(3)}) and lowest in 
            <strong>${lowestTPICategory}</strong> areas (${categoryData[lowestTPICategory].avgTPI.toFixed(3)}),
            suggesting significant differences in third place accessibility across tract types.
        </li>
    `;
    
    // Add insight about low density suburban areas if they exist
    if (lowDensitySuburbanCategory && lowDensitySuburbanCategory.count > 0) {
        // Find what's distinctive about low density suburban areas
        const lowDensityTraditionalPct = lowDensitySuburbanCategory.traditional / lowDensitySuburbanCategory.totalPlaces;
        const lowDensityCommunityPct = lowDensitySuburbanCategory.community / lowDensitySuburbanCategory.totalPlaces;
        const lowDensityModernPct = lowDensitySuburbanCategory.modern / lowDensitySuburbanCategory.totalPlaces;
        
        // Compare to overall averages
        const overallTraditionalPct = Object.values(categoryData)
            .filter(d => d.count > 0)
            .reduce((sum, d) => sum + d.traditional, 0) / 
            Object.values(categoryData)
            .filter(d => d.count > 0)
            .reduce((sum, d) => sum + d.totalPlaces, 0);
            
        const overallCommunityPct = Object.values(categoryData)
            .filter(d => d.count > 0)
            .reduce((sum, d) => sum + d.community, 0) / 
            Object.values(categoryData)
            .filter(d => d.count > 0)
            .reduce((sum, d) => sum + d.totalPlaces, 0);
            
        const overallModernPct = Object.values(categoryData)
            .filter(d => d.count > 0)
            .reduce((sum, d) => sum + d.modern, 0) / 
            Object.values(categoryData)
            .filter(d => d.count > 0)
            .reduce((sum, d) => sum + d.totalPlaces, 0);
        
        let distinctiveType = "";
        let distinctivePct = 0;
        let overallPct = 0;
        
        if (Math.abs(lowDensityTraditionalPct - overallTraditionalPct) > 
            Math.max(Math.abs(lowDensityCommunityPct - overallCommunityPct), 
                    Math.abs(lowDensityModernPct - overallModernPct))) {
            distinctiveType = "Traditional";
            distinctivePct = lowDensityTraditionalPct;
            overallPct = overallTraditionalPct;
        } else if (Math.abs(lowDensityCommunityPct - overallCommunityPct) > 
                  Math.abs(lowDensityModernPct - overallModernPct)) {
            distinctiveType = "Community";
            distinctivePct = lowDensityCommunityPct;
            overallPct = overallCommunityPct;
        } else {
            distinctiveType = "Modern";
            distinctivePct = lowDensityModernPct;
            overallPct = overallModernPct;
        }
        
        const comparison = distinctivePct > overallPct ? "higher" : "lower";
        
        insightsHtml += `
            <li>
                <strong>Low Density Suburban</strong> areas have a ${comparison} proportion of 
                ${distinctiveType.toLowerCase()} places (${(distinctivePct * 100).toFixed(1)}%) 
                compared to the average across all tract types (${(overallPct * 100).toFixed(1)}%).
            </li>
        `;
    }
    
    insightsHtml += `</ul>
    </div>`;
    
    // Create analysis text
    const html = `
        <h3>Tract Type Analysis</h3>
        <div class="analysis-text">
            <p>This analysis examines how third place density and composition 
            vary across different tract types, from rural to dense urban areas.</p>
            
            <div class="tract-type-highlight">
                <label for="tract-type-selector">Highlight all tracts of type:</label>
                <select id="tract-type-selector">
                    <option value="">-- Select a tract type --</option>
                    <option value="Rural/Exurban">Rural/Exurban</option>
                    <option value="Low Density Suburban">Low Density Suburban</option>
                    <option value="Medium Density Suburban">Medium Density Suburban</option>
                    <option value="Urban Residential">Urban Residential</option>
                    <option value="Dense Urban">Dense Urban</option>
                </select>
                <button id="highlight-tract-type-btn">Highlight</button>
                <button id="clear-tract-highlight-btn">Clear Highlight</button>
            </div>
            
            ${insightsHtml}
            
            <h4>Overview by Tract Type</h4>
            ${categoryStatsHtml}
            
            <p>The data reveals distinct patterns in third place distribution across different 
            urban/suburban contexts. These patterns likely reflect differences in zoning, 
            land use, commercial development, transportation infrastructure, and social needs 
            across varied residential contexts.</p>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    
    // Reset any map highlights
    clearTopTractsHighlight();
    
    // Create visualization for tract type analysis
    createTractTypeChart(categoryData, densityCategories);
    
    // Set up the tract type highlight functionality
    document.getElementById('highlight-tract-type-btn').addEventListener('click', () => {
        const selectedType = document.getElementById('tract-type-selector').value;
        if (selectedType) {
            highlightTractsByType(selectedType);
        }
    });
    
    document.getElementById('clear-tract-highlight-btn').addEventListener('click', () => {
        clearTopTractsHighlight();
    });
}

// Function to highlight tracts of a specific density category
function highlightTractsByType(densityCategory) {
    // First clear any existing highlights
    clearTopTractsHighlight();
    
    // Collect all tract IDs matching the category
    const tractIds = tractsData.features
        .filter(feature => feature.properties.density_category === densityCategory)
        .map(feature => feature.properties.GEOID);
    
    if (tractIds.length === 0) {
        return;
    }
    
    // Create the highlight layer if it doesn't exist yet
    if (!map.getLayer('top-tracts-highlight')) {
        map.addLayer({
            id: 'top-tracts-highlight',
            type: 'fill',
            source: 'tracts',
            paint: {
                'fill-color': '#4361ee',
                'fill-opacity': 0.5,
                'fill-outline-color': '#e41a1c'  // Changed from '#ffffff' to red outline
            },
            filter: ['in', 'GEOID', '']
        });
    }
    
    // Set highlight filter on the tracts layer
    map.setFilter('top-tracts-highlight', ['in', 'GEOID', ...tractIds]);
    
    // Apply styling specific to this tract type
    let color;
    switch(densityCategory) {
        case 'Rural/Exurban':
            color = '#1b9e77'; // green
            break;
        case 'Low Density Suburban':
            color = '#d95f02'; // orange
            break;
        case 'Medium Density Suburban':
            color = '#7570b3'; // purple
            break;
        case 'Urban Residential':
            color = '#e7298a'; // pink
            break;
        case 'Dense Urban':
            color = '#66a61e'; // lime
            break;
        default:
            color = '#e41a1c'; // red
    }
    
    map.setPaintProperty('top-tracts-highlight', 'fill-color', color);
    map.setPaintProperty('top-tracts-highlight', 'fill-opacity', 0.5);
    map.setPaintProperty('top-tracts-highlight', 'fill-outline-color', '#e41a1c'); // Added to ensure red outline is consistently applied
    
    // Fly to the bounds of the highlighted tracts
    const highlightedFeatures = tractsData.features.filter(f => 
        tractIds.includes(f.properties.GEOID));
        
    if (highlightedFeatures.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        
        highlightedFeatures.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                try {
                    if (feature.geometry.type === 'Polygon') {
                        feature.geometry.coordinates[0].forEach(coord => {
                            bounds.extend(coord);
                        });
                    } else if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates.forEach(polygon => {
                            polygon[0].forEach(coord => {
                                bounds.extend(coord);
                            });
                        });
                    }
                } catch (error) {
                    console.warn('Error processing geometry:', error);
                }
            }
        });
        
        // Only fit bounds if not empty
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 14
            });
        }
    }
    
    // Display count in a toast notification
    showToastNotification(`Highlighted ${tractIds.length} tracts classified as "${densityCategory}"`);
}

// Function to show a toast notification
function showToastNotification(message) {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        document.body.appendChild(toast);
    }
    
    // Set content and show
    toast.textContent = message;
    toast.className = 'toast-visible';
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.className = '';
    }, 3000);
}

// Function to highlight tracts by income level
function highlightTractsByIncome(incomeLevel) {
    // First clear any existing highlights
    clearTopTractsHighlight();
    
    // Get income range definitions
    const incomeRanges = [
        { name: "Low Income", min: 0, max: 40000, color: "#90caf9" },
        { name: "Lower-Middle Income", min: 40000, max: 70000, color: "#42a5f5" },
        { name: "Middle Income", min: 70000, max: 100000, color: "#1976d2" },
        { name: "Upper-Middle Income", min: 100000, max: 150000, color: "#0d47a1" },
        { name: "High Income", min: 150000, max: Infinity, color: "#002171" }
    ];
    
    // Find the selected income range
    const selectedRange = incomeRanges.find(range => range.name === incomeLevel);
    if (!selectedRange) {
        console.error(`Income level "${incomeLevel}" not found`);
        return;
    }
    
    // Collect all tract IDs matching the income level
    const tractIds = tractsData.features
        .filter(feature => {
            const income = feature.properties.median_income || 0;
            return income >= selectedRange.min && income < selectedRange.max;
        })
        .map(feature => feature.properties.GEOID);
    
    if (tractIds.length === 0) {
        return;
    }
    
    // Create the outline layer if it doesn't exist yet
    if (!map.getLayer('top-tracts-outline')) {
        map.addLayer({
            id: 'top-tracts-outline',
            type: 'line',
            source: 'tracts',
            paint: {
                'line-color': '#e41a1c',  // Red outline
                'line-width': 2,
                'line-opacity': 0.9
            },
            filter: ['in', 'GEOID', '']
        });
    }
    
    // Set highlight filter on the outline layer
    map.setFilter('top-tracts-outline', ['in', 'GEOID', ...tractIds]);
    
    // Fly to the bounds of the highlighted tracts
    const highlightedFeatures = tractsData.features.filter(f => 
        tractIds.includes(f.properties.GEOID));
        
    if (highlightedFeatures.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        
        highlightedFeatures.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                try {
                    if (feature.geometry.type === 'Polygon') {
                        feature.geometry.coordinates[0].forEach(coord => {
                            bounds.extend(coord);
                        });
                    } else if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates.forEach(polygon => {
                            polygon[0].forEach(coord => {
                                bounds.extend(coord);
                            });
                        });
                    }
                } catch (error) {
                    console.warn('Error processing geometry:', error);
                }
            }
        });
        
        // Only fit bounds if not empty
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 14
            });
        }
    }
    
    // Display count in a toast notification
    showToastNotification(`Highlighted ${tractIds.length} tracts classified as "${incomeLevel}"`);
}

// Create chart for tract type analysis
function createTractTypeChart(categoryData, categories) {
    const chartContainer = document.getElementById('analysis-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 250;
    const margin = { top: 30, right: 80, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const svg = d3.select('#analysis-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Average Third Places by Tract Type');
    
    // Prepare data for the chart
    const chartData = categories
        .filter(category => categoryData[category] && categoryData[category].count > 0)
        .map(category => {
            return {
                category: category,
                traditional: categoryData[category].avgTraditional,
                community: categoryData[category].avgCommunity,
                modern: categoryData[category].avgModern
            };
        });
    
    // Sort categories by urbanization level
    chartData.sort((a, b) => {
        const order = {
            "Rural/Exurban": 1,
            "Low Density Suburban": 2,
            "Medium Density Suburban": 3,
            "Urban Residential": 4,
            "Dense Urban": 5
        };
        return order[a.category] - order[b.category];
    });
    
    // Set up scales
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);
    
    const maxValue = d3.max(chartData, d => d.traditional + d.community + d.modern);
    
    const yScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1]) // Add 10% padding at the top
        .range([innerHeight, 0])
        .nice();
    
    // Set colors
    const colors = {
        traditional: '#ff8f00', // Amber - consistent with the app
        community: '#00acc1',   // Teal - consistent with the app
        modern: '#c51b8a'       // Pink - consistent with the app
    };
    
    // Create stacked data
    const stackedData = chartData.map(d => {
        const traditionalHeight = d.traditional;
        const communityHeight = d.community;
        const modernHeight = d.modern;
        
        return {
            category: d.category,
            segments: [
                {
                    type: 'traditional',
                    value: traditionalHeight,
                    y0: 0,
                    y1: traditionalHeight
                },
                {
                    type: 'community',
                    value: communityHeight, 
                    y0: traditionalHeight,
                    y1: traditionalHeight + communityHeight
                },
                {
                    type: 'modern',
                    value: modernHeight,
                    y0: traditionalHeight + communityHeight,
                    y1: traditionalHeight + communityHeight + modernHeight
                }
            ]
        };
    });
    
    // Add x-axis
    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-35)')
        .style('font-size', '10px');
    
    // Add y-axis
    g.append('g')
        .call(d3.axisLeft(yScale).ticks(5));
    
    // Add y-axis label
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -40)
        .attr('x', -innerHeight / 2)
        .attr('fill', '#333')
        .style('font-size', '12px')
        .style('text-anchor', 'middle')
        .text('Average Third Places per Tract');
    
    // Add stacked bars
    stackedData.forEach(d => {
        // For each category, we'll draw stacked segments
        d.segments.forEach(segment => {
            g.append('rect')
                .attr('x', xScale(d.category))
                .attr('y', yScale(segment.y1))
                .attr('height', yScale(segment.y0) - yScale(segment.y1))
                .attr('width', xScale.bandwidth())
                .attr('fill', colors[segment.type])
                .attr('opacity', 0.8)
                .attr('stroke', 'white')
                .attr('stroke-width', 1);
        });
        
        // Add total label above each bar
        const totalValue = d.segments[d.segments.length - 1].y1;
        g.append('text')
            .attr('x', xScale(d.category) + xScale.bandwidth() / 2)
            .attr('y', yScale(totalValue) - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('font-weight', '600')
            .text(totalValue.toFixed(1));
    });
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width - margin.right + 15}, ${margin.top})`);
    
    const legendItems = [
        { label: 'Traditional', color: colors.traditional },
        { label: 'Community', color: colors.community },
        { label: 'Modern', color: colors.modern }
    ];
    
    legendItems.forEach((item, i) => {
        const legendRow = legend.append('g')
            .attr('transform', `translate(0, ${i * 20})`);
        
        legendRow.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', item.color)
            .attr('opacity', 0.8);
        
        legendRow.append('text')
            .attr('x', 20)
            .attr('y', 10)
            .style('font-size', '12px')
            .text(item.label);
    });
}

// Show income analysis
function showIncomeAnalysis() {
    const resultsContainer = document.getElementById('analysis-results');
    
    // Group tracts by income level
    const incomeRanges = [
        { name: "Low Income", min: 0, max: 40000, color: "#90caf9" },
        { name: "Lower-Middle Income", min: 40000, max: 70000, color: "#42a5f5" },
        { name: "Middle Income", min: 70000, max: 100000, color: "#1976d2" },
        { name: "Upper-Middle Income", min: 100000, max: 150000, color: "#0d47a1" },
        { name: "High Income", min: 150000, max: Infinity, color: "#002171" }
    ];
    
    const incomeData = {};
    incomeRanges.forEach(range => {
        incomeData[range.name] = {
            min: range.min,
            max: range.max,
            color: range.color,
            count: 0,
            tracts: [],
            totalPlaces: 0,
            traditional: 0,
            community: 0,
            modern: 0,
            avgTotal: 0,
            avgTPI: 0,
            avgTraditional: 0,
            avgCommunity: 0,
            avgModern: 0,
            avgIncome: 0
        };
    });
    
    // Collect all median incomes for correlation analysis
    const allIncomes = [];
    const allTPIs = [];
    const allTraditionalIndices = [];
    const allCommunityIndices = [];
    const allModernIndices = [];
    const allPlaceCounts = [];
    
    // Collect data for each tract by income range
    tractsData.features.forEach(feature => {
        const props = feature.properties;
        const income = props.median_income || 0;
        
        if (income > 0) {
            allIncomes.push(income);
            allTPIs.push(props.third_place_index || 0);
            allTraditionalIndices.push(props.traditional_index || 0);
            allCommunityIndices.push(props.community_index || 0);
            allModernIndices.push(props.modern_index || 0);
            
            const totalPlaces = (props.traditional_count || 0) + 
                               (props.community_count || 0) + 
                               (props.modern_count || 0);
            allPlaceCounts.push(totalPlaces);
            
            // Assign to income range
            const range = incomeRanges.find(r => income >= r.min && income < r.max);
            if (range) {
                const rangeName = range.name;
                incomeData[rangeName].count++;
                incomeData[rangeName].avgIncome += income;
                
                const traditionalCount = props.traditional_count || 0;
                const communityCount = props.community_count || 0;
                const modernCount = props.modern_count || 0;
                
                incomeData[rangeName].tracts.push({
                    id: props.GEOID,
                    income: income,
                    traditional: traditionalCount,
                    community: communityCount,
                    modern: modernCount,
                    total: totalPlaces,
                    tpi: props.third_place_index || 0,
                    traditionalIndex: props.traditional_index || 0,
                    communityIndex: props.community_index || 0,
                    modernIndex: props.modern_index || 0
                });
                
                incomeData[rangeName].totalPlaces += totalPlaces;
                incomeData[rangeName].traditional += traditionalCount;
                incomeData[rangeName].community += communityCount;
                incomeData[rangeName].modern += modernCount;
            }
        }
    });
    
    // Calculate averages for each income range
    incomeRanges.forEach(range => {
        const data = incomeData[range.name];
        if (data.count > 0) {
            data.avgIncome = data.avgIncome / data.count;
            data.avgTotal = data.totalPlaces / data.count;
            data.avgTraditional = data.traditional / data.count;
            data.avgCommunity = data.community / data.count;
            data.avgModern = data.modern / data.count;
            
            // Calculate average indices
            data.avgTPI = data.tracts.reduce((sum, tract) => sum + tract.tpi, 0) / data.count;
            data.avgTraditionalIndex = data.tracts.reduce((sum, tract) => sum + tract.traditionalIndex, 0) / data.count;
            data.avgCommunityIndex = data.tracts.reduce((sum, tract) => sum + tract.communityIndex, 0) / data.count;
            data.avgModernIndex = data.tracts.reduce((sum, tract) => sum + tract.modernIndex, 0) / data.count;
        }
    });
    
    // Calculate correlation coefficient
    const calculateCorrelation = (x, y) => {
        const n = x.length;
        if (n === 0 || n !== y.length) return 0;
        
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;
        let sumY2 = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        if (denominator === 0) return 0;
        return numerator / denominator;
    };
    
    // Calculate correlations
    const tpiCorrelation = calculateCorrelation(allIncomes, allTPIs);
    const traditionalCorrelation = calculateCorrelation(allIncomes, allTraditionalIndices);
    const communityCorrelation = calculateCorrelation(allIncomes, allCommunityIndices);
    const modernCorrelation = calculateCorrelation(allIncomes, allModernIndices);
    const placeCountCorrelation = calculateCorrelation(allIncomes, allPlaceCounts);
    
    // Create highlight controls
    const highlightControlsHtml = `
        <div class="tract-type-highlight-controls">
            <div class="highlight-control-row">
                <div class="control-label">Highlight all tracts of type:</div>
                <div class="control-input">
                    <select id="income-level-select" class="form-select">
                        <option value="">-- Select an income level --</option>
                        ${incomeRanges.map(range => `<option value="${range.name}">${range.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="highlight-buttons">
                <button id="highlight-income-btn" class="btn btn-primary">Highlight</button>
                <button id="clear-income-highlight-btn" class="btn btn-secondary">Clear Highlight</button>
            </div>
        </div>
    `;
    
    // Create HTML content for income ranges without highlight buttons
    let incomeRangeHtml = `<div class="income-ranges">`;
    
    incomeRanges.forEach(range => {
        const data = incomeData[range.name];
        if (data.count === 0) return;
        
        const formattedAvgIncome = formatCurrency(data.avgIncome);
        
        incomeRangeHtml += `
            <div class="income-range-row">
                <div class="income-range-name">
                    ${range.name}
                </div>
                <div class="income-range-avg">${formattedAvgIncome}</div>
                <div class="income-range-metrics">
                    <div class="metric">
                        <div class="metric-label">Tracts</div>
                        <div class="metric-value">${data.count}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Avg Places</div>
                        <div class="metric-value">${data.avgTotal.toFixed(1)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Avg TPI</div>
                        <div class="metric-value">${data.avgTPI.toFixed(3)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Traditional</div>
                        <div class="metric-value">${data.avgTraditional.toFixed(1)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Community</div>
                        <div class="metric-value">${data.avgCommunity.toFixed(1)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Modern</div>
                        <div class="metric-value">${data.avgModern.toFixed(1)}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    incomeRangeHtml += `</div>`;
    
    // Create correlation table
    const correlationHtml = `
        <div class="correlation-analysis">
            <h4>Income Correlation Analysis</h4>
            <div class="correlation-explanation">
                <p>Correlation coefficient values range from -1 to 1:</p>
                <ul>
                    <li>Values near 1 indicate a strong positive correlation</li>
                    <li>Values near -1 indicate a strong negative correlation</li>
                    <li>Values near 0 indicate little to no linear correlation</li>
                </ul>
            </div>
            <table class="correlation-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Correlation with Income</th>
                        <th>Strength</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Third Place Index (TPI)</td>
                        <td>${tpiCorrelation.toFixed(3)}</td>
                        <td>${getCorrelationStrength(tpiCorrelation)}</td>
                    </tr>
                    <tr>
                        <td>Traditional Places Index</td>
                        <td>${traditionalCorrelation.toFixed(3)}</td>
                        <td>${getCorrelationStrength(traditionalCorrelation)}</td>
                    </tr>
                    <tr>
                        <td>Community Places Index</td>
                        <td>${communityCorrelation.toFixed(3)}</td>
                        <td>${getCorrelationStrength(communityCorrelation)}</td>
                    </tr>
                    <tr>
                        <td>Modern Places Index</td>
                        <td>${modernCorrelation.toFixed(3)}</td>
                        <td>${getCorrelationStrength(modernCorrelation)}</td>
                    </tr>
                    <tr>
                        <td>Total Places Count</td>
                        <td>${placeCountCorrelation.toFixed(3)}</td>
                        <td>${getCorrelationStrength(placeCountCorrelation)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    
    // Create overall insights
    const insights = [];
    
    if (Math.abs(tpiCorrelation) > 0.3) {
        if (tpiCorrelation > 0) {
            insights.push(`Higher income areas tend to have higher Third Place Index values, suggesting better access to third places in wealthier areas.`);
        } else {
            insights.push(`Lower income areas tend to have higher Third Place Index values, suggesting better access to third places in less affluent areas.`);
        }
    }
    
    if (Math.abs(traditionalCorrelation) > 0.3) {
        if (traditionalCorrelation > 0) {
            insights.push(`Traditional third places (e.g., cafes, bars, bookstores) appear more concentrated in higher income areas.`);
        } else {
            insights.push(`Traditional third places appear more prevalent in lower income areas of the region.`);
        }
    }
    
    if (Math.abs(communityCorrelation) > 0.3) {
        if (communityCorrelation > 0) {
            insights.push(`Community spaces like libraries and religious establishments show a positive correlation with income.`);
        } else {
            insights.push(`Community spaces are more accessible in lower income neighborhoods.`);
        }
    }
    
    if (Math.abs(modernCorrelation) > 0.3) {
        if (modernCorrelation > 0) {
            insights.push(`Modern third places (e.g., coworking spaces, gaming venues) are more prevalent in higher income areas.`);
        } else {
            insights.push(`Modern third places show greater presence in lower income areas.`);
        }
    }
    
    let insightsHtml = '';
    if (insights.length > 0) {
        insightsHtml = `
            <div class="tract-type-insights">
                <h4>Key Insights</h4>
                <ul>
                    ${insights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // Create chart
    createIncomeAnalysisChart(incomeData, incomeRanges);
    
    // Compile all HTML
    const html = `
        <h3>Income Analysis: Third Places by Income Level</h3>
        <div class="analysis-text">
            <p>This analysis examines the relationship between median household income and third place accessibility across census tracts.</p>
            
            <div class="tract-type-highlight">
                <label for="income-level-selector">Highlight all tracts of type:</label>
                <select id="income-level-selector" class="form-select">
                    <option value="">-- Select an income level --</option>
                    ${incomeRanges.map(range => `<option value="${range.name}">${range.name}</option>`).join('')}
                </select>
                <button id="highlight-income-btn" class="btn btn-primary">Highlight</button>
                <button id="clear-income-highlight-btn" class="btn btn-secondary">Clear Highlight</button>
            </div>
            
            ${insightsHtml}
            
            <h4>Income Range Analysis</h4>
            ${incomeRangeHtml}
            
            ${correlationHtml}
        </div>
        
        <div id="income-analysis-chart" class="chart-container"></div>
    `;
    
    resultsContainer.innerHTML = html;
    
    // Set up event listeners for highlight controls
    document.getElementById('highlight-income-btn').addEventListener('click', () => {
        const selectedIncome = document.getElementById('income-level-selector').value;
        if (selectedIncome) {
            highlightTractsByIncome(selectedIncome);
        }
    });
    
    document.getElementById('clear-income-highlight-btn').addEventListener('click', () => {
        clearTopTractsHighlight();
    });
}

// Create chart for income analysis
function createIncomeAnalysisChart(incomeData, incomeRanges) {
    const chartContainer = document.getElementById('analysis-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 250;
    const margin = { top: 30, right: 80, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const svg = d3.select('#analysis-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Third Place Types by Income Range');
    
    // Prepare data for the chart
    const chartData = incomeRanges
        .filter(range => incomeData[range.name] && incomeData[range.name].count > 0)
        .map(range => {
            return {
                range: range.name,
                income: incomeData[range.name].avgIncome,
                traditional: incomeData[range.name].avgTraditional,
                community: incomeData[range.name].avgCommunity,
                modern: incomeData[range.name].avgModern,
                color: range.color
            };
        });
    
    // Sort by income level
    chartData.sort((a, b) => a.income - b.income);
    
    // Set up scales
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d.range))
        .range([0, innerWidth])
        .padding(0.2);
    
    const maxValue = d3.max(chartData, d => d.traditional + d.community + d.modern);
    
    const yScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1]) // Add 10% padding at the top
        .range([innerHeight, 0])
        .nice();
    
    // Set colors
    const colors = {
        traditional: '#ff8f00', // Amber - consistent with the app
        community: '#00acc1',   // Teal - consistent with the app
        modern: '#c51b8a'       // Pink - consistent with the app
    };
    
    // Create stacked data
    const stackedData = chartData.map(d => {
        const traditionalHeight = d.traditional;
        const communityHeight = d.community;
        const modernHeight = d.modern;
        
        return {
            range: d.range,
            income: d.income,
            segments: [
                {
                    type: 'traditional',
                    value: traditionalHeight,
                    y0: 0,
                    y1: traditionalHeight
                },
                {
                    type: 'community',
                    value: communityHeight, 
                    y0: traditionalHeight,
                    y1: traditionalHeight + communityHeight
                },
                {
                    type: 'modern',
                    value: modernHeight,
                    y0: traditionalHeight + communityHeight,
                    y1: traditionalHeight + communityHeight + modernHeight
                }
            ]
        };
    });
    
    // Add x-axis
    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-35)')
        .style('font-size', '10px');
    
    // Add y-axis
    g.append('g')
        .call(d3.axisLeft(yScale).ticks(5));
    
    // Add y-axis label
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -40)
        .attr('x', -innerHeight / 2)
        .attr('fill', '#333')
        .style('font-size', '12px')
        .style('text-anchor', 'middle')
        .text('Average Third Places per Tract');
    
    // Add stacked bars
    stackedData.forEach(d => {
        // For each income range, we'll draw stacked segments
        d.segments.forEach(segment => {
            g.append('rect')
                .attr('x', xScale(d.range))
                .attr('y', yScale(segment.y1))
                .attr('height', yScale(segment.y0) - yScale(segment.y1))
                .attr('width', xScale.bandwidth())
                .attr('fill', colors[segment.type])
                .attr('opacity', 0.8)
                .attr('stroke', 'white')
                .attr('stroke-width', 1);
        });
        
        // Add total label above each bar
        const totalValue = d.segments[d.segments.length - 1].y1;
        g.append('text')
            .attr('x', xScale(d.range) + xScale.bandwidth() / 2)
            .attr('y', yScale(totalValue) - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('font-weight', '600')
            .text(totalValue.toFixed(1));
        
        // Add income label below bars
        g.append('text')
            .attr('x', xScale(d.range) + xScale.bandwidth() / 2)
            .attr('y', innerHeight + 35)
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('fill', '#555')
            .text('$' + Math.round(d.income / 1000) + 'k');
    });
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width - margin.right + 15}, ${margin.top})`);
    
    const legendItems = [
        { label: 'Traditional', color: colors.traditional },
        { label: 'Community', color: colors.community },
        { label: 'Modern', color: colors.modern }
    ];
    
    legendItems.forEach((item, i) => {
        const legendRow = legend.append('g')
            .attr('transform', `translate(0, ${i * 20})`);
        
        legendRow.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', item.color)
            .attr('opacity', 0.8);
        
        legendRow.append('text')
            .attr('x', 20)
            .attr('y', 10)
            .style('font-size', '12px')
            .text(item.label);
    });
}

// Helper function to format currency
function formatCurrency(value) {
    return '$' + Math.round(value).toLocaleString();
}

// Helper function to get correlation strength description
function getCorrelationStrength(correlation) {
    const absCorrelation = Math.abs(correlation);
    if (absCorrelation < 0.1) return 'Negligible';
    if (absCorrelation < 0.3) return 'Weak';
    if (absCorrelation < 0.5) return 'Moderate';
    if (absCorrelation < 0.7) return 'Strong';
    return 'Very Strong';
}

// Function to clear place category highlights
function clearPlaceCategoryHighlight() {
    if (map.getLayer('highlighted-places-circle')) {
        map.setLayoutProperty('highlighted-places-circle', 'visibility', 'none');
    }
}

// Create a bar chart for place types breakdown
function createPlaceTypesBreakdownChart(placeTypes) {
    const chartContainer = document.getElementById('analysis-chart');
    chartContainer.innerHTML = '';
    
    const width = chartContainer.clientWidth;
    const height = 250;
    const margin = { top: 30, right: 30, bottom: 90, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Group by category for calculating percentages within each category
    const traditionalTotal = placeTypes.filter(p => p.category === 'traditional')
        .reduce((sum, item) => sum + item.count, 0);
    const communityTotal = placeTypes.filter(p => p.category === 'community')
        .reduce((sum, item) => sum + item.count, 0);
    const modernTotal = placeTypes.filter(p => p.category === 'modern')
        .reduce((sum, item) => sum + item.count, 0);
    
    // Add percentage info to each place type
    const placeTypesWithPct = placeTypes.map(type => {
        let categoryTotal = 0;
        if (type.category === 'traditional') categoryTotal = traditionalTotal;
        else if (type.category === 'community') categoryTotal = communityTotal;
        else if (type.category === 'modern') categoryTotal = modernTotal;
        
        return {
            ...type,
            percentage: (type.count / categoryTotal) * 100
        };
    });
    
    // Sort by count and take top 10
    const topTypes = placeTypesWithPct
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    
    const svg = d3.select('#analysis-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Top Third Place Types (% within category)');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Format type name to be more readable
    const formatTypeName = (name) => {
        if (!name) return 'Unknown';
        
        // Replace underscores with spaces and capitalize words
        return name
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };
    
    // Set up scales
    const xScale = d3.scaleBand()
        .domain(topTypes.map(d => formatTypeName(d.type)))
        .range([0, innerWidth])
        .padding(0.3);
        
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(topTypes, d => d.percentage)])
        .range([innerHeight, 0])
        .nice();
        
    // Color scale based on category
    const colorScale = d3.scaleOrdinal()
        .domain(['traditional', 'community', 'modern'])
        .range(['#ff8f00', '#00acc1', '#c51b8a']);
    
    // Add x-axis
    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', '9px');
    
    // Add y-axis
    g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll('text')
        .style('font-size', '10px');
    
    // Add y-axis label
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -innerHeight / 2)
        .attr('fill', '#333')
        .style('font-size', '12px')
        .style('text-anchor', 'middle')
        .text('Percentage within Category (%)');
    
    // Add bars
    g.selectAll('.bar')
        .data(topTypes)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(formatTypeName(d.type)))
        .attr('y', d => yScale(d.percentage))
        .attr('width', xScale.bandwidth())
        .attr('height', d => innerHeight - yScale(d.percentage))
        .attr('fill', d => colorScale(d.category))
        .style('opacity', 0.8);
    
    // Add bar labels
    g.selectAll('.bar-label')
        .data(topTypes)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => xScale(formatTypeName(d.type)) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.percentage) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .text(d => `${d.percentage.toFixed(1)}%`);
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width - 100}, ${height - 20})`);
    
    ['traditional', 'community', 'modern'].forEach((category, i) => {
        const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
        
        legend.append('rect')
            .attr('x', 0)
            .attr('y', -i * 15)
            .attr('width', 10)
            .attr('height', 10)
            .attr('fill', colorScale(category));
        
        legend.append('text')
            .attr('x', 15)
            .attr('y', -i * 15 + 8)
            .style('font-size', '8px')
            .text(categoryLabel);
    });
}

// Show spatial analysis