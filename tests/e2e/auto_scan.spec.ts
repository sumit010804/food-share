import { test, expect } from '@playwright/test'

// Utility to build a QR data URL from a token via a tiny in-page renderer
async function generateQrDataUrl(page, token: string, size = 256): Promise<string> {
  return await page.evaluate(async ({ token, size }) => {
    // simple QR code generator using qrcode.react-like logic via a CDN or placeholder fallback
    // For reliability, we use the canvas-based QRCode from 'qrcode' if available on window
    // Otherwise, we return an empty string to skip this test gracefully.
    try {
      // @ts-ignore
      let QR
      if (window['QRCode']) {
        // already available
        // @ts-ignore
        QR = window['QRCode']
      } else {
        // @ts-ignore
        await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js')
        // @ts-ignore
        QR = window['QRCode'] || window['qrcode']
      }
      if (!QR) return ''
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      // @ts-ignore
      await QR.toCanvas(canvas, token, { width: size, margin: 2 })
      return canvas.toDataURL('image/png')
    } catch (e) {
      return ''
    }
  }, { token, size })
}

// This test runs the full flow: create listing -> reserve -> get token -> open /scan -> inject QR image -> auto-validate
// Skips if QR rendering cannot be setup in the browser context.
test('auto camera scan emulation via injected QR image validates and marks collected', async ({ page, request }) => {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000'

  // 1) Create listing
  const title = `pw-e2e-${Date.now()}`
  const createRes = await request.post(`${baseURL}/api/food-listings`, {
    data: {
      title,
      description: 'Playwright E2E listing',
      foodType: 'Bread',
      quantity: '1 kg',
      location: 'Test City',
      safeToEatHours: 6,
      createdBy: 'donor-A',
      donorId: 'donor-A',
      email: 'donor@example.com',
    },
  })
  expect(createRes.ok()).toBeTruthy()
  const createJson = await createRes.json()
  const listingId = createJson?.listing?._id || createJson?.listing?.id
  expect(listingId).toBeTruthy()

  // 2) Reserve listing (issues ticket)
  const reserveRes = await request.post(`${baseURL}/api/food-listings/reserve`, {
    data: { listingId: String(listingId), userId: 'receiver-B', userName: 'Receiver B', userEmail: 'rb@example.com' },
  })
  expect(reserveRes.ok()).toBeTruthy()
  const reserveJson = await reserveRes.json()
  const token = reserveJson?.ticket?.token
  expect(token).toBeTruthy()

  // 3) Generate a QR PNG data URL for the token
  await page.goto(`${baseURL}/scan`)
  const dataUrl = await generateQrDataUrl(page, token)
  test.skip(!dataUrl, 'QR code rendering script unavailable in browser context')

  // 4) Expose the QR image to the scanner and start it
  await page.addInitScript((dataUrl) => {
    // set before React mounts
    // @ts-ignore
    window.__TEST_QR_IMAGE = dataUrl
  }, dataUrl)

  // reload so init script is in place before component mounts
  await page.reload()

  // Start camera (scanner will also start the test image loop automatically)
  await page.getByText('Start Camera').click()

  // 5) Wait for verification
  await expect(page.getByText('Verified — Ticket valid')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Status: collected')).toBeVisible({ timeout: 5000 })
})
