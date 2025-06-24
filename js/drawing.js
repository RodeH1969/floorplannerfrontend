// js/drawing.js

// Function to draw grid lines on the canvas
function drawGrid(ctx, canvasWidth, canvasHeight, gridSize) {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasHeight); ctx.stroke();
    }
    for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasWidth, y); ctx.stroke();
    }
}

// Draw all stored objects (walls, doors, windows, polygons, vinyl strips) on the main canvas
// This function receives all necessary parameters from the EnhancedFloorPlanner instance in main.js.
function drawObjects(objects, polygons, selectedObject, currentTool, hoveredObject, gridSize, wallThickness, windowImage, slidingDoorImage, vinylLayouts, currentVinylView, showVinylLayoutOverlay, isDrawing, startPoint, endPoint) {
    const canvas = window.canvas;
    const ctx = window.ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw grid if enabled
    if (window.floorPlanner && window.floorPlanner.showGrid) {
        drawGrid(ctx, canvas.width, canvas.height, gridSize);
    }

    // Draw polygons first (so vinyl strips overlay them)
    polygons.forEach((polygon, index) => {
        const isSelected = selectedObject && selectedObject.id === polygon.id;
        const points = polygon.points;
        if (points.length < 3) return;

        const polyColorIndex = polygons.findIndex(p => p.id === polygon.id);
        ctx.fillStyle = isSelected ? 'rgba(231, 76, 60, 0.4)' : `hsla(${(polyColorIndex * 60) % 360}, 70%, 70%, 0.4)`;
        ctx.strokeStyle = isSelected ? '#e74c3c' : `hsl(${(polyColorIndex * 60) % 360}, 70%, 50%)`;
        ctx.lineWidth = isSelected ? 4 : 3;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = isSelected ? '#c0392b' : ctx.strokeStyle;
        points.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, isSelected ? 5:4, 0, 2 * Math.PI); ctx.fill(); });

        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        ctx.font = 'bold 13px Arial';
        const text = `P${polyColorIndex + 1}: ${polygon.area.toFixed(2)}m²`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(centerX - textWidth/2 - 4, centerY - 10, textWidth + 8, 20);
        ctx.fillStyle = isSelected ? '#c0392b' : '#2c3e50';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, centerX, centerY);
    });

    // Draw vinyl layout strips (main canvas overlay with dashed cut lines and labels)
    // Enhanced to ensure cut lines are drawn for both horizontal and vertical layouts
    if (showVinylLayoutOverlay && currentVinylView && vinylLayouts[currentVinylView]) {
        const layout = vinylLayouts[currentVinylView];
        layout.polygonLayouts.forEach(polyLayout => {
            polyLayout.strips.forEach(strip => {
                // Draw the semi-transparent bounding box for the strip/piece (visualizing the 2m strips)
                ctx.fillStyle = layout.direction === 'horizontal' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(255, 152, 0, 0.2)'; // Light blue/orange with transparency
                ctx.strokeStyle = layout.direction === 'horizontal' ? '#2196F3' : '#FF9800'; // Darker blue/orange border
                ctx.lineWidth = 1;

                ctx.fillRect(strip.x, strip.y, strip.width, strip.height);
                ctx.strokeRect(strip.x, strip.y, strip.width, strip.height);

                // Draw the actual cut lines (red dashed) for the clipped polygon shape
                if (strip.originalPolygonPoints && strip.originalPolygonPoints.length > 2) {
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 5]); // Set to dashed line: 5px dash, 5px gap

                    ctx.beginPath();
                    ctx.moveTo(strip.originalPolygonPoints[0].x, strip.originalPolygonPoints[0].y);
                    for (let i = 1; i < strip.originalPolygonPoints.length; i++) {
                        ctx.lineTo(strip.originalPolygonPoints[i].x, strip.originalPolygonPoints[i].y);
                    }
                    ctx.closePath(); // Close the path to draw the full perimeter of the clipped shape
                    ctx.stroke();    // Draw the dashed red cut lines
                    ctx.setLineDash([]); // Reset line dash to solid for subsequent drawings

                    // Label the section on the main canvas (e.g., P1_S1 and dimensions)
                    const pieceCentroid = window.getPolygonCentroid(strip.originalPolygonPoints);
                    const pieceWidthM = (strip.width / gridSize).toFixed(2);
                    const pieceLengthM = (strip.height / gridSize).toFixed(2);

                    const originalPolyIndex = polygons.findIndex(p => p.id === polyLayout.polygonId);
                    const pieceLabel = `P${originalPolyIndex + 1}_S${strip.sheetNumber}`;
                    const dimLabel = `${pieceWidthM}m x ${pieceLengthM}m`;

                    ctx.font = 'bold 10px Arial';
                    ctx.fillStyle = 'black';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    ctx.fillText(pieceLabel, pieceCentroid.x, pieceCentroid.y - 10);
                    ctx.fillText(dimLabel, pieceCentroid.x, pieceCentroid.y + 5);
                }
            });
        });
    }

    // Draw regular objects (walls, doors, windows, etc.)
    objects.forEach((obj) => {
        const isSelected = selectedObject && selectedObject.id === obj.id;
        const distM = window.calculateDistance({x: obj.startX, y: obj.startY}, {x: obj.endX, y: obj.endY}, gridSize);
        const angleDeg = window.calculateAngle({x: obj.startX, y: obj.startY}, {x: obj.endX, y: obj.endY});
        const thicknessPx = window.floorPlanner.wallThickness * gridSize;

        ctx.lineCap = 'round';
        if (obj.type === 'wall') {
            ctx.strokeStyle = isSelected ? '#e74c3c' : '#2c3e50';
            ctx.lineWidth = isSelected ? Math.max(thicknessPx, 4) : Math.max(thicknessPx, 3);
        } else if (obj.type === 'door') {
            ctx.strokeStyle = isSelected ? '#e74c3c' : '#f39c12';
            ctx.lineWidth = isSelected ? 4 : 3;
            const doorLength = window.calculateDistance({x: obj.startX, y: obj.startY}, {x: obj.endX, y: obj.endY}, 1);
            const doorAngle = window.calculateAngle({x: obj.startX, y: obj.startY}, {x: obj.endX, y: obj.endY}) * Math.PI / 180;
            ctx.beginPath();
            ctx.arc(obj.startX, obj.startY, doorLength, doorAngle, doorAngle + Math.PI / 2);
            ctx.stroke();
        } else if (obj.type === 'window') {
            ctx.strokeStyle = isSelected ? '#e74c3c' : '#3498db';
            ctx.lineWidth = isSelected ? 7 : 6;
            ctx.beginPath();
            ctx.moveTo(obj.startX, obj.startY);
            ctx.lineTo(obj.endX, obj.endY);
            ctx.stroke();
        } else if (obj.type === 'voidEdge') {
            ctx.strokeStyle = isSelected ? '#e74c3c' : 'rgba(255, 0, 0, 0.7)';
            ctx.lineWidth = isSelected ? 4 : 3;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(obj.startX, obj.startY); ctx.lineTo(obj.endX, obj.endY); ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.beginPath(); ctx.moveTo(obj.startX, obj.startY); ctx.lineTo(obj.endX, obj.endY); ctx.stroke();

        const midX = (obj.startX + obj.endX) / 2;
        const midY = (obj.startY + obj.endY) / 2;
        ctx.font = '11px Arial';
        const text = `${distM.toFixed(2)}m, ${angleDeg.toFixed(1)}°`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(midX - textWidth/2 - 2, midY - 9, textWidth + 4, 18);
        ctx.fillStyle = isSelected ? '#c0392b' : (obj.type === 'wall' ? '#555' : ctx.strokeStyle);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, midX, midY);

        if (obj.type === 'wall' && obj.coving && obj.covingAmount > 0) {
            const covingAmountPx = obj.covingAmount * gridSize;
            const dx = obj.endX - obj.startX;
            const dy = obj.endY - obj.startY;
            const length = Math.sqrt(dx*dx + dy*dy);

            if (length > 0) {
                const normalX = -dy / length;
                const normalY = dx / length;

                let covingDirX = normalX * covingAmountPx;
                let covingDirY = normalY * covingAmountPx;

                if (polygons.length > 0) {
                    const polyCenter = window.getPolygonCentroid(polygons[0].points);
                    const wallMidX = (obj.startX + obj.endX) / 2;
                    const wallMidY = (obj.startY + obj.endY) / 2;
                    const testPointX = wallMidX + covingDirX;
                    const testPointY = wallMidY + covingDirY;

                    if (window.isPointInPolygon(testPointX, testPointY, polygons[0].points)) {
                        covingDirX = -covingDirX;
                        covingDirY = -covingDirY;
                    }
                }

                const covingStartX = obj.startX + covingDirX;
                const covingStartY = obj.startY + covingDirY;
                const covingEndX = obj.endX + covingDirX;
                const covingEndY = obj.endY + covingDirY;

                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = isSelected ? '#4CAF50' : '#28a745';
                ctx.moveTo(covingStartX, covingStartY);
                ctx.lineTo(covingEndX, covingEndY);
                ctx.stroke();

                ctx.beginPath();
                ctx.strokeStyle = ctx.fillStyle = isSelected ? '#4CAF50' : '#28a745';
                ctx.lineWidth = 0.5;
                ctx.moveTo(obj.startX, obj.startY);
                ctx.lineTo(covingStartX, covingStartY);
                ctx.moveTo(obj.endX, obj.endY);
                ctx.lineTo(covingEndX, covingEndY);
                ctx.stroke();
            }
        }
    });

    if (isDrawing && startPoint && endPoint) {
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(startPoint.x, startPoint.y); ctx.lineTo(endPoint.x, endPoint.y); ctx.stroke();
        ctx.setLineDash([]);

        const distM = window.calculateDistance({x: startPoint.x, y: startPoint.y}, {x: endPoint.x, y: endPoint.y}, gridSize);
        const angleDeg = window.calculateAngle({x: startPoint.x, y: startPoint.y}, {x: endPoint.x, y: endPoint.y});
        const midX = (startPoint.x + endPoint.x) / 2; const midY = (startPoint.y + endPoint.y) / 2;

        ctx.font = 'bold 12px Arial';
        const text = `${distM.toFixed(2)}m, ${angleDeg.toFixed(1)}°`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(midX - textWidth/2 - 5, midY - 11, textWidth + 10, 22);
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, midX, midY);
    }
}
