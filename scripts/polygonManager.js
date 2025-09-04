// ==================== POLYGON MANAGEMENT ====================
const PolygonManager = {
    // Create a polygon group with draggable vertices
    createPolygonGroup: (stage, layer) => {
        const group = new Konva.Group({ 
            draggable: true, 
            name: 'group',
            _id: Utils.generateId() // Add unique ID for tracking
        });
        
        // Get the center of the stage (visible area accounting for zoom/pan)
        const stageCenterX = stage.width() / 2;
        const stageCenterY = stage.height() / 2;
        
        // Convert stage center to absolute coordinates (accounting for zoom/pan)
        const absoluteCenter = {
            x: (stageCenterX - stage.x()) / stage.scaleX(),
            y: (stageCenterY - stage.y()) / stage.scaleY()
        };
        
        // Create rectangle centered on the stage
        const rectSize = 100; // Default size
        const rectPoints = [
            { x: absoluteCenter.x - rectSize/2, y: absoluteCenter.y - rectSize/2 }, 
            { x: absoluteCenter.x - rectSize/2, y: absoluteCenter.y + rectSize/2 },
            { x: absoluteCenter.x + rectSize/2, y: absoluteCenter.y + rectSize/2 }, 
            { x: absoluteCenter.x + rectSize/2, y: absoluteCenter.y - rectSize/2 }
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
                name: 'vertex',
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
                fill: isTemp ? CONFIG.DRAWING.ACTIVE_COLOR : CONFIG.VERTEX.FILL,
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
                const polygonGroup = PolygonManager.createPolygonGroupFromPoints(tempPoints);
                polygonLayer.add(polygonGroup);
                
                // Clear temporary elements
                clearTempElements();
                tempPoints = [];
                
                // Add selection event handlers to the new polygon
                addPolygonSelectionHandlers(polygonGroup);
                
                // Return the polygon group
                return polygonGroup;
            }
            return null;
        }

        function addPolygonSelectionHandlers(polygonGroup) {
            const polygon = polygonGroup.findOne('.polygon');
            
            // Click handler for selecting the polygon
            polygonGroup.on('click', (e) => {
                e.cancelBubble = true; // Prevent event from bubbling to stage
                
                // Reset previous selection visual
                polygonLayer.find('.group').forEach(group => {
                    if (group !== polygonGroup) {
                        const otherPolygon = group.findOne('.polygon');
                        if (otherPolygon) {
                            otherPolygon.stroke(CONFIG.POLYGON.STROKE);
                            otherPolygon.strokeWidth(CONFIG.POLYGON.STROKE_WIDTH);
                        }
                    }
                });
                
                // Set visual selection for this polygon
                polygon.stroke(CONFIG.POLYGON.SELECTED_STROKE);
                polygon.strokeWidth(CONFIG.POLYGON.SELECTED_STROKE_WIDTH);
                
                // Set as selected group
                if (typeof onPolygonCreated === 'function') {
                    onPolygonCreated(polygonGroup);
                }
                
                polygonLayer.batchDraw();
            });
            
            // Also add the handlers to vertices
            polygonGroup.find('.vertex').forEach(vertex => {
                vertex.on('click', (e) => {
                    e.cancelBubble = true; // Prevent event from bubbling to group
                });
            });
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
                        name: 'temp-line'
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
    },

    // Add this method to the PolygonManager object
    createPolygonGroupFromPoints: (points) => {
        const group = new Konva.Group({ 
            draggable: true, 
            name: 'group',
            _id: Utils.generateId()
        });
        
        const polygon = new Konva.Line({
            points: points.flatMap(p => [p.x, p.y]),
            stroke: CONFIG.POLYGON.STROKE, 
            strokeWidth: CONFIG.POLYGON.STROKE_WIDTH, 
            closed: CONFIG.POLYGON.CLOSED, 
            name: 'polygon'
        });
        
        group.add(polygon);

        points.forEach((point, i) => {
            const vertex = new Konva.Circle({
                x: point.x, 
                y: point.y,
                radius: CONFIG.VERTEX.RADIUS, 
                fill: CONFIG.VERTEX.FILL,
                draggable: true, 
                name: 'vertex',
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
                points[i] = { x: vertex.x(), y: vertex.y() };
                polygon.points(points.flatMap(p => [p.x, p.y]));
                GridManager.drawGrid(group, points);
            });

            group.add(vertex);
        });

        GridManager.drawGrid(group, points);
        
        // Add selection handler to the new polygon
        group.on('click', (e) => {
            e.cancelBubble = true;
            
            // This will be handled by the main selection system
        });
        
        return group;
    }
};