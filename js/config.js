// Configuration for the Third Place Index Map application

const CONFIG = {
    // Mapbox access token - REPLACE WITH YOUR ACTUAL TOKEN
    mapboxToken: 'pk.eyJ1IjoiZXZhbm9uZWlsIiwiYSI6ImNtOWJseHU4ODBiMGEydm9kOWRkZGprNTYifQ.5_6KdyWCz502viq4_O8BbQ',
    
    // Initial map settings
    map: {
        center: [-95.3698, 29.7604], // Houston
        zoom: 10,
        pitch: 45, // Default pitch for 3D view
        bearing: 0,
        style: 'mapbox://styles/mapbox/light-v11',
    },
    
    // Data paths
    data: {
        tracts: 'data/houston_tpi.geojson',
        places: 'data/houston_places.geojson'
    },
    
    // Selected tract highlight style
    selectedTract: {
        'line-color': '#000000',
        'line-width': 3,
        'line-opacity': 1
    },
    
    // 3D building settings
    buildings3D: {
        'fill-extrusion-color': '#aaa',
        'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            16, ['get', 'height']
        ],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.6
    },
    
    // Place categories configuration
    placeCategories: {
        traditional: {
            color: '#ff8f00', // Amber - consistent across the app
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 2,
                    14, 6
                ],
                'circle-color': '#ff8f00',
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        },
        community: {
            color: '#00acc1', // Teal - consistent with score bar
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 2,
                    14, 6
                ],
                'circle-color': '#00acc1',
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        },
        modern: {
            color: '#c51b8a', // Pink - consistent across app
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 2,
                    14, 6
                ],
                'circle-color': '#c51b8a',
                'circle-opacity': 0.8,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        }
    },
    
    // Color scales for different metrics
    colors: {
        overall: [
            '#e5f5f9',
            '#99d8c9',
            '#41b6c4',
            '#2c7fb8',
            '#253494'
        ],
        traditional: [
            '#fff8e1',
            '#ffecb3',
            '#ffd54f',
            '#ffb300',
            '#ff8f00'
        ],
        community: [
            '#e0f7fa',
            '#b2ebf2',
            '#4dd0e1',
            '#00acc1',
            '#00838f'
        ],
        modern: [
            '#fde0dd',
            '#fa9fb5',
            '#f768a1',
            '#c51b8a',
            '#7a0177'
        ]
    }
}; 