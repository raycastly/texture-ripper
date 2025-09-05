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
            anchorDragBoundFunc: function (oldPos, newPos) {
              const node = tr.nodes()[0];
              if (!node) return newPos;

              const stage = node.getStage();
              const activeAnchor = tr.getActiveAnchor(); // e.g. 'top-left', 'middle-right'
              const snapDistance = CONFIG.GUIDES.OFFSET;

              // Only snap the moving edge
              if (activeAnchor.includes('left') || activeAnchor.includes('right')) {
                const guides = SelectionManager.getLineGuideStops(stage, node).vertical;
                guides.forEach(guide => {
                  if (Math.abs(newPos.x - guide) < snapDistance) {
                    newPos.x = guide;
                  }
                });
              }
              if (activeAnchor.includes('top') || activeAnchor.includes('bottom')) {
                const guides = SelectionManager.getLineGuideStops(stage, node).horizontal;
                guides.forEach(guide => {
                  if (Math.abs(newPos.y - guide) < snapDistance) {
                    newPos.y = guide;
                  }
                });
              }

              return newPos;
            }
        });
        
        uiLayer.add(tr);

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