import {
    assert,
    assertEquals,
    assertStrictEquals,
} from '@std/assert';
import {
    connectionPortBox,
    statsFitCamera,
    statsOpeningCamera,
    unionFitBox,
} from '../web-app/app/flow-stats-camera.ts';
import { MAX_ZOOM, MIN_ZOOM } from '../web-app/app/flow-camera.ts';
import {
    buildInteractionState,
    fitBoxToCanvas,
    frameBoxInCanvas,
    type FitBox,
} from '../web-app/app/flow-interactions.ts';
import type { FlowArrangement } from
    '../web-app/app/flow-arrangement.ts';
import type { GraphNode } from '../shared/types.ts';

// The designer pads every fitted box by this much a side
// (flow-interactions.ts ZOOM_TO_FIT_PADDING_PX).
const FIT_PADDING_PX = 70;

// The designer's fit, as its Auto Fit calls it: no panel.
const NO_PANEL_PX = 0;

function regularNode(
    id: string, positionX: number, positionY: number,
): GraphNode {
    return {
        id,
        name: id,
        positionX,
        positionY,
        isCreate: false,
        isArchive: false,
        memberIds: [],
        attributes: [],
        taskInstructions: '',
    };
}

function arrangementOf(
    nodes: readonly GraphNode[],
): FlowArrangement {
    return { nodes, edgeWaypoints: new Map() };
}

function boxOf(w: number, h: number): FitBox {
    return { minX: 0, minY: 0, maxX: w, maxY: h };
}

Deno.test(
    'statsFitCamera equals fitBoxToCanvas with no panel',
    () => {
        const box = boxOf(600, 200);
        for (const canvas of [
            { w: 1100, h: 640 },
            { w: 300, h: 200 },
        ]) {
            assertEquals(
                statsFitCamera(box, canvas),
                fitBoxToCanvas(
                    box, canvas.w, canvas.h, NO_PANEL_PX,
                ),
            );
        }
    },
);

Deno.test(
    'statsFitCamera shows the whole flow where the'
    + ' designer would crop',
    () => {
        const box = boxOf(20000, 100);
        const canvas = { w: 800, h: 600 };
        const camera = statsFitCamera(box, canvas);
        assert(camera.zoom < MIN_ZOOM);
        const vb = camera.viewBox;
        assert(vb.x <= box.minX - FIT_PADDING_PX);
        assert(vb.y <= box.minY - FIT_PADDING_PX);
        assert(vb.x + vb.w >= box.maxX + FIT_PADDING_PX);
        assert(vb.y + vb.h >= box.maxY + FIT_PADDING_PX);
        assert(
            Math.abs(vb.w / vb.h - canvas.w / canvas.h)
                < 0.001,
        );
        assertEquals(
            camera,
            frameBoxInCanvas(
                box, canvas.w, canvas.h, NO_PANEL_PX,
            ),
        );
    },
);

Deno.test(
    'statsFitCamera clamps at MAX_ZOOM like the designer',
    () => {
        const box = boxOf(10, 10);
        const canvas = { w: 1100, h: 640 };
        const camera = statsFitCamera(box, canvas);
        assertStrictEquals(camera.zoom, MAX_ZOOM);
        assertEquals(
            camera,
            fitBoxToCanvas(
                box, canvas.w, canvas.h, NO_PANEL_PX,
            ),
        );
    },
);

Deno.test('the opening camera is the designer\'s', () => {
    assertEquals(
        statsOpeningCamera({ w: 1100, h: 640 }),
        {
            zoom: 1,
            viewBox: buildInteractionState(1100, 640).viewBox,
        },
    );
});

Deno.test('connectionPortBox is null on a locked flow', () => {
    assertStrictEquals(
        connectionPortBox(
            arrangementOf([regularNode('a', 0, 0)]), [], true,
        ),
        null,
    );
});

Deno.test('connectionPortBox is null with no nodes', () => {
    assertStrictEquals(
        connectionPortBox(arrangementOf([]), [], false),
        null,
    );
});

Deno.test('it spans each port\'s circle', () => {
    assertEquals(
        connectionPortBox(
            arrangementOf([regularNode('a', 0, 0)]), [], false,
        ),
        { minX: 155, minY: 27, maxX: 165, maxY: 37 },
    );
    assertEquals(
        connectionPortBox(
            arrangementOf([
                regularNode('a', 0, 0),
                regularNode('b', 300, 100),
            ]),
            [],
            false,
        ),
        { minX: 155, minY: 27, maxX: 465, maxY: 137 },
    );
});

Deno.test('unionFitBox with null is the first box', () => {
    const box = { minX: -3, minY: 4, maxX: 10, maxY: 20 };
    assertEquals(unionFitBox(box, null), box);
});

Deno.test('unionFitBox spans both boxes', () => {
    assertEquals(
        unionFitBox(
            { minX: -3, minY: 4, maxX: 10, maxY: 20 },
            { minX: 0, minY: -8, maxX: 30, maxY: 15 },
        ),
        { minX: -3, minY: -8, maxX: 30, maxY: 20 },
    );
});
