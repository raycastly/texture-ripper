// ------------------- Helper Functions -------------------

// Draw 3x3 grid inside a rectangle
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

// Create polygon group with draggable vertices
function createPolygonGroup(stage, layer) {
  const group = new Konva.Group({ draggable: true });
  const rectPoints = [
    { x: 50, y: 50 },
    { x: 50, y: 150 },
    { x: 150, y: 150 },
    { x: 150, y: 50 }
  ];

  // Polygon edges
  const polygon = new Konva.Line({
    points: rectPoints.flatMap(p => [p.x, p.y]),
    stroke: 'black',
    strokeWidth: 2,
    closed: true,
    name: 'polygon'
  });
  group.add(polygon);

  // Vertex circles
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
      if (outline) {
        outline.points(rectPoints.flatMap(p => [p.x, p.y]));
      }

      layer.batchDraw();
    });

    group.add(vertex);
  });

  drawGrid(group, rectPoints);

  // Selection outline on click
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

// ------------------- Initialize Panels -------------------
function initPanel(stageId, addBtnId, deleteBtnId, uploadId, width, height) {
  const stage = new Konva.Stage({ container: stageId, width, height });
  
  // Background layer
  const bgLayer = new Konva.Layer();
  stage.add(bgLayer);

  // Polygon layer
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

        const canvasWidth = stage.width();
        const canvasHeight = stage.height();
        let imgWidth = img.width;
        let imgHeight = img.height;

        const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight);
        imgWidth *= scale;
        imgHeight *= scale;

        bgImage = new Konva.Image({
          x: (canvasWidth - imgWidth)/2,
          y: (canvasHeight - imgHeight)/2,
          image: img,
          width: imgWidth,
          height: imgHeight
        });

        bgLayer.add(bgImage);
        bgLayer.draw();
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

  // Zoom with wheel
  stage.on('wheel', e => {
    e.evt.preventDefault();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const scaleBy = 1.1;
    const direction = e.evt.deltaY > 0 ? 1 / scaleBy : scaleBy;
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
  stage.container().addEventListener('contextmenu', e => e.preventDefault());

  return stage;
}

// ------------------- Initialize Left and Right Panels -------------------
const stageLeft = initPanel('canvasLeftContainer', 'addRectLeft', 'deleteObjLeft', 'bgUploadLeft', 500, 500);
const stageRight = initPanel('canvasRightContainer', 'addRectRight', 'deleteObjRight', 'bgUploadRight', 300, 300);
