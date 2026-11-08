<?php

use Illuminate\Support\Facades\Route;

Route::inertia('/', 'home')->name('home');
Route::inertia('privacy', 'privacy')->name('privacy');

Route::inertia('images-to-pdf', 'tools/images-to-pdf')->name('tools.images-to-pdf');
Route::inertia('convert-images', 'tools/convert-images')->name('tools.convert-images');
Route::inertia('merge-images', 'tools/merge-images')->name('tools.merge-images');
Route::inertia('shrink-images', 'tools/shrink-images')->name('tools.shrink-images');
Route::inertia('resize-images', 'tools/resize-images')->name('tools.resize-images');
Route::inertia('crop-images', 'tools/crop-images')->name('tools.crop-images');
Route::inertia('merge-pdfs', 'tools/merge-pdfs')->name('tools.merge-pdfs');
Route::inertia('compress-pdf', 'tools/compress-pdf')->name('tools.compress-pdf');
Route::inertia('pdf-to-images', 'tools/pdf-to-images')->name('tools.pdf-to-images');
Route::inertia('split-pdf', 'tools/split-pdf')->name('tools.split-pdf');
Route::inertia('organize-pdf', 'tools/organize-pdf')->name('tools.organize-pdf');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
