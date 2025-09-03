// ==================== PAN AND ZOOM HANDLING ====================
const PanZoomManager = {
    isPanning: false,

    // Initialize panning for a stage
    initPanning: (stage) => {
        let lastPos = { x: 0, y: 0 };

        stage.on("mousedown", (e) => {
            if (e.evt.button === 1) { // Middle click
                PanZoomManager.isPanning = true;
                lastPos = stage.getPointerPosition();
                e.evt.preventDefault();

                // Temporarily disable dragging for nodes
                stage.find("Image").forEach(img => {
                    img._wasDraggable = img.draggable(); // Store current state
                    img.draggable(false);
                });
                
                stage.find(".group").forEach(g => {
                    g._wasDraggable = g.draggable(); // Store current state
                    g.draggable(false);
                });
            }
        });

        stage.on("mouseup", () => {
            if (PanZoomManager.isPanning) {
                PanZoomManager.isPanning = false;

                // Restore the original draggable state
                stage.find("Image").forEach(img => {
                    if (img._wasDraggable !== undefined) {
                        img.draggable(img._wasDraggable);
                        delete img._wasDraggable;
                    }
                });
                
                stage.find(".group").forEach(g => {
                    if (g._wasDraggable !== undefined) {
                        g.draggable(g._wasDraggable);
                        delete g._wasDraggable;
                    }
                });
            }
        });

        stage.on("mousemove", () => {
            if (!PanZoomManager.isPanning) return;

            const pos = stage.getPointerPosition();
            const dx = pos.x - lastPos.x;
            const dy = pos.y - lastPos.y;

            stage.x(stage.x() + dx);
            stage.y(stage.y() + dy);
            stage.batchDraw();

            lastPos = pos;
        });

        // Prevent context menu on middle click
        stage.container().addEventListener("contextmenu", (e) => e.preventDefault());
    },
    
    // Initialize zooming for a stage
    initZooming: (stage) => {
        stage.on('wheel', (e) => {
            // Stop default scrolling
            e.evt.preventDefault();

            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();

            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            // How to scale? Zoom in? Or zoom out?
            let direction = e.evt.deltaY > 0 ? -1 : 1;

            // When we zoom on trackpad, e.evt.ctrlKey is true
            // In that case lets revert direction
            if (e.evt.ctrlKey) {
                direction = -direction;
            }

            const newScale = direction > 0 ? oldScale * CONFIG.ZOOM.SCALE_BY : oldScale / CONFIG.ZOOM.SCALE_BY;

            stage.scale({ x: newScale, y: newScale });

            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            
            stage.position(newPos);
        });
    }
};

