import { describe, expect, it } from 'vitest';
import type { Rect } from '@/lib/render/render-image';
import { defaultCrop, dragCrop, matchCrop, pixelCrop } from './crop';

const size = { width: 400, height: 300 };
const box: Rect = { x: 100, y: 100, width: 100, height: 100 };

const inside = (rect: Rect) =>
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= size.width + 1e-9 &&
    rect.y + rect.height <= size.height + 1e-9;

describe('defaultCrop', () => {
    it('takes the whole image when free', () => {
        expect(defaultCrop(size, null)).toEqual({
            x: 0,
            y: 0,
            width: 400,
            height: 300,
        });
    });

    it('takes the largest centred box of the shape', () => {
        expect(defaultCrop(size, 1)).toEqual({
            x: 50,
            y: 0,
            width: 300,
            height: 300,
        });
        expect(defaultCrop(size, 16 / 9).height).toBeCloseTo(225);
    });
});

describe('dragCrop', () => {
    it('moves, but not past the edges', () => {
        expect(dragCrop(box, 'move', 20, -10, size, null)).toMatchObject({
            x: 120,
            y: 90,
        });
        expect(dragCrop(box, 'move', 999, 999, size, null)).toMatchObject({
            x: 300,
            y: 200,
        });
    });

    it('drags free edges and corners, keeping a minimum size', () => {
        expect(dragCrop(box, 'se', 50, 20, size, null)).toEqual({
            x: 100,
            y: 100,
            width: 150,
            height: 120,
        });
        expect(dragCrop(box, 'w', 500, 0, size, null).width).toBe(16);
        expect(dragCrop(box, 'nw', -999, -999, size, null)).toMatchObject({
            x: 0,
            y: 0,
        });
    });

    it('keeps the shape from a corner, with the opposite corner fixed', () => {
        const rect = dragCrop(box, 'se', 40, 10, size, 1);

        expect(rect).toEqual({ x: 100, y: 100, width: 140, height: 140 });

        const nw = dragCrop(box, 'nw', -30, -5, size, 1);

        expect(nw.x + nw.width).toBe(200);
        expect(nw.y + nw.height).toBe(200);
        expect(nw.width).toBe(nw.height);
    });

    it('shrinks from a corner pulled in along one side only', () => {
        expect(dragCrop(box, 'se', -30, 0, size, 1)).toEqual({
            x: 100,
            y: 100,
            width: 70,
            height: 70,
        });
    });

    it('keeps the shape from an edge, around the centre', () => {
        const rect = dragCrop(box, 'e', 50, 0, size, 2);

        expect(rect.width / rect.height).toBeCloseTo(2);
        expect(rect.y + rect.height / 2).toBeCloseTo(150);
        expect(inside(rect)).toBe(true);
    });

    it('stays inside the image with a shape, however far it is pulled', () => {
        for (const handle of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
            for (const [dx, dy] of [
                [999, 999],
                [-999, -999],
                [999, -999],
            ]) {
                const rect = dragCrop(box, handle as 'n', dx, dy, size, 4 / 3);

                expect(inside(rect)).toBe(true);
                expect(rect.width / rect.height).toBeCloseTo(4 / 3);
            }
        }
    });
});

describe('matchCrop', () => {
    it('crops the same part of a different-sized image', () => {
        expect(matchCrop(box, size, { width: 800, height: 600 }, null)).toEqual(
            { x: 200, y: 200, width: 200, height: 200 },
        );
    });

    it('gives the shape back when the other image is a different shape', () => {
        const rect = matchCrop(box, size, { width: 300, height: 300 }, 1);

        expect(rect.width).toBeCloseTo(rect.height);
        expect(rect.x + rect.width).toBeLessThanOrEqual(300);
    });
});

describe('pixelCrop', () => {
    it('rounds to whole pixels inside the image', () => {
        expect(
            pixelCrop({ x: 299.6, y: -0.2, width: 100.7, height: 300.4 }, size),
        ).toEqual({ x: 300, y: 0, width: 100, height: 300 });
    });
});
