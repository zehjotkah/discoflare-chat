# Quick Start Guide

Get your chat widget up and running in 30 minutes.

## Prerequisites

- Cloudflare account (free tier works)
- Discord server with admin access
- Node.js 18+ installed
- 30 minutes of your time

## Step 1: Discord Setup (5 minutes)

1. Go to https://discord.com/developers/applications
2. Click "New Application" and name it "Support Chat Bot"
3. Go to "Bot" tab and click "Add Bot"
4. Enable these intents:
   - Message Content Intent
   - Server Members Intent
5. Copy the bot token (you'll need this later)
6. Go to "OAuth2" and then "URL Generator"
   - Scopes: `bot`
   - Permissions: Read Messages, Send Messages, Create Public Threads, Send Messages in Threads
7. Copy the URL and invite bot to your server
8. In Discord, right-click your support channel and select "Copy Channel ID"

## Step 2: Cloudflare Turnstile (3 minutes)

1. Go to https://dash.cloudflare.com/ and navigate to Turnstile
2. Click "Add Site"
3. Enter your domain
4. Widget Mode: Managed (Invisible)
5. Copy both Site Key and Secret Key

## Step 3: Install & Configure (5 minutes)

```bash
# Clone repository
git clone https://github.com/zehjotkah/discoflare-chat.git
cd discoflare-chat

# Install dependencies
npm install

# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## Step 4: Set Secrets (5 minutes)

### Main Worker Secrets

```bash
cd workers/main-worker

# Discord bot token
wrangler secret put DISCORD_BOT_TOKEN
# Paste your bot token

# Discord channel ID
wrangler secret put DISCORD_SUPPORT_CHANNEL_ID
# Paste your channel ID

# Turnstile secret key
wrangler secret put TURNSTILE_SECRET_KEY
# Paste your Turnstile secret key

# Generate and set bot relay secret
wrangler secret put BOT_RELAY_SECRET
# Generate with: openssl rand -hex 32
# Or: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Allowed origins
wrangler secret put ALLOWED_ORIGINS
# Example: https://example.com,https://www.example.com

cd ../..
```

### Bot Relay Secrets

```bash
cd workers/bot-relay

# Same bot token as main worker
wrangler secret put DISCORD_BOT_TOKEN

# Same secret as main worker
wrangler secret put BOT_RELAY_SECRET

# We'll set MAIN_WORKER_URL after deployment
cd ../..
```

## Step 5: Deploy (5 minutes)

```bash
# Deploy everything
bash scripts/deploy.sh
```

After deployment, you'll see the main worker URL. Copy it.

```bash
# Set main worker URL in bot relay
cd workers/bot-relay
wrangler secret put MAIN_WORKER_URL
# Paste: https://discoflare-chat-main.your-subdomain.workers.dev
cd ../..
```

## Step 6: Add to Your Website (2 minutes)

Add this to your HTML before `</body>`:

```html
<!-- Cloudflare Turnstile -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<!-- DiscoFlare Chat Widget -->
<script src="https://your-cdn.com/chat-widget.min.js"></script>
<script>
  window.DiscoFlareChat = {
    workerUrl: 'https://discoflare-chat-main.your-subdomain.workers.dev',
    turnstileSiteKey: 'your-turnstile-site-key',
    theme: {
      primaryColor: '#5865F2',
      position: 'bottom-right'
    }
  };
</script>
```

## Step 7: Test (5 minutes)

1. Open your website
2. Click the chat button
3. Enter name and email
4. Send a test message
5. Check Discord - you should see a new thread with your message
6. Reply in Discord - response should appear in the chat widget

## Troubleshooting

### Chat button doesn't appear
- Check browser console for errors
- Verify widget script is loading
- Check configuration is set before script loads

### "Failed to verify CAPTCHA"
- Verify Turnstile site key is correct
- Check Turnstile secret key in worker
- Ensure domain is added to Turnstile site

### Messages not appearing in Discord
- Verify bot token is correct
- Check bot has proper permissions
- Verify channel ID is correct
- Run: `cd workers/main-worker && wrangler tail` to see logs

### Agent responses not appearing
- Verify bot relay is running
- Check MAIN_WORKER_URL is set correctly
- Verify BOT_RELAY_SECRET matches in both workers
- Run: `cd workers/bot-relay && wrangler tail` to see logs

## Next Steps

- Customize the widget theme to match your brand
- Set up monitoring and alerts
- Review security settings
- Train your support team on using Discord

## Need Help?

- Full documentation: README.md
- Deployment guide: plans/deployment-guide.md
- Architecture details: plans/architecture.md

## Cost Estimate

For most websites, this will run on Cloudflare's free tier:
- Small site (1,000 visitors/day, 5% chat): Free
- Medium site (10,000 visitors/day, 5% chat): Free to $1/month
- Large site (100,000 visitors/day, 5% chat): $5-10/month

Compare to traditional solutions: $50-500/month

---

That's it. You now have a production-ready chat widget that achieves perfect Lighthouse scores.
