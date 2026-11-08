export type QrContent =
    | { kind: 'link'; url: string }
    | { kind: 'text'; text: string }
    | {
          kind: 'wifi';
          ssid: string;
          password: string;
          security: 'WPA' | 'WEP' | 'nopass';
          hidden: boolean;
      }
    | { kind: 'email'; to: string; subject: string; body: string };

/** "example.com/menu" → "https://example.com/menu"; links with a scheme stay. */
export function normaliseLink(url: string): string {
    const trimmed = url.trim();

    if (!trimmed || /^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
        return trimmed;
    }

    return `https://${trimmed}`;
}

/** Wi-Fi codes need \ ; , : and " escaped with a backslash. */
const escapeWifi = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');

/**
 * The text to put in the code, in the form phones understand (a Wi-Fi code
 * joins the network, an email code opens a new email). Empty when there's
 * nothing to encode yet.
 */
export function qrPayload(content: QrContent): string {
    switch (content.kind) {
        case 'link':
            return normaliseLink(content.url);
        case 'text':
            return content.text.trim() ? content.text : '';
        case 'wifi': {
            if (!content.ssid) {
                return '';
            }

            const password =
                content.security === 'nopass'
                    ? ''
                    : `P:${escapeWifi(content.password)};`;

            return `WIFI:T:${content.security};S:${escapeWifi(content.ssid)};${password}${content.hidden ? 'H:true;' : ''};`;
        }
        case 'email': {
            const to = content.to.trim();

            if (!to) {
                return '';
            }

            const query = [
                ['subject', content.subject],
                ['body', content.body],
            ]
                .filter(([, value]) => value.trim())
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join('&');

            return `mailto:${to}${query ? `?${query}` : ''}`;
        }
    }
}
