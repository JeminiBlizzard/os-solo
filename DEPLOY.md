# OS // SOLO Deployment Guide

## Prerequisites

- Brock Cloud VPS (69.62.87.127)
- Docker and Docker Compose installed
- Caddy web server running
- Access to brockindustries.cloud DNS management

## DNS Configuration

Add an A record for `solo.brockindustries.cloud` pointing to the VPS:

```
solo.brockindustries.cloud -> 69.62.87.127
```

Verify DNS propagation:
```bash
dig solo.brockindustries.cloud +short
# Should return: 69.62.87.127
```

## Deployment Steps

### 1. Navigate to the application directory

```bash
cd /opt/os-solo
```

### 2. Create environment file (if not exists)

```bash
cp .env.example .env
# Edit .env with production values
```

**Required environment variables:**
- `PORT=3200`
- `NODE_ENV=production`
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secure random string
- `ANTHROPIC_API_KEY` - For AI features
- `VAULT_ENCRYPTION_KEY` - 32-byte encryption key

### 3. Build and start containers

```bash
docker compose build
docker compose up -d
```

### 4. Verify containers are running

```bash
docker compose ps
# Both postgres and os-solo should be healthy/running

# Test the API
curl http://localhost:3200/api/v1/health
```

### 5. Caddy Configuration

The Caddy route is configured at `/etc/caddy/Caddyfile`:

```
solo.brockindustries.cloud {
    encode gzip
    reverse_proxy 127.0.0.1:3200
}
```

To reload Caddy after any changes:
```bash
sudo systemctl restart caddy
```

### 6. Verify external access

```bash
curl -I https://solo.brockindustries.cloud/api/v1/health
# Should return HTTP 200

curl https://solo.brockindustries.cloud/api/v1/health
# Should return: {"success":true,"data":{"status":"ok",...}}
```

## Troubleshooting

### Check container logs
```bash
docker logs os-solo
docker logs os-solo-postgres-1
```

### Check Caddy logs
```bash
journalctl -u caddy -f
```

### Restart containers
```bash
docker compose down
docker compose up -d
```

### Verify network connectivity
```bash
# Check os-solo is on webnet
docker inspect os-solo --format '{{range .NetworkSettings.Networks}}{{.NetworkID}} {{end}}'
```

## Container Details

- **Container name:** `os-solo`
- **Internal port:** 3200
- **Networks:** webnet (external), internal (bridge)
- **PostgreSQL:** `os-solo-postgres-1` on internal network only

## Updates

To deploy updates:

```bash
cd /opt/os-solo
git pull origin main  # or fetch new code
docker compose build --no-cache
docker compose down
docker compose up -d
```
