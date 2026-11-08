import { Head } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import FileGrid, { FittedThumbnail } from '@/components/tools/file-grid';
import FileNameField from '@/components/tools/file-name-field';
import Segmented from '@/components/tools/segmented';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ImageItem } from '@/hooks/use-image-list';
import { useImageList } from '@/hooks/use-image-list';
import { formatBytes, safeFileName } from '@/lib/files';
import { renderImages } from '@/lib/render/client';
import { displayedSize } from '@/lib/rotation';
import { canSave, FORMATS, keepFormat } from '@/tools/convert-images/formats';
import type { Format } from '@/tools/convert-images/types';
import { resizedSize } from '@/tools/resize-images/size';
import type { ResizeOptions } from '@/tools/resize-images/size';

type SaveAs = 'same' | Format;

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

const pixels = (value: string) => (value.trim() === '' ? null : Number(value));

export default function ResizeImages() {
    const [mode, setMode] = useState<'size' | 'percent'>('size');
    const [width, setWidth] = useState('1920');
    const [height, setHeight] = useState('');
    const [keepProportions, setKeepProportions] = useState(true);
    const [enlarge, setEnlarge] = useState(false);
    const [percent, setPercent] = useState(50);
    const [saveAs, setSaveAs] = useState<SaveAs>('same');
    const [quality, setQuality] = useState(90);
    const [webp, setWebp] = useState(true);
    const [zipName, setZipName] = useState('resized');
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    // HEIC goes to PNG first so resizing it loses nothing extra.
    const list = useImageList({
        maxImages: 50,
        heicAs: 'image/png',
        onChange: () => setResult(null),
    });

    useEffect(() => {
        void canSave('webp').then(setWebp);
    }, []);

    const busy = progress !== null;
    const count = list.ready.length;

    const options: ResizeOptions =
        mode === 'percent'
            ? { mode, percent }
            : {
                  mode,
                  width: pixels(width),
                  height: pixels(height),
                  keepProportions,
                  enlarge,
              };

    const plan = (item: ImageItem) => {
        const upright = displayedSize(item, item.rotation);

        return {
            upright,
            size: resizedSize(upright, options),
            format:
                saveAs === 'same'
                    ? keepFormat(item.name, item.source?.type ?? '', webp)
                    : saveAs,
        };
    };

    const plans = list.ready.map(plan);
    const waiting = count > 0 && plans.some((p) => p.size === null);

    const change =
        <T,>(set: (value: T) => void) =>
        (value: T) => {
            setResult(null);
            set(value);
        };

    const resize = async () => {
        const images = list.ready.flatMap((item, i) => {
            const { size, format } = plans[i];

            return item.source && size
                ? [
                      {
                          blob: item.source,
                          name: item.name,
                          rotation: item.rotation,
                          width: size.width,
                          height: size.height,
                          format,
                      },
                  ]
                : [];
        });
        const progressLabel = (done: number) =>
            `Resizing ${Math.min(done + 1, images.length)} of ${images.length}…`;

        setProgress({ label: progressLabel(0), done: 0, total: images.length });

        const current = renderImages(
            { images, quality: quality / 100 },
            (done, total) =>
                setProgress({ label: progressLabel(done), done, total }),
        );

        job.current = current;

        try {
            const { blob, kind } = await current.promise;
            const [first] = images;
            const { extension, label } = FORMATS[first.format];

            setResult({
                blob,
                fileName:
                    kind === 'zip'
                        ? `${safeFileName(zipName, 'resized')}.zip`
                        : `${safeFileName(first.name.replace(/\.[^.]+$/, ''), 'image')}.${extension}`,
                details:
                    kind === 'zip'
                        ? `${plural(images.length, 'image', 'images')} in a ZIP`
                        : `${label}, ${first.width} × ${first.height} px`,
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while resizing.',
            );
        } finally {
            job.current = null;
            setProgress(null);
        }
    };

    const cancel = () => {
        job.current?.cancel();
        job.current = null;
        setProgress(null);
    };

    return (
        <>
            <Head title="Resize images" />

            <ToolShell
                title="Resize images"
                description="Make images a set width or height, fit them inside a size, or scale them by a percentage."
                noun="images"
                accept="image/*,.heic,.heif"
                emptyHint={`HEIC, JPG, PNG, WebP and more · up to ${list.maxItems} images`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Resize"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Preparing images…'
                                : count === 0
                                  ? 'Add an image'
                                  : waiting
                                    ? mode === 'size' && !keepProportions
                                        ? 'Type a width and a height'
                                        : 'Type a width or height'
                                    : `Resize ${plural(count, 'image', 'images')}`
                        }
                        disabled={count === 0 || list.loading || waiting}
                        progress={progress}
                        result={result}
                        onRun={resize}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Resize by"
                            value={mode}
                            onChange={change(setMode)}
                            options={[
                                { value: 'size', label: 'Size' },
                                { value: 'percent', label: 'Percentage' },
                            ]}
                        />
                        {mode === 'size' ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <PixelField
                                        id="width"
                                        label="Width"
                                        value={width}
                                        onChange={change(setWidth)}
                                    />
                                    <PixelField
                                        id="height"
                                        label="Height"
                                        value={height}
                                        onChange={change(setHeight)}
                                    />
                                </div>
                                <Label className="flex h-9 cursor-pointer items-center gap-2.5 font-normal">
                                    <Checkbox
                                        checked={keepProportions}
                                        onCheckedChange={(checked) =>
                                            change(setKeepProportions)(
                                                checked === true,
                                            )
                                        }
                                    />
                                    Keep proportions
                                </Label>
                                {keepProportions && (
                                    <Label className="flex h-9 cursor-pointer items-center gap-2.5 font-normal">
                                        <Checkbox
                                            checked={enlarge}
                                            onCheckedChange={(checked) =>
                                                change(setEnlarge)(
                                                    checked === true,
                                                )
                                            }
                                        />
                                        Make smaller images bigger
                                    </Label>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    {keepProportions
                                        ? 'Fill in one size and the other follows. With both, images fit inside that box.'
                                        : 'Images are stretched to exactly this size, so they may look squashed.'}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <Label htmlFor="percent">Scale to</Label>
                                    <span className="text-sm text-muted-foreground tabular-nums">
                                        {percent}%
                                    </span>
                                </div>
                                <input
                                    id="percent"
                                    type="range"
                                    min={5}
                                    max={100}
                                    step={5}
                                    value={percent}
                                    onChange={(event) =>
                                        change(setPercent)(
                                            Number(event.target.value),
                                        )
                                    }
                                    className="h-11 w-full cursor-pointer accent-brand"
                                />
                            </div>
                        )}
                        <Segmented
                            label="Save as"
                            value={saveAs}
                            onChange={change(setSaveAs)}
                            options={[
                                { value: 'same', label: 'Same' },
                                { value: 'jpg', label: 'JPG' },
                                { value: 'png', label: 'PNG' },
                                {
                                    value: 'webp',
                                    label: 'WebP',
                                    disabled: !webp,
                                },
                            ]}
                            hint={
                                saveAs === 'same'
                                    ? 'Each image keeps its format. iPhone photos become JPG.'
                                    : undefined
                            }
                        />
                        {saveAs !== 'png' && (
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <Label htmlFor="quality">Quality</Label>
                                    <span className="text-sm text-muted-foreground tabular-nums">
                                        {quality}%
                                    </span>
                                </div>
                                <input
                                    id="quality"
                                    type="range"
                                    min={50}
                                    max={100}
                                    step={5}
                                    value={quality}
                                    onChange={(event) =>
                                        change(setQuality)(
                                            Number(event.target.value),
                                        )
                                    }
                                    className="h-11 w-full cursor-pointer accent-brand"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    For JPG and WebP. 90% looks the same as the
                                    original for most photos.
                                </p>
                            </div>
                        )}
                        {count > 1 && (
                            <FileNameField
                                value={zipName}
                                extension="zip"
                                onChange={change(setZipName)}
                            />
                        )}
                    </>
                }
            >
                {(pick) => (
                    <FileGrid
                        list={list}
                        pick={pick}
                        busy={busy}
                        className="grid-cols-3 sm:grid-cols-4"
                        renderPreview={(item) => (
                            <FittedThumbnail item={item} />
                        )}
                        renderInfo={(item) => {
                            const { upright, size } = plan(item);

                            return size
                                ? `${upright.width}×${upright.height} → ${size.width}×${size.height}`
                                : `${upright.width}×${upright.height} · ${formatBytes(item.size)}`;
                        }}
                    />
                )}
            </ToolShell>
        </>
    );
}

function PixelField({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <Label htmlFor={id}>{label}</Label>
            <div className="mt-2 flex items-center rounded-lg border border-input bg-background focus-within:ring-[3px] focus-within:ring-ring/50">
                <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder="Auto"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
                <span className="pr-3 text-sm text-muted-foreground">px</span>
            </div>
        </div>
    );
}
