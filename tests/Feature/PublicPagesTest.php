<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_home_page_lists_the_tools()
    {
        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('home'));
    }

    public function test_the_privacy_page_is_public()
    {
        $this->get(route('privacy'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('privacy'));
    }

    public function test_the_images_to_pdf_tool_is_public()
    {
        $this->get(route('tools.images-to-pdf'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/images-to-pdf'));
    }

    public function test_the_merge_images_tool_is_public()
    {
        $this->get(route('tools.merge-images'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/merge-images'));
    }

    public function test_the_merge_pdfs_tool_is_public()
    {
        $this->get(route('tools.merge-pdfs'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/merge-pdfs'));
    }

    public function test_the_compress_pdf_tool_is_public()
    {
        $this->get(route('tools.compress-pdf'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/compress-pdf'));
    }

    public function test_the_convert_images_tool_is_public()
    {
        $this->get(route('tools.convert-images'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/convert-images'));
    }

    public function test_the_shrink_images_tool_is_public()
    {
        $this->get(route('tools.shrink-images'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/shrink-images'));
    }

    public function test_the_pdf_to_images_tool_is_public()
    {
        $this->get(route('tools.pdf-to-images'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/pdf-to-images'));
    }

    public function test_the_split_pdf_tool_is_public()
    {
        $this->get(route('tools.split-pdf'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/split-pdf'));
    }

    public function test_the_organize_pdf_tool_is_public()
    {
        $this->get(route('tools.organize-pdf'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/organize-pdf'));
    }

    public function test_the_resize_images_tool_is_public()
    {
        $this->get(route('tools.resize-images'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/resize-images'));
    }

    public function test_the_crop_images_tool_is_public()
    {
        $this->get(route('tools.crop-images'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/crop-images'));
    }

    public function test_the_remove_photo_details_tool_is_public()
    {
        $this->get(route('tools.remove-photo-details'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/remove-photo-details'));
    }

    public function test_the_qr_code_tool_is_public()
    {
        $this->get(route('tools.qr-code'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('tools/qr-code'));
    }

    public function test_public_registration_is_disabled()
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertNotFound();
    }
}
