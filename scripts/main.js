// ==================== INITIALIZATION ====================
// Initialize panels when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    let drawingMode = false;
    let currentPolygon = null;
    let placedPoints = [];
    
    const stageLeft = LeftPanelManager.init(
        'canvasLeftContainer', 
        'addRectLeft', 
        'deleteObjLeft', 
        'bgUploadLeft'
    );
    
    const stageRight = RightPanelManager.init('canvasRightContainer');

    // Set Size button
    document.getElementById('resizeRight').addEventListener('click', () => {
        const newWidth = parseInt(document.getElementById('rightWidth').value);
        const newHeight = parseInt(document.getElementById('rightHeight').value);

        if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) return;

        // Resize bgRect only
        stageRight.bgRect.width(newWidth);
        stageRight.bgRect.height(newHeight);

        stageRight.draw(); // Redraw the stage
    });

    // Export button
    document.getElementById('exportRight').addEventListener('click', () => {
        const exportWidth = parseInt(document.getElementById('rightWidth').value);
        const exportHeight = parseInt(document.getElementById('rightHeight').value);

        if (isNaN(exportWidth) || isNaN(exportHeight) || exportWidth <= 0 || exportHeight <= 0) return;

        // Temporarily reset stage position for clean export
        const originalX = stageRight.x();
        const originalY = stageRight.y();
        const originalScaleX = stageRight.scaleX();
        const originalScaleY = stageRight.scaleY();

        // Reset to no panning/zooming for export
        stageRight.x(0);
        stageRight.y(0);
        stageRight.scaleX(1);
        stageRight.scaleY(1);
        stageRight.batchDraw();

        // Get the main image layer
        const imageLayer = stageRight.findOne('.imageLayer');
        if (!imageLayer) return;

        const transparent = document.getElementById('exportTransparent').checked;

        let tempBg = null;

        if (!transparent) {
            // Create a temporary grey background behind the images
            tempBg = new Konva.Rect({
                x: 0,
                y: 0,
                width: exportWidth,
                height: exportHeight,
                fill: CONFIG.BACKGROUND.FILL
            });

            imageLayer.add(tempBg);
            tempBg.moveToBottom(); // Ensure it's behind all images
            imageLayer.draw();
        }

        // Export only the bgRect area
        const dataURL = imageLayer.toDataURL({
            x: stageRight.bgRect.x(),
            y: stageRight.bgRect.y(),
            width: stageRight.bgRect.width(),
            height: stageRight.bgRect.height(),
            pixelRatio: 1
        });

        // Remove temporary background if it was added
        if (tempBg) {
            tempBg.destroy();
            imageLayer.draw();
        }

        // Restore stage position
        stageRight.x(originalX);
        stageRight.y(originalY);
        stageRight.scaleX(originalScaleX);
        stageRight.scaleY(originalScaleY);
        stageRight.batchDraw();

        // Trigger download
        const link = document.createElement('a');
        link.download = 'atlas.png';
        link.href = dataURL;
        link.click();
    });
});