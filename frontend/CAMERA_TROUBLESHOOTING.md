# Camera Troubleshooting Guide

## Fixed Issues

✅ **Added proper camera permission handling**  
✅ **Enabled AR.js debug mode for better diagnostics**  
✅ **Added explicit camera permission button**  
✅ **Added HTTPS requirement check**  
✅ **Added AR.js event listeners for video loading**  
✅ **Added test AR marker for debugging**  

## Common Camera Issues & Solutions

### 1. **White/Black Screen**
**Causes:**
- Camera permission not granted
- HTTPS required (camera access blocked on HTTP)
- AR.js initialization failure

**Solutions:**
- Click the "Enable Camera" button
- Ensure you're using HTTPS or localhost
- Check browser console for errors

### 2. **Camera Permission Denied**
**Solutions:**
- Click "Enable Camera" button
- Check browser settings for camera permissions
- Refresh page after granting permissions

### 3. **HTTPS Required**
**Error:** "Camera access requires HTTPS"
**Solution:** Deploy to Vercel (provides HTTPS automatically) or use localhost

### 4. **AR.js Not Loading**
**Debug Steps:**
- Open browser console (F12)
- Look for AR.js error messages
- Check if `arjs-video-loaded` event fires

## Testing Steps

1. **Local Testing:**
   ```bash
   cd frontend
   node server.js
   # Open http://localhost:3000
   ```

2. **Check Console:**
   - Press F12 to open developer tools
   - Look for camera-related errors
   - Check if "AR.js video loaded successfully" appears

3. **Test AR Marker:**
   - Print the Hiro marker: https://jeromeetienne.github.io/AR.js/data/images/HIRO.jpg
   - Point camera at the marker
   - Should see a yellow cube appear

## Browser Compatibility

✅ **Chrome/Edge:** Full support  
✅ **Firefox:** Full support  
✅ **Safari:** Full support (iOS 11+)  
❌ **Older browsers:** May not support camera API  

## Mobile Testing

- **iOS:** Requires iOS 11+ and Safari
- **Android:** Works on Chrome and Firefox
- **Permissions:** Must grant camera access when prompted

## Debug Features Added

- **Debug UI:** Enabled in AR.js for visual debugging
- **Console Logging:** Detailed camera status messages
- **Permission Button:** Manual camera access trigger
- **Error Messages:** Clear user feedback for issues
- **Test Marker:** Hiro marker for AR testing
