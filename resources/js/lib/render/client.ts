import { runWorker } from '@/lib/worker';
import { FORMATS } from '@/tools/convert-images/formats';
import type { Rendered, RenderRequest } from './types';
import workerUrl from './worker?worker&url';

/** Draw and save the images in a Web Worker. */
export function renderImages(
    request: RenderRequest,
    onProgress: (done: number, total: number) => void,
): {
    promise: Promise<{ blob: Blob; kind: 'image' | 'zip'; sizes: number[] }>;
    cancel: () => void;
} {
    const job = runWorker<RenderRequest, Rendered>(
        workerUrl,
        request,
        onProgress,
    );

    return {
        cancel: job.cancel,
        promise: job.promise.then(({ bytes, kind, sizes }) => ({
            blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
                type:
                    kind === 'zip'
                        ? 'application/zip'
                        : FORMATS[request.images[0].format].mime,
            }),
            kind,
            sizes,
        })),
    };
}
