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

        stage.on('contextmenu', (e) => {
            e.evt.preventDefault(); // prevent default browser context menu

            // Only trigger on draggable images (extracted textures)
            if (e.target && e.target.draggable() && e.target.getClassName() === 'Image') {
                showContextMenu(e.evt.clientX, e.evt.clientY, e.target);
            }
        });

        function showContextMenu(x, y, target) {
            // Remove existing menu
            const existingMenu = document.getElementById('konva-context-menu');
            if (existingMenu) existingMenu.remove();

            // Create menu container
            const menu = document.createElement('div');
            menu.id = 'konva-context-menu';
            menu.style.position = 'absolute';
            menu.style.top = y + 'px';
            menu.style.left = x + 'px';
            menu.style.background = '#f9f9f9';
            menu.style.border = '1px solid #888';
            menu.style.borderRadius = '4px';
            menu.style.padding = '0';
            menu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
            menu.style.zIndex = 1000;
            menu.style.fontFamily = 'sans-serif';
            menu.style.minWidth = '120px';
            menu.style.color = '#000'; // ensure text color is black

            // Helper function to create menu items
            function createMenuItem(label, callback) {
                const item = document.createElement('div');
                item.innerText = label;
                item.style.padding = '8px 12px';
                item.style.cursor = 'pointer';
                item.style.userSelect = 'none';
                item.style.color = '#000';

                item.addEventListener('mouseenter', () => {
                    item.style.background = '#0078d4';
                    item.style.color = '#fff';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = 'transparent';
                    item.style.color = '#000';
                });

                item.addEventListener('click', () => {
                    callback();
                    menu.remove();
                });

                return item;
            }

            // Copy option
            menu.appendChild(createMenuItem('Copy', () => copyTexture(target)));

            // Flip X
            menu.appendChild(createMenuItem('Flip X', () => {
                // Set offset to center if not already set
                if (target.offsetX() !== target.width() / 2) {
                    target.offsetX(target.width() / 2);
                }
                target.scaleX(-target.scaleX());
                target.getLayer().batchDraw();
            }));

            // Flip Y
            menu.appendChild(createMenuItem('Flip Y', () => {
                if (target.offsetY() !== target.height() / 2) {
                    target.offsetY(target.height() / 2);
                }
                target.scaleY(-target.scaleY());
                target.getLayer().batchDraw();
            }));

            document.body.appendChild(menu);

            // Remove menu when clicking elsewhere
            const removeMenu = () => {
                menu.remove();
                window.removeEventListener('click', removeMenu);
            };
            setTimeout(() => window.addEventListener('click', removeMenu), 0);
        }

        async function copyTexture(texture) {
            const width = texture.width() * Math.abs(texture.scaleX());
            const height = texture.height() * Math.abs(texture.scaleY());

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const ctx = tempCanvas.getContext('2d');

            ctx.save();

            // Handle flip
            ctx.translate(width / 2, height / 2);
            ctx.scale(texture.scaleX() < 0 ? -1 : 1, texture.scaleY() < 0 ? -1 : 1);
            ctx.rotate((texture.rotation() * Math.PI) / 180);
            ctx.drawImage(
                texture.image(),
                -texture.width() / 2,
                -texture.height() / 2,
                texture.width(),
                texture.height()
            );

            ctx.restore();

            try {
                const blob = await new Promise(resolve => tempCanvas.toBlob(resolve));
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                FeedbackManager.show('Texture copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy image: ', err);
                FeedbackManager.show('Failed to copy texture.');
            }
        }

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