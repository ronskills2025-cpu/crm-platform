# 🚀 CRM Platform Deployment Guide

## GitHub Repository Setup

### 1. Create Private Repository
```bash
# Using GitHub CLI (if installed)
gh repo create crm-platform --private --description "Modular CRM Platform with WhatsApp, SMS, Email & Analytics"

# Or create manually at: https://github.com/new
# Repository name: crm-platform
# Visibility: Private
# Description: Modular CRM Platform with WhatsApp, SMS, Email & Analytics
```

### 2. Initialize and Push Code
```bash
cd "C:\Users\user\Documents\Logan's Area\Bulk Messasing\crm"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Complete CRM platform with analytics and WhatsApp fixes"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/crm-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Vercel Deployment (Frontend)

### 1. Vercel Configuration
- Connect your GitHub repository to Vercel
- Framework Preset: **Vite**
- Root Directory: **apps/web**
- Build Command: `npm run build`
- Output Directory: `dist`

### 2. Environment Variables for Vercel
```env
VITE_API_URL=https://your-render-backend.onrender.com/api
NODE_ENV=production
```

## Render Deployment (Backend)

### 1. Render Configuration
- Service Type: **Web Service**
- Repository: Connect your GitHub repo
- Root Directory: **apps/api**
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

### 2. Environment Variables for Render
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=your_supabase_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
JWT_SECRET=your_jwt_secret_32_chars_minimum
FRONTEND_URL=https://your-vercel-app.vercel.app
```

## Quick Deploy Commands

### Push to GitHub
```bash
git add .
git commit -m "Deploy: Ready for production with fixed WhatsApp functionality"
git push origin main
```

### Verify Deployment
1. **Frontend**: Check Vercel dashboard for build status
2. **Backend**: Check Render dashboard for deployment status
3. **Database**: Ensure Supabase is accessible from Render
