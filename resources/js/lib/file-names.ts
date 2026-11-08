import { safeFileName } from './files';

/**
 * Give each file a new extension ("IMG_0012.HEIC" → "IMG_0012.jpg"),
 * numbering duplicates so nothing in a ZIP is overwritten.
 */
export function withExtension(
    names: string[],
    extension: string,
    fallback = 'file',
): string[] {
    return withExtensions(
        names.map((name) => [name, extension]),
        fallback,
    );
}

/** As `withExtension`, with each file's own new extension. */
export function withExtensions(
    files: [name: string, extension: string][],
    fallback = 'file',
): string[] {
    const used = new Set<string>();

    return files.map(([name, extension], index) => {
        const base = safeFileName(
            name.replace(/\.[^.]+$/, ''),
            `${fallback}-${index + 1}`,
        );
        let candidate = `${base}.${extension}`;

        for (let n = 2; used.has(candidate.toLowerCase()); n++) {
            candidate = `${base} (${n}).${extension}`;
        }

        used.add(candidate.toLowerCase());

        return candidate;
    });
}

/** A PDF name for each image, as `withExtension` with "page" fallbacks. */
export function pdfNames(imageNames: string[]): string[] {
    return withExtension(imageNames, 'pdf', 'page');
}
