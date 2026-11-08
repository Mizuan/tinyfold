import type { Rect } from '@/lib/render/render-image';
import type { Size } from '@/lib/rotation';

export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** The smallest crop, in image pixels, so a handle can't flip the box over. */
export const minSide = (size: Size) =>
    Math.max(1, Math.min(16, size.width, size.height));

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

/** The largest centred crop with this shape, or the whole image when free. */
export function defaultCrop(size: Size, aspect: number | null): Rect {
    if (!aspect) {
        return { x: 0, y: 0, width: size.width, height: size.height };
    }

    const width = Math.min(size.width, size.height * aspect);
    const height = width / aspect;

    return {
        x: (size.width - width) / 2,
        y: (size.height - height) / 2,
        width,
        height,
    };
}

/**
 * Move the crop or drag one of its handles by (dx, dy) image pixels, keeping
 * it inside the image and, when there is one, at its shape.
 */
export function dragCrop(
    start: Rect,
    handle: Handle,
    dx: number,
    dy: number,
    size: Size,
    aspect: number | null,
): Rect {
    const { width: W, height: H } = size;

    if (handle === 'move') {
        return {
            ...start,
            x: clamp(start.x + dx, 0, W - start.width),
            y: clamp(start.y + dy, 0, H - start.height),
        };
    }

    const min = minSide(size);
    const left = start.x;
    const top = start.y;
    const right = start.x + start.width;
    const bottom = start.y + start.height;
    const west = handle.includes('w');
    const east = handle.includes('e');
    const north = handle.includes('n');
    const south = handle.includes('s');

    if (!aspect) {
        const x1 = west ? clamp(left + dx, 0, right - min) : left;
        const x2 = east ? clamp(right + dx, left + min, W) : right;
        const y1 = north ? clamp(top + dy, 0, bottom - min) : top;
        const y2 = south ? clamp(bottom + dy, top + min, H) : bottom;

        return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }

    const minWidth = Math.max(min, min * aspect);

    // An edge: that side moves, the other dimension follows around the centre.
    if (!(west || east) || !(north || south)) {
        if (west || east) {
            const room = west ? right : W - left;
            const centre = top + start.height / 2;
            const maxWidth = Math.min(
                room,
                2 * Math.min(centre, H - centre) * aspect,
            );
            const width = clamp(
                start.width + (east ? dx : -dx),
                Math.min(minWidth, maxWidth),
                maxWidth,
            );

            return {
                x: west ? right - width : left,
                y: centre - width / aspect / 2,
                width,
                height: width / aspect,
            };
        }

        const room = north ? bottom : H - top;
        const centre = left + start.width / 2;
        const maxHeight = Math.min(
            room,
            (2 * Math.min(centre, W - centre)) / aspect,
        );
        const height = clamp(
            start.height + (south ? dy : -dy),
            Math.min(minWidth / aspect, maxHeight),
            maxHeight,
        );

        return {
            x: centre - (height * aspect) / 2,
            y: north ? bottom - height : top,
            width: height * aspect,
            height,
        };
    }

    // A corner: the opposite corner stays put; the bigger pull wins, in or out.
    const alongX = east ? dx : -dx;
    const alongY = (south ? dy : -dy) * aspect;
    const maxWidth = Math.min(
        east ? W - left : right,
        (south ? H - top : bottom) * aspect,
    );
    const width = clamp(
        start.width + (Math.abs(alongX) >= Math.abs(alongY) ? alongX : alongY),
        Math.min(minWidth, maxWidth),
        maxWidth,
    );
    const height = width / aspect;

    return {
        x: east ? left : right - width,
        y: south ? top : bottom - height,
        width,
        height,
    };
}

/**
 * The same crop on another image: the same part of it, then given the shape
 * (when there is one) around its centre and kept inside the image.
 */
export function matchCrop(
    rect: Rect,
    from: Size,
    to: Size,
    aspect: number | null,
): Rect {
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    const scaled = {
        x: rect.x * sx,
        y: rect.y * sy,
        width: rect.width * sx,
        height: rect.height * sy,
    };

    if (!aspect) {
        return scaled;
    }

    const cx = scaled.x + scaled.width / 2;
    const cy = scaled.y + scaled.height / 2;
    const width = Math.min(
        Math.sqrt(scaled.width * scaled.height * aspect),
        to.width,
        to.height * aspect,
    );
    const height = width / aspect;

    return {
        x: clamp(cx - width / 2, 0, to.width - width),
        y: clamp(cy - height / 2, 0, to.height - height),
        width,
        height,
    };
}

/** Whole pixels for saving, still inside the image. */
export function pixelCrop(rect: Rect, size: Size): Rect {
    const x = clamp(Math.round(rect.x), 0, size.width - 1);
    const y = clamp(Math.round(rect.y), 0, size.height - 1);

    return {
        x,
        y,
        width: clamp(Math.round(rect.width), 1, size.width - x),
        height: clamp(Math.round(rect.height), 1, size.height - y),
    };
}
