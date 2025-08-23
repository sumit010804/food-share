# FoodShare Socket Server

Minimal Socket.IO server suitable for Render/Railway/Fly/etc.

## Local run

pnpm i
pnpm --filter ./socket-server dev

## Deploy on Render (recommended quick start)

1. Push this folder as its own repo (or set Render root dir to `socket-server`).
2. Create Web Service:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: add `SOCKET_CORS_ORIGINS=https://your-frontend.vercel.app`
3. After deploy, copy the External URL (e.g., `https://your-socket.onrender.com`).
4. In Vercel project env, set `NEXT_PUBLIC_SOCKET_URL` to that URL and redeploy.

## Notes

- Uses `transports: ['websocket','polling']` for broad compatibility.
- You can lock CORS to multiple domains with comma-separated `SOCKET_CORS_ORIGINS`.
