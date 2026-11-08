import { Link } from '@inertiajs/react';
import { ArrowLeft, Lock } from 'lucide-react';
import { home } from '@/routes';

/** A tool page's top: the way back, the title, what it does and the privacy note. */
export default function ToolHeader({
    title,
    description,
    note = 'Your files never leave this device.',
}: {
    title: string;
    description: string;
    note?: string;
}) {
    return (
        <>
            <Link
                href={home()}
                className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-4" />
                All tools
            </Link>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                {title}
            </h1>
            <p className="mt-3 max-w-2xl text-pretty text-muted-foreground sm:text-lg">
                {description}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink">
                <Lock className="size-3.5" />
                {note}
            </p>
        </>
    );
}
