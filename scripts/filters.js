// === 1. Grayscale / Black & White ===
Konva.Filters.BW = function(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    data[i] = data[i+1] = data[i+2] = avg;
  }
};

// === 2. Quantize / Posterize ===
Konva.Filters.Quantize = function(imageData, levels = 4) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(data[i] / 256 * levels) * (256 / levels);       // Red
    data[i+1] = Math.floor(data[i+1] / 256 * levels) * (256 / levels);   // Green
    data[i+2] = Math.floor(data[i+2] / 256 * levels) * (256 / levels);   // Blue
  }
};

// === 3. Simple Dithering (Floyd-Steinberg) ===
Konva.Filters.Dither = function(imageData) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const getIndex = (x, y) => (y * width + x) * 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIndex(x, y);
      const oldR = data[idx];
      const oldG = data[idx+1];
      const oldB = data[idx+2];

      const newR = Math.round(oldR / 255) * 255;
      const newG = Math.round(oldG / 255) * 255;
      const newB = Math.round(oldB / 255) * 255;

      data[idx] = newR;
      data[idx+1] = newG;
      data[idx+2] = newB;

      const errR = oldR - newR;
      const errG = oldG - newG;
      const errB = oldB - newB;

      // distribute error to neighbors
      const distribute = (dx, dy, factor) => {
        if (x + dx < width && y + dy < height && x + dx >= 0 && y + dy >= 0) {
          const i = getIndex(x + dx, y + dy);
          data[i] = Math.min(255, Math.max(0, data[i] + errR * factor));
          data[i+1] = Math.min(255, Math.max(0, data[i+1] + errG * factor));
          data[i+2] = Math.min(255, Math.max(0, data[i+2] + errB * factor));
        }
      };

      distribute(1, 0, 7/16);
      distribute(-1, 1, 3/16);
      distribute(0, 1, 5/16);
      distribute(1, 1, 1/16);
    }
  }
};

// === 4. Pixelation (Downscale / Upscale) ===
Konva.Filters.Pixelate = function(imageData, pixelSize = 4) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];

      for (let dy = 0; dy < pixelSize; dy++) {
        for (let dx = 0; dx < pixelSize; dx++) {
          const xi = x + dx;
          const yi = y + dy;
          if (xi < width && yi < height) {
            const i = (yi * width + xi) * 4;
            data[i] = r;
            data[i+1] = g;
            data[i+2] = b;
          }
        }
      }
    }
  }
};

// === 5. Washout / Contrast Reduction ===
Konva.Filters.Washout = function(imageData, factor = 0.5) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] * factor + 128 * (1 - factor);
    data[i+1] = data[i+1] * factor + 128 * (1 - factor);
    data[i+2] = data[i+2] * factor + 128 * (1 - factor);
  }
};
