document.addEventListener('keydown', (e) => {

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        if (e.shiftKey) {
            UndoManager.redo();
        } else {
            UndoManager.undo();
        }
        e.preventDefault();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        UndoManager.redo();
        e.preventDefault();
        return;
    }

    // Drawing mode toggle
    if (e.code === CONFIG.SHORTCUTS.toggleDrawingMode) {
        document.getElementById('toggleDrawingMode').click();
        e.preventDefault();
    }

    // Add rectangle
    else if (e.code === CONFIG.SHORTCUTS.addRectangle) {
        document.getElementById('addRectLeft').click();
        e.preventDefault();
    }

    // Extract all textures
    else if (e.code === CONFIG.SHORTCUTS.extractTextures) {
        document.getElementById('extractAllLeft').click();
        e.preventDefault();
    }

    // Toggle image lock
    else if (e.code === CONFIG.SHORTCUTS.toggleImageLock) {
        document.getElementById('lockImagesLeft').click();
        e.preventDefault();
    }

    // Delete selected
    else if (e.code === CONFIG.SHORTCUTS.deleteSelected) {
        const deleteBtn = document.getElementById('deleteObjLeft');
        if (deleteBtn) deleteBtn.click();
        e.preventDefault();
    }

    // Export atlas
    else if (e.code === CONFIG.SHORTCUTS.exportAtlas) {
        document.getElementById('exportRight').click();
        e.preventDefault();
    }

    // Upload image
    else if (e.code === CONFIG.SHORTCUTS.uploadImage) {
        document.getElementById('bgUploadLeft').click();
        e.preventDefault();
    }

    // Pack textures
    else if (e.code === CONFIG.SHORTCUTS.packTextures) {
        document.getElementById('autoPack').click();
        e.preventDefault();
    }

    // Pack source textures
    else if (e.code === CONFIG.SHORTCUTS.autoPackLeft) {
        document.getElementById('autoPackLeft').click();
        e.preventDefault();
    }
});
