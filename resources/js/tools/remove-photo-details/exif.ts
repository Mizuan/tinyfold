/** What a photo's hidden details give away. */
export type Found = {
    location: boolean;
    camera: boolean;
    date: boolean;
    /** Anything else: descriptions, software, comments, XMP, thumbnails. */
    other: boolean;
    /** EXIF orientation (1-8), which is kept so the photo stays upright. */
    orientation: number;
};

export const nothingFound = (): Found => ({
    location: false,
    camera: false,
    date: false,
    other: false,
    orientation: 1,
});

const CAMERA_TAGS = new Set([
    0x010f, // Make
    0x0110, // Model
    0x927c, // MakerNote
    0xa430, // CameraOwnerName
    0xa431, // BodySerialNumber
    0xa432, // LensSpecification
    0xa433, // LensMake
    0xa434, // LensModel
    0xa435, // LensSerialNumber
]);

const DATE_TAGS = new Set([
    0x0132, // DateTime
    0x9003, // DateTimeOriginal
    0x9004, // DateTimeDigitized
    0x9010, // OffsetTime
    0x9011, // OffsetTimeOriginal
    0x9290, // SubSecTime
]);

// Picture settings with nothing personal in them.
const PLAIN_TAGS = new Set([
    0x0100, 0x0101, 0x0102, 0x0103, 0x0106, 0x0112, 0x0115, 0x011a, 0x011b,
    0x011c, 0x0128, 0x0213, 0x8769, 0x8825, 0x9000, 0xa000, 0xa001, 0xa002,
    0xa003, 0x0201, 0x0202, 0x9101, 0xa005,
]);

/**
 * Read what EXIF data (a TIFF block, starting "II*" or "MM*") reveals. Broken
 * data counts as "other", since it was there all the same.
 */
export function readExif(tiff: Uint8Array): Found {
    const found = nothingFound();
    const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);

    if (tiff.length < 8) {
        found.other = true;

        return found;
    }

    const little = view.getUint16(0) === 0x4949;
    const u16 = (at: number) => view.getUint16(at, little);
    const u32 = (at: number) => view.getUint32(at, little);
    const seen = new Set<number>();

    const walk = (offset: number, main: boolean) => {
        if (seen.has(offset) || offset < 8 || offset + 2 > tiff.length) {
            found.other = true;

            return;
        }

        seen.add(offset);

        const count = u16(offset);

        for (let i = 0; i < count; i++) {
            const entry = offset + 2 + i * 12;

            if (entry + 12 > tiff.length) {
                found.other = true;

                return;
            }

            const tag = u16(entry);

            if (tag === 0x0112 && main) {
                const value = u16(entry + 8);

                found.orientation = value >= 1 && value <= 8 ? value : 1;
            } else if (tag === 0x8825) {
                found.location = true;
            } else if (tag === 0x8769) {
                walk(u32(entry + 8), false);
            } else if (DATE_TAGS.has(tag)) {
                found.date = true;
            } else if (
                CAMERA_TAGS.has(tag) ||
                // The camera's own block: exposure, lens, flash and so on.
                (!main && !PLAIN_TAGS.has(tag))
            ) {
                found.camera = true;
            } else if (!PLAIN_TAGS.has(tag)) {
                found.other = true;
            }
        }

        // A second IFD holds a small preview of the photo.
        const next = offset + 2 + count * 12;

        if (main && next + 4 <= tiff.length && u32(next) !== 0) {
            found.other = true;
        }
    };

    walk(u32(4), true);

    return found;
}

/** A TIFF block holding nothing but the orientation. */
export function orientationOnly(orientation: number): Uint8Array {
    const bytes = new Uint8Array(26);
    const view = new DataView(bytes.buffer);

    bytes.set([0x4d, 0x4d, 0x00, 0x2a]); // "MM*"
    view.setUint32(4, 8); // first IFD
    view.setUint16(8, 1); // one entry
    view.setUint16(10, 0x0112); // Orientation
    view.setUint16(12, 3); // SHORT
    view.setUint32(14, 1); // one value
    view.setUint16(18, orientation);
    view.setUint32(22, 0); // no next IFD

    return bytes;
}

/** Combine what two sources found. */
export function merge(a: Found, b: Found): Found {
    return {
        location: a.location || b.location,
        camera: a.camera || b.camera,
        date: a.date || b.date,
        other: a.other || b.other,
        orientation: a.orientation !== 1 ? a.orientation : b.orientation,
    };
}
