# Dishcision LINE Bot - Tunnels Guide

When developing this application locally, you need to expose your local frontend (Next.js) or backend (FastAPI) to the public internet so that the LINE Platform (Webhooks / LIFF apps) can communicate with it.

We use **Cloudflare Tunnels** (`cloudflared`) as our tunneling solution.

---

## Cloudflare Tunnels (Recommended & Default)

Cloudflare Tunnels (`cloudflared`) is completely free and **does not** inject any interstitial browser warning pages. This makes it the superior choice for testing LIFF web apps embedded in the mobile LINE app on both iOS and Android.

*(Note: We deliberately do not use `ngrok` for this project because ngrok's free tier intercepts frontend HTML loads with a warning screen that completely breaks our Android LINE Webview experience).*

### Setup and Start
1. Install Cloudflare:
   ```bash
   # On macOS
   brew install cloudflare/cloudflare/cloudflared
   ```
2. Start the tunnel to expose the frontend (default Next.js port is 3001):
   ```bash
   ./start-cloudflared.sh
   # Or manually: cloudflared tunnel --url http://localhost:3001
   ```
3. Copy the URL ending in `.trycloudflare.com` from the terminal output and use it in your LINE Developer Console for the LIFF URL.

**Notes & Limitations**: 
- URLs are randomly generated upon every restart unless you link a Cloudflare account with a purchased domain name.
