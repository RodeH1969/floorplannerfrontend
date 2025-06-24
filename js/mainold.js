// js/main.js - PART 1 OF 2

// Global State Variables (accessible via window.variableName in other scripts)
window.canvas = document.getElementById('floorPlan');
window.ctx = window.canvas.getContext('2d');

window.currentTool = 'wall';
window.isDrawing = false;
window.startPoint = null;
window.endPoint = null;
window.objects = []; // Stores walls, doors, windows, sliding doors, voidEdges
window.voids = [];   // Legacy void system - keeping for compatibility
window.selectedObject = null; // The object currently selected (for editing/deletion)
window.selectedObjectIndex = -1; // Index in its respective array (objects or voids)
window.hoveredObject = null; // The object currently hovered over
window.gridSize = 100; // 100px = 1 metre
window.showGrid = true;
window.lastEndPoint = null; // Stores the end point of the last drawn object for snapping
window.isNewAreaMode = false; // Flag to indicate if 'New Area' mode is active

// Enhanced void system
window.isVoidCreationMode = false;
window.currentVoidPoints = [];
window.activeObjectForContextMenu = null; // Object that the context menu is currently open for

// Default dimensions for components in pixels
window.defaultDoorWidthPx = 0.82 * window.gridSize; // 820mm = 0.82m
window.defaultDoubleDoorWidthPx = 1.64 * window.gridSize; // 1640mm = 1.64m
window.defaultComponentHeightPx = 20; // Fixed height for window/sliding door images

// Phase II: Advanced Vinyl Layout System
window.currentVinylLayout = null;
window.vinylSheets = [];
window.showVinylLayout = false;

// Image assets for windows and sliding doors
window.windowImage = new Image();
window.slidingDoorImage = new Image();
let imagesLoaded = 0;
const totalImagesToLoad = 2;

// Tool buttons (references to HTML elements)
const toolButtons = {
    wall: document.getElementById('wallBtn'),
    door: document.getElementById('doorBtn'),
    doubleDoor: document.getElementById('doubleDoorBtn'),
    window: document.getElementById('windowBtn'),
    slidingDoor: document.getElementById('slidingDoorBtn'),
    void: document.getElementById('voidBtn'),
    select: document.getElementById('selectBtn'),
    newArea: document.getElementById('newAreaBtn')
};

// Image loading callback
function imageLoadedCallback() {
    imagesLoaded++;
    if (imagesLoaded === totalImagesToLoad) {
        drawObjects(); // Draw initial state after all images are loaded
    }
}

window.windowImage.onload = imageLoadedCallback;
window.slidingDoorImage.onload = imageLoadedCallback;

window.windowImage.onerror = () => {
    console.error("Failed to load 'library/window.png'. Please ensure the file exists in the 'library' subfolder. Using placeholder.");
    window.windowImage.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='20'%3E%3Crect width='100' height='20' fill='%232196F3'/%3E%3Ctext x='50' y='15' text-anchor='middle' fill='white' font-size='10'%3EWINDOW%3C/text%3E%3C/svg%3E`;
    imageLoadedCallback();
};

window.slidingDoorImage.onerror = () => {
    console.error("Failed to load 'library/sliding_door.png'. Please ensure the file exists in the 'library' subfolder. Using placeholder.");
    window.slidingDoorImage.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='20'%3E%3Crect width='100' height='20' fill='%239C27B0'/%3E%3Ctext x='50' y='15' text-anchor='middle' fill='white' font-size='8'%3ESLIDING%3C/text%3E%3C/svg%3E`;
    imageLoadedCallback();
};

// Set initial image sources (will trigger onload/onerror)
window.windowImage.src = "library/window.png";
window.slidingDoorImage.src = "library/sliding_door.png";

// Enhanced void management functions - now creates individual void edges
function startVoid() {
    window.isVoidCreationMode = true;
    window.currentVoidPoints = [];
    document.getElementById('voidInstructions').style.display = 'block';
    document.getElementById('finishVoidBtn').style.display = 'inline-block';
    document.getElementById('cancelVoidBtn').style.display = 'inline-block';
    document.getElementById('voidBtn').style.display = 'none';
}

function finishVoid() {
    if (window.currentVoidPoints.length >= 3) {
        // Create individual void edge objects (like walls)
        for (let i = 0; i < window.currentVoidPoints.length; i++) {
            const j = (i + 1) % window.currentVoidPoints.length;
            const startPoint = window.currentVoidPoints[i];
            const endPoint = window.currentVoidPoints[j];

            // Add as a void edge object that can be selected individually
            window.objects.push({
                type: 'voidEdge',
                startX: startPoint.x,
                startY: startPoint.y,
                endX: endPoint.x,
                endY: endPoint.y,
                coving: false,
                covingAmount: 0
            });
        }

        calculateFloorMeasurements();
        calculateVinyl();
    }
    cancelVoid();
}

function cancelVoid() {
    window.isVoidCreationMode = false;
    window.currentVoidPoints = [];
    document.getElementById('voidInstructions').style.display = 'none';
    document.getElementById('finishVoidBtn').style.display = 'none';
    document.getElementById('cancelVoidBtn').style.display = 'none';
    document.getElementById('voidBtn').style.display = 'inline-block';
    drawObjects();
}

// Context menu functions
function showContextMenu(clientX, clientY) {
    if (!window.activeObjectForContextMenu) return;

    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.left = `${clientX}px`;
    contextMenu.style.top = `${clientY}px`;
    contextMenu.style.display = 'block';

    // Hide all specific input groups first
    document.getElementById('ctxLengthAngleInputs').style.display = 'none';
    document.getElementById('ctxCovingInputs').style.display = 'none';
    document.getElementById('ctxRotateObjectInputs').style.display = 'none';
    document.getElementById('ctxVoidInputs').style.display = 'none';

    // Show relevant input group based on object type
    if (window.activeObjectForContextMenu.type === 'wall' || window.activeObjectForContextMenu.type === 'voidEdge' || ['door', 'doubleDoor', 'window', 'slidingDoor'].includes(window.activeObjectForContextMenu.type)) {
        document.getElementById('ctxLengthAngleInputs').style.display = 'flex';
        document.getElementById('ctxLength').value = calculateDistance({x: window.activeObjectForContextMenu.startX, y: window.activeObjectForContextMenu.startY}, {x: window.activeObjectForContextMenu.endX, y: window.activeObjectForContextMenu.endY}, window.gridSize).toFixed(2);
        document.getElementById('ctxAngle').value = calculateAngle({x: window.activeObjectForContextMenu.startX, y: window.activeObjectForContextMenu.startY}, {x: window.activeObjectForContextMenu.endX, y: window.activeObjectForContextMenu.endY}).toFixed(1);

        if (window.activeObjectForContextMenu.type === 'wall' || window.activeObjectForContextMenu.type === 'voidEdge') {
            document.getElementById('ctxCovingInputs').style.display = 'flex';
            const buttonText = window.activeObjectForContextMenu.type === 'voidEdge' ?
                (window.activeObjectForContextMenu.coving ? 'Remove Void Coving' : 'Add Void Coving') :
                (window.activeObjectForContextMenu.coving ? 'Remove Coving' : 'Add Coving');
            document.getElementById('ctxAddCovingBtn').textContent = buttonText;
            document.getElementById('ctxCovingAmount').value = window.activeObjectForContextMenu.coving ? (window.activeObjectForContextMenu.covingAmount * 1000).toFixed(0) : '150';
        }
        if (window.activeObjectForContextMenu.type !== 'wall' && window.activeObjectForContextMenu.type !== 'voidEdge') {
            document.getElementById('ctxRotateObjectInputs').style.display = 'flex';
            document.getElementById('ctxRotateAngle').value = calculateAngle({x: window.activeObjectForContextMenu.startX, y: window.activeObjectForContextMenu.startY}, {x: window.activeObjectForContextMenu.endX, y: window.activeObjectForContextMenu.endY}).toFixed(1);
        }
    } else if (window.activeObjectForContextMenu.type === 'void') {
        document.getElementById('ctxVoidInputs').style.display = 'flex';
        if (window.activeObjectForContextMenu.points && window.activeObjectForContextMenu.points.length > 0) {
            const centerX = window.activeObjectForContextMenu.points.reduce((sum, p) => sum + p.x, 0) / window.activeObjectForContextMenu.points.length;
            const centerY = window.activeObjectForContextMenu.points.reduce((sum, p) => sum + p.y, 0) / window.activeObjectForContextMenu.points.length;

            document.getElementById('ctxVoidX').value = (centerX / window.gridSize).toFixed(2);
            document.getElementById('ctxVoidY').value = (centerY / window.gridSize).toFixed(2);

            // Set up void coving controls
            document.getElementById('ctxAddVoidCovingBtn').textContent = window.activeObjectForContextMenu.coving ? 'Remove Void Coving' : 'Add Void Coving';
            document.getElementById('ctxVoidCovingAmount').value = window.activeObjectForContextMenu.coving ? (window.activeObjectForContextMenu.covingAmount * 1000).toFixed(0) : '150';
        }
    }
}

// Canvas Event Listeners
window.canvas.addEventListener('mousedown', (e) => {
    const rect = window.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (window.isVoidCreationMode) {
        // Add point to current void
        const point = snapToGrid({x, y}, window.gridSize, window.showGrid);
        window.currentVoidPoints.push(point);
        drawObjects(point, null);
        return;
    }

    if (window.currentTool === 'select') {
        // Reset selection before attempting to find a new one
        window.selectedObject = null;
        window.selectedObjectIndex = -1;
        window.activeObjectForContextMenu = null;
        document.getElementById('contextMenu').style.display = 'none';

        // Check for void selection first
        let foundObject = false;
        for (let i = window.voids.length - 1; i >= 0; i--) {
            const voidObj = window.voids[i];
            if (voidObj.points && pointInPolygon({x, y}, voidObj.points)) {
                window.selectedObject = voidObj;
                window.selectedObjectIndex = i;
                window.activeObjectForContextMenu = voidObj;
                foundObject = true;
                break;
            }
        }

        // If no void selected, check other objects
        if (!foundObject) {
            for (let i = window.objects.length - 1; i >= 0; i--) {
                const obj = window.objects[i];
                const point = {x, y};
                const startDist = Math.sqrt(Math.pow(obj.startX - x, 2) + Math.pow(obj.startY - y, 2));
                const endDist = Math.sqrt(Math.pow(obj.endX - x, 2) + Math.pow(obj.endY - y, 2));

                const detectionTolerancePx = 15;
                if (pointToLineDistance(point, {x: obj.startX, y: obj.startY}, {x: obj.endX, y: obj.endY}, window.gridSize) * window.gridSize < detectionTolerancePx || startDist < 10 || endDist < 10) {
                    window.selectedObject = obj;
                    window.selectedObjectIndex = i;
                    window.activeObjectForContextMenu = obj;
                    foundObject = true;
                    break;
                }
            }
        }

        if (foundObject) {
            drawObjects();
        } else {
            drawObjects();
        }

    } else if (['wall', 'door', 'doubleDoor', 'window', 'slidingDoor'].includes(window.currentTool)) {
        // Drawing tools logic
        window.isDrawing = true;

        // Snap to last end point if available and not in new area mode
        let startPoint = {x, y};
        if (window.lastEndPoint && !window.isNewAreaMode) {
            const snapDistance = 20; // pixels
            const distToLastEnd = Math.sqrt(Math.pow(x - window.lastEndPoint.x, 2) + Math.pow(y - window.lastEndPoint.y, 2));
            if (distToLastEnd < snapDistance) {
                startPoint = {x: window.lastEndPoint.x, y: window.lastEndPoint.y};
            }
        }

        // Also check for snapping to other object endpoints
        if (!window.lastEndPoint || window.isNewAreaMode) {
            const snapDistance = 15; // pixels
            let snappedToPoint = null;
            let minDistance = snapDistance;

            // Check all object endpoints for snapping
            window.objects.forEach(obj => {
                // Check start point
                const distToStart = Math.sqrt(Math.pow(x - obj.startX, 2) + Math.pow(y - obj.startY, 2));
                if (distToStart < minDistance) {
                    minDistance = distToStart;
                    snappedToPoint = {x: obj.startX, y: obj.startY};
                }

                // Check end point
                const distToEnd = Math.sqrt(Math.pow(x - obj.endX, 2) + Math.pow(y - obj.endY, 2));
                if (distToEnd < minDistance) {
                    minDistance = distToEnd;
                    snappedToPoint = {x: obj.endX, y: obj.endY};
                }
            });

            if (snappedToPoint) {
                startPoint = snappedToPoint;
            }
        }

        window.startPoint = startPoint;
        window.endPoint = startPoint; // Initialize endPoint for preview

        // Special handling for initial preview of doors/windows
        if (window.currentTool === 'door') {
            window.endPoint = { x: window.startPoint.x + window.defaultDoorWidthPx, y: window.startPoint.y };
        } else if (window.currentTool === 'doubleDoor') {
            window.endPoint = { x: window.startPoint.x + window.defaultDoubleDoorWidthPx, y: window.startPoint.y };
        } else if (window.currentTool === 'window' || window.currentTool === 'slidingDoor') {
            window.endPoint = { x: window.startPoint.x + window.defaultDoorWidthPx, y: window.startPoint.y };
        }
    }
});

window.canvas.addEventListener('mousemove', (e) => {
    const rect = window.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (window.isVoidCreationMode && window.currentVoidPoints.length > 0) {
        // Show preview line for void creation
        drawObjects({x, y}, null);
        return;
    }

    if (!window.isDrawing) {
        // Hover logic when not drawing
        if (window.currentTool === 'select') {
            let foundHover = false;
            window.hoveredObject = null;

            // Check void hover first
            for (let i = window.voids.length - 1; i >= 0; i--) {
                const voidObj = window.voids[i];
                if (voidObj.points && pointInPolygon({x, y}, voidObj.points)) {
                    window.hoveredObject = voidObj;
                    foundHover = true;
                    break;
                }
            }

            // If no void is hovered, check other objects
            if (!foundHover) {
                for (let i = window.objects.length - 1; i >= 0; i--) {
                    const obj = window.objects[i];
                    const clickedPoint = { x: x, y: y };
                    const detectionTolerancePx = 15;
                    if (pointToLineDistance(clickedPoint, {x: obj.startX, y: obj.startY}, {x: obj.endX, y: obj.endY}, window.gridSize) * window.gridSize < detectionTolerancePx) {
                        window.hoveredObject = obj;
                        foundHover = true;
                        break;
                    }
                }
            }
            drawObjects();
        }
        return;
    }

    // Drawing preview logic
    if (e.shiftKey && window.startPoint) {
        const dx = x - window.startPoint.x;
        const dy = y - window.startPoint.y;
        const angle = Math.atan2(dy, dx);
        const snapAngle = Math.round(angle / (Math.PI/4)) * (Math.PI/4);
        const length = Math.sqrt(dx*dx + dy*dy);
        window.endPoint = {
            x: window.startPoint.x + Math.cos(snapAngle) * length,
            y: window.startPoint.y + Math.sin(snapAngle) * length
        };
    } else {
        window.endPoint = {x, y};
    }

    drawObjects(window.startPoint, window.endPoint);
});

window.canvas.addEventListener('mouseup', () => {
    if (window.isDrawing && window.startPoint && window.endPoint) {
        if (window.startPoint.x !== window.endPoint.x || window.startPoint.y !== window.endPoint.y) {
            window.objects.push({
                type: window.currentTool,
                startX: window.startPoint.x,
                startY: window.startPoint.y,
                endX: window.endPoint.x,
                endY: window.endPoint.y,
                coving: false,
                covingAmount: 0
            });
            window.lastEndPoint = { x: window.endPoint.x, y: window.endPoint.y };
            calculateFloorMeasurements();
            calculateVinyl();
        }
        window.isDrawing = false;
        window.startPoint = null;
        window.endPoint = null;
        drawObjects();
    }
});

window.canvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (window.isVoidCreationMode && window.currentVoidPoints.length >= 3) {
        finishVoid();
    }
});

// Add a more reliable double-click detection for void finishing
let lastClickTime = 0;
let clickCount = 0;

window.canvas.addEventListener('click', (e) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;

    if (timeDiff < 500) { // Within 500ms
        clickCount++;
        if (clickCount === 2 && window.isVoidCreationMode && window.currentVoidPoints.length >= 3) {
            // Double click detected while in void creation mode
            e.preventDefault();
            e.stopPropagation();
            finishVoid();
            clickCount = 0;
            return;
        }
    } else {
        clickCount = 1;
    }

    lastClickTime = currentTime;

    // Reset click count after delay
    setTimeout(() => {
        if (Date.now() - lastClickTime >= 500) {
            clickCount = 0;
        }
    }, 500);
});

window.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = window.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    window.selectedObject = null;
    window.selectedObjectIndex = -1;
    window.activeObjectForContextMenu = null;
    document.getElementById('contextMenu').style.display = 'none';

    // Check for void selection first
    for (let i = window.voids.length - 1; i >= 0; i--) {
        const voidObj = window.voids[i];
        if (voidObj.points && pointInPolygon({x: mouseX, y: mouseY}, voidObj.points)) {
            window.selectedObject = voidObj;
            window.selectedObjectIndex = i;
            window.activeObjectForContextMenu = voidObj;
            break;
        }
    }

    // If no void selected, check other objects
    if (!window.activeObjectForContextMenu) {
        for (let i = window.objects.length - 1; i >= 0; i--) {
            const obj = window.objects[i];
            const startP = { x: obj.startX, y: obj.startY };
            const endP = { x: obj.endX, y: obj.endY };
            const clickedPoint = { x: mouseX, y: mouseY };
            if (pointToLineDistance(clickedPoint, startP, endP, window.gridSize) * window.gridSize < 15) {
                window.selectedObject = obj;
                window.selectedObjectIndex = i;
                window.activeObjectForContextMenu = obj;
                break;
            }
        }
    }

    if (window.activeObjectForContextMenu) {
        drawObjects();
        showContextMenu(e.clientX, e.clientY);
    } else {
        document.getElementById('contextMenu').style.display = 'none';
        drawObjects();
    }
});

// Context menu event listeners
document.getElementById('ctxDeleteBtn').addEventListener('click', () => {
    if (window.activeObjectForContextMenu) {
        showCustomConfirm(`Delete this ${window.activeObjectForContextMenu.type}?`).then(confirmed => {
            if (confirmed) {
                if (window.activeObjectForContextMenu.type === 'void') {
                    const index = window.voids.indexOf(window.activeObjectForContextMenu);
                    if (index > -1) { window.voids.splice(index, 1); }
                } else {
                    const index = window.objects.indexOf(window.activeObjectForContextMenu);
                    if (index > -1) { window.objects.splice(index, 1); }
                    if (window.objects.length === 0) { window.lastEndPoint = null; }
                }
                window.activeObjectForContextMenu = null;
                window.selectedObject = null;
                window.selectedObjectIndex = -1;
                calculateFloorMeasurements();
                calculateVinyl();
                drawObjects();
            }
            document.getElementById('contextMenu').style.display = 'none';
        });
    }
});

document.getElementById('ctxUpdateLengthAngleBtn').addEventListener('click', () => {
    if (window.activeObjectForContextMenu && window.activeObjectForContextMenu.type !== 'void') {
        const newLength = parseFloat(document.getElementById('ctxLength').value);
        let newAngle = parseFloat(document.getElementById('ctxAngle').value);
        if (isNaN(newLength) || isNaN(newAngle) || newLength < 0) {
            showCustomAlert("Please enter valid positive numbers for length and angle."); return;
        }
        newAngle = newAngle % 360;
        if (newAngle > 180) newAngle -= 360; if (newAngle < -180) newAngle += 360;
        const startP = { x: window.activeObjectForContextMenu.startX, y: window.activeObjectForContextMenu.startY };
        const newEndPx = startP.x + (newLength * window.gridSize) * Math.cos(newAngle * Math.PI / 180);
        const newEndPy = startP.y + (newLength * window.gridSize) * Math.sin(newAngle * Math.PI / 180);
        window.activeObjectForContextMenu.endX = newEndPx;
        window.activeObjectForContextMenu.endY = newEndPy;
        calculateFloorMeasurements(); calculateVinyl(); drawObjects();
        document.getElementById('contextMenu').style.display = 'none';
    }
});

document.getElementById('ctxAddCovingBtn').addEventListener('click', () => {
    if (window.activeObjectForContextMenu && (window.activeObjectForContextMenu.type === 'wall' || window.activeObjectForContextMenu.type === 'voidEdge')) {
        const covingAmountMm = parseFloat(document.getElementById('ctxCovingAmount').value);
        if (isNaN(covingAmountMm) || covingAmountMm < 0) {
            showCustomAlert("Please enter a valid positive number for coving amount (mm)."); return;
        }

        // Toggle coving state
        window.activeObjectForContextMenu.coving = !window.activeObjectForContextMenu.coving;
        window.activeObjectForContextMenu.covingAmount = window.activeObjectForContextMenu.coving ? covingAmountMm / 1000 : 0;

        // Update button text immediately after toggling
        const buttonText = window.activeObjectForContextMenu.type === 'voidEdge' ?
            (window.activeObjectForContextMenu.coving ? 'Remove Void Coving' : 'Add Void Coving') :
            (window.activeObjectForContextMenu.coving ? 'Remove Coving' : 'Add Coving');
        document.getElementById('ctxAddCovingBtn').textContent = buttonText;

        calculateFloorMeasurements();
        calculateVinyl();
        drawObjects();

        // Don't close context menu - let user see the change
        console.log(`Coving ${window.activeObjectForContextMenu.coving ? 'added' : 'removed'} for ${window.activeObjectForContextMenu.type}`);
    }
});

document.getElementById('ctxRotateByInputBtn').addEventListener('click', () => {
    if (window.activeObjectForContextMenu && window.activeObjectForContextMenu.type !== 'wall' && window.activeObjectForContextMenu.type !== 'void' && window.activeObjectForContextMenu.type !== 'voidEdge') {
        let newAngle = parseFloat(document.getElementById('ctxRotateAngle').value);
        if (isNaN(newAngle)) {
            showCustomAlert("Please enter a valid number for rotation angle.");
            return;
        }

        const startP = { x: window.activeObjectForContextMenu.startX, y: window.activeObjectForContextMenu.startY };
        const currentLength = calculateDistance(startP, {x: window.activeObjectForContextMenu.endX, y: window.activeObjectForContextMenu.endY}, window.gridSize);

        // Normalize angle
        newAngle = newAngle % 360;
        if (newAngle > 180) newAngle -= 360;
        if (newAngle < -180) newAngle += 360;

        // Calculate new end point
        const newEndPx = startP.x + (currentLength * window.gridSize) * Math.cos(newAngle * Math.PI / 180);
        const newEndPy = startP.y + (currentLength * window.gridSize) * Math.sin(newAngle * Math.PI / 180);

        // Update the EXISTING object (don't create new one)
        window.activeObjectForContextMenu.endX = newEndPx;
        window.activeObjectForContextMenu.endY = newEndPy;

        // Update the lastEndPoint if this was the most recent object
        const lastObject = window.objects[window.objects.length - 1];
        if (lastObject === window.activeObjectForContextMenu) {
            window.lastEndPoint = { x: newEndPx, y: newEndPy };
        }

        drawObjects();
        document.getElementById('contextMenu').style.display = 'none';

        console.log(`Rotated ${window.activeObjectForContextMenu.type} to ${newAngle.toFixed(1)}°`);
    }
});

document.getElementById('ctxRotate45Btn').addEventListener('click', () => {
    if (window.activeObjectForContextMenu && window.activeObjectForContextMenu.type !== 'wall' && window.activeObjectForContextMenu.type !== 'void' && window.activeObjectForContextMenu.type !== 'voidEdge') {
        const startP = { x: window.activeObjectForContextMenu.startX, y: window.activeObjectForContextMenu.startY };
        const currentLength = calculateDistance(startP, {x: window.activeObjectForContextMenu.endX, y: window.activeObjectForContextMenu.endY}, window.gridSize);
        let currentAngle = calculateAngle(startP, {x: window.activeObjectForContextMenu.endX, y: window.activeObjectForContextMenu.endY});

        // Add 45 degrees
        let newAngle = currentAngle + 45;

        // Normalize angle
        newAngle = newAngle % 360;
        if (newAngle > 180) newAngle -= 360;
        if (newAngle < -180) newAngle += 360;

        // Calculate new end point
        const newEndPx = startP.x + (currentLength * window.gridSize) * Math.cos(newAngle * Math.PI / 180);
        const newEndPy = startP.y + (currentLength * window.gridSize) * Math.sin(newAngle * Math.PI / 180);

        // Update the EXISTING object
        window.activeObjectForContextMenu.endX = newEndPx;
        window.activeObjectForContextMenu.endY = newEndPy;

        // Update the lastEndPoint if this was the most recent object
        const lastObject = window.objects[window.objects.length - 1];
        if (lastObject === window.activeObjectForContextMenu) {
            window.lastEndPoint = { x: newEndPx, y: newEndPy };
        }

        // Update the angle input to show new angle
        document.getElementById('ctxRotateAngle').value = newAngle.toFixed(1);

        drawObjects();

        console.log(`Rotated ${window.activeObjectForContextMenu.type} by +45° to ${newAngle.toFixed(1)}°`);
    }
});

document.getElementById('ctxUpdateVoidBtn').addEventListener('click', () => {
    if (window.activeObjectForContextMenu && window.activeObjectForContextMenu.type === 'void') {
        const newX = parseFloat(document.getElementById('ctxVoidX').value) * window.gridSize;
        const newY = parseFloat(document.getElementById('ctxVoidY').value) * window.gridSize;

        if (isNaN(newX) || isNaN(newY)) {
            showCustomAlert("Please enter valid numbers for void position."); return;
        }

        if (window.activeObjectForContextMenu.points && window.activeObjectForContextMenu.points.length > 0) {
            // Calculate current center
            const currentCenterX = window.activeObjectForContextMenu.points.reduce((sum, p) => sum + p.x, 0) / window.activeObjectForContextMenu.points.length;
            const currentCenterY = window.activeObjectForContextMenu.points.reduce((sum, p) => sum + p.y, 0) / window.activeObjectForContextMenu.points.length;

            // Calculate offset
            const offsetX = newX - currentCenterX;
            const offsetY = newY - currentCenterY;

            // Move all points
            window.activeObjectForContextMenu.points.forEach(point => {
                point.x += offsetX;
                point.y += offsetY;
            });
        }

        calculateFloorMeasurements(); calculateVinyl(); drawObjects();
        document.getElementById('contextMenu').style.display = 'none';
    }
});

document.getElementById('ctxAddVoidCovingBtn').addEventListener('click', () => {
    if (window.activeObjectForContextMenu && window.activeObjectForContextMenu.type === 'void') {
        const covingAmountMm = parseFloat(document.getElementById('ctxVoidCovingAmount').value);
        if (isNaN(covingAmountMm) || covingAmountMm < 0) {
            showCustomAlert("Please enter a valid positive number for void coving amount (mm)."); return;
        }
        window.activeObjectForContextMenu.coving = !window.activeObjectForContextMenu.coving;
        window.activeObjectForContextMenu.covingAmount = window.activeObjectForContextMenu.coving ? covingAmountMm / 1000 : 0;
        document.getElementById('ctxAddVoidCovingBtn').textContent = window.activeObjectForContextMenu.coving ? 'Remove Void Coving' : 'Add Void Coving';
        calculateFloorMeasurements(); calculateVinyl(); drawObjects();
    }
});

// Toolbar Event Listeners
Object.entries(toolButtons).forEach(([tool, button]) => {
    button.addEventListener('click', () => {
        // Remove 'active' class from all buttons
        Object.values(toolButtons).forEach(btn => btn.classList.remove('active'));
        // Add 'active' class to the clicked button
        button.classList.add('active');

        // Handle tool changes
        if (tool === 'newArea') {
            window.isNewAreaMode = true;
            window.lastEndPoint = null;
            window.currentTool = 'wall';
            if (window.isVoidCreationMode) cancelVoid();
        } else if (tool === 'void') {
            startVoid();
        } else {
            if (window.isVoidCreationMode) cancelVoid();
            window.currentTool = tool;
            window.isNewAreaMode = false;
        }

        // Clear selection and context menu
        window.selectedObject = null;
        window.selectedObjectIndex = -1;
        window.activeObjectForContextMenu = null;
        document.getElementById('contextMenu').style.display = 'none';
        calculateFloorMeasurements();
        calculateVinyl();
        drawObjects();
    });
});

// Void control buttons
document.getElementById('finishVoidBtn')?.addEventListener('click', finishVoid);
document.getElementById('cancelVoidBtn')?.addEventListener('click', cancelVoid);

// Event listener for delete button
document.getElementById('deleteBtn').addEventListener('click', () => {
    if (window.activeObjectForContextMenu) {
        showCustomConfirm(`Delete this ${window.activeObjectForContextMenu.type}?`).then(confirmed => {
            if (confirmed) {
                if (window.activeObjectForContextMenu.type === 'void') {
                    const index = window.voids.indexOf(window.activeObjectForContextMenu);
                    if (index > -1) { window.voids.splice(index, 1); }
                } else {
                    const index = window.objects.indexOf(window.activeObjectForContextMenu);
                    if (index > -1) { window.objects.splice(index, 1); }
                    if (window.objects.length === 0) { window.lastEndPoint = null; }
                }
                window.activeObjectForContextMenu = null;
                window.selectedObject = null;
                window.selectedObjectIndex = -1;
                calculateFloorMeasurements(); calculateVinyl(); drawObjects();
            }
            document.getElementById('contextMenu').style.display = 'none';
        });
    } else if (window.selectedObject) {
        showCustomConfirm(`Delete this ${window.selectedObject.type}?`).then(confirmed => {
            if (confirmed) {
                if (window.selectedObject.type === 'void') {
                    const index = window.voids.indexOf(window.selectedObject);
                    if (index > -1) { window.voids.splice(index, 1); }
                } else {
                    const index = window.objects.indexOf(window.selectedObject);
                    if (index > -1) { window.objects.splice(index, 1); }
                    if (window.objects.length === 0) { window.lastEndPoint = null; }
                }
                window.selectedObject = null;
                window.selectedObjectIndex = -1;
                calculateFloorMeasurements(); calculateVinyl(); drawObjects();
            }
        });
    } else {
        showCustomAlert("No object selected to delete.");
    }
});

// Event listener for clear all button
document.getElementById('clearBtn').addEventListener('click', () => {
    showCustomConfirm('Clear all objects and voids?').then(confirmed => {
        if (confirmed) {
            window.objects = [];
            window.voids = [];
            window.selectedObject = null;
            window.selectedObjectIndex = -1;
            window.activeObjectForContextMenu = null;
            window.lastEndPoint = null;
            if (window.isVoidCreationMode) cancelVoid();
            calculateFloorMeasurements();
            calculateVinyl();
            drawObjects();
        }
    });
});

// Event listener for toggle grid button
document.getElementById('toggleGridBtn').addEventListener('click', () => {
    window.showGrid = !window.showGrid;
    drawObjects();
});

// Event listener for grid size input
document.getElementById('gridSize').addEventListener('change', (e) => {
    window.gridSize = parseInt(e.target.value);
    window.defaultDoorWidthPx = 0.82 * window.gridSize;
    window.defaultDoubleDoorWidthPx = 1.64 * window.gridSize;
    drawObjects();
    calculateFloorMeasurements();
    calculateVinyl();
});

// Phase II: Advanced Vinyl Layout System

// Lay Vinyl button - Phase II main function
document.getElementById('layVinylBtn')?.addEventListener('click', () => {
    const area = parseFloat(document.getElementById('totalArea').textContent);
    if (area === 0) {
        showCustomAlert("Please create a floor plan first before laying vinyl.");
        return;
    }

    // Show vinyl layout controls
    document.getElementById('vinylLayoutControls').style.display = 'block';
    document.getElementById('advancedResults').style.display = 'block';

    // Calculate optimal layout
    calculateAndDisplayOptimalLayout();

    showSuccessModal('Vinyl layout system activated! Choose your method above.', true, 2000);
});

// Apply selected layout method
document.getElementById('applyLayoutBtn')?.addEventListener('click', () => {
    const method = document.querySelector('input[name="layoutMethod"]:checked').value;
    applyVinylLayout(method);
});

// Clear vinyl layout
document.getElementById('clearLayoutBtn')?.addEventListener('click', () => {
    clearVinylLayout();
});

// Calculate and display optimal vinyl layout
function calculateAndDisplayOptimalLayout() {
    const rollLength = parseFloat(document.getElementById('rollLength').value) || 35;
    const rollWidth = parseFloat(document.getElementById('vinylWidth').value) || 2;
    const area = parseFloat(document.getElementById('totalArea').textContent);

    // Get room dimensions
    const walls = window.objects.filter(obj => obj.type === 'wall' || obj.type === 'voidEdge');
    if (walls.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    walls.forEach(wall => {
        minX = Math.min(minX, wall.startX, wall.endX);
        minY = Math.min(minY, wall.startY, wall.endY);
        maxX = Math.max(maxX, wall.startX, wall.endX);
        maxY = Math.max(maxY, wall.startY, wall.endY);
    });

    const roomWidth = (maxX - minX) / window.gridSize;
    const roomLength = (maxY - minY) / window.gridSize;

    console.log('🚀 PHASE II Linear Layout Analysis:');
    console.log(`- Room: ${roomWidth.toFixed(2)}m width × ${roomLength.toFixed(2)}m length`);
    console.log(`- Roll: ${rollWidth}m width × ${rollLength}m length`);

    // Calculate both methods
    const comparison = compareLinearVsPieces(area, window.voids, {rollWidth, rollLength});

    // Update display
    const method = comparison.recommendation === 'linear' ? 'Linear' : 'Pieces';
    const optimal = comparison.recommendation === 'linear' ? comparison.linear : comparison.pieces;

    document.getElementById('optimalMethod').textContent = method;
    document.getElementById('layoutEfficiency').textContent = optimal.efficiency.toFixed(1) + '%';
    document.getElementById('materialCost').textContent = optimal.cost.toFixed(0);
    document.getElementById('sheetsNeeded').textContent = optimal.rollsNeeded || optimal.piecesNeeded || 0;
    document.getElementById('cutLines').textContent = calculateCutLines(comparison.recommendation, roomWidth, roomLength, rollWidth);
    document.getElementById('recommendation').textContent = comparison.recommendation.toUpperCase() + ' METHOD RECOMMENDED';
    document.getElementById('recommendation').style.color = comparison.recommendation === 'linear' ? '#4CAF50' : '#FF9800';

    console.log('Vinyl Layout Analysis:', comparison);
}

// Apply the selected vinyl layout to the floor plan
function applyVinylLayout(method) {
    const rollLength = parseFloat(document.getElementById('rollLength').value) || 35;
    const rollWidth = parseFloat(document.getElementById('vinylWidth').value) || 2;

    // Get room bounds
    const walls = window.objects.filter(obj => obj.type === 'wall' || obj.type === 'voidEdge');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    walls.forEach(wall => {
        minX = Math.min(minX, wall.startX, wall.endX);
        minY = Math.min(minY, wall.startY, wall.endY);
        maxX = Math.max(maxX, wall.startX, wall.endX);
        maxY = Math.max(maxY, wall.startY, wall.endY);
    });

    const roomWidth = (maxX - minX) / window.gridSize;
    const roomLength = (maxY - minY) / window.gridSize;

    console.log(`🎯 Applying ${method.toUpperCase()} layout for room: ${roomWidth.toFixed(2)}m × ${roomLength.toFixed(2)}m`);

    // Generate vinyl sheets based on method
    window.vinylSheets = generateVinylSheets(method, minX, minY, maxX, maxY, roomWidth, roomLength, rollWidth, rollLength);
    window.showVinylLayout = true;
    window.currentVinylLayout = method;

    // Redraw with vinyl layout
    drawObjects();

    showSuccessModal(`${method.toUpperCase()} vinyl layout applied! Sheets are shown in ${method === 'linear' ? 'blue' : 'orange'}.`, true, 3000);
}

// FIXED: Generate vinyl sheet rectangles for visualization
function generateVinylSheets(method, minX, minY, maxX, maxY, roomWidth, roomLength, rollWidth, rollLength) {
    const sheets = [];

    console.log(`📐 Generating ${method} vinyl sheets:`);
    console.log(`   Room bounds: ${roomWidth.toFixed(2)}m × ${roomLength.toFixed(2)}m`);
    console.log(`   Roll specs: ${rollWidth}m × ${rollLength}m`);

    if (method === 'linear') {
        // FIXED: Smart direction choice for linear layout
        const horizontalRolls = Math.ceil(roomWidth / rollWidth);
        const verticalRolls = Math.ceil(roomLength / rollWidth);

        // Check if dimensions fit within roll length
        const horizontalFitsRoll = roomLength <= rollLength;
        const verticalFitsRoll = roomWidth <= rollLength;

        console.log(`   Horizontal option: ${horizontalRolls} rolls of ${rollWidth}m × ${roomLength.toFixed(2)}m (fits in roll: ${horizontalFitsRoll})`);
        console.log(`   Vertical option: ${verticalRolls} rolls of ${rollWidth}m × ${roomWidth.toFixed(2)}m (fits in roll: ${verticalFitsRoll})`);

        // Choose direction: prefer the one that fits in roll length and has fewer rolls
        let useHorizontal;
        if (horizontalFitsRoll && verticalFitsRoll) {
            useHorizontal = horizontalRolls <= verticalRolls;
        } else if (horizontalFitsRoll) {
            useHorizontal = true;
        } else if (verticalFitsRoll) {
            useHorizontal = false;
        } else {
            // Neither fits perfectly, choose fewer rolls
            useHorizontal = horizontalRolls <= verticalRolls;
        }

        console.log(`   OPTIMAL DIRECTION: ${useHorizontal ? 'HORIZONTAL' : 'VERTICAL'}`);

        if (useHorizontal) {
            // Horizontal strips - vinyl runs along the room length
            console.log(`Creating ${horizontalRolls} horizontal strips (running ${roomLength.toFixed(2)}m long):`);

            for (let i = 0; i < horizontalRolls; i++) {
                const stripX = minX + (i * rollWidth * window.gridSize);
                let stripWidth = rollWidth * window.gridSize;

                // Last strip may be narrower
                if (i === horizontalRolls - 1) {
                    const remainingWidth = maxX - stripX;
                    if (remainingWidth < stripWidth) {
                        stripWidth = remainingWidth;
                    }
                }

                const actualStripWidthM = stripWidth / window.gridSize;
                console.log(`  Sheet ${i + 1}: ${actualStripWidthM.toFixed(2)}m wide × ${roomLength.toFixed(2)}m long`);

                sheets.push({
                    x: stripX,
                    y: minY,
                    width: stripWidth,
                    height: (maxY - minY),
                    type: 'linear_horizontal',
                    sheetNumber: i + 1,
                    actualWidth: actualStripWidthM,
                    actualLength: roomLength
                });
            }
        } else {
            // Vertical strips - vinyl runs along the room width
            console.log(`Creating ${verticalRolls} vertical strips (running ${roomWidth.toFixed(2)}m long):`);

            for (let i = 0; i < verticalRolls; i++) {
                const stripY = minY + (i * rollWidth * window.gridSize);
                let stripHeight = rollWidth * window.gridSize;

                // Last strip may be shorter
                if (i === verticalRolls - 1) {
                    const remainingHeight = maxY - stripY;
                    if (remainingHeight < stripHeight) {
                        stripHeight = remainingHeight;
                    }
                }

                const actualStripHeightM = stripHeight / window.gridSize;
                console.log(`  Sheet ${i + 1}: ${roomWidth.toFixed(2)}m wide × ${actualStripHeightM.toFixed(2)}m long`);

                sheets.push({
                    x: minX,
                    y: stripY,
                    width: (maxX - minX),
                    height: stripHeight,
                    type: 'linear_vertical',
                    sheetNumber: i + 1,
                    actualWidth: roomWidth,
                    actualLength: actualStripHeightM
                });
            }
        }
    } else {
        // Pieces layout - create optimized rectangles
        const piecesPerRow = Math.floor(roomWidth / rollWidth);
        const piecesPerCol = Math.floor(roomLength / rollWidth);

        console.log(`Pieces Layout: ${piecesPerRow} × ${piecesPerCol} full pieces`);

        let sheetNum = 1;
        for (let row = 0; row < piecesPerCol; row++) {
            for (let col = 0; col < piecesPerRow; col++) {
                const pieceX = minX + (col * rollWidth * window.gridSize);
                const pieceY = minY + (row * rollWidth * window.gridSize);

                sheets.push({
                    x: pieceX,
                    y: pieceY,
                    width: rollWidth * window.gridSize,
                    height: rollWidth * window.gridSize,
                    type: 'piece',
                    sheetNumber: sheetNum++,
                    actualWidth: rollWidth,
                    actualLength: rollWidth
                });
            }
        }

        // Add edge pieces if needed
        if (roomWidth % rollWidth > 0.1) {
            // Right edge pieces
            const remainingWidth = roomWidth - (piecesPerRow * rollWidth);
            console.log(`Adding right edge pieces: ${remainingWidth.toFixed(2)}m wide`);

            for (let row = 0; row < piecesPerCol; row++) {
                const pieceX = minX + (piecesPerRow * rollWidth * window.gridSize);
                const pieceY = minY + (row * rollWidth * window.gridSize);
                const edgeWidth = (maxX - pieceX);

                sheets.push({
                    x: pieceX,
                    y: pieceY,
                    width: edgeWidth,
                    height: rollWidth * window.gridSize,
                    type: 'piece_edge',
                    sheetNumber: sheetNum++,
                    actualWidth: remainingWidth,
                    actualLength: rollWidth
                });
            }
        }

        if (roomLength % rollWidth > 0.1) {
            // Bottom edge pieces
            const remainingLength = roomLength - (piecesPerCol * rollWidth);
            console.log(`Adding bottom edge pieces: ${remainingLength.toFixed(2)}m long`);

            for (let col = 0; col < piecesPerRow; col++) {
                const pieceX = minX + (col * rollWidth * window.gridSize);
                const pieceY = minY + (piecesPerCol * rollWidth * window.gridSize);
                const edgeHeight = (maxY - pieceY);

                sheets.push({
                    x: pieceX,
                    y: pieceY,
                    width: rollWidth * window.gridSize,
                    height: edgeHeight,
                    type: 'piece_edge',
                    sheetNumber: sheetNum++,
                    actualWidth: rollWidth,
                    actualLength: remainingLength
                });
            }
        }

        // Corner piece if both dimensions have remainders
        if (roomWidth % rollWidth > 0.1 && roomLength % rollWidth > 0.1) {
            const cornerX = minX + (piecesPerRow * rollWidth * window.gridSize);
            const cornerY = minY + (piecesPerCol * rollWidth * window.gridSize);
            const remainingWidth = roomWidth - (piecesPerRow * rollWidth);
            const remainingLength = roomLength - (piecesPerCol * rollWidth);

            console.log(`Adding corner piece: ${remainingWidth.toFixed(2)}m × ${remainingLength.toFixed(2)}m`);

            sheets.push({
                x: cornerX,
                y: cornerY,
                width: maxX - cornerX,
                height: maxY - cornerY,
                type: 'piece_corner',
                sheetNumber: sheetNum++,
                actualWidth: remainingWidth,
                actualLength: remainingLength
            });
        }
    }

    console.log(`✅ Generated ${sheets.length} sheets for ${method} layout`);
    return sheets;
}

// Calculate number of cut lines for complexity estimation
function calculateCutLines(method, roomWidth, roomLength, rollWidth) {
    if (method === 'linear') {
        const horizontalRolls = Math.ceil(roomWidth / rollWidth);
        const verticalRolls = Math.ceil(roomLength / rollWidth);
        return Math.min(horizontalRolls - 1, verticalRolls - 1) + 2; // Seam lines + edge cuts
    } else {
        const piecesPerRow = Math.ceil(roomWidth / rollWidth);
        const piecesPerCol = Math.ceil(roomLength / rollWidth);
        return piecesPerRow * piecesPerCol * 4; // 4 cuts per piece
    }
}

// Event listener for basic vinyl calculation button
document.getElementById('calculateBtn').addEventListener('click', () => {
    calculateVinyl();
});

// Clear vinyl layout visualization
function clearVinylLayout() {
    window.vinylSheets = [];
    window.showVinylLayout = false;
    window.currentVinylLayout = null;

    document.getElementById('vinylLayoutControls').style.display = 'none';
    document.getElementById('advancedResults').style.display = 'none';

    drawObjects();
    showSuccessModal('Vinyl layout cleared.', true, 1500);
}

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
    const contextMenu = document.getElementById('contextMenu');
    const canvas = window.canvas;

    const isClickOutsideCanvas = !canvas.contains(e.target);
    const isClickOutsideContextMenu = !contextMenu.contains(e.target);

    if (contextMenu.style.display === 'block' && isClickOutsideContextMenu && e.button !== 2) {
        contextMenu.style.display = 'none';
        window.activeObjectForContextMenu = null;
        window.selectedObject = null;
        window.selectedObjectIndex = -1;
        drawObjects();
    }
    if (window.currentTool === 'select' && canvas.contains(e.target) && window.activeObjectForContextMenu === null) {
        window.selectedObject = null;
        window.selectedObjectIndex = -1;
        drawObjects();
    }
});

// Save and Load functionality
document.getElementById('saveBtn')?.addEventListener('click', () => {
    const floorPlanData = {
        objects: window.objects,
        voids: window.voids,
        gridSize: window.gridSize,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };

    const dataStr = JSON.stringify(floorPlanData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `floor-plan-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccessModal('Floor plan saved successfully!');
});

document.getElementById('loadBtn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const floorPlanData = JSON.parse(e.target.result);

                // Validate data structure
                if (!floorPlanData.objects || !Array.isArray(floorPlanData.objects)) {
                    throw new Error('Invalid floor plan file format');
                }

                // Load data
                window.objects = floorPlanData.objects || [];
                window.voids = floorPlanData.voids || [];
                if (floorPlanData.gridSize) {
                    window.gridSize = floorPlanData.gridSize;
                    document.getElementById('gridSize').value = window.gridSize;
                    window.defaultDoorWidthPx = 0.82 * window.gridSize;
                    window.defaultDoubleDoorWidthPx = 1.64 * window.gridSize;
                }

                // Clear selection
                window.selectedObject = null;
                window.selectedObjectIndex = -1;
                window.activeObjectForContextMenu = null;
                window.lastEndPoint = null;

                // Exit void creation mode if active
                if (window.isVoidCreationMode) cancelVoid();

                // Recalculate and redraw
                calculateFloorMeasurements();
                calculateVinyl();
                drawObjects();

                showSuccessModal('Floor plan loaded successfully!');

            } catch (error) {
                showErrorModal('Failed to load floor plan: ' + error.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Only handle shortcuts when not in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.key.toLowerCase()) {
        case 'w':
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toolButtons.wall.click();
            }
            break;
        case 'd':
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toolButtons.door.click();
            }
            break;
        case 'v':
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toolButtons.void.click();
            }
            break;
        case 's':
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toolButtons.select.click();
            }
            break;
        case 'g':
            if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                document.getElementById('toggleGridBtn').click();
            }
            break;
        case 'delete':
        case 'backspace':
            if (window.selectedObject || window.activeObjectForContextMenu) {
                e.preventDefault();
                document.getElementById('deleteBtn').click();
            }
            break;
        case 'escape':
            e.preventDefault();
            if (window.isVoidCreationMode) {
                cancelVoid();
            } else {
                // Clear selection
                window.selectedObject = null;
                window.selectedObjectIndex = -1;
                window.activeObjectForContextMenu = null;
                document.getElementById('contextMenu').style.display = 'none';
                drawObjects();
            }
            break;
        case 'enter':
            if (window.isVoidCreationMode && window.currentVoidPoints.length >= 3) {
                e.preventDefault();
                finishVoid();
            }
            break;
    }
});

// Window resize handler
window.addEventListener('resize', () => {
    drawObjects();
});

// Prevent context menu on canvas for our custom context menu
window.canvas.addEventListener('selectstart', (e) => {
    e.preventDefault();
});

// Touch events for mobile support (basic implementation)
let lastTouchTime = 0;
window.canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = window.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Simulate mouse down
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true
    });
    window.canvas.dispatchEvent(mouseEvent);
});

window.canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];

    // Simulate mouse move
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true
    });
    window.canvas.dispatchEvent(mouseEvent);
});

window.canvas.addEventListener('touchend', (e) => {
    e.preventDefault();

    // Handle double tap for void finishing
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTouchTime;
    if (tapLength < 500 && tapLength > 0) {
        // Double tap detected
        if (window.isVoidCreationMode && window.currentVoidPoints.length >= 3) {
            finishVoid();
            return;
        }
    }
    lastTouchTime = currentTime;

    // Simulate mouse up
    const mouseEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
    });
    window.canvas.dispatchEvent(mouseEvent);
});

// Utility functions for object manipulation
function duplicateObject(obj) {
    if (!obj) return null;

    const duplicate = JSON.parse(JSON.stringify(obj));

    // Offset the duplicate slightly
    const offset = 20; // pixels
    if (duplicate.type === 'void' && duplicate.points) {
        duplicate.points.forEach(point => {
            point.x += offset;
            point.y += offset;
        });
    } else if (duplicate.startX !== undefined) {
        duplicate.startX += offset;
        duplicate.startY += offset;
        duplicate.endX += offset;
        duplicate.endY += offset;
    }

    return duplicate;
}

function copySelectedObject() {
    if (window.selectedObject) {
        const duplicate = duplicateObject(window.selectedObject);
        if (duplicate) {
            if (duplicate.type === 'void') {
                window.voids.push(duplicate);
            } else {
                window.objects.push(duplicate);
            }
            calculateFloorMeasurements();
            calculateVinyl();
            drawObjects();
            showSuccessModal('Object duplicated!', true, 1000);
        }
    }
}

// Add copy shortcut
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            copySelectedObject();
        }
    }
});

// Performance optimization: throttle drawing during mouse move
let drawingThrottleTimeout = null;
function throttledDraw(...args) {
    if (drawingThrottleTimeout) return;

    drawingThrottleTimeout = setTimeout(() => {
        drawObjects(...args);
        drawingThrottleTimeout = null;
    }, 16); // ~60fps
}

// Error handling for development
window.addEventListener('error', (e) => {
    console.error('Floor Plan Creator Error:', e.error);
    showErrorModal('An error occurred. Please check the console for details.');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    // Clear any timeouts
    if (drawingThrottleTimeout) {
        clearTimeout(drawingThrottleTimeout);
    }
});

// Compare linear vs pieces layout options
function compareLinearVsPieces(floorArea, voids, rollDimensions) {
    const { rollWidth, rollLength } = rollDimensions;

    // Get room dimensions
    const walls = window.objects.filter(obj => obj.type === 'wall' || obj.type === 'voidEdge');
    if (walls.length === 0) {
        return {
            linear: { method: 'linear', error: 'No walls found' },
            pieces: { method: 'pieces', error: 'No walls found' },
            recommendation: 'none'
        };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    walls.forEach(wall => {
        minX = Math.min(minX, wall.startX, wall.endX);
        minY = Math.min(minY, wall.startY, wall.endY);
        maxX = Math.max(maxX, wall.startX, wall.endX);
        maxY = Math.max(maxY, wall.startY, wall.endY);
    });

    const roomWidth = (maxX - minX) / window.gridSize;
    const roomLength = (maxY - minY) / window.gridSize;

    // Calculate linear options
    const linearH = calculateLinearLayout(roomWidth, roomLength, rollWidth, 'horizontal');
    const linearV = calculateLinearLayout(roomWidth, roomLength, rollWidth, 'vertical');
    const bestLinear = linearH.waste < linearV.waste ? linearH : linearV;

    // Calculate pieces option
    const pieces = calculatePiecesLayout(floorArea, rollWidth, rollLength);

    // Determine recommendation
    let recommendation;
    if (bestLinear.efficiency > pieces.efficiency + 10) { // 10% threshold
        recommendation = 'linear';
    } else if (pieces.efficiency > bestLinear.efficiency + 5) {
        recommendation = 'pieces';
    } else {
        recommendation = 'linear'; // Default to linear for simplicity
    }

    return {
        linear: {
            method: 'linear',
            direction: bestLinear.layout.split('_')[1],
            rollsNeeded: bestLinear.rolls,
            rollLength: bestLinear.rollLength,
            materialArea: bestLinear.materialArea,
            waste: bestLinear.waste,
            efficiency: bestLinear.efficiency,
            cost: bestLinear.materialArea * 25, // Estimate: $25/m²
            complexity: 'low'
        },
        pieces: {
            method: 'pieces',
            piecesNeeded: pieces.rolls,
            materialArea: pieces.materialArea,
            waste: pieces.waste,
            efficiency: pieces.efficiency,
            cost: pieces.materialArea * 30, // Higher cost due to cutting complexity
            complexity: 'high'
        },
        recommendation
    };
}

// Calculate linear vinyl layout
function calculateLinearLayout(roomWidth, roomLength, rollWidth, direction) {
    let rollsNeeded, rollLengthNeeded, materialArea;

    if (direction === 'horizontal') {
        rollsNeeded = Math.ceil(roomWidth / rollWidth);
        rollLengthNeeded = Math.ceil(roomLength);
        materialArea = rollsNeeded * rollLengthNeeded * rollWidth;
    } else {
        rollsNeeded = Math.ceil(roomLength / rollWidth);
        rollLengthNeeded = Math.ceil(roomWidth);
        materialArea = rollsNeeded * rollLengthNeeded * rollWidth;
    }

    const actualArea = roomWidth * roomLength;
    const waste = materialArea - actualArea;
    const efficiency = (actualArea / materialArea) * 100;

    return {
        layout: `linear_${direction}`,
        rolls: rollsNeeded,
        rollLength: rollLengthNeeded,
        materialArea,
        actualArea,
        waste,
        efficiency,
        pieces: [{
            width: direction === 'horizontal' ? roomWidth : roomLength,
            length: direction === 'horizontal' ? roomLength : roomWidth,
            rolls: rollsNeeded
        }]
    };
}

// Calculate pieces vinyl layout
function calculatePiecesLayout(area, rollWidth, rollLength) {
    // Simplified pieces calculation
    const rolls = Math.ceil(area / (rollWidth * rollLength));
    const materialArea = rolls * rollWidth * rollLength;
    const waste = materialArea - area;
    const efficiency = (area / materialArea) * 100;

    return {
        layout: 'pieces',
        rolls,
        materialArea,
        actualArea: area,
        waste,
        efficiency,
        pieces: []
    };
}

// Fallback functions if other files don't load
if (typeof snapToGrid === 'undefined') {
    window.snapToGrid = function(point, gridSize, showGrid) {
        return showGrid ? {
            x: Math.round(point.x / gridSize) * gridSize,
            y: Math.round(point.y / gridSize) * gridSize
        } : point;
    };
}

if (typeof calculateDistance === 'undefined') {
    window.calculateDistance = function(p1, p2, gridSize) {
        const pixelDistance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        return pixelDistance / gridSize;
    };
}

if (typeof calculateAngle === 'undefined') {
    window.calculateAngle = function(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    };
}

if (typeof pointToLineDistance === 'undefined') {
    window.pointToLineDistance = function(point, lineStart, lineEnd, gridSize) {
        const L2 = Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2);
        if (L2 === 0) return calculateDistance(point, lineStart, gridSize);
        const t = ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) + (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / L2;
        const projection = {
            x: lineStart.x + t * (lineEnd.x - lineStart.x),
            y: lineStart.y + t * (lineEnd.y - lineStart.y)
        };
        if (t < 0) return calculateDistance(point, lineStart, gridSize);
        if (t > 1) return calculateDistance(point, lineEnd, gridSize);
        return calculateDistance(point, projection, gridSize);
    };
}

if (typeof pointInPolygon === 'undefined') {
    window.pointInPolygon = function(point, polygon) {
        if (!polygon || polygon.length < 3) return false;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
                (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    };
}

if (typeof calculateFloorMeasurements === 'undefined') {
    window.calculateFloorMeasurements = function() {
        document.getElementById('totalArea').textContent = '0 m²';
        document.getElementById('perimeter').textContent = '0 m';
        document.getElementById('totalCovingLength').textContent = '0 m';
        if (document.getElementById('voidAreas')) {
            document.getElementById('voidAreas').textContent = '0';
            document.getElementById('totalVoidArea').textContent = '0 m²';
        }
    };
}

if (typeof calculateVinyl === 'undefined') {
    window.calculateVinyl = function() {
        document.getElementById('vinylNeeded').textContent = '0 m²';
        document.getElementById('rollsRequired').textContent = '0';
        document.getElementById('wasteAmount').textContent = '0 m²';
        document.getElementById('wastePercentage').textContent = '0%';
        if (document.getElementById('doorEdgeAdditions')) {
            document.getElementById('doorEdgeAdditions').textContent = '0 m';
        }
    };
}

if (typeof showCustomAlert === 'undefined') {
    window.showCustomAlert = function(message) {
        alert(message);
        return Promise.resolve(true);
    };
}

if (typeof showCustomConfirm === 'undefined') {
    window.showCustomConfirm = function(message) {
        return Promise.resolve(confirm(message));
    };
}

if (typeof showSuccessModal === 'undefined') {
    window.showSuccessModal = function(message, autoHide = true, duration = 2000) {
        console.log('✅ ' + message);
    };
}

if (typeof showErrorModal === 'undefined') {
    window.showErrorModal = function(message, autoHide = false, duration = 3000) {
        console.error('❌ ' + message);
    };
}

if (typeof drawObjects === 'undefined') {
    window.drawObjects = function(previewStartPoint = null, previewEndPoint = null) {
        if (!window.ctx) return;

        // Clear canvas
        window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);

        // Draw grid
        if (window.showGrid) {
            window.ctx.strokeStyle = '#ddd';
            window.ctx.lineWidth = 0.5;
            for (let x = 0; x <= window.canvas.width; x += window.gridSize) {
                window.ctx.beginPath();
                window.ctx.moveTo(x, 0);
                window.ctx.lineTo(x, window.canvas.height);
                window.ctx.stroke();
            }
            for (let y = 0; y <= window.canvas.height; y += window.gridSize) {
                window.ctx.beginPath();
                window.ctx.moveTo(0, y);
                window.ctx.lineTo(window.canvas.width, y);
                window.ctx.stroke();
            }
        }

        // Draw all objects
        window.objects.forEach(obj => {
            const isSelected = window.selectedObject === obj;

            switch (obj.type) {
                case 'wall':
                case 'voidEdge':
                    window.ctx.beginPath();
                    window.ctx.lineWidth = obj.type === 'voidEdge' ? 3 : 2;
                    window.ctx.strokeStyle = isSelected ? '#4CAF50' : (obj.type === 'voidEdge' ? '#FF4444' : '#333');
                    window.ctx.moveTo(obj.startX, obj.startY);
                    window.ctx.lineTo(obj.endX, obj.endY);
                    window.ctx.stroke();
                    break;

                case 'door':
                    window.ctx.beginPath();
                    window.ctx.lineWidth = 2;
                    window.ctx.strokeStyle = isSelected ? '#4CAF50' : '#FF9800';
                    window.ctx.moveTo(obj.startX, obj.startY);
                    window.ctx.lineTo(obj.endX, obj.endY);
                    window.ctx.stroke();

                    const doorLength = Math.sqrt(Math.pow(obj.endX - obj.startX, 2) + Math.pow(obj.endY - obj.startY, 2));
                    const doorAngle = Math.atan2(obj.endY - obj.startY, obj.endX - obj.startX);
                    window.ctx.beginPath();
                    window.ctx.arc(obj.startX, obj.startY, doorLength, doorAngle, doorAngle + Math.PI / 2);
                    window.ctx.stroke();
                    break;

                case 'doubleDoor':
                    window.ctx.beginPath();
                    window.ctx.lineWidth = 2;
                    window.ctx.strokeStyle = isSelected ? '#4CAF50' : '#9C27B0';
                    window.ctx.moveTo(obj.startX, obj.startY);
                    window.ctx.lineTo(obj.endX, obj.endY);
                    window.ctx.stroke();

                    const doubleDoorLength = Math.sqrt(Math.pow(obj.endX - obj.startX, 2) + Math.pow(obj.endY - obj.startY, 2));
                    const doubleDoorAngle = Math.atan2(obj.endY - obj.startY, obj.endX - obj.startX);
                    const halfLength = doubleDoorLength / 2;

                    window.ctx.beginPath();
                    window.ctx.arc(obj.startX, obj.startY, halfLength, doubleDoorAngle, doubleDoorAngle + Math.PI / 2);
                    window.ctx.stroke();

                    window.ctx.beginPath();
                    window.ctx.arc(obj.endX, obj.endY, halfLength, doubleDoorAngle + Math.PI, doubleDoorAngle + Math.PI - Math.PI / 2, true);
                    window.ctx.stroke();
                    break;

                case 'window':
                case 'slidingDoor':
                    window.ctx.beginPath();
                    window.ctx.lineWidth = 6;
                    window.ctx.strokeStyle = isSelected ? '#4CAF50' : (obj.type === 'window' ? '#2196F3' : '#9C27B0');
                    window.ctx.moveTo(obj.startX, obj.startY);
                    window.ctx.lineTo(obj.endX, obj.endY);
                    window.ctx.stroke();
                    break;
            }

            // Draw measurements
            const midX = (obj.startX + obj.endX) / 2;
            const midY = (obj.startY + obj.endY) / 2;
            const distance = Math.sqrt(Math.pow(obj.endX - obj.startX, 2) + Math.pow(obj.endY - obj.startY, 2)) / window.gridSize;
            const angle = Math.atan2(obj.endY - obj.startY, obj.endX - obj.startX) * 180 / Math.PI;

            window.ctx.font = '12px Arial';
            window.ctx.fillStyle = '#333';
            window.ctx.textAlign = 'center';
            window.ctx.fillText(`${distance.toFixed(2)}m, ${angle.toFixed(1)}°`, midX, midY - 5);
        });

        // Draw current void being created
        if (window.isVoidCreationMode && window.currentVoidPoints.length > 0) {
            window.ctx.strokeStyle = '#FF0000';
            window.ctx.lineWidth = 2;
            window.ctx.setLineDash([5, 5]);

            for (let i = 0; i < window.currentVoidPoints.length - 1; i++) {
                window.ctx.beginPath();
                window.ctx.moveTo(window.currentVoidPoints[i].x, window.currentVoidPoints[i].y);
                window.ctx.lineTo(window.currentVoidPoints[i + 1].x, window.currentVoidPoints[i + 1].y);
                window.ctx.stroke();
            }

            if (window.currentVoidPoints.length >= 3) {
                window.ctx.strokeStyle = '#FFFF00';
                window.ctx.beginPath();
                const last = window.currentVoidPoints[window.currentVoidPoints.length - 1];
                const first = window.currentVoidPoints[0];
                window.ctx.moveTo(last.x, last.y);
                window.ctx.lineTo(first.x, first.y);
                window.ctx.stroke();
            }

            window.ctx.setLineDash([]);

            window.currentVoidPoints.forEach((point, index) => {
                window.ctx.fillStyle = '#FF0000';
                window.ctx.beginPath();
                window.ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
                window.ctx.fill();

                window.ctx.fillStyle = 'white';
                window.ctx.font = '10px Arial';
                window.ctx.textAlign = 'center';
                window.ctx.fillText(index + 1, point.x, point.y + 3);
            });
        }

        // Draw preview line
        if (previewStartPoint && previewEndPoint && !window.isVoidCreationMode) {
            window.ctx.beginPath();
            window.ctx.strokeStyle = '#999';
            window.ctx.lineWidth = 2;
            window.ctx.setLineDash([5, 5]);
            window.ctx.moveTo(previewStartPoint.x, previewStartPoint.y);
            window.ctx.lineTo(previewEndPoint.x, previewEndPoint.y);
            window.ctx.stroke();
            window.ctx.setLineDash([]);
        }

        // Draw vinyl layout if active
        if (window.showVinylLayout && window.vinylSheets && window.vinylSheets.length > 0) {
            window.vinylSheets.forEach((sheet, index) => {
                window.ctx.fillStyle = sheet.type.includes('linear') ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 152, 0, 0.3)';
                window.ctx.strokeStyle = sheet.type.includes('linear') ? '#2196F3' : '#FF9800';
                window.ctx.lineWidth = 2;

                window.ctx.fillRect(sheet.x, sheet.y, sheet.width, sheet.height);
                window.ctx.strokeRect(sheet.x, sheet.y, sheet.width, sheet.height);

                const centerX = sheet.x + sheet.width / 2;
                const centerY = sheet.y + sheet.height / 2;

                window.ctx.font = 'bold 16px Arial';
                window.ctx.fillStyle = 'white';
                window.ctx.strokeStyle = 'black';
                window.ctx.lineWidth = 3;
                window.ctx.textAlign = 'center';

                const sheetText = `#${sheet.sheetNumber}`;
                window.ctx.strokeText(sheetText, centerX, centerY - 10);
                window.ctx.fillText(sheetText, centerX, centerY - 10);

                window.ctx.font = '12px Arial';
                const dimText = `${sheet.actualWidth.toFixed(2)}m × ${sheet.actualLength.toFixed(2)}m`;
                window.ctx.strokeText(dimText, centerX, centerY + 8);
                window.ctx.fillText(dimText, centerX, centerY + 8);
            });
        }
    };
}

// Initialize the application
function initializeApp() {
    try {
        // Verify all required elements exist
        const requiredElements = [
            'floorPlan', 'totalArea', 'perimeter', 'totalCovingLength',
            'vinylNeeded', 'rollsRequired', 'wasteAmount', 'wastePercentage'
        ];

        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                throw new Error(`Required element with id '${id}' not found`);
            }
        }

        // Set initial calculations
        calculateFloorMeasurements();
        calculateVinyl();

        // Draw initial state (will be called again when images load)
        drawObjects();

        console.log('Floor Plan Creator initialized successfully');

    } catch (error) {
        console.error('Failed to initialize Floor Plan Creator:', error);
        showErrorModal('Failed to initialize application: ' + error.message);
    }
}

// Initial setup on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// Call initialization immediately as well
initializeApp();

console.log('🎉 MAIN.JS COMPLETELY FINISHED!');

// Draw vinyl layout if active (this was cut off in Part 2)
       if (window.showVinylLayout && window.vinylSheets && window.vinylSheets.length > 0) {
           window.vinylSheets.forEach((sheet, index) => {
               window.ctx.fillStyle = sheet.type.includes('linear') ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 152, 0, 0.3)';
               window.ctx.strokeStyle = sheet.type.includes('linear') ? '#2196F3' : '#FF9800';
               window.ctx.lineWidth = 2;

               window.ctx.fillRect(sheet.x, sheet.y, sheet.width, sheet.height);
               window.ctx.strokeRect(sheet.x, sheet.y, sheet.width, sheet.height);

               const centerX = sheet.x + sheet.width / 2;
               const centerY = sheet.y + sheet.height / 2;

               window.ctx.font = 'bold 16px Arial';
               window.ctx.fillStyle = 'white';
               window.ctx.strokeStyle = 'black';
               window.ctx.lineWidth = 3;
               window.ctx.textAlign = 'center';

               const sheetText = `#${sheet.sheetNumber}`;
               window.ctx.strokeText(sheetText, centerX, centerY - 10);
               window.ctx.fillText(sheetText, centerX, centerY - 10);

               window.ctx.font = '12px Arial';
               const dimText = `${sheet.actualWidth.toFixed(2)}m × ${sheet.actualLength.toFixed(2)}m`;
               window.ctx.strokeText(dimText, centerX, centerY + 8);
               window.ctx.fillText(dimText, centerX, centerY + 8);
           });

           // Draw layout info overlay
           const layoutInfo = document.getElementById('optimalMethod').textContent;
           const efficiency = document.getElementById('layoutEfficiency').textContent;

           window.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
           window.ctx.fillRect(10, 10, 250, 60);

           window.ctx.font = 'bold 14px Arial';
           window.ctx.fillStyle = 'white';
           window.ctx.textAlign = 'left';
           window.ctx.fillText(`🚀 ${layoutInfo} Layout Active`, 20, 30);
           window.ctx.font = '12px Arial';
           window.ctx.fillText(`Efficiency: ${efficiency}`, 20, 45);
           window.ctx.fillText(`Sheets: ${window.vinylSheets.length}`, 20, 60);
       }
   };
}

// Final initialization and startup checks
function finalStartup() {
   // Ensure canvas and context are available
   if (!window.canvas) {
       console.error('❌ Canvas element not found!');
       return false;
   }

   if (!window.ctx) {
       console.error('❌ Canvas context not available!');
       return false;
   }

   // Set wall tool as active by default
   const wallBtn = document.getElementById('wallBtn');
   if (wallBtn) {
       wallBtn.classList.add('active');
       console.log('✅ Wall tool activated');
   }

   // Initialize drawing state
   window.currentTool = 'wall';
   window.isDrawing = false;
   window.objects = window.objects || [];
   window.voids = window.voids || [];

   // Draw initial grid and setup
   drawObjects();

   console.log('✅ Final startup complete');
   console.log('📊 Current state:', {
       tool: window.currentTool,
       objects: window.objects.length,
       voids: window.voids.length,
       gridSize: window.gridSize,
       showGrid: window.showGrid
   });

   return true;
}

// Enhanced error recovery
function recoverFromErrors() {
   try {
       // Reset drawing state if corrupted
       if (typeof window.isDrawing !== 'boolean') {
           window.isDrawing = false;
       }

       // Ensure arrays exist
       if (!Array.isArray(window.objects)) {
           window.objects = [];
       }

       if (!Array.isArray(window.voids)) {
           window.voids = [];
       }

       // Reset tool if invalid
       const validTools = ['wall', 'door', 'doubleDoor', 'window', 'slidingDoor', 'void', 'select'];
       if (!validTools.includes(window.currentTool)) {
           window.currentTool = 'wall';
       }

       console.log('🔧 Error recovery completed');
       return true;

   } catch (error) {
       console.error('❌ Error recovery failed:', error);
       return false;
   }
}

// Performance monitoring
function monitorPerformance() {
   let drawCount = 0;
   let lastDrawTime = performance.now();

   const originalDrawObjects = window.drawObjects;
   window.drawObjects = function(...args) {
       const start = performance.now();
       originalDrawObjects.apply(this, args);
       const end = performance.now();

       drawCount++;
       if (drawCount % 60 === 0) { // Log every 60 draws
           const fps = 1000 / (end - lastDrawTime);
           console.log(`🎯 Drawing performance: ${fps.toFixed(1)} FPS, ${(end - start).toFixed(2)}ms per frame`);
       }
       lastDrawTime = end;
   };
}

// Advanced debugging helpers
function debugFloorPlan() {
   console.log('🔍 Floor Plan Debug Info:');
   console.log('📐 Canvas:', window.canvas.width, 'x', window.canvas.height);
   console.log('🔧 Grid Size:', window.gridSize, 'px = 1m');
   console.log('🏗️ Objects:', window.objects.length);
   console.log('⚫ Voids:', window.voids.length);
   console.log('🎯 Current Tool:', window.currentTool);
   console.log('✏️ Drawing State:', window.isDrawing);
   console.log('📱 Vinyl Layout:', window.showVinylLayout ? 'Active' : 'Inactive');

   if (window.objects.length > 0) {
       console.log('📋 Object Summary:');
       const summary = {};
       window.objects.forEach(obj => {
           summary[obj.type] = (summary[obj.type] || 0) + 1;
       });
       console.table(summary);
   }

   if (window.vinylSheets && window.vinylSheets.length > 0) {
       console.log('📦 Vinyl Sheets:', window.vinylSheets.length);
       console.log('🎨 Layout Type:', window.currentVinylLayout);
   }
}

// Expose debug function globally
window.debugFloorPlan = debugFloorPlan;

// Final setup and validation
function completeSetup() {
   // Enable performance monitoring in development
   if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
       monitorPerformance();
       console.log('🚀 Development mode: Performance monitoring enabled');
       console.log('💡 Use debugFloorPlan() in console for detailed info');
   }

   // Validate all required functions exist
   const requiredFunctions = [
       'drawObjects', 'calculateFloorMeasurements', 'calculateVinyl',
       'snapToGrid', 'calculateDistance', 'calculateAngle',
       'pointToLineDistance', 'pointInPolygon'
   ];

   const missingFunctions = requiredFunctions.filter(func => typeof window[func] !== 'function');
   if (missingFunctions.length > 0) {
       console.warn('⚠️ Missing functions:', missingFunctions);
   } else {
       console.log('✅ All required functions available');
   }

   // Final validation
   if (finalStartup() && recoverFromErrors()) {
       console.log('🎉 FLOOR PLAN CREATOR FULLY OPERATIONAL!');
       console.log('📝 Instructions:');
       console.log('   • Click and drag to draw walls');
       console.log('   • Use tool buttons to switch modes');
       console.log('   • Press "📐 Lay Vinyl" for advanced layout');
       console.log('   • Right-click objects for context menu');
       console.log('   • Use keyboard shortcuts: W=Wall, D=Door, S=Select, G=Grid');

       // Show ready state in the UI if possible
       const readyIndicator = document.createElement('div');
       readyIndicator.style.cssText = `
           position: fixed; top: 10px; right: 10px;
           background: #4CAF50; color: white;
           padding: 8px 12px; border-radius: 4px;
           font-size: 12px; z-index: 1000;
           box-shadow: 0 2px 4px rgba(0,0,0,0.2);
       `;
       readyIndicator.textContent = '✅ Floor Plan Ready';
       document.body.appendChild(readyIndicator);

       // Remove indicator after 3 seconds
       setTimeout(() => {
           if (readyIndicator.parentNode) {
               readyIndicator.parentNode.removeChild(readyIndicator);
           }
       }, 3000);

       return true;
   } else {
       console.error('❌ SETUP FAILED - Please check console for errors');
       return false;
   }
}

// Multiple initialization attempts for reliability
let initAttempts = 0;
const maxInitAttempts = 3;

function attemptInitialization() {
   initAttempts++;
   console.log(`🔄 Initialization attempt ${initAttempts}/${maxInitAttempts}`);

   if (completeSetup()) {
       console.log('✅ Initialization successful!');
       return;
   }

   if (initAttempts < maxInitAttempts) {
       console.log(`⏳ Retrying in 1 second...`);
       setTimeout(attemptInitialization, 1000);
   } else {
       console.error('❌ All initialization attempts failed');
       alert('Floor Plan Creator failed to initialize. Please refresh the page.');
   }
}

// Start the initialization process
if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', attemptInitialization);
} else {
   // DOM already loaded
   setTimeout(attemptInitialization, 100);
}

// Backup initialization for edge cases
setTimeout(() => {
   if (!window.canvas || !window.ctx) {
       console.warn('🔧 Backup initialization triggered');
       attemptInitialization();
   }
}, 2000);

// Global error handler for unhandled issues
window.addEventListener('unhandledrejection', (event) => {
   console.error('🚨 Unhandled Promise Rejection:', event.reason);
   event.preventDefault(); // Prevent console spam
});

// Final status
console.log('🏁 MAIN.JS PART 3 COMPLETE - FLOOR PLAN CREATOR READY!');
console.log('📚 Total code parts: 3');
console.log('🎯 Features: Wall drawing, vinyl layout, void creation, context menus, save/load');
console.log('🚀 Phase II vinyl system: Linear vs Pieces optimization with visual sheets');

// Export version info for debugging
window.FLOOR_PLAN_VERSION = {
   version: '2.0.0',
   parts: 3,
   features: ['walls', 'doors', 'windows', 'voids', 'vinyl-layout', 'save-load'],
   buildDate: new Date().toISOString(),
   status: 'complete'
};

console.log('📦 Version:', window.FLOOR_PLAN_VERSION);
