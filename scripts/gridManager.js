// ==================== GRID MANAGEMENT ====================
const GridManager = {
  drawGrid: (group, vertices, midpoints) => {
    group.find('.grid').forEach(g => g.destroy());
    if (vertices.length !== 4 || midpoints.length !== 4) return;

    const alpha = 0.5;

    // Helper: sample cubic Bezier
    function sampleBezier(P0, C1, C2, P3, steps=50) {
      const pts = [];
      for (let i=0; i<=steps; i++) {
        const t = i/steps, mt=1-t;
        const x = mt*mt*mt*P0.x + 3*mt*mt*t*C1.x + 3*mt*t*t*C2.x + t*t*t*P3.x;
        const y = mt*mt*mt*P0.y + 3*mt*mt*t*C1.y + 3*mt*t*t*C2.y + t*t*t*P3.y;
        pts.push({x,y});
      }
      return pts;
    }

    // Build curves for each edge
    const edges = [];
    for (let i=0; i<4; i++) {
      const j = (i+1)%4;
      const P0 = vertices[i], P3 = vertices[j], M = midpoints[i];
      const C1 = {x: M.x + alpha*(P0.x-M.x), y: M.y + alpha*(P0.y-M.y)};
      const C2 = {x: M.x + alpha*(P3.x-M.x), y: M.y + alpha*(P3.y-M.y)};
      edges.push(sampleBezier(P0, C1, C2, P3, 100));
    }

    // Named edges
    const TOP=0, RIGHT=1, BOTTOM=2, LEFT=3;
    const topEdge = edges[TOP];       // left→right
    const rightEdge = edges[RIGHT];   // top→bottom
    const bottomEdge = edges[BOTTOM]; // right→left
    const leftEdge = edges[LEFT];     // bottom→top

    // Parametric evaluators
    function C_top(u)    { return topEdge[Math.floor(u*(topEdge.length-1))]; }
    function C_bottom(u) { return bottomEdge[Math.floor((1-u)*(bottomEdge.length-1))]; }
    function C_left(v)   { return leftEdge[Math.floor((1-v)*(leftEdge.length-1))]; }
    function C_right(v)  { return rightEdge[Math.floor(v*(rightEdge.length-1))]; }

    const P00 = vertices[0], P10 = vertices[1], P11 = vertices[2], P01 = vertices[3];

    function bilinear(u,v) {
      return {
        x: (1-u)*(1-v)*P00.x + u*(1-v)*P10.x + u*v*P11.x + (1-u)*v*P01.x,
        y: (1-u)*(1-v)*P00.y + u*(1-v)*P10.y + u*v*P11.y + (1-u)*v*P01.y
      };
    }

    function coons(u,v) {
      const top = C_top(u), bottom = C_bottom(u);
      const left = C_left(v), right = C_right(v);
      const blend = {
        x: (1-v)*top.x + v*bottom.x + (1-u)*left.x + u*right.x,
        y: (1-v)*top.y + v*bottom.y + (1-u)*left.y + u*right.y
      };
      const b = bilinear(u,v);
      return {x: blend.x - b.x, y: blend.y - b.y};
    }

    // Draw iso-lines for u=const (vertical) and v=const (horizontal)
    const samples = 40;
    for (const u of [1/3, 2/3]) {
      const pts = [];
      for (let i=0; i<=samples; i++) {
        const v = i/samples;
        const {x,y} = coons(u,v);
        pts.push(x,y);
      }
      group.add(new Konva.Line({
        points: pts,
        stroke: CONFIG.GRID.STROKE,
        strokeWidth: CONFIG.GRID.STROKE_WIDTH,
        name: 'grid'
      }));
    }

    for (const v of [1/3, 2/3]) {
      const pts = [];
      for (let i=0; i<=samples; i++) {
        const u = i/samples;
        const {x,y} = coons(u,v);
        pts.push(x,y);
      }
      group.add(new Konva.Line({
        points: pts,
        stroke: CONFIG.GRID.STROKE,
        strokeWidth: CONFIG.GRID.STROKE_WIDTH,
        name: 'grid'
      }));
    }
  }
};
