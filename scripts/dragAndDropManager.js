// ==================== DRAG & DROP MANAGER ====================
const DragDropManager = {
    init: (container, onFileDrop, options = {}) => {
        const {
            dragOverClass = 'drag-over',
            showOverlay = true,
            overlayId = 'dragDropOverlay'
        } = options;

        // Create overlay element if it doesn't exist
        let overlay = document.getElementById(overlayId);
        if (!overlay && showOverlay) {
            overlay = document.createElement('div');
            overlay.id = overlayId;
            overlay.className = 'drag-drop-overlay';
            overlay.innerHTML = `
                <div class="drag-drop-overlay-content">
                    <div class="drag-drop-icon">📁</div>
                    <h3>Drop Image Here</h3>
                    <p>Release to add image to the canvas</p>
                </div>
            `;
            document.body.appendChild(overlay);
            
            // Position the overlay to match the container
            const updateOverlayPosition = () => {
                const rect = container.getBoundingClientRect();
                overlay.style.position = 'fixed';
                overlay.style.top = rect.top + 'px';
                overlay.style.left = rect.left + 'px';
                overlay.style.width = rect.width + 'px';
                overlay.style.height = rect.height + 'px';
            };
            
            // Update position initially and on window resize
            updateOverlayPosition();
            window.addEventListener('resize', updateOverlayPosition);
        }

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
            if (showOverlay && overlay) {
                overlay.style.display = 'flex';
            }
        }

        function unhighlight(e) {
            container.classList.remove(dragOverClass);
            if (showOverlay && overlay) {
                overlay.style.display = 'none';
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
            
            // Always unhighlight on drop
            unhighlight(e);
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
                
                // Remove overlay if we created it
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
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