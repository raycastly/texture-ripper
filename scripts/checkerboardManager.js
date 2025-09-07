const CheckerboardManager = {
    createCheckerboard: (width, height, cellSize = 20) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Create checkerboard pattern
        for (let y = 0; y < height; y += cellSize) {
            for (let x = 0; x < width; x += cellSize) {
                const isEvenRow = Math.floor(y / cellSize) % 2 === 0;
                const isEvenCol = Math.floor(x / cellSize) % 2 === 0;
                
                ctx.fillStyle = (isEvenRow && isEvenCol) || (!isEvenRow && !isEvenCol) 
                    ? CONFIG.CHECKERBOARD.COLOR1 
                    : CONFIG.CHECKERBOARD.COLOR2;
                
                ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
        
        return canvas.toDataURL();
    }
};