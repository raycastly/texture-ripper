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
};

