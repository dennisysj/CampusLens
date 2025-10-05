# Vercel Deployment Guide

This frontend is now ready for deployment to Vercel.

## Quick Deploy

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy from the frontend directory**:
   ```bash
   cd frontend
   vercel
   ```

3. **Follow the prompts**:
   - Link to existing project or create new one
   - Choose your Vercel account
   - Confirm the project settings

## Manual Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your Git repository
4. Set the **Root Directory** to `frontend`
5. Vercel will automatically detect the Node.js configuration
6. Click "Deploy"

## Configuration Files Added

- `package.json` - Node.js dependencies and scripts
- `vercel.json` - Vercel deployment configuration
- `.vercelignore` - Files to exclude from deployment
- Updated `server.js` - Vercel-compatible server setup

## Features

- ✅ AR.js and A-Frame integration
- ✅ GPS-based AR object placement
- ✅ Tap-to-place functionality
- ✅ Static file serving for assets
- ✅ HTTPS support (required for camera access)
- ✅ Mobile-optimized UI

## Important Notes

- **HTTPS Required**: AR.js requires HTTPS for camera access. Vercel provides this automatically.
- **Mobile Testing**: Test on actual mobile devices for best AR experience
- **GPS Permissions**: Users will need to grant location permissions for GPS-based features

## Local Development

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`
