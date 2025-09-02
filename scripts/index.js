// ------------------- Helper Functions -------------------

// Draw 3x3 grid inside a polygon
function drawGrid(group, rectPoints) {
  group.find('.grid').forEach(g => g.destroy());
  if (rectPoints.length !== 4) return;

  const [p1, p2, p3, p4] = rectPoints;

  function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  for (let t of [1/3, 2/3]) {
    // Vertical lines
    const left = lerp(p1, p2, t);
    const right = lerp(p4, p3, t);
    group.add(new Konva.Line({
      points: [left.x, left.y, right.x, right.y],
      stroke: 'rgba(0,0,0,0.4)',
      strokeWidth: 1,
      name: 'grid'
    }));
    // Horizontal lines
    const top = lerp(p1, p4, t);
    const bottom = lerp(p2, p3, t);
    group.add(new Konva.Line({
      points: [top.x, top.y, bottom.x, bottom.y],
      stroke: 'rgba(0,0,0,0.4)',
      strokeWidth: 1,
      name: 'grid'
    }));
  }
}

// Create a polygon group with draggable vertices
function createPolygonGroup(stage, layer) {
  const group = new Konva.Group({ draggable: true });
  const rectPoints = [
    { x: 50, y: 50 },
    { x: 50, y: 150 },
    { x: 150, y: 150 },
    { x: 150, y: 50 }
  ];

  const polygon = new Konva.Line({
    points: rectPoints.flatMap(p => [p.x, p.y]),
    stroke: 'black',
    strokeWidth: 2,
    closed: true,
    name: 'polygon'
  });
  group.add(polygon);

  rectPoints.forEach((point, i) => {
    const vertex = new Konva.Circle({
      x: point.x,
      y: point.y,
      radius: 5,
      fill: 'rgba(0,0,255,0.5)',
      draggable: true,
      name: 'vertex'
    });

    vertex.on('dragmove', () => {
      rectPoints[i].x = vertex.x();
      rectPoints[i].y = vertex.y();
      polygon.points(rectPoints.flatMap(p => [p.x, p.y]));
      drawGrid(group, rectPoints);

      const outline = group.findOne('.selection');
      if (outline) outline.points(rectPoints.flatMap(p => [p.x, p.y]));
      layer.batchDraw();
    });

    group.add(vertex);
  });

  drawGrid(group, rectPoints);

  group.on('click', () => {
    group.getStage().find('.selection').forEach(s => s.destroy());
    const outline = new Konva.Line({
      points: rectPoints.flatMap(p => [p.x, p.y]),
      stroke: 'rgba(0,128,255,0.8)',
      strokeWidth: 2,
      closed: true,
      name: 'selection'
    });
    group.add(outline);
    layer.batchDraw();
  });

  return group;
}

// ------------------- Initialize Panel -------------------
function initLeftPanel(containerId, addBtnId, deleteBtnId, uploadId) {
  const container = document.getElementById(containerId);

  // Set stage to fill container
  const stage = new Konva.Stage({
    container: containerId,
    width: container.clientWidth,
    height: container.clientHeight
  });

  const bgLayer = new Konva.Layer();
  stage.add(bgLayer);

  const polygonLayer = new Konva.Layer();
  stage.add(polygonLayer);

  let bgImage = null;
  let selectedGroup = null;

  // Load background image
  document.getElementById(uploadId).addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        if (bgImage) bgImage.destroy();

        const scale = Math.min(stage.width() / img.width, stage.height() / img.height);
        const imgWidth = img.width * scale;
        const imgHeight = img.height * scale;

        bgImage = new Konva.Image({
          x: (stage.width() - imgWidth)/2,
          y: (stage.height() - imgHeight)/2,
          image: img,
          width: imgWidth,
          height: imgHeight
        });

        bgLayer.add(bgImage);
        bgLayer.batchDraw();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Add polygon
  document.getElementById(addBtnId).addEventListener('click', () => {
    const group = createPolygonGroup(stage, polygonLayer);
    polygonLayer.add(group);
    polygonLayer.draw();
    selectedGroup = group;
  });

  // Delete polygon
  document.getElementById(deleteBtnId).addEventListener('click', () => {
    if (selectedGroup) {
      selectedGroup.destroy();
      selectedGroup = null;
      polygonLayer.draw();
    }
  });

  // Zoom with mouse wheel
  stage.on('wheel', e => {
    e.evt.preventDefault();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const scaleBy = 1.1;
    const direction = e.evt.deltaY > 0 ? 1/scaleBy : scaleBy;
    const newScale = oldScale * direction;

    stage.scale({ x: newScale, y: newScale });

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };

    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });

    stage.batchDraw();
  });

  // Enable panning
  stage.draggable(true);

  // Responsive resizing
  window.addEventListener('resize', () => {
    stage.width(container.clientWidth);
    stage.height(container.clientHeight);
    stage.batchDraw();
  });

  return stage;
}

function initRightPanel(containerId, addBtnId, deleteBtnId, uploadId) {
    const container = document.getElementById(containerId);

    let width = parseInt(document.getElementById('rightWidth').value);
    let height = parseInt(document.getElementById('rightHeight').value);

    const stage = new Konva.Stage({
        container: containerId,
        width: width,
        height: height
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const tr = new Konva.Transformer();
    layer.add(tr);

    let selectedNodes = [];

    // Load image from file input
    document.getElementById(uploadId).addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = evt => {
            const imgObj = new Image();
            imgObj.onload = () => {
                const konvaImg = new Konva.Image({
                    x: stage.width() / 4,
                    y: stage.height() / 4,
                    image: imgObj,
                    draggable: true,
                });

                konvaImg.on('transform', () => layer.batchDraw());
                konvaImg.on('click', (ev) => {
                    // Handle multi-selection with shift/ctrl/meta
                    const metaPressed = ev.evt.shiftKey || ev.evt.ctrlKey || ev.evt.metaKey;
                    const isSelected = selectedNodes.indexOf(konvaImg) >= 0;

                    if (!metaPressed && !isSelected) {
                        selectedNodes = [konvaImg];
                    } else if (metaPressed && isSelected) {
                        selectedNodes = selectedNodes.filter(n => n !== konvaImg);
                    } else if (metaPressed && !isSelected) {
                        selectedNodes.push(konvaImg);
                    }

                    tr.nodes(selectedNodes);
                    layer.batchDraw();
                });

                layer.add(konvaImg);
                layer.batchDraw();
            };
            imgObj.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Selection rectangle
    const selectionRect = new Konva.Rect({
        fill: 'rgba(0,0,255,0.2)',
        visible: false
    });
    layer.add(selectionRect);

    let x1, y1, x2, y2;

    stage.on('mousedown touchstart', e => {
        if (e.target !== stage) return;
        x1 = stage.getPointerPosition().x;
        y1 = stage.getPointerPosition().y;
        selectionRect.visible(true);
        selectionRect.width(0);
        selectionRect.height(0);
    });

    stage.on('mousemove touchmove', () => {
        if (!selectionRect.visible()) return;
        x2 = stage.getPointerPosition().x;
        y2 = stage.getPointerPosition().y;

        selectionRect.setAttrs({
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1)
        });
        layer.batchDraw();
    });

    stage.on('mouseup touchend', () => {
        if (!selectionRect.visible()) return;
        selectionRect.visible(false);

        const box = selectionRect.getClientRect();
        const shapes = stage.find('Image');
        selectedNodes = shapes.filter(shape => Konva.Util.haveIntersection(box, shape.getClientRect()));
        tr.nodes(selectedNodes);
        layer.batchDraw();
    });

    // Zoom with mouse wheel
    stage.on('wheel', e => {
        e.evt.preventDefault();
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        const scaleBy = 1.1;
        const direction = e.evt.deltaY > 0 ? 1/scaleBy : scaleBy;
        const newScale = oldScale * direction;

        stage.scale({ x: newScale, y: newScale });

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale
        };

        stage.position({
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale
        });

        stage.batchDraw();
    });

    // Panning
    stage.draggable(true);

    // Resize button logic
    const widthInput = document.getElementById('rightWidth');
    const heightInput = document.getElementById('rightHeight');
    const resizeBtn = document.getElementById('resizeRight');

    resizeBtn.addEventListener('click', () => {
        const w = Math.max(50, parseInt(widthInput.value));
        const h = Math.max(50, parseInt(heightInput.value));
        stage.width(w);
        stage.height(h);
        stage.batchDraw();
    });

    return stage;
}

// Initialize the panels
const stageLeft = initLeftPanel('canvasLeftContainer', 'addRectLeft', 'deleteObjLeft', 'bgUploadLeft');
const stageRight = initRightPanel('canvasRightContainer', 'addRectRight', 'deleteObjRight', 'bgUploadRight');
