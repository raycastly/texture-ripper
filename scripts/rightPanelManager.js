// ==================== RIGHT PANEL MANAGEMENT ====================
const RightPanelManager = {
    // Initialize the right panel
    init: (containerId) => {
        const container = document.getElementById(containerId);
        const stagePixelWidth = parseInt(document.getElementById('rightWidth').value);
        const stagePixelHeight = parseInt(document.getElementById('rightHeight').value);

        // Give the bgLayer a specific name for easier access
        const bgLayer = new Konva.Layer();
        const uiLayer = new Konva.Layer();
        const guidesLayer = new Konva.Layer({ name: 'guidesLayer' });
        const imageLayer = new Konva.Layer({ name: 'imageLayer' });

        const stage = new Konva.Stage({
            container: containerId,
            width: container.clientWidth,
            height: container.clientHeight
        });

        stage.add(bgLayer)
             .add(imageLayer)
             .add(guidesLayer)
             .add(uiLayer);

        // Store reference to bgLayer on the stage
        stage.bgLayer = bgLayer;

        // Light grey background
        const bgRect = new Konva.Rect({
            x: 0,
            y: 0,
            width: stagePixelWidth,
            height: stagePixelHeight,
            fill: CONFIG.BACKGROUND.FILL,
            listening: false,
            name: 'bgRect'
        });
        
        bgLayer.add(bgRect);
        stage.bgRect = bgRect;

        // Store the current background state
        stage.isTransparentBackground = false;

        // Set up the transparency toggle
        const exportTransparentCheckbox = document.getElementById('exportTransparent');
        if (exportTransparentCheckbox) {
            exportTransparentCheckbox.addEventListener('change', (e) => {
                RightPanelManager.toggleTransparency(stage, e.target.checked);
            });
        }

        // Transformer for selection
        const tr = new Konva.Transformer({
            keepRatio: false,
            rotateEnabled: true,
            rotationSnaps: [0, 90, 180, 270],
            rotationSnapTolerance: 5,
            enabledAnchors: [
                'top-left','top-center','top-right',
                'middle-left','middle-right',
                'bottom-left','bottom-center','bottom-right'
            ],

            // anchor bound function (uses precomputed snap data stored on transformstart)
            anchorDragBoundFunc: function(oldPos, newPos) {
                const node = tr.nodes()[0];
                if (!node) return newPos;

                const stage = node.getStage();
                const snapDistance = CONFIG.GUIDES.SCALE_OFFSET ?? CONFIG.GUIDES.OFFSET;

                // Use the stage's pointer event to check for Ctrl
                const evt = stage.getPointerPosition()?.evt || window.event;
                if (evt?.ctrlKey) {
                    const guidesLayer = stage.findOne('.guidesLayer');
                    if (guidesLayer) {
                        guidesLayer.find('.guid-line').forEach(l => l.destroy());
                        guidesLayer.batchDraw();
                    }
                    return newPos;
                }

                const guidesLayer = stage.findOne('.guidesLayer');
                if (guidesLayer) guidesLayer.find('.guid-line').forEach(l => l.destroy());

                const lineGuideStops = tr._snapData?.lineGuides || { vertical: [], horizontal: [] };
                const activeAnchor = tr.getActiveAnchor();

                // ---------- Uniform scaling (corner + Shift) ----------
                const isUniformCorner =
                    (stage.getPointerPosition()?.shiftKey) &&
                    (activeAnchor.includes('left') || activeAnchor.includes('right')) &&
                    (activeAnchor.includes('top') || activeAnchor.includes('bottom'));

                if (isUniformCorner) {
                    const box = tr.getClientRect({ skipTransform: false });
                    const activeGuides = [];
                    
                    // Calculate which edges will move based on the active anchor
                    const movingEdges = {
                        left: activeAnchor.includes('left'),
                        right: activeAnchor.includes('right'),
                        top: activeAnchor.includes('top'),
                        bottom: activeAnchor.includes('bottom')
                    };
                    
                    // Find the closest snap guide for each moving edge
                    let closestSnap = null;
                    let minDistance = snapDistance;
                    
                    // Check vertical guides for left/right edges
                    if (movingEdges.left || movingEdges.right) {
                        const edgeX = movingEdges.left ? box.x : box.x + box.width;
                        
                        lineGuideStops.vertical.forEach(g => {
                            const dist = Math.abs(g - edgeX);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestSnap = { guide: g, orientation: 'V', edge: movingEdges.left ? 'left' : 'right' };
                            }
                        });
                    }
                    
                    // Check horizontal guides for top/bottom edges
                    if (movingEdges.top || movingEdges.bottom) {
                        const edgeY = movingEdges.top ? box.y : box.y + box.height;
                        
                        lineGuideStops.horizontal.forEach(g => {
                            const dist = Math.abs(g - edgeY);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestSnap = { guide: g, orientation: 'H', edge: movingEdges.top ? 'top' : 'bottom' };
                            }
                        });
                    }
                    
                    if (closestSnap) {
                        activeGuides.push({
                            lineGuide: closestSnap.guide,
                            orientation: closestSnap.orientation,
                            offset: minDistance,
                            snap: 'edge'
                        });
                        
                        SelectionManager.drawGuides(stage, activeGuides);
                        
                        // Calculate the required scale factor to snap to the guide
                        let scaleFactor = 1;
                        
                        if (closestSnap.orientation === 'V') {
                            // Vertical guide - scale based on width
                            if (closestSnap.edge === 'left') {
                                scaleFactor = (box.x + box.width - closestSnap.guide) / box.width;
                            } else {
                                scaleFactor = (closestSnap.guide - box.x) / box.width;
                            }
                        } else {
                            // Horizontal guide - scale based on height
                            if (closestSnap.edge === 'top') {
                                scaleFactor = (box.y + box.height - closestSnap.guide) / box.height;
                            } else {
                                scaleFactor = (closestSnap.guide - box.y) / box.height;
                            }
                        }
                        
                        // Apply the uniform scale
                        node.scaleX(scaleFactor);
                        node.scaleY(scaleFactor);
                        
                        // Calculate the new position to maintain the correct anchor point
                        let newX = node.x();
                        let newY = node.y();
                        
                        if (movingEdges.left) {
                            newX = box.x + box.width - (box.width * scaleFactor);
                        }
                        if (movingEdges.top) {
                            newY = box.y + box.height - (box.height * scaleFactor);
                        }
                        
                        node.position({ x: newX, y: newY });
                        
                        // Return the snapped position
                        return { 
                            x: movingEdges.left ? closestSnap.guide : newPos.x,
                            y: movingEdges.top ? closestSnap.guide : newPos.y
                        };
                    }
                    
                    return newPos;
                }



                // ---------- Side-anchor snapping ----------
                const activeGuides = [];

                if (activeAnchor.includes('left') || activeAnchor.includes('right')) {
                    lineGuideStops.vertical.forEach(g => {
                        if (Math.abs(newPos.x - g) < snapDistance) {
                            newPos.x = g;
                            activeGuides.push({
                                lineGuide: g,
                                orientation: 'V',
                                offset: 0,
                                snap: 'edge'
                            });
                        }
                    });
                }

                if (activeAnchor.includes('top') || activeAnchor.includes('bottom')) {
                    lineGuideStops.horizontal.forEach(g => {
                        if (Math.abs(newPos.y - g) < snapDistance) {
                            newPos.y = g;
                            activeGuides.push({
                                lineGuide: g,
                                orientation: 'H',
                                offset: 0,
                                snap: 'edge'
                            });
                        }
                    });
                }

                if (activeGuides.length) {
                    SelectionManager.drawGuides(stage, activeGuides);
                }

                return newPos;
            }

        });
        
        uiLayer.add(tr);

        // ---------- precompute snap data before transform begins ----------
        tr.on('transformstart', () => {
            const node = tr.nodes()[0];
            if (!node) return;
            const stage = node.getStage();

            // Precompute line guides once (skip current node)
            tr._snapData = {
                lineGuides: SelectionManager.getLineGuideStops(stage, node)
            };
        });

        // ---------- cleanup ----------
        tr.on('transformend', () => {
          const stage = tr.getStage();
          if (stage) {
            const guidesLayer = stage.findOne('.guidesLayer');
            if (guidesLayer) {
              guidesLayer.find('.guid-line').forEach(l => l.destroy());
              guidesLayer.batchDraw();
            }
          }
          delete tr._snapData;
        });

        // Selection rectangle
        const selectionRectangle = new Konva.Rect({
            fill: CONFIG.SELECTION.FILL,
            visible: false,
            listening: false // don't interfere with other mouse events
        });
        
        uiLayer.add(selectionRectangle);

        // Initialize tiedRects object
        const tiedRects = {};
        stage.tiedRects = tiedRects;

        // Initialize selection
        SelectionManager.initSelection(stage, selectionRectangle, tr);

        // Click selection
        stage.on('click tap', (e) => {
            // Don't process clicks if we were selecting with rectangle
            if (selectionRectangle.visible() && selectionRectangle.width() > 5 && selectionRectangle.height() > 5) {
                selectionRectangle.visible(false);
                guidesLayer.batchDraw();
                return;
            }

            // Click on empty space: clear selection unless shift is held
            if (e.target === stage || e.target.name() === 'bgRect') {
                if (!e.evt.shiftKey) {
                    tr.nodes([]);
                }
                return;
            }

            // Allow selection of any draggable object, not just images
            if (!e.target.draggable()) return;

            const shiftPressed = e.evt.shiftKey;
            const currentNodes = tr.nodes();
            const isSelected = currentNodes.includes(e.target);

            if (shiftPressed) {
                // Shift+click: toggle selection
                if (isSelected) {
                    // Remove from selection
                    const newNodes = currentNodes.filter(node => node !== e.target);
                    tr.nodes(newNodes);
                } else {
                    // Add to selection
                    tr.nodes([...currentNodes, e.target]);
                }
            } else {
                // Regular click: replace selection
                if (!isSelected) {
                    tr.nodes([e.target]);
                }
                // If already selected, keep selection (allows for dragging)
            }
        });

        // Initialize panning and zooming
        PanZoomManager.initPanning(stage);
        PanZoomManager.initZooming(stage);

        // API for updating textures
        window.rightPanel = {
            updateTexture: (groupId, textureData) => {
                const img = new Image();
                img.onload = () => {
                    if (tiedRects[groupId]) {
                        tiedRects[groupId].image(img);
                        guidesLayer.batchDraw();
                    } else {
                        const konvaImg = new Konva.Image({
                            x: stagePixelWidth / 4,
                            y: stagePixelHeight / 4,
                            image: img,
                            id: `rect_${groupId}`,
                            draggable: true
                        });
                        
                        imageLayer.add(konvaImg);
                        tiedRects[groupId] = konvaImg;

                        konvaImg.on('dragmove', e => {
                            guidesLayer.find('.guid-line').forEach(l => l.destroy());
                            const lineGuideStops = SelectionManager.getLineGuideStops(stage, konvaImg);
                            const itemBounds = SelectionManager.getObjectSnappingEdges(konvaImg);
                            const guides = SelectionManager.getGuides(lineGuideStops, itemBounds);

                            if (!guides.length) return;

                            SelectionManager.drawGuides(stage, guides);
                            const absPos = konvaImg.absolutePosition();
                            
                            guides.forEach(g => {
                                if (g.orientation === 'V') absPos.x = g.lineGuide + g.offset;
                                else if (g.orientation === 'H') absPos.y = g.lineGuide + g.offset;
                            });
                            
                            konvaImg.absolutePosition(absPos);
                        });
                        
                        konvaImg.on('dragend', e => {
                            guidesLayer.find('.guid-line').forEach(l => l.destroy());
                        });

                        guidesLayer.batchDraw();
                    }
                };
                
                img.src = textureData;
            },
            
            removeTexture: (groupId) => {
                if (tiedRects[groupId]) {
                    tiedRects[groupId].destroy();
                    delete tiedRects[groupId];
                    imageLayer.draw();
                }
            },

            updateBackground: () => {
                const width = parseInt(document.getElementById('rightWidth').value);
                const height = parseInt(document.getElementById('rightHeight').value);
                
                if (stage.isTransparentBackground) {
                    const checkerboardPattern = CheckerboardManager.createCheckerboard(
                        width, 
                        height, 
                        CONFIG.CHECKERBOARD.CELL_SIZE
                    );
                    
                    // Create a new image and wait for it to load
                    const checkerboardImg = new Image();
                    checkerboardImg.onload = () => {
                        // Remove old background
                        stage.bgRect.destroy();
                        
                        // Create new checkerboard background
                        const newBgRect = new Konva.Image({
                            x: 0,
                            y: 0,
                            image: checkerboardImg,
                            width: width,
                            height: height,
                            listening: false,
                            name: 'bgRect'
                        });
                        
                        stage.bgLayer.add(newBgRect);
                        stage.bgRect = newBgRect;
                        stage.bgLayer.draw();
                    };
                    checkerboardImg.src = checkerboardPattern;
                } else {
                    // Switch back to solid color
                    stage.bgRect.width(width);
                    stage.bgRect.height(height);
                    stage.bgRect.fill(CONFIG.BACKGROUND.FILL);
                    stage.bgLayer.draw();
                }
            }
        };

        return stage;
    },

    // Toggle between solid color and checkerboard background
    toggleTransparency: (stage, isTransparent) => {
        stage.isTransparentBackground = isTransparent;
        
        // Use the stored reference to bgLayer
        const bgLayer = stage.bgLayer;
        if (!bgLayer) {
            console.error('Background layer not found');
            return;
        }
        
        const width = stage.bgRect.width();
        const height = stage.bgRect.height();
        
        if (isTransparent) {
            const checkerboardPattern = CheckerboardManager.createCheckerboard(
                width, 
                height, 
                CONFIG.CHECKERBOARD.CELL_SIZE
            );
            
            // Create a new image and wait for it to load
            const checkerboardImg = new Image();
            checkerboardImg.onload = () => {
                // Remove old background
                const oldBgRect = stage.bgRect;
                
                // Create new checkerboard background
                const newBgRect = new Konva.Image({
                    x: 0,
                    y: 0,
                    image: checkerboardImg,
                    width: width,
                    height: height,
                    listening: false,
                    name: 'bgRect'
                });
                
                bgLayer.add(newBgRect);
                stage.bgRect = newBgRect;
                oldBgRect.destroy();
                bgLayer.draw();
            };
            checkerboardImg.src = checkerboardPattern;
        } else {
            // Switch back to solid color
            const oldBgRect = stage.bgRect;
            
            const newBgRect = new Konva.Rect({
                x: 0,
                y: 0,
                width: width,
                height: height,
                fill: CONFIG.BACKGROUND.FILL,
                listening: false,
                name: 'bgRect'
            });
            
            bgLayer.add(newBgRect);
            stage.bgRect = newBgRect;
            oldBgRect.destroy();
            bgLayer.draw();
        }
    }
};