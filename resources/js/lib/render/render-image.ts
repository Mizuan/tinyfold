import type { Rotation } from '@/lib/rotation';
import { isQuarterTurn } from '@/lib/rotation';
import { FORMATS } from '@/tools/convert-images/formats';
import type { Format } from '@/tools/convert-images/types';

/** An area of the turned image, in its pixels. */
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Draw an upright bitmap turned by `rotation`, keep only the `area` of the
 * turned image (all of it by default), scale it to `width` × `height` and save
 * it. Re-drawing keeps only the pixels, so photo details are left behind.
 */
export async function renderImage({
    bitmap,
    rotation,
    area,
    width,
    height,
    format,
    quality,
}: {
    bitmap: ImageBitmap;
    rotation: Rotation;
    area?: Rect;
    width: number;
    height: number;
    format: Format;
    /** 0 to 1, for JPG and WebP. */
    quality: number;
}): Promise<Blob> {
    const { mime, label, lossy } = FORMATS[format];
    const turned = isQuarterTurn(rotation);
    const full = {
        x: 0,
        y: 0,
        width: turned ? bitmap.height : bitmap.width,
        height: turned ? bitmap.width : bitmap.height,
    };
    const crop = area ?? full;
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('This browser cannot draw images.');
    }

    // JPG has no transparency, so transparent areas become white.
    if (format === 'jpg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
    }

    context.imageSmoothingQuality = 'high';
    context.scale(width / crop.width, height / crop.height);
    context.translate(-crop.x + full.width / 2, -crop.y + full.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(
        bitmap,
        -bitmap.width / 2,
        -bitmap.height / 2,
        bitmap.width,
        bitmap.height,
    );

    const blob = await canvas.convertToBlob(
        lossy ? { type: mime, quality } : { type: mime },
    );

    if (blob.type !== mime) {
        throw new Error(`This browser can't save ${label} images.`);
    }

    return blob;
}
