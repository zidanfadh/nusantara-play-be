# Deployment VPS dengan Nginx dan Docker Compose

Dokumentasi lengkap untuk deploy backend Nusantara Play ke VPS menggunakan Nginx dan Docker Compose.

## Daftar Isi

1. [Persyaratan VPS](#persyaratan-vps)
2. [Setup Manual](#setup-manual)
3. [Setup Auto-Deploy dengan GitHub Actions](#setup-auto-deploy-dengan-github-actions)
4. [Monitoring dan Maintenance](#monitoring-dan-maintenance)
5. [Troubleshooting](#troubleshooting)

---

## Persyaratan VPS

### Minimum Spesifikasi
- **OS**: Ubuntu 22.04 LTS atau Debian 11+
- **RAM**: 2 GB (minimum), 4 GB (recommended)
- **Storage**: 20 GB SSD
- **CPU**: 2 core

### Software yang Dibutuhkan
- Docker Engine 24+
- Docker Compose 2+
- Nginx 1.20+
- Certbot (Let's Encrypt)
- Git

---

## Setup Manual

### 1. Persiapan VPS

Login ke VPS Anda:

```bash
ssh root@your-vps-ip
```

Update sistem:

```bash
apt update && apt upgrade -y
```

### 2. Install Docker

Install Docker dan Docker Compose:

```bash
# Install dependencies
apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker
systemctl enable docker
systemctl start docker
```

### 3. Install Nginx dan Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 4. Setup Firewall

```bash
# Allow SSH, HTTP, dan HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 5. Clone Repository

```bash
# Install git jika belum
apt install -y git

# Clone repository (ganti dengan URL repo Anda)
cd /var
git clone https://github.com/your-username/nusantara-play-backend.git
cd nusantara-play-backend
```

### 6. Setup Environment Variables

Buat file `.env`:

```bash
nano .env
```

Isi dengan konfigurasi production:

```env
NODE_ENV=production
PORT=3000
APP_NAME=Nusantara Play

# Database (External)
DATABASE_HOST=your-external-db-host.com
DATABASE_PORT=5432
DATABASE_USER=your-db-user
DATABASE_PASSWORD=your-db-password
DATABASE_NAME=nusantara_play

# Supabase Auth
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# AWS S3
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=nusantara-play-storage

# CORS
FRONTEND_URLS=https://nusantaralegacy.org,https://nusantaravirtual.org
# Legacy single-origin fallback if FRONTEND_URLS is unset:
# FRONTEND_URL=https://nusantaralegacy.org

# Security
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

Set permission file .env:

```bash
chmod 600 .env
```

### 7. Setup Docker Compose

Build dan jalankan container:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Cek status container:

```bash
docker ps
```

Cek logs:

```bash
docker logs -f nusantara-play-backend
```

### 8. Setup Nginx

Copy konfigurasi nginx:

```bash
# Buat symlink konfigurasi
ln -s /var/nusantara-play-backend/nginx/nginx.conf /etc/nginx/sites-available/nusantara-play-backend
ln -s /etc/nginx/sites-available/nusantara-play-backend /etc/nginx/sites-enabled/

# Hapus default config
rm /etc/nginx/sites-enabled/default

# Test konfigurasi
nginx -t

# Reload nginx
systemctl reload nginx
```

**PENTING**: Edit file nginx config dan ganti `api.nusantaraplay.com` dengan domain Anda:

```bash
nano /var/nusantara-play-backend/nginx/nginx.conf
```

### 9. Setup SSL dengan Let's Encrypt

Sebelum dapat SSL, pastikan DNS sudah mengarah ke VPS:

```bash
# Check DNS resolution
nslookup api.nusantaraplay.com
```

Jika DNS sudah resolve, dapatkan SSL certificate:

```bash
# Dapatkan certificate (akan membuat temporary nginx config)
certbot --nginx -d api.nusantaraplay.com
```

Certbot akan:
1. Membuat SSL certificate
2. Mengupdate nginx config secara otomatis
3. Setup auto-renewal

Cek auto-renewal:

```bash
certbot renew --dry-run
```

### 10. Verify Deployment

Test API:

```bash
# Test health check
curl https://api.nusantaraplay.com/api/health

# Test dengan detail
curl -v https://api.nusantaraplay.com/api/health
```

---

## Setup Auto-Deploy dengan GitHub Actions

### 1. Persiapan VPS untuk Auto-Deploy

Buat user khusus untuk deployment (opsional tapi recommended):

```bash
# Buat user deployer
adduser deployer

# Tambah ke docker group
usermod -aG docker deployer

# Setup sudo untuk deployer (jika perlu)
usermod -aG sudo deployer
```

Setup SSH key untuk GitHub Actions:

```bash
# Switch ke deployer
su - deployer

# Generate SSH key
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# Copy public key ke authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Copy private key (untuk GitHub secret)
cat ~/.ssh/github_actions
```

### 2. Setup GitHub Repository Secrets

Di GitHub repository, masuk ke: **Settings → Secrets and variables → Actions → New repository secret**

Tambahkan secrets berikut:

| Secret Name | Description |
|-------------|-------------|
| `VPS_SSH_KEY` | Private SSH key dari langkah 1 |
| `VPS_HOST` | IP address atau domain VPS |
| `VPS_USER` | User VPS (root atau deployer) |
| `VPS_PATH` | Path project di VPS (/var/nusantara-play-backend) |

### 3. Setup GitHub Container Registry

Untuk auto-deploy, kita akan push Docker image ke GitHub Container Registry.

Buat personal access token (PAT):
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `write:packages`, `read:packages`, `delete:packages`
4. Copy token

Login ke GHCR di VPS (sekali saja):

```bash
echo "YOUR_GITHUB_USERNAME" | docker login ghcr.io -u "YOUR_GITHUB_USERNAME" --password-stdin
```

### 4. Buat GitHub Actions Workflow

Buat file `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script_stop: true
          script: |
            cd ${{ secrets.VPS_PATH }}
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker image prune -af

      - name: Run database migrations
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script_stop: true
          script: |
            cd ${{ secrets.VPS_PATH }}
            docker compose -f docker-compose.prod.yml exec -T backend npm run migration:run
```

### 5. Update docker-compose untuk GHCR

Edit `docker-compose.prod.yml` untuk menggunakan image dari GHCR:

```yaml
services:
  backend:
    image: ghcr.io/your-username/nusantara-play-backend:latest
    # ... other config
```

---

## Monitoring dan Maintenance

### Cek Logs

```bash
# Docker container logs
docker logs -f nusantara-play-backend

# Nginx access logs
tail -f /var/log/nginx/nusantara-access.log

# Nginx error logs
tail -f /var/log/nginx/nusantara-error.log
```

### Update Application

**Manual Update:**

```bash
cd /var/nusantara-play-backend
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

**Auto-Update via GitHub Actions:**

Cukup push ke main branch:
```bash
git add .
git commit -m "feat: new feature"
git push origin main
```

### Backup

**Backup Environment Variables:**

```bash
cp /var/nusantara-play-backend/.env /var/nusantara-play-backend/.env.backup
```

**Backup Database** (jika managed sendiri):

```bash
# Backup
pg_dump -h DB_HOST -U DB_USER DB_NAME > backup.sql

# Restore
psql -h DB_HOST -U DB_USER DB_NAME < backup.sql
```

### Restart Services

```bash
# Restart backend
docker compose -f docker-compose.prod.yml restart

# Restart nginx
systemctl restart nginx
```

### Update SSL Certificate

Certbot auto-renewal sudah setup. Cek status:

```bash
systemctl status certbot.timer
```

Manual renew jika perlu:

```bash
certbot renew
```

---

## Troubleshooting

### Container tidak start

```bash
# Cek logs
docker logs nusantara-play-backend

# Cek container status
docker ps -a

# Rebuild container
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

### Nginx 502 Bad Gateway

Biasanya container backend tidak running atau port salah:

```bash
# Cek apakah container running
docker ps

# Test langsung ke container
curl http://localhost:3000/api/health

# Cek nginx config
nginx -t

# Reload nginx
systemctl reload nginx
```

### SSL Certificate Error

```bash
# Cek certificate status
certbot certificates

# Re-new certificate
certbot renew --force-renewal

# Reload nginx
systemctl reload nginx
```

### Database Connection Error

```bash
# Test connection dari VPS
pg_isready -h DB_HOST -p DB_PORT

# Cek .env
cat /var/nusantara-play-backend/.env

# Cek firewall (jika DB di VPS lain)
ufw status
```

### Out of Memory

```bash
# Cek memory usage
free -h

# Cek Docker resource usage
docker stats

# Cleanup unused images
docker system prune -a

# Setup swap (jika perlu)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Port 3000 Already in Use

```bash
# Cek apa yang menggunakan port 3000
netstat -tlnp | grep :3000

# Kill process jika perlu
kill -9 PID
```

---

## Checklist Deployment

Sebelum go-live, pastikan:

- [ ] VPS sudah disetup dengan spesifikasi minimum
- [ ] Docker dan Docker Compose terinstall
- [ ] Nginx dan Certbot terinstall
- [ ] Firewall sudah diconfigure
- [ ] DNS domain sudah mengarah ke VPS
- [ ] SSL certificate sudah terinstall
- [ ] Environment variables sudah diset dengan benar
- [ ] Database external sudah accessible dari VPS
- [ ] Container backend running tanpa error
- [ ] Nginx proxy berfungsi dengan benar
- [ ] API endpoints bisa diakses via HTTPS
- [ ] Health check endpoint berfungsi
- [ ] Logs bisa diakses untuk monitoring
- [ ] Auto-deploy sudah di-setup (jika menggunakan)
- [ ] Backup plan sudah disiapkan

---

## Commands Cheat Sheet

```bash
# SSH ke VPS
ssh root@your-vps-ip

# Cek container status
docker ps

# Cek logs
docker logs -f nusantara-play-backend

# Restart container
docker compose -f /var/nusantara-play-backend/docker-compose.prod.yml restart

# Update manual
cd /var/nusantara-play-backend && git pull && docker compose -f docker-compose.prod.yml up -d --build

# Cek nginx status
systemctl status nginx

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx

# Cek SSL status
certbot certificates

# Renew SSL manual
certbot renew

# Cek disk usage
df -h

# Cek memory usage
free -h

# Cleanup Docker
docker system prune -a
```

---

## Security Notes

1. **Jangan commit .env file** ke repository
2. **Gunakan strong passwords** untuk database
3. **Enable firewall** dan block ports yang tidak perlu
4. **Regular updates** sistem dan Docker
5. **Monitor logs** untuk aktivitas mencurigakan
6. **Backup data** secara berkala
7. **Rate limiting** sudah di-setup di nginx
8. **SSL only** di production (HTTP redirect ke HTTPS)
