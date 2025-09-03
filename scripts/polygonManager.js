// ==================== POLYGON MANAGEMENT ====================
const PolygonManager = {
    // Create a polygon group with draggable vertices
    createPolygonGroup: (stage, layer) => {
        const group = new Konva.Group({ 
            draggable: true, 
            name: 'group',
            _id: Utils.generateId() // Add unique ID for tracking
        });
        
        const rectPoints = [
            { x: 50, y: 50 }, 
            { x: 50, y: 150 },
            { x: 150, y: 150 }, 
            { x: 150, y: 50 }
        ];

        const polygon = new Konva.Line({
            points: rectPoints.flatMap(p => [p.x, p.y]),
            stroke: CONFIG.POLYGON.STROKE, 
            strokeWidth: CONFIG.POLYGON.STROKE_WIDTH, 
            closed: CONFIG.POLYGON.CLOSED, 
            name: 'polygon'
        });
        
        group.add(polygon);

        rectPoints.forEach((point, i) => {
            const vertex = new Konva.Circle({
                x: point.x, 
                y: point.y,
                radius: CONFIG.VERTEX.RADIUS, 
                fill: CONFIG.VERTEX.FILL,
                draggable: true, 
                name: 'vertex'
            });

            vertex.on('dragmove', () => {
                rectPoints[i] = { x: vertex.x(), y: vertex.y() };
                polygon.points(rectPoints.flatMap(p => [p.x, p.y]));
                GridManager.drawGrid(group, rectPoints);
            });

            group.add(vertex);
        });

        GridManager.drawGrid(group, rectPoints);
        return group;
    },
    
    // Get the Konva.Image objects underneath a polygon group
    getUnderlyingImages: (group, stage) => {
        const images = stage.find('Image');
        if (!images || images.length === 0) return [];

        const groupBox = group.getClientRect(); // Absolute coordinates
        return images.filter(img => {
            const imgBox = img.getClientRect();
            return (
                groupBox.x + groupBox.width > imgBox.x &&
                groupBox.x < imgBox.x + imgBox.width &&
                groupBox.y + groupBox.height > imgBox.y &&
                groupBox.y < imgBox.y + imgBox.height
            );
        });
    }
};