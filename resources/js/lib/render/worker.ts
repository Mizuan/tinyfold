/// <reference lib="webworker" />
import { zipSync } from 'fflate';
import { withExtensions } from '@/lib/file-names';
import { FORMATS } from '@/tools/convert-images/formats';
import { renderImage } from './render-image';
import type { RenderRequest, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

self.onmessage = async ({ data }: MessageEvent<RenderRequest>) => {
    const { images, quality } = data;
    const outputs: Uint8Array[] = [];

    try {
        for (const [i, image] of images.entries()) {
            const bitmap = await createImageBitmap(image.blob, {
                imageOrientation: 'from-image',
            });
            const blob = await renderImage({ bitmap, quality, ...image });

            bitmap.close();
            outputs.push(new Uint8Array(await blob.arrayBuffer()));
            post({ type: 'progress', done: i + 1, total: images.length });
        }

        const sizes = outputs.map((output) => output.byteLength);

        if (outputs.length === 1) {
            post({ type: 'done', bytes: outputs[0], kind: 'image', sizes }, [
                outputs[0].buffer,
            ]);

            return;
        }

        const names = withExtensions(
            images.map((image) => [
                image.name,
                FORMATS[image.format].extension,
            ]),
            'image',
        );
        const bytes = zipSync(
            Object.fromEntries(names.map((name, i) => [name, outputs[i]])),
            { level: 0 },
        );

        post({ type: 'done', bytes, kind: 'zip', sizes }, [bytes.buffer]);
    } catch (error) {
        post({
            type: 'error',
            message:
                error instanceof Error && error.message
                    ? error.message
                    : 'Something went wrong while saving the images.',
        });
    }
};
