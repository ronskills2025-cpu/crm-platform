# 🚀 Push CRM Platform to GitHub
# PowerShell script for Windows

Write-Host "🚀 CRM Platform - GitHub Push Script" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Get GitHub username
$username = Read-Host "Enter your GitHub username"

# Get repository name (default: crm-platform)
$repoName = Read-Host "Enter repository name (default: crm-platform)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "crm-platform"
}

# Construct repository URL
$repoUrl = "https://github.com/$username/$repoName.git"

Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "Username: $username" -ForegroundColor White
Write-Host "Repository: $repoName" -ForegroundColor White
Write-Host "URL: $repoUrl" -ForegroundColor White
Write-Host ""

# Confirm before proceeding
$confirm = Read-Host "Continue with push? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ Cancelled by user" -ForegroundColor Red
    exit
}

try {
    # Check if remote already exists
    $remoteExists = git remote get-url origin 2>$null
    
    if ($remoteExists) {
        Write-Host "🔄 Remote 'origin' already exists. Updating..." -ForegroundColor Yellow
        git remote set-url origin $repoUrl
    } else {
        Write-Host "➕ Adding remote 'origin'..." -ForegroundColor Cyan
        git remote add origin $repoUrl
    }
    
    # Push to GitHub
    Write-Host "📤 Pushing to GitHub..." -ForegroundColor Cyan
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ SUCCESS! Code pushed to GitHub" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Repository URL: https://github.com/$username/$repoName" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
        Write-Host "1. Deploy Frontend to Vercel: https://vercel.com/new" -ForegroundColor White
        Write-Host "2. Deploy Backend to Render: https://render.com/dashboard" -ForegroundColor White
        Write-Host "3. Follow the DEPLOYMENT_GUIDE.md for detailed instructions" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ Push failed. Please check:" -ForegroundColor Red
        Write-Host "- Repository exists and is accessible" -ForegroundColor White
        Write-Host "- You have push permissions" -ForegroundColor White
        Write-Host "- Your access token has correct permissions" -ForegroundColor White
    }
    
}
catch {
    Write-Host ""
    Write-Host "❌ Error occurred: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
