# EverythingStraps MCP Server

An MCP (Model Context Protocol) server that turns AI assistants (Claude, ChatGPT, Cursor, etc.) into a 24/7 sales channel for EverythingStraps.

When a user asks an AI assistant "what strap should I use for CrossFit with my Amazfit Helio?" or "can I connect my Helio to a Whoop 5.0?" — this server returns direct product recommendations and buy links from everythingstraps.com.

---

## Tools

| Tool | What it does |
|------|---|
| `find_strap` | Returns product recommendations for a given use case or query |
| `check_compatibility` | Answers Whoop compatibility questions with product links |
| `get_product` | Returns full details for a specific product |
| `answer_faq` | Answers common questions about the Amazfit Helio |
| `list_products` | Lists all products, filterable by type |

---

## Deploy to Railway (5 minutes)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "EverythingStraps MCP server"
git remote add origin https://github.com/YOUR_USERNAME/everythingstraps-mcp.git
git push -u origin main
```

### Step 2 — Deploy on Railway
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select your `everythingstraps-mcp` repo
3. Railway auto-detects Node.js and runs `node server.js`
4. Click **Generate Domain** in Settings → copy the URL (e.g. `https://everythingstraps-mcp.up.railway.app`)

### Step 3 — Update the URL
Edit `smithery.yaml` — replace the endpoint URL with your Railway domain:
```yaml
endpoint: "https://YOUR-APP.up.railway.app/sse"
```

---

## Register on Smithery

1. Go to [smithery.ai/submit](https://smithery.ai/submit)
2. Submit your Railway URL: `https://YOUR-APP.up.railway.app`
3. Smithery auto-discovers tools from the `/sse` endpoint
4. Your server appears in Smithery's directory — users can install it in Claude/Cursor in one click

---

## Register on OpenTools

1. Go to [opentools.ai](https://opentools.ai) → Submit a Tool
2. Name: `EverythingStraps`
3. MCP endpoint: `https://YOUR-APP.up.railway.app/sse`
4. Description: paste from `smithery.yaml`

---

## Test locally

```bash
npm install
npm start
# Server running at http://localhost:3000
# MCP endpoint: http://localhost:3000/sse
```

---

## How it works

```
User: "What strap should I use for Hyrox?"
         ↓
   AI Assistant
         ↓
  EverythingStraps MCP Server  ←── find_strap("hyrox")
         ↓
  Returns: Bicep Loop V2 with price + buy link
         ↓
   User buys
```

Zero ad spend. The AI assistant is your sales team.
