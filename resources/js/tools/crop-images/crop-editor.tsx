import type { KeyboardEvent, PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { RotatedImage } from '@/components/tools/file-grid';
import type { Rect } from '@/lib/render/render-image';
import type { Rotation, Size } from '@/lib/rotation';
import { cn } from '@/lib/utils';
import type { Handle } from './crop';
import { dragCrop, pixelCrop } from './crop';

const HANDLES: { handle: Handle; className: string }[] = [
    { handle: 'nw', className: 'top-0 left-0 cursor-nwse-resize' },
    { handle: 'n', className: 'top-0 left-1/2 cursor-ns-resize' },
    { handle: 'ne', className: 'top-0 left-full cursor-nesw-resize' },
    { handle: 'e', className: 'top-1/2 left-full cursor-ew-resize' },
    { handle: 'se', className: 'top-full left-full cursor-nwse-resize' },
    { handle: 's', className: 'top-full left-1/2 cursor-ns-resize' },
    { handle: 'sw', className: 'top-full left-0 cursor-nesw-resize' },
    { handle: 'w', className: 'top-1/2 left-0 cursor-ew-resize' },
];

const percent = (value: number) => `${value * 100}%`;

/**
 * The picked image, large, with a crop box to drag, resize from its handles
 * or move with the arrow keys (Shift and the arrow keys resize it).
 */
export default function CropEditor({
    src,
    rotation,
    size,
    rect,
    aspect,
    onChange,
}: {
    src: string;
    rotation: Rotation;
    /** The turned image's size in pixels. */
    size: Size;
    rect: Rect;
    aspect: number | null;
    onChange: (rect: Rect) => void;
}) {
    const frame = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState({ width: 0, height: 0 });
    const drag = useRef<{
        handle: Handle;
        x: number;
        y: number;
        start: Rect;
    } | null>(null);

    useEffect(() => {
        const element = frame.current;

        if (!element) {
            return;
        }

        const measure = () =>
            setRoom({
                width: element.clientWidth,
                height: Math.min(640, window.innerHeight * 0.62),
            });
        const observer = new ResizeObserver(measure);

        observer.observe(element);
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    const ratio = size.width / size.height;
    const width = Math.min(room.width, room.height * ratio);
    const height = width / ratio;
    // Image pixels per screen pixel.
    const scale = width ? size.width / width : 1;
    const shown = pixelCrop(rect, size);
    const area = {
        left: percent(rect.x / size.width),
        top: percent(rect.y / size.height),
        width: percent(rect.width / size.width),
        height: percent(rect.height / size.height),
    };

    const start = (handle: Handle) => (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
            handle,
            x: event.clientX,
            y: event.clientY,
            start: rect,
        };
    };

    const move = (event: PointerEvent) => {
        const current = drag.current;

        if (!current) {
            return;
        }

        onChange(
            dragCrop(
                current.start,
                current.handle,
                (event.clientX - current.x) * scale,
                (event.clientY - current.y) * scale,
                size,
                aspect,
            ),
        );
    };

    const end = () => {
        drag.current = null;
    };

    const nudge = (event: KeyboardEvent) => {
        const arrows: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
        };
        const arrow = arrows[event.key];

        if (!arrow) {
            return;
        }

        event.preventDefault();

        const step = Math.max(
            1,
            Math.round(Math.max(size.width, size.height) / 100),
        );
        const [dx, dy] = [arrow[0] * step, arrow[1] * step];

        if (!event.shiftKey) {
            onChange(dragCrop(rect, 'move', dx, dy, size, aspect));

            return;
        }

        // With a shape, any arrow grows (right, down) or shrinks it evenly.
        const grow = dx + dy;

        onChange(
            aspect
                ? dragCrop(rect, 'se', grow, grow / aspect, size, aspect)
                : dragCrop(rect, 'se', dx, dy, size, aspect),
        );
    };

    const pointer = {
        onPointerMove: move,
        onPointerUp: end,
        onPointerCancel: end,
    };

    return (
        <div ref={frame} className="flex w-full justify-center">
            <div className="relative select-none" style={{ width, height }}>
                {/* Only the image and the dimming are clipped, so handles on the edge stay reachable. */}
                <div className="absolute inset-0 overflow-hidden rounded-xl bg-muted">
                    {width > 0 && (
                        <RotatedImage
                            item={{ thumbnail: src, rotation }}
                            boxWidth={size.width}
                            boxHeight={size.height}
                        />
                    )}
                    <div
                        className="absolute shadow-[0_0_0_9999px_rgb(20_22_27/0.55)]"
                        style={area}
                    />
                </div>

                <div
                    role="group"
                    tabIndex={0}
                    aria-label={`Crop area, ${shown.width} by ${shown.height} pixels. Arrow keys move it; Shift and arrow keys resize it.`}
                    onKeyDown={nudge}
                    onPointerDown={start('move')}
                    {...pointer}
                    className="absolute cursor-move touch-none ring-2 ring-white outline-none focus-visible:ring-brand"
                    style={area}
                >
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }, (_, i) => (
                            <span
                                key={i}
                                className="border-[0.5px] border-white/35"
                            />
                        ))}
                    </div>

                    {HANDLES.map(({ handle, className }) => (
                        <span
                            key={handle}
                            aria-hidden="true"
                            onPointerDown={start(handle)}
                            {...pointer}
                            className={cn(
                                'absolute flex size-7 -translate-1/2 touch-none items-center justify-center pointer-coarse:size-11',
                                className,
                            )}
                        >
                            <span
                                className={cn(
                                    'block rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.45)]',
                                    handle.length === 2
                                        ? 'size-3.5'
                                        : handle === 'n' || handle === 's'
                                          ? 'h-1.5 w-5'
                                          : 'h-5 w-1.5',
                                )}
                            />
                        </span>
                    ))}
                </div>

                <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white tabular-nums">
                    {shown.width} × {shown.height}
                </span>
            </div>
        </div>
    );
}
