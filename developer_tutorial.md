# Dishcision Developer Setup Guide 🛠️

Follow these step-by-step instructions to configure, run, and test **DISHCISION** locally and expose it to the LINE Developers Webhook interface.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:
- **Python 3.10+** (with [uv](https://github.com/astral-sh/uv) package manager recommended)
- **Node.js 18+** (with `npm` or `yarn`)
- **PostgreSQL Database** running locally or in a Docker container
- **ngrok** and **Cloudflare Tunnel (`cloudflared`)** accounts

---

## 📂 Step 1: Clone and Configure Environment Files

Create the local configuration files:

### 1. Backend Environment Setup
Create a `backend/.env` file:
```env
DATABASE_URL=postgresql://<username>:<password>@localhost:5432/dishcision
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8081/google/callback
FRONTEND_URL=http://localhost:3000
```

### 2. Frontend Environment Setup
Create a `frontend/.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:8081
NEXT_PUBLIC_LIFF_ID=your_line_liff_id
NEXT_PUBLIC_ENABLE_BETA_SURVEY=true # Set to true to show the UAT feedback survey after meeting confirmation
```

---

## 🗄️ Step 2: Initialize Database

1. Create a database named `dishcision` in your PostgreSQL instance.
2. Initialize the tables. You can run the backend once to trigger automatic SQLAlchemy database migrations:
   ```bash
   cd backend
   uv run main.py
   ```
3. Import the initial Thai restaurant dataset (Wongnai restaurant lists):
   ```bash
   cd backend
   uv run scripts/import_restaurants.py
   ```

---

## ⚙️ Step 3: Run the Services Locally

Open three terminal windows:

### Terminal 1: Backend API Service
Navigate to the backend directory and run FastAPI (binds to `http://localhost:8081`):
```bash
cd backend
uv run main.py
```

### Terminal 2: Frontend Client Service
Navigate to the frontend directory and start Next.js dev server (binds to `http://localhost:3000`):
```bash
cd frontend
npm install
npm run dev
```

### Terminal 3: Interactive Playground Routing (Optional)
If you want to test the dynamic scoring algorithm directly without going through the LINE Bot interface:
- Run the playground router by accessing `http://localhost:3000/playground` in your browser.
- You can add attendees, toggle "Key Person", adjust weights, search local restaurants, and observe the ROC weight calculation results immediately.

---

## 🌐 Step 4: Expose Services via Tunnels (For LINE Webviews)

LINE requires HTTPS public endpoints for webviews and webhooks. We provide preconfigured startup scripts:

1. **Expose the Frontend (Cloudflare)**:
   ```bash
   ./start-cloudflared.sh
   ```
   This exposes `http://localhost:3000` to a public URL (e.g., `https://xxxx.trycloudflare.com`). Keep note of this URL.

2. **Expose the Backend (ngrok)**:
   ```bash
   ./start-ngrok.sh
   ```
   This exposes `http://localhost:8081` to a public URL (e.g., `https://xxxx.ngrok-free.app`). Keep note of this URL.

---

## 🤖 Step 5: Configure LINE Developers Console

Log in to the [LINE Developers Console](https://developers.line.biz/):

1. **Messaging API Webhook URL**:
   - Go to your Messaging API Channel settings.
   - Update the **Webhook URL** to point to your backend tunnel URL:
     ```text
     https://<your-backend-ngrok-url>/line/callback
     ```
   - Click **Verify** to ensure the channel connects to your local FastAPI server.
   - Enable **Use Webhook**.

2. **LIFF Application Setup**:
   - Create a LIFF App inside your channel.
   - Set the **Endpoint URL** to point to your frontend Cloudflare tunnel URL:
     ```text
     https://<your-frontend-cloudflare-url>/
     ```
   - Copy the generated **LIFF ID** and paste it into your `frontend/.env.local` file under `NEXT_PUBLIC_LIFF_ID`.
   - Restart the frontend dev server.

Now you can send invitation tickets directly inside LINE group chats, join voting panels, submit schedules, and observe recommendation states syncing in real-time!

---

## ☁️ Step 6: Production Cloud Deployment (AWS EC2 via Docker)

For production, you can package all services and run them securely on an AWS EC2 instance. This setup uses **Cloudflare Tunnels** which enables a secure deployment with **zero inbound ports** open (excluding SSH).

### 1. Configure Cloudflare Tunnel
1. Log in to the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Go to **Networks** -> **Tunnels** and select **Create a Tunnel**.
3. Choose **Cloudflare** as the connector and name your tunnel (e.g., `dishcision-prod`).
4. On the **Setup Environment** page, you can select any tab (like **Docker** or **Debian**). Do not run any commands on your EC2 instance yet; simply find the **Tunnel Token** (the long base64 string starting with `eyJh...` shown after `--token` in the command block) and copy it.
5. In the tunnel settings, map your public hostnames:
   - `yourdomain.com` ➔ `http://frontend:3000` (Next.js Frontend)
   - `api.yourdomain.com` ➔ `http://backend:8081` (FastAPI Backend)

### 2. Configure AWS EC2 Security Group
In the AWS Console, edit the Security Group rules for your EC2 instance:
- **Inbound SSH (Port 22):** Restricted to **your IP address**.
- **Inbound HTTP (Port 80) / HTTPS (Port 443):** Keep **CLOSED**. The Cloudflare Tunnel container handles routing outbound securely, removing the need for open public ports.

### 3. Deploy the Stack on EC2
Log in to your EC2 instance via SSH and execute:

```bash
# 1. Install Docker & Compose
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker

# 2. Clone the repository and configure environments
git clone <your-repo-url>
cd dishcision-line-bot
```

Create a production `.env` file in the root directory:
```env
# Database Settings
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=dishcision
DATABASE_URL=postgresql://postgres:your_secure_password@db:5432/dishcision

# LINE API Credentials
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret
NEXT_PUBLIC_LIFF_ID=your_liff_id
NEXT_PUBLIC_ENABLE_BETA_SURVEY=true # Set to true to show UAT survey for beta group after meeting confirm

# Google OAuth Config
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/google/callback

# URLs
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Cloudflare Token
CLOUDFLARE_TUNNEL_TOKEN=your_copied_cloudflare_token
```

Start the containerized stack (using the `prod` profile to spin up backend, frontend, and tunnel):
```bash
docker compose -f deploy/docker-compose.yml --profile prod up -d --build
```

### 4. Initialize Database & Import Data
Run migrations and populate the local database list inside the active backend container:
```bash
docker compose -f deploy/docker-compose.yml --profile prod exec backend python scripts/import_restaurants.py
```

### 5. Update Webhook and LIFF URLs
Update the addresses in your **LINE Developers Console** to point to your secure domains:
1. **Webhook URL:** `https://api.yourdomain.com/line/callback`
2. **LIFF Endpoint URL:** `https://yourdomain.com/`

