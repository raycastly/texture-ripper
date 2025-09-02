/**
 * Homography Library
 * Maps a quadrilateral to a rectangle
 */

/** Apply homography to a point */
function applyHomography(H, pt) {
  const x = pt.x, y = pt.y;
  const denom = H[6]*x + H[7]*y + H[8];
  return {
    x: (H[0]*x + H[1]*y + H[2]) / denom,
    y: (H[3]*x + H[4]*y + H[5]) / denom
  };
}

/** Invert a 3x3 matrix */
function invert3(H) {
  const a = H[0], b = H[1], c = H[2];
  const d = H[3], e = H[4], f = H[5];
  const g = H[6], h = H[7], i = H[8];

  const A = e*i - f*h;
  const B = c*h - b*i;
  const C = b*f - c*e;
  const D = f*g - d*i;
  const E = a*i - c*g;
  const F = c*d - a*f;
  const G = d*h - e*g;
  const H2 = b*g - a*h;
  const I = a*e - b*d;

  const det = a*A + b*D + c*G;

  return [
    A/det, B/det, C/det,
    D/det, E/det, F/det,
    G/det, H2/det, I/det
  ];
}

/** Solve for homography given 4 correspondences */
function findHomography(src, dst) {
  const M = [];
  for (let i = 0; i < 4; i++) {
    const xs = src[i].x, ys = src[i].y;
    const xd = dst[i].x, yd = dst[i].y;

    M.push([-xs, -ys, -1, 0, 0, 0, xs*xd, ys*xd, xd]);
    M.push([0, 0, 0, -xs, -ys, -1, xs*yd, ys*yd, yd]);
  }

  // Solve M*h = 0 using SVD
  // For simplicity, let's use numeric.js library if available
  // Here we implement a small 8x8 solver
  const A = [];
  const b = [];
  for (let i = 0; i < 8; i++) {
    A.push(M[i].slice(0,8));
    b.push(-M[i][8]);
  }

  const h = numeric.solve(A, b); // h0..h7
  h.push(1); // h8 = 1

  return h;
}

/** Bilinear interpolation sampling */
function sampleBilinear(imgData, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0+1, width-1);
  const y1 = Math.min(y0+1, height-1);

  const dx = x - x0;
  const dy = y - y0;

  function getPixel(ix, iy) {
    const idx = (iy*width + ix) * 4;
    return [
      imgData[idx],
      imgData[idx+1],
      imgData[idx+2],
      imgData[idx+3]
    ];
  }

  const c00 = getPixel(x0,y0);
  const c10 = getPixel(x1,y0);
  const c01 = getPixel(x0,y1);
  const c11 = getPixel(x1,y1);

  const c = [];
  for (let i = 0; i < 4; i++) {
    const val = c00[i]*(1-dx)*(1-dy) + c10[i]*dx*(1-dy) + c01[i]*(1-dx)*dy + c11[i]*dx*dy;
    c.push(val);
  }
  return c;
}

/** Warp quadrilateral to rectangle */
function warpQuadrilateral(imgData, src, tw, th) {
  const dst = [
    {x:0,y:0}, {x:tw-1,y:0}, {x:tw-1,y:th-1}, {x:0,y:th-1}
  ];

  const H = findHomography(src,dst);
  const Hinv = invert3(H);

  const output = new Uint8ClampedArray(tw*th*4);

  for (let y=0; y<th; y++) {
    for (let x=0; x<tw; x++) {
      const srcPt = applyHomography(Hinv,{x,y});
      const rgba = sampleBilinear(imgData, imgData.width, imgData.height, srcPt.x, srcPt.y);
      const idx = (y*tw + x)*4;
      output[idx] = rgba[0];
      output[idx+1] = rgba[1];
      output[idx+2] = rgba[2];
      output[idx+3] = rgba[3];
    }
  }

  return output;
}
