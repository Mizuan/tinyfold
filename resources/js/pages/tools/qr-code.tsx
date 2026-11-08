import { Head } from '@inertiajs/react';
import { CircleAlert, ClipboardCopy, Download } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import PasswordInput from '@/components/password-input';
import Segmented from '@/components/tools/segmented';
import ToolHeader from '@/components/tools/tool-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadBlob } from '@/lib/files';
import { cn } from '@/lib/utils';
import type { QrContent } from '@/tools/qr-code/payload';
import { qrPayload } from '@/tools/qr-code/payload';
import type { Ecc, QrStyle } from '@/tools/qr-code/render';
import {
    contrast,
    luminance,
    moduleSize,
    qrMatrix,
    qrPath,
    qrPng,
    qrSvg,
    TooLong,
} from '@/tools/qr-code/render';

type Kind = QrContent['kind'];

const ECC_HINTS: Record<Ecc, string> = {
    L: 'The simplest code. Fine on screens and clean prints.',
    M: 'A good balance for most uses.',
    Q: 'Still scans when a bit worn or smudged.',
    H: 'Survives the most damage, but makes a busier code.',
};

const textareaClass =
    'mt-2 min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm';

export default function QrCode() {
    const [kind, setKind] = useState<Kind>('link');
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const [security, setSecurity] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
    const [hidden, setHidden] = useState(false);
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [ecc, setEcc] = useState<Ecc>('M');
    const [margin, setMargin] = useState(4);
    const [dark, setDark] = useState('#000000');
    const [light, setLight] = useState('#ffffff');
    const [transparent, setTransparent] = useState(false);
    const [width, setWidth] = useState(1024);

    const content: QrContent =
        kind === 'link'
            ? { kind, url }
            : kind === 'text'
              ? { kind, text }
              : kind === 'wifi'
                ? { kind, ssid, password, security, hidden }
                : { kind, to, subject, body };
    const payload = qrPayload(content);
    const style: QrStyle = {
        dark,
        light: transparent ? null : light,
        margin,
    };

    let matrix: boolean[][] | null = null;
    let problem: string | null = null;

    if (payload) {
        try {
            matrix = qrMatrix(payload, ecc);
        } catch (error) {
            problem =
                error instanceof TooLong
                    ? error.message
                    : "This text can't be put in a QR code.";
        }
    }

    const warning = transparent
        ? 'Transparent codes need a light background behind them to scan.'
        : luminance(dark) > luminance(light)
          ? 'Some phones can’t read light codes on a dark background.'
          : contrast(dark, light) < 3
            ? 'The colours are close, so some phones may not read the code.'
            : null;

    const pixels = matrix
        ? moduleSize(matrix, margin, width) * (matrix.length + margin * 2)
        : width;

    const savePng = async () => {
        if (matrix) {
            downloadBlob(await qrPng(matrix, style, width), 'qr-code.png');
        }
    };

    const saveSvg = () => {
        if (matrix) {
            downloadBlob(
                new Blob([qrSvg(matrix, style)], { type: 'image/svg+xml' }),
                'qr-code.svg',
            );
        }
    };

    const canCopy =
        typeof window !== 'undefined' &&
        'ClipboardItem' in window &&
        typeof navigator.clipboard?.write === 'function';

    const copy = async () => {
        if (!matrix) {
            return;
        }

        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': qrPng(matrix, style, width),
                }),
            ]);
            toast.success('QR code copied. Paste it where you need it.');
        } catch {
            toast.error("Copying didn't work here. Try downloading instead.");
        }
    };

    return (
        <>
            <Head title="QR code generator" />

            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
                <ToolHeader
                    title="QR code generator"
                    description="Make a QR code for a link, some text, your Wi-Fi or an email. Download it as PNG or SVG, ready to print."
                    note="Made on this device. Nothing you type is sent anywhere."
                />

                <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
                    <Card title="What's in the code" className="lg:col-start-1">
                        <Segmented
                            label="Type"
                            hideLabel
                            value={kind}
                            onChange={setKind}
                            options={[
                                { value: 'link', label: 'Link' },
                                { value: 'text', label: 'Text' },
                                { value: 'wifi', label: 'Wi-Fi' },
                                { value: 'email', label: 'Email' },
                            ]}
                        />

                        {kind === 'link' && (
                            <Field id="url" label="Link">
                                <Input
                                    id="url"
                                    type="url"
                                    inputMode="url"
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder="https://example.com"
                                    value={url}
                                    onChange={(event) =>
                                        setUrl(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </Field>
                        )}

                        {kind === 'text' && (
                            <Field id="text" label="Text">
                                <textarea
                                    id="text"
                                    value={text}
                                    onChange={(event) =>
                                        setText(event.target.value)
                                    }
                                    placeholder="Anything you like"
                                    className={textareaClass}
                                />
                            </Field>
                        )}

                        {kind === 'wifi' && (
                            <>
                                <Field id="ssid" label="Network name">
                                    <Input
                                        id="ssid"
                                        autoComplete="off"
                                        spellCheck={false}
                                        value={ssid}
                                        onChange={(event) =>
                                            setSsid(event.target.value)
                                        }
                                        className="mt-2 h-11"
                                    />
                                </Field>
                                <Segmented
                                    label="Security"
                                    value={security}
                                    onChange={setSecurity}
                                    options={[
                                        { value: 'WPA', label: 'WPA' },
                                        { value: 'WEP', label: 'WEP' },
                                        { value: 'nopass', label: 'None' },
                                    ]}
                                    hint="Most networks use WPA, which covers WPA2 and WPA3 too."
                                />
                                {security !== 'nopass' && (
                                    <Field id="wifi-password" label="Password">
                                        <div className="mt-2">
                                            <PasswordInput
                                                id="wifi-password"
                                                autoComplete="off"
                                                value={password}
                                                onChange={(event) =>
                                                    setPassword(
                                                        event.target.value,
                                                    )
                                                }
                                                className="h-11"
                                            />
                                        </div>
                                    </Field>
                                )}
                                <Label className="flex h-9 cursor-pointer items-center gap-2.5 font-normal">
                                    <Checkbox
                                        checked={hidden}
                                        onCheckedChange={(checked) =>
                                            setHidden(checked === true)
                                        }
                                    />
                                    Hidden network
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Anyone who scans the code joins the network,
                                    so share it only with people you'd give the
                                    password to.
                                </p>
                            </>
                        )}

                        {kind === 'email' && (
                            <>
                                <Field id="to" label="Email address">
                                    <Input
                                        id="to"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="off"
                                        placeholder="name@example.com"
                                        value={to}
                                        onChange={(event) =>
                                            setTo(event.target.value)
                                        }
                                        className="mt-2 h-11"
                                    />
                                </Field>
                                <Field id="subject" label="Subject (optional)">
                                    <Input
                                        id="subject"
                                        value={subject}
                                        onChange={(event) =>
                                            setSubject(event.target.value)
                                        }
                                        className="mt-2 h-11"
                                    />
                                </Field>
                                <Field id="body" label="Message (optional)">
                                    <textarea
                                        id="body"
                                        value={body}
                                        onChange={(event) =>
                                            setBody(event.target.value)
                                        }
                                        className={textareaClass}
                                    />
                                </Field>
                            </>
                        )}
                    </Card>

                    <aside
                        aria-label="QR code"
                        className="rounded-3xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1"
                    >
                        <div
                            className={cn(
                                'mx-auto flex aspect-square w-full max-w-72 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-border',
                                transparent
                                    ? 'bg-[conic-gradient(#e5e3dc_25%,#fff_0_50%,#e5e3dc_0_75%,#fff_0)] bg-[length:16px_16px]'
                                    : 'bg-muted',
                            )}
                        >
                            {matrix ? (
                                <svg
                                    role="img"
                                    aria-label={`QR code for ${payload}`}
                                    viewBox={`0 0 ${matrix.length + margin * 2} ${matrix.length + margin * 2}`}
                                    shapeRendering="crispEdges"
                                    className="size-full"
                                >
                                    {style.light && (
                                        <rect
                                            width="100%"
                                            height="100%"
                                            fill={style.light}
                                        />
                                    )}
                                    <path
                                        fill={dark}
                                        d={qrPath(matrix, margin)}
                                    />
                                </svg>
                            ) : (
                                <p className="px-6 text-center text-sm text-muted-foreground">
                                    {problem ?? 'Your QR code shows up here.'}
                                </p>
                            )}
                        </div>

                        {problem && (
                            <p className="mt-3 flex gap-2 text-sm text-destructive-foreground">
                                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                                {problem}
                            </p>
                        )}
                        {matrix && warning && (
                            <p className="mt-3 flex gap-2 rounded-xl bg-secondary px-3 py-2.5 text-sm">
                                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                                {warning}
                            </p>
                        )}

                        <div className="mt-5 space-y-2">
                            <Button
                                onClick={savePng}
                                disabled={!matrix}
                                className="h-12 w-full rounded-full text-base"
                            >
                                <Download className="size-5" />
                                Download PNG
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={saveSvg}
                                    disabled={!matrix}
                                    className="h-11 flex-1 rounded-full"
                                >
                                    Download SVG
                                </Button>
                                {canCopy && (
                                    <Button
                                        variant="outline"
                                        onClick={copy}
                                        disabled={!matrix}
                                        className="h-11 flex-1 rounded-full"
                                    >
                                        <ClipboardCopy />
                                        Copy
                                    </Button>
                                )}
                            </div>
                            <p className="pt-1 text-center text-xs text-muted-foreground">
                                {matrix
                                    ? `PNG ${pixels} × ${pixels} px. SVG stays sharp at any size, best for print.`
                                    : 'Scan it with your phone camera to check it works.'}
                            </p>
                        </div>
                    </aside>

                    <Card title="Look" className="lg:col-start-1">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <ColourField
                                id="dark"
                                label="Code colour"
                                value={dark}
                                onChange={setDark}
                            />
                            <div>
                                <ColourField
                                    id="light"
                                    label="Background"
                                    value={light}
                                    onChange={setLight}
                                    disabled={transparent}
                                />
                                <Label className="mt-1 flex h-9 cursor-pointer items-center gap-2.5 font-normal">
                                    <Checkbox
                                        checked={transparent}
                                        onCheckedChange={(checked) =>
                                            setTransparent(checked === true)
                                        }
                                    />
                                    Transparent
                                </Label>
                            </div>
                        </div>
                        <Segmented
                            label="Error correction"
                            value={ecc}
                            onChange={setEcc}
                            options={[
                                { value: 'L', label: 'Low' },
                                { value: 'M', label: 'Medium' },
                                { value: 'Q', label: 'High' },
                                { value: 'H', label: 'Highest' },
                            ]}
                            hint={ECC_HINTS[ecc]}
                        />
                        <div className="grid gap-5 sm:grid-cols-2">
                            <Segmented
                                label="Border"
                                value={String(margin)}
                                onChange={(value) => setMargin(Number(value))}
                                options={[
                                    { value: '0', label: 'None' },
                                    { value: '2', label: 'Thin' },
                                    { value: '4', label: 'Standard' },
                                ]}
                            />
                            <Segmented
                                label="PNG size"
                                value={String(width)}
                                onChange={(value) => setWidth(Number(value))}
                                options={[
                                    { value: '512', label: 'Small' },
                                    { value: '1024', label: 'Medium' },
                                    { value: '2048', label: 'Large' },
                                ]}
                            />
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}

function Card({
    title,
    className,
    children,
}: {
    title: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section
            className={cn(
                'min-w-0 rounded-3xl border border-border bg-card p-5 sm:p-6',
                className,
            )}
        >
            <h2 className="font-display text-xl font-bold tracking-tight">
                {title}
            </h2>
            <div className="mt-5 space-y-5">{children}</div>
        </section>
    );
}

function Field({
    id,
    label,
    children,
}: {
    id: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <div>
            <Label htmlFor={id}>{label}</Label>
            {children}
        </div>
    );
}

function ColourField({
    id,
    label,
    value,
    onChange,
    disabled = false,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    return (
        <div className={cn(disabled && 'opacity-50')}>
            <Label htmlFor={id}>{label}</Label>
            <label className="mt-2 flex h-11 cursor-pointer items-center gap-3 rounded-lg border border-input bg-background px-2 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                <span
                    className="relative size-7 rounded-md ring-1 ring-border"
                    style={{ background: value }}
                >
                    <input
                        id={id}
                        type="color"
                        value={value}
                        disabled={disabled}
                        onChange={(event) => onChange(event.target.value)}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                </span>
                <span className="font-mono text-sm uppercase">{value}</span>
            </label>
        </div>
    );
}
