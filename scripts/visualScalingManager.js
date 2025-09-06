const VisualScalingManager = {
    scaleFactor: 1, // multiplier for T key

    init: function(stage, polygonLayer) {
        this.stage = stage;
        this.polygonLayer = polygonLayer;

        // Listen for zoom (wheel)
        stage.on('wheel', () => {
            this.updateAllVisuals();
        });

        // Initial sizing
        this.updateAllVisuals();
    },

    updateAllVisuals: function() {
        const stageScale = this.stage.scaleX();
        const totalScale = this.scaleFactor / stageScale; // invert stage scale

        // Update vertices (rects)
        this.polygonLayer.find('.vertex').forEach(vertex => {
            if (vertex instanceof Konva.Rect) {
                const r = CONFIG.VERTEX.RADIUS * totalScale;
                const responsiveR = CONFIG.VERTEX.RESPONSIVERADIUS * totalScale;

                vertex.width(r * 2);
                vertex.height(r * 2);
                vertex.offsetX(r);
                vertex.offsetY(r);

                vertex.hitFunc(function(context) {
                    const radius = r + responsiveR;
                    context.beginPath();
                    context.rect(-radius, -radius, radius * 2, radius * 2);
                    context.closePath();
                    context.fillStrokeShape(this);
                });
            }
        });

        // Update midpoints (circles)
        this.polygonLayer.find('.midpoint').forEach(midpoint => {
            if (midpoint instanceof Konva.Circle) {
                midpoint.radius(CONFIG.MIDPOINT.RADIUS * totalScale);

                const responsiveR = CONFIG.MIDPOINT.RESPONSIVE_RADIUS * totalScale;
                midpoint.hitFunc(function(context) {
                    const radius = (CONFIG.MIDPOINT.RADIUS * totalScale) + responsiveR;
                    context.beginPath();
                    context.arc(0, 0, radius, 0, Math.PI * 2);
                    context.closePath();
                    context.fillStrokeShape(this);
                });
            }
        });

        // Update reference points
        this.polygonLayer.find('.reference').forEach(ref => {
            if (ref instanceof Konva.Circle) {
                ref.radius(CONFIG.MIDPOINT.REFERENCE.RADIUS * totalScale);
            }
        });

        // Update polygon edges
        this.polygonLayer.find('.polygon').forEach(edge => {
            if (edge instanceof Konva.Line) {
                edge.strokeWidth(CONFIG.POLYGON.STROKE_WIDTH * totalScale);
            }
        });

        // Update grid lines
        this.polygonLayer.find('.grid').forEach(line => {
            if (line instanceof Konva.Line) {
                line.strokeWidth(CONFIG.GRID.STROKE_WIDTH * totalScale);
            }
        });

        this.polygonLayer.batchDraw();
    }
};
