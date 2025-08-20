const hre = require('hardhat')
const { ethers } = hre
require('dotenv').config()
const fetch = require('node-fetch')

// Set this to your deployed contract address or use .env
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || ''
const NOTIFICATIONS_API = process.env.NOTIFICATIONS_API || 'http://localhost:3002/api/notifications'

async function main() {
  if(!CONTRACT_ADDRESS) {
    console.error('Please set CONTRACT_ADDRESS in .env or update the script')
    process.exit(1)
  }

  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545')
  const abi = [
    'event FoodListed(bytes32 indexed listingId, string title, string location, uint256 timestamp, uint256 qtyKg)',
    'event FoodExpiringSoon(bytes32 indexed listingId, string title, string location, uint256 expiresAt)',
    'event EventListed(bytes32 indexed eventId, string title, string location, uint256 startAt, uint256 endAt, uint256 expectedSurplusKg)',
    'event EventStarted(bytes32 indexed eventId, uint256 timestamp)',
    'event EventEnded(bytes32 indexed eventId, uint256 timestamp)'
  ]

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider)

  contract.on('FoodListed', async (listingId, title, location, timestamp, qtyKg) => {
    console.log('FoodListed', listingId.toString(), title, location, qtyKg.toString())
    // forward to existing notifications API
    await fetch(NOTIFICATIONS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_listing',
        title: `New listing: ${title}`,
        message: `A new food listing is available at ${location}. Quantity: ${qtyKg} kg.`,
        priority: 'medium',
        // no userId (broadcast) — server will broadcast except organizer if logic exists
      })
    }).catch(e=>console.error('forward error', e))
  })

  contract.on('FoodExpiringSoon', async (listingId, title, location, expiresAt) => {
    console.log('FoodExpiringSoon', listingId.toString(), title)
    await fetch(NOTIFICATIONS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'expiry_warning',
        title: `Expiring soon: ${title}`,
        message: `${title} at ${location} is expiring soon.`,
        priority: 'high'
      })
    }).catch(e=>console.error('forward error', e))
  })

  contract.on('EventListed', async (eventId, title, location, startAt, endAt, expectedSurplusKg) => {
    console.log('EventListed', eventId.toString(), title)
    await fetch(NOTIFICATIONS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_event',
        title: `New Event Added: ${title}`,
        message: `Event at ${location} on ${new Date(startAt.toNumber()*1000).toLocaleString()}. Expected surplus: ${expectedSurplusKg} kg.`,
        priority: 'medium'
      })
    }).catch(e=>console.error('forward error', e))
  })

  contract.on('EventStarted', async (eventId, ts) => {
    console.log('EventStarted', eventId.toString())
    await fetch(NOTIFICATIONS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_started',
        title: `Event Started`,
        message: `Event ${eventId} has started.`,
        priority: 'medium'
      })
    }).catch(e=>console.error('forward error', e))
  })

  contract.on('EventEnded', async (eventId, ts) => {
    console.log('EventEnded', eventId.toString())
    await fetch(NOTIFICATIONS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event_ended',
        title: `Event Ended`,
        message: `Event ${eventId} has ended.`,
        priority: 'low'
      })
    }).catch(e=>console.error('forward error', e))
  })

  console.log('Listening to contract at', CONTRACT_ADDRESS)
}

main().catch(e=>{ console.error(e); process.exit(1) })
