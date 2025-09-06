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
        const imageLayer = new Konva.Layer({ name: 'imageLayer' });

        const stage = new Konva.Stage({
            container: containerId,
            width: container.clientWidth,
            height: container.clientHeight
        });

        stage.add(bgLayer)
             .add(imageLayer)
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
        });

        const snapping = useKonvaSnapping({
            snapRange: CONFIG.GUIDES.SCALE_OFFSET ?? CONFIG.GUIDES.OFFSET,
            guidelineColor: "rgb(0,161,255)",
            guidelineDash: true,
            showGuidelines: true,
            snapToStageCenter: true,
            snapToStageBorders: true,
            snapToShapes: true
        });

        // Transformer events (for resizing/rotating)
        tr.on('transform', snapping.handleResizing);
        tr.on('transformend', snapping.handleResizeEnd);
        
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
                    } else {
                        const konvaImg = new Konva.Image({
                            x: stagePixelWidth / 4,
                            y: stagePixelHeight / 4,
                            image: img,
                            id: `rect_${groupId}`,
                            draggable: true
                        });

                        konvaImg.on('dragmove', snapping.handleDragging);
                        konvaImg.on('dragend', snapping.handleDragEnd);
                        
                        imageLayer.add(konvaImg);
                        tiedRects[groupId] = konvaImg;
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
    },

    autoPackTextures: (stage, autoScale = false, scaleLimit = 0.2) => {
        const tiedRects = stage.tiedRects;
        const bgRect = stage.bgRect;
        const containerWidth = bgRect.width();
        const containerHeight = bgRect.height();
        const textures = Object.values(tiedRects);
        if (textures.length === 0) return { packed: 0, skipped: 0 };

        const getDims = (texture, rotation = 0, scaleFactor = 1) => {
            const scaleX = (texture.scaleX() || 1) * scaleFactor;
            const scaleY = (texture.scaleY() || 1) * scaleFactor;
            const baseWidth = texture.width() * scaleX;
            const baseHeight = texture.height() * scaleY;
            if (rotation % 180 === 0) return { width: baseWidth, height: baseHeight };
            return { width: baseHeight, height: baseWidth };
        };

        const textureData = textures.map(t => ({
            texture: t,
            rotations: [0, 90]
        })).sort((a, b) => {
            const dimA = getDims(a.texture);
            const dimB = getDims(b.texture);
            return Math.max(dimB.width, dimB.height) - Math.max(dimA.width, dimA.height);
        });

        let freeRects = [{ x: 0, y: 0, width: containerWidth, height: containerHeight }];
        let packedCount = 0;
        let skippedCount = 0;

        textureData.forEach(data => {
            const { texture, rotations } = data;
            let placed = false;

            for (let rot of rotations) {
                let { width, height } = getDims(texture, rot);
                
                // Optional auto-scaling
                let scaleFactor = 1;
                if (autoScale) {
                    const fits = freeRects.some(f => width <= f.width && height <= f.height);
                    if (!fits) {
                        scaleFactor = Math.min(
                            ...freeRects.map(f => Math.min(f.width / width, f.height / height))
                        );
                        // Clamp scale factor to ±scaleLimit
                        const minScale = 1 - scaleLimit;
                        const maxScale = 1 + scaleLimit;
                        scaleFactor = Math.max(minScale, Math.min(maxScale, scaleFactor));

                        width *= scaleFactor;
                        height *= scaleFactor;
                    }
                }

                for (let i = 0; i < freeRects.length; i++) {
                    const free = freeRects[i];
                    if (width <= free.width && height <= free.height) {
                        texture.position({ x: free.x, y: free.y });
                        texture.rotation(rot);
                        if (scaleFactor !== 1) texture.scale({ x: scaleFactor, y: scaleFactor });

                        const newRects = [];
                        if (free.width > width) {
                            newRects.push({ x: free.x + width, y: free.y, width: free.width - width, height });
                        }
                        if (free.height > height) {
                            newRects.push({ x: free.x, y: free.y + height, width: free.width, height: free.height - height });
                        }

                        freeRects.splice(i, 1);
                        freeRects.push(...newRects);

                        packedCount++;
                        placed = true;
                        break;
                    }
                }

                if (placed) break;
            }

            if (!placed) {
                console.warn(`Texture ${texture.id()} doesn't fit in container - skipping`);
                skippedCount++;
            }
        });

        stage.findOne('Transformer').nodes([]);
        stage.draw();

        if (skippedCount > 0) {
            alert(`${skippedCount} texture(s) were skipped because they don't fit in the container. Consider increasing the container size.`);
        }

        console.log(`Packed ${packedCount} textures, ${skippedCount} skipped`);
        return { packed: packedCount, skipped: skippedCount };
    }
};