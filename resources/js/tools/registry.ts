import type { LucideIcon } from 'lucide-react';
import {
    ArrowRightLeft,
    Crop,
    FileImage,
    Files,
    FileOutput,
    ImageDown,
    Images,
    LayoutGrid,
    MapPinOff,
    Scaling,
    Scissors,
    Shrink,
} from 'lucide-react';
import {
    compressPdf,
    convertImages,
    cropImages,
    imagesToPdf,
    mergeImages,
    mergePdfs,
    organizePdf,
    pdfToImages,
    removePhotoDetails,
    resizeImages,
    shrinkImages,
    splitPdf,
} from '@/routes/tools';

export type Tool = {
    slug: string;
    title: string;
    description: string;
    icon: LucideIcon;
    group: 'pdf' | 'image';
    /** Set once the tool is live; tools without one show as "Soon". */
    href?: string;
};

/** The home page's sections, in order. Tools appear in list order within each. */
export const toolGroups = [
    { key: 'pdf', title: 'PDF tools' },
    { key: 'image', title: 'Image tools' },
] as const;

export const tools: Tool[] = [
    {
        slug: 'images-to-pdf',
        group: 'pdf',
        title: 'Images to PDF',
        description:
            'Turn photos and scans into one PDF, in the order you want.',
        icon: FileImage,
        href: imagesToPdf.url(),
    },
    {
        slug: 'merge-pdfs',
        group: 'pdf',
        title: 'Merge PDFs',
        description:
            'Combine several PDFs into one and pick the pages to keep.',
        icon: Files,
        href: mergePdfs.url(),
    },
    {
        slug: 'split-pdf',
        group: 'pdf',
        title: 'Split PDF',
        description: 'Pull pages out of a PDF, or split it into smaller PDFs.',
        icon: Scissors,
        href: splitPdf.url(),
    },
    {
        slug: 'organize-pdf',
        group: 'pdf',
        title: 'Organise PDF',
        description: 'Reorder, rotate and delete pages, even across PDFs.',
        icon: LayoutGrid,
        href: organizePdf.url(),
    },
    {
        slug: 'compress-pdf',
        group: 'pdf',
        title: 'Compress PDF',
        description:
            'Make a PDF smaller so it fits in an email or upload form.',
        icon: Shrink,
        href: compressPdf.url(),
    },
    {
        slug: 'pdf-to-images',
        group: 'pdf',
        title: 'PDF to images',
        description:
            'Save PDF pages as JPG or PNG, all of them or the ones you pick.',
        icon: FileOutput,
        href: pdfToImages.url(),
    },
    {
        slug: 'convert-images',
        group: 'image',
        title: 'Convert images',
        description: 'Change HEIC, PNG, JPG and WebP into the format you need.',
        icon: ArrowRightLeft,
        href: convertImages.url(),
    },
    {
        slug: 'shrink-images',
        group: 'image',
        title: 'Shrink images',
        description:
            'Get photos under a size limit, like 1 MB for an upload form.',
        icon: ImageDown,
        href: shrinkImages.url(),
    },
    {
        slug: 'resize-images',
        group: 'image',
        title: 'Resize images',
        description:
            'Set a width or height, fit a box, or scale by a percentage.',
        icon: Scaling,
        href: resizeImages.url(),
    },
    {
        slug: 'crop-images',
        group: 'image',
        title: 'Crop images',
        description:
            'Cut out the part you want, freely or to a shape like square.',
        icon: Crop,
        href: cropImages.url(),
    },
    {
        slug: 'remove-photo-details',
        group: 'image',
        title: 'Remove photo details',
        description:
            'Take out location, camera and date before you share a photo.',
        icon: MapPinOff,
        href: removePhotoDetails.url(),
    },
    {
        slug: 'merge-images',
        group: 'image',
        title: 'Merge images',
        description:
            'Join two or more images side by side, stacked or in a grid.',
        icon: Images,
        href: mergeImages.url(),
    },
];
