// ==================== UTILITY FUNCTIONS ====================
const Utils = {
    // Linear interpolation
    lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
    
    // Euclidean distance
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    
    // Clamp value between min and max
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    
    // Generate a unique ID
    generateId: () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

    // Convert stage coordinates to absolute coordinates
    stageToAbsolute: (stage, point) => {
        return {
            x: (point.x - stage.x()) / stage.scaleX(),
            y: (point.y - stage.y()) / stage.scaleY()
        };
    },
    
    // Convert absolute coordinates to stage coordinates
    absoluteToStage: (stage, point) => {
        return {
            x: point.x * stage.scaleX() + stage.x(),
            y: point.y * stage.scaleY() + stage.y()
        };
    },
    
    // Apply transformation matrix to point
    transformPoint: (point, matrix) => {
        return {
            x: point.x * matrix[0] + point.y * matrix[1] + matrix[2],
            y: point.x * matrix[3] + point.y * matrix[4] + matrix[5]
        };
    },
};

