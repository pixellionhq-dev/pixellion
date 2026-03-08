import sys

file_path = "src/components/PixelBoard.jsx"
with open(file_path, "r") as f:
    lines = f.readlines()

new_code = """    // CONSTANTS ARE NOW IMPORTED
    const imageCache = useRef(new Map());
    const renderFrame = useRef(null);
    const overlayRenderFrame = useRef(null);

    const drawBaseBoard = useCallback(() => {
        if (renderFrame.current) cancelAnimationFrame(renderFrame.current);

        renderFrame.current = requestAnimationFrame(() => {
            const canvas = baseCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            if (canvas.width !== CANVAS_SIZE * dpr) {
                canvas.width = CANVAS_SIZE * dpr;
                canvas.height = CANVAS_SIZE * dpr;
                canvas.style.width = `${CANVAS_SIZE}px`;
                canvas.style.height = `${CANVAS_SIZE}px`;
                ctx.scale(dpr, dpr);
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // 1. Group by Purchase IDs
            const purchaseMap = new Map();

            (ownedPixels || []).forEach(p => {
                const groupId = p.purchaseId || p.ownerId;
                if (!purchaseMap.has(groupId)) {
                    purchaseMap.set(groupId, { ...p, pixels: [] });
                }
                purchaseMap.get(groupId).pixels.push(p);
            });
            const blocks = Array.from(purchaseMap.values());

            // 2. Draw block backgrounds
            blocks.forEach(block => {
                const xs = block.pixels.map(p => p.x);
                const ys = block.pixels.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                const startX = minX * CELL_SIZE;
                const startY = minY * CELL_SIZE;
                const blockW = (maxX - minX + 1) * CELL_SIZE;
                const blockH = (maxY - minY + 1) * CELL_SIZE;

                ctx.fillStyle = block.color || '#000000';
                ctx.fillRect(startX, startY, blockW, blockH);
            });

            // 3. Draw Grid Lines OVER the block backgrounds
            ctx.strokeStyle = GRID_COLOR_BASE;
            ctx.lineWidth = GRID_SIZE * 0.5;
            ctx.beginPath();
            for (let i = 0; i <= BOARD_SIZE; i++) {
                ctx.moveTo(Math.floor(i * CELL_SIZE), 0);
                ctx.lineTo(Math.floor(i * CELL_SIZE), CANVAS_SIZE);
                ctx.moveTo(0, Math.floor(i * CELL_SIZE));
                ctx.lineTo(CANVAS_SIZE, Math.floor(i * CELL_SIZE));
            }
            ctx.stroke();

            // 3.2 Draw logos OVER the grid lines
            blocks.forEach(block => {
                const logoToUse = block.ownerLogo || block.logoUrl;
                if (logoToUse) {
                    const xs = block.pixels.map(p => p.x);
                    const ys = block.pixels.map(p => p.y);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);

                    const startX = minX * CELL_SIZE;
                    const startY = minY * CELL_SIZE;
                    const blockW = (maxX - minX + 1) * CELL_SIZE;
                    const blockH = (maxY - minY + 1) * CELL_SIZE;

                    if (!imageCache.current.has(logoToUse)) {
                        imageCache.current.set(logoToUse, 'loading');
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                            imageCache.current.set(logoToUse, img);
                            requestAnimationFrame(drawBaseBoard);
                        };
                        img.src = logoToUse.startsWith('http') ? logoToUse : `http://localhost:3001/uploads/${logoToUse.split('/').pop()}`;
                    } else {
                        const img = imageCache.current.get(logoToUse);
                        if (img && img !== 'loading') {
                            ctx.imageSmoothingEnabled = false;
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(startX, startY, blockW, blockH);
                            ctx.drawImage(img, startX, startY, blockW + 1, blockH + 1);
                        }
                    }
                }
            });

            // 3.3 Draw faint grid lines OVER the logos
            ctx.strokeStyle = GRID_COLOR;
            ctx.lineWidth = GRID_SIZE * 0.5;
            ctx.beginPath();
            for (let i = 0; i <= BOARD_SIZE; i++) {
                ctx.moveTo(Math.floor(i * CELL_SIZE), 0);
                ctx.lineTo(Math.floor(i * CELL_SIZE), CANVAS_SIZE);
                ctx.moveTo(0, Math.floor(i * CELL_SIZE));
                ctx.lineTo(CANVAS_SIZE, Math.floor(i * CELL_SIZE));
            }
            ctx.stroke();
        });
    }, [ownedPixels]);

    const drawOverlayBoard = useCallback(() => {
        if (overlayRenderFrame.current) cancelAnimationFrame(overlayRenderFrame.current);

        overlayRenderFrame.current = requestAnimationFrame(() => {
            const canvas = overlayCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            if (canvas.width !== CANVAS_SIZE * dpr) {
                canvas.width = CANVAS_SIZE * dpr;
                canvas.height = CANVAS_SIZE * dpr;
                canvas.style.width = `${CANVAS_SIZE}px`;
                canvas.style.height = `${CANVAS_SIZE}px`;
                ctx.scale(dpr, dpr);
            }

            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

            // 3.5 Draw Hover Glow
            if (hoveredPixel && !isDragging) {
                ctx.save();
                ctx.shadowBlur = 15;
                ctx.shadowColor = HOVER_GLOW_COLOR;
                ctx.strokeStyle = HOVER_BORDER_COLOR;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -(performance.now() / 50);
                ctx.strokeRect(hoveredPixel.x * CELL_SIZE, hoveredPixel.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                ctx.restore();
            }

            // 4. Draw Selected Pixels
            if (selectedPixels.size > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                selectedPixels.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    if (x < minX) minX = x; if (y < minY) minY = y;
                    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
                });
                const rx = minX * CELL_SIZE;
                const ry = minY * CELL_SIZE;
                const rw = (maxX - minX + 1) * CELL_SIZE;
                const rh = (maxY - minY + 1) * CELL_SIZE;

                ctx.fillStyle = SELECTION_COLOR;
                ctx.fillRect(rx, ry, rw, rh);
                ctx.strokeStyle = SELECTION_BORDER_COLOR;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -(performance.now() / 50);
                ctx.strokeRect(rx, ry, rw, rh);
                ctx.setLineDash([]);
            }

            // 5. Draw Drag Selection Preview
            if (isDragging && currentDragStart.current && currentDragEnd.current) {
                const minX = Math.min(currentDragStart.current.x, currentDragEnd.current.x);
                const maxX = Math.max(currentDragStart.current.x, currentDragEnd.current.x);
                const minY = Math.min(currentDragStart.current.y, currentDragEnd.current.y);
                const maxY = Math.max(currentDragStart.current.y, currentDragEnd.current.y);

                ctx.fillStyle = DRAG_BG_COLOR;
                ctx.strokeStyle = SELECTION_BORDER_COLOR;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -(performance.now() / 50);

                const rx = minX * CELL_SIZE;
                const ry = minY * CELL_SIZE;
                const rw = (maxX - minX + 1) * CELL_SIZE;
                const rh = (maxY - minY + 1) * CELL_SIZE;

                ctx.fillRect(rx, ry, rw, rh);
                ctx.strokeRect(rx, ry, rw, rh);
                ctx.setLineDash([]);
            }

            // Keep animating if there's an active marquee (marching ants)
            if (selectedPixels.size > 0 || isDragging || hoveredPixel) {
                overlayRenderFrame.current = requestAnimationFrame(drawOverlayBoard);
            }
        });
    }, [selectedPixels, hoveredPixel, isDragging, dragStart, dragEnd]);

    useEffect(() => {
        drawBaseBoard();
    }, [drawBaseBoard]);

    useEffect(() => {
        drawOverlayBoard();
        return () => {
            if (overlayRenderFrame.current) cancelAnimationFrame(overlayRenderFrame.current);
        };
    }, [drawOverlayBoard, isDragging, dragStart, dragEnd, hoveredPixel]);

    useEffect(() => {
        return () => {
            if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current);
            if (panAnimFrame.current) cancelAnimationFrame(panAnimFrame.current);
        };
    }, []);
"""

lines = lines[:86] + [new_code] + lines[283:]

with open(file_path, "w") as f:
    f.writelines(lines)
print("done")
