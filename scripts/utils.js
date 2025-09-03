// ==================== UTILITY FUNCTIONS ====================
const Utils = {
    // Linear interpolation
    lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
    
    // Euclidean distance
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    
    // Clamp value between min and max
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    
    // Generate a unique ID
    generateId: () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
};

