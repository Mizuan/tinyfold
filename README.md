# Tinyfold

Everyday file fixes, right in your browser: [tinyfold.app](https://tinyfold.app)

Tinyfold is a set of small tools for the file chores that come up every day.
Every tool runs **in the visitor's browser**. Files are never uploaded; the
server only sends the app.

## Tools

| Tool               | What it does                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Images to PDF**  | Turn photos and scans into a PDF. Reorder, rotate, choose A4, Letter or "fit image" pages and margins, with a live page preview. One PDF, or a PDF per image as a ZIP. JPEGs go in without re-compressing. |
| **Merge PDFs**     | Combine PDFs, reorder them, pick pages per file (`1-3, 5, 8-`) and rotate a file. Locked PDFs are flagged rather than merged into garbled pages.                                                           |
| **Split PDF**      | Pull chosen pages into one PDF, or split into a PDF per page or every few pages, named after their pages.                                                                                                  |
| **Organise PDF**   | Every page as a card: reorder, rotate and delete pages, even across several PDFs, with undo and reset.                                                                                                     |
| **Compress PDF**   | Shrink the photos inside a PDF (Strong, Balanced or Light) and clear out leftover data. Never hands back a bigger file.                                                                                    |
| **PDF to images**  | Save pages as JPG or PNG at screen, standard or print resolution.                                                                                                                                          |
| **Convert images** | HEIC, JPG, PNG, WebP and more into JPG, PNG or WebP, with quality and size options. Converting removes hidden photo details such as GPS location.                                                          |
| **Shrink images**  | Get photos under a size limit (like 1 MB for an upload form): the best quality that fits, smaller only when needed.                                                                                        |
| **Merge images**   | Join images stacked, in a row or in a grid, with spacing, background colour, JPG or PNG output and a live preview.                                                                                         |

All image tools read iPhone **HEIC** photos and respect the camera's
orientation, so sideways phone pictures come out upright.

## How it works

- Each tool builds its result in a **Web Worker**, so the page stays
  responsive: [pdf-lib](https://pdf-lib.js.org) for PDFs, `OffscreenCanvas`
  for images, [fflate](https://github.com/101arrowz/fflate) for ZIPs,
  [heic-to](https://github.com/hoppergee/heic-to) (libheif in WebAssembly) for
  HEIC and [pdf.js](https://mozilla.github.io/pdf.js/) for PDF thumbnails.
- The large libraries (HEIC decoder, pdf.js) load only when a tool needs them.
- Layout maths (page placement, merge layouts, output sizes, page ranges) lives
  in small pure modules with unit tests. The previews use the same code as the
  output, so what you see is what you get.

### Security

- A strict Content Security Policy with a per-request nonce, no third-party
  scripts and self-hosted fonts, plus HSTS, `nosniff`, `frame-ancestors 'none'`
  and a locked-down Permissions-Policy (`AddSecurityHeaders` middleware).
- Public registration is off. The admin account is created from the command
  line (`php artisan app:create-admin`), with two-factor sign-in available.

## Stack

Laravel 13 · Inertia v3 · React 19 · TypeScript · Tailwind CSS v4 · Vite+ ·
Pest · Vitest · SQLite

## Running it locally

Requires PHP 8.4, Composer and Node 22.18+ (or 24.11+). With
[Laravel Herd](https://herd.laravel.com) the site is served at
`https://tinyfold.test`.

```sh
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate
npm install
npm run dev
```

Then create an admin account if you need the dashboard:

```sh
php artisan app:create-admin
```

## Checks

```sh
npm test               # Vitest: layout maths, EXIF, PDF building, compression, names
php artisan test       # Pest: pages, security headers, admin command, backups
composer ci:check      # everything CI runs: format, lint, types, PHPStan and both test suites
```

GitHub Actions runs `composer ci:check` on every push to `main`.

## Project layout

```
resources/js/
  pages/tools/          one page per tool
  tools/<tool>/         a tool's worker, client, pure logic and tests
  tools/registry.ts     the tool list that drives the home page
  components/tools/     shared tool UI: shell, file grid, actions, controls
  hooks/                use-file-list (generic) and use-image-list
  lib/                  files, rotation, workers, file names
app/
  Http/Middleware/AddSecurityHeaders.php
  Console/Commands/     app:create-admin, app:backup-database
deploy/README.md        how the live site is set up on Laravel Forge
```

### Adding a tool

1. Put the logic in `resources/js/tools/<tool>/`: pure functions with
   `*.test.ts` tests, a `worker.ts` for the heavy work and a `client.ts` that
   runs it with `runWorker`.
2. Build the page in `resources/js/pages/tools/<tool>.tsx` with `ToolShell`,
   `FileGrid` and `ToolActions`.
3. Add the route in `routes/web.php`, an entry in `tools/registry.ts` and a page
   test in `tests/Feature/PublicPagesTest.php`.

## Deploying

The live site runs on Laravel Forge behind Cloudflare, and pushes to `main`
deploy automatically. The server setup (private Node, PHP 8.4, the SQLite
database outside the site, nightly backups) is described in
[`deploy/README.md`](deploy/README.md).

## License

Tinyfold is open source under the [MIT License](LICENSE).

The libraries it uses keep their own licenses: pdf-lib, fflate and dnd-kit
(MIT), pdf.js (Apache-2.0), and heic-to with libheif (LGPL-3.0), which is loaded
unmodified as a separate WebAssembly file.
