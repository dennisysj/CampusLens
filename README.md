# 🛰️ CampusLens AR

**CampusLens** is a full-stack **WebXR platform** that lets users place and view **persistent augmented-reality (AR) objects** anchored in real-world campus locations.  
When one user places a digital banner, image, or 3D model, **others will see it in the exact same spot** — creating a shared AR layer that enhances campus engagement.

---

## ✨ Features

- 🌍 **Persistent AR Anchors** – Objects stay in the same real-world spot for all users  
- 🏫 **Community Integration** – Designed for clubs, events, and student organizations  
- 📍 **Geo-anchored Data** – Powered by **PostGIS** for accurate spatial mapping  
- 💻 **Web-based AR** – Runs entirely in the browser using **WebXR** and **A-Frame**  
- 🔄 **Real-time Sync** – Node.js backend + database ensure shared, consistent object states  
- 📱 **Cross-platform** – Works on most AR-capable mobile devices and browsers  

---

## 🧱 Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Frontend** | React.js, TypeScript, A-Frame, AR.js |
| **Backend** | Node.js, Express |
| **Database** | PostgreSQL + PostGIS |
| **Hosting** | Vercel

---

## 🚀 How It Works

1. Users open the **CampusLens AR web app** in their mobile browser.  
2. They can **place digital objects** (3D models, text, or images) in their surroundings.  
3. The app records **geolocation + orientation data** via PostGIS.  
4. When another user visits the same spot, the object **reappears automatically**.  
5. Clubs can use these anchors for **announcements, event directions, or creative displays**.

---

## 🧭 Example Use Cases

- 🎉 Student clubs placing AR posters around campus  
- 🧩 Interactive scavenger hunts and event promotions  
- 🏗️ Art installations visible through AR at specific landmarks  
- 📡 Information kiosks or “digital noticeboards” accessible by location
- Environmentally friendly!

---

## 🧩 Project Goals

CampusLens aims to:
- Foster **community engagement** through AR-driven storytelling  
- Build a **persistent digital layer** for physical spaces  
- Make **AR accessible to anyone** with a smartphone browser  

---

## 🛠️ Setup (Developer)

```bash
# Clone the repo
git clone https://github.com/<your-username>/campuslens.git
cd campuslens

# Install dependencies
npm install

# Start development server
npm run dev
