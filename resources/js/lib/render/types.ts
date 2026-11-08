import type { Rotation } from '@/lib/rotation';
import type { WorkerReply } from '@/lib/worker';
import type { Format } from '@/tools/convert-images/types';
import type { Rect } from './render-image';

/** One image to draw: turned, optionally cropped, at a size and format. */
export type RenderJob = {
    blob: Blob;
    name: string;
    rotation: Rotation;
    area?: Rect;
    width: number;
    height: number;
    format: Format;
};

export type RenderRequest = {
    images: RenderJob[];
    /** 0 to 1, for JPG and WebP. */
    quality: number;
};

export type Rendered = {
    bytes: Uint8Array;
    kind: 'image' | 'zip';
    /** Each image's saved size in bytes. */
    sizes: number[];
};

export type WorkerMessage = WorkerReply<Rendered>;
