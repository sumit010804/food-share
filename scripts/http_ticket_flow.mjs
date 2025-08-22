/*
  HTTP E2E sanity: create listing -> reserve (issue ticket) -> GET ticket -> scan -> scan again (reject)
  Usage:
    - Ensure dev server is running (e.g., on http://localhost:3002)
    - Set DEV_SERVER_URL env (defaults to http://localhost:3002)
    - Run with Node 18+ (global fetch available)
*/

const BASE = process.env.DEV_SERVER_URL || 'http://localhost:3002'

function log(step, ...args) {
  console.log(`\n==== ${step} ====`)
  if (args.length) console.log(...args)
}

async function req(path, init) {
  const url = `${BASE}${path}`
  const res = await fetch(url, init)
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: res.status, json }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

;(async () => {
  try {
    log('Health', `Base URL: ${BASE}`)

    // 1) Create listing
    const title = `http-e2e-${Date.now()}`
    const createBody = {
      title,
      description: 'E2E test listing',
      foodType: 'Bread',
      quantity: '1 kg',
      location: 'Test City',
      safeToEatHours: 24,
      createdBy: 'donor-1',
      donorId: 'donor-1',
      email: 'donor@example.com',
    }
    const createRes = await req('/api/food-listings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(createBody),
    })
    log('Create listing', createRes.status, createRes.json)
    assert(createRes.status === 200, 'Failed to create listing')
    const listingId = createRes.json?.listing?._id || createRes.json?.listing?.id
    assert(listingId, 'Missing listing id')

    // 2) Reserve listing (issues ticket)
    const reserveBody = {
      listingId: String(listingId),
      userId: 'receiver-1',
      userName: 'Receiver One',
      userEmail: 'recv@example.com',
    }
    const reserveRes = await req('/api/food-listings/reserve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(reserveBody),
    })
    log('Reserve listing', reserveRes.status, reserveRes.json)
    assert(reserveRes.status === 200, 'Failed to reserve listing')
    const collectionId = reserveRes.json?.collection?.id
    const token = reserveRes.json?.ticket?.token
    assert(collectionId, 'Missing collection id from reserve')
    assert(token, 'Missing token from reserve')

    // 3) GET ticket by collectionId
    const getRes = await req(`/api/tickets?collectionId=${encodeURIComponent(collectionId)}`)
    log('GET /api/tickets', getRes.status, getRes.json)
    assert(getRes.status === 200, 'GET tickets failed')

    // 4) Scan once
    // 4a) Try scanning as a non-owner (should be forbidden)
    const intruder = await req('/api/tickets/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, scannerId: 'intruder-1' }),
    })
    log('Scan as non-owner (expect 403)', intruder.status, intruder.json)
    assert(intruder.status === 403, 'Non-owner should not be allowed to scan')

    // 4b) Scan once as the lister
    // Scanner must be the lister; we created the listing with donorId 'donor-1'
    const scanBody = { token, scannerId: 'donor-1' }
    const scan1 = await req('/api/tickets/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(scanBody),
    })
    log('Scan #1', scan1.status, scan1.json)
    assert(scan1.status === 200, 'Scan #1 should succeed')
    assert(scan1.json?.collection?.status === 'collected', 'Collection should be marked collected')

    // 5) Scan again (expect 409)
    const scan2 = await req('/api/tickets/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(scanBody),
    })
    log('Scan #2 (expect 409)', scan2.status, scan2.json)
    assert(scan2.status === 409, 'Scan #2 should be rejected as already used')

    console.log('\nE2E HTTP PASSED ✅')
  } catch (err) {
    console.error('\nE2E HTTP FAILED ❌', err?.message || err)
    process.exitCode = 1
  }
})()
