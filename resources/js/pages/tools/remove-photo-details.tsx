import { Head } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Camera, Check, FileText, MapPin } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import FileGrid, { FittedThumbnail } from '@/components/tools/file-grid';
import FileNameField from '@/components/tools/file-name-field';
import ToolActions from '@/components/tools/tool-actions';
import type { ToolProgress, ToolResult } from '@/components/tools/tool-actions';
import ToolShell from '@/components/tools/tool-shell';
import type { FileItem } from '@/hooks/use-file-list';
import { FileProblem, useFileList } from '@/hooks/use-file-list';
import {
    decodeHeif,
    formatBytes,
    isHeif,
    makeThumbnail,
    safeFileName,
} from '@/lib/files';
import { cn } from '@/lib/utils';
import { cleanPhotos } from '@/tools/remove-photo-details/client';
import type { Found } from '@/tools/remove-photo-details/exif';
import {
    BrokenPhoto,
    findInHeif,
    photoFormat,
    stripPhoto,
} from '@/tools/remove-photo-details/strip';

type Meta = { found: Found; heif: boolean };
type Detail = 'location' | 'camera' | 'date' | 'other';

const DETAILS: { key: Detail; label: string; icon: LucideIcon }[] = [
    { key: 'location', label: 'Location', icon: MapPin },
    { key: 'camera', label: 'Camera', icon: Camera },
    { key: 'date', label: 'Date', icon: CalendarDays },
    { key: 'other', label: 'Other', icon: FileText },
];

const isImage = (file: File) =>
    file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

/** Read what the photo gives away, and get a preview. */
async function prepare(file: File) {
    const heif = await isHeif(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let found: Found;

    if (heif) {
        found = findInHeif(bytes);
    } else {
        if (!photoFormat(bytes)) {
            throw new FileProblem('Only JPG, PNG, WebP and HEIC photos.');
        }

        try {
            found = stripPhoto(bytes).found;
        } catch (error) {
            throw new FileProblem(
                error instanceof BrokenPhoto
                    ? error.message
                    : "Can't read this photo.",
            );
        }
    }

    // iPhone photos are saved as JPG, with nothing carried over.
    const source = heif ? await decodeHeif(file, 'image/jpeg') : file;

    return {
        source,
        thumbnail: await makeThumbnail(source),
        meta: { found, heif },
    };
}

const anyFound = (found: Found) => DETAILS.some(({ key }) => found[key]);

export default function RemovePhotoDetails() {
    const [zipName, setZipName] = useState('photos');
    const [cleaned, setCleaned] = useState<Record<string, number>>({});
    const [progress, setProgress] = useState<ToolProgress | null>(null);
    const [result, setResult] = useState<ToolResult | null>(null);
    const job = useRef<{ cancel: () => void } | null>(null);

    const list = useFileList<Meta>({
        maxItems: 50,
        noun: ['photo', 'photos'],
        accepts: isImage,
        prepare,
        onChange: () => {
            setResult(null);
            setCleaned({});
        },
    });

    const busy = progress !== null;
    const count = list.ready.length;
    const counts = DETAILS.map(({ key, label }) => ({
        label,
        count: list.ready.filter((item) => item.meta?.found[key]).length,
    })).filter(({ count }) => count > 0);
    const someHeif = list.ready.some((item) => item.meta?.heif);

    const clean = async () => {
        const ready = list.ready.filter((item) => item.source);
        const photos = ready.map((item) => ({
            blob: item.source as Blob,
            name: item.name,
            heif: item.meta?.heif ?? false,
        }));
        const progressLabel = (done: number) =>
            `Cleaning ${Math.min(done + 1, photos.length)} of ${photos.length}…`;

        setProgress({ label: progressLabel(0), done: 0, total: photos.length });

        const current = cleanPhotos({ photos }, (done, total) =>
            setProgress({ label: progressLabel(done), done, total }),
        );

        job.current = current;

        try {
            const { blob, kind, sizes } = await current.promise;
            const [first] = ready;

            setCleaned(
                Object.fromEntries(ready.map((item, i) => [item.id, sizes[i]])),
            );
            setResult({
                blob,
                fileName:
                    kind === 'zip'
                        ? `${safeFileName(zipName, 'photos')}.zip`
                        : first.meta?.heif
                          ? `${safeFileName(first.name.replace(/\.[^.]+$/, ''), 'photo')}.jpg`
                          : first.name,
                details:
                    kind === 'zip'
                        ? `${plural(photos.length, 'photo', 'photos')} in a ZIP`
                        : first.meta && anyFound(first.meta.found)
                          ? 'Details removed'
                          : 'Nothing hidden was found',
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong while removing the details.',
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
            <Head title="Remove photo details" />

            <ToolShell
                title="Remove photo details"
                description="Take the location, camera and date out of photos before you share them. The picture itself isn't touched."
                noun="photos"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                emptyHint={`JPG, PNG, WebP and HEIC · up to ${list.maxItems} photos`}
                hasFiles={list.items.length > 0}
                busy={busy}
                onFiles={list.add}
                settingsTitle="Remove details"
                actions={
                    <ToolActions
                        label={
                            list.loading
                                ? 'Reading photos…'
                                : count === 0
                                  ? 'Add a photo'
                                  : `Remove details from ${plural(count, 'photo', 'photos')}`
                        }
                        disabled={count === 0 || list.loading}
                        progress={progress}
                        result={result}
                        onRun={clean}
                        onCancel={cancel}
                        onStartOver={list.clear}
                    />
                }
                settings={
                    <>
                        <div className="rounded-xl bg-secondary px-4 py-3 text-sm">
                            {count === 0 ? (
                                'Reading the photos…'
                            ) : counts.length ? (
                                <>
                                    <p className="font-medium">Found</p>
                                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                                        {counts.map(({ label, count: n }) => (
                                            <li key={label}>
                                                {label}:{' '}
                                                {plural(n, 'photo', 'photos')}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                'No hidden details found. You can still save clean copies.'
                            )}
                        </div>
                        <div className="space-y-2 text-sm">
                            <p>
                                <span className="font-medium">Removed:</span>{' '}
                                <span className="text-muted-foreground">
                                    location, camera and lens, date and time,
                                    comments, editing software and other hidden
                                    data.
                                </span>
                            </p>
                            <p>
                                <span className="font-medium">Kept:</span>{' '}
                                <span className="text-muted-foreground">
                                    the picture exactly as it is (not
                                    re-compressed), its colours and which way up
                                    it goes.
                                </span>
                            </p>
                            {someHeif && (
                                <p className="text-muted-foreground">
                                    iPhone HEIC photos are saved as JPG.
                                </p>
                            )}
                        </div>
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
                    <FileGrid
                        list={list}
                        pick={pick}
                        busy={busy}
                        canRotate={false}
                        className="grid-cols-2 sm:grid-cols-3"
                        renderPreview={(item) => (
                            <FittedThumbnail item={item} />
                        )}
                        renderInfo={(item) =>
                            item.id in cleaned
                                ? `${formatBytes(item.size)} → ${formatBytes(cleaned[item.id])}`
                                : formatBytes(item.size)
                        }
                        renderExtra={(item) => (
                            <FoundList
                                item={item}
                                cleaned={item.id in cleaned}
                            />
                        )}
                    />
                )}
            </ToolShell>
        </>
    );
}

function FoundList({
    item,
    cleaned,
}: {
    item: FileItem<Meta>;
    cleaned: boolean;
}) {
    const found = item.meta?.found;
    const shown = DETAILS.filter(({ key }) => found?.[key]);

    if (!shown.length) {
        return (
            <p className="text-[11px] text-muted-foreground">
                Nothing hidden found
            </p>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-1">
            {cleaned && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-ink">
                    <Check className="size-3" />
                    Removed
                </span>
            )}
            {shown.map(({ key, label, icon: Icon }) => (
                <span
                    key={key}
                    className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-full bg-secondary px-2 text-[11px] font-medium',
                        cleaned && 'text-muted-foreground line-through',
                    )}
                >
                    <Icon className="size-3" />
                    {label}
                </span>
            ))}
        </div>
    );
}
