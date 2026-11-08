import { readFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { jpegOrientation } from '@/tools/images-to-pdf/exif';
import { readExif } from './exif';
import { BrokenPhoto, findInHeif, photoFormat, stripPhoto } from './strip';

const text = (value: string) => [...Buffer.from(value, 'latin1')];
const be16 = (n: number) => [n >> 8, n & 0xff];
const be32 = (n: number) => [
    n >>> 24,
    (n >> 16) & 0xff,
    (n >> 8) & 0xff,
    n & 0xff,
];
const le32 = (n: number) => [
    n & 0xff,
    (n >> 8) & 0xff,
    (n >> 16) & 0xff,
    n >>> 24,
];

/** A big-endian TIFF block: Make, Orientation, DateTime and a GPS pointer. */
function tiff(orientation: number): number[] {
    const make = [...text('Spycam'), 0];
    const date = [...text('2026:11:08 10:00:00'), 0];
    const entries = 4;
    const dataAt = 8 + 2 + entries * 12 + 4;
    const gpsAt = dataAt + make.length + date.length;

    return [
        ...text('MM'),
        ...be16(42),
        ...be32(8),
        ...be16(entries),
        ...be16(0x010f),
        ...be16(2),
        ...be32(make.length),
        ...be32(dataAt),
        ...be16(0x0112),
        ...be16(3),
        ...be32(1),
        ...be16(orientation),
        0,
        0,
        ...be16(0x0132),
        ...be16(2),
        ...be32(date.length),
        ...be32(dataAt + make.length),
        ...be16(0x8825),
        ...be16(4),
        ...be32(1),
        ...be32(gpsAt),
        ...be32(0),
        ...make,
        ...date,
        // GPS IFD with one entry: latitude reference "N".
        ...be16(1),
        ...be16(0x0001),
        ...be16(2),
        ...be32(2),
        ...text('N'),
        0,
        0,
        0,
        ...be32(0),
    ];
}

const segment = (marker: number, data: number[]) => [
    0xff,
    marker,
    ...be16(data.length + 2),
    ...data,
];

function jpeg(orientation: number): Uint8Array {
    return new Uint8Array([
        0xff,
        0xd8,
        ...segment(0xe0, [...text('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
        ...segment(0xe1, [...text('Exif'), 0, 0, ...tiff(orientation)]),
        ...segment(0xe1, [
            ...text('http://ns.adobe.com/xap/1.0/'),
            0,
            ...text('<x:xmpmeta/>'),
        ]),
        ...segment(0xe2, [...text('ICC_PROFILE'), 0, 1, 1, 9, 9, 9]),
        ...segment(0xed, [...text('Photoshop 3.0'), 0, 1, 2, 3]),
        ...segment(0xfe, text('my home address')),
        ...segment(0xdb, [0, ...Array(64).fill(1)]),
        ...segment(0xc0, [8, 0, 2, 0, 2, 1, 1, 0x11, 0]),
        ...segment(0xc4, [0, ...Array(16).fill(0)]),
        ...segment(0xda, [1, 1, 0, 0, 63, 0]),
        // Scan data with a stuffed 0xFF00 and a restart marker inside.
        0x12,
        0xff,
        0x00,
        0x34,
        0xff,
        0xd0,
        0x56,
        0xff,
        0xd9,
        // A second picture after the end, as iPhones add.
        0xff,
        0xd8,
        ...segment(0xe1, [...text('Exif'), 0, 0]),
        0xff,
        0xd9,
    ]);
}

const includes = (bytes: Uint8Array, value: string) =>
    Buffer.from(bytes).includes(Buffer.from(value, 'latin1'));

describe('stripPhoto: JPG', () => {
    it('finds and removes location, camera, date and the rest', () => {
        const { bytes, found } = stripPhoto(jpeg(1));

        expect(found).toEqual({
            location: true,
            camera: true,
            date: true,
            other: true,
            orientation: 1,
        });

        for (const gone of [
            'Exif',
            'Spycam',
            '2026:11',
            'xmpmeta',
            'Photoshop',
            'home address',
        ]) {
            expect(includes(bytes, gone)).toBe(false);
        }
    });

    it('keeps the picture, the colour profile and JFIF exactly', () => {
        const source = jpeg(1);
        const { bytes } = stripPhoto(source);
        const scan = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xd9];

        expect(includes(bytes, 'JFIF')).toBe(true);
        expect(includes(bytes, 'ICC_PROFILE')).toBe(true);
        expect([...bytes.subarray(bytes.length - scan.length)]).toEqual(scan);
        expect(bytes.length).toBeLessThan(source.length);
    });

    it('keeps the orientation, and nothing else, so the photo stays upright', () => {
        const { bytes } = stripPhoto(jpeg(6));

        expect(jpegOrientation(bytes)).toBe(6);
        expect(includes(bytes, 'Spycam')).toBe(false);
        // Right after JFIF, as the format expects.
        expect(bytes[2 + 18 + 1]).toBe(0xe1);
    });

    it('keeps the orientation of a real camera photo', () => {
        const photo = new Uint8Array(
            readFileSync('tests/fixtures/images/rotated-exif-6.jpg'),
        );
        const { bytes } = stripPhoto(photo);

        expect(jpegOrientation(bytes)).toBe(6);
        expect(photoFormat(bytes)).toBe('jpeg');
        expect(stripPhoto(bytes).bytes).toEqual(bytes);
    });

    it('refuses a damaged JPG', () => {
        expect(() => stripPhoto(jpeg(1).subarray(0, 40))).toThrow(BrokenPhoto);
    });
});

function pngChunk(type: string, data: number[]): number[] {
    const body = Buffer.from([...text(type), ...data]);

    return [...be32(data.length), ...body, ...be32(crc32(body))];
}

function png(orientation: number): Uint8Array {
    return new Uint8Array([
        0x89,
        ...text('PNG\r\n\x1a\n'),
        ...pngChunk('IHDR', [...be32(1), ...be32(1), 8, 2, 0, 0, 0]),
        ...pngChunk('tEXt', [...text('Author'), 0, ...text('Someone')]),
        ...pngChunk('eXIf', tiff(orientation)),
        ...pngChunk('iCCP', [...text('icc'), 0, 0, 1, 2]),
        ...pngChunk('tIME', [7, 234, 11, 8, 10, 0, 0]),
        ...pngChunk('IDAT', [1, 2, 3]),
        ...pngChunk('IEND', []),
    ]);
}

/** The chunk types in order, checking each chunk's CRC on the way. */
function pngChunks(bytes: Uint8Array): string[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const types: string[] = [];

    for (let pos = 8; pos < bytes.length;) {
        const length = view.getUint32(pos);
        const end = pos + 12 + length;

        expect(view.getUint32(end - 4)).toBe(
            crc32(bytes.subarray(pos + 4, end - 4)),
        );
        types.push(String.fromCharCode(...bytes.subarray(pos + 4, pos + 8)));
        pos = end;
    }

    return types;
}

describe('stripPhoto: PNG', () => {
    it('removes text, EXIF and time, keeping the picture and colour', () => {
        const { bytes, found } = stripPhoto(png(1));

        expect(pngChunks(bytes)).toEqual(['IHDR', 'iCCP', 'IDAT', 'IEND']);
        expect(found).toMatchObject({
            location: true,
            camera: true,
            date: true,
            other: true,
        });
    });

    it('keeps a lone orientation before the picture data', () => {
        const { bytes } = stripPhoto(png(3));

        expect(pngChunks(bytes)).toEqual([
            'IHDR',
            'iCCP',
            'eXIf',
            'IDAT',
            'IEND',
        ]);
        expect(includes(bytes, 'Spycam')).toBe(false);
    });
});

function webpChunk(type: string, data: number[]): number[] {
    return [
        ...text(type),
        ...le32(data.length),
        ...data,
        ...(data.length % 2 ? [0] : []),
    ];
}

function webp(): Uint8Array {
    const body = [
        ...text('WEBP'),
        ...webpChunk('VP8X', [0x20 | 0x08 | 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        ...webpChunk('ICCP', [1, 2, 3]),
        ...webpChunk('VP8 ', [9, 9, 9, 9]),
        ...webpChunk('EXIF', tiff(8)),
        ...webpChunk('XMP ', text('<x:xmpmeta/>')),
    ];

    return new Uint8Array([...text('RIFF'), ...le32(body.length), ...body]);
}

describe('stripPhoto: WebP', () => {
    it('drops XMP and EXIF but the orientation, and fixes the header', () => {
        const { bytes, found } = stripPhoto(webp());
        const view = new DataView(bytes.buffer);

        expect(found).toMatchObject({
            location: true,
            camera: true,
            orientation: 8,
        });
        expect(view.getUint32(4, true)).toBe(bytes.length - 8);
        expect(includes(bytes, 'XMP ')).toBe(false);
        expect(includes(bytes, 'Spycam')).toBe(false);
        // Colour profile and EXIF flags; XMP flag cleared.
        expect(bytes[20]).toBe(0x20 | 0x08);
        expect(readExif(bytes.subarray(bytes.length - 26)).orientation).toBe(8);
    });
});

describe('findInHeif', () => {
    it('reads the EXIF block inside an iPhone photo', () => {
        const heif = new Uint8Array([
            ...Array(40).fill(0),
            ...text('Exif'),
            0,
            0,
            0,
            0,
            0,
            0, // the item type, not the data
            ...be32(6),
            ...text('Exif'),
            0,
            0,
            ...tiff(1),
        ]);

        expect(findInHeif(heif)).toMatchObject({
            location: true,
            camera: true,
            date: true,
        });
    });

    it('finds nothing in a photo without EXIF', () => {
        expect(findInHeif(new Uint8Array(100))).toMatchObject({
            location: false,
            other: false,
        });
    });
});
