// ==================== LEFT PANEL MANAGEMENT ====================
const LeftPanelManager = {
    // Initialize the left panel
    init: (containerId, addBtnId, deleteBtnId, uploadId) => {
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
                            showPasteFeedback('Image pasted successfully!');
                        };
                        img.src = evt.target.result;
                    };
                    reader.readAsDataURL(blob);
                    break; // Only handle the first image
                }
            }
            
            if (!imageFound) {
                showPasteFeedback('No image found in clipboard');
            }
        });

        // Function to show paste feedback
        function showPasteFeedback(message) {
            // Create or get feedback element
            let feedbackEl = document.getElementById('paste-feedback');
            if (!feedbackEl) {
                feedbackEl = document.createElement('div');
                feedbackEl.id = 'paste-feedback';
                feedbackEl.className = 'paste-feedback';
                document.body.appendChild(feedbackEl);
            }
            
            feedbackEl.textContent = message;
            feedbackEl.classList.add('show');
            
            setTimeout(() => {
                feedbackEl.classList.remove('show');
            }, 2000);
        }

        // Drawing mode toggle button
        document.getElementById('toggleDrawingMode').addEventListener('click', () => {
            drawingMode = !drawingMode;
            const button = document.getElementById('toggleDrawingMode');
            
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
                        // Auto-exit drawing mode after creating a polygon
                        //cancelDrawing();
                    }
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
                drawingModeHandlers.removeEventListeners(); // Add this line
                drawingModeHandlers = null; // Add this line
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
        });

        // Extract All button
        document.getElementById('extractAllLeft').addEventListener('click', () => {
            polygonLayer.find('.group').forEach(async group => {
                const overlappingImgs = PolygonManager.getUnderlyingImages(group, stage);
                if (!overlappingImgs.length) return;

                // Use only the topmost image
                const topmostImage = overlappingImgs[0];
                const textureData = ImageProcessing.extractTexture(group, topmostImage);
                
                if (textureData && window.rightPanel) {
                    window.rightPanel.updateTexture(group._id, textureData);
                }
            });
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

        // Add polygon button
        document.getElementById(addBtnId).addEventListener('click', () => {
            const newGroup = PolygonManager.createPolygonGroup(stage, polygonLayer);
            polygonLayer.add(newGroup);
            setSelectedPolygon(newGroup);
        });

        // Delete button
        // In leftPanelManager.js, update the delete button handler and key handler
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

        // Add this helper function for deleting selected objects
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

        // Click to select background image or polygon (only if not locked)
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
            if (e.target instanceof Konva.Image && !imagesLocked) {
                selectedImage = e.target;
                tr.nodes([selectedImage]);
            } 
            else {
                // Check if clicked on polygon or its parts (vertex, polygon line, etc.)
                let node = e.target;
                let foundGroup = null;
                
                // Traverse up the parent chain to find the polygon group
                while (node && node !== stage) {
                    if (node instanceof Konva.Group && node.name() === 'group') {
                        foundGroup = node;
                        break;
                    }
                    node = node.getParent();
                }
                
                if (foundGroup) {
                    setSelectedPolygon(foundGroup);
                }
            }
            
            bgLayer.batchDraw();
            polygonLayer.batchDraw();
        });

        // Also update the deleteSelectedObjects function to be more explicit:
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
            
            // If nothing is selected, do nothing (as requested)
        }

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

        return stage;
    }
};