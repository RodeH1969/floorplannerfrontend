// js/geometry.js

/**
 * Snaps a point to the nearest grid intersection if showGrid is true.
 * @param {Object} point - The point to snap {x, y}.
 * @param {number} gridSize - The size of the grid squares in pixels.
 * @param {boolean} showGrid - Whether the grid snapping is active.
 * @returns {Object} The snapped point or the original point.
 */
function snapToGrid(point, gridSize, showGrid) {
    return showGrid ? {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize
    } : point;
}

/**
 * Calculates the Euclidean distance between two points in meters.
 * @param {Object} p1 - First point {x, y}.
 * @param {Object} p2 - Second point {x, y}.
 * @param {number} gridSize - Pixels per meter scale.
 * @returns {number} The distance in meters.
 */
function calculateDistance(p1, p2, gridSize) {
    const pixelDistance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    return pixelDistance / gridSize; // Convert pixel distance to meters
}

/**
 * Calculates the angle (in degrees) of a line segment from p1 to p2.
 * @param {Object} p1 - Start point {x, y}.
 * @param {Object} p2 - End point {x, y}.
 * @returns {number} The angle in degrees (-180 to 180).
 */
function calculateAngle(p1, p2) {
    if (isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) {
        console.error("Invalid coordinates for angle calculation:", p1, p2);
        return 0;
    }
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
}

/**
 * Calculates the shortest distance from a point to a line segment.
 * Useful for hit-testing (e.g., selecting walls).
 * @param {Object} point - The point {x, y}.
 * @param {Object} lineStart - The start point of the line segment {x, y}.
 * @param {Object} lineEnd - The end point of the line segment {x, y}.
 * @param {number} gridSize - Pixels per meter scale (used for distance calculation).
 * @returns {number} The shortest distance in meters.
 */
function pointToLineDistance(point, lineStart, lineEnd, gridSize) {
    const L2 = Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2);
    if (L2 === 0) return calculateDistance(point, lineStart, gridSize); // Line is a single point

    // Project point onto the line defined by the segment
    const t = ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) + (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / L2;
    const projection = {
        x: lineStart.x + t * (lineEnd.x - lineStart.x),
        y: lineStart.y + t * (lineEnd.y - lineStart.y)
    };

    // If projection falls outside the segment, distance is to nearest endpoint
    if (t < 0) return calculateDistance(point, lineStart, gridSize);
    if (t > 1) return calculateDistance(point, lineEnd, gridSize);

    // Otherwise, distance is to the projection
    return calculateDistance(point, projection, gridSize);
}

/**
 * Checks if a point is inside a polygon using the ray-casting algorithm.
 * @param {number} x - X coordinate of the point.
 * @param {number} y - Y coordinate of the point.
 * @param {Array<Object>} polygon - Array of vertices defining the polygon {x, y}.
 * @returns {boolean} True if the point is inside, false otherwise.
 */
function pointInPolygon(x, y, polygon) {
    if (!polygon || polygon.length < 3) return false;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        // Check if the ray from (x,y) to the right crosses the segment (xi,yi)-(xj,yj)
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Calculates the area of a polygon using the Shoelace formula (in pixels^2).
 * @param {Array<Object>} points - Vertices of the polygon.
 * @returns {number} The area in square pixels.
 */
function calculatePolygonArea(points) {
    if (!points || points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length; // Next point in sequence
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
}

/**
 * Calculates the perimeter of a polygon in meters.
 * @param {Array<Object>} points - Vertices of the polygon.
 * @param {number} gridSize - Pixels per meter scale.
 * @returns {number} The perimeter in meters.
 */
function calculatePolygonPerimeter(points, gridSize) {
    if (!points || points.length < 2) return 0;
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length; // Next point (closes loop for perimeter)
        perimeter += calculateDistance(points[i], points[j], gridSize);
    }
    return perimeter;
}

/**
 * Gets the bounding box (minX, minY, maxX, maxY, width, height) of a polygon.
 * @param {Array<Object>} points - Vertices of the polygon.
 * @returns {Object} The bounding box object.
 */
function getPolygonBounds(points) {
    if (!points || points.length === 0) {
        return {minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0};
    }

    // Find min/max X and Y coordinates among all points
    const minX = Math.min(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxX = Math.max(...points.map(p => p.x));
    const maxY = Math.max(...points.map(p => p.y));

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}
