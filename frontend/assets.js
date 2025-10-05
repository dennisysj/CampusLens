const polyAssets = [
    { name: "Dino", url: "assets/cubone.glb", thumbnail: "assets/cubone.png" },
    { name: "Plant", url: "assets/Houseplant.glb", thumbnail: "assets/plant.png" },
    { name: "Car", url: "assets/car.glb", thumbnail: "assets/car.png" }
  ];
  
  window.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("asset-thumbnails");
    if (!container) return;
  
    polyAssets.forEach((asset) => {
      const img = document.createElement("img");
      img.src = asset.thumbnail || "https://via.placeholder.com/100"; // fallback
      img.className = "ui-button";
      img.title = asset.name;
      img.style.width = "100px";
      img.style.height = "100px";
      img.style.objectFit = "cover";
      img.onclick = () => addAssetToScene(asset.url);
      container.appendChild(img);
    });
  });
  
  function addAssetToScene(url) {
    const sceneEl = document.querySelector("a-scene");
    const entity = document.createElement("a-entity");
  
    entity.setAttribute("gltf-model", url);
    entity.setAttribute("position", "0 0 -2");
    entity.setAttribute("scale", "0.5 0.5 0.5");
  
    sceneEl.appendChild(entity);
    console.log(`✅ Added model: ${url}`);
  }
  