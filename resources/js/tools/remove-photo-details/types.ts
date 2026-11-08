import type { WorkerReply } from '@/lib/worker';

export type CleanRequest = {
    /** iPhone photos arrive already turned into JPG. */
    photos: { blob: Blob; name: string; heif: boolean }[];
};

export type Cleaned = {
    bytes: Uint8Array;
    kind: 'image' | 'zip';
    /** The single photo's type, or the ZIP's. */
    mime: string;
    /** Each photo's size once cleaned. */
    sizes: number[];
};

export type WorkerMessage = WorkerReply<Cleaned>;
