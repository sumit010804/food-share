const { test, expect } = require('@playwright/test')

async function generateQrDataUrl(page, token, size = 256) {
  return await page.evaluate(async ({ token, size }) => {
    try {
      let QR
      if (window.QRCode) {
        QR = window.QRCode
      } else {
        await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js')
        QR = window.QRCode || window.qrcode
      }
      if (!QR) return ''
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      await QR.toCanvas(canvas, token, { width: size, margin: 2 })
      return canvas.toDataURL('image/png')
    } catch (e) {
      return ''
    }
  }, { token, size })
}

test('auto scan via injected QR image validates ticket and marks collected', async ({ page, request }) => {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000'

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

  const reserveRes = await request.post(`${baseURL}/api/food-listings/reserve`, {
    data: { listingId: String(listingId), userId: 'receiver-B', userName: 'Receiver B', userEmail: 'rb@example.com' },
  })
  expect(reserveRes.ok()).toBeTruthy()
  const reserveJson = await reserveRes.json()
  const token = reserveJson?.ticket?.token
  expect(token).toBeTruthy()

  await page.goto(`${baseURL}/scan`)
  const dataUrl = await generateQrDataUrl(page, token)
  test.skip(!dataUrl, 'QR renderer unavailable')

  await page.addInitScript((dataUrl) => {
    window.__TEST_QR_IMAGE = dataUrl
  }, dataUrl)

  await page.reload()

  await page.getByText('Start Camera').click()

  await expect(page.getByText('Verified — Ticket valid')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Status: collected')).toBeVisible({ timeout: 5000 })
})
