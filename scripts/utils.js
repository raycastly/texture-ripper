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

    // Sort vertices in counter-clockwise order
    sortVerticesCounterClockwise: (vertices) => {
        // Find centroid
        const centroid = { x: 0, y: 0 };
        vertices.forEach(v => {
            centroid.x += v.x;
            centroid.y += v.y;
        });
        centroid.x /= vertices.length;
        centroid.y /= vertices.length;
        
        // Sort by angle from centroid
        return vertices.sort((a, b) => {
            const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
            const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
            return angleA - angleB;
        });
    },
    
    // Find the top-left vertex
    findTopLeftVertex: (vertices) => {
        return vertices.reduce((topLeft, vertex) => {
            if (vertex.y < topLeft.y || (vertex.y === topLeft.y && vertex.x < topLeft.x)) {
                return vertex;
            }
            return topLeft;
        }, { x: Infinity, y: Infinity });
    },
    
    // Reorder to: top-left=1, top-right=2, bottom-right=3, bottom-left=4
    reorderPolygonVertices: (points) => {
        if (points.length !== 4) return points;
        
        // 1. FIND CENTROID (center point)
        const centroid = {
            x: (points[0].x + points[1].x + points[2].x + points[3].x) / 4,
            y: (points[0].y + points[1].y + points[2].y + points[3].y) / 4
        };
        
        // 2. CALCULATE ANGLE FROM CENTER FOR EACH POINT
        const pointsWithAngles = points.map(point => {
            const angle = Math.atan2(point.y - centroid.y, point.x - centroid.x);
            return { point, angle };
        });
        
        // 3. SORT BY ANGLE (clockwise order)
        pointsWithAngles.sort((a, b) => a.angle - b.angle);
        
        // 4. EXTRACT POINTS IN CLOCKWISE ORDER
        const clockwiseOrder = pointsWithAngles.map(item => item.point);
        
        // 5. REARRANGE TO YOUR DESIRED ORDER:
        // Clockwise order gives us: [top-left, bottom-left, bottom-right, top-right]
        // You want: [top-left, top-right, bottom-right, bottom-left]
        return [
            clockwiseOrder[0], // top-left (stays first)
            clockwiseOrder[3], // top-right (moved from fourth to second)
            clockwiseOrder[2], // bottom-right (moved from third to third)  
            clockwiseOrder[1]  // bottom-left (moved from second to fourth)
        ];
    }
};

