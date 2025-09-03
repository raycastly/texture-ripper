// ------------------- Helper Functions -------------------

// Draw a simple 3x3 grid inside a polygon
function drawGrid(group, rectPoints) {
  group.find('.grid').forEach(g => g.destroy());
  if (rectPoints.length !== 4) return;

  const [p1, p2, p3, p4] = rectPoints;
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  for (let t of [1/3, 2/3]) {
    const left = lerp(p1, p2, t);
    const right = lerp(p4, p3, t);
    group.add(new Konva.Line({ points: [left.x, left.y, right.x, right.y], stroke: 'rgba(0,0,0,0.4)', strokeWidth: 1, name: 'grid' }));
    const top = lerp(p1, p4, t);
    const bottom = lerp(p2, p3, t);
    group.add(new Konva.Line({ points: [top.x, top.y, bottom.x, bottom.y], stroke: 'rgba(0,0,0,0.4)', strokeWidth: 1, name: 'grid' }));
  }
}

// Create a polygon group with draggable vertices
function createPolygonGroup(stage, layer) {
  const group = new Konva.Group({ draggable: true, name: 'group' });
  const rectPoints = [
    { x: 50, y: 50 }, { x: 50, y: 150 },
    { x: 150, y: 150 }, { x: 150, y: 50 }
  ];

  const polygon = new Konva.Line({
    points: rectPoints.flatMap(p => [p.x, p.y]),
    stroke: 'black', strokeWidth: 2, closed: true, name: 'polygon'
  });
  group.add(polygon);

  rectPoints.forEach((point, i) => {
    const vertex = new Konva.Circle({
      x: point.x, y: point.y,
      radius: 5, fill: 'rgba(0,0,255,0.5)',
      draggable: true, name: 'vertex'
    });

    vertex.on('dragmove', () => {
      rectPoints[i] = { x: vertex.x(), y: vertex.y() };
      polygon.points(rectPoints.flatMap(p => [p.x, p.y]));
      drawGrid(group, rectPoints);
    });

    group.add(vertex);
  });

  drawGrid(group, rectPoints);
  return group;
}

// Extract texture from a polygon
function extractTextureFromPolygon(group, bgImage, opts = {}) {
  const minSize = opts.minSize || 16;
  const maxSize = opts.maxSize || 2048;
  const upscale = opts.upscale || 1;

  if (!bgImage || !bgImage.image()) return null;

  // 1) get the 4 vertices in LOCAL coordinates (ignore stage scaling)
  const absPts = [];
  group.find('.vertex').forEach(vertex => {
    // Use the vertex's local position relative to the group
    const localPos = vertex.position();
    absPts.push({ x: localPos.x, y: localPos.y });
  });

  // Get coordinates relative to the image top-left (ignore stage scaling)
  const dispPts = absPts.map(p => ({
    x: p.x + group.x() - bgImage.x(),
    y: p.y + group.y() - bgImage.y()
  }));

  // Map to original image pixels (ignore stage scaling)
  const origImg = bgImage.image();
  const ratioX = origImg.width / bgImage.width();
  const ratioY = origImg.height / bgImage.height();
  const srcPts = dispPts.map(p => ({ x: p.x * ratioX, y: p.y * ratioY }));

  // 4) compute average width/height in pixels
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  const [p0, p1, p2, p3] = srcPts;
  const avgWidth = (dist(p0, p3) + dist(p1, p2)) / 2;
  const avgHeight = (dist(p0, p1) + dist(p3, p2)) / 2;

  // 5) determine output size
  let outW = Math.max(minSize, Math.round(avgWidth * upscale));
  let outH = Math.max(minSize, Math.round(avgHeight * upscale));
  outW = Math.min(outW, maxSize);
  outH = Math.min(outH, maxSize);
  if (!isFinite(outW) || !isFinite(outH) || outW <= 0 || outH <= 0) return null;

  // 6) destination corners
  const dst = [
    { x: 0, y: 0 },
    { x: 0, y: outH - 1 },
    { x: outW - 1, y: outH - 1 },
    { x: outW - 1, y: 0 }
  ];

  // 7) compute homography
  const H = findHomography(srcPts, dst);
  const Hinv = invert3(H);

  // 8) prepare canvases
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = origImg.width;
  srcCanvas.height = origImg.height;
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(origImg, 0, 0, origImg.width, origImg.height);

  const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const srcPixels = srcImageData.data;
  const srcW = srcImageData.width;
  const srcH = srcImageData.height;

  const outImageData = outCtx.createImageData(outW, outH);
  const outPixels = outImageData.data;

  // 9) sample each pixel using bilinear interpolation
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const srcPt = applyHomography(Hinv, { x, y });
      const rgba = sampleBilinear(srcPixels, srcW, srcH, srcPt.x, srcPt.y);
      const idx = (y * outW + x) * 4;
      outPixels[idx] = rgba[0];
      outPixels[idx + 1] = rgba[1];
      outPixels[idx + 2] = rgba[2];
      outPixels[idx + 3] = rgba[3];
    }
  }

  outCtx.putImageData(outImageData, 0, 0);
  return outCanvas.toDataURL('image/png');
}


// ------------------- Left Panel -------------------
function initLeftPanel(containerId, addBtnId, deleteBtnId, uploadId) {
  const container = document.getElementById(containerId);
  const stage = new Konva.Stage({ container: containerId, width: container.clientWidth, height: container.clientHeight});

  const uiLayer = new Konva.Layer();
  const bgLayer = new Konva.Layer();
  const polygonLayer = new Konva.Layer();

  stage.add(bgLayer).add(polygonLayer).add(uiLayer);

  const bgImages = []; // store multiple images
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

  document.getElementById('extractAllLeft').addEventListener('click', () => {
    polygonLayer.find('.group').forEach(async group => {
      const overlappingImgs = getUnderlyingImages(group);
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

      // helper: load image from data URL
      const loadImage = src => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });

      // extract textures → load them as real Image objects
      const textures = overlappingImgs
        .map(img => extractTextureFromPolygon(group, img))
        .filter(Boolean);

      const loadedImgs = await Promise.all(textures.map(loadImage));

      // draw them all in order
      loadedImgs.forEach(img => ctx.drawImage(img, 0, 0, canvasW, canvasH));

      // update once at the end
      if (window.rightPanel) {
        window.rightPanel.updateTexture(group._id, outCanvas.toDataURL());
      }
    });
  });

  document.getElementById(uploadId).addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
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

  document.getElementById(addBtnId).addEventListener('click', () => {
    selectedGroup = createPolygonGroup(stage, polygonLayer);
    polygonLayer.add(selectedGroup).draw();
  });

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

  stage.on('keydown', (e) => {
    if (e.key === 'Shift') tr.keepRatio(true);
  });
  stage.on('keyup', (e) => {
    if (e.key === 'Shift') tr.keepRatio(false);
  });

  // ------------------- Panning Handlers -------------------
  let isPanning = false;
  let lastPos = { x: 0, y: 0 };

  stage.on("mousedown", (e) => {
    if (e.evt.button === 1) { // middle click
      isPanning = true;
      lastPos = stage.getPointerPosition();
      e.evt.preventDefault();

      // temporarily disable dragging for nodes so Konva doesn't "steal" the event
      // but only if they're currently draggable (not locked)
      stage.find("Image").forEach(img => {
        img._wasDraggable = img.draggable(); // store current state
        img.draggable(false);
      });
      stage.find(".group").forEach(g => {
        g._wasDraggable = g.draggable(); // store current state
        g.draggable(false);
      });
    }
  });

  stage.on("mouseup", () => {
    if (isPanning) {
      isPanning = false;

      // restore the original draggable state, respecting the lock state
      stage.find("Image").forEach(img => {
        if (img._wasDraggable !== undefined) {
          img.draggable(img._wasDraggable && !imagesLocked); // respect lock state
          delete img._wasDraggable;
        }
      });
      stage.find(".group").forEach(g => {
        if (g._wasDraggable !== undefined) {
          g.draggable(g._wasDraggable); // groups should always respect their original state
          delete g._wasDraggable;
        }
      });
    }
  });

  stage.on("mousemove", () => {
    if (!isPanning) return;

    const pos = stage.getPointerPosition();
    const dx = pos.x - lastPos.x;
    const dy = pos.y - lastPos.y;

    stage.x(stage.x() + dx);
    stage.y(stage.y() + dy);
    stage.batchDraw();

    lastPos = pos;
  });

  // prevent context menu on middle click
  stage.container().addEventListener("contextmenu", (e) => e.preventDefault());

  // ------------------- Zoom Handler -------------------
  const scaleBy = 1.1;
  stage.on('wheel', (e) => {
    // stop default scrolling
    e.evt.preventDefault();

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // how to scale? Zoom in? Or zoom out?
    let direction = e.evt.deltaY > 0 ? -1 : 1;

    // when we zoom on trackpad, e.evt.ctrlKey is true
    // in that case lets revert direction
    if (e.evt.ctrlKey) {
      direction = -direction;
    }

    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
  });

  return stage;
}


// Given a polygon group, return the Konva.Image underneath it (panning-safe)
function getUnderlyingImages(group) {
  const images = stageLeft.find('Image');
  if (!images || images.length === 0) return [];

  const groupBox = group.getClientRect(); // absolute coordinates
  return images.filter(img => {
    const imgBox = img.getClientRect();
    return (
      groupBox.x + groupBox.width > imgBox.x &&
      groupBox.x < imgBox.x + imgBox.width &&
      groupBox.y + groupBox.height > imgBox.y &&
      groupBox.y < imgBox.y + imgBox.height
    );
  });
}

// ------------------- Right Panel -------------------
function initRightPanel(containerId) {
  const container = document.getElementById(containerId);
  const stagePixelWidth = parseInt(document.getElementById('rightWidth').value);
  const stagePixelHeight = parseInt(document.getElementById('rightHeight').value);

  const bgLayer = new Konva.Layer();
  const uiLayer = new Konva.Layer();
  const guidesLayer = new Konva.Layer();
  const imageLayer = new Konva.Layer({ name: 'imageLayer' });

  const stage = new Konva.Stage({
    container: containerId,
    width: container.clientWidth,
    height: container.clientHeight,
    draggable: false, // REMOVE THIS - we'll handle panning manually
  });

  stage.add(bgLayer)
       .add(imageLayer)
       .add(guidesLayer)
       .add(uiLayer);

  let isPanning = false;
  let lastPos = { x: 0, y: 0 };

  // Middle click panning (same as left panel)
  stage.on("mousedown", (e) => {
    if (e.evt.button === 1) { // middle click
      isPanning = true;
      lastPos = stage.getPointerPosition();
      e.evt.preventDefault();

      // temporarily disable dragging for images
      Object.values(tiedRects).forEach(img => img.draggable(false));
    }
  });

  stage.on("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      
      // re-enable dragging for images
      Object.values(tiedRects).forEach(img => img.draggable(true));
    }
  });

  stage.on("mousemove", () => {
    if (!isPanning) return;

    const pos = stage.getPointerPosition();
    const dx = pos.x - lastPos.x;
    const dy = pos.y - lastPos.y;

    stage.x(stage.x() + dx);
    stage.y(stage.y() + dy);
    stage.batchDraw();

    lastPos = pos;
  });

  // prevent context menu
  stage.container().addEventListener("contextmenu", (e) => e.preventDefault());

  // Light grey background
  const bgRect = new Konva.Rect({
    x: 0,
    y: 0,
    width: stagePixelWidth,
    height: stagePixelHeight,
    fill: '#e0e0e0',
    listening: false
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

  const GUIDELINE_OFFSET = 5;
  const tiedRects = {};
  stage.tiedRects = tiedRects;

  // ---------------- Selection Rectangle ----------------
  const selectionRectangle = new Konva.Rect({
    fill: 'rgba(0,0,255,0.3)',
    visible: false,
    listening: false // don't interfere with other mouse events
  });
  uiLayer.add(selectionRectangle);

  let x1, y1, x2, y2;
  let isSelecting = false;

  stage.on('mousedown', (e) => {
    // Only left mouse button for selection
    if (e.evt.button !== 0) return;
    
    // Don't start selection if clicking on an image or transformer
    if (e.target !== stage && e.target !== bgRect) return;

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
    uiLayer.batchDraw();
  });

  stage.on('mouseup', () => {
    if (!isSelecting) return;
    isSelecting = false;

    setTimeout(() => selectionRectangle.visible(false));

    const images = Object.values(tiedRects);
    
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

    tr.nodes(selected);
  });

  // ---------------- Click selection ----------------
  stage.on('click tap', (e) => {
    // Don't process clicks if we were selecting
    if (selectionRectangle.visible() && selectionRectangle.width() > 0 && selectionRectangle.height() > 0) {
      return;
    }

    if (e.target === stage || e.target === bgRect) {
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

  // ---------------- Snapping helpers ----------------
  function getLineGuideStops(skipNode) {
    const stagePos = stage.position();
    const stageScale = stage.scaleX();

    const bgRectBox = bgRect.getClientRect();
    const vertical = [bgRectBox.x, bgRectBox.x + bgRectBox.width/2, bgRectBox.x + bgRectBox.width];
    const horizontal = [bgRectBox.y, bgRectBox.y + bgRectBox.height/2, bgRectBox.y + bgRectBox.height];

    Object.values(tiedRects).forEach(node => {
      if (node === skipNode) return;
      const box = node.getClientRect();
      vertical.push(box.x, box.x + box.width, box.x + box.width/2);
      horizontal.push(box.y, box.y + box.height, box.y + box.height/2);
    });

    return { vertical, horizontal };
  }

  function getObjectSnappingEdges(node) {
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
  }

  function getGuides(lineGuideStops, itemBounds) {
    let resultV = [], resultH = [];
    lineGuideStops.vertical.forEach(lineGuide => {
      itemBounds.vertical.forEach(item => {
        const diff = Math.abs(lineGuide - item.guide);
        if (diff < GUIDELINE_OFFSET) resultV.push({ lineGuide, diff, offset: item.offset, orientation: 'V' });
      });
    });
    lineGuideStops.horizontal.forEach(lineGuide => {
      itemBounds.horizontal.forEach(item => {
        const diff = Math.abs(lineGuide - item.guide);
        if (diff < GUIDELINE_OFFSET) resultH.push({ lineGuide, diff, offset: item.offset, orientation: 'H' });
      });
    });
    const guides = [];
    if (resultV.length) guides.push(resultV.sort((a,b)=>a.diff-b.diff)[0]);
    if (resultH.length) guides.push(resultH.sort((a,b)=>a.diff-b.diff)[0]);
    return guides;
  }

  function drawGuides(guides) {
    guidesLayer.find('.guid-line').forEach(l=>l.destroy());
    const stagePos = stage.position();
    const stageScale = stage.scaleX();

    guides.forEach(g => {
      if (g.orientation === 'H') {
        const line = new Konva.Line({
          points: [-10000, 0, 10000, 0],
          stroke: 'rgb(0, 161, 255)',
          strokeWidth: 1 / stageScale,
          dash: [4 / stageScale, 6 / stageScale],
          name: 'guid-line'
        });
        line.position({ x: (-stagePos.x)/stageScale, y: (g.lineGuide - stagePos.y)/stageScale });
        guidesLayer.add(line);
      } else if (g.orientation === 'V') {
        const line = new Konva.Line({
          points: [0, -10000, 0, 10000],
          stroke: 'rgb(0, 161, 255)',
          strokeWidth: 1 / stageScale,
          dash: [4 / stageScale, 6 / stageScale],
          name: 'guid-line'
        });
        line.position({ x: (g.lineGuide - stagePos.x)/stageScale, y: (-stagePos.y)/stageScale });
        guidesLayer.add(line);
      }
    });

    guidesLayer.batchDraw();
  }

  // ---------------- API ----------------
  window.rightPanel = {
    updateTexture(groupId, textureData) {
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
            guidesLayer.find('.guid-line').forEach(l=>l.destroy());
            const lineGuideStops = getLineGuideStops(konvaImg);
            const itemBounds = getObjectSnappingEdges(konvaImg);
            const guides = getGuides(lineGuideStops, itemBounds);

            if (!guides.length) return;

            drawGuides(guides);
            const absPos = konvaImg.absolutePosition();
            guides.forEach(g => {
              if (g.orientation === 'V') absPos.x = g.lineGuide + g.offset;
              else if (g.orientation === 'H') absPos.y = g.lineGuide + g.offset;
            });
            konvaImg.absolutePosition(absPos);
          });
          konvaImg.on('dragend', e => guidesLayer.find('.guid-line').forEach(l=>l.destroy()));

          guidesLayer.batchDraw();
        }
      };
      img.src = textureData;
    },
    removeTexture(groupId) {
      if (tiedRects[groupId]) {
        tiedRects[groupId].destroy();
        delete tiedRects[groupId];
        imageLayer.draw();
      }
    }
  };

  const scaleBy = 1.1;
  stage.on('wheel', (e) => {
    // stop default scrolling
    e.evt.preventDefault();

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // how to scale? Zoom in? Or zoom out?
    let direction = e.evt.deltaY > 0 ? -1 : 1;

    // when we zoom on trackpad, e.evt.ctrlKey is true
    // in that case lets revert direction
    if (e.evt.ctrlKey) {
      direction = -direction;
    }

    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
  });

  return stage;
}

// ------------------- Init -------------------
const stageLeft = initLeftPanel('canvasLeftContainer', 'addRectLeft', 'deleteObjLeft', 'bgUploadLeft');
const stageRight = initRightPanel('canvasRightContainer');

// Set Size button
document.getElementById('resizeRight').addEventListener('click', () => {
  const newWidth = parseInt(document.getElementById('rightWidth').value);
  const newHeight = parseInt(document.getElementById('rightHeight').value);

  if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) return;

  // resize bgRect only
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
      fill: '#e0e0e0'
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