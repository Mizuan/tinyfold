import { describe, expect, it } from 'vitest';
import { pdfNames, withExtension, withExtensions } from './file-names';

describe('pdfNames', () => {
    it('swaps the image extension for .pdf', () => {
        expect(pdfNames(['IMG_0012.HEIC', 'scan.final.png'])).toEqual([
            'IMG_0012.pdf',
            'scan.final.pdf',
        ]);
    });

    it('numbers duplicates, ignoring case', () => {
        expect(pdfNames(['photo.jpg', 'Photo.png', 'photo.webp'])).toEqual([
            'photo.pdf',
            'Photo (2).pdf',
            'photo (3).pdf',
        ]);
    });

    it('cleans unsafe characters and falls back to the page number', () => {
        expect(pdfNames(['a/b:c?.jpg', '.png'])).toEqual([
            'a b c.pdf',
            'page-2.pdf',
        ]);
    });
});

describe('withExtension', () => {
    it('swaps any extension and numbers clashes', () => {
        expect(
            withExtension(['IMG_1.HEIC', 'img_1.png', 'scan'], 'jpg'),
        ).toEqual(['IMG_1.jpg', 'img_1 (2).jpg', 'scan.jpg']);
    });

    it('falls back to a numbered name', () => {
        expect(withExtension(['.png'], 'webp', 'image')).toEqual([
            'image-1.webp',
        ]);
    });
});

describe('withExtensions', () => {
    it('gives each file its own extension, numbering only real clashes', () => {
        expect(
            withExtensions([
                ['photo.HEIC', 'jpg'],
                ['photo.png', 'png'],
                ['photo.jpeg', 'jpg'],
            ]),
        ).toEqual(['photo.jpg', 'photo.png', 'photo (2).jpg']);
    });
});
