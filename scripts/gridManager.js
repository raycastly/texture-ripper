// ==================== GRID MANAGEMENT ====================
const GridManager = {
  drawGrid: (group, vertices, midpoints) => {
    group.find('.grid').forEach(g => g.destroy());
    if (vertices.length !== 4 || midpoints.length !== 4) return;

    const alpha = 0.5;

    // Helper: sample cubic Bezier
    function sampleQuadratic(P0, M, P2, steps=50) {
      const pts = [];
      for (let i=0; i<=steps; i++) {
        const t = i/steps, mt = 1-t;
        const x = mt*mt*P0.x + 2*mt*t*M.x + t*t*P2.x;
        const y = mt*mt*P0.y + 2*mt*t*M.y + t*t*P2.y;
        pts.push({x,y});
      }
      return pts;
    }

    // Build curves for each edge
    const edges = [];
    for (let i=0; i<4; i++) {
      const j = (i+1)%4;
      const P0 = vertices[i];
      const P2 = vertices[j];
      const M  = midpoints[i];
      edges.push(sampleQuadratic(P0, M, P2, 100));
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
        dash: [5, 5],
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
        dash: [5, 5],
        name: 'grid'
      }));
    }
  }
};
