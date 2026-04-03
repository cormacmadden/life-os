# AI Coding Agent Instructions for LifeOS

Welcome to the LifeOS project! This document provides essential guidance for AI coding agents to be productive in this codebase. It covers the architecture, workflows, conventions, and integration points specific to LifeOS.

---

## **Big Picture Architecture**

LifeOS is a personal dashboard that integrates with various services like Spotify, Garmin Connect, Google Calendar, and Home Assistant. It consists of the following major components:

### **Backend**
- **Framework:** FastAPI
- **Location:** `backend/`
- **Responsibilities:**
  - Provides RESTful APIs for widgets and integrations.
  - Handles OAuth flows for third-party services (e.g., Spotify, Monzo).
  - Manages database interactions using SQLite (default).
- **Key Files:**
  - `backend/main.py`: FastAPI app entry point.
  - `backend/routers/`: Contains modular API endpoints (e.g., `spotify.py`, `garmin.py`).
  - `backend/models.py`: Defines database models.
  - `backend/database.py`: Handles database connections.

### **Frontend**
- **Framework:** Next.js
- **Location:** `frontend/`
- **Responsibilities:**
  - Provides the user interface for the dashboard.
  - Dynamically detects and communicates with the backend (local or remote).
  - Hosts modular widgets for various features.
- **Key Files:**
  - `frontend/app/page.tsx`: Main dashboard page.
  - `frontend/components/widgets/`: Contains widget components (e.g., `SpotifyWidget.tsx`, `WeatherWidget.tsx`).
  - `frontend/lib/config.ts`: Configures API URLs and environment variables.

### **Database**
- **Default:** SQLite (local development).
- **Migration:** Migration scripts are located in `backend/` (e.g., `migrate_add_image_url.py`).

### **Remote Access**
- **Cloudflare Tunnel:** Used for secure remote access to the backend and frontend.
- **Auto-Detection:** Frontend dynamically switches between local and remote backend URLs.

---

## **Critical Developer Workflows**

### **Local Development**
1. **Backend:**
   ```bash
   # Activate virtual environment
   venv\Scripts\activate  # Windows
   source venv/bin/activate  # macOS/Linux

   # Start FastAPI backend
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8080
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the Dashboard:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API Docs: [http://localhost:8080/docs](http://localhost:8080/docs)

### **Testing**
- **Health Check Script:**
  - Location: `backend/tests/health-check.ps1`
  - Usage: Verifies backend and frontend are running correctly.

### **Database Initialization**
- Endpoint: `/api/init-db`
- Initializes database tables during first-time setup.

### **Remote Access Setup**
- Use `setup-cloudflare.ps1` to configure Cloudflare Tunnel.
- Update OAuth redirect URIs to use the Cloudflare URL.

---

## **Project-Specific Conventions**

1. **API Design:**
   - Modular routers in `backend/routers/`.
   - Use `/api/` prefix for all endpoints.

2. **Widget Development:**
   - Create new widgets in `frontend/components/widgets/`.
   - Import and register widgets in `frontend/app/page.tsx`.

3. **Environment Variables:**
   - Store sensitive data in `.env` files.
   - Use `dotenv` to load variables in the backend.

4. **Logging:**
   - Backend logs requests and filters noisy endpoints (e.g., `/api/spotify/current-track`).

---

## **Integration Points**

1. **Spotify Integration:**
   - OAuth flow implemented in `backend/routers/spotify.py`.
   - Tokens stored in `spotify_tokens.json`.

2. **Garmin Connect:**
   - Uses unofficial Garmin Connect API.
   - Credentials loaded from `.env`.

3. **Home Assistant:**
   - Interacts with HA via REST API.
   - Base URL and token configured in `.env`.

4. **Cloudflare Tunnel:**
   - Enables secure remote access.
   - Auto-detection logic in `frontend/lib/config.ts`.

---

## **Examples**

### **Adding a New Widget**
1. Create a widget component in `frontend/components/widgets/YourWidget.tsx`.
2. Import and add it to `frontend/app/page.tsx`.
3. Create a backend router in `backend/routers/your_feature.py`.
4. Register the router in `backend/main.py`.

### **OAuth Integration**
- Example: Spotify OAuth in `backend/routers/spotify.py`.
- Redirect URI: `http://localhost:8080/api/spotify/callback` (update for production).

---

Feel free to iterate on this document as the project evolves!