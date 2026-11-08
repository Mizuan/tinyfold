import type { Found } from './exif';
import { merge, nothingFound, orientationOnly, readExif } from './exif';

export type PhotoFormat = 'jpeg' | 'png' | 'webp';

export type Stripped = { bytes: Uint8Array; found: Found };

/** The photo can't be read as the format it claims to be. */
export class BrokenPhoto extends Error {}

const ascii = (bytes: Uint8Array, from: number, length: number) =>
    String.fromCharCode(...bytes.subarray(from, from + length));

const startsWith = (bytes: Uint8Array, at: number, text: string) =>
    at + text.length <= bytes.length && ascii(bytes, at, text.length) === text;

export function photoFormat(bytes: Uint8Array): PhotoFormat | null {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'jpeg';
    }

    if (startsWith(bytes, 0, '\x89PNG\r\n\x1a\n')) {
        return 'png';
    }

    if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) {
        return 'webp';
    }

    return null;
}

/**
 * Remove a photo's hidden details without touching the picture: location,
 * camera, dates, comments and the rest go; the colour profile and the
 * orientation (as a tiny EXIF block of its own) stay.
 */
export function stripPhoto(bytes: Uint8Array): Stripped {
    switch (photoFormat(bytes)) {
        case 'jpeg':
            return stripJpeg(bytes);
        case 'png':
            return stripPng(bytes);
        case 'webp':
            return stripWebp(bytes);
        default:
            throw new BrokenPhoto('Only JPG, PNG, WebP and HEIC photos.');
    }
}

const EXIF = 'Exif\0\0';

/** The TIFF block of an "Exif\0\0"-prefixed payload, or the payload itself. */
const tiffOf = (data: Uint8Array) =>
    startsWith(data, 0, EXIF) ? data.subarray(6) : data;

function stripJpeg(bytes: Uint8Array): Stripped {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const kept: Uint8Array[] = [];
    let found = nothingFound();
    let afterApp0 = 0;
    let pos = 2;

    const fail = () => {
        throw new BrokenPhoto('This JPG looks damaged.');
    };

    for (;;) {
        if (pos + 2 > bytes.length || bytes[pos] !== 0xff) {
            fail();
        }

        const marker = bytes[pos + 1];

        // Fill bytes before a marker.
        if (marker === 0xff) {
            pos += 1;
            continue;
        }

        if (marker === 0xd9) {
            kept.push(bytes.subarray(pos, pos + 2));

            // Anything after the end, e.g. iPhone depth and HDR images, which
            // can carry their own details, is left out.
            found.other ||= pos + 2 < bytes.length;
            break;
        }

        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            kept.push(bytes.subarray(pos, pos + 2));
            pos += 2;
            continue;
        }

        if (pos + 4 > bytes.length) {
            fail();
        }

        const end = pos + 2 + view.getUint16(pos + 2);

        if (end > bytes.length) {
            fail();
        }

        const data = bytes.subarray(pos + 4, end);

        if (marker === 0xda) {
            // The picture itself: copy up to the next real marker.
            let next = end;

            while (
                next + 1 < bytes.length &&
                !(
                    bytes[next] === 0xff &&
                    bytes[next + 1] !== 0x00 &&
                    bytes[next + 1] !== 0xff &&
                    !(bytes[next + 1] >= 0xd0 && bytes[next + 1] <= 0xd7)
                )
            ) {
                next++;
            }

            kept.push(bytes.subarray(pos, next));
            pos = next;
            continue;
        }

        const app = marker >= 0xe0 && marker <= 0xef;
        const keep =
            (!app && marker !== 0xfe) ||
            marker === 0xe0 || // JFIF
            marker === 0xee || // Adobe colour transform
            (marker === 0xe2 && startsWith(data, 0, 'ICC_PROFILE\0'));

        if (keep) {
            kept.push(bytes.subarray(pos, end));

            if (marker === 0xe0 && kept.length === afterApp0 + 1) {
                afterApp0 = kept.length;
            }
        } else if (marker === 0xe1 && startsWith(data, 0, EXIF)) {
            found = merge(found, readExif(data.subarray(6)));
        } else {
            found.other = true;
        }

        pos = end;
    }

    if (found.orientation !== 1) {
        const tiff = orientationOnly(found.orientation);
        const segment = new Uint8Array(4 + 6 + tiff.length);

        segment.set([0xff, 0xe1, 0, 0]);
        new DataView(segment.buffer).setUint16(2, segment.length - 2);
        segment.set(new TextEncoder().encode(EXIF), 4);
        segment.set(tiff, 10);
        kept.splice(afterApp0, 0, segment);
    }

    return { bytes: join([bytes.subarray(0, 2), ...kept]), found };
}

// Chunks that only describe how to show the picture.
const PNG_KEEP = new Set([
    'tRNS',
    'cHRM',
    'gAMA',
    'iCCP',
    'sBIT',
    'sRGB',
    'cICP',
    'mDCV',
    'cLLI',
    'bKGD',
    'pHYs',
    'hIST',
    'sPLT',
    'acTL',
    'fcTL',
    'fdAT',
]);

function stripPng(bytes: Uint8Array): Stripped {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const kept: Uint8Array[] = [bytes.subarray(0, 8)];
    let found = nothingFound();
    let firstData = -1;
    let pos = 8;

    while (pos + 12 <= bytes.length) {
        const length = view.getUint32(pos);
        const end = pos + 12 + length;
        const type = ascii(bytes, pos + 4, 4);

        if (end > bytes.length) {
            throw new BrokenPhoto('This PNG looks damaged.');
        }

        // Upper case first letter: a chunk the picture can't do without.
        const critical = type.charCodeAt(0) < 0x61;

        if (critical || PNG_KEEP.has(type)) {
            if (type === 'IDAT' && firstData < 0) {
                firstData = kept.length;
            }

            kept.push(bytes.subarray(pos, end));
        } else if (type === 'eXIf') {
            found = merge(
                found,
                readExif(tiffOf(bytes.subarray(pos + 8, end - 4))),
            );
        } else if (type === 'tIME') {
            found.date = true;
        } else {
            found.other = true;
        }

        pos = end;

        if (type === 'IEND') {
            break;
        }
    }

    if (found.orientation !== 1 && firstData > 0) {
        kept.splice(
            firstData,
            0,
            pngChunk('eXIf', orientationOnly(found.orientation)),
        );
    }

    return { bytes: join(kept), found };
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);

    view.setUint32(0, data.length);
    chunk.set(new TextEncoder().encode(type), 4);
    chunk.set(data, 8);
    view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));

    return chunk;
}

const WEBP_KEEP = new Set([
    'VP8 ',
    'VP8L',
    'VP8X',
    'ALPH',
    'ANIM',
    'ANMF',
    'ICCP',
]);
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function stripWebp(bytes: Uint8Array): Stripped {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const kept: Uint8Array[] = [];
    let found = nothingFound();
    let pos = 12;

    while (pos + 8 <= bytes.length) {
        const type = ascii(bytes, pos, 4);
        const size = view.getUint32(pos + 4, true);
        const end = pos + 8 + size + (size % 2);

        if (pos + 8 + size > bytes.length) {
            throw new BrokenPhoto('This WebP looks damaged.');
        }

        if (WEBP_KEEP.has(type)) {
            kept.push(bytes.slice(pos, Math.min(end, bytes.length)));
        } else if (type === 'EXIF') {
            found = merge(
                found,
                readExif(tiffOf(bytes.subarray(pos + 8, pos + 8 + size))),
            );
        } else {
            found.other = true;
        }

        pos = end;
    }

    const extended = kept.find((chunk) => startsWith(chunk, 0, 'VP8X'));

    if (extended) {
        extended[8] &= ~(VP8X_EXIF | VP8X_XMP);

        if (found.orientation !== 1) {
            const tiff = orientationOnly(found.orientation);
            const chunk = new Uint8Array(8 + tiff.length);

            chunk.set(new TextEncoder().encode('EXIF'));
            new DataView(chunk.buffer).setUint32(4, tiff.length, true);
            chunk.set(tiff, 8);
            kept.push(chunk);
            extended[8] |= VP8X_EXIF;
        }
    }

    const body = join(kept);
    const header = new Uint8Array(12);

    header.set(bytes.subarray(0, 12));
    new DataView(header.buffer).setUint32(4, body.length + 4, true);

    return { bytes: join([header, body]), found };
}

/**
 * What an iPhone (HEIC) photo's EXIF block reveals. It sits in the file as
 * "Exif\0\0" followed by a TIFF header.
 */
export function findInHeif(bytes: Uint8Array): Found {
    for (let at = 0; at + 10 <= bytes.length; at++) {
        if (
            bytes[at] === 0x45 && // "E"
            startsWith(bytes, at, EXIF) &&
            (startsWith(bytes, at + 6, 'MM\0*') ||
                startsWith(bytes, at + 6, 'II*\0'))
        ) {
            return readExif(bytes.subarray(at + 6));
        }
    }

    return nothingFound();
}

function join(parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(
        parts.reduce((sum, part) => sum + part.length, 0),
    );
    let at = 0;

    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }

    return out;
}

let table: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
    if (!table) {
        table = new Uint32Array(256);

        for (let n = 0; n < 256; n++) {
            let c = n;

            for (let k = 0; k < 8; k++) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }

            table[n] = c >>> 0;
        }
    }

    let crc = 0xffffffff;

    for (const byte of data) {
        crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}
