// ==================== GRID MANAGEMENT ====================
const GridManager = {
    // Draw a simple 3x3 grid inside a polygon
    drawGrid: (group, rectPoints) => {
        group.find('.grid').forEach(g => g.destroy());
        if (rectPoints.length !== 4) return;

        const [p1, p2, p3, p4] = rectPoints;

        for (let t of [1/3, 2/3]) {
            const left = Utils.lerp(p1, p2, t);
            const right = Utils.lerp(p4, p3, t);
            group.add(new Konva.Line({ 
                points: [left.x, left.y, right.x, right.y], 
                stroke: CONFIG.GRID.STROKE, 
                strokeWidth: CONFIG.GRID.STROKE_WIDTH, 
                name: 'grid' 
            }));
            
            const top = Utils.lerp(p1, p4, t);
            const bottom = Utils.lerp(p2, p3, t);
            group.add(new Konva.Line({ 
                points: [top.x, top.y, bottom.x, bottom.y], 
                stroke: CONFIG.GRID.STROKE, 
                strokeWidth: CONFIG.GRID.STROKE_WIDTH, 
                name: 'grid' 
            }));
        }
    }
};

