import { describe, expect, it } from 'vitest';
import { MAX_PIXELS } from '@/tools/convert-images/formats';
import { resizedSize } from './size';

const photo = { width: 4000, height: 3000 };

const size = (
    width: number | null,
    height: number | null,
    keepProportions = true,
    enlarge = false,
) =>
    ({
        mode: 'size',
        width,
        height,
        keepProportions,
        enlarge,
    }) as const;

describe('resizedSize', () => {
    it('scales by a percentage', () => {
        expect(resizedSize(photo, { mode: 'percent', percent: 50 })).toEqual({
            width: 2000,
            height: 1500,
        });
        expect(resizedSize(photo, { mode: 'percent', percent: 0 })).toBeNull();
    });

    it('follows the one size given and keeps the shape', () => {
        expect(resizedSize(photo, size(1080, null))).toEqual({
            width: 1080,
            height: 810,
        });
        expect(resizedSize(photo, size(null, 600))).toEqual({
            width: 800,
            height: 600,
        });
    });

    it('fits inside the box when both sizes are given', () => {
        expect(resizedSize(photo, size(1000, 1000))).toEqual({
            width: 1000,
            height: 750,
        });
    });

    it('does not enlarge unless asked', () => {
        const small = { width: 800, height: 600 };

        expect(resizedSize(small, size(1600, null))).toEqual(small);
        expect(resizedSize(small, size(1600, null, true, true))).toEqual({
            width: 1600,
            height: 1200,
        });
    });

    it('stretches to an exact size, which needs both sizes', () => {
        expect(resizedSize(photo, size(500, 500, false))).toEqual({
            width: 500,
            height: 500,
        });
        expect(resizedSize(photo, size(500, null, false))).toBeNull();
    });

    it('waits for a size and ignores nonsense', () => {
        expect(resizedSize(photo, size(null, null))).toBeNull();
        expect(resizedSize(photo, size(0, Number.NaN))).toBeNull();
    });

    it('stays inside what browsers can draw', () => {
        const big = resizedSize(photo, size(40_000, null, true, true));

        expect(big).not.toBeNull();
        expect(big!.width * big!.height).toBeLessThanOrEqual(MAX_PIXELS);
        expect(big!.width / big!.height).toBeCloseTo(4 / 3, 2);
    });
});
