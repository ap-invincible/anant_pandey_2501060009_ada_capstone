# Delivery Network Optimization Using Minimum Spanning Trees

Connect delivery locations (vertices) with possible routes (weighted edges) at minimum total cost using **Prim's** and **Kruskal's** algorithms.

## Stack
- **Backend + Database (single Docker image):** FastAPI + SQLite (`backend/Dockerfile`)
- **Frontend:** React.js + Vite (`frontend/`)

## Simple API Routes
- `GET /health` — Health check
- `GET /networks` — List saved networks
- `POST /networks` — Save network
- `GET /networks/{id}` — Get network by ID
- `DELETE /networks/{id}` — Delete network
- `POST /optimize` — Run Prim's & Kruskal's with step-by-step trace
- `POST /generate` — Generate sample topology (`city_grid`, `hub_spoke`, `sparse`, `dense`)
- `GET /compare-configs` — Compare Prim vs Kruskal across sparse & dense configurations
- `GET /runs` — List recent optimization runs

## Quick Start

### 1. Backend + SQLite (Docker — Single Image)
```bash
docker build -t delivery-mst-backend ./backend
docker run -p 8000:8000 delivery-mst-backend
```
Or with Compose:
```bash
docker compose up --build
```

### 2. Frontend (React.js)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.
