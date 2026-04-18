# 🚀 Complete Deployment Guide - CRM Platform

## 📋 Prerequisites
- GitHub account with classic access token
- Vercel account (free tier available)
- Render account (free tier available)
- Supabase project (already configured)

---

## 🔧 STEP 1: Create GitHub Repository

### Option A: Using GitHub CLI (Recommended)
```bash
# Install GitHub CLI if not installed: https://cli.github.com/
gh auth login --with-token < your_access_token.txt
gh repo create crm-platform --private --description "Modular CRM Platform with WhatsApp, SMS, Email & Analytics"
```

### Option B: Manual Creation
1. Go to https://github.com/new
2. Repository name: `crm-platform`
3. Description: `Modular CRM Platform with WhatsApp, SMS, Email & Analytics`
4. Visibility: **Private**
5. Click "Create repository"

---

## 📤 STEP 2: Push Code to GitHub

```bash
cd "C:\Users\user\Documents\Logan's Area\Bulk Messasing\crm"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/crm-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🌐 STEP 3: Deploy Frontend to Vercel

### 3.1 Connect Repository
1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import your `crm-platform` repository
4. Configure deployment:

### 3.2 Vercel Configuration
```
Framework Preset: Vite
Root Directory: apps/web
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 3.3 Environment Variables
Add these in Vercel dashboard:
```
VITE_API_URL=https://your-render-backend.onrender.com/api
NODE_ENV=production
```

### 3.4 Deploy
- Click "Deploy"
- Wait for build to complete
- Note your Vercel URL: `https://your-app-name.vercel.app`

---

## 🖥️ STEP 4: Deploy Backend to Render

### 4.1 Connect Repository
1. Go to https://render.com/dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Select `crm-platform` repository

### 4.2 Render Configuration
```
Name: crm-platform-api
Environment: Node
Region: Oregon (US West) or closest to you
Branch: main
Root Directory: (leave empty)
Build Command: npm install && npm run build
Start Command: npm start
```

### 4.3 Environment Variables
Add these in Render dashboard:

#### Required Variables
```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=your_supabase_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
JWT_SECRET=your_jwt_secret_32_chars_minimum
FRONTEND_URL=https://your-vercel-app.vercel.app
```

#### Optional (for full functionality)
```bash
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_API_VERSION=v21.0
WHATSAPP_VERIFY_TOKEN=your_verify_token

# SMS Providers
FAST2SMS_API_KEY=your_fast2sms_key
MSG91_AUTH_KEY=your_msg91_key

# Email Providers
RESEND_API_KEY=your_resend_key
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@yourdomain.com
```

### 4.4 Deploy
- Click "Create Web Service"
- Wait for deployment to complete
- Note your Render URL: `https://your-service-name.onrender.com`

---

## 🔄 STEP 5: Update Frontend with Backend URL

### 5.1 Update Vercel Environment
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Update `VITE_API_URL` with your actual Render URL:
   ```
   VITE_API_URL=https://your-actual-render-url.onrender.com/api
   ```
3. Redeploy frontend

### 5.2 Update Backend with Frontend URL
1. Go to Render dashboard → Your service → Environment
2. Update `FRONTEND_URL` with your actual Vercel URL:
   ```
   FRONTEND_URL=https://your-actual-vercel-url.vercel.app
   ```
3. Redeploy backend

---

## ✅ STEP 6: Verify Deployment

### 6.1 Test Frontend
1. Visit your Vercel URL
2. Check that the dashboard loads
3. Verify no console errors
4. Test login with: `admin@msgcrm.com` / `Admin@1234`

### 6.2 Test Backend
1. Visit `https://your-render-url.onrender.com/health`
2. Should return: `{"status":"ok","timestamp":"..."}`

### 6.3 Test WhatsApp Integration
1. Login to dashboard
2. Click "WA Test" button
3. Should show detailed error message with setup instructions
4. Configure WhatsApp credentials to enable full functionality

---

## 🔧 STEP 7: Configure WhatsApp (Optional)

### 7.1 Get WhatsApp Business API Credentials
1. Go to https://business.facebook.com/
2. Create WhatsApp Business Account
3. Get Phone Number ID and Access Token
4. Set up webhook URL: `https://your-render-url.onrender.com/api/wa-chat/webhook`

### 7.2 Add to Render Environment
```bash
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_WEBHOOK_URL=https://your-render-url.onrender.com/api/wa-chat/webhook
```

---

## 🎯 Quick Commands Summary

```bash
# 1. Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/crm-platform.git
git push -u origin main

# 2. Deploy Frontend (Vercel)
# - Import repository
# - Set root: apps/web
# - Add VITE_API_URL environment variable

# 3. Deploy Backend (Render)  
# - Import repository
# - Add all environment variables
# - Deploy

# 4. Update URLs
# - Update VITE_API_URL in Vercel
# - Update FRONTEND_URL in Render
```

---

## 🆘 Troubleshooting

### Frontend Issues
- **Build fails**: Check that `apps/web` is set as root directory
- **API calls fail**: Verify `VITE_API_URL` points to correct Render URL
- **404 errors**: Ensure Vercel routing is configured for SPA

### Backend Issues
- **Deploy fails**: Check that all required environment variables are set
- **Database errors**: Verify Supabase connection string and credentials
- **CORS errors**: Ensure `FRONTEND_URL` matches your Vercel URL exactly

### WhatsApp Issues
- **Test button shows setup instructions**: This is expected - configure WhatsApp credentials
- **Credentials error**: Verify Phone Number ID and Access Token are correct
- **Webhook fails**: Ensure webhook URL is accessible and uses HTTPS

---

## 🎉 Success Checklist

- [ ] Code pushed to private GitHub repository
- [ ] Frontend deployed to Vercel and accessible
- [ ] Backend deployed to Render and health check passes
- [ ] Frontend can communicate with backend
- [ ] Login works with admin credentials
- [ ] Dashboard loads without errors
- [ ] WhatsApp test shows proper error handling
- [ ] All environment variables configured

**Your CRM Platform is now live and ready for production use!**

## 📞 Support

If you encounter any issues:
1. Check the deployment logs in Vercel/Render dashboards
2. Verify all environment variables are set correctly
3. Test the health endpoints
4. Check browser console for frontend errors
