import { runWorker } from '@/lib/worker';
import type { Cleaned, CleanRequest } from './types';
import workerUrl from './worker?worker&url';

/** Remove the photos' hidden details in a Web Worker. */
export function cleanPhotos(
    request: CleanRequest,
    onProgress: (done: number, total: number) => void,
): {
    promise: Promise<{ blob: Blob; kind: 'image' | 'zip'; sizes: number[] }>;
    cancel: () => void;
} {
    const job = runWorker<CleanRequest, Cleaned>(
        workerUrl,
        request,
        onProgress,
    );

    return {
        cancel: job.cancel,
        promise: job.promise.then(({ bytes, kind, mime, sizes }) => ({
            blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }),
            kind,
            sizes,
        })),
    };
}
