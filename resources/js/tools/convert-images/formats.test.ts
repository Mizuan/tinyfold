import { describe, expect, it } from 'vitest';
import { keepFormat, MAX_PIXELS, outputSize } from './formats';

describe('outputSize', () => {
    it('keeps the size when there is no limit and it fits', () => {
        expect(outputSize(4032, 3024, null)).toEqual({
            width: 4032,
            height: 3024,
        });
    });

    it('scales the longest side down to the chosen size', () => {
        expect(outputSize(4032, 3024, 2000)).toEqual({
            width: 2000,
            height: 1500,
        });
        expect(outputSize(1000, 3000, 1080)).toEqual({
            width: 360,
            height: 1080,
        });
    });

    it('never enlarges a small image', () => {
        expect(outputSize(800, 600, 4000)).toEqual({ width: 800, height: 600 });
    });

    it('stays inside what browsers can draw', () => {
        const { width, height } = outputSize(8000, 6000, null);

        expect(width * height).toBeLessThanOrEqual(MAX_PIXELS);
        expect(width / height).toBeCloseTo(8000 / 6000, 2);
    });
});

describe('keepFormat', () => {
    it('keeps JPG, PNG and WebP', () => {
        expect(keepFormat('a.jpg', 'image/jpeg')).toBe('jpg');
        expect(keepFormat('a.png', 'image/png')).toBe('png');
        expect(keepFormat('a.webp', 'image/webp')).toBe('webp');
    });

    it('saves iPhone photos as JPG, even once decoded to PNG', () => {
        expect(keepFormat('IMG_1.HEIC', 'image/png')).toBe('jpg');
    });

    it('uses PNG for other formats and when WebP cannot be saved', () => {
        expect(keepFormat('a.gif', 'image/gif')).toBe('png');
        expect(keepFormat('a.webp', 'image/webp', false)).toBe('png');
    });
});
