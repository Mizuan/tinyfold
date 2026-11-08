import type { Size } from '@/lib/rotation';
import { MAX_PIXELS } from '@/tools/convert-images/formats';

/** Browsers refuse canvases wider or taller than this. */
export const MAX_SIDE = 16_384;

export type ResizeOptions =
    | { mode: 'percent'; percent: number }
    | {
          mode: 'size';
          width: number | null;
          height: number | null;
          /** Keep the shape: fit inside the box, or follow the one size given. */
          keepProportions: boolean;
          /** Allow images smaller than the size to grow. */
          enlarge: boolean;
      };

/**
 * The new size of an upright image, or null when the options don't say yet
 * (no size typed in, or only one when stretching to an exact size).
 */
export function resizedSize(size: Size, options: ResizeOptions): Size | null {
    const { width, height } = size;

    if (options.mode === 'percent') {
        return options.percent > 0
            ? limit(width, height, options.percent / 100, options.percent / 100)
            : null;
    }

    const w = positive(options.width);
    const h = positive(options.height);

    if (!options.keepProportions) {
        return w && h ? limit(width, height, w / width, h / height) : null;
    }

    if (!w && !h) {
        return null;
    }

    let scale = Math.min(w ? w / width : Infinity, h ? h / height : Infinity);

    if (!options.enlarge) {
        scale = Math.min(scale, 1);
    }

    return limit(width, height, scale, scale);
}

const positive = (value: number | null) =>
    value !== null && Number.isFinite(value) && value >= 1
        ? Math.floor(value)
        : null;

/** Scale, then shrink evenly if needed to stay inside what browsers can draw. */
function limit(width: number, height: number, sx: number, sy: number): Size {
    let w = Math.max(1, Math.round(width * sx));
    let h = Math.max(1, Math.round(height * sy));
    const shrink = Math.min(
        1,
        MAX_SIDE / Math.max(w, h),
        Math.sqrt(MAX_PIXELS / (w * h)),
    );

    if (shrink < 1) {
        w = Math.max(1, Math.floor(w * shrink));
        h = Math.max(1, Math.floor(h * shrink));
    }

    return { width: w, height: h };
}
