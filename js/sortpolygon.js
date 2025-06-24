// js/sortpolygon.js

/**
 * Arranges vinyl pieces linearly onto 25-meter rolls.
 * Pieces are assumed to be rectangles (their bounding boxes) for placement logic.
 * Places smaller pieces side by side within the roll width to reduce waste.
 *
 * @param {Array<Object>} piecesToLayout - Array of vinyl piece objects. Each piece should have:
 * - `originalPolygonPoints`: The actual clipped polygon shape points (for drawing).
 * - `lengthM`: The dimension of the piece that runs along the roll's length (in meters).
 * - `widthM`: The dimension of the piece that runs across the roll's width (in meters).
 * - `name`: A label for the piece (e.g., "P1_S1").
 * - `id`: A unique identifier for the piece.
 * @param {number} rollLengthM - The maximum length of a vinyl roll in meters (e.g., 25m).
 * @param {number} rollWidthM - The physical width of the vinyl roll in meters (e.g., 2m).
 * @returns {Array<Object>} An array of roll objects, each containing its placed pieces.
 */
function sortAndLayoutLinear(piecesToLayout, rollLengthM, rollWidthM) {
    const arrangedRolls = [];
    const tolerance = 0.0001;

    // Sort pieces by lengthM in descending order to prioritize larger pieces
    const sortedPieces = [...piecesToLayout].sort((a, b) => b.lengthM - a.lengthM);

    let currentRoll = {
        pieces: [],
        currentLengthUsed: 0,
        maxHeightUsed: 0, // Track the maximum height used in the current row
        rollNumber: 1
    };
    arrangedRolls.push(currentRoll);

    sortedPieces.forEach(piece => {
        // Warn if piece exceeds roll width
        if (piece.widthM > rollWidthM + tolerance) {
            console.warn(`Piece ${piece.name} (width: ${piece.widthM.toFixed(2)}m) is wider than the roll (${rollWidthM.toFixed(2)}m).`);
        }
        if (piece.lengthM > rollLengthM + tolerance) {
            console.warn(`Piece ${piece.name} (length: ${piece.lengthM.toFixed(2)}m) is longer than a single roll (${rollLengthM.toFixed(2)}m).`);
        }

        // Try to place the piece in the current roll
        let placed = false;
        let offsetY = 0;

        // Check if the piece can be placed side by side in the current row
        if (currentRoll.currentLengthUsed + piece.lengthM <= rollLengthM + tolerance) {
            // Try to fit the piece in the current row
            let currentWidthUsed = currentRoll.pieces
                .filter(p => p.offsetX_onRollM === currentRoll.currentLengthUsed)
                .reduce((sum, p) => sum + p.widthM, 0);

            if (currentWidthUsed + piece.widthM <= rollWidthM + tolerance) {
                // Place side by side in the current row
                piece.offsetX_onRollM = currentRoll.currentLengthUsed;
                piece.offsetY_onRollM = currentWidthUsed;
                piece.placedRollNumber = currentRoll.rollNumber;
                currentRoll.pieces.push(piece);
                currentRoll.maxHeightUsed = Math.max(currentRoll.maxHeightUsed, piece.offsetY_onRollM + piece.widthM);
                placed = true;
            }
        }

        if (!placed) {
            // Move to the next row or new roll
            if (currentRoll.currentLengthUsed + piece.lengthM <= rollLengthM + tolerance && currentRoll.maxHeightUsed + piece.widthM <= rollWidthM + tolerance) {
                // Start a new row in the current roll
                currentRoll.currentLengthUsed += currentRoll.maxHeightUsed > 0 ? piece.lengthM : 0;
                currentRoll.maxHeightUsed = 0;
                piece.offsetX_onRollM = currentRoll.currentLengthUsed;
                piece.offsetY_onRollM = 0;
                piece.placedRollNumber = currentRoll.rollNumber;
                currentRoll.pieces.push(piece);
                currentRoll.maxHeightUsed = piece.widthM;
                currentRoll.currentLengthUsed = Math.max(currentRoll.currentLengthUsed, piece.lengthM);
                placed = true;
            } else {
                // Start a new roll
                currentRoll = {
                    pieces: [],
                    currentLengthUsed: 0,
                    maxHeightUsed: 0,
                    rollNumber: arrangedRolls.length + 1
                };
                arrangedRolls.push(currentRoll);
                piece.offsetX_onRollM = 0;
                piece.offsetY_onRollM = 0;
                piece.placedRollNumber = currentRoll.rollNumber;
                currentRoll.pieces.push(piece);
                currentRoll.currentLengthUsed = piece.lengthM;
                currentRoll.maxHeightUsed = piece.widthM;
                placed = true;
            }
        }
    });

    return arrangedRolls;
}

window.sortAndLayoutLinear = sortAndLayoutLinear;
