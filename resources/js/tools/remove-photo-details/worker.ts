/// <reference lib="webworker" />
import { zipSync } from 'fflate';
import { withExtensions } from '@/lib/file-names';
import { BrokenPhoto, photoFormat, stripPhoto } from './strip';
import type { CleanRequest, WorkerMessage } from './types';

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer);

const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

self.onmessage = async ({ data }: MessageEvent<CleanRequest>) => {
    const { photos } = data;
    const outputs: Uint8Array[] = [];

    try {
        for (const [i, photo] of photos.entries()) {
            const { bytes } = stripPhoto(
                new Uint8Array(await photo.blob.arrayBuffer()),
            );

            outputs.push(bytes);
            post({ type: 'progress', done: i + 1, total: photos.length });
        }

        const sizes = outputs.map((output) => output.byteLength);

        if (outputs.length === 1) {
            const format = photoFormat(outputs[0]) ?? 'jpeg';

            post(
                {
                    type: 'done',
                    bytes: outputs[0],
                    kind: 'image',
                    mime: MIME[format],
                    sizes,
                },
                [outputs[0].buffer],
            );

            return;
        }

        // Same names as before; iPhone photos become .jpg.
        const names = withExtensions(
            photos.map((photo) => [
                photo.name,
                photo.heif
                    ? 'jpg'
                    : (/\.([^.]+)$/.exec(photo.name)?.[1] ?? 'jpg'),
            ]),
            'photo',
        );
        const bytes = zipSync(
            Object.fromEntries(names.map((name, i) => [name, outputs[i]])),
            { level: 0 },
        );

        post(
            {
                type: 'done',
                bytes,
                kind: 'zip',
                mime: 'application/zip',
                sizes,
            },
            [bytes.buffer],
        );
    } catch (error) {
        post({
            type: 'error',
            message:
                error instanceof BrokenPhoto
                    ? `${error.message} Remove it and try again.`
                    : 'Something went wrong while removing the details.',
        });
    }
};
