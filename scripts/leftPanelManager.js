// ==================== LEFT PANEL MANAGEMENT ====================
const LeftPanelManager = {
    // Initialize the left panel
    init: (containerId, addBtnId, deleteBtnId, uploadId) => {
        const container = document.getElementById(containerId);
        const stage = new Konva.Stage({ 
            container: containerId, 
            width: container.clientWidth, 
            height: container.clientHeight
        });

        const uiLayer = new Konva.Layer();
        const bgLayer = new Konva.Layer();
        const polygonLayer = new Konva.Layer();

        stage.add(bgLayer).add(polygonLayer).add(uiLayer);

        const bgImages = []; // Store multiple images
        let selectedGroup = null;
        let imagesLocked = false; // Track lock state

        // Lock/Unlock Images button
        const lockBtn = document.getElementById('lockImagesLeft');
        lockBtn.addEventListener('click', () => {
            imagesLocked = !imagesLocked;
            lockBtn.textContent = imagesLocked ? 'Unlock Images' : 'Lock Images';
            
            // Update draggable state of all background images
            bgImages.forEach(img => {
                img.draggable(!imagesLocked);
            });
            
            // Also update transformer state
            if (imagesLocked && tr.nodes().length > 0) {
                const selectedImage = tr.nodes()[0];
                if (selectedImage instanceof Konva.Image) {
                    tr.nodes([]); // Deselect any selected image when locking
                }
            }
            
            bgLayer.batchDraw();
        });

        // Extract All button
        document.getElementById('extractAllLeft').addEventListener('click', () => {
            polygonLayer.find('.group').forEach(async group => {
                const overlappingImgs = PolygonManager.getUnderlyingImages(group, stage);
                if (!overlappingImgs.length) return;

                // Use the polygon's ORIGINAL size (not scaled by stage zoom)
                const vertices = group.find('.vertex');
                if (vertices.length !== 4) return;
                
                // Calculate bounding box from vertex positions (local coordinates)
                const points = vertices.map(v => v.position());
                const minX = Math.min(...points.map(p => p.x));
                const minY = Math.min(...points.map(p => p.y));
                const maxX = Math.max(...points.map(p => p.x));
                const maxY = Math.max(...points.map(p => p.y));
                
                const canvasW = Math.round(maxX - minX);
                const canvasH = Math.round(maxY - minY);

                const outCanvas = document.createElement('canvas');
                outCanvas.width = canvasW;
                outCanvas.height = canvasH;
                const ctx = outCanvas.getContext('2d');

                // Helper: load image from data URL
                const loadImage = src => new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.src = src;
                });

                // Extract textures → load them as real Image objects
                const textures = overlappingImgs
                    .map(img => ImageProcessing.extractTexture(group, img))
                    .filter(Boolean);

                const loadedImgs = await Promise.all(textures.map(loadImage));

                // Draw them all in order
                loadedImgs.forEach(img => ctx.drawImage(img, 0, 0, canvasW, canvasH));

                // Update once at the end
                if (window.rightPanel) {
                    window.rightPanel.updateTexture(group._id, outCanvas.toDataURL());
                }
            });
        });

        // Upload handler
        document.getElementById(uploadId).addEventListener('change', e => {
            const file = e.target.files[0]; 
            if (!file) return;
            
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
                        draggable: !imagesLocked // Set initial draggable state based on lock status
                    });

                    bgLayer.add(konvaImg);
                    bgImages.push(konvaImg);
                    bgLayer.batchDraw();
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Add polygon button
        document.getElementById(addBtnId).addEventListener('click', () => {
            selectedGroup = PolygonManager.createPolygonGroup(stage, polygonLayer);
            polygonLayer.add(selectedGroup).draw();
        });

        // Delete button
        document.getElementById(deleteBtnId).addEventListener('click', () => {
            // Case 1: polygon selected
            if (selectedGroup) {
                if (window.rightPanel) window.rightPanel.removeTexture(selectedGroup._id);
                selectedGroup.destroy();
                selectedGroup = null;
                polygonLayer.draw();
                return;
            }

            // Case 2: background image selected with transformer
            const selectedNodes = tr.nodes();
            if (selectedNodes.length > 0) {
                selectedNodes.forEach(node => {
                    if (node instanceof Konva.Image) {
                        node.destroy();
                        // Remove from bgImages array
                        const index = bgImages.indexOf(node);
                        if (index > -1) {
                            bgImages.splice(index, 1);
                        }
                    }
                });
                tr.nodes([]); // clear transformer
                bgLayer.draw();
            }
        });

        // Transformer for background images only
        const tr = new Konva.Transformer({
            keepRatio: false,
            rotateEnabled: true,
            enabledAnchors: [
                'top-left','top-center','top-right',
                'middle-left','middle-right',
                'bottom-left','bottom-center','bottom-right'
            ]
        });
        uiLayer.add(tr);

        // Click to select background image (only if not locked)
        stage.on('click', (e) => {
            if (imagesLocked) return; // Don't select images when locked
            
            if (e.target instanceof Konva.Image) {
                tr.nodes([e.target]);   // select image
            } else {
                tr.nodes([]);           // deselect if clicking empty space / polygon
            }
            bgLayer.batchDraw();
        });

        // Keyboard handlers for transformer
        stage.on('keydown', (e) => {
            if (e.key === 'Shift') tr.keepRatio(true);
        });
        
        stage.on('keyup', (e) => {
            if (e.key === 'Shift') tr.keepRatio(false);
        });

        // Initialize panning and zooming
        PanZoomManager.initPanning(stage);
        PanZoomManager.initZooming(stage);

        return stage;
    }
};

