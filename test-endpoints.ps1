#!/usr/bin/env pwsh
# Test all CRM endpoints

Write-Host "🧪 Testing CRM System Endpoints..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"
$endpoints = @(
    @{ Name = "Health Check"; Url = "$baseUrl/health" },
    @{ Name = "Bot Stats"; Url = "$baseUrl/api/bots/stats" },
    @{ Name = "List Bots"; Url = "$baseUrl/api/bots" },
    @{ Name = "Leads"; Url = "$baseUrl/api/leads" },
    @{ Name = "Analytics"; Url = "$baseUrl/api/analytics" },
    @{ Name = "Inbox Stats"; Url = "$baseUrl/api/inbox/stats" },
    @{ Name = "Automation"; Url = "$baseUrl/api/automation" },
    @{ Name = "Campaigns"; Url = "$baseUrl/api/campaigns" }
)

foreach ($endpoint in $endpoints) {
    try {
        Write-Host "Testing $($endpoint.Name)..." -ForegroundColor Yellow -NoNewline
        $response = Invoke-WebRequest -Uri $endpoint.Url -UseBasicParsing -TimeoutSec 5
        
        if ($response.StatusCode -eq 200) {
            Write-Host " ✅ OK" -ForegroundColor Green
            
            # Parse JSON and show key info
            $json = $response.Content | ConvertFrom-Json
            if ($json.success) {
                if ($endpoint.Name -eq "Bot Stats" -and $json.stats) {
                    Write-Host "   📊 Bots: $($json.stats.total_bots) total, $($json.stats.active_bots) active" -ForegroundColor Gray
                }
                elseif ($endpoint.Name -eq "Leads" -and $json.leads) {
                    Write-Host "   👥 Leads: $($json.leads.Count) found" -ForegroundColor Gray
                }
                elseif ($endpoint.Name -eq "Campaigns" -and $json.campaigns) {
                    Write-Host "   📢 Campaigns: $($json.campaigns.Count) found" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host " ❌ Error: $($response.StatusCode)" -ForegroundColor Red
        }
    }
    catch {
        Write-Host " ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎯 Testing Bot Creation..." -ForegroundColor Cyan

try {
    $botData = @{
        name = "Test Bot $(Get-Date -Format 'HHmm')"
        channel = "whatsapp"
        bot_type = "auto_reply"
        welcome_message = "Hello from PowerShell test!"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/api/bots" -Method POST -Body $botData -ContentType "application/json" -UseBasicParsing
    
    if ($response.StatusCode -eq 201) {
        Write-Host "✅ Bot created successfully!" -ForegroundColor Green
        $newBot = ($response.Content | ConvertFrom-Json).bot
        Write-Host "   🤖 Bot ID: $($newBot.id), Name: $($newBot.name)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Bot creation failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "🚀 CRM System Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Available URLs:" -ForegroundColor Yellow
Write-Host "  📡 API Server:    http://localhost:3000" -ForegroundColor White
Write-Host "  🌐 Web App:      http://localhost:5173" -ForegroundColor White
Write-Host "  ⚙️  Admin Panel:  http://localhost:5174" -ForegroundColor White
Write-Host "  📊 Status Page:  file:///$(Get-Location)/status.html" -ForegroundColor White
Write-Host ""
