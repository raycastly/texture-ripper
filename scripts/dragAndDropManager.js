// ==================== DRAG & DROP MANAGER ====================
const DragDropManager = {
    init: (container, onFileDrop, options = {}) => {
        const {
            dragOverClass = 'drag-over',
            showOverlay = false,
            overlayId = 'dropZoneOverlay'
        } = options;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            container.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            container.classList.add(dragOverClass);
            if (showOverlay) {
                const overlay = document.getElementById(overlayId);
                if (overlay) overlay.style.display = 'flex';
            }
        }

        function unhighlight(e) {
            container.classList.remove(dragOverClass);
            if (showOverlay) {
                const overlay = document.getElementById(overlayId);
                if (overlay) overlay.style.display = 'none';
            }
        }

        // Handle dropped files
        container.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                const imageFiles = Array.from(files).filter(file => 
                    file.type.startsWith('image/')
                );
                
                if (imageFiles.length > 0 && typeof onFileDrop === 'function') {
                    onFileDrop(imageFiles);
                }
            }
        }

        // Return cleanup function
        return {
            destroy: () => {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    container.removeEventListener(eventName, preventDefaults, false);
                    container.removeEventListener(eventName, highlight, false);
                    container.removeEventListener(eventName, unhighlight, false);
                });
                container.removeEventListener('drop', handleDrop, false);
                container.classList.remove(dragOverClass);
            }
        };
    },

    // Helper function to handle image files
    handleImageFiles: (files, stage, bgLayer, bgImages, imagesLocked, feedbackCallback) => {
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = evt => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(stage.width() / img.width, stage.height() / img.height);

                    const konvaImg = new Konva.Image({
                        x: (stage.width() - img.width * scale) / 2,
                        y: (stage.height() - img.height * scale) / 2,
                        image: img,
                        width: img.width * scale,
                        height: img.height * scale,
                        draggable: !imagesLocked
                    });

                    bgLayer.add(konvaImg);
                    bgImages.push(konvaImg);
                    bgLayer.batchDraw();
                    
                    if (typeof feedbackCallback === 'function') {
                        feedbackCallback('Image dropped successfully!');
                    }
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
};