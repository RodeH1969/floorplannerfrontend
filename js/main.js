// js/main.js

// Global State Variables (accessed by all modules and the main class)
window.canvas = document.getElementById('floorPlan');
window.ctx = window.canvas.getContext('2d');
window.snapIndicator = document.getElementById('snapIndicator');
window.rollVisualizationCanvas = document.getElementById('rollVisualizationCanvas');
window.rollVisualizationCtx = window.rollVisualizationCanvas.getContext('2d');

let floorPlanner; // Declare floorPlanner globally

// Placeholder/Initialization for External Functions
window.snapToGrid = window.snapToGrid || function(point, gridSize, showGrid) { return point; };
window.calculateDistance = window.calculateDistance || function(p1, p2, gridSize) { return 0; };
window.calculateAngle = window.calculateAngle || function(p1, p2) { return 0; };
window.pointToLineDistance = window.pointToLineDistance || function(point, lineStart, lineEnd, gridSize) { return 0; };
window.pointInPolygon = window.pointInPolygon || function(x, y, points) { return false; };
window.calculatePolygonArea = window.calculatePolygonArea || function(points) { return 0; };
window.calculatePolygonPerimeter = window.calculatePolygonPerimeter || function(points, gridSize) { return 0; };
window.getPolygonBounds = window.getPolygonBounds || function(points) { return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }; };
window.lineIntersection = window.lineIntersection || function(p1, p2, p3, p4) { return null; };

window.drawGrid = window.drawGrid || function(ctx, canvasWidth, canvasHeight, gridSize) { /* Placeholder */ };
window.drawObjects = window.drawObjects || function() { /* Placeholder */ };

window.calculateFloorMeasurements = window.calculateFloorMeasurements || function() { /* Placeholder */ };
window.calculateVinyl = window.calculateVinyl || function(polygons, objects, vinylWidth, direction, gridSize) {
    console.log('calculateVinyl called with polygons:', polygons, 'objects:', objects, 'vinylWidth:', vinylWidth, 'direction:', direction, 'gridSize:', gridSize);
    // Placeholder return to simulate data for testing
    return {
        polygonLayouts: [{ polygonId: polygons[0]?.id || 'testId', strips: [{ height: 200, width: 100, area: 20, originalPolygonPoints: [] }] }],
        totalMaterialArea: 20,
        waste: 5,
        efficiency: 80
    };
};
window.calculateStripsForPolygon = window.calculateStripsForPolygon || function() { return []; };
window.createPolygonFromWalls = window.createPolygonFromWalls || function(walls) { return [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]; };
window.orderWallsIntoPolygon = window.orderWallsIntoPolygon || function() { return []; };
window.processVoidCoving = window.processVoidCoving || function() { return []; };
window.clipPolygonToRect = window.clipPolygonToRect || function() { return []; };
window.clipPolygonToRectAndSubtractVoids = window.clipPolygonToRectAndSubtractVoids || function() { return []; };
window.getPolygonCentroid = window.getPolygonCentroid || function() { return {x:0, y:0}; };
window.groupVoidEdges = window.groupVoidEdges || function() { return []; };
window.expandPolygonForCoving = window.expandPolygonForCoving || function() { return []; };
window.calculateCovingExpansion = window.calculateCovingExpansion || function() { return {}; };
window.offsetPolygon = window.offsetPolygon || function() { return []; };

window.showCustomAlert = window.showCustomAlert || function(message) { alert(message); return Promise.resolve(true); };
window.showCustomConfirm = window.showCustomConfirm || function(message) { return Promise.resolve(confirm(message)); };
window.showSuccessModal = window.showSuccessModal || function(message) { console.log("Success: " + message); };
window.showErrorModal = window.showErrorModal || function(message) { console.error("Error: " + message); };

window.sortAndLayoutLinear = window.sortAndLayoutLinear || function(pieces, rollLength, vinylWidth) {
    console.log('sortAndLayoutLinear called with pieces:', pieces, 'rollLength:', rollLength, 'vinylWidth:', vinylWidth);
    // Placeholder return to simulate roll data
    return [{ rollNumber: 1, pieces: [{ name: 'P1_S1', lengthM: 2.0, widthM: 1.0, area: 2.0, offsetX_onRollM: 0, offsetY_onRollM: 0 }] }];
};

class EnhancedFloorPlanner {
    constructor() {
        this.canvas = window.canvas;
        this.ctx = window.ctx;
        this.snapIndicator = document.getElementById('snapIndicator');
        this.rollVisualizationCanvas = document.getElementById('rollVisualizationCanvas');
        this.rollVisualizationCtx = this.rollVisualizationCanvas.getContext('2d');

        this.currentTool = 'wall';
        this.isDrawing = false;
        this.startPoint = null;
        this.endPoint = null;
        this.objects = [];
        this.voids = [];
        this.polygons = [];
        this.selectedObject = null;
        this.activeObjectForContextMenu = null;

        this.vinylLayouts = { horizontal: null, vertical: null };
        this.currentVinylView = null;
        this.currentRollLayoutView = null;
        this.showVinylLayoutOverlay = false;

        this.snapPoints = [];
        this.currentSnapPoint = null;

        this.gridSize = 100;
        this.showGrid = true;
        this.snapDistance = 8;
        this.wallThickness = 0.07;
        this.vinylWidth = 2.0;
        this.vinylRollLength = 25.0;

        this.defaultDoorWidthPx = 0.82 * this.gridSize;
        this.defaultDoubleDoorWidthPx = 1.64 * this.gridSize;
        this.defaultComponentHeightPx = 20;

        this.windowImage = new Image();
        this.slidingDoorImage = new Image();
        let imagesLoaded = 0;
        const totalImagesToLoad = 2;

        const imageLoadedCallback = () => {
            imagesLoaded++;
            if (imagesLoaded === totalImagesToLoad) {
                this.draw();
            }
        };

        this.windowImage.onload = imageLoadedCallback;
        this.slidingDoorImage.onload = imageLoadedCallback;
        this.windowImage.onerror = () => {
            console.error("Failed to load 'library/window.png'. Using placeholder.");
            this.windowImage.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='20'%3E%3Crect width='100' height='20' fill='%232196F3'/%3E%3Ctext x='50' y='15' text-anchor='middle' fill='white' font-size='10'%3EWINDOW%3C/text%3E%3C/svg%3E`;
            imageLoadedCallback();
        };
        this.slidingDoorImage.onerror = () => {
            console.error("Failed to load 'library/sliding_door.png'. Using placeholder.");
            this.slidingDoorImage.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='20'%3E%3Crect width='100' height='20' fill='%239C27B0'/%3E%3Ctext x='50' y='15' text-anchor='middle' fill='white' font-size='8'%3ESLIDING%3C/text%3E%3C/svg%3E`;
            imageLoadedCallback();
        };

        this.windowImage.src = "library/window.png";
        this.slidingDoorImage.src = "library/sliding_door.png";

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateScaleInfo();
        this.updateSnapPoints();
        this.draw();
        this.updateMeasurements();
        document.getElementById('wallBtn').classList.add('active');
    }

    static INSIDE = 0;
    static LEFT = 1;
    static RIGHT = 2;
    static BOTTOM = 4;
    static TOP = 8;

    _getRegionCode(x, y, xmin, ymin, xmax, ymax) {
        let code = EnhancedFloorPlanner.INSIDE;
        if (x < xmin) code |= EnhancedFloorPlanner.LEFT;
        else if (x > xmax) code |= EnhancedFloorPlanner.RIGHT;
        if (y < ymin) code |= EnhancedFloorPlanner.BOTTOM;
        else if (y > ymax) code |= EnhancedFloorPlanner.TOP;
        return code;
    }

    clipLineSegmentWithRect(p1, p2, rect) {
        const { x: xmin, y: ymin, width, height } = rect;
        const xmax = xmin + width;
        const ymax = ymin + height;

        let x1 = p1.x, y1 = p1.y;
        let x2 = p2.x, y2 = p2.y;

        let code1 = this._getRegionCode(x1, y1, xmin, ymin, xmax, ymax);
        let code2 = this._getRegionCode(x2, y2, xmin, ymin, xmax, ymax);

        let accept = false;

        while (true) {
            if ((code1 === 0) && (code2 === 0)) {
                accept = true;
                break;
            } else if ((code1 & code2) !== 0) {
                break;
            } else {
                let x, y;
                const outcode = code1 !== 0 ? code1 : code2;

                if (outcode & EnhancedFloorPlanner.TOP) {
                    x = x1 + (x2 - x1) * (ymax - y1) / (y2 - y1);
                    y = ymax;
                } else if (outcode & EnhancedFloorPlanner.BOTTOM) {
                    x = x1 + (x2 - x1) * (ymin - y1) / (y2 - y1);
                    y = ymin;
                } else if (outcode & EnhancedFloorPlanner.RIGHT) {
                    y = y1 + (y2 - y1) * (xmax - x1) / (x2 - x1);
                    x = xmax;
                } else if (outcode & EnhancedFloorPlanner.LEFT) {
                    y = y1 + (y2 - y1) * (xmin - x1) / (x2 - x1);
                    x = xmin;
                }

                if (outcode === code1) {
                    x1 = x; y1 = y;
                    code1 = this._getRegionCode(x1, y1, xmin, ymin, xmax, ymax);
                } else {
                    x2 = x; y2 = y;
                    code2 = this._getRegionCode(x2, y2, xmin, ymin, xmax, ymax);
                }
            }
        }

        if (accept) {
            return { p1_clip: { x: x1, y: y1 }, p2_clip: { x: x2, y: y2 } };
        }
        return null;
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));

        document.getElementById('wallBtn').addEventListener('click', () => this.setTool('wall'));
        document.getElementById('doorBtn').addEventListener('click', () => this.setTool('door'));
        document.getElementById('windowBtn').addEventListener('click', () => this.setTool('window'));
        document.getElementById('selectBtn').addEventListener('click', () => this.setTool('select'));

        document.getElementById('deleteBtn').addEventListener('click', this.deleteSelected.bind(this));
        document.getElementById('clearBtn').addEventListener('click', this.clearAll.bind(this));
        document.getElementById('toggleGridBtn').addEventListener('click', this.toggleGrid.bind(this));

        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) {
            contextMenu.addEventListener('click', (e) => { e.stopPropagation(); });
            document.getElementById('ctxDeleteBtn').addEventListener('click', () => {
                this.deleteSelected();
                contextMenu.style.display = 'none';
            });
            document.getElementById('ctxUpdateLengthAngleBtn').addEventListener('click', this.updateLengthAngle.bind(this));
            document.getElementById('ctxAddCovingBtn').addEventListener('click', this.toggleCoving.bind(this));
            document.getElementById('ctxRotateByInputBtn').addEventListener('click', this.rotateObjectByInput.bind(this));
            document.getElementById('ctxRotate45Btn').addEventListener('click', () => this.rotateObject(45));
        }

        document.getElementById('calculateVinylBtn').addEventListener('click', this.calculateVinyl.bind(this));
        document.getElementById('showHorizontalBtn').addEventListener('click', () => {
            this.showVinylLayoutOverlay = true;
            this.currentVinylView = 'horizontal';
            this.draw();
            this.visualizeRollLayout('horizontal');
        });
        document.getElementById('showVerticalBtn').addEventListener('click', () => {
            this.showVinylLayoutOverlay = true;
            this.currentVinylView = 'vertical';
            this.draw();
            this.visualizeRollLayout('vertical');
        });

        document.getElementById('gridSize').addEventListener('change', this.updateGridSize.bind(this));
        document.getElementById('vinylWidth').addEventListener('change', this.updateVinylWidth.bind(this));

        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('contextmenu', this.onContextMenu.bind(this));

        document.getElementById('saveBtn').addEventListener('click', this.save.bind(this));
        document.getElementById('loadBtn').addEventListener('click', this.load.bind(this));

        document.addEventListener('click', (e) => {
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu && contextMenu.style.display === 'block' && !contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
                this.activeObjectForContextMenu = null;
                this.selectedObject = null;
                this.draw();
            }
        });
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.startPoint = window.snapToGrid({ x, y }, this.gridSize, this.showGrid);
        this.isDrawing = true;

        if (this.currentTool === 'select') {
            this.selectObjectAt(x, y);
        } else if (this.currentTool === 'wall' || this.currentTool === 'door' || this.currentTool === 'window') {
            this.objects.push({
                type: this.currentTool,
                startX: this.startPoint.x,
                startY: this.startPoint.y,
                endX: this.startPoint.x,
                endY: this.startPoint.y,
                coving: false,
                covingAmount: 0
            });
        }
        this.draw();
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.endPoint = window.snapToGrid({ x, y }, this.gridSize, this.showGrid);

        if (this.isDrawing && this.startPoint) {
            if (this.objects.length > 0) {
                const currentObj = this.objects[this.objects.length - 1];
                currentObj.endX = this.endPoint.x;
                currentObj.endY = this.endPoint.y;
            }
            this.draw();
        }

        // Update snap indicator
        const closestSnap = this.snapPoints.reduce((closest, point) => {
            const dist = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
            return dist < this.snapDistance && (!closest || dist < closest.dist) ? { point, dist } : closest;
        }, null);

        if (closestSnap) {
            this.currentSnapPoint = closestSnap.point;
            this.snapIndicator.style.left = (this.currentSnapPoint.x - 5) + 'px';
            this.snapIndicator.style.top = (this.currentSnapPoint.y - 5) + 'px';
            this.snapIndicator.style.display = 'block';
        } else {
            this.snapIndicator.style.display = 'none';
        }
    }

    onMouseUp(e) {
        if (this.isDrawing && this.startPoint && this.endPoint) {
            const currentObj = this.objects[this.objects.length - 1];
            currentObj.endX = this.endPoint.x;
            currentObj.endY = this.endPoint.y;

            if (this.currentTool === 'wall') {
                this.checkForPolygonFormation();
            }
            this.isDrawing = false;
            this.updateMeasurements();
        }
        this.draw();
    }

    onContextMenu(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.selectedObject = null;
        this.activeObjectForContextMenu = null;
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) contextMenu.style.display = 'none';

        if (e.target === this.canvas) {
            for (let i = this.polygons.length - 1; i >= 0; i--) {
                if (window.pointInPolygon(mouseX, mouseY, this.polygons[i].points)) {
                    this.selectedObject = this.polygons[i];
                    this.activeObjectForContextMenu = this.polygons[i];
                    break;
                }
            }
            if (!this.activeObjectForContextMenu) {
                for (let i = this.objects.length - 1; i >= 0; i--) {
                    const obj = this.objects[i];
                    if (window.pointToLineDistance({ x: mouseX, y: mouseY }, { x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY }, 1) * this.gridSize < 10) {
                        this.selectedObject = obj;
                        this.activeObjectForContextMenu = obj;
                        break;
                    }
                }
            }
        }

        if (this.activeObjectForContextMenu) {
            this.draw();
            this.showContextMenu(e.clientX, e.clientY);
        } else {
            this.draw();
        }
    }

    showContextMenu(clientX, clientY) {
        if (!this.activeObjectForContextMenu) return;

        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        contextMenu.style.left = `${clientX}px`;
        contextMenu.style.top = `${clientY}px`;
        contextMenu.style.display = 'block';

        document.getElementById('ctxLengthAngleInputs').style.display = 'none';
        document.getElementById('ctxCovingInputs').style.display = 'none';
        document.getElementById('ctxRotateObjectInputs').style.display = 'none';
        document.getElementById('ctxVoidInputs').style.display = 'none';

        const obj = this.activeObjectForContextMenu;
        if (obj.type === 'wall' || obj.type === 'door' || obj.type === 'window' || obj.type === 'voidEdge') {
            document.getElementById('ctxLengthAngleInputs').style.display = 'flex';
            document.getElementById('ctxLength').value = window.calculateDistance({ x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY }, this.gridSize).toFixed(2);
            document.getElementById('ctxAngle').value = window.calculateAngle({ x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY }).toFixed(1);

            if (obj.type === 'wall' || obj.type === 'voidEdge') {
                document.getElementById('ctxCovingInputs').style.display = 'flex';
                document.getElementById('ctxAddCovingBtn').textContent = obj.coving ? 'Remove Coving' : 'Add Coving';
                document.getElementById('ctxCovingAmount').value = obj.coving ? (obj.covingAmount * 1000).toFixed(0) : '150';
            }
            if (obj.type === 'door' || obj.type === 'window') {
                document.getElementById('ctxRotateObjectInputs').style.display = 'flex';
                document.getElementById('ctxRotateAngle').value = window.calculateAngle({ x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY }).toFixed(1);
            }
        }
    }

    updateLengthAngle() {
        if (!this.activeObjectForContextMenu || !['wall', 'door', 'window', 'voidEdge'].includes(this.activeObjectForContextMenu.type)) return;
        const obj = this.activeObjectForContextMenu;

        const newLength = parseFloat(document.getElementById('ctxLength').value);
        let newAngle = parseFloat(document.getElementById('ctxAngle').value);

        if (isNaN(newLength) || isNaN(newAngle) || newLength < 0) {
            window.showCustomAlert("Please enter valid positive numbers for length and angle.");
            return;
        }

        newAngle = newAngle % 360;
        if (newAngle > 180) newAngle -= 360;
        if (newAngle < -180) newAngle += 360;

        const startP = { x: obj.startX, y: obj.startY };
        obj.endX = startP.x + (newLength * this.gridSize) * Math.cos(newAngle * Math.PI / 180);
        obj.endY = startP.y + (newLength * this.gridSize) * Math.sin(newAngle * Math.PI / 180);

        if (obj.type === 'wall') this.checkForPolygonFormation();
        this.draw();
        window.calculateFloorMeasurements();
        document.getElementById('contextMenu').style.display = 'none';
    }

    toggleCoving() {
        if (!this.activeObjectForContextMenu || !['wall', 'voidEdge'].includes(this.activeObjectForContextMenu.type)) return;
        const obj = this.activeObjectForContextMenu;

        const covingAmountMm = parseFloat(document.getElementById('ctxCovingAmount').value);
        if (isNaN(covingAmountMm) || covingAmountMm < 0) {
            window.showCustomAlert("Please enter a valid positive number for coving amount (mm).");
            return;
        }

        obj.coving = !obj.coving;
        obj.covingAmount = obj.coving ? covingAmountMm / 1000 : 0;

        document.getElementById('ctxAddCovingBtn').textContent = obj.coving ? 'Remove Coving' : 'Add Coving';

        this.draw();
        window.calculateFloorMeasurements();
    }

    rotateObjectByInput() {
        if (!this.activeObjectForContextMenu || !['door', 'window'].includes(this.activeObjectForContextMenu.type)) return;
        const obj = this.activeObjectForContextMenu;

        let targetAngle = parseFloat(document.getElementById('ctxRotateAngle').value);
        if (isNaN(targetAngle)) {
            window.showCustomAlert("Please enter a valid number for rotation angle.");
            return;
        }
        const currentAngle = window.calculateAngle({ x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY });
        this.rotateObject(targetAngle - currentAngle);
    }

    rotateObject(deltaAngleDeg) {
        if (!this.activeObjectForContextMenu || !['door', 'window'].includes(this.activeObjectForContextMenu.type)) return;
        const obj = this.activeObjectForContextMenu;

        const currentAngle = window.calculateAngle({ x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY });
        const newAngleRad = (currentAngle + deltaAngleDeg) * Math.PI / 180;
        const lengthPx = window.calculateDistance({ x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY }, 1) * this.gridSize;

        obj.endX = obj.startX + lengthPx * Math.cos(newAngleRad);
        obj.endY = obj.startY + lengthPx * Math.sin(newAngleRad);

        const rotateAngleInput = document.getElementById('ctxRotateAngle');
        if (rotateAngleInput && rotateAngleInput.offsetParent !== null) {
            rotateAngleInput.value = window.calculateAngle({ x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY }).toFixed(1);
        }

        this.draw();
    }

    updateSnapPoints() {
        this.snapPoints = [];

        this.objects.forEach(obj => {
            this.snapPoints.push({ x: obj.startX, y: obj.startY });
            this.snapPoints.push({ x: obj.endX, y: obj.endY });
        });
        this.polygons.forEach(poly => poly.points.forEach(p => this.snapPoints.push(p)));

        if (this.showGrid) {
            for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
                for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
                    this.snapPoints.push({ x, y });
                }
            }
        }
    }

    updatePolygonsList() {
        const listDiv = document.getElementById('polygonsList');
        const itemsDiv = document.getElementById('polygonItems');
        if (!listDiv || !itemsDiv) return;

        if (this.polygons.length === 0) {
            listDiv.style.display = 'none';
            return;
        }
        listDiv.style.display = 'block';
        itemsDiv.innerHTML = '';

        this.polygons.forEach((polygon, index) => {
            const item = document.createElement('div');
            item.className = 'polygon-item';
            const perimeter = window.calculatePolygonPerimeter(polygon.points, this.gridSize);
            const color = `hsl(${(index * 60) % 360}, 70%, 50%)`;
            item.innerHTML = `
                <span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:${color};margin-right:8px;vertical-align:middle;"></span>
                <strong>Polygon ${index + 1}</strong> (ID: ...${polygon.id.slice(-4)})<br>
                Area: ${polygon.area.toFixed(2)} m² | Perimeter: ${perimeter.toFixed(2)} m | Points: ${polygon.points.length}`;
            if (this.selectedObject && this.selectedObject.id === polygon.id) {
                item.style.border = '2px solid #e74c3c';
                item.style.background = '#ffeaea';
            }
            item.onclick = () => this.selectObjectAt(polygon.points[0].x + 1, polygon.points[0].y + 1);
            itemsDiv.appendChild(item);
        });
    }

    updateMeasurements() {
        window.calculateFloorMeasurements();
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.updateSnapPoints();
        this.draw();
    }

    updateGridSize(e) {
        this.gridSize = parseInt(e.target.value) || 100;
        this.defaultDoorWidthPx = 0.82 * this.gridSize;
        this.defaultDoubleDoorWidthPx = 1.64 * this.gridSize;
        this.updateScaleInfo();
        this.updateSnapPoints();
        this.draw();
        this.updateMeasurements();
        if (this.vinylLayouts.horizontal || this.vinylLayouts.vertical) {
            this.calculateVinyl();
        }
    }

    updateScaleInfo() {
        document.getElementById('scaleText').textContent = `${this.gridSize}px = 1 metre`;
    }

    updateVinylWidth(e) {
        this.vinylWidth = parseFloat(e.target.value) || 2.0;
        if (this.vinylLayouts.horizontal || this.vinylLayouts.vertical) {
            this.calculateVinyl();
        }
    }

    onKeyDown(e) {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

        const key = e.key.toLowerCase();

        if (key === 'w') this.setTool('wall');
        else if (key === 'd') this.setTool('door');
        else if (key === 'i') this.setTool('window');
        else if (key === 's') this.setTool('select');
        else if (key === 'g') this.toggleGrid();
        else if (key === 'delete' || key === 'backspace') this.deleteSelected();
        else if (key === 'escape') {
            this.isDrawing = false;
            this.selectedObject = null;
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu) contextMenu.style.display = 'none';
            this.draw();
        }
    }

    save() {
        const data = {
            objects: this.objects,
            polygons: this.polygons,
            gridSize: this.gridSize,
            vinylWidth: this.vinylWidth,
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `floorplan-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    load() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = re => {
                try {
                    const data = JSON.parse(re.target.result);

                    this.objects = data.objects || [];
                    this.polygons = data.polygons || [];
                    this.polygons.forEach(p => {
                        if (p.area === undefined) p.area = window.calculatePolygonArea(p.points);
                    });
                    this.gridSize = data.gridSize || 100;
                    this.vinylWidth = data.vinylWidth || 2.0;

                    document.getElementById('gridSize').value = this.gridSize;
                    document.getElementById('vinylWidth').value = this.vinylWidth;

                    this.selectedObject = null;
                    this.isDrawing = false;
                    this.vinylLayouts = { horizontal: null, vertical: null };
                    this.currentVinylView = null;
                    this.currentRollLayoutView = null;
                    this.showVinylLayoutOverlay = false;
                    document.getElementById('rollLayout').style.display = 'none';

                    this.updateScaleInfo();
                    this.updateSnapPoints();
                    this.updatePolygonsList();
                    this.draw();
                    this.updateMeasurements();
                    console.log('Floor plan loaded successfully.');
                } catch (err) {
                    console.error('Error loading file:', err);
                    window.showErrorModal('Failed to load floor plan: Invalid file format or data.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    draw() {
        window.drawObjects(
            this.objects,
            this.polygons,
            this.selectedObject,
            this.currentTool,
            null,
            this.gridSize,
            this.wallThickness,
            this.windowImage,
            this.slidingDoorImage,
            this.vinylLayouts,
            this.currentVinylView,
            this.showVinylLayoutOverlay,
            this.isDrawing,
            this.startPoint,
            this.endPoint
        );
    }

    calculateVinyl() {
        console.log('calculateVinyl called with polygons:', this.polygons, 'objects:', this.objects, 'vinylWidth:', this.vinylWidth);
        this.vinylLayouts.horizontal = window.calculateVinyl(
            this.polygons,
            this.objects,
            this.vinylWidth,
            'horizontal',
            this.gridSize
        );
        this.vinylLayouts.vertical = window.calculateVinyl(
            this.polygons,
            this.objects,
            this.vinylWidth,
            'vertical',
            this.gridSize
        );

        const hor = this.vinylLayouts.horizontal;
        const ver = this.vinylLayouts.vertical;

        document.getElementById('horizontalLayout').innerHTML = `
            Total Material: ${hor.totalMaterialArea.toFixed(2)} m²<br>
            Waste: ${hor.waste.toFixed(2)} m² (${hor.efficiency.toFixed(1)}% efficiency)<br>
            Pieces: ${hor.polygonLayouts.reduce((sum, l) => sum + l.strips.length, 0)}
        `;
        document.getElementById('verticalLayout').innerHTML = `
            Total Material: ${ver.totalMaterialArea.toFixed(2)} m²<br>
            Waste: ${ver.waste.toFixed(2)} m² (${ver.efficiency.toFixed(1)}% efficiency)<br>
            Pieces: ${ver.polygonLayouts.reduce((sum, l) => sum + l.strips.length, 0)}
        `;
        window.showSuccessModal('Vinyl calculations completed.');
    }

    visualizeRollLayout(direction) {
        this.currentRollLayoutView = direction;
        const layout = this.vinylLayouts[direction];
        if (!layout) return;

        const piecesToLayout = [];
        layout.polygonLayouts.forEach(polyLayout => {
            const polyIndex = this.polygons.findIndex(p => p.id === polyLayout.polygonId);
            polyLayout.strips.forEach(strip => {
                piecesToLayout.push({
                    originalPolygonPoints: strip.originalPolygonPoints,
                    lengthM: direction === 'horizontal' ? strip.height / this.gridSize : strip.width / this.gridSize,
                    widthM: direction === 'horizontal' ? strip.width / this.gridSize : strip.height / this.gridSize,
                    name: `P${polyIndex + 1}_S${strip.sheetNumber}`,
                    id: strip.id || `strip-${polyIndex}-${strip.sheetNumber}`,
                    area: strip.area
                });
            });
        });

        const rolls = window.sortAndLayoutLinear(piecesToLayout, this.vinylRollLength, this.vinylWidth);

        const ctx = this.rollVisualizationCtx;
        const canvas = this.rollVisualizationCanvas;
        canvas.width = 2000;
        canvas.height = rolls.length * 300;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = 50;

        rolls.forEach((roll, rollIndex) => {
            const yOffset = rollIndex * 300;

            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(0, yOffset, this.vinylRollLength * scale, this.vinylWidth * scale);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, yOffset, this.vinylRollLength * scale, this.vinylWidth * scale);

            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 0.5;
            for (let x = 0; x <= this.vinylRollLength; x += 1) {
                ctx.beginPath();
                ctx.moveTo(x * scale, yOffset);
                ctx.lineTo(x * scale, yOffset + this.vinylWidth * scale);
                ctx.stroke();
            }
            for (let y = 0; y <= this.vinylWidth; y += 0.5) {
                ctx.beginPath();
                ctx.moveTo(0, yOffset + y * scale);
                ctx.lineTo(this.vinylRollLength * scale, yOffset + y * scale);
                ctx.stroke();
            }

            roll.pieces.forEach(piece => {
                const x = piece.offsetX_onRollM * scale;
                const y = yOffset + piece.offsetY_onRollM * scale;
                const width = piece.lengthM * scale;
                const height = piece.widthM * scale;

                ctx.fillStyle = direction === 'horizontal' ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 152, 0, 0.3)';
                ctx.strokeStyle = direction === 'horizontal' ? '#2196F3' : '#FF9800';
                ctx.lineWidth = 1;
                ctx.fillRect(x, y, width, height);
                ctx.strokeRect(x, y, width, height);

                if (piece.originalPolygonPoints && piece.originalPolygonPoints.length > 2) {
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 5]);

                    ctx.beginPath();
                    const points = piece.originalPolygonPoints.map(p => ({
                        x: x + (p.x - piece.originalPolygonPoints[0].x) * (width / (piece.lengthM * this.gridSize)),
                        y: y + (p.y - piece.originalPolygonPoints[0].y) * (height / (piece.widthM * this.gridSize))
                    }));
                    ctx.moveTo(points[0].x, points[0].y);
                    for (let i = 1; i < points.length; i++) {
                        ctx.lineTo(points[i].x, points[i].y);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const label = `${piece.name} (${piece.lengthM.toFixed(2)}m x ${piece.widthM.toFixed(2)}m)`;
                ctx.fillText(label, x + width / 2, y + height / 2);
            });

            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'left';
            ctx.fillText(`Roll ${roll.rollNumber}`, 10, yOffset + 20);
        });

        document.getElementById('rollLayout').style.display = 'block';
    }

    showCutList() {
        console.log('showCutList called, this:', this); // Debug log
        const direction = this.currentRollLayoutView || 'horizontal';
        console.log('Current direction:', direction); // Debug log
        const cutList = this.generateCutList(direction);
        console.log('Generated cut list:', cutList); // Debug log
        const rollSummaryContainer = document.getElementById('rollSummaryContainer');
        if (rollSummaryContainer) {
            console.log('Updating rollSummaryContainer with:', cutList); // Debug log
            rollSummaryContainer.textContent = cutList;
        } else {
            console.error('rollSummaryContainer element not found');
        }
    }

    generateCutList(direction) {
        console.log('generateCutList called, direction:', direction, 'vinylLayouts:', this.vinylLayouts); // Debug log
        const layout = this.vinylLayouts[direction];
        if (!layout) {
            console.log('No layout data for direction:', direction); // Debug log
            return 'No layout data available.';
        }

        const piecesToLayout = [];
        layout.polygonLayouts.forEach(polyLayout => {
            const polyIndex = this.polygons.findIndex(p => p.id === polyLayout.polygonId);
            polyLayout.strips.forEach(strip => {
                piecesToLayout.push({
                    originalPolygonPoints: strip.originalPolygonPoints,
                    lengthM: direction === 'horizontal' ? strip.height / this.gridSize : strip.width / this.gridSize,
                    widthM: direction === 'horizontal' ? strip.width / this.gridSize : strip.height / this.gridSize,
                    name: `P${polyIndex + 1}_S${strip.sheetNumber}`,
                    id: strip.id || `strip-${polyIndex}-${strip.sheetNumber}`,
                    area: strip.area
                });
            });
        });

        const rolls = window.sortAndLayoutLinear(piecesToLayout, this.vinylRollLength, this.vinylWidth);
        let totalLength = 0;
        rolls.forEach(roll => {
            roll.pieces.forEach(piece => {
                totalLength += piece.lengthM;
            });
        });
        const totalRolls = Math.ceil(totalLength / this.vinylRollLength);

        // Print raw roll data for debugging
        console.log('Roll data:', JSON.stringify(rolls, null, 2)); // Print statement with formatted output

        let output = `Roll Layout Summary (${direction.toUpperCase()})\n\n`;
        output += `Total Rolls Used (estimated): ${totalRolls}\n`;
        output += `Total Material on Rolls: ${totalLength.toFixed(2)} linear meters (approx.)\n`;
        output += `Vinyl Width: ${this.vinylWidth} m\n`;
        output += `Note: "Total Rolls Used" is the number of 25m segments started. Actual material used depends on cuts.\n\n`;
        output += `# Cut List for ${direction.charAt(0).toUpperCase() + direction.slice(1)} Layout\n\n`;
        output += `Total Material: ${layout.totalMaterialArea.toFixed(2)} m² | Waste: ${layout.waste.toFixed(2)} m² | Efficiency: ${layout.efficiency.toFixed(1)}%\n\n`;

        rolls.forEach(roll => {
            output += `## Roll ${roll.rollNumber}\n`;
            output += `| Piece | Dimensions | Area | Offset (X, Y) |\n`;
            output += `|-------|------------|------|--------------|\n`;
            roll.pieces.forEach(piece => {
                output += `| ${piece.name} | ${piece.lengthM.toFixed(2)}m x ${piece.widthM.toFixed(2)}m | ${piece.area.toFixed(2)} m² | (${piece.offsetX_onRollM.toFixed(2)}m, ${piece.offsetY_onRollM.toFixed(2)}m) |\n`;
            });
            output += `\n`;
        });

        return output;
    }

    checkForPolygonFormation() {
        console.log('checkForPolygonFormation called, objects:', this.objects); // Debug log
        const walls = this.objects.filter(obj => obj.type === 'wall');
        console.log('Filtered walls:', walls); // Debug log
        if (walls.length >= 3) {
            const polygon = window.createPolygonFromWalls(walls);
            console.log('Generated polygon:', polygon); // Debug log
            if (polygon.length >= 3 && !this.polygons.some(p => p.points.every((p, i) => p.x === polygon[i].x && p.y === polygon[i].y))) {
                this.polygons.push({ id: crypto.randomUUID(), points: polygon, area: window.calculatePolygonArea(polygon) });
                this.updatePolygonsList();
                console.log('New polygon added, polygons:', this.polygons); // Debug log

                // Calculate vinyl to ensure data is available
                this.calculateVinyl();
                console.log('After calculateVinyl, vinylLayouts:', this.vinylLayouts); // Debug log

                // Generate and display cut list
                const direction = 'horizontal'; // Fixed direction for testing
                const cutList = this.generateCutList(direction);
                console.log('Generated cut list:', cutList); // Debug log
                const cutListPreview = document.getElementById('cutListPreview');
                if (cutListPreview) {
                    console.log('Updating cutListPreview with:', cutList); // Debug log
                    cutListPreview.textContent = cutList || 'No data generated.';
                } else {
                    console.error('cutListPreview element not found');
                }
            } else {
                console.log('Polygon not unique or invalid');
            }
        } else {
            console.log('Not enough walls to form a polygon');
        }
    }

    selectObjectAt(x, y) {
        this.selectedObject = null;
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (window.pointToLineDistance({ x, y }, { x: obj.startX, y: obj.startY }, { x: obj.endX, y: obj.endY }, 1) * this.gridSize < 10) {
                this.selectedObject = obj;
                break;
            }
        }
        for (let i = this.polygons.length - 1; i >= 0; i--) {
            if (window.pointInPolygon(x, y, this.polygons[i].points)) {
                this.selectedObject = this.polygons[i];
                break;
            }
        }
        this.draw();
    }

    deleteSelected() {
        if (this.selectedObject) {
            if (this.selectedObject.points) {
                this.polygons = this.polygons.filter(p => p.id !== this.selectedObject.id);
            } else {
                this.objects = this.objects.filter(o => o.id !== this.selectedObject.id);
            }
            this.selectedObject = null;
            this.updateMeasurements();
            this.updatePolygonsList();
            this.draw();
        }
    }

    clearAll() {
        this.objects = [];
        this.polygons = [];
        this.selectedObject = null;
        this.updateMeasurements();
        this.updatePolygonsList();
        this.draw();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    floorPlanner = new EnhancedFloorPlanner();
    window.floorPlanner = floorPlanner;
    const showCutListBtn = document.getElementById('showCutListBtn');
    if (showCutListBtn) {
        console.log('Attaching event listener to showCutListBtn');
        showCutListBtn.addEventListener('click', floorPlanner.showCutList.bind(floorPlanner), false);
    } else {
        console.error('showCutListBtn not found in DOM');
    }
    console.log('FloorPlanner initialized');
});
