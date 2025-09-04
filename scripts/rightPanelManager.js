// ==================== RIGHT PANEL MANAGEMENT ====================
const RightPanelManager = {
    // Initialize the right panel
    init: (containerId) => {
        const container = document.getElementById(containerId);
        const stagePixelWidth = parseInt(document.getElementById('rightWidth').value);
        const stagePixelHeight = parseInt(document.getElementById('rightHeight').value);

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
            ]
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

                        //konvaImg.on('click', () => tr.nodes([konvaImg]));

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
            }
        };

        return stage;
    }
};