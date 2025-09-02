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
  const stage = new Konva.Stage({ container: containerId, width: container.clientWidth, height: container.clientHeight });
  const bgLayer = new Konva.Layer(), polygonLayer = new Konva.Layer();
  stage.add(bgLayer).add(polygonLayer);

  let bgImage = null, selectedGroup = null;

  document.getElementById('extractAllLeft').addEventListener('click', () => {
    if (!bgImage) return;
    polygonLayer.find('.group').forEach(group => {
      const texture = extractTextureFromPolygon(group, bgImage);
      if (texture && window.rightPanel) window.rightPanel.updateTexture(group._id, texture);
    });
  });

  document.getElementById(uploadId).addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        if (bgImage) bgImage.destroy();
        const scale = Math.min(stage.width() / img.width, stage.height() / img.height);
        bgImage = new Konva.Image({
          x: (stage.width() - img.width * scale) / 2,
          y: (stage.height() - img.height * scale) / 2,
          image: img, width: img.width * scale, height: img.height * scale
        });
        bgLayer.add(bgImage).batchDraw();
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

// ------------------- Right Panel -------------------
function initRightPanel(containerId) {
  const container = document.getElementById(containerId);
  const stagePixelWidth = parseInt(document.getElementById('rightWidth').value);
  const stagePixelHeight = parseInt(document.getElementById('rightHeight').value);

  const stage = new Konva.Stage({ container: containerId, width: stagePixelWidth, height: stagePixelHeight });
  const layer = new Konva.Layer(); stage.add(layer);

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


  const tiedRects = {};

  window.rightPanel = {
    updateTexture(groupId, textureData) {
	  if (tiedRects[groupId]) {
		  const img = new Image();
		  img.onload = () => {
		    tiedRects[groupId].image(img);
		    layer.batchDraw();
		  };
		  img.src = textureData;
		}
 		else {
	    // Create new Konva.Image if none exists
	    const img = new Image();
	    img.onload = () => {
	      const konvaImg = new Konva.Image({
	        x: stagePixelWidth / 4,
	        y: stagePixelHeight / 4,
	        image: img,
	        draggable: true,
	        id: `rect_${groupId}`
	      });

	      konvaImg.on('click', (evt) => {
		    tr.nodes([konvaImg]);  // attach transformer to the clicked rectangle
		    layer.batchDraw();
		  });

		  konvaImg.on('dragmove', () => {
			  snapToStageEdges(konvaImg, stage.width(), stage.height());
			});

			konvaImg.on('transform', () => {
			  snapToStageEdges(konvaImg, stage.width(), stage.height());
			});

	      layer.add(konvaImg);
	      tiedRects[groupId] = konvaImg;
	      layer.batchDraw();
	    };
	    img.src = textureData;
	  }
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

const SNAP_DIST = 10; // distance threshold to snap

function snapToStageEdges(shape, stageWidth, stageHeight) {
  let pos = shape.position();
  let width = shape.width() * shape.scaleX();
  let height = shape.height() * shape.scaleY();

  // Snap left
  if (Math.abs(pos.x) < SNAP_DIST) pos.x = 0;
  // Snap top
  if (Math.abs(pos.y) < SNAP_DIST) pos.y = 0;
  // Snap right
  if (Math.abs(pos.x + width - stageWidth) < SNAP_DIST) pos.x = stageWidth - width;
  // Snap bottom
  if (Math.abs(pos.y + height - stageHeight) < SNAP_DIST) pos.y = stageHeight - height;

  shape.position(pos);
  shape.getLayer().batchDraw();
}

// ------------------- Init -------------------
const stageLeft = initLeftPanel('canvasLeftContainer', 'addRectLeft', 'deleteObjLeft', 'bgUploadLeft');
const stageRight = initRightPanel('canvasRightContainer');
