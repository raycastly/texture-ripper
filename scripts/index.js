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
function extractTextureFromPolygon(group, bgImage, outWidth = 128, outHeight = 128) {
  if (!bgImage) return null;

  const groupPos = group.position();
  const points = [];
group.find('.vertex').forEach(vertex => {
  const absPos = vertex.getAbsolutePosition();
  points.push({
    x: absPos.x - bgImage.x(),
    y: absPos.y - bgImage.y()
  });
});
  if (points.length !== 4) return null;

  const dst = [{ x: 0, y: 0 }, { x: outWidth - 1, y: 0 }, { x: outWidth - 1, y: outHeight - 1 }, { x: 0, y: outHeight - 1 }];
  const H = findHomography(points, dst), Hinv = invert3(H);

  const canvas = document.createElement('canvas');
  canvas.width = outWidth; canvas.height = outHeight;
  const ctx = canvas.getContext('2d');

  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = bgImage.width(); tmpCanvas.height = bgImage.height();
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(bgImage.image(), 0, 0, bgImage.width(), bgImage.height());
  const imgData = tmpCtx.getImageData(0, 0, bgImage.width(), bgImage.height());

  const outputData = ctx.createImageData(outWidth, outHeight);
  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const srcPt = applyHomography(Hinv, { x, y });
      const rgba = sampleBilinear(imgData.data, imgData.width, imgData.height, srcPt.x, srcPt.y);
      const idx = (y * outWidth + x) * 4;
      outputData.data.set(rgba, idx);
    }
  }

  ctx.putImageData(outputData, 0, 0);
  return canvas.toDataURL('image/png');
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

  const tr = new Konva.Transformer({ enabledAnchors: ['top-left','top-right','bottom-left','bottom-right'], rotateEnabled: true });
  layer.add(tr);

  const tiedRects = {};

  window.rightPanel = {
    updateTexture(groupId, textureData) {
      if (tiedRects[groupId]) {
        tiedRects[groupId].image().src = textureData;
      } else {
        Konva.Image.fromURL(textureData, (konvaImg) => {
          konvaImg.setAttrs({ x: stagePixelWidth / 4, y: stagePixelHeight / 4, draggable: true, id: `rect_${groupId}` });
          layer.add(konvaImg); tiedRects[groupId] = konvaImg; layer.batchDraw();
        });
      }
    },
    removeTexture(groupId) {
      if (tiedRects[groupId]) { tiedRects[groupId].destroy(); delete tiedRects[groupId]; layer.draw(); }
    }
  };

  return stage;
}

// ------------------- Init -------------------
const stageLeft = initLeftPanel('canvasLeftContainer', 'addRectLeft', 'deleteObjLeft', 'bgUploadLeft');
const stageRight = initRightPanel('canvasRightContainer');
