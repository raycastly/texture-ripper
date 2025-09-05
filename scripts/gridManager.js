// ==================== GRID MANAGEMENT ====================
const GridManager = {
  // Draw a simple 3x3 grid that follows the curved edges
  drawGrid: (group, vertices, midpoints) => {
    group.find('.grid').forEach(g => g.destroy());
    if (vertices.length !== 4 || midpoints.length !== 4) return;

    const alpha = 0.5;

    // Sample points along each curved edge (i -> i+1)
    const edges = [];
    for (let i = 0; i < 4; i++) {
      const nextIdx = (i + 1) % 4;
      const P0 = vertices[i];
      const P3 = vertices[nextIdx];
      const M = midpoints[i];

      // Control points pulled toward the midpoint
      const C1 = { x: M.x + alpha * (P0.x - M.x), y: M.y + alpha * (P0.y - M.y) };
      const C2 = { x: M.x + alpha * (P3.x - M.x), y: M.y + alpha * (P3.y - M.y) };

      const edgePoints = [];
      for (let t = 0; t <= 1.000001; t += 0.02) {
        const mt = 1 - t;
        const x = mt*mt*mt*P0.x + 3*mt*mt*t*C1.x + 3*mt*t*t*C2.x + t*t*t*P3.x;
        const y = mt*mt*mt*P0.y + 3*mt*mt*t*C1.y + 3*mt*t*t*C2.y + t*t*t*P3.y;
        edgePoints.push({ x, y });
      }
      edges.push(edgePoints);
    }

    // Name the edges explicitly to avoid confusion:
    const TOP = 0, RIGHT = 1, BOTTOM = 2, LEFT = 3;
    const topEdge = edges[TOP];     // left -> right
    const rightEdge = edges[RIGHT]; // top -> bottom
    const bottomEdge = edges[BOTTOM]; // right -> left (reversed)
    const leftEdge = edges[LEFT];   // bottom -> top (reversed)

    // grid fractions between 0 (top/left) and 1 (bottom/right)
    for (const s of [1/3, 2/3]) {
      // -------- Horizontal lines (left -> right) --------
      // Left edge runs bottom->top, so reverse index with (1 - s)
      const li = Math.floor((1 - s) * (leftEdge.length - 1));
      // Right edge runs top->bottom, so use s directly
      const ri = Math.floor(s * (rightEdge.length - 1));

      const L = leftEdge[li];
      const R = rightEdge[ri];

      group.add(new Konva.Line({
        points: [L.x, L.y, R.x, R.y],
        stroke: CONFIG.GRID.STROKE,
        strokeWidth: CONFIG.GRID.STROKE_WIDTH,
        name: 'grid'
      }));

      // -------- Vertical lines (top -> bottom) --------
      // Top edge runs left->right, so use s directly
      const ti = Math.floor(s * (topEdge.length - 1));
      // Bottom edge runs right->left, so reverse with (1 - s)
      const bi = Math.floor((1 - s) * (bottomEdge.length - 1));

      const T = topEdge[ti];
      const B = bottomEdge[bi];

      group.add(new Konva.Line({
        points: [T.x, T.y, B.x, B.y],
        stroke: CONFIG.GRID.STROKE,
        strokeWidth: CONFIG.GRID.STROKE_WIDTH,
        name: 'grid'
      }));
    }
  }
};
