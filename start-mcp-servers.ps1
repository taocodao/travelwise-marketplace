# start-mcp-servers.ps1
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

# Google Maps - CD to directory first
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\packages\mcp-servers\google-maps'; `$env:GOOGLE_MAPS_API_KEY='$googleMapsKey'; `$env:PORT=3003; npx tsx src/index.ts"

Start-Sleep -Seconds 2

# Weather - CD to directory first
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\packages\mcp-servers\weather'; `$env:OPENWEATHER_API_KEY='$weatherKey'; `$env:PORT=3004; npx tsx src/index.ts"

Start-Sleep -Seconds 2

# Travel Agent
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\packages\mcp-servers\travel-agent'; `$env:PORT=3005; npx tsx src/index.ts"

Write-Host "✅ All MCP servers starting!" -ForegroundColor Green
Write-Host "Wait 5 seconds then check health endpoints" -ForegroundColor Yellow
