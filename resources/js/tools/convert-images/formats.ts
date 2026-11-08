import type { Format } from './types';

export const FORMATS: Record<
    Format,
    { mime: string; extension: string; label: string; lossy: boolean }
> = {
    jpg: { mime: 'image/jpeg', extension: 'jpg', label: 'JPG', lossy: true },
    png: { mime: 'image/png', extension: 'png', label: 'PNG', lossy: false },
    webp: { mime: 'image/webp', extension: 'webp', label: 'WebP', lossy: true },
};

/** iOS Safari refuses canvases over ~16.7 million pixels. */
export const MAX_PIXELS = 16_000_000;

/**
 * The size to save an upright image at: no bigger than the chosen longest
 * side, never enlarged, and small enough for every browser's canvas.
 */
export function outputSize(
    width: number,
    height: number,
    maxSide: number | null,
): { width: number; height: number } {
    const scale = Math.min(
        1,
        maxSide ? maxSide / Math.max(width, height) : 1,
        Math.sqrt(MAX_PIXELS / (width * height)),
    );

    // Round down so the result never ends up a few pixels over the limit.
    return {
        width: Math.max(1, Math.floor(width * scale + 1e-6)),
        height: Math.max(1, Math.floor(height * scale + 1e-6)),
    };
}

/**
 * The format that keeps an image as it was: JPG, PNG and WebP stay as they
 * are, iPhone photos become JPG and anything else becomes PNG.
 */
export function keepFormat(name: string, type: string, webp = true): Format {
    if (/\.(heic|heif|avif)$/i.test(name) || type === 'image/jpeg') {
        return 'jpg';
    }

    return type === 'image/webp' && webp ? 'webp' : 'png';
}

const support = new Map<string, Promise<boolean>>();

/**
 * Whether this browser can save the format. Some (older Safari, for WebP)
 * quietly hand back a PNG instead, so check what actually comes out.
 */
export function canSave(format: Format): Promise<boolean> {
    const { mime } = FORMATS[format];

    if (!support.has(mime)) {
        const canvas = document.createElement('canvas');

        canvas.width = canvas.height = 1;
        support.set(
            mime,
            new Promise((resolve) =>
                canvas.toBlob((blob) => resolve(blob?.type === mime), mime),
            ),
        );
    }

    return support.get(mime) as Promise<boolean>;
}
