import { Head } from '@inertiajs/react';

export default function Privacy() {
    return (
        <>
            <Head title="Privacy" />

            <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
                <h1 className="font-display text-4xl font-extrabold tracking-tight">
                    Privacy
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                    Tinyfold's tools run entirely in your browser. Your files
                    are never uploaded to our server.
                </p>

                <div className="mt-10 space-y-8 leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_p]:mt-2 [&_p]:text-muted-foreground">
                    <section>
                        <h2>Your files</h2>
                        <p>
                            When you pick files, they are read and processed by
                            code running on your own device. The result is
                            created there too and saved straight to your device.
                            We never receive, see or store your files.
                        </p>
                    </section>

                    <section>
                        <h2>What the server sees</h2>
                        <p>
                            Like any website, the server that sends you the app
                            records basic request details (IP address, page,
                            browser and time) to keep the site running and
                            secure. These logs never include your files or their
                            names.
                        </p>
                    </section>

                    <section>
                        <h2>Cookies</h2>
                        <p>
                            Tinyfold only sets cookies the site needs to work: a
                            session cookie, a security token that protects
                            forms, and your light or dark theme choice. There
                            are no advertising or tracking cookies, and no
                            third-party scripts.
                        </p>
                    </section>

                    <section>
                        <h2>Open-source software</h2>
                        <p>
                            Tinyfold is built with open-source libraries,
                            including pdf-lib (MIT) and pdf.js (Apache-2.0) for
                            PDFs, heic-to and libheif (LGPL-3.0) for iPhone
                            photos, fflate (MIT) for ZIP files, and dnd-kit
                            (MIT).
                        </p>
                        <p>
                            Tinyfold itself is open source under the MIT
                            licence, so anyone can check how it handles files.
                            The code is on{' '}
                            <a
                                href="https://github.com/Mizuan/tinyfold"
                                className="font-medium text-foreground underline underline-offset-4"
                            >
                                GitHub
                            </a>
                            .
                        </p>
                    </section>
                </div>
            </article>
        </>
    );
}
