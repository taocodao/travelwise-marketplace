# Read API keys from root .env
$envFile = Get-Content ".env"
$googleMapsKey = ""
$weatherKey = ""

foreach ($line in $envFile) {
    if ($line -match "GOOGLE_MAPS_API_KEY=(.+)") {
        $googleMapsKey = $matches[1]
    }
    if ($line -match "OPENWEATHER_API_KEY=(.+)") {
        $weatherKey = $matches[1]
    }
}

Write-Host "🚀 Starting MCP Servers with Real APIs..." -ForegroundColor Green

# Google Maps
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:GOOGLE_MAPS_API_KEY='$googleMapsKey'; `$env:PORT=3003; npx tsx packages/mcp-servers/google-maps/src/index.ts"

# Weather
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:OPENWEATHER_API_KEY='$weatherKey'; `$env:PORT=3004; npx tsx packages/mcp-servers/weather/src/index.ts"

# Travel Agent
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:PORT=3005; npx tsx packages/mcp-servers/travel-agent/src/index.ts"

Write-Host "✅ All MCP servers starting!" -ForegroundColor Green
Write-Host "Wait 5 seconds then check: http://localhost:3003/health" -ForegroundColor Yellow
