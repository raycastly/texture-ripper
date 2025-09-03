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

    // Extract texture from polygon
    extractTexture: (group, bgImage, opts = {}) => {
        const minSize = opts.minSize || CONFIG.EXTRACTION.MIN_SIZE;
        const maxSize = opts.maxSize || CONFIG.EXTRACTION.MAX_SIZE;
        const upscale = opts.upscale || CONFIG.EXTRACTION.UPSCALE;

        if (!bgImage || !bgImage.image()) return null;

        // 1) Get the 4 vertices in LOCAL coordinates (ignore stage scaling)
        const absPts = [];
        group.find('.vertex').forEach(vertex => {
            // Use the vertex's local position relative to the group
            const localPos = vertex.position();
            absPts.push({ x: localPos.x, y: localPos.y });
        });

        // Get coordinates relative to the image top-left (ignore stage scaling)
        const dispPts = absPts.map(p => ({
            x: p.x + group.x() - bgImage.x(),
            y: p.y + group.y() - bgImage.y()
        }));

        // Map to original image pixels (ignore stage scaling)
        const origImg = bgImage.image();
        const ratioX = origImg.width / bgImage.width();
        const ratioY = origImg.height / bgImage.height();
        const srcPts = dispPts.map(p => ({ x: p.x * ratioX, y: p.y * ratioY }));

        // 4) Compute average width/height in pixels
        const [p0, p1, p2, p3] = srcPts;
        const avgWidth = (Utils.dist(p0, p3) + Utils.dist(p1, p2)) / 2;
        const avgHeight = (Utils.dist(p0, p1) + Utils.dist(p3, p2)) / 2;

        // 5) Determine output size
        let outW = Math.max(minSize, Math.round(avgWidth * upscale));
        let outH = Math.max(minSize, Math.round(avgHeight * upscale));
        outW = Utils.clamp(outW, minSize, maxSize);
        outH = Utils.clamp(outH, minSize, maxSize);
        
        if (!isFinite(outW) || !isFinite(outH) || outW <= 0 || outH <= 0) return null;

        // 6) Destination corners
        const dst = [
            { x: 0, y: 0 },
            { x: 0, y: outH - 1 },
            { x: outW - 1, y: outH - 1 },
            { x: outW - 1, y: 0 }
        ];

        // 7) Compute homography
        const H = Homography.findHomography(srcPts, dst);
        const Hinv = Homography.invert3(H);

        // 8) Prepare canvases
        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d');

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

        // 9) Sample each pixel using bilinear interpolation
        for (let y = 0; y < outH; y++) {
            for (let x = 0; x < outW; x++) {
                const srcPt = Homography.applyHomography(Hinv, { x, y });
                const rgba = ImageProcessing.sampleBilinear(srcPixels, srcW, srcH, srcPt.x, srcPt.y);
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
};