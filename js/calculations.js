// js/calculations.js

/**
 * Calculates and updates total floor area, perimeter, wall count, polygon count, and total coving length.
 * Relies on `window.floorPlanner` instance for data.
 */
function calculateFloorMeasurements_global() {
    if (!window.floorPlanner) {
        console.warn('floorPlanner instance not available for calculateFloorMeasurements_global.');
        return;
    }
    const floorPlanner = window.floorPlanner;

    // Calculate total area and perimeter from detected polygons
    let totalAreaM2 = floorPlanner.polygons.reduce((sum, p) => sum + p.area, 0);
    let totalPerimeterM = floorPlanner.polygons.reduce((sum, p) => sum + window.calculatePolygonPerimeter(p.points, floorPlanner.gridSize), 0);

    // Update UI elements
    document.getElementById('totalArea').textContent = `${totalAreaM2.toFixed(2)} m²`;
    document.getElementById('perimeter').textContent = `${totalPerimeterM.toFixed(2)} m`;
    document.getElementById('wallCount').textContent = floorPlanner.objects.filter(o => o.type === 'wall').length;
    document.getElementById('polygonCount').textContent = floorPlanner.polygons.length;

    // Handle legacy void elements if they exist (not part of current polygon logic)
    if (document.getElementById('voidAreas')) { // This element might not exist in your HTML
        document.getElementById('voidAreas').textContent = '0';
        document.getElementById('totalVoidArea').textContent = '0 m²';
    }

    // Calculate total coving length from wall objects
    if (document.getElementById('totalCovingLength')) { // This element might not exist in your HTML
        let totalCovingLen = 0;
        floorPlanner.objects.filter(obj => obj.type === 'wall' && obj.coving && obj.covingAmount > 0).forEach(wall => {
            totalCovingLen += window.calculateDistance({x: wall.startX, y: wall.startY}, {x: wall.endX, y: wall.endY}, floorPlanner.gridSize);
        });
        document.getElementById('totalCovingLength').textContent = `${totalCovingLen.toFixed(2)} m`;
    }
}
window.calculateFloorMeasurements = calculateFloorMeasurements_global; // Expose globally

/**
 * Calculates vinyl material needed based on detected polygons and a specified cut direction.
 * @param {Array<Object>} polygons - Array of polygon objects.
 * @param {Array<Object>} objects - Array of all drawn objects (used to find voidEdges).
 * @param {number} vinylWidth - Width of the vinyl roll in meters.
 * @param {string} direction - 'horizontal' or 'vertical' for cutting strips.
 * @param {number} gridSize - Pixels per meter scale.
 * @returns {Object} Vinyl layout data including total material, waste, and efficiency.
 */
function calculateVinyl_global(polygons, objects, vinylWidth, direction, gridSize) {
    const layouts = [];
    polygons.forEach((polygon, index) => {
        const bounds = window.getPolygonBounds(polygon.points); // Get bounding box of the polygon
        // Calculate individual strips (pieces) for this polygon
        const strips = calculateStripsForPolygon(polygon.points, bounds, vinylWidth, direction, gridSize, objects);
        layouts.push({
            polygonIndex: index,
            polygonId: polygon.id,
            strips: strips, // Array of individual vinyl pieces (strips)
            totalMaterialArea: strips.reduce((sum, strip) => sum + strip.area, 0), // Sum of areas of all pieces
        });
    });

    // Calculate overall totals
    const totalFloorArea = polygons.reduce((sum, p) => sum + p.area, 0); // Sum of all polygon areas
    const totalMaterial = layouts.reduce((sum, layout) => sum + layout.totalMaterialArea, 0); // Sum of material used across all pieces

    return {
        direction: direction,
        polygonLayouts: layouts, // Layouts for each polygon
        totalMaterialArea: totalMaterial,
        totalFloorArea: totalFloorArea,
        waste: totalMaterial - totalFloorArea,
        efficiency: totalMaterial > 0 ? (totalFloorArea / totalMaterial) * 100 : 0
    };
}
window.calculateVinyl = calculateVinyl_global; // Expose globally

/**
 * Calculates individual vinyl strips (pieces) for a single polygon based on a specified cut direction.
 * It uses polygon clipping to accurately determine the shape of each piece.
 * @param {Array<Object>} polygonPoints - Vertices of the main polygon (in pixel coordinates).
 * @param {Object} polygonBounds - Bounding box of the main polygon.
 * @param {number} vinylWidthM - Width of the vinyl roll in meters.
 * @param {string} direction - 'horizontal' or 'vertical' for cutting strips.
 * @param {number} gridSize - Pixels per meter scale.
 * @param {Array<Object>} allObjects - All drawn objects to identify void edges.
 * @returns {Array<Object>} An array of strip objects, each representing a cut piece of vinyl.
 */
function calculateStripsForPolygon(polygonPoints, polygonBounds, vinylWidthM, direction, gridSize, allObjects) {
    const strips = [];
    const vinylWidthPx = vinylWidthM * gridSize; // Convert vinyl width from meters to pixels

    // Identify and process void polygons (from voidEdge objects)
    const voidEdges = allObjects.filter(obj => obj.type === 'voidEdge');
    let voidPolygons = [];
    if (voidEdges.length > 0) {
        const groupedVoids = window.groupVoidEdges(voidEdges); // Group edges into polygons
        groupedVoids.forEach(voidShape => {
            // Apply coving (shrinkage) to void polygons
            voidPolygons.push(window.processVoidCoving(voidShape, voidEdges, gridSize));
        });
    }

    let stripCounter = 1; // Counter for unique sheet numbers (S1, S2, etc.)

    if (direction === 'horizontal') {
        // Iterate through the polygon's height to create horizontal strips
        for (let y = polygonBounds.minY; y < polygonBounds.maxY; y += vinylWidthPx) {
            // Define the rectangular band for the current horizontal strip
            const stripRect = {
                x: polygonBounds.minX,
                y: y,
                width: polygonBounds.maxX - polygonBounds.minX, // Full width of the polygon's bounding box
                height: Math.min(vinylWidthPx, polygonBounds.maxY - y) // Height limited by vinyl width or remaining polygon height
            };

            // Clip the main polygon to this strip's rectangle AND subtract any void polygons.
            // This returns an array of actual polygon segments (can be multiple if voids create holes).
            const clippedPolygonSegments = window.clipPolygonToRectAndSubtractVoids(
                polygonPoints,      // The main polygon to clip
                stripRect,          // The rectangular strip band
                voidPolygons        // Voids to subtract
            );

            // Process each resulting clipped segment
            clippedPolygonSegments.forEach(segmentPoly => {
                if (segmentPoly.length >= 3) { // Ensure it's a valid polygon (at least a triangle)
                    const segmentBounds = window.getPolygonBounds(segmentPoly); // Get bounding box of the clipped segment
                    const areaM2 = (segmentBounds.width / gridSize) * (segmentBounds.height / gridSize); // Area in m²

                    if (areaM2 > 0.001) { // Only add if the piece has a meaningful area
                        strips.push({
                            x: segmentBounds.minX,        // Top-left X in pixels of the piece's bounding box
                            y: segmentBounds.minY,        // Top-left Y in pixels of the piece's bounding box
                            width: segmentBounds.width,   // Bounding box width in pixels
                            height: segmentBounds.height, // Bounding box height in pixels
                            area: areaM2,                 // Area in m²
                            direction: 'horizontal',
                            originalPolygonPoints: segmentPoly, // Store the actual clipped polygon points for detailed drawing
                            sheetNumber: stripCounter++   // Assign a unique sheet number for this piece
                        });
                    }
                }
            });
        }
    } else { // Vertical strips
        // Iterate through the polygon's width to create vertical strips
        for (let x = polygonBounds.minX; x < polygonBounds.maxX; x += vinylWidthPx) {
            // Define the rectangular band for the current vertical strip
            const stripRect = {
                x: x,
                y: polygonBounds.minY,
                width: Math.min(vinylWidthPx, polygonBounds.maxX - x), // Width limited by vinyl width or remaining polygon width
                height: polygonBounds.maxY - polygonBounds.minY // Full height of the polygon's bounding box
            };

            const clippedPolygonSegments = window.clipPolygonToRectAndSubtractVoids(
                polygonPoints,
                stripRect,
                voidPolygons
            );

            clippedPolygonSegments.forEach(segmentPoly => {
                if (segmentPoly.length >= 3) {
                    const segmentBounds = window.getPolygonBounds(segmentPoly);
                    const areaM2 = (segmentBounds.width / gridSize) * (segmentBounds.height / gridSize);

                    if (areaM2 > 0.001) {
                        strips.push({
                            x: segmentBounds.minX,
                            y: segmentBounds.minY,
                            width: segmentBounds.width,
                            height: segmentBounds.height,
                            area: areaM2,
                            direction: 'vertical',
                            originalPolygonPoints: segmentPoly,
                            sheetNumber: stripCounter++
                        });
                    }
                }
            });
        }
    }
    return strips;
}
window.calculateStripsForPolygon = calculateStripsForPolygon; // Expose globally

/**
 * Calculates the intersection point of two line segments.
 * @param {Object} p1 - Start point of line 1 {x, y}.
 * @param {Object} p2 - End point of line 1 {x, y}.
 * @param {Object} p3 - Start point of line 2 {x, y}.
 * @param {Object} p4 - End point of line 2 {x, y}.
 * @returns {Object|null} The intersection point {x, y} or null if no intersection.
 */
window.lineIntersection = window.lineIntersection || function(p1, p2, p3, p4) {
    const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (den === 0) return null; // Lines are parallel or collinear

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den;

    // Check if intersection point lies within both segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
    }
    return null; // No intersection within segments
};

/**
 * Clips a polygon (list of points) to a rectangle using Sutherland-Hodgman algorithm.
 * @param {Array<Object>} polygonPoints - Vertices of the polygon to clip.
 * @param {Object} rect - Clipping rectangle {x, y, width, height}.
 * @returns {Array<Array<Object>>} An array of resulting polygons (can be multiple if clipping splits).
 */
window.clipPolygonToRect = window.clipPolygonToRect || function(polygonPoints, rect) {
    if (polygonPoints.length < 3) return []; // Not a valid polygon

    let clipped = [...polygonPoints]; // Start with the input polygon
    // Define the 4 clipping edges of the rectangle (clockwise order)
    const clipEdges = [
        { start: {x: rect.x, y: rect.y}, end: {x: rect.x + rect.width, y: rect.y} },              // Top
        { start: {x: rect.x + rect.width, y: rect.y}, end: {x: rect.x + rect.width, y: rect.y + rect.height} }, // Right
        { start: {x: rect.x + rect.width, y: rect.y + rect.height}, end: {x: rect.x, y: rect.y + rect.height} }, // Bottom
        { start: {x: rect.x, y: rect.y + rect.height}, end: {x: rect.x, y: rect.y} }               // Left
    ];

    // Clip the polygon against each edge of the rectangle
    for (let i = 0; i < clipEdges.length; i++) {
        const edgeStart = clipEdges[i].start;
        const edgeEnd = clipEdges[i].end;
        const newClipped = []; // Stores the result of clipping against current edge

        if (clipped.length === 0) break; // Nothing left to clip

        for (let j = 0; j < clipped.length; j++) {
            const p1 = clipped[j];
            const p2 = clipped[(j + 1) % clipped.length];

            // Determines if a point is "inside" the current clipping edge (to the right of the directed edge)
            const isInside = (p) => {
                return (edgeEnd.x - edgeStart.x) * (p.y - edgeStart.y) -
                       (edgeEnd.y - edgeStart.y) * (p.x - edgeStart.x) <= 0.001; // Add tolerance for float precision
            };

            if (isInside(p1) && isInside(p2)) { // Both endpoints inside: add p2
                newClipped.push(p2);
            } else if (isInside(p1) && !isInside(p2)) { // p1 inside, p2 outside: add intersection point
                const intersection = window.lineIntersection(p1, p2, edgeStart, edgeEnd);
                if (intersection) newClipped.push(intersection);
            } else if (!isInside(p1) && isInside(p2)) { // p1 outside, p2 inside: add intersection point and p2
                const intersection = window.lineIntersection(p1, p2, edgeStart, edgeEnd);
                if (intersection) newClipped.push(intersection);
                newClipped.push(p2);
            }
            // If both outside: add nothing
        }
        clipped = newClipped; // Update clipped polygon for next edge
    }

    if (clipped.length >= 3) {
        return [clipped]; // Return array containing the single resulting polygon
    } else {
        return []; // No valid polygon remained after clipping
    }
};

/**
 * Clips a polygon to a rectangle and then attempts to subtract void polygons from the result.
 * NOTE: This is a simplified boolean operation. For complex voids (e.g., holes), a dedicated
 * polygon boolean library (like Clipper-lib or poly-boolean) is required. This implementation
 * will filter out segments whose centroid is inside a void.
 * @param {Array<Object>} polygonPoints - Vertices of the main polygon.
 * @param {Object} rect - Clipping rectangle {x, y, width, height}.
 * @param {Array<Array<Object>>} voidPolygons - Array of void polygon vertex arrays.
 * @returns {Array<Array<Object>>} An array of resulting polygon segments after clipping and void subtraction.
 */
window.clipPolygonToRectAndSubtractVoids = window.clipPolygonToRectAndSubtractVoids || function(polygonPoints, rect, voidPolygons) {
    let resultPolygons = window.clipPolygonToRect(polygonPoints, rect); // Clip to rectangle first

    // If no voids, return the rectangle-clipped polygon directly
    if (voidPolygons.length === 0) return resultPolygons;

    let finalClipped = [];
    resultPolygons.forEach(clippedPoly => {
        let isVoided = false;
        // Get the centroid of the current clipped polygon segment
        const clippedPolyCentroid = window.getPolygonCentroid(clippedPoly);

        // Check if the centroid of the clipped piece falls within any void polygon
        for (const voidPoly of voidPolygons) {
            if (window.pointInPolygon(clippedPolyCentroid.x, clippedPolyCentroid.y, voidPoly)) { // Use global pointInPolygon
                isVoided = true; // Mark as voided if centroid is inside
                break;
            }
        }
        // If the segment's centroid is not inside any void, keep it
        if (!isVoided) {
            finalClipped.push(clippedPoly);
        }
        // else: If centroid is inside a void, this segment is "removed" (not added to finalClipped)
    });
    return finalClipped;
};

/**
 * Checks if two rectangles overlap.
 * @param {Object} rect1 - First rectangle {minX, minY, maxX, maxY}.
 * @param {Object} rect2 - Second rectangle {minX, minY, maxX, maxY}.
 * @returns {boolean} True if they overlap, false otherwise.
 */
window.doRectanglesOverlap = window.doRectanglesOverlap || function(rect1, rect2) {
    return rect1.minX < rect2.maxX && rect1.maxX > rect2.minX &&
           rect1.minY < rect2.maxY && rect1.maxY > rect2.minY;
};

/**
 * Calculates the centroid (average point) of a polygon.
 * @param {Array<Object>} points - Vertices of the polygon.
 * @returns {Object} The centroid {x, y}.
 */
window.getPolygonCentroid = window.getPolygonCentroid || function(points) {
    if (!points || points.length === 0) return {x: 0, y: 0};
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return {x: centerX, y: centerY};
};

/**
 * Creates a complete floor boundary, identifying outer polygons and void polygons.
 * NOTE: This function's integration might be simplified by direct use of `floorPlanner.polygons` and `floorPlanner.objects`
 * where voids are handled via `voidEdge` objects. This is largely a placeholder now.
 * @returns {Object} An object containing `outerPolygon` (main shape) and `voidPolygons` (holes).
 */
window.createCompleteFloorBoundary = window.createCompleteFloorBoundary || function() {
    return {
        outerPolygon: [],
        voidPolygons: []
    };
};

/**
 * Creates a closed polygon from a list of wall objects.
 * @param {Array<Object>} walls - Array of wall objects.
 * @param {boolean} includeCoving - Whether to expand the polygon for coving.
 * @returns {Array<Object>} Ordered vertices of the created polygon.
 */
window.createPolygonFromWalls = window.createPolygonFromWalls || function(walls, includeCoving = false) {
    if (walls.length === 0) return [];
    const polygon = window.orderWallsIntoPolygon(walls); // Order walls into a sequence
    if (includeCoving && polygon.length > 0) {
        // Expand polygon for coving effect (requires gridSize from floorPlanner)
        if (!window.floorPlanner) return polygon;
        return window.expandPolygonForCoving(polygon, walls, window.floorPlanner.gridSize);
    }
    return polygon;
};

/**
 * Expands a polygon outward to account for coving.
 * This is an approximation and might not be perfect for complex concave shapes.
 * @param {Array<Object>} polygon - Vertices of the polygon to expand.
 * @param {Array<Object>} walls - Original wall objects (to find coving amounts).
 * @param {number} gridSize - Pixels per meter scale.
 * @returns {Array<Object>} Vertices of the expanded polygon.
 */
window.expandPolygonForCoving = window.expandPolygonForCoving || function(polygon, walls, gridSize) {
    if (polygon.length < 3) return polygon;

    const expandedPoints = [];
    const minCovingAmount = 0.001; // Minimum coving amount to consider (meters)

    // Create a map to quickly find wall objects by their segment (for coving info)
    const wallSegmentMap = new Map();
    walls.forEach(wall => {
        const p1 = {x: wall.startX, y: wall.startY};
        const p2 = {x: wall.endX, y: wall.endY};
        // Use a canonical key for the segment to find it regardless of start/end order
        const key = `${Math.min(p1.x, p2.x)},${Math.min(p1.y, p2.y)}-${Math.max(p1.x, p2.x)},${Math.max(p1.y, p2.y)}`;
        wallSegmentMap.set(key, wall);
    });

    for (let i = 0; i < polygon.length; i++) {
        const currentPoint = polygon[i];
        const prevPoint = polygon[(i - 1 + polygon.length) % polygon.length];
        const nextPoint = polygon[(i + 1) % polygon.length];

        let wall1 = null; // Wall segment from prevPoint to currentPoint
        let wall2 = null; // Wall segment from currentPoint to nextPoint

        // Find corresponding wall objects using canonical keys
        const p1_seg1 = {x: prevPoint.x, y: prevPoint.y};
        const p2_seg1 = {x: currentPoint.x, y: currentPoint.y};
        const key1 = `${Math.min(p1_seg1.x, p2_seg1.x)},${Math.min(p1_seg1.y, p2_seg1.y)}-${Math.max(p1_seg1.x, p2_seg1.x)},${Math.max(p1_seg1.y, p2_seg1.y)}`;
        wall1 = wallSegmentMap.get(key1);

        const p1_seg2 = {x: currentPoint.x, y: currentPoint.y};
        const p2_seg2 = {x: nextPoint.x, y: nextPoint.y};
        const key2 = `${Math.min(p1_seg2.x, p2_seg2.x)},${Math.min(p1_seg2.y, p2_seg2.y)}-${Math.max(p1_seg2.x, p2_seg2.x)},${Math.max(p1_seg2.y, p2_seg2.y)}`;
        wall2 = wallSegmentMap.get(key2);

        // Determine the maximum coving amount at this corner (from adjacent walls)
        let covingAmountForCorner = 0;
        if (wall1 && wall1.coving && wall1.covingAmount > minCovingAmount) {
            covingAmountForCorner = Math.max(covingAmountForCorner, wall1.covingAmount);
        }
        if (wall2 && wall2.coving && wall2.covingAmount > minCovingAmount) {
            covingAmountForCorner = Math.max(covingAmountForCorner, wall2.covingAmount);
        }

        if (covingAmountForCorner > minCovingAmount) {
            // Calculate the expansion vector for the current point due to coving
            const expansion = window.calculateCovingExpansion(prevPoint, currentPoint, nextPoint, covingAmountForCorner, gridSize);
            expandedPoints.push({
                x: currentPoint.x + expansion.x,
                y: currentPoint.y + expansion.y
            });
        } else {
            expandedPoints.push(currentPoint); // No coving, keep original point
        }
    }
    return expandedPoints;
};

/**
 * Calculates an expansion vector for a point in a polygon due to coving.
 * This vector pushes the point outward along the angle bisector of the corner.
 * @param {Object} prevPoint - The previous point in the polygon.
 * @param {Object} currentPoint - The current point in the polygon.
 * @param {Object} nextPoint - The next point in the polygon.
 * @param {number} covingAmountM - The coving distance in meters.
 * @param {number} gridSize - Pixels per meter scale.
 * @returns {Object} The expansion vector {x, y} in pixels.
 */
window.calculateCovingExpansion = window.calculateCovingExpansion || function(prevPoint, currentPoint, nextPoint, covingAmountM, gridSize) {
    const covingPx = covingAmountM * gridSize; // Convert coving amount to pixels

    // Vectors for the two segments forming the corner
    const vec1 = { x: currentPoint.x - prevPoint.x, y: currentPoint.y - prevPoint.y };
    const vec2 = { x: nextPoint.x - currentPoint.x, y: nextPoint.y - currentPoint.y };

    // Lengths of the vectors
    const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
    const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

    let norm1 = { x: 0, y: 0 }; // Normal to segment 1 (pointing outwards assuming CCW polygon)
    let norm2 = { x: 0, y: 0 }; // Normal to segment 2

    if (len1 > 0) {
        norm1 = { x: -vec1.y / len1, y: vec1.x / len1 };
    }
    if (len2 > 0) {
        norm2 = { x: -vec2.y / len2, y: vec2.x / len2 };
    }

    // Average the two normals to find the angle bisector direction
    const avgN = { x: (norm1.x + norm2.x), y: (norm1.y + norm2.y) };
    const avgNLen = Math.sqrt(avgN.x * avgN.x + avgN.y * avgN.y);

    let scaledNormal = { x: 0, y: 0 };
    if (avgNLen > 0) {
        scaledNormal = { x: (avgN.x / avgNLen) * covingPx, y: (avgN.y / avgNLen) * covingPx };
    } else {
        // Handle degenerate cases (e.g., straight line, or zero-length segments)
        return { x: 0, y: 0 };
    }
    return scaledNormal;
};

/**
 * Orders a set of wall objects into a closed polygon sequence.
 * This is a fundamental step for polygon detection.
 * @param {Array<Object>} walls - Array of wall objects.
 * @returns {Array<Object>} An ordered array of points forming the polygon, or empty if not a closed loop.
 */
window.orderWallsIntoPolygon = window.orderWallsIntoPolygon || function(walls) {
    if (walls.length === 0) return [];

    const polygon = [];
    const used = new Set(); // Keep track of walls already used in the polygon
    const tolerance = 5; // Pixel tolerance for matching endpoints

    // Find a starting wall. Ideally, one with only one connection point (an open end),
    // but for closed polygons, any wall can be a start.
    let startWall = walls[0];
    let startIndex = 0;

    // Small optimization: try to find a wall that is truly connected, not isolated
    for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        let connectedPoints = 0;
        for (let j = 0; j < walls.length; j++) {
            if (i === j) continue;
            const otherWall = walls[j];
            // Check if any endpoint of 'wall' is close to any endpoint of 'otherWall'
            if ( (window.calculateDistance({x: wall.startX, y: wall.startY}, {x: otherWall.startX, y: otherWall.startY}, 1) * 100 < tolerance) ||
                 (window.calculateDistance({x: wall.startX, y: wall.startY}, {x: otherWall.endX, y: otherWall.endY}, 1) * 100 < tolerance) ||
                 (window.calculateDistance({x: wall.endX, y: wall.endY}, {x: otherWall.startX, y: otherWall.startY}, 1) * 100 < tolerance) ||
                 (window.calculateDistance({x: wall.endX, y: wall.endY}, {x: otherWall.endX, y: otherWall.endY}, 1) * 100 < tolerance) ) {
                connectedPoints++;
            }
        }
        if (connectedPoints < 2) { // If a wall connects to fewer than 2 other walls, start there.
            startWall = wall;
            startIndex = i;
            break;
        }
    }

    // Start tracing the polygon
    polygon.push({x: startWall.startX, y: startWall.startY}); // Add first point of starting wall
    let currentPoint = {x: startWall.endX, y: startWall.endY}; // Next point to find connection for
    polygon.push(currentPoint); // Add second point of starting wall
    used.add(startIndex); // Mark starting wall as used

    let safetyCounter = 0;
    const maxSafety = walls.length * 2; // Safety break to prevent infinite loops for malformed inputs

    // Continue finding connected walls until all walls are used or a loop is closed
    while (used.size < walls.length && safetyCounter < maxSafety) {
        safetyCounter++;
        let nextWallIndex = -1;
        let nextPoint = null;

        for (let i = 0; i < walls.length; i++) {
            if (used.has(i)) continue;

            const wall = walls[i];

            // Check if wall's start point connects to currentPoint
            if (Math.abs(wall.startX - currentPoint.x) < tolerance && Math.abs(wall.startY - currentPoint.y) < tolerance) {
                nextWallIndex = i;
                nextPoint = {x: wall.endX, y: wall.endY}; // The other end is the next point in polygon
                break;
            }
            // Check if wall's end point connects to currentPoint
            else if (Math.abs(wall.endX - currentPoint.x) < tolerance && Math.abs(wall.endY - currentPoint.y) < tolerance) {
                nextWallIndex = i;
                nextPoint = {x: wall.startX, y: wall.startY}; // The other end is the next point in polygon
                break;
            }
        }

        if (nextWallIndex === -1) {
            // If no connecting wall found, check if the path closes back to its start
            if (Math.abs(currentPoint.x - polygon[0].x) < tolerance && Math.abs(currentPoint.y - polygon[0].y) < tolerance) {
                break; // Loop closed
            }
            console.warn("Could not find a connecting wall, polygon might be open or fragmented.");
            return []; // Not a closed polygon, return empty
        }

        polygon.push(nextPoint); // Add the next point to the polygon
        used.add(nextWallIndex); // Mark the found wall as used
        currentPoint = nextPoint; // Update currentPoint for next iteration

        // Check if we've returned to the starting point, closing the polygon
        if (Math.abs(currentPoint.x - polygon[0].x) < tolerance && Math.abs(currentPoint.y - polygon[0].y) < tolerance) {
            polygon.pop(); // Remove the duplicate closing point
            break; // Loop closed
        }
    }

    if (polygon.length < 3) return []; // Must have at least 3 points for a valid polygon

    return polygon;
};

/**
 * Groups individual 'voidEdge' objects into complete void polygons.
 * @param {Array<Object>} voidEdges - Array of objects with type 'voidEdge'.
 * @returns {Array<Array<Object>>} An array of arrays, where each inner array is an ordered list of points for a void polygon.
 */
window.groupVoidEdges = window.groupVoidEdges || function(voidEdges) {
    const shapes = [];
    const used = new Set(); // Tracks indices of voidEdges already grouped into a shape
    const tolerance = 5; // Pixel tolerance for connecting endpoints

    voidEdges.forEach((edge, index) => {
        if (used.has(index)) return; // Skip if this edge has already been used

        let currentPathEdges = [edge]; // List of edges in the current path
        let currentPathEdgeIndices = [index]; // Indices of edges in the current path
        used.add(index); // Mark initial edge as used

        let startPointOfPath = {x: edge.startX, y: edge.startY};
        let endPointOfPath = {x: edge.endX, y: edge.endY};

        let safetyCounter = 0;
        const maxSafety = voidEdges.length * 2; // Prevent infinite loops

        // Attempt to trace a connected path of void edges
        while (safetyCounter < maxSafety) {
            safetyCounter++;
            let foundNext = false;
            for (let i = 0; i < voidEdges.length; i++) {
                if (used.has(i)) continue; // Skip already used edges

                const nextCandidateEdge = voidEdges[i];

                // Check if nextCandidateEdge's start connects to endPointOfPath
                if ( (Math.abs(nextCandidateEdge.startX - endPointOfPath.x) < tolerance && Math.abs(nextCandidateEdge.startY - endPointOfPath.y) < tolerance) ) {
                    currentPathEdges.push(nextCandidateEdge);
                    currentPathEdgeIndices.push(i);
                    used.add(i);
                    endPointOfPath = {x: nextCandidateEdge.endX, y: nextCandidateEdge.endY}; // Update end point of path
                    foundNext = true;
                    break;
                }
                // Check if nextCandidateEdge's end connects to endPointOfPath (reverse the edge)
                else if ( (Math.abs(nextCandidateEdge.endX - endPointOfPath.x) < tolerance && Math.abs(nextCandidateEdge.endY - endPointOfPath.y) < tolerance) ) {
                    currentPathEdges.push({ // Add reversed edge to path
                        startX: nextCandidateEdge.endX,
                        startY: nextCandidateEdge.endY,
                        endX: nextCandidateEdge.startX,
                        endY: nextCandidateEdge.startY,
                        id: nextCandidateEdge.id, type: nextCandidateEdge.type, coving: nextCandidateEdge.coving, covingAmount: nextCandidateEdge.covingAmount
                    });
                    currentPathEdgeIndices.push(i);
                    used.add(i);
                    endPointOfPath = {x: nextCandidateEdge.startX, y: nextCandidateEdge.startY}; // Update end point of path
                    foundNext = true;
                    break;
                }
            }

            if (!foundNext) {
                // If no next edge found, check if the path closes back to its start
                if (Math.abs(endPointOfPath.x - startPointOfPath.x) < tolerance && Math.abs(endPointOfPath.y - startPointOfPath.y) < tolerance) {
                    break; // Path closed
                }
                console.warn("Void edge group not closed, breaking trace (might be fragmented):", currentPathEdgeIndices);
                currentPathEdgeIndices.forEach(idx => used.delete(idx)); // Release edges if path isn't closed
                break;
            }
        }

        // If a valid closed shape with at least 3 points is formed
        if (currentPathEdges.length >= 3 && Math.abs(endPointOfPath.x - startPointOfPath.x) < tolerance && Math.abs(endPointOfPath.y - startPointOfPath.y) < tolerance) {
            // Re-order the connected edges into a proper polygon sequence of points
            const orderedVoidPolyPoints = window.orderWallsIntoPolygon(currentPathEdges);
            if (orderedVoidPolyPoints.length >= 3) {
                 shapes.push(orderedVoidPolyPoints);
            }
        } else {
            console.warn("Invalid void shape detected (not enough edges or not closed):", currentPathEdges);
            currentPathEdgeIndices.forEach(idx => used.delete(idx)); // Release edges
        }
    });
    return shapes;
};

/**
 * Processes a void polygon to account for coving. This typically means shrinking the void polygon
 * inward by the coving amount, as vinyl would extend into this area.
 * @param {Array<Object>} voidShapePoints - Vertices of the void polygon.
 * @param {Array<Object>} voidEdges - Original voidEdge objects (to get coving info).
 * @param {number} gridSize - Pixels per meter scale.
 * @returns {Array<Object>} Vertices of the adjusted void polygon.
 */
window.processVoidCoving = window.processVoidCoving || function(voidShapePoints, voidEdges, gridSize) {
    const minCovingAmount = 0.001; // meters

    let maxCovingAmount = 0;
    // Find the maximum coving amount applied to any edge of this void shape
    voidShapePoints.forEach((p1, idx) => {
        const p2 = voidShapePoints[(idx + 1) % voidShapePoints.length];
        const correspondingEdge = voidEdges.find(edge =>
            // Check if this voidEdge matches the current segment (p1-p2 or p2-p1)
            ( (window.calculateDistance({x:edge.startX,y:edge.startY}, p1, 1) * gridSize < 1 && window.calculateDistance({x:edge.endX,y:edge.endY}, p2, 1) * gridSize < 1) ||
              (window.calculateDistance({x:edge.startX,y:edge.startY}, p2, 1) * gridSize < 1 && window.calculateDistance({x:edge.endX,y:edge.endY}, p1, 1) * gridSize < 1) )
        );
        if (correspondingEdge && correspondingEdge.coving && correspondingEdge.covingAmount > minCovingAmount) {
            maxCovingAmount = Math.max(maxCovingAmount, correspondingEdge.covingAmount);
        }
    });

    if (maxCovingAmount > minCovingAmount) {
        // If coving is present, shrink the void polygon inward.
        // `offsetPolygon` with a negative offset performs shrinking.
        return window.offsetPolygon(voidShapePoints, -maxCovingAmount * gridSize); // offset in pixels
    }
    return voidShapePoints;
};

/**
 * Offsets a polygon (inflates/deflates) by a given pixel distance.
 * This is a simplified offset for convex polygons and might fail for complex concave shapes
 * or self-intersecting results if offsetPx is too large.
 * @param {Array<Object>} points - Vertices of the polygon.
 * @param {number} offsetPx - The distance to offset in pixels (positive for inflate, negative for deflate).
 * @returns {Array<Object>} New set of points for the offset polygon.
 */
window.offsetPolygon = window.offsetPolygon || function(points, offsetPx) {
    if (points.length < 3) return points;
    const newPoints = [];

    for (let i = 0; i < points.length; i++) {
        const p1 = points[(i - 1 + points.length) % points.length]; // Previous point
        const p2 = points[i];                                   // Current point
        const p3 = points[(i + 1) % points.length];            // Next point

        // Vectors forming the corner at p2
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        // Lengths of the vectors
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        let n1 = { x: 0, y: 0 }; // Normal to segment p1-p2
        let n2 = { x: 0, y: 0 }; // Normal to segment p2-p3

        // Calculate normalized outward normals for each segment
        if (len1 > 0) {
            n1 = { x: -v1.y / len1, y: v1.x / len1 };
        }
        if (len2 > 0) {
            n2 = { x: -v2.y / len2, y: v2.x / len2 };
        }

        // Average the two normals to find the bisector direction
        const avgN = { x: (n1.x + n2.x), y: (n1.y + n2.y) };
        const avgNLen = Math.sqrt(avgN.x * avgN.x + avgN.y * avgN.y);

        let scaledNormal = { x: 0, y: 0 };
        if (avgNLen > 0) {
            scaledNormal = { x: (avgN.x / avgNLen) * offsetPx, y: (avgN.y / avgNLen) * offsetPx };
        } else {
            // Handle degenerate cases (e.g., collinear points, zero-length segments)
            return { x: p2.x, y: p2.y }; // Return original point if no valid normal.
        }
        newPoints.push({ x: p2.x + scaledNormal.x, y: p2.y + scaledNormal.y });
    }
    return newPoints;
};
