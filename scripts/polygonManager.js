// ==================== POLYGON MANAGEMENT ====================
const PolygonManager = {
    // Unified polygon creation function
    createPolygonGroup: (stage, layer, points = null) => {
        const group = new Konva.Group({ 
            draggable: true, 
            name: 'group',
            _id: Utils.generateId()
        });
        
        // Get vertices - either from provided points or create default rectangle
        let vertices;
        if (points && points.length === 4) {
            // REORDER vertices to ensure consistent order for both polygon types
            vertices = Utils.reorderPolygonVertices(points);
        } else {
            // Create default rectangle centered on stage
            const stageCenterX = stage.width() / 2;
            const stageCenterY = stage.height() / 2;
            
            // Convert stage center to absolute coordinates
            const absoluteCenter = {
                x: (stageCenterX - stage.x()) / stage.scaleX(),
                y: (stageCenterY - stage.y()) / stage.scaleY()
            };
            
            // Create rectangle centered on the stage
            const rectSize = 100;
            vertices = [
                { x: absoluteCenter.x - rectSize/2, y: absoluteCenter.y - rectSize/2 }, // Top-left (1)
                { x: absoluteCenter.x - rectSize/2, y: absoluteCenter.y + rectSize/2 }, // Bottom-left (2)
                { x: absoluteCenter.x + rectSize/2, y: absoluteCenter.y + rectSize/2 }, // Bottom-right (3)
                { x: absoluteCenter.x + rectSize/2, y: absoluteCenter.y - rectSize/2 }  // Top-right (4)
            ];
        }
        
        // Create midpoints for each edge
        const midpoints = [];
        for (let i = 0; i < vertices.length; i++) {
            const nextIdx = (i + 1) % vertices.length;
            midpoints.push({
                x: (vertices[i].x + vertices[nextIdx].x) / 2,
                y: (vertices[i].y + vertices[nextIdx].y) / 2,
                locked: false
            });
        }

        // Create a more accurate drag surface that follows the curved edges
        const createCurvedDragSurface = (vertices, midpoints) => {
            const points = [];

            for (let i = 0; i < vertices.length; i++) {
                const nextIdx = (i + 1) % vertices.length;
                const P0 = vertices[i];
                const P2 = vertices[nextIdx];
                const M  = midpoints[i]; // single control point

                const numSamples = 10; // resolution
                for (let j = 0; j <= numSamples; j++) {
                    const t = j / numSamples;
                    const mt = 1 - t;

                    const x = mt*mt*P0.x + 2*mt*t*M.x + t*t*P2.x;
                    const y = mt*mt*P0.y + 2*mt*t*M.y + t*t*P2.y;

                    points.push(x, y);
                }
            }

            return points;
        };

        const dragSurfacePoints = createCurvedDragSurface(vertices, midpoints);
        const dragSurface = new Konva.Line({
            points: dragSurfacePoints,
            closed: true,
            fill: 'rgba(0,0,0,0.01)', // Very slight transparency for better hit detection
            strokeWidth: 0,
            name: 'drag-surface',
            listening: true // Ensure it listens to events
        });
        
        group.add(dragSurface);
        dragSurface.moveToBottom();

        // Draw the curved polygon
        PolygonManager.drawCurvedPolygon(group, vertices, midpoints);
        GridManager.drawGrid(group, vertices, midpoints);

        // Store references
        group.vertices = vertices;
        group.midpoints = midpoints;

        // Add vertices
        vertices.forEach((point, i) => {
            const vertex = new Konva.Rect({
                x: point.x,
                y: point.y,
                offsetX: CONFIG.VERTEX.RADIUS,
                offsetY: CONFIG.VERTEX.RADIUS,
                width: CONFIG.VERTEX.RADIUS * 2,
                height: CONFIG.VERTEX.RADIUS * 2,
                fill: CONFIG.VERTEX.FILL,
                stroke: CONFIG.VERTEX.STROKE, // outline color
                strokeWidth: CONFIG.VERTEX.STROKE_WIDTH, // outline thickness
                draggable: true,
                name: 'vertex',
                hitFunc: function (context) {
                    const enlargedRadius = CONFIG.VERTEX.RADIUS + CONFIG.VERTEX.RESPONSIVERADIUS;
                    context.beginPath();
                    context.rect(-enlargedRadius, -enlargedRadius, enlargedRadius * 2, enlargedRadius * 2);
                    context.closePath();
                    context.fillStrokeShape(this);
                }
            });

            // Add vertex number label for debugging
            const label = new Konva.Text({
                x: point.x,
                y: point.y,
                text: (i + 1).toString(),
                fontSize: 7,
                fill: 'red',
                offsetX: CONFIG.VERTEX.RADIUS,
                offsetY: 10,
                listening: false,
                name: 'vertex-label'
            });

            vertex.on('dragmove', () => {
                // Update vertex position
                vertices[i] = { x: vertex.x(), y: vertex.y() };

                // Update label position when vertex moves
                label.position({ x: vertex.x(), y: vertex.y() });
                
                // Update adjacent midpoints to maintain relative position
                const prevIdx = (i + vertices.length - 1) % vertices.length;
                const nextIdx = (i + 1) % vertices.length;
                
                // Update previous edge midpoint if not locked
                if (!midpoints[prevIdx].locked) {
                    midpoints[prevIdx].x = (vertices[prevIdx].x + vertices[i].x) / 2;
                    midpoints[prevIdx].y = (vertices[prevIdx].y + vertices[i].y) / 2;
                }

                // Update next edge midpoint if not locked
                if (!midpoints[i].locked) {
                    midpoints[i].x = (vertices[i].x + vertices[nextIdx].x) / 2;
                    midpoints[i].y = (vertices[i].y + vertices[nextIdx].y) / 2;
                }
                
                // Update polygon and grid
                PolygonManager.drawCurvedPolygon(group, vertices, midpoints);
                GridManager.drawGrid(group, vertices, midpoints);
                
                // Update midpoint visual positions
                group.find('.midpoint').forEach((midpoint, idx) => {
                    midpoint.position(midpoints[idx]);
                });
                
                // Update drag surface with curved edges
                const updatedPoints = createCurvedDragSurface(vertices, midpoints);
                PolygonManager.updateDragSurface(group, updatedPoints);

                // Update reference circles
                group.referencePoints.forEach((ref, idx) => {
                    const v1 = vertices[idx];
                    const v2 = vertices[(idx + 1) % vertices.length];
                    ref.position({
                        x: (v1.x + v2.x) / 2,
                        y: (v1.y + v2.y) / 2
                    });
                });
            });

            // Prevent click events from bubbling to group
            vertex.on('click', (e) => {
                e.cancelBubble = true;
            });

            group.add(vertex);
            group.add(label);
        });

        // Add reference midpoints (non-interactable, bigger marker)
        const referencePoints = [];
        vertices.forEach((point, i) => {
            const nextIdx = (i + 1) % vertices.length;
            const refX = (vertices[i].x + vertices[nextIdx].x) / 2;
            const refY = (vertices[i].y + vertices[nextIdx].y) / 2;

            const reference = new Konva.Circle({
                x: refX,
                y: refY,
                radius: CONFIG.MIDPOINT.REFERENCE.RADIUS, // bigger than midpoint
                fill: CONFIG.MIDPOINT.REFERENCE.FILL,
                stroke: CONFIG.MIDPOINT.REFERENCE.STROKE,
                strokeWidth: CONFIG.MIDPOINT.REFERENCE.STROKE_WIDTH,
                name: 'reference',
                listening: false  // makes it non-interactable
            });

            group.add(reference);
            referencePoints.push(reference);
        });

        // store them so we can update later
        group.referencePoints = referencePoints;

        // Add midpoints
        midpoints.forEach((point, i) => {
            const midpoint = new Konva.Circle({
                x: point.x,
                y: point.y,
                radius: CONFIG.MIDPOINT.RADIUS,
                fill: CONFIG.MIDPOINT.FILL,
                stroke: CONFIG.MIDPOINT.STROKE, // outline color
                strokeWidth: CONFIG.MIDPOINT.STROKE_WIDTH, // outline thickness
                draggable: true,
                name: 'midpoint',
                hitFunc: function(context) {
                    const enlargedRadius = CONFIG.MIDPOINT.RADIUS + CONFIG.MIDPOINT.RESPONSIVE_RADIUS;
                    context.beginPath();
                    context.arc(0, 0, enlargedRadius, 0, Math.PI * 2);
                    context.closePath();
                    context.fillStrokeShape(this);
                }
            });
            
            midpoint.on('dragmove', () => {
                // If this is the first manual drag, lock it
                if (!midpoints[i].locked) midpoints[i].locked = true;

                // Update midpoint position
                midpoints[i].x = midpoint.x();
                midpoints[i].y = midpoint.y();
                
                // Update polygon and grid
                PolygonManager.drawCurvedPolygon(group, vertices, midpoints);
                GridManager.drawGrid(group, vertices, midpoints);
                
                // Update drag surface with curved edges
                const updatedPoints = createCurvedDragSurface(vertices, midpoints);
                PolygonManager.updateDragSurface(group, updatedPoints);
            });
            
            // Prevent click events from bubbling to group
            midpoint.on('click', (e) => {
                e.cancelBubble = true;
            });
            
            group.add(midpoint);
        });

        GridManager.drawGrid(group, vertices, midpoints);
        
        // Add to layer if provided
        if (layer) {
            layer.add(group);
        }
        
        return group;
    },

    // Keep this as a wrapper for backward compatibility
    createPolygonGroupFromPoints: (points) => {
        return PolygonManager.createPolygonGroup(null, null, points);
    },

    // Draw the curved polygon with sharp corners and proper bezier curves
    drawCurvedPolygon: (group, vertices, midpoints) => {
        // Remove existing polygon edges
        group.find('.polygon').forEach(polygon => polygon.destroy());

        const allPoints = [];

        for (let i = 0; i < vertices.length; i++) {
            const nextIdx = (i + 1) % vertices.length;
            const P0 = vertices[i];
            const P2 = vertices[nextIdx];
            const M  = midpoints[i]; // single control point

            if (i === 0) {
                allPoints.push(P0.x, P0.y); // move to starting vertex
            }

            const numSamples = 20; // resolution
            for (let j = 1; j <= numSamples; j++) {
                const t = j / numSamples;
                const mt = 1 - t;

                const x = mt*mt*P0.x + 2*mt*t*M.x + t*t*P2.x;
                const y = mt*mt*P0.y + 2*mt*t*M.y + t*t*P2.y;

                allPoints.push(x, y);
            }
        }

        const polygon = new Konva.Line({
            points: allPoints,
            stroke: CONFIG.POLYGON.STROKE,
            strokeWidth: CONFIG.POLYGON.STROKE_WIDTH,
            name: 'polygon',
            lineCap: 'round',
            lineJoin: 'round',
            closed: true,
            dash: CONFIG.POLYGON.DASH,
        });

        group.add(polygon);
    },

    // Helper to update drag surface
    updateDragSurface: (group, points) => {
        const dragSurface = group.findOne('.drag-surface');
        if (dragSurface) {
            dragSurface.points(points);
        }

        // Make sure vertices and midpoints are always on top
        group.find('.vertex').forEach(v => v.moveToTop());
        group.find('.midpoint').forEach(m => m.moveToTop());
    },

    // Get the Konva.Image objects underneath a polygon group
    getUnderlyingImages: (group, stage) => {
        const images = stage.find('Image');
        if (!images || images.length === 0) return [];

        const groupBox = group.getClientRect();
        const intersectingImages = images.filter(img => {
            const imgBox = img.getClientRect();
            return (
                groupBox.x + groupBox.width > imgBox.x &&
                groupBox.x < imgBox.x + imgBox.width &&
                groupBox.y + groupBox.height > imgBox.y &&
                groupBox.y < imgBox.y + imgBox.height
            );
        });

        // Return only the topmost image (last in Konva's drawing order)
        return intersectingImages.length > 0 ? [intersectingImages[intersectingImages.length - 1]] : [];
    },

    initDrawingMode: (stage, polygonLayer, getDrawingMode, onPolygonCreated) => {
        const drawingGroup = new Konva.Group();
        polygonLayer.add(drawingGroup);
        
        let tempPoints = [];
        let tempLines = [];
        let tempVertices = [];
        
        function clearTempElements() {
            tempLines.forEach(line => line.destroy());
            tempVertices.forEach(vertex => vertex.destroy());
            tempLines = [];
            tempVertices = [];
        }
        
        function createDrawingVertex(x, y, isTemp = false) {
            const vertex = new Konva.Circle({
                x, y,
                radius: CONFIG.VERTEX.RADIUS,
                fill: CONFIG.VERTEX.FILL,
                stroke: CONFIG.VERTEX.STROKE, // outline color
                strokeWidth: CONFIG.VERTEX.STROKE_WIDTH, // outline thickness
                draggable: true,
                name: isTemp ? 'temp-vertex' : 'vertex',
                // Use custom hit function for reliable larger hit area
                hitFunc: function(context) {
                    const enlargedRadius = CONFIG.VERTEX.RADIUS + CONFIG.VERTEX.RESPONSIVERADIUS; // larger hit area
                    context.beginPath();
                    context.arc(0, 0, enlargedRadius, 0, Math.PI * 2);
                    context.closePath();
                    context.fillStrokeShape(this);
                }
            });
            
            vertex.on('dragmove', () => {
                if (isTemp) {
                    // Update the last temporary point position
                    if (tempPoints.length > 0) {
                        tempPoints[tempPoints.length - 1] = { x: vertex.x(), y: vertex.y() };
                        updateTempLine();
                    }
                }
            });
            
            return vertex;
        }
        
        function updateTempLine() {
            if (tempLines.length > 0 && tempPoints.length >= 2) {
                const lastLine = tempLines[tempLines.length - 1];
                const points = [
                    tempPoints[tempPoints.length - 2].x, tempPoints[tempPoints.length - 2].y,
                    tempPoints[tempPoints.length - 1].x, tempPoints[tempPoints.length - 1].y
                ];
                lastLine.points(points);
            }
        }
        
        function completePolygon() {
            if (tempPoints.length === 4) {
                // REORDER vertices to match regular polygon order
                const reorderedPoints = Utils.reorderPolygonVertices(tempPoints);
                
                // Create new edges between the reordered points
                const updatedPoints = [];
                for (let i = 0; i < 4; i++) {
                    updatedPoints.push(reorderedPoints[i]);
                    // Connect to next point (with wrap-around)
                    if (i < 3) {
                        updatedPoints.push(reorderedPoints[i + 1]);
                    }
                }
                // Connect last point back to first
                updatedPoints.push(reorderedPoints[3]);
                updatedPoints.push(reorderedPoints[0]);
                
                const polygonGroup = PolygonManager.createPolygonGroup(stage, polygonLayer, reorderedPoints);
                
                // Clear temporary elements
                clearTempElements();
                tempPoints = [];
                
                if (typeof onPolygonCreated === 'function') {
                    onPolygonCreated(polygonGroup);
                }
                
                return polygonGroup;
            }
            return null;
        }

        function addPolygonSelectionHandlers(polygonGroup) {
            // Handler is now added in createPolygonGroup itself
            // Just call the onPolygonCreated callback if provided
            if (typeof onPolygonCreated === 'function') {
                onPolygonCreated(polygonGroup);
            }
        }
        
        // Event handlers
        const clickHandler = (e) => {
            // Don't process clicks if panning is active
            if (PanZoomManager.isPanning) return;
    
            // Only respond to left mouse button (button 0)
            if (e.evt.button !== 0) return;
            
            if (!getDrawingMode()) return;
            
            // Don't process clicks on existing polygons or their parts
            let node = e.target;
            let clickedOnExistingPolygon = false;
            
            while (node && node !== stage) {
                if (node instanceof Konva.Group && node.name() === 'group') {
                    clickedOnExistingPolygon = true;
                    break;
                }
                node = node.getParent();
            }
            
            if (clickedOnExistingPolygon) return;
            
            // Allow clicking on any part of the stage, not just empty space
            const pos = stage.getPointerPosition();
            
            // Convert to stage coordinates (accounting for pan/zoom)
            const stageX = (pos.x - stage.x()) / stage.scaleX();
            const stageY = (pos.y - stage.y()) / stage.scaleY();
            
            if (tempPoints.length < 4) {
                // Add point
                tempPoints.push({ x: stageX, y: stageY });
                
                // Create vertex
                const vertex = createDrawingVertex(stageX, stageY, tempPoints.length < 4);
                drawingGroup.add(vertex);
                tempVertices.push(vertex);
                
                // Create line if we have at least 2 points
                if (tempPoints.length >= 2) {
                    const line = new Konva.Line({
                        points: [
                            tempPoints[tempPoints.length - 2].x, tempPoints[tempPoints.length - 2].y,
                            tempPoints[tempPoints.length - 1].x, tempPoints[tempPoints.length - 1].y
                        ],
                        stroke: CONFIG.DRAWING.ACTIVE_COLOR,
                        strokeWidth: CONFIG.POLYGON.STROKE_WIDTH,
                        name: 'temp-line',
                        dash: [5, 5]
                    });
                    drawingGroup.add(line);
                    tempLines.push(line);
                }
                
                // If we have 4 points, complete the polygon
                if (tempPoints.length === 4) {
                    const completedPolygon = completePolygon();
                    if (completedPolygon) {
                        // Set the new polygon as the selected group
                        if (typeof onPolygonCreated === 'function') {
                            onPolygonCreated(completedPolygon);
                        }
                    }
                }
            }
        };

        const mouseMoveHandler = () => {
            // Don't process mouse movement if panning is active
            if (PanZoomManager.isPanning) return;
            
            if (!getDrawingMode() || tempPoints.length === 4) return;
            
            const pos = stage.getPointerPosition();
            
            // Convert to stage coordinates (accounting for pan/zoom)
            const stageX = (pos.x - stage.x()) / stage.scaleX();
            const stageY = (pos.y - stage.y()) / stage.scaleY();
            
            // Update or create temporary vertex
            if (tempVertices.length > tempPoints.length) {
                // Update existing temp vertex
                const tempVertex = tempVertices[tempVertices.length - 1];
                tempVertex.position({ x: stageX, y: stageY });
            } else if (tempPoints.length > 0) {
                // Create new temp vertex
                const tempVertex = createDrawingVertex(stageX, stageY, true);
                drawingGroup.add(tempVertex);
                tempVertices.push(tempVertex);
                updateTempLine();
            }
        };
        
        const contextMenuHandler = (e) => {
            // Use the passed function to get drawing mode state
            if (getDrawingMode()) {
                e.evt.preventDefault();
                clearTempElements();
            }
        };
        
        // Register event listeners
        stage.on('click', clickHandler);
        stage.on('mousemove', mouseMoveHandler);
        stage.on('contextmenu', contextMenuHandler);
        
        // Return cleanup function
        return {
            clearTempElements: () => {
                clearTempElements();
                tempPoints = [];
            },
            removeEventListeners: () => {
                stage.off('click', clickHandler);
                stage.off('mousemove', mouseMoveHandler);
                stage.off('contextmenu', contextMenuHandler);
                drawingGroup.destroy();
            }
        };
    }
};