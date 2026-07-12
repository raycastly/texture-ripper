const useKonvaSnapping = (params) => {

    const defaultParams = {
        snapRange:params.snapRange??3,
        guidelineColor: params.guidelineColor ??"rgb(0, 161, 255)",
        guidelineDash: params.guidelineDash ?? true ,
        showGuidelines:params.showGuidelines??true,
        guidelineThickness:params.guidelineThickness??1,
        snapToStageCenter:params.snapToStageCenter??true,
        snapToStageBorders:params.snapToStageBorders??true,
        snapToShapes:params.snapToShapes??true
    }
    const oppositeAnchors = {
        "top-left": "bottom-right",
        "top-right": "bottom-left",
        "bottom-right": "top-left",
        "bottom-left": "top-right",
      };

    const getSnappingPoints = (e) => {
        const{snapToStageCenter,snapToStageBorders,snapToShapes} = defaultParams
        const stage = e.currentTarget.getStage();
        const vertical = [];
        const horizontal = [];
        if(snapToStageCenter){
            vertical.push(stage.attrs.width / 2)
            horizontal.push(stage.attrs.height / 2)
        }
        if(snapToStageBorders){
            horizontal.push(0,stage.attrs.height)
            vertical.push(0,stage.attrs.width)
        }
        if(snapToShapes){
            stage.children.forEach((layer) => {
                layer.children.forEach((obj) => {
                    const box = obj.getClientRect();
    
                    if (obj.getType() === "Shape" && e.target !== obj && obj.getName()!=="guid-line" && !(obj instanceof Konva.Transformer)) {
                        vertical.push(box.x, box.x + box.width, box.x + box.width / 2);
                        horizontal.push(box.y, box.y + box.height, box.y + box.height / 2);
                    }
                });
            });
        }

        return { vertical, horizontal };
    };

    const createLine = (Layer, isHorizontal, lineX, lineY) => {
        const{guidelineColor,
            showGuidelines,
            guidelineThickness,
            guidelineDash
            }=defaultParams
        if(!showGuidelines) return
        const points = isHorizontal ? [-6000, 0, 6000, 0] : [0, -6000, 0, 6000];
        const line = new Konva.Line({
            points,
            stroke: guidelineColor,
            strokeWidth: guidelineThickness,
            name: "guid-line",
            dash: guidelineDash?[4, 6]: [0, 0],
        });
        Layer.add(line);
        line.absolutePosition({ x: lineX, y: lineY });
    };
    function dotProduct(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y;
      }
      
      function vectorProject(a, b) {
        const dotAB = dotProduct(a, b);
        const dotBB = dotProduct(b, b);
        const scalar = dotAB / dotBB;
        return {
          x: scalar * b.x,
          y: scalar * b.y,
        };
      }
    
      function calculateSlope(point1, point2) {
        const deltaX = point2.x - point1.x;
      
        // Check for a vertical line to avoid division by zero
        if (deltaX === 0) {
          
          throw new Error(`Slope is undefined for vertical lines (deltaX is zero). ${point2.x}, ${point1.x}`);
        }
      
        const deltaY = point2.y - point1.y;
        return deltaY / deltaX;
      }

    const handleDragging = (e) => {
        const Layer = e.target.parent;
        //console.log(e.target)

        // Clear existing guidelines
        Layer.find(".guid-line").forEach((line) => line.destroy());
        const { horizontal, vertical } = getSnappingPoints(e);
        let newPos = { x: e.target.absolutePosition().x, y: e.target.absolutePosition().y };
        let guideLinesX = []
        let guideLinesY = []
        const {snapRange} = defaultParams
        // Snap vertically
        vertical.forEach((breakPoint) => {
            if (Math.abs(e.target.getClientRect().x - breakPoint) <= snapRange) {
                newPos.x = breakPoint + e.target.absolutePosition().x - e.target.getClientRect().x;
                guideLinesX.push(breakPoint)
            }
            if (Math.abs(e.target.getClientRect().x - breakPoint + e.target.getClientRect().width / 2) <= snapRange) {
                newPos.x = breakPoint + e.target.absolutePosition().x - e.target.getClientRect().x - e.target.getClientRect().width / 2;
                guideLinesX.push(breakPoint)

            }
            if (Math.abs(e.target.getClientRect().x - breakPoint + e.target.getClientRect().width) <= snapRange) {
                newPos.x = breakPoint + e.target.absolutePosition().x - e.target.getClientRect().x - e.target.getClientRect().width;
                guideLinesX.push(breakPoint)
            }
        });
        e.target.absolutePosition(newPos)
        guideLinesX.forEach(line=>{
            if (Math.round(e.target.getClientRect().x - line) ===0 ||
            Math.round(e.target.getClientRect().x - line + e.target.getClientRect().width / 2)===0 ||
            Math.round(e.target.getClientRect().x - line + e.target.getClientRect().width) ===0)
            {
              createLine(Layer, false, line, 0);    
            }
        })
        // Snap horizontally
        horizontal.forEach((breakPoint) => {
            if (Math.abs(e.target.getClientRect().y - breakPoint) <= snapRange) {
                newPos.y = breakPoint + e.target.absolutePosition().y - e.target.getClientRect().y;
                guideLinesY.push(breakPoint)
            }
            if (Math.abs(e.target.getClientRect().y - breakPoint + e.target.getClientRect().height) <= snapRange) {
                newPos.y = breakPoint + e.target.absolutePosition().y - e.target.getClientRect().y - e.target.getClientRect().height;
                guideLinesY.push(breakPoint)
            }
            if (Math.abs(e.target.getClientRect().y - breakPoint + e.target.getClientRect().height / 2) <= snapRange) {
                newPos.y = breakPoint + e.target.absolutePosition().y - e.target.getClientRect().y - e.target.getClientRect().height / 2;
                guideLinesY.push(breakPoint)
            }
        });
        e.target.absolutePosition(newPos);
        guideLinesY.forEach(line=>{
            if (Math.round(e.target.getClientRect().y - line) ===0 ||
            Math.round(e.target.getClientRect().y - line + e.target.getClientRect().height)===0 ||
            Math.round(e.target.getClientRect().y - line + e.target.getClientRect().height / 2) ===0)
            {
                createLine(Layer, true, 0, line);    
            }
        })
    };

    const handleResizing = (e) => {
        const Layer = e.target.parent;
        const { snapRange } = defaultParams;

        let { horizontal, vertical } = getSnappingPoints(e);
        const keepRatio = !e.evt.shiftKey ? e.currentTarget.keepRatio() : ! e.currentTarget.keepRatio();
        if(!keepRatio || (keepRatio && !!!oppositeAnchors[e.currentTarget._movingAnchorName])){
            e.currentTarget.anchorDragBoundFunc((oldAbsPos, newAbsPos, event) => {
       
                Layer.find(".guid-line").forEach((line) => line.destroy());
                        let bounds = { x: newAbsPos.x, y: newAbsPos.y };
                        //console.log(Konva.Util.haveIntersection(e.target.getClientRect(),breakPoint))
                        if (e.currentTarget.getActiveAnchor() === 'rotater') return bounds
                        for (let breakPoint of vertical) {
                            if (Math.abs(newAbsPos.x - breakPoint) <= snapRange &&
                            Math.abs(oldAbsPos.x - breakPoint) <= snapRange + 1
                            ) {
                                bounds.x = breakPoint;
                                createLine(Layer, false, breakPoint, 0);
                                break;
                            }
                        }
                        for (let breakPoint of horizontal) {
                            if (Math.abs(newAbsPos.y - breakPoint) <= snapRange && 
                            Math.abs(oldAbsPos.y - breakPoint) <= snapRange + 1
                            ) {
                                bounds.y = breakPoint;
                                createLine(Layer, true, 0,breakPoint);
                                break;
                            }
                        }

                        return bounds;
            })
        }else{
            e.currentTarget.anchorDragBoundFunc((oldAbsPos, newPos, event) => {
               Layer.find(".guid-line").forEach((line) => line.destroy());      
                const currentAnchorName = e.currentTarget._movingAnchorName;
                const oppositeAnchorName = oppositeAnchors[currentAnchorName];
            
                const movingAnchor = e.currentTarget.findOne(`.${currentAnchorName}`);
                // Capture the anchor's starting absolute position:
                const anchorStartPosition = movingAnchor.getAbsolutePosition();
            
                // Do nothing for the rotater anchor.
                if (currentAnchorName === "rotater") {
                  return newPos;
                }
                
                const oppositeElement = e.currentTarget.findOne(`.${oppositeAnchorName}`);
                if (!oppositeElement) return newPos;
                const oppositePoint = oppositeElement.getAbsolutePosition();
                
                const slope = calculateSlope(anchorStartPosition, oppositePoint);
          
            
                // Calculate the vector from the starting anchor position to the opposite anchor.
                const transformVector = {
                  x: anchorStartPosition.x - oppositePoint.x,
                  y: anchorStartPosition.y - oppositePoint.y,
                };
            
                // Compute the movement delta from the starting position.
                const delta = {
                  x: newPos.x - anchorStartPosition.x,
                  y: newPos.y - anchorStartPosition.y,
                };
            
                // Project the delta onto the transform vector.
                const projectedDelta = vectorProject(delta, transformVector);
            
                // Compute the candidate new position (before snapping).
                const nextPos = {
                  x: anchorStartPosition.x + projectedDelta.x,
                  y: anchorStartPosition.y + projectedDelta.y,
                };
          
                for (let breakPoint of horizontal) {
                  if (Math.abs(nextPos.y - breakPoint) <= snapRange) {
                    nextPos.y = breakPoint;
                    nextPos.x = anchorStartPosition.x + (breakPoint - anchorStartPosition.y) / slope;
                    createLine(Layer, true, 0,breakPoint);
                    break;
                  }
              }
              for (let breakPoint of vertical) {
                  if (Math.abs(nextPos.x - breakPoint) <= snapRange) {
                    nextPos.x = breakPoint;
                    nextPos.y= anchorStartPosition.y + slope * (breakPoint - anchorStartPosition.x)
                      createLine(Layer, false,breakPoint, 0);
                      break;
                  }
              }
              
              return nextPos;
              });
        }
       
    };   
    
    const handleResizeEnd = (e) =>{
        const Layer = e.target.parent;
        e.currentTarget.anchorDragBoundFunc((oldAbsPos, newPos, event) => {
            return newPos
        })
        //console.log(e.currentTarget.anchorDragBoundFunc())
        Layer.find(".guid-line").forEach((line) => line.destroy());
    }
    const handleDragEnd = (e) =>{
        const Layer = e.target.parent;
        Layer.find(".guid-line").forEach((line) => line.destroy());
    }

    return { handleDragging,handleResizing,handleResizeEnd,handleDragEnd };
};