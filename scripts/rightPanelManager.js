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
            // Don't process clicks if we were selecting
            if (selectionRectangle.visible() && selectionRectangle.width() > 0 && selectionRectangle.height() > 0) {
                return;
            }

            if (e.target === stage || e.target.name() === 'bgRect') {
                tr.nodes([]);
                return;
            }

            if (!(e.target instanceof Konva.Image)) return;

            const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
            const isSelected = tr.nodes().indexOf(e.target) >= 0;

            if (!metaPressed && !isSelected) {
                tr.nodes([e.target]);
            } else if (metaPressed && isSelected) {
                const nodes = tr.nodes().slice();
                nodes.splice(nodes.indexOf(e.target), 1);
                tr.nodes(nodes);
            } else if (metaPressed && !isSelected) {
                tr.nodes(tr.nodes().concat([e.target]));
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

                        konvaImg.on('click', () => tr.nodes([konvaImg]));

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