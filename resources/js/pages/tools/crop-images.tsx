import { Head } from '@inertiajs/react';
import { CircleAlert, Copy, Plus, RotateCcw, RotateCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FittedThumbnail } from '@/components/tools/file-grid';
import FileNameField from '@/components/tools/file-name-field';
import Segmented from '@/components/tools/segmented';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { ImageItem } from '@/hooks/use-image-list';
import { useImageList } from '@/hooks/use-image-list';
import { safeFileName } from '@/lib/files';
import { renderImages } from '@/lib/render/client';
import type { Rect } from '@/lib/render/render-image';
import type { Rotation } from '@/lib/rotation';
import { displayedSize } from '@/lib/rotation';
import { cn } from '@/lib/utils';
import {
    canSave,
    FORMATS,
    keepFormat,
    outputSize,
} from '@/tools/convert-images/formats';
import type { Format } from '@/tools/convert-images/types';
import { defaultCrop, matchCrop, pixelCrop } from '@/tools/crop-images/crop';
import CropEditor from '@/tools/crop-images/crop-editor';

type Ratio =
    | 'free'
    | 'original'
    | '1:1'
    | '5:4'
    | '4:3'
    | '3:2'
    | '16:9'
    | 'a4';
type SaveAs = 'same' | Format;

/** Landscape shapes, width over height; portrait turns them round. */
const SHAPES: Partial<Record<Ratio, number>> = {
    '5:4': 5 / 4,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    '16:9': 16 / 9,
    a4: Math.SQRT2,
};

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

export default function CropImages() {
    const [ratio, setRatio] = useState<Ratio>('free');
    const [portrait, setPortrait] = useState(false);
    const [crops, setCrops] = useState<
        Record<string, { rotation: Rotation; rect: Rect }>
    >({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [saveAs, setSaveAs] = useState<SaveAs>('same');
    const [quality, setQuality] = useState(90);
    const [webp, setWebp] = useState(true);
    const [zipName, setZipName] = useState('cropped');
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    // HEIC goes to PNG first so cropping it loses nothing extra.
    const list = useImageList({
        maxImages: 30,
        heicAs: 'image/png',
        onChange: () => setResult(null),
    });

    useEffect(() => {
        void canSave('webp').then(setWebp);
    }, []);

    const selected =
        list.ready.find((item) => item.id === selectedId) ?? list.ready[0];

    // A full-size preview of the picked image for precise cropping.
    useEffect(() => {
        if (!selected?.source) {
            setPreview(null);

            return;
        }

        const url = URL.createObjectURL(selected.source);

        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [selected?.source]);

    const busy = progress !== null;
    const count = list.ready.length;

    const turned = (item: ImageItem) => displayedSize(item, item.rotation);

    const aspectFor = (item: ImageItem): number | null => {
        if (ratio === 'free') {
            return null;
        }

        if (ratio === 'original') {
            const { width, height } = turned(item);

            return width / height;
        }

        const shape = SHAPES[ratio] ?? 1;

        return portrait ? 1 / shape : shape;
    };

    const cropFor = (item: ImageItem): Rect => {
        const saved = crops[item.id];

        return saved && saved.rotation === item.rotation
            ? saved.rect
            : defaultCrop(turned(item), aspectFor(item));
    };

    const setCrop = (item: ImageItem, rect: Rect) => {
        setResult(null);
        setCrops((all) => ({
            ...all,
            [item.id]: { rotation: item.rotation, rect },
        }));
    };

    const chooseRatio = (value: Ratio) => {
        setResult(null);
        setRatio(value);

        // Fit the new shape the way the picked image is turned.
        if (selected && SHAPES[value]) {
            const { width, height } = turned(selected);

            setPortrait(height > width);
        }

        if (value !== 'free') {
            setCrops({});
        }
    };

    const applyToAll = () => {
        if (!selected) {
            return;
        }

        const rect = cropFor(selected);
        const from = turned(selected);

        setResult(null);
        setCrops(
            Object.fromEntries(
                list.ready.map((item) => [
                    item.id,
                    {
                        rotation: item.rotation,
                        rect:
                            item.id === selected.id
                                ? rect
                                : matchCrop(
                                      rect,
                                      from,
                                      turned(item),
                                      aspectFor(item),
                                  ),
                    },
                ]),
            ),
        );
        toast.success(
            `The same crop is now on all ${count} images. Check each one before saving.`,
        );
    };

    const crop = async () => {
        const images = list.ready.flatMap((item) => {
            if (!item.source) {
                return [];
            }

            const area = pixelCrop(cropFor(item), turned(item));
            const size = outputSize(area.width, area.height, null);

            return [
                {
                    blob: item.source,
                    name: item.name,
                    rotation: item.rotation,
                    area,
                    width: size.width,
                    height: size.height,
                    format:
                        saveAs === 'same'
                            ? keepFormat(item.name, item.source.type, webp)
                            : saveAs,
                },
            ];
        });
        const progressLabel = (done: number) =>
            `Cropping ${Math.min(done + 1, images.length)} of ${images.length}…`;

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
                        ? `${safeFileName(zipName, 'cropped')}.zip`
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
                    : 'Something went wrong while cropping.',
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

    const shown = selected
        ? pixelCrop(cropFor(selected), turned(selected))
        : null;

    return (
        <>
            <Head title="Crop images" />

            <ToolShell
                title="Crop images"
                description="Cut images down to the part you want, freely or to a shape like square, 4:3 or 16:9."
                noun="images"
                accept="image/*,.heic,.heif"
                emptyHint={`HEIC, JPG, PNG, WebP and more · up to ${list.maxItems} images`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Crop"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Preparing images…'
                                : count === 0
                                  ? 'Add an image'
                                  : `Crop ${plural(count, 'image', 'images')}`
                        }
                        disabled={count === 0 || list.loading}
                        progress={progress}
                        result={result}
                        onRun={crop}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <Segmented
                            label="Shape"
                            value={ratio}
                            onChange={chooseRatio}
                            columns={4}
                            options={[
                                { value: 'free', label: 'Free' },
                                { value: 'original', label: 'Original' },
                                { value: '1:1', label: '1:1' },
                                { value: '5:4', label: '5:4' },
                                { value: '4:3', label: '4:3' },
                                { value: '3:2', label: '3:2' },
                                { value: '16:9', label: '16:9' },
                                { value: 'a4', label: 'A4' },
                            ]}
                            hint={
                                ratio === 'original'
                                    ? 'Each image keeps its own shape, just smaller.'
                                    : undefined
                            }
                        />
                        {SHAPES[ratio] && (
                            <Segmented
                                label="Turn the shape"
                                hideLabel
                                value={portrait ? 'portrait' : 'landscape'}
                                onChange={(value) => {
                                    setResult(null);
                                    setPortrait(value === 'portrait');
                                    setCrops({});
                                }}
                                options={[
                                    { value: 'landscape', label: 'Landscape' },
                                    { value: 'portrait', label: 'Portrait' },
                                ]}
                            />
                        )}
                        {count > 1 && (
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-full rounded-full"
                                onClick={applyToAll}
                            >
                                <Copy />
                                Use this crop for all images
                            </Button>
                        )}
                        <Segmented
                            label="Save as"
                            value={saveAs}
                            onChange={(value) => {
                                setResult(null);
                                setSaveAs(value);
                            }}
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
                                    onChange={(event) => {
                                        setResult(null);
                                        setQuality(Number(event.target.value));
                                    }}
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
                                onChange={(value) => {
                                    setResult(null);
                                    setZipName(value);
                                }}
                            />
                        )}
                    </>
                }
            >
                {(pick) => (
                    <>
                        <section
                            aria-label="Crop"
                            className="rounded-3xl border border-border bg-card p-3 sm:p-4"
                        >
                            {selected && preview && shown ? (
                                <>
                                    <div className="mb-3 flex items-center gap-2">
                                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                            {selected.name}
                                            <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                                                {turned(selected).width} ×{' '}
                                                {turned(selected).height}
                                            </span>
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-10 rounded-full"
                                            onClick={() =>
                                                list.rotate(selected.id)
                                            }
                                            disabled={busy}
                                        >
                                            <RotateCw />
                                            Rotate
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-10 rounded-full"
                                            onClick={() =>
                                                setCrop(
                                                    selected,
                                                    defaultCrop(
                                                        turned(selected),
                                                        aspectFor(selected),
                                                    ),
                                                )
                                            }
                                            disabled={busy}
                                        >
                                            <RotateCcw />
                                            Reset
                                        </Button>
                                    </div>
                                    <fieldset
                                        disabled={busy}
                                        className={cn(
                                            'min-w-0',
                                            busy &&
                                                'pointer-events-none opacity-60',
                                        )}
                                    >
                                        <CropEditor
                                            src={preview}
                                            rotation={selected.rotation}
                                            size={turned(selected)}
                                            rect={cropFor(selected)}
                                            aspect={aspectFor(selected)}
                                            onChange={(rect) =>
                                                setCrop(selected, rect)
                                            }
                                        />
                                    </fieldset>
                                    <p className="mt-3 text-center text-xs text-muted-foreground">
                                        Drag the box or its handles. The darker
                                        part is cut away.
                                    </p>
                                </>
                            ) : (
                                <div className="flex aspect-[4/3] items-center justify-center">
                                    <Spinner className="size-6 text-muted-foreground" />
                                </div>
                            )}
                        </section>

                        <ImageStrip
                            items={list.items}
                            selectedId={selected?.id ?? null}
                            busy={busy}
                            canAdd={list.items.length < list.maxItems}
                            onSelect={setSelectedId}
                            onRemove={list.remove}
                            onAdd={pick}
                            onClear={list.clear}
                        />
                    </>
                )}
            </ToolShell>
        </>
    );
}

function ImageStrip({
    items,
    selectedId,
    busy,
    canAdd,
    onSelect,
    onRemove,
    onAdd,
    onClear,
}: {
    items: ImageItem[];
    selectedId: string | null;
    busy: boolean;
    canAdd: boolean;
    onSelect: (id: string) => void;
    onRemove: (id: string) => void;
    onAdd: () => void;
    onClear: () => void;
}) {
    return (
        <section aria-label="Images">
            <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                        {plural(items.length, 'image', 'images')}
                    </span>
                    {items.length > 1 && ' · pick one to crop it'}
                </p>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 rounded-full"
                    onClick={onClear}
                    disabled={busy}
                >
                    Clear
                </Button>
            </div>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
                {items.map((item) => (
                    <li key={item.id} className="relative">
                        <button
                            type="button"
                            onClick={() => onSelect(item.id)}
                            disabled={busy || item.status !== 'ready'}
                            aria-label={`Crop ${item.name}`}
                            aria-current={item.id === selectedId}
                            title={item.error ?? item.name}
                            className={cn(
                                'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                item.id === selectedId &&
                                    'ring-2 ring-brand ring-offset-2 ring-offset-background',
                                item.status === 'error' &&
                                    'ring-1 ring-destructive/50',
                            )}
                        >
                            {item.status === 'ready' && (
                                <FittedThumbnail item={item} />
                            )}
                            {item.status === 'loading' && (
                                <Spinner className="size-5 text-muted-foreground" />
                            )}
                            {item.status === 'error' && (
                                <CircleAlert className="size-5 text-destructive-foreground" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(item.id)}
                            disabled={busy}
                            aria-label={`Remove ${item.name}`}
                            title={`Remove ${item.name}`}
                            className="absolute -top-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:size-9"
                        >
                            <X className="size-3.5" />
                        </button>
                    </li>
                ))}
                {canAdd && (
                    <li>
                        <button
                            type="button"
                            onClick={onAdd}
                            disabled={busy}
                            aria-label="Add images"
                            className="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-input text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            <Plus className="size-5" />
                        </button>
                    </li>
                )}
            </ul>
        </section>
    );
}
