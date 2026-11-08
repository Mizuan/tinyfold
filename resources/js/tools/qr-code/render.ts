import { encode } from 'uqr';

export type Ecc = 'L' | 'M' | 'Q' | 'H';

export type QrStyle = {
    dark: string;
    /** Background colour, or null for transparent. */
    light: string | null;
    /** Quiet zone around the code, in modules. */
    margin: number;
};

/** The text doesn't fit in a QR code at this error correction level. */
export class TooLong extends Error {}

/** The code's modules, true for dark, without any margin. */
export function qrMatrix(text: string, ecc: Ecc): boolean[][] {
    try {
        return encode(text, { ecc, border: 0 }).data;
    } catch {
        throw new TooLong(
            "That's too much for one QR code. Try a shorter text, or less error correction.",
        );
    }
}

/** One SVG path for all the dark modules, joining each row's runs. */
export function qrPath(matrix: boolean[][], margin: number): string {
    let path = '';

    matrix.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            if (!row[x]) {
                continue;
            }

            let run = 1;

            while (row[x + run]) {
                run++;
            }

            path += `M${x + margin} ${y + margin}h${run}v1h-${run}z`;
            x += run - 1;
        }
    });

    return path;
}

/** The code as a standalone SVG file. */
export function qrSvg(matrix: boolean[][], style: QrStyle): string {
    const size = matrix.length + style.margin * 2;
    const background = style.light
        ? `<rect width="${size}" height="${size}" fill="${style.light}"/>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${background}<path fill="${style.dark}" d="${qrPath(matrix, style.margin)}"/></svg>\n`;
}

/** Pixels per module that come closest to the wanted width. */
export function moduleSize(matrix: boolean[][], margin: number, width: number) {
    return Math.max(1, Math.round(width / (matrix.length + margin * 2)));
}

/** The code as a PNG about `width` pixels wide, with sharp module edges. */
export async function qrPng(
    matrix: boolean[][],
    style: QrStyle,
    width: number,
): Promise<Blob> {
    const scale = moduleSize(matrix, style.margin, width);
    const size = (matrix.length + style.margin * 2) * scale;
    const canvas = document.createElement('canvas');

    canvas.width = canvas.height = size;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('This browser cannot draw images.');
    }

    if (style.light) {
        context.fillStyle = style.light;
        context.fillRect(0, 0, size, size);
    }

    context.fillStyle = style.dark;
    matrix.forEach((row, y) =>
        row.forEach((dark, x) => {
            if (dark) {
                context.fillRect(
                    (x + style.margin) * scale,
                    (y + style.margin) * scale,
                    scale,
                    scale,
                );
            }
        }),
    );

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
    );

    if (!blob) {
        throw new Error('Could not save the image.');
    }

    return blob;
}

/** WCAG relative luminance of a "#rrggbb" colour. */
export function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((at) => {
        const channel = parseInt(hex.slice(at, at + 2), 16) / 255;

        return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How much two colours stand apart, from 1 (the same) to 21. */
export function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (light + 0.05) / (dark + 0.05);
}
