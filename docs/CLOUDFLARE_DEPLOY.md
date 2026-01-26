# Cloudflare WARP SSH Deployment

This document describes how to configure Cloudflare WARP for SSH access to your dev server.

## Architecture

```
GitHub Actions                          Cloudflare WARP              Dev Server
    |                                        |                          |
    |  1. Build images                       |                          |
    |  2. Push to GHCR                      |                          |
    |  3. cloudflared access ssh            |                          |
    |  +----------------------------------->| WARP tunnel established |
    |  |                                     +----------------------> |
    |  |  4. ssh root@[server-ip]            |                          |
    |  +----------------------------------->|------------------------> |
    |                                        |                          |
    |                                        |                          |  docker-compose up -d
```

## Prerequisites

1. **Cloudflare Zero Trust** account
2. **Dev server** with Docker installed
3. **GitHub repository** with Actions enabled

## Step 1: Set Up Cloudflare Zero Trust

### 1.1 Create a WARP Connector

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. Navigate to **Access** > **WARP Connector**
3. Click **Add**
4. Name it `dev-server-warp`
5. Copy the install command

### 1.2 Install WARP on Dev Server

Run the install command on your dev server:

```bash
# Example install command (copy from Zero Trust dashboard)
curl -L --output /tmp/cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  && sudo dpkg -i /tmp/cloudflared.deb

# Verify
cloudflared --version
```

### 1.3 Authenticate WARP

```bash
# Login to Cloudflare
cloudflared access login

# Or for headless environments, use service token
# (see Zero Trust dashboard > Access > Service Auth)
```

### 1.4 Configure WARP to Route SSH

Create `/etc/cloudflared/config.yml` on the dev server:

```yaml
# /etc/cloudflared/config.yml
hostname: dev.yourdomain.com
logfile: /var/log/cloudflared.log
metrics: 0.0.0.0:0
```

### 1.5 Start WARP Service

```bash
sudo cloudflared service install --file /etc/cloudflared/config.yml
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## Step 2: Configure GitHub Actions Access

### 2.1 Set Up Application in Zero Trust

1. Go to **Access** > **Applications**
2. Click **Add an application**
3. Select **Self-hosted**
4. Configure:
   - Application domain: `dev.yourdomain.com`
   - Session duration: As needed
5. Add a **Policy**:
   - Name: `Allow GitHub Actions`
   - Action: `Allow`
   - Configure rules (e.g., GitHub organization, IP ranges)

## Step 3: Prepare Dev Server

### 3.1 SSH Configuration

Ensure SSH allows key-based authentication:

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers deploy
```

### 3.2 Create Deployment User

```bash
# Create a dedicated user for deployments
sudo adduser deploy
sudo usermod -aG docker deploy

# Set permissions on project directory
sudo chown -R deploy:deploy /opt/multi-currency-accounting
```

## Step 4: Generate SSH Keys

```bash
# Generate ED25519 key (no passphrase for CI)
ssh-keygen -t ed25519 -C "github-actions@github.com" -f github-actions-key

# Display public key to add to server
cat github-actions-key.pub

# Add to deploy user's authorized_keys
echo "ssh-ed25519 AAAA... github-actions@github.com" >> /home/deploy/.ssh/authorized_keys
```

## Step 5: Configure GitHub Secrets

Go to **Settings > Secrets and variables > Actions**:

| Secret | Description | Example |
|--------|-------------|---------|
| `DEPLOY_NODE_USER` | SSH username | `deploy` |
| `DEPLOY_NODE_ADDR` | Server hostname or IP | `dev.yourdomain.com` or `192.168.1.100` |
| `DEPLOY_NODE_PATH` | Project directory | `/opt/multi-currency-accounting` |
| `DEPLOY_NODE_SSH_PRIVATE_KEY` | ED25519 private key | `-----BEGIN OPENSSH...` |
| `DEPLOY_NODE_SSH_KNOWN_HOSTS` | Server SSH host key | `dev.yourdomain.com ssh-ed25519...` |

### Getting SSH Known Hosts

```bash
ssh-keyscan -t ed25519 dev.yourdomain.com
```

## Step 6: Test Deployment

### Manual Test

```bash
# Build and push test images
docker buildx build -t ghcr.io/org/repo:test ./backend --push
docker buildx build -t ghcr.io/org/repo:test ./frontend --push

# Run workflow manually
gh workflow run deploy-dev.yml -f environment=dev
```

### Local Testing

```bash
# Install cloudflared
curl -L -o /usr/local/bin/cloudflared \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x /usr/local/bin/cloudflared

# Connect to WARP
cloudflared access ssh --hostname dev.yourdomain.com

# In another terminal:
ssh -o StrictHostKeyChecking=no deploy@dev.yourdomain.com
```

## How It Works

1. **cloudflared access ssh** establishes a WARP tunnel to Cloudflare
2. Once connected, your GitHub Actions runner is "inside" the Cloudflare network
3. SSH directly to `$DEPLOY_NODE_ADDR` - the server is now reachable
4. Execute deploy commands via SSH

## Security Considerations

1. **Use ED25519 keys** - More secure than RSA
2. **No passphrase on CI keys** - Required for automation
3. **Limit GitHub IP ranges** - Configure in Cloudflare Access policy
4. **Use separate deploy user** - Not root
5. **Rotate keys periodically** - Best practice

## Troubleshooting

### WARP Connection Fails

```bash
# Check cloudflared status
sudo systemctl status cloudflared

# Check logs
sudo journalctl -u cloudflared -f

# Verify config
cloudflared tunnel list
```

### SSH Permission Denied

```bash
# Verify authorized_keys on server
cat /home/deploy/.ssh/authorized_keys

# Check SSH config
sudo sshd -t
```

### Cannot Reach Server IP

```bash
# Verify DNS resolution
nslookup dev.yourdomain.com

# Check if server is in Cloudflare network
cloudflared access ssh --hostname dev.yourdomain.com --url tcp://localhost:2222 &
ssh -p 2222 deploy@localhost
```
