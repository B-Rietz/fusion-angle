import type { GraphEdge } from '../../shared/types.ts';
import { MIN_ZOOM, type Camera } from './flow-camera.ts';
import {
    buildInteractionState,
    fitBoxToCanvas,
    frameBoxInCanvas,
    type FitBox,
} from './flow-interactions.ts';
import { PORT_RADIUS, connectionPortOf } from './flow-graph.ts';
import type { FlowArrangement } from './flow-arrangement.ts';

// The stats camera: where the stats canvas looks, by the
// designer's rules for the same box. Pure.

// Stats has no properties panel, so none narrows its canvas.
const NO_PANEL_PX = 0;

// The designer's fit with no panel, except where its
// MIN_ZOOM clamp would crop: then the unclamped frame. The
// designer's reader can turn Auto Fit off and pan to what
// the clamp crops; the stats reader cannot, so stats shows
// the whole flow smaller.
export function statsFitCamera(
    box: FitBox, canvas: { w: number; h: number },
): Camera {
    const frame = frameBoxInCanvas(
        box, canvas.w, canvas.h, NO_PANEL_PX,
    );
    if (frame.zoom < MIN_ZOOM) return frame;
    return fitBoxToCanvas(
        box, canvas.w, canvas.h, NO_PANEL_PX,
    );
}

// buildInteractionState(w, h): 1:1, centred on 0,0.
export function statsOpeningCamera(
    canvas: { w: number; h: number },
): Camera {
    const opening = buildInteractionState(canvas.w, canvas.h);
    return { zoom: opening.zoom, viewBox: opening.viewBox };
}

// The circles the designer draws and stats does not
// (ruling 1), in content coordinates; null if none. The
// designer re-fits to its content's getBBox, which counts
// each circle's geometry and not its stroke.
export function connectionPortBox(
    arrangement: FlowArrangement,
    edges: readonly GraphEdge[],
    isLocked: boolean,
): FitBox | null {
    const nodeMap = new Map(
        arrangement.nodes.map(n => [n.id, n]),
    );
    let box: FitBox | null = null;
    for (const node of arrangement.nodes) {
        const port = connectionPortOf(
            node, edges, nodeMap, isLocked,
        );
        if (port === null) continue;
        const cx = node.positionX + port.x;
        const cy = node.positionY + port.y;
        box = unionFitBox({
            minX: cx - PORT_RADIUS,
            minY: cy - PORT_RADIUS,
            maxX: cx + PORT_RADIUS,
            maxY: cy + PORT_RADIUS,
        }, box);
    }
    return box;
}

export function unionFitBox(
    a: FitBox, b: FitBox | null,
): FitBox {
    if (b === null) return a;
    return {
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY),
    };
}
