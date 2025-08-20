# FoodShare Blockchain Integration (optional)

This folder contains a minimal Hardhat setup and a small relayer/listener that subscribes to on-chain events and forwards them to the existing FoodShare notifications API.

Why? This gives a tamper-evident, auditable event stream for important actions (food listed, expiring soon alerts, events listed/started/ended) and allows external systems to publish notifications that the backend relayer ingests in real-time.

What is included
- `contracts/FoodShareEvents.sol` — minimal Solidity contract that emits events for food and events lifecycle.
- `scripts/deploy.js` — deploy contract to a local Hardhat node.
- `scripts/listen.js` — a node script that connects to a JSON-RPC provider, listens for contract events, and POSTs structured notifications to your existing `/api/notifications` endpoint.

Quick start (local)
1. Install dependencies

```bash
cd blockchain
pnpm install
```

2. Start a local Hardhat node in one terminal

```bash
pnpm run node
```

3. Deploy the contract in another terminal

```bash
pnpm run deploy
# copy the printed contract address
```

4. Set environment variables for the listener (create `.env` in `blockchain/`):

```
CONTRACT_ADDRESS=0x...
RPC_URL=http://127.0.0.1:8545
NOTIFICATIONS_API=http://localhost:3002/api/notifications
```

5. Start the listener

```bash
pnpm run listen
```

6. Emit events (developer-only) — you can call the contract methods from a Hardhat script or via Remix / Ethers to simulate `emitFoodListed`, `emitEventListed`, etc.

Security & notes
- The contract methods are `onlyOwner` — the owner is the deployer account. The listener/broadcaster should be run by a trusted relayer that holds the owner key or by a process that calls contract methods via the owner address.
- This integration does not replace server-side checks — the listener simply forwards events as notifications. The server still controls persistence and filtering.

Next steps
- Optionally sign notifications and verify on the server.
- Add on-chain anchors for critical actions (e.g., listing id hashes) for auditability.
- If you want, I can wire server-side verification to accept only relayer-signed messages or a proof-of-inclusion check.
