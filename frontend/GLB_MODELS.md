# GLB Models Guide


## 📦 Current Implementation

All A-Frame objects are now using GLB (3D model) format instead of primitives.

## 🔧 How to Add Your Own GLB Models

### Option 1: Host Your Own Models

1. **Create or download GLB files**
   - Use Blender to export `.glb` files
   - Download from sites like Sketchfab, Poly Haven, or CGTrader

2. **Add to your project**
   - Place GLB files in `/frontend/public/models/` directory
   - Example: `cube.glb`, `sphere.glb`, etc.

3. **Update the code** (lines 144-149):
   ```javascript
   const objectTypes = {
     cube:{type:'glb', src:'/models/cube.glb', scale:'0.5 0.5 0.5', color:'orange'},
     sphere:{type:'glb', src:'/models/sphere.glb', scale:'0.3 0.3 0.3', color:'blue'},
     // ... etc
   };
   ```

### Option 2: Use CDN URLs

Replace the example URLs with real CDN-hosted GLB files:

```javascript
const objectTypes = {
  cube:{
    type:'glb', 
    src:'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models/2.0/Box/glTF-Binary/Box.glb',
    scale:'0.5 0.5 0.5',
    color:'orange'
  },
  // Add more models...
};
```

### Popular Free GLB Model Sources:

- **Poly Pizza**: https://poly.pizza
- **Sketchfab**: https://sketchfab.com (filter by downloadable)
- **glTF Sample Models**: https://github.com/KhronosGroup/glTF-Sample-Models
- **Kenney Assets**: https://kenney.nl/assets

## 📐 Scale Guidelines

- `scale:'1 1 1'` = original size
- `scale:'0.5 0.5 0.5'` = half size
- `scale:'2 2 2'` = double size
- Adjust based on your model's actual dimensions

## 🎨 Current Object Types

| Type | Scale | Color |
|------|-------|-------|
| cube | 0.5 0.5 0.5 | orange |
| sphere | 0.3 0.3 0.3 | blue |
| cylinder | 0.3 0.6 0.3 | green |
| arrow | 0.5 0.5 0.5 | red |
| textBox | 0.5 0.5 0.5 | white |

## 🚀 Testing

1. Place GLB files in `/frontend/public/models/`
2. Update `objectTypes` in `index.html` (lines 144-149)
3. Restart server: `node server.js`
4. Test in browser

## ⚠️ Important Notes

- GLB files should be optimized (< 1MB each for best performance)
- Models will load asynchronously (may take a moment to appear)
- Make sure CORS is enabled if using external URLs
- Use simple models for AR to maintain good frame rates

