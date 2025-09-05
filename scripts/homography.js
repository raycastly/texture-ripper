// ==================== HOMOGRAPHY AND IMAGE PROCESSING ====================
const Homography = {
    // Apply homography to a point
    applyHomography: (H, pt) => {
        const x = pt.x, y = pt.y;
        const denom = H[6]*x + H[7]*y + H[8];
        return {
            x: (H[0]*x + H[1]*y + H[2]) / denom,
            y: (H[3]*x + H[4]*y + H[5]) / denom
        };
    },

    // Invert a 3x3 matrix
    invert3: (H) => {
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
    },

    // Solve for homography given 4 correspondences
    findHomography: (src, dst) => {
        const M = [];
        for (let i = 0; i < 4; i++) {
            const xs = src[i].x, ys = src[i].y;
            const xd = dst[i].x, yd = dst[i].y;

            M.push([-xs, -ys, -1, 0, 0, 0, xs*xd, ys*xd, xd]);
            M.push([0, 0, 0, -xs, -ys, -1, xs*yd, ys*yd, yd]);
        }

        // Solve M*h = 0 using SVD
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
};

const ImageProcessing = {
    // Bilinear interpolation sampling
    sampleBilinear: (imgData, width, height, x, y) => {
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
            c.push(Math.round(val));
        }
        return c;
    },

    // Extract texture from curved polygon using Coons patch mapping
    extractTexture: (group, bgImage, opts = {}) => {
        const minSize = opts.minSize || CONFIG.EXTRACTION.MIN_SIZE;
        const maxSize = opts.maxSize || CONFIG.EXTRACTION.MAX_SIZE;
        const upscale = opts.upscale || CONFIG.EXTRACTION.UPSCALE;

        if (!bgImage || !bgImage.image()) return null;

        // 1) Collect the 4 polygon vertices and midpoints (in group-local coords)
        const verticesLocal = [];
        group.find('.vertex').forEach(vertex => {
            const pos = vertex.position(); // local to group
            verticesLocal.push({ x: pos.x, y: pos.y });
        });

        const midpointsLocal = [];
        group.find('.midpoint').forEach(midpoint => {
            const pos = midpoint.position(); // local to group
            midpointsLocal.push({ x: pos.x, y: pos.y });
        });

        if (verticesLocal.length !== 4 || midpointsLocal.length !== 4) return null;

        // 2) Map group-local points -> background image pixel coordinates (orig image)
        const imgScaleX = bgImage.scaleX();
        const imgScaleY = bgImage.scaleY();
        const imgRotation = bgImage.rotation(); // degrees
        const imgWidth = bgImage.width();
        const imgHeight = bgImage.height();
        const origImg = bgImage.image();
        if (!origImg) return null;

        // Map a local point to the original image pixel coordinates
        function mapLocalToOrigPixels(pLocal) {
            // Apply group translation
            const groupX = pLocal.x + group.x();
            const groupY = pLocal.y + group.y();

            // Convert to image-local coords relative to image top-left
            let localX = groupX - bgImage.x();
            let localY = groupY - bgImage.y();

            // Undo image scale
            localX /= imgScaleX;
            localY /= imgScaleY;

            // Undo image rotation around center (reverse of earlier)
            if (imgRotation !== 0) {
                const rad = -imgRotation * Math.PI / 180; // negative to undo
                const centerX = imgWidth / 2;
                const centerY = imgHeight / 2;

                const tx = localX - centerX;
                const ty = localY - centerY;

                const rx = tx * Math.cos(rad) - ty * Math.sin(rad);
                const ry = tx * Math.sin(rad) + ty * Math.cos(rad);

                localX = rx + centerX;
                localY = ry + centerY;
            }

            // Map from image-local to original pixel coordinates
            const px = localX * (origImg.width / imgWidth);
            const py = localY * (origImg.height / imgHeight);

            return { x: px, y: py };
        }

        // Map all vertices and midpoints to original image coordinates
        const srcVerts = verticesLocal.map(mapLocalToOrigPixels);
        const srcMids = midpointsLocal.map(mapLocalToOrigPixels);

        // 3) Decide output rectangle size (based on straight vertex distances)
        const [p0, p1, p2, p3] = srcVerts;
        const dist = (A, B) => Math.hypot(A.x - B.x, A.y - B.y);
        const avgWidth = (dist(p0, p3) + dist(p1, p2)) / 2;
        const avgHeight = (dist(p0, p1) + dist(p3, p2)) / 2;

        let outW = Math.max(minSize, Math.round(avgWidth * upscale));
        let outH = Math.max(minSize, Math.round(avgHeight * upscale));
        outW = Utils.clamp(outW, minSize, maxSize);
        outH = Utils.clamp(outH, minSize, maxSize);

        if (!isFinite(outW) || !isFinite(outH) || outW <= 0 || outH <= 0) return null;

        // 4) Prepare source pixel buffer
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = origImg.width;
        srcCanvas.height = origImg.height;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(origImg, 0, 0, origImg.width, origImg.height);
        const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
        const srcPixels = srcImageData.data;
        const srcW = srcImageData.width;
        const srcH = srcImageData.height;

        // 5) Create Coons patch mapping functions for the source polygon
        const alpha = 0.5; // Same as used in drawCurvedPolygon

        // Build curves for each edge in source space
        const edges = [];
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            const P0 = srcVerts[i];
            const P3 = srcVerts[j];
            const M = srcMids[i];
            
            // Compute control points based on midpoint (same as in drawCurvedPolygon)
            const C1 = {
                x: M.x + alpha * (P0.x - M.x),
                y: M.y + alpha * (P0.y - M.y)
            };
            
            const C2 = {
                x: M.x + alpha * (P3.x - M.x),
                y: M.y + alpha * (P3.y - M.y)
            };
            
            // Sample the bezier curve
            const pts = [];
            const numSamples = 100;
            for (let k = 0; k <= numSamples; k++) {
                const t = k / numSamples;
                const mt = 1 - t;
                const x = mt*mt*mt*P0.x + 3*mt*mt*t*C1.x + 3*mt*t*t*C2.x + t*t*t*P3.x;
                const y = mt*mt*mt*P0.y + 3*mt*mt*t*C1.y + 3*mt*t*t*C2.y + t*t*t*P3.y;
                pts.push({x, y});
            }
            edges.push(pts);
        }

        // Named edges
        const TOP = 0, RIGHT = 1, BOTTOM = 2, LEFT = 3;
        const topEdge = edges[TOP];       // left→right
        const rightEdge = edges[RIGHT];   // top→bottom
        const bottomEdge = edges[BOTTOM]; // right→left
        const leftEdge = edges[LEFT];     // bottom→top

        // Parametric evaluators for source edges
        function C_top(u) { 
            const idx = Math.min(Math.floor(u * (topEdge.length - 1)), topEdge.length - 1);
            return topEdge[idx]; 
        }
        
        function C_bottom(u) { 
            const idx = Math.min(Math.floor((1 - u) * (bottomEdge.length - 1)), bottomEdge.length - 1);
            return bottomEdge[idx]; 
        }
        
        function C_left(v) { 
            const idx = Math.min(Math.floor((1 - v) * (leftEdge.length - 1)), leftEdge.length - 1);
            return leftEdge[idx]; 
        }
        
        function C_right(v) { 
            const idx = Math.min(Math.floor(v * (rightEdge.length - 1)), rightEdge.length - 1);
            return rightEdge[idx]; 
        }

        // Coons patch mapping function (from parameter space to source image space)
        function mapCoons(u, v) {
            const top = C_top(u);
            const bottom = C_bottom(u);
            const left = C_left(v);
            const right = C_right(v);
            
            // Bilinear interpolation of the four corners
            const b = {
                x: (1-u)*(1-v)*srcVerts[0].x + u*(1-v)*srcVerts[1].x + 
                    u*v*srcVerts[2].x + (1-u)*v*srcVerts[3].x,
                y: (1-u)*(1-v)*srcVerts[0].y + u*(1-v)*srcVerts[1].y + 
                    u*v*srcVerts[2].y + (1-u)*v*srcVerts[3].y
            };
            
            // Coons patch formula
            return {
                x: (1-v)*top.x + v*bottom.x + (1-u)*left.x + u*right.x - b.x,
                y: (1-v)*top.y + v*bottom.y + (1-u)*left.y + u*right.y - b.y
            };
        }

        // 6) Output canvas - sample using Coons patch mapping
        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d');
        const outImageData = outCtx.createImageData(outW, outH);
        const outPixels = outImageData.data;

        // Sample the source image using the Coons patch mapping
        for (let y = 0; y < outH; y++) {
            for (let x = 0; x < outW; x++) {
                // Normalized coordinates in output texture
                const u = x / (outW - 1);
                const v = y / (outH - 1);
                
                // Map to source image using Coons patch
                const srcPt = mapCoons(u, v);
                
                // If srcPt falls inside source bounds, sample; otherwise transparent
                if (srcPt.x >= 0 && srcPt.x < srcW && srcPt.y >= 0 && srcPt.y < srcH) {
                    const rgba = ImageProcessing.sampleBilinear(srcPixels, srcW, srcH, srcPt.x, srcPt.y);
                    const idx = (y * outW + x) * 4;
                    outPixels[idx] = rgba[0];
                    outPixels[idx + 1] = rgba[1];
                    outPixels[idx + 2] = rgba[2];
                    outPixels[idx + 3] = rgba[3];
                } else {
                    const idx = (y * outW + x) * 4;
                    outPixels[idx] = 0;
                    outPixels[idx + 1] = 0;
                    outPixels[idx + 2] = 0;
                    outPixels[idx + 3] = 0;
                }
            }
        }

        outCtx.putImageData(outImageData, 0, 0);
        return outCanvas.toDataURL('image/png');
    }
};