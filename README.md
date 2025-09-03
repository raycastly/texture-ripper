# Raycastly Texture Ripper

Extract and flatten textures from perspective images.

Raycastly Texture Ripper is a tool that lets you recover distortion-free textures from angled or perspective photos — making it easier for artists and game developers to turn real-world images into usable assets.

![Match Texture Extraction Example](img/matches-demo.jpg)

---

## ✨ Features
- 📐 **Perspective Correction** — automatically flatten angled regions into usable textures
- 🖼 **Batch Extraction** — extract textures from multiple images in one go
- 🎨 **Atlas Packing** — arrange, rotate, and scale textures into a single texture atlas
- ⚙️ **Output Control** — set texture resolution and transparency for exports
- 🔄 **90° Rotation Snapping** — quickly snap textures to standard angles
- 📏 **Guidelines & Position Snapping** — snap to edges, guides, and other textures for precise placement
- 🔧 **Multi-Select Transformations** — scale, rotate, and translate multiple textures at once
- 📐 **Uniform & Non-Uniform Scaling** — scale textures proportionally or freely along X/Y axes

---

## 🚀 How to Use
- Go to https://raycastly.github.io/texture-ripper
- Upload 1 or more images
- Lock the images so they don't accidentaly move
- Add rectangles in two ways:
	- Either press the "Add Rectangle" button, then position the vertices
	- Enter the drawing mode (W.I.P.) and then draw the vertices
- At any point you can press "Extract All" to extract the textures
- On the right panel you can set up the output resolution of your texture atlas
- Then you can position, rotate, scale the extracted textures in your atlas
- At any point you can alter the polygons in the left panel and simply update your textures by pressing "Extract All" again
- Once you are satisfied, decide if you want a transparent background or not, then click on Export and you are done!