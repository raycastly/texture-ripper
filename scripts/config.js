// ==================== CONSTANTS AND CONFIGURATION ====================
const CONFIG = {
    GRID: {
        STROKE: 'rgba(49,179,247,1)',
        STROKE_WIDTH: 1
    },
    VERTEX: {
        RADIUS: 2,
        RESPONSIVERADIUS: 10,
        FILL: 'rgba(20,252,169,1)'
    },
    POLYGON: {
        SELECTED_STROKE: 'rgba(59,189,256,1)',
        SELECTED_STROKE_WIDTH: 3,
        STROKE: 'rgba(49,179,247,1)',
        STROKE_WIDTH: 2,
        CLOSED: true
    },
    SELECTION: {
        FILL: 'rgba(0,0,255,0.3)'
    },
    GUIDES: {
        STROKE: 'rgb(0, 161, 255)',
        OFFSET: 5,
        SCALE_OFFSET: 5,
    },
    EXTRACTION: {
        MIN_SIZE: 16,
        MAX_SIZE: 2048,
        UPSCALE: 2
    },
    ZOOM: {
        SCALE_BY: 1.1
    },
    BACKGROUND: {
        FILL: '#e0e0e0'
    },
    DRAWING: {
        ACTIVE_COLOR: 'rgba(255,0,0,0.7)',
        COMPLETE_COLOR: 'rgba(0,0,255,0.5)'
    },
    BEZIER: {
        HANDLE_RADIUS: 3,
        HANDLE_FILL_IN: 'rgba(255,0,0,0.7)',
        HANDLE_FILL_OUT: 'rgba(0,0,255,0.7)',
        HANDLE_RESPONSIVE_RADIUS: 8
    },
    MIDPOINT: {
        RADIUS: 3,
        FILL: '#ff0',
        RESPONSIVE_RADIUS: 10
    },
    CHECKERBOARD: {
        COLOR1: '#cccccc',
        COLOR2: '#ffffff',
        CELL_SIZE: 20
    },
    SHORTCUTS: {
        uploadImage: 'KeyQ',
        toggleImageLock: 'KeyW',
        
        toggleDrawingMode: 'KeyA',
        addRectangle: 'KeyS',

        extractTextures: 'KeyD',
        exportAtlas: 'KeyF',

        deleteSelected: 'KeyX',
    }
};