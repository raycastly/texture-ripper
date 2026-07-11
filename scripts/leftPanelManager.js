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

        // Helper to create a background image with undo support
        function addBackgroundImage(img) {
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

            // Undo for image add
            UndoManager.push({
                undo: () => {
                    konvaImg.remove();
                    const idx = bgImages.indexOf(konvaImg);
                    if (idx > -1) bgImages.splice(idx, 1);
                    tr.nodes([]);
                    bgLayer.batchDraw();
                },
                redo: () => {
                    bgLayer.add(konvaImg);
                    bgImages.push(konvaImg);
                    bgLayer.batchDraw();
                }
            });

            return konvaImg;
        }

        // Lock/Unlock Images button
        const lockBtn = document.getElementById('lockImagesLeft');
        lockBtn.addEventListener('click', () => {
            imagesLocked = !imagesLocked;
            //lockBtn.textContent = imagesLocked ? 'Unlock Images' : 'Lock Images';
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
                            addBackgroundImage(img);
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
                //button.textContent = 'Exit Drawing Mode';
                // Initialize drawing mode with callback for when polygon is created
                drawingModeHandlers = PolygonManager.initDrawingMode(
                    stage,
                    polygonLayer,
                    () => drawingMode,
                    (newPolygon) => {
                        selectedGroup = newPolygon;
                        // Guard against duplicate callback (initDrawingMode fires twice)
                        if (!newPolygon._undoPushed) {
                            newPolygon._undoPushed = true;
                            UndoManager.push({
                                undo: () => {
                                    newPolygon.remove();
                                    dirtyPolygons.delete(newPolygon._id);
                                    if (selectedGroup === newPolygon) selectedGroup = null;
                                    polygonLayer.batchDraw();
                                },
                                redo: () => {
                                    polygonLayer.add(newPolygon);
                                    dirtyPolygons.add(newPolygon._id);
                                    selectedGroup = newPolygon;
                                    polygonLayer.batchDraw();
                                }
                            });
                        }
                    },
                    dirtyPolygons
                );
            } else {
                //button.textContent = 'Drawing Mode';
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
                    addBackgroundImage(img);
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Initialize drag and drop
        const dragDropHandler = DragDropManager.init(
            container,
            (files) => {
                let loaded = 0;
                const total = files.length;
                UndoManager.beginBatch();
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = evt => {
                        const img = new Image();
                        img.onload = () => {
                            addBackgroundImage(img);
                            loaded++;
                            if (loaded === total) {
                                UndoManager.endBatch();
                                FeedbackManager.show(`${total} image(s) dropped`);
                            }
                        };
                        img.src = evt.target.result;
                    };
                    reader.readAsDataURL(file);
                });
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
            UndoManager.push({
                undo: () => {
                    newGroup.remove();
                    dirtyPolygons.delete(newGroup._id);
                    if (selectedGroup === newGroup) selectedGroup = null;
                    polygonLayer.batchDraw();
                },
                redo: () => {
                    polygonLayer.add(newGroup);
                    dirtyPolygons.add(newGroup._id);
                    setSelectedPolygon(newGroup);
                    polygonLayer.batchDraw();
                }
            });
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

        // Helper function for deleting selected objects (with undo)
        function deleteSelectedObjects() {
            // Case 1: polygon selected
            if (selectedGroup) {
                const groupToDelete = selectedGroup;
                const groupId = groupToDelete._id;
                let detachedTexture = null;
                if (window.rightPanel && window.rightPanel.detachTexture) {
                    detachedTexture = window.rightPanel.detachTexture(groupId);
                }
                groupToDelete.remove();
                dirtyPolygons.delete(groupId);
                selectedGroup = null;
                polygonLayer.draw();

                UndoManager.push({
                    undo: () => {
                        polygonLayer.add(groupToDelete);
                        dirtyPolygons.add(groupId);
                        if (detachedTexture && window.rightPanel) {
                            window.rightPanel.restoreTexture(groupId, detachedTexture);
                        }
                        polygonLayer.batchDraw();
                    },
                    redo: () => {
                        groupToDelete.remove();
                        dirtyPolygons.delete(groupId);
                        if (detachedTexture && window.rightPanel) {
                            window.rightPanel.detachTexture(groupId);
                        }
                        selectedGroup = null;
                        polygonLayer.batchDraw();
                    }
                });
                return;
            }

            // Case 2: background image selected with transformer
            const selectedNodes = tr.nodes();
            if (selectedNodes.length > 0) {
                const imagesToDelete = selectedNodes.filter(node => node instanceof Konva.Image);
                if (imagesToDelete.length === 0) return;

                imagesToDelete.forEach(node => {
                    node.remove();
                    const index = bgImages.indexOf(node);
                    if (index > -1) bgImages.splice(index, 1);
                });
                tr.nodes([]);
                bgLayer.draw();

                UndoManager.push({
                    undo: () => {
                        imagesToDelete.forEach(node => {
                            bgLayer.add(node);
                            bgImages.push(node);
                        });
                        tr.nodes([]);
                        bgLayer.batchDraw();
                    },
                    redo: () => {
                        imagesToDelete.forEach(node => {
                            node.remove();
                            const index = bgImages.indexOf(node);
                            if (index > -1) bgImages.splice(index, 1);
                        });
                        tr.nodes([]);
                        bgLayer.batchDraw();
                    }
                });
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

        // Image drag undo (stage-level events)
        let imgDragStartPos = null;

        stage.on('dragstart', (e) => {
            if (!(e.target instanceof Konva.Image)) return;
            imgDragStartPos = { x: e.target.x(), y: e.target.y() };
        });
        stage.on('dragend', (e) => {
            if (!(e.target instanceof Konva.Image) || !imgDragStartPos) return;
            const img = e.target;
            const start = { ...imgDragStartPos };
            const end = { x: img.x(), y: img.y() };
            imgDragStartPos = null;
            if (start.x === end.x && start.y === end.y) return;
            UndoManager.push({
                undo: () => { img.position(start); tr.forceUpdate(); stage.batchDraw(); },
                redo: () => { img.position(end); tr.forceUpdate(); stage.batchDraw(); }
            });
        });

        // Transformer undo/redo for background images
        let trStartState = null;
        tr.on('transformstart', () => {
            const nodes = tr.nodes();
            trStartState = nodes.map(node => ({
                node, x: node.x(), y: node.y(),
                scaleX: node.scaleX(), scaleY: node.scaleY(),
                rotation: node.rotation(),
                width: node.width(), height: node.height()
            }));
        });
        tr.on('transformend', () => {
            if (!trStartState) return;
            const beforeStates = trStartState;
            const afterStates = beforeStates.map(s => ({
                node: s.node, x: s.node.x(), y: s.node.y(),
                scaleX: s.node.scaleX(), scaleY: s.node.scaleY(),
                rotation: s.node.rotation(),
                width: s.node.width(), height: s.node.height()
            }));
            trStartState = null;
            UndoManager.push({
                undo: () => {
                    beforeStates.forEach(s => {
                        s.node.position({ x: s.x, y: s.y });
                        s.node.scale({ x: s.scaleX, y: s.scaleY });
                        s.node.rotation(s.rotation);
                        s.node.size({ width: s.width, height: s.height });
                    });
                    tr.forceUpdate();
                    stage.batchDraw();
                },
                redo: () => {
                    afterStates.forEach(s => {
                        s.node.position({ x: s.x, y: s.y });
                        s.node.scale({ x: s.scaleX, y: s.scaleY });
                        s.node.rotation(s.rotation);
                        s.node.size({ width: s.width, height: s.height });
                    });
                    tr.forceUpdate();
                    stage.batchDraw();
                }
            });
        });

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

        window.leftPanel = {
            autoPackImages: () => {
                if (bgImages.length === 0) return;

                const padding = 10;
                const getDims = (img) => ({
                    width: img.width() * Math.abs(img.scaleX()),
                    height: img.height() * Math.abs(img.scaleY())
                });

                const sorted = [...bgImages].sort((a, b) => {
                    return getDims(b).height - getDims(a).height;
                });

                let totalArea = 0;
                sorted.forEach(img => {
                    const d = getDims(img);
                    totalArea += d.width * d.height;
                });
                const targetRowWidth = Math.max(
                    stage.width(),
                    Math.sqrt(totalArea) * 1.4
                );

                let cursorX = 0;
                let cursorY = 0;
                let rowHeight = 0;

                sorted.forEach(img => {
                    const { width, height } = getDims(img);
                    if (cursorX > 0 && cursorX + width > targetRowWidth) {
                        cursorX = 0;
                        cursorY += rowHeight + padding;
                        rowHeight = 0;
                    }
                    img.position({ x: cursorX, y: cursorY });
                    cursorX += width + padding;
                    rowHeight = Math.max(rowHeight, height);
                });

                tr.nodes([]);

                const viewWidth = stage.width();
                const viewHeight = stage.height();
                const layoutWidth = targetRowWidth;
                const layoutHeight = cursorY + rowHeight;
                const scale = Math.min(
                    viewWidth / (layoutWidth + padding * 2),
                    viewHeight / (layoutHeight + padding * 2),
                    1
                );
                stage.scale({ x: scale, y: scale });
                stage.position({ x: padding * scale, y: padding * scale });

                bgLayer.batchDraw();
                FeedbackManager.show('Arranged ' + bgImages.length + ' image(s)');
            }
        };

        return stage;
    }
};
