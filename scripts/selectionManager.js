// ==================== SELECTION AND SNAPPING ====================
const SelectionManager = {
    // Initialize selection rectangle
    initSelection: (stage, selectionRectangle, transformer) => {
        let x1, y1, x2, y2;
        let isSelecting = false;

        stage.on('mousedown', (e) => {
            // Only left mouse button for selection
            if (e.evt.button !== 0) return;
            
            // Don't start selection if clicking on an image or transformer
            if (e.target !== stage && e.target.name() !== 'bgRect') return;

            isSelecting = true;
            const pos = stage.getPointerPosition();
            
            // Convert to stage-relative coordinates (accounting for panning)
            x1 = (pos.x - stage.x()) / stage.scaleX();
            y1 = (pos.y - stage.y()) / stage.scaleY();
            x2 = x1;
            y2 = y1;

            selectionRectangle.setAttrs({
                x: x1,
                y: y1,
                width: 0,
                height: 0,
                visible: true,
            });
        });

        stage.on('mousemove', () => {
            if (!isSelecting) return;
            
            const pos = stage.getPointerPosition();
            
            // Convert to stage-relative coordinates (accounting for panning)
            x2 = (pos.x - stage.x()) / stage.scaleX();
            y2 = (pos.y - stage.y()) / stage.scaleY();

            selectionRectangle.setAttrs({
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1),
            });
            
            selectionRectangle.getLayer().batchDraw();
        });

        stage.on('mouseup', () => {
            if (!isSelecting) return;
            isSelecting = false;

            setTimeout(() => selectionRectangle.visible(false));

            const images = Object.values(stage.tiedRects || {});
            
            // Get the selection rectangle in absolute coordinates
            const selRect = selectionRectangle.getClientRect();
            
            const selected = images.filter(img => {
                const imgRect = img.getClientRect();
                
                // Check for intersection in absolute coordinates
                return (
                    selRect.x <= imgRect.x + imgRect.width &&
                    selRect.x + selRect.width >= imgRect.x &&
                    selRect.y <= imgRect.y + imgRect.height &&
                    selRect.y + selRect.height >= imgRect.y
                );
            });

            transformer.nodes(selected);
        });
    },
    
    // Get line guide stops for snapping
    getLineGuideStops: (stage, skipNode) => {
        const stagePos = stage.position();
        const stageScale = stage.scaleX();

        const bgRect = stage.findOne('.bgRect');
        const bgRectBox = bgRect.getClientRect();
        
        const vertical = [bgRectBox.x, bgRectBox.x + bgRectBox.width/2, bgRectBox.x + bgRectBox.width];
        const horizontal = [bgRectBox.y, bgRectBox.y + bgRectBox.height/2, bgRectBox.y + bgRectBox.height];

        Object.values(stage.tiedRects || {}).forEach(node => {
            if (node === skipNode) return;
            const box = node.getClientRect();
            vertical.push(box.x, box.x + box.width, box.x + box.width/2);
            horizontal.push(box.y, box.y + box.height, box.y + box.height/2);
        });

        return { vertical, horizontal };
    },
    
    // Get object snapping edges
    getObjectSnappingEdges: (node) => {
        const box = node.getClientRect();
        const absPos = node.absolutePosition();

        return {
            vertical: [
                { guide: Math.round(box.x), offset: absPos.x - box.x },
                { guide: Math.round(box.x + box.width / 2), offset: absPos.x - (box.x + box.width/2) },
                { guide: Math.round(box.x + box.width), offset: absPos.x - (box.x + box.width) }
            ],
            horizontal: [
                { guide: Math.round(box.y), offset: absPos.y - box.y },
                { guide: Math.round(box.y + box.height / 2), offset: absPos.y - (box.y + box.height/2) },
                { guide: Math.round(box.y + box.height), offset: absPos.y - (box.y + box.height) }
            ]
        };
    },
    
    // Get guides for snapping
    getGuides: (lineGuideStops, itemBounds) => {
        let resultV = [], resultH = [];
        
        lineGuideStops.vertical.forEach(lineGuide => {
            itemBounds.vertical.forEach(item => {
                const diff = Math.abs(lineGuide - item.guide);
                if (diff < CONFIG.GUIDES.OFFSET) {
                    resultV.push({ 
                        lineGuide, 
                        diff, 
                        offset: item.offset, 
                        orientation: 'V' 
                    });
                }
            });
        });
        
        lineGuideStops.horizontal.forEach(lineGuide => {
            itemBounds.horizontal.forEach(item => {
                const diff = Math.abs(lineGuide - item.guide);
                if (diff < CONFIG.GUIDES.OFFSET) {
                    resultH.push({ 
                        lineGuide, 
                        diff, 
                        offset: item.offset, 
                        orientation: 'H' 
                    });
                }
            });
        });
        
        const guides = [];
        if (resultV.length) guides.push(resultV.sort((a,b)=>a.diff-b.diff)[0]);
        if (resultH.length) guides.push(resultH.sort((a,b)=>a.diff-b.diff)[0]);
        
        return guides;
    },
    
    // Draw guides for snapping
    drawGuides: (stage, guides) => {
        const guidesLayer = stage.findOne('.guidesLayer');
        guidesLayer.find('.guid-line').forEach(l => l.destroy());
        
        const stagePos = stage.position();
        const stageScale = stage.scaleX();

        guides.forEach(g => {
            if (g.orientation === 'H') {
                const line = new Konva.Line({
                    points: [-10000, 0, 10000, 0],
                    stroke: CONFIG.GUIDES.STROKE,
                    strokeWidth: 1 / stageScale,
                    dash: [4 / stageScale, 6 / stageScale],
                    name: 'guid-line'
                });
                
                line.position({ 
                    x: (-stagePos.x)/stageScale, 
                    y: (g.lineGuide - stagePos.y)/stageScale 
                });
                
                guidesLayer.add(line);
            } else if (g.orientation === 'V') {
                const line = new Konva.Line({
                    points: [0, -10000, 0, 10000],
                    stroke: CONFIG.GUIDES.STROKE,
                    strokeWidth: 1 / stageScale,
                    dash: [4 / stageScale, 6 / stageScale],
                    name: 'guid-line'
                });
                
                line.position({ 
                    x: (g.lineGuide - stagePos.x)/stageScale, 
                    y: (-stagePos.y)/stageScale 
                });
                
                guidesLayer.add(line);
            }
        });

        guidesLayer.batchDraw();
    }
};

