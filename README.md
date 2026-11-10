# Lobbyopoly

Online banker for in-person board game nights. FastAPI + React, MongoDB for lobbies, Redis for sessions.

## Configuration

| Variable | Required | Example |
| --- | --- | --- |
| `MONGODB_HOST` | yes | `mongodb+srv://user:pass@cluster.mongodb.net/lobbyopoly` (must include a database name) |
| `REDIS_URL` | yes | `redis://localhost:6379/0` |
| `PORT` | no | `5000` (default) |
| `INSECURE_COOKIES` | no | `1` for local plain-HTTP dev only |

Run a single instance with a single worker: websocket connections are tracked in memory.

## Deploy free on Render

1. Create a free MongoDB Atlas M0 cluster on AWS `ap-southeast-1` (Singapore, same region as the Render services). Add a database user and allow network access from `0.0.0.0/0` (Render's free tier has no static IP). Copy the connection string and add `/lobbyopoly` before the `?`.
2. In Render: **New > Blueprint**, pick this repo. It creates the web service and a free Redis (Key Value) instance from `render.yaml`.
3. Paste the Atlas string when prompted for `MONGODB_HOST`.

Free web services sleep after 15 minutes idle; the first request afterwards takes about a minute.

## Self-host

```sh
DOMAIN=game.example.com docker compose up -d
```

Point the domain's DNS at the server first; Caddy fetches the TLS certificate automatically.

## Release

```sh
git tag v1.0.0 && git push --tags
```

GitHub Actions builds `ghcr.io/sudhanshu1306/lobbyopoly:<tag>` and creates a GitHub release.

## Local development

```sh
docker run -d -p 27017:27017 mongo:7 && docker run -d -p 6379:6379 redis:7-alpine
pip install -r requirements.txt && npm install
MONGODB_HOST=mongodb://localhost:27017/lobbyopoly REDIS_URL=redis://localhost:6379/0 INSECURE_COOKIES=1 honcho start dev
npm start
```
