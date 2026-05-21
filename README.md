# Collaborative Engineering Drawing Annotation Tool 📐✏️

A high-performance, serverless, and privacy-first web application designed for teams to annotate technical blueprints and engineering drawings. 

Designed for computer vision engineers and dataset managers, this tool runs entirely in the browser and connects directly to local directories using the modern **W3C File System Access API**—combining serverless convenience with the speed of local desktop software.

---

## 🚀 Key Features

* **Zero-Server Backend**: 100% client-side logic. Your high-resolution drawings and dataset annotations never touch external servers or databases, offering complete privacy and zero hosting costs.
* **Seamless Local Integration**: Instantly reads and writes standard **YOLO format `.txt`** annotations directly to and from your local machine.
* **HTML5 Canvas Viewport Engine**: Highly fluid drawing environment featuring smooth zoom-to-cursor, pan transformations, and instant bounding box placement.
* **PDF-to-Image converter**: Renders multiple blueprint sheets sequentially from a single PDF document at 200 DPI, stacking pages automatically in the sidebar list.
* **High-Res Drawing Exporter**: Export single drawings with annotations permanently "burned" into the image at full megapixel resolution.
* **Custom Dataset Packager**: Export raw images, YOLO labels, and annotated drawings into a structured format ready for immediate machine learning training.
* **Frictionless Collaboration**: Invite teammates via a shareable browser link. They can instantly connect their synced copy of the directory (via OneDrive, Dropbox, or LAN) and annotate different drawings simultaneously.
* **Modern dark UI**: Professional charcoal-themed interface designed to reduce eye strain during long annotation sessions.

---

## 🛠️ Tech Stack

* **Frontend**: Next.js (React), HTML5 Canvas
* **Styling**: Vanilla CSS (Premium Dark Theme tokens)
* **Libraries**: PDF.js (Client-side DPI rendering)

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: Node 18+ installed on your system.
* **Browser**: A modern browser supporting the File System Access API (Google Chrome, Microsoft Edge, or Opera).

### Installation & Local Run

1. Clone this repository:
   ```bash
   git clone https://github.com/Nitheka07/annotation-tool.git
   cd annotation-tool
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge to begin annotating!

---

## 🎨 Annotation Classes & Keyboard Shortcuts

Pressing keys `1`–`0`, `T`, or `N` swaps active classes dynamically:

* **`1`**: `linear_dim` (Cyan)
* **`2`**: `diameter_dim` (Green)
* **`3`**: `radius_dim` (Lime)
* **`4`**: `angle_dim` (Yellow)
* **`5`**: `limit_dim` (Orange)
* **`6`**: `tolerance_dim` (Pink)
* **`7`**: `gdt_frame` (Red)
* **`8`**: `reference_dim` (Blue)
* **`9`**: `thread_callout` (Purple)
* **`0`**: `surface_finish` (Teal)
* **`T`**: `title_block` (Amber)
* **`N`**: `notes` (Deep Orange)

### Shortcuts:
* **`Backspace`**: Undo / Delete the last annotation.
* **`Right Arrow`**: Move to the next drawing.
* **`Left Arrow`**: Move to the previous drawing.
* **`D` / `A`**: Toggle Bounding Box Drawing Mode.
* **`H`**: Toggle Hand/Pan Mode.
* **`Spacebar` (Hold)**: Temporary Pan Mode (swap to grab to easily slide the blueprint with left-click drag).
* **💻 Trackpad Pan Mode**: Two-finger swipe to pan vertically/horizontally, pinch-to-zoom (or `Ctrl` + scroll) to zoom smoothly.
* **🖱️ Mouse Zoom Mode**: Scroll wheel directly zooms in/out, right-click or middle-click and drag to pan.
* **Select/Toggle Modes**: Choose between **💻 Trackpad Pan** and **🖱️ Mouse Zoom** on-the-fly using the floating canvas toolbar!

---

## 👥 How Team Collaboration Works

Because the tool is entirely serverless, teammates collaborate by syncing their project folders locally (e.g. using OneDrive, Dropbox, Google Drive, or shared network folders):

1. **Invite Teammates**: Click the **"👥 Copy Teammate Invite Link"** button inside the tool.
2. **Onboard**: Send the copied link to your teammates. When they open it, they will be greeted by a customized onboarding screen.
3. **Connect & Annotate**: They choose their own local synced copy of the folder, and start working immediately.
