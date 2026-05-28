import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORTRAIT_PATH = path.resolve(__dirname, 'test_portrait.jpg');

test.beforeAll(async () => {
  // Copy a known valid small JPEG photo from the backend data photos directory
  const sourcePath = path.resolve(__dirname, '../../backend/data/photos/client_front_20260526_094834.jpg');
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, PORTRAIT_PATH);
  } else {
    // Fallback minimal 1x1 base64 encoded JPEG if backend photo doesn't exist
    const jpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    fs.writeFileSync(PORTRAIT_PATH, Buffer.from(jpegBase64, 'base64'));
  }
});

test.afterAll(async () => {
  if (fs.existsSync(PORTRAIT_PATH)) {
    fs.unlinkSync(PORTRAIT_PATH);
  }
});

test.describe('Salon AI Recommendation System E2E Web Tests', () => {

  test('Client Check-in, Profiling, Refinement, and Checkout Flow', async ({ page }) => {
    // 1. Visit the app (should land on default Hero Landing Page)
    await page.goto('/');

    // 2. Click Stylist Consultation Portal and authenticate
    await page.locator('h3:has-text("Stylist Consultation Portal")').click();
    await expect(page.locator('h2:has-text("Stylist Portal Login")')).toBeVisible();

    // Select Priya Sharma and type her passcode '111111'
    await page.locator('select').selectOption({ label: 'Priya Sharma (Color Specialist)' });
    await page.locator('input[type="password"]').fill('111111');
    await page.locator('button:has-text("Access Portal")').click();

    // 3. Client Check-In Overlay should display inside Stylist Console
    await expect(page.locator('#checkInOverlay')).toBeVisible();

    // Generate a unique 10-digit Indian phone number
    const uniquePhone = `99${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Fill in the phone input
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill(uniquePhone);
    
    // Press Enter to submit search
    await phoneInput.press('Enter');

    // Since phone is new, it should navigate to the register profile form
    await expect(page.getByText('Create a new styling profile')).toBeVisible({ timeout: 5000 });

    // Fill registration details
    await page.locator('input[placeholder="e.g. Rahul"]').fill('Alice');
    await page.locator('input[placeholder="e.g. Kumar"]').fill('E2ETest');

    // Submit registration to start stylist consultation session
    await page.locator('button:has-text("Start Session")').click();

    // Verify Check-In modal overlay disappears
    await expect(page.locator('#checkInOverlay')).not.toBeVisible();

    // Select AI consultation path on the OptionsPanel
    await page.locator('h3:has-text("AI Styling Recommendations")').click();

    // 4. Camera Capture & Photo Upload Step
    // Directly upload via the hidden file input to bypass camera access permission checks in headless browser
    await page.setInputFiles('input[type="file"]', PORTRAIT_PATH);

    // Verify the upload confirmation text
    await expect(page.getByText('Photo ready! Click \'Analyze Portrait\' in the top bar.')).toBeVisible();

    // 5. Trigger AI Analyze recommendation synthesis
    await page.locator('#analyzeBtn').click();

    // Verify the loading screen with simulated agents log details shows up
    await expect(page.locator('#loadingOverlay')).toBeVisible();

    // Wait for the loading overlay to finish and fade out (up to 12 seconds)
    await expect(page.locator('#loadingOverlay')).not.toBeVisible({ timeout: 12000 });

    // 6. Verify styling recommendations are loaded in Carousel
    await expect(page.locator('.recommendations-container')).toBeVisible();
    await expect(page.locator('h2:has-text("Modern Textured Tapered Fade")')).toBeVisible();

    // 7. Test styling feedback refinement
    const feedbackTextarea = page.locator('textarea');
    await feedbackTextarea.fill('Make it a bit shorter on the sides');
    await page.locator('button:has-text("Refine")').click();

    // Wait for loading overlay to reappear and disappear
    await expect(page.locator('#loadingOverlay')).toBeVisible();
    await expect(page.locator('#loadingOverlay')).not.toBeVisible({ timeout: 10000 });

    // Verify recommendations update correctly
    await expect(page.locator('h2:has-text("Refined Modern Textured Tapered Fade")')).toBeVisible();

    // 8. Confirm Selection & complete checkout
    await page.locator('button:has-text("Confirm Style Selection")').click();
    await page.locator('button:has-text("Complete Session & Checkout")').click();

    // Verify Checkout modal overlay shows up
    await expect(page.locator('h3:has-text("Styling Appointment Checkout")')).toBeVisible();

    // Confirm booking payment
    await page.locator('button:has-text("Complete Payment")').click();

    // Verify Feedback review overlay displays
    await expect(page.locator('#feedbackOverlay')).toBeVisible();

    // Skip feedback screen to close session
    await page.locator('button:has-text("Skip")').click();

    // Verify we are redirected back to the default empty consultation page
    await expect(page.getByText('Ready for consultation')).toBeVisible();
  });

  test('Super Admin Portal Config Overrides and Theme Swap', async ({ page }) => {
    // 1. Route directly to super admin console
    await page.goto('/super-admin');

    // 2. Enter owner passcode
    await expect(page.locator('h2:has-text("Super Admin Portal")')).toBeVisible();
    await page.locator('input[type="password"]').fill('owner123');
    await page.locator('button:has-text("Authenticate")').click();

    // Verify Super Admin Dashboard displays
    await expect(page.getByText('Salon Owner Dashboard')).toBeVisible();

    // 3. Navigate to Salon Configuration tab
    await page.locator('button:has-text("Salon Configuration")').click();

    // Change Salon Name
    const salonNameInput = page.locator('input[placeholder="e.g. Master Stylist Salon"]');
    await salonNameInput.fill('Phoenix E2E Testing Salon');

    // Select Emerald Theme
    const themeSelect = page.locator('select');
    await themeSelect.selectOption({ value: 'theme-emerald-glass' });

    // Save configurations
    await page.locator('button:has-text("Save Config Overrides")').click();

    // Switch back to Stylist Console to see the updated header title
    await page.locator('button:has-text("Stylist Console")').click();

    // Since we redirected to Landing page, authenticate as Stylist
    await expect(page.locator('h3:has-text("Stylist Consultation Portal")')).toBeVisible();
    await page.locator('h3:has-text("Stylist Consultation Portal")').click();
    await page.locator('select').selectOption({ label: 'Priya Sharma (Color Specialist)' });
    await page.locator('input[type="password"]').fill('111111');
    await page.locator('button:has-text("Access Portal")').click();

    // Verify header title and page body theme styles are updated immediately
    await expect(page.locator('header h1')).toContainText('Phoenix E2E Testing Salon Style Consultant');
    
    const bodyClass = await page.evaluate(() => document.body.className);
    expect(bodyClass).toBe('theme-emerald-glass');
  });

});
