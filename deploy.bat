@echo off
echo Deploying to Cloudflare Pages + Worker...
echo.

echo [1/3] Installing dependencies...
npm install -g wrangler 2>nul || npm install wrangler --save-dev

echo.
echo [2/3] Creating KV namespace for caching...
wrangler kv:namespace create "CACHE" --preview false
wrangler kv:namespace create "CACHE" --preview true

echo.
echo [3/3] Deploying Worker...
wrangler deploy

echo.
echo [4/4] Deploying Pages...
wrangler pages deploy . --project-name=tool12 --branch=main

echo.
echo ========================================
echo Done! Your tool is live at:
echo https://tool12.pages.dev
echo.
echo Worker endpoint: https://tool12-discord-proxy.your-subdomain.workers.dev/api
echo ========================================
pause