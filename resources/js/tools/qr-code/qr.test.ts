import { describe, expect, it } from 'vitest';
import { normaliseLink, qrPayload } from './payload';
import {
    contrast,
    moduleSize,
    qrMatrix,
    qrPath,
    qrSvg,
    TooLong,
} from './render';

describe('qrPayload', () => {
    it('adds https:// to a bare address and keeps other schemes', () => {
        expect(normaliseLink(' example.com/menu ')).toBe(
            'https://example.com/menu',
        );
        expect(normaliseLink('http://a.test')).toBe('http://a.test');
        expect(normaliseLink('tel:+9601234567')).toBe('tel:+9601234567');
        expect(qrPayload({ kind: 'link', url: '   ' })).toBe('');
    });

    it('writes Wi-Fi codes with the special characters escaped', () => {
        expect(
            qrPayload({
                kind: 'wifi',
                ssid: 'Café;Home',
                password: 'a:b,c"d\\e',
                security: 'WPA',
                hidden: true,
            }),
        ).toBe('WIFI:T:WPA;S:Café\\;Home;P:a\\:b\\,c\\"d\\\\e;H:true;;');
    });

    it('leaves the password out of an open network', () => {
        expect(
            qrPayload({
                kind: 'wifi',
                ssid: 'Guest',
                password: 'ignored',
                security: 'nopass',
                hidden: false,
            }),
        ).toBe('WIFI:T:nopass;S:Guest;;');
    });

    it('writes an email link with only the parts given', () => {
        expect(
            qrPayload({
                kind: 'email',
                to: 'hi@example.com',
                subject: 'Table for 2 & more',
                body: '',
            }),
        ).toBe('mailto:hi@example.com?subject=Table%20for%202%20%26%20more');
        expect(
            qrPayload({ kind: 'email', to: '', subject: 'x', body: 'y' }),
        ).toBe('');
    });

    it('keeps text as typed but not a blank one', () => {
        expect(qrPayload({ kind: 'text', text: ' two\nlines ' })).toBe(
            ' two\nlines ',
        );
        expect(qrPayload({ kind: 'text', text: ' \n ' })).toBe('');
    });
});

describe('qr rendering', () => {
    it('makes a square code that grows with error correction', () => {
        const low = qrMatrix('https://tinyfold.app', 'L');
        const high = qrMatrix('https://tinyfold.app', 'H');

        expect(low.length).toBe(low[0].length);
        expect(high.length).toBeGreaterThanOrEqual(low.length);
    });

    it('handles any language', () => {
        expect(qrMatrix('ހުޅުމާލެ 😀', 'M').length).toBeGreaterThan(20);
    });

    it('says when there is too much to fit', () => {
        expect(() => qrMatrix('x'.repeat(5000), 'M')).toThrow(TooLong);
    });

    it('draws each row of dark modules as joined runs, inside the margin', () => {
        const matrix = [
            [true, true, false],
            [false, false, true],
        ];

        expect(qrPath(matrix, 2)).toBe('M2 2h2v1h-2zM4 3h1v1h-1z');
    });

    it('writes an SVG with or without a background', () => {
        const matrix = [[true]];

        expect(
            qrSvg(matrix, { dark: '#000000', light: '#ffffff', margin: 4 }),
        ).toContain('viewBox="0 0 9 9"');
        expect(
            qrSvg(matrix, { dark: '#000000', light: null, margin: 0 }),
        ).not.toContain('<rect');
    });

    it('picks whole pixels per module', () => {
        expect(moduleSize(Array(25).fill([]), 4, 1024)).toBe(31);
        expect(moduleSize(Array(177).fill([]), 4, 100)).toBe(1);
    });

    it('measures colour contrast', () => {
        expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
        expect(contrast('#777777', '#777777')).toBeCloseTo(1);
    });
});
