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
      layer.batchDraw();
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

  // 1) get the 4 vertices in absolute stage coordinates
  const absPts = [];
  group.find('.vertex').forEach(vertex => {
	  const p = vertex.getAbsolutePosition();
	  absPts.push({ x: p.x, y: p.y });
	});


  if (absPts.length !== 4) return null;

  // 2) convert to coordinates relative to the displayed bgImage (top-left of the image)
  const imgDispX = bgImage.x();
  const imgDispY = bgImage.y();
  const dispPts = absPts.map(p => ({ x: p.x - imgDispX, y: p.y - imgDispY }));

  // 3) map displayed coords to original image pixel coords
  //    because bgImage is often drawn scaled, we sample from the original image
  const origImg = bgImage.image(); // HTMLImageElement
  const ratioX = origImg.width / bgImage.width();
  const ratioY = origImg.height / bgImage.height();
  // (usually ratioX === ratioY but handle non-uniform scaling just in case)
  const srcPts = dispPts.map(p => ({ x: p.x * ratioX, y: p.y * ratioY }));

  // 4) measure widths/heights (in original-image pixels)
  function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx*dx + dy*dy); }

  // We assume polygon vertex order is consistent:
  // rectPoints = [top-left, bottom-left, bottom-right, top-right]
  const p0 = srcPts[0], p1 = srcPts[1], p2 = srcPts[2], p3 = srcPts[3];

  const topLen = dist(p0, p3);
  const bottomLen = dist(p1, p2);
  const avgWidth = (topLen + bottomLen) / 2;

  const leftLen = dist(p0, p1);
  const rightLen = dist(p3, p2);
  const avgHeight = (leftLen + rightLen) / 2;

  // 5) compute target output size, apply upscale and clamp
  let outW = Math.max(minSize, Math.round(avgWidth * upscale));
  let outH = Math.max(minSize, Math.round(avgHeight * upscale));

  // Protect from pathological sizes
  outW = Math.min(outW, maxSize);
  outH = Math.min(outH, maxSize);

  // If either dimension is zero or NaN (degenerate quad), bail out
  if (!isFinite(outW) || !isFinite(outH) || outW <= 0 || outH <= 0) return null;

  // 6) destination corners (use the ordering that matched your correct orientation)
  const dst = [
    { x: 0, y: 0 },                     // top-left
    { x: 0, y: outH - 1 },              // bottom-left
    { x: outW - 1, y: outH - 1 },       // bottom-right
    { x: outW - 1, y: 0 }               // top-right
  ];

  // 7) compute homography from source (original-image coords) -> dst
  const H = findHomography(srcPts, dst);
  const Hinv = invert3(H);

  // 8) prepare a canvas at desired output size and the original image canvas for sampling
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d');

  // Draw original image at its native resolution onto a tmp canvas
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

  // 9) for each pixel (x,y) in output, map back to source and bilinear-sample
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const srcPt = applyHomography(Hinv, { x: x, y: y }); // returns {x,y} in original-image pixels
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
  const bgLayer = new Konva.Layer(), polygonLayer = new Konva.Layer();
  stage.add(bgLayer).add(polygonLayer);

const bgImages = []; // store multiple images
let selectedGroup = null;

  document.getElementById('extractAllLeft').addEventListener('click', () => {
  polygonLayer.find('.group').forEach(group => {
    const overlappingImgs = getUnderlyingImages(group);
    if (!overlappingImgs.length) return;

    // create an offscreen canvas to composite the final texture
    const absPts = group.getClientRect(); // polygon bounding box
    const canvasW = Math.round(absPts.width);
    const canvasH = Math.round(absPts.height);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = canvasW;
    outCanvas.height = canvasH;
    const ctx = outCanvas.getContext('2d');

    overlappingImgs.forEach(img => {
      const texture = extractTextureFromPolygon(group, img);
      if (texture) {
        const tmpImg = new Image();
        tmpImg.src = texture;
        ctx.drawImage(tmpImg, 0, 0, canvasW, canvasH);
      }
    });

    if (window.rightPanel) window.rightPanel.updateTexture(group._id, outCanvas.toDataURL());
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
          draggable: true
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
    if (selectedGroup) {
      if (window.rightPanel) window.rightPanel.removeTexture(selectedGroup._id);
      selectedGroup.destroy(); selectedGroup = null; polygonLayer.draw();
    }
  });

  return stage;
}

// Given a polygon group, return the Konva.Image underneath it
function getUnderlyingImages(group) {
  const images = stageLeft.find('Image');
  if (!images || images.length === 0) return [];

  const groupBox = group.getClientRect();
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

  const stage = new Konva.Stage({
    container: containerId,
    width: stagePixelWidth,
    height: stagePixelHeight,
  });

  const layer = new Konva.Layer();
  stage.add(layer);

  // Transformer for selected rectangles
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
  layer.add(tr);

  const GUIDELINE_OFFSET = 5; // for snapping
  const tiedRects = {}; // id -> Konva.Image

  // ---------- Helper functions for snapping ----------
  function getLineGuideStops(skipNode) {
    const vertical = [0, stage.width()/2, stage.width()];
    const horizontal = [0, stage.height()/2, stage.height()];
    Object.values(tiedRects).forEach(node => {
      if (node === skipNode) return;
      const box = node.getClientRect();
      vertical.push(box.x, box.x + box.width, box.x + box.width/2);
      horizontal.push(box.y, box.y + box.height, box.y + box.height/2);
    });
    return { vertical: vertical.flat(), horizontal: horizontal.flat() };
  }

  function getObjectSnappingEdges(node) {
    const box = node.getClientRect();
    const absPos = node.absolutePosition();
    return {
      vertical: [
        { guide: Math.round(box.x), offset: Math.round(absPos.x - box.x) },
        { guide: Math.round(box.x + box.width/2), offset: Math.round(absPos.x - box.x - box.width/2) },
        { guide: Math.round(box.x + box.width), offset: Math.round(absPos.x - box.x - box.width) }
      ],
      horizontal: [
        { guide: Math.round(box.y), offset: Math.round(absPos.y - box.y) },
        { guide: Math.round(box.y + box.height/2), offset: Math.round(absPos.y - box.y - box.height/2) },
        { guide: Math.round(box.y + box.height), offset: Math.round(absPos.y - box.y - box.height) }
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
	  guides.forEach(g => {
	    const line = new Konva.Line({
	      points: g.orientation === 'V' ? [0, -6000, 0, 6000] : [-6000, 0, 6000, 0],
	      stroke: 'rgb(0, 161, 255)',
	      strokeWidth: 1,
	      dash: [4,6],
	      name: 'guid-line'
	    });
	    if (g.orientation === 'V') line.absolutePosition({ x: g.lineGuide, y: 0 });
	    else if (g.orientation === 'H') line.absolutePosition({ x: 0, y: g.lineGuide });
	    layer.add(line);
	  });
	}


  // ---------- Main API ----------
  window.rightPanel = {
    updateTexture(groupId, textureData) {
      const img = new Image();
      img.onload = () => {
        if (tiedRects[groupId]) {
          tiedRects[groupId].image(img);
          layer.batchDraw();
        } else {
          const konvaImg = new Konva.Image({
            x: stagePixelWidth / 4,
            y: stagePixelHeight / 4,
            image: img,
            draggable: true,
            id: `rect_${groupId}`
          });
          layer.add(konvaImg);
          tiedRects[groupId] = konvaImg;

          // Make selectable with transformer
          konvaImg.on('click', () => tr.nodes([konvaImg]));

          // Snapping logic
          konvaImg.on('dragmove', e => {
            layer.find('.guid-line').forEach(l=>l.destroy());
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
          konvaImg.on('dragend', e => layer.find('.guid-line').forEach(l=>l.destroy()));

          layer.batchDraw();
        }
      };
      img.src = textureData;
    },
    removeTexture(groupId) {
      if (tiedRects[groupId]) {
        tiedRects[groupId].destroy();
        delete tiedRects[groupId];
        layer.draw();
      }
    }
  };

  return stage;
}

// ------------------- Init -------------------
const stageLeft = initLeftPanel('canvasLeftContainer', 'addRectLeft', 'deleteObjLeft', 'bgUploadLeft');
const stageRight = initRightPanel('canvasRightContainer');

let isPanning = false;
let lastPos = { x: 0, y: 0 };

stageLeft.on("mousedown", (e) => {
  if (e.evt.button === 1) { // middle click
    isPanning = true;
    lastPos = stageLeft.getPointerPosition();
    e.evt.preventDefault();

    // temporarily disable dragging for nodes so Konva doesn't "steal" the event
    stageLeft.find("Image").forEach(img => img.draggable(false));
    stageLeft.find(".group").forEach(g => g.draggable(false));
  }
});

stageLeft.on("mouseup", () => {
  if (isPanning) {
    isPanning = false;

    // re-enable node dragging for left click
    stageLeft.find("Image").forEach(img => img.draggable(true));
    stageLeft.find(".group").forEach(g => g.draggable(true));
  }
});

stageLeft.on("mousemove", () => {
  if (!isPanning) return;

  const pos = stageLeft.getPointerPosition();
  const dx = pos.x - lastPos.x;
  const dy = pos.y - lastPos.y;

  stageLeft.x(stageLeft.x() + dx);
  stageLeft.y(stageLeft.y() + dy);
  stageLeft.batchDraw();

  lastPos = pos;
});

// prevent context menu on middle click
stageLeft.container().addEventListener("contextmenu", (e) => e.preventDefault());


const scaleBy = 1.1;
stageLeft.on('wheel', (e) => {
  // stop default scrolling
  e.evt.preventDefault();

  const oldScale = stageLeft.scaleX();
  const pointer = stageLeft.getPointerPosition();

  const mousePointTo = {
    x: (pointer.x - stageLeft.x()) / oldScale,
    y: (pointer.y - stageLeft.y()) / oldScale,
  };

  // how to scale? Zoom in? Or zoom out?
  let direction = e.evt.deltaY > 0 ? -1 : 1;

  // when we zoom on trackpad, e.evt.ctrlKey is true
  // in that case lets revert direction
  if (e.evt.ctrlKey) {
    direction = -direction;
  }

  const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

  stageLeft.scale({ x: newScale, y: newScale });

  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  stageLeft.position(newPos);
});