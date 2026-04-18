#!/bin/bash

# 🚀 CRM Platform Deployment Script
# This script prepares and pushes the code to GitHub for deployment

echo "🚀 CRM Platform Deployment Script"
echo "=================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    echo "✅ Git initialized"
fi

# Add all files
echo "📁 Adding files to Git..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "⚠️  No changes to commit"
else
    # Commit changes
    echo "💾 Committing changes..."
    git commit -m "Deploy: CRM Platform with fixed analytics and WhatsApp functionality

Features:
✅ Analytics dashboard with real data
✅ WhatsApp test functionality with detailed error handling
✅ Enhanced error messages and user guidance
✅ Production-ready configuration files
✅ Vercel and Render deployment configs

Ready for production deployment!"

    echo "✅ Changes committed"
fi

# Check if remote exists
if git remote get-url origin >/dev/null 2>&1; then
    echo "🌐 Pushing to GitHub..."
    git push origin main
    echo "✅ Code pushed to GitHub"
else
    echo "⚠️  No remote repository configured"
    echo "Please add your GitHub repository:"
    echo "git remote add origin https://github.com/YOUR_USERNAME/crm-platform.git"
    echo "git push -u origin main"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. 📱 Deploy Frontend to Vercel:"
echo "   - Connect GitHub repo to Vercel"
echo "   - Set root directory: apps/web"
echo "   - Add environment variable: VITE_API_URL"
echo ""
echo "2. 🖥️  Deploy Backend to Render:"
echo "   - Connect GitHub repo to Render"
echo "   - Use render.yaml configuration"
echo "   - Add all required environment variables"
echo ""
echo "3. 🔧 Configure Environment Variables:"
echo "   - Copy from .env.production template"
echo "   - Update with your actual credentials"
echo ""
echo "✅ Deployment preparation complete!"
