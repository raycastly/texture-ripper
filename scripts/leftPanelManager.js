// ==================== LEFT PANEL MANAGEMENT ====================
const LeftPanelManager = {
    // Initialize the left panel
    init: (containerId, addBtnId, deleteBtnId, uploadId) => {
        const dirtyPolygons = new Set();

        const container = document.getElementById(containerId);
        const stage = new Konva.Stage({ 
            container: containerId, 
            width: container.clientWidth, 
            height: container.clientHeight
        });

        const uiLayer = new Konva.Layer();
        const bgLayer = new Konva.Layer();
        const polygonLayer = new Konva.Layer();

        stage.add(bgLayer).add(polygonLayer).add(uiLayer);

        const bgImages = []; // Store multiple images
        let selectedGroup = null;
        let imagesLocked = false; // Track lock state
        
        // Drawing mode state variables
        let drawingMode = false;
        let drawingModeHandlers = null;

        // Lock/Unlock Images button
        const lockBtn = document.getElementById('lockImagesLeft');
        lockBtn.addEventListener('click', () => {
            imagesLocked = !imagesLocked;
            lockBtn.textContent = imagesLocked ? 'Unlock Images' : 'Lock Images';
            lockBtn.classList.toggle("locked");

            // Update draggable state of all background images
            bgImages.forEach(img => {
                img.draggable(!imagesLocked);
            });
            
            // Also update transformer state
            if (imagesLocked && tr.nodes().length > 0) {
                const selectedImage = tr.nodes()[0];
                if (selectedImage instanceof Konva.Image) {
                    tr.nodes([]); // Deselect any selected image when locking
                }
            }
            
            bgLayer.batchDraw();
        });

        // Clipboard paste handler with feedback
        document.addEventListener('paste', (e) => {
            // Don't handle paste events if we're in drawing mode
            if (drawingMode) return;
            
            // Check if we're pasting image data
            const items = e.clipboardData.items;
            let imageFound = false;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    imageFound = true;
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    
                    reader.onload = (evt) => {
                        const img = new Image();
                        img.onload = () => {
                            const scale = Math.min(stage.width() / img.width, stage.height() / img.height);

                            const konvaImg = new Konva.Image({
                                x: (stage.width() - img.width * scale) / 2,
                                y: (stage.height() - img.height * scale) / 2,
                                image: img,
                                width: img.width * scale,
                                height: img.height * scale,
                                draggable: !imagesLocked
                            });

                            bgLayer.add(konvaImg);
                            bgImages.push(konvaImg);
                            bgLayer.batchDraw();
                            
                            // Show feedback
                            FeedbackManager.show('Image pasted successfully!');
                        };
                        img.src = evt.target.result;
                    };
                    reader.readAsDataURL(blob);
                    break; // Only handle the first image
                }
            }
            
            if (!imageFound) {
                FeedbackManager.show('No image found in clipboard');
            }
        });

        // Drawing mode toggle button
        document.getElementById('toggleDrawingMode').addEventListener('click', () => {
            drawingMode = !drawingMode;
            const button = document.getElementById('toggleDrawingMode');
            button.classList.toggle('drawing-active');
            
            if (drawingMode) {
                button.textContent = 'Exit Drawing Mode';
                // Initialize drawing mode with callback for when polygon is created
                drawingModeHandlers = PolygonManager.initDrawingMode(
                    stage, 
                    polygonLayer, 
                    () => drawingMode,
                    (newPolygon) => {
                        // Set the newly created polygon as selected
                        selectedGroup = newPolygon;
                    },
                    dirtyPolygons
                );
            } else {
                button.textContent = 'Drawing Mode';
                cancelDrawing();
            }
        });

        // Cancel drawing function
        const cancelDrawing = () => {
            if (drawingModeHandlers) {
                drawingModeHandlers.clearTempElements();
                drawingModeHandlers.removeEventListeners();
                drawingModeHandlers = null;
                drawingMode = false;
            }
        };

        // ESC key handler for canceling drawing
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawingMode) {
                cancelDrawing();
                document.getElementById('toggleDrawingMode').textContent = 'Drawing Mode';
                drawingMode = false;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteSelectedObjects();
            }
        });

        // Extract All button
        document.getElementById('extractAllLeft').addEventListener('click', () => {
            polygonLayer.find('.group').forEach(async group => {
                if (!dirtyPolygons.has(group._id)) return; // skip unchanged polygons

                const overlappingImgs = PolygonManager.getUnderlyingImages(group, stage);
                if (!overlappingImgs.length) return;

                const topmostImage = overlappingImgs[0];
                const textureData = ImageProcessing.extractTexture(group, topmostImage);

                if (textureData && window.rightPanel) {
                    window.rightPanel.updateTexture(group._id, textureData);
                }
            });

            // Clear dirty set after extraction
            dirtyPolygons.clear();
        });

        // Upload handler
        document.getElementById(uploadId).addEventListener('change', e => {
            const file = e.target.files[0]; 
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = evt => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(stage.width() / img.width, stage.height() / img.height);

                    const konvaImg = new Konva.Image({
                        x: (stage.width() - img.width * scale) / 2,
                        y: (stage.height() - img.height * scale) / 2,
                        image: img,
                        width: img.width * scale,
                        height: img.height * scale,
                        draggable: !imagesLocked // Set initial draggable state based on lock status
                    });

                    bgLayer.add(konvaImg);
                    bgImages.push(konvaImg);
                    bgLayer.batchDraw();
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Initialize drag and drop
        const dragDropHandler = DragDropManager.init(
            container,
            (files) => {
                DragDropManager.handleImageFiles(
                    files,
                    stage,
                    bgLayer,
                    bgImages,
                    imagesLocked
                );
            },
            {
                showOverlay: true,
                overlayId: 'leftPanelDropOverlay'
            }
        );

        // Add polygon button
        document.getElementById(addBtnId).addEventListener('click', () => {
            const newGroup = PolygonManager.createPolygonGroup(stage, polygonLayer, null, dirtyPolygons);
            setSelectedPolygon(newGroup);
        });

        // Delete button
        document.getElementById(deleteBtnId).addEventListener('click', () => {
            deleteSelectedObjects();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawingMode) {
                cancelDrawing();
                document.getElementById('toggleDrawingMode').textContent = 'Drawing Mode';
                drawingMode = false;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteSelectedObjects();
            }
        });

        function setSelectedPolygon(group) {
            // Clear previous selection
            if (selectedGroup && selectedGroup !== group) {
                const prevPolygon = selectedGroup.findOne('.polygon');
                if (prevPolygon) {
                    prevPolygon.stroke(CONFIG.POLYGON.STROKE);
                    prevPolygon.strokeWidth(CONFIG.POLYGON.STROKE_WIDTH);
                }
            }
            
            // Clear image selection
            tr.nodes([]);
            
            // Set new selection
            selectedGroup = group;
            if (selectedGroup) {
                const polygon = selectedGroup.findOne('.polygon');
                if (polygon) {
                    polygon.stroke(CONFIG.POLYGON.SELECTED_STROKE);
                    polygon.strokeWidth(CONFIG.POLYGON.SELECTED_STROKE_WIDTH);
                }
            }
            
            polygonLayer.draw();
        }

        // Helper function for deleting selected objects
        function deleteSelectedObjects() {
            // Case 1: polygon selected
            if (selectedGroup) {
                if (window.rightPanel) window.rightPanel.removeTexture(selectedGroup._id);
                selectedGroup.destroy();
                selectedGroup = null;
                polygonLayer.draw();
                return;
            }

            // Case 2: background image selected with transformer
            const selectedNodes = tr.nodes();
            if (selectedNodes.length > 0) {
                selectedNodes.forEach(node => {
                    if (node instanceof Konva.Image) {
                        node.destroy();
                        // Remove from bgImages array
                        const index = bgImages.indexOf(node);
                        if (index > -1) {
                            bgImages.splice(index, 1);
                        }
                    }
                });
                tr.nodes([]); // clear transformer
                bgLayer.draw();
            }
        }

        // Transformer for background images only
        const tr = new Konva.Transformer({
            keepRatio: true,
            rotateEnabled: false,
            enabledAnchors: [
                'top-left','top-right',
                'bottom-left','bottom-right'
            ]
        });
        uiLayer.add(tr);

        // Click to select background image or polygon
        stage.on('click', (e) => {
            // Don't process clicks if we're in drawing mode
            if (drawingMode) return;
            
            // Reset previous selection visual for polygons
            if (selectedGroup) {
                const polygon = selectedGroup.findOne('.polygon');
                if (polygon) {
                    polygon.stroke(CONFIG.POLYGON.STROKE);
                    polygon.strokeWidth(CONFIG.POLYGON.STROKE_WIDTH);
                }
            }
            
            // Reset selection
            let selectedImage = null;
            selectedGroup = null;
            tr.nodes([]);
            
            // Check what was clicked
            const clickedNode = e.target;
            
            // Handle polygon selection
            if (clickedNode instanceof Konva.Group && clickedNode.name() === 'group') {
                setSelectedPolygon(clickedNode);
            } 
            // Handle polygon parts (vertices, midpoints, edges, drag surface)
            else if (clickedNode.getParent() instanceof Konva.Group && clickedNode.getParent().name() === 'group') {
                setSelectedPolygon(clickedNode.getParent());
            }
            // Handle background image selection (only if not locked)
            else if (clickedNode instanceof Konva.Image && !imagesLocked) {
                selectedImage = clickedNode;
                tr.nodes([selectedImage]);
            }
            // Click on empty space: clear all selection
            else if (clickedNode === stage || clickedNode.name() === 'bgRect') {
                tr.nodes([]);
                selectedGroup = null;
            }
            
            bgLayer.batchDraw();
            polygonLayer.batchDraw();
        });

        // Keyboard handlers for transformer
        stage.on('keydown', (e) => {
            if (e.key === 'Shift') tr.keepRatio(true);
        });
        
        stage.on('keyup', (e) => {
            if (e.key === 'Shift') tr.keepRatio(false);
        });

        // Initialize panning and zooming
        PanZoomManager.initPanning(stage);
        PanZoomManager.initZooming(stage);

        // Creating API for unselecting all elements
        window.leftPanel = {
            unselectAll: () => {
                // Reset previous selection visual for polygons
                if (selectedGroup) {
                    const polygon = selectedGroup.findOne('.polygon');
                    if (polygon) {
                        polygon.stroke(CONFIG.POLYGON.STROKE);
                        polygon.strokeWidth(CONFIG.POLYGON.STROKE_WIDTH);
                    }
                }
                selectedGroup = null;

                tr.nodes([]);
                bgLayer.batchDraw();
                polygonLayer.batchDraw();
            }
        };

        return stage;
    }
};