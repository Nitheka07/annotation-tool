import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// --- Category Design Tokens & Key Binds ---
const CLASSES = {
  '1': { name: 'linear_dim', color: '#00E5FF', id: 0 },
  '2': { name: 'diameter_dim', color: '#00E676', id: 1 },
  '3': { name: 'radius_dim', color: '#AEEA00', id: 2 },
  '4': { name: 'angle_dim', color: '#FFD600', id: 3 },
  '5': { name: 'limit_dim', color: '#FF9100', id: 4 },
  '6': { name: 'tolerance_dim', color: '#FF4081', id: 5 },
  '7': { name: 'gdt_frame', color: '#FF1744', id: 6 },
  '8': { name: 'reference_dim', color: '#2979FF', id: 7 },
  '9': { name: 'thread_callout', color: '#D500F9', id: 8 },
  '0': { name: 'surface_finish', color: '#00BFA5', id: 9 },
  't': { name: 'title_block', color: '#FFAB00', id: 10 },
  'n': { name: 'notes', color: '#FF6E40', id: 11 }
};

const CLASS_ORDER = [
  'linear_dim', 'diameter_dim', 'radius_dim', 'angle_dim',
  'limit_dim', 'tolerance_dim', 'gdt_frame', 'reference_dim',
  'thread_callout', 'surface_finish', 'title_block', 'notes'
];

const CLASSES_BY_NAME = Object.entries(CLASSES).reduce((acc, [key, val]) => {
  acc[val.name] = { color: val.color, id: val.id, key };
  return acc;
}, {});

export default function Home() {
  // --- React State ---
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(-1);
  const [annotations, setAnnotations] = useState([]);
  const [activeClassKey, setActiveClassKey] = useState('1');
  const [statusMessage, setStatusMessage] = useState('Ready. Select a project folder containing drawings to begin.');
  const [statusColor, setStatusColor] = useState('var(--txt-muted)');
  
  // Tool navigation: Draw Mode vs Pan Mode
  const [activeTool, setActiveTool] = useState('draw'); // 'draw' or 'pan'
  const activeToolRef = useRef('draw');
  const spacePressed = useRef(false);
  const [canvasCursor, setCanvasCursor] = useState('crosshair');
  
  // Navigation scrolling configuration: 'zoom' (Mouse Scroll Zoom) vs 'pan' (Trackpad Pan)
  const [scrollMode, setScrollMode] = useState('pan');
  const scrollModeRef = useRef('pan');

  useEffect(() => {
    scrollModeRef.current = scrollMode;
  }, [scrollMode]);

  const updateCursor = (panningOverride = null) => {
    const panning = panningOverride !== null ? panningOverride : viewState.current.isPanning;
    if (spacePressed.current || activeToolRef.current === 'pan') {
      setCanvasCursor(panning ? 'grabbing' : 'grab');
    } else {
      setCanvasCursor('crosshair');
    }
  };
  
  // PDF converting state overlay
  const [pdfConverting, setPdfConverting] = useState(false);
  const [pdfMessage, setPdfMessage] = useState('');

  // Onboarding & collaboration states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [invitedProjectName, setInvitedProjectName] = useState('');

  // --- YOLO label file parser helper ---
  const parseYoloData = (text, imgWidth, imgHeight) => {
    const lines = text.split('\n');
    const loaded = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length === 5) {
        const classId = parseInt(parts[0], 10);
        const xc = parseFloat(parts[1]) * imgWidth;
        const yc = parseFloat(parts[2]) * imgHeight;
        const w = parseFloat(parts[3]) * imgWidth;
        const h = parseFloat(parts[4]) * imgHeight;

        const x0 = xc - w / 2;
        const y0 = yc - h / 2;
        const x1 = xc + w / 2;
        const y1 = yc + h / 2;

        if (classId >= 0 && classId < CLASS_ORDER.length) {
          const className = CLASS_ORDER[classId];
          const color = CLASSES_BY_NAME[className].color;
          loaded.push({
            class: className,
            color,
            box: [x0, y0, x1, y1]
          });
        }
      }
    }
    return loaded;
  };

  // --- Viewport State Refs (avoids React re-renders during 60fps pan/zoom) ---
  const canvasRef = useRef(null);
  const viewState = useRef({
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    isDrawing: false,
    drawStartX: 0,
    drawStartY: 0,
    mouseX: 0,
    mouseY: 0,
    imgWidth: 0,
    imgHeight: 0
  });
  
  const currentImageRef = useRef(null);
  const activeImageFile = useRef(null);
  const activeAnnotations = useRef([]);
  const activeDirectoryHandle = useRef(null);
  const lastTxtMtime = useRef(null);

  // --- Initialize Client-Side Utilities ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load PDF.js Script tag dynamically into DOM
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        };
        document.head.appendChild(script);
      }

      // Check for invite query params
      const params = new URLSearchParams(window.location.search);
      if (params.get('invite') === 'true') {
        const proj = params.get('project') || 'Drawing Project';
        setInvitedProjectName(proj);
        setShowOnboarding(true);
      }
    }
  }, []);

  // --- Invite Link Generator ---
  const copyInviteLink = () => {
    const projName = directoryHandle ? directoryHandle.name : 'Drawing Project';
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=true&project=${encodeURIComponent(projName)}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        setStatus('🔗 Invite link successfully copied to clipboard!', 'var(--accent-green)');
        alert(`Collaboration Invite Copied!\n\nShare this link with your teammates:\n${inviteUrl}\n\nWhen they click it, they will be guided to select their synced local folder copy and can immediately begin working simultaneously on different images.`);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert(`Could not copy automatically. Here is the link to share:\n\n${inviteUrl}`);
      });
    } else {
      alert(`Here is the link to copy & share:\n\n${inviteUrl}`);
    }
  };

  // Sync state helpers to refs for access in event listeners
  activeAnnotations.current = annotations;
  activeDirectoryHandle.current = directoryHandle;
  
  const activeImageName = currentImageIndex !== -1 ? images[currentImageIndex]?.name : '';

  // --- W3C File System Access Scan Directory ---
  const selectDirectory = async () => {
    try {
      setStatus('Prompting for folder access...', 'var(--accent-amber)');
      const handle = await window.showDirectoryPicker();
      setDirectoryHandle(handle);
      setStatus('Access granted. Scanning drawings...', 'var(--accent-blue)');
      await scanDirectory(handle);
    } catch (err) {
      console.error(err);
      setStatus('⚠️ Folder access cancelled or failed.', 'var(--accent-red)');
    }
  };

  const scanDirectory = async (dirHandle, silent = false) => {
    const validExts = ['.jpg', '.jpeg', '.png'];
    const foundImages = [];

    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
          if (validExts.includes(ext) && !entry.name.startsWith('.')) {
            // Count existing YOLO annotations
            const txtName = entry.name.substring(0, entry.name.lastIndexOf('.')) + '.txt';
            let annotationCount = 0;
            try {
              const txtHandle = await dirHandle.getFileHandle(txtName);
              const file = await txtHandle.getFile();
              const text = await file.text();
              annotationCount = text.split('\n').filter(l => l.trim()).length;
            } catch (e) {
              // No txt file exists or can't read
            }
            foundImages.push({ name: entry.name, handle: entry, count: annotationCount });
          }
        }
      }

      foundImages.sort((a, b) => a.name.localeCompare(b.name));
      
      // Smart sidebar comparison to avoid component flicker
      setImages(prev => {
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(foundImages);
        if (hasChanged) {
          if (!silent) {
            setStatus(`📂 Loaded folder. Found ${foundImages.length} drawings.`, 'var(--accent-green)');
          }
          return foundImages;
        }
        return prev;
      });

      // Auto-load first image if none is active
      if (foundImages.length > 0 && currentImageIndex === -1) {
        setCurrentImageIndex(0);
      }
    } catch (err) {
      console.error('Scan error:', err);
      if (!silent) {
        setStatus(`❌ Directory scan failed: ${err.message}`, 'var(--accent-red)');
      }
    }
  };

  // --- Polling and Auto-Refresh Loop ---
  useEffect(() => {
    if (!directoryHandle) return;

    const syncInterval = setInterval(() => {
      // 1. Silent folder scan
      scanDirectory(directoryHandle, true);
      // 2. Disk-based YOLO modifications detection
      checkExternalLabelChange();
    }, 5000);

    return () => {
      clearInterval(syncInterval);
    };
  }, [directoryHandle, currentImageIndex, images]);

  // --- External YOLO Label Changes Auto-Reload ---
  const checkExternalLabelChange = async () => {
    if (!directoryHandle || currentImageIndex === -1) return;
    const imgName = images[currentImageIndex].name;
    const txtName = imgName.substring(0, imgName.lastIndexOf('.')) + '.txt';

    try {
      const txtHandle = await directoryHandle.getFileHandle(txtName);
      const file = await txtHandle.getFile();
      const mtime = file.lastModified;

      if (lastTxtMtime.current !== null && mtime > lastTxtMtime.current + 800) {
        lastTxtMtime.current = mtime;
        await loadAnnotations(imgName, true);
        drawCanvas();
        setStatus('🔄 Annotations dynamically reloaded (updated by another collaborator).', 'var(--accent-amber)');
      }
    } catch (e) {
      // File may not exist yet
    }
  };

  // --- Load Annotations (YOLO parser) ---
  const loadAnnotations = async (imgName, silent = false) => {
    const txtName = imgName.substring(0, imgName.lastIndexOf('.')) + '.txt';
    try {
      const txtHandle = await directoryHandle.getFileHandle(txtName);
      const file = await txtHandle.getFile();
      lastTxtMtime.current = file.lastModified;
      const text = await file.text();
      const loaded = parseYoloData(text, viewState.current.imgWidth, viewState.current.imgHeight);
      setAnnotations(loaded);
      if (!silent) {
        setStatus(`Loaded ${loaded.length} annotations from YOLO file.`, 'var(--accent-blue)');
      }
    } catch (e) {
      // File does not exist, set empty annotations
      setAnnotations([]);
      lastTxtMtime.current = null;
      if (!silent) {
        setStatus('No annotations found. Start drawing to create a new YOLO label.', 'var(--txt-muted)');
      }
    }
  };

  // --- Save Annotations (YOLO writer) ---
  const saveAnnotations = async () => {
    if (!directoryHandle || currentImageIndex === -1) return;

    const imgName = images[currentImageIndex].name;
    const txtName = imgName.substring(0, imgName.lastIndexOf('.')) + '.txt';

    try {
      const txtHandle = await directoryHandle.getFileHandle(txtName, { create: true });
      const writable = await txtHandle.createWritable();
      
      let content = '';
      for (const ann of activeAnnotations.current) {
        const classId = CLASSES_BY_NAME[ann.class].id;
        const [x0, y0, x1, y1] = ann.box;

        const w = x1 - x0;
        const h = y1 - y0;
        const xc = x0 + w / 2;
        const yc = y0 + h / 2;

        const nxc = xc / viewState.current.imgWidth;
        const nyc = yc / viewState.current.imgHeight;
        const nw = w / viewState.current.imgWidth;
        const nh = h / viewState.current.imgHeight;

        content += `${classId} ${nxc.toFixed(6)} ${nyc.toFixed(6)} ${nw.toFixed(6)} ${nh.toFixed(6)}\n`;
      }

      await writable.write(content);
      await writable.close();

      // Refresh modified cache
      const file = await txtHandle.getFile();
      lastTxtMtime.current = file.lastModified;

      // Update sidebar counts silently
      scanDirectory(directoryHandle, true);
      setStatus('💾 YOLO annotations saved successfully.', 'var(--accent-green)');
    } catch (err) {
      console.error(err);
      setStatus(`❌ Failed to save annotations: ${err.message}`, 'var(--accent-red)');
    }
  };

  // --- Delete Last Annotation ---
  const deleteLastAnnotation = () => {

    if (activeAnnotations.current.length > 0) {
      const copy = [...activeAnnotations.current];
      copy.pop();
      setAnnotations(copy);
      setStatus('↩️ Deleted last drawn annotation.', 'var(--accent-amber)');
      
      // Auto-save changes immediately
      setTimeout(() => {
        saveAnnotations();
        drawCanvas();
      }, 0);
    } else {
      setStatus('ℹ️ No annotations exist to delete.', 'var(--txt-muted)');
    }
  };

  // --- Clear All Annotations ---
  const clearAllAnnotations = () => {

    if (activeAnnotations.current.length > 0) {
      if (confirm('Are you sure you want to delete ALL annotations on this image?')) {
        setAnnotations([]);
        setStatus('🗑️ Cleared all annotations on current image.', 'var(--accent-amber)');
        setTimeout(() => {
          saveAnnotations();
          drawCanvas();
        }, 0);
      }
    }
  };

  // --- Load and Render Image in Viewport Engine ---
  useEffect(() => {
    if (currentImageIndex === -1 || images.length === 0) {
      // Clear canvas if no drawings
      currentImageRef.current = null;
      drawCanvas();
      return;
    }

    const imgObj = images[currentImageIndex];
    setStatus(`Loading drawing ${imgObj.name}...`, 'var(--accent-blue)');

    activeImageFile.current = imgObj.name;

    imgObj.handle.getFile().then(file => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        currentImageRef.current = img;
        viewState.current.imgWidth = img.width;
        viewState.current.imgHeight = img.height;
        
        // Reset scale and offset to fit image nicely on canvas
        fitImageToCanvas(img.width, img.height);
        
        // Load YOLO annotations
        loadAnnotations(imgObj.name).then(() => {
          drawCanvas();
        });
      };
    }).catch(err => {
      console.error(err);
      setStatus(`❌ Failed to open image: ${err.message}`, 'var(--accent-red)');
    });
  }, [currentImageIndex, images]);

  const fitImageToCanvas = (iw, ih) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cw = canvas.width;
    const ch = canvas.height;

    const scaleX = cw / iw;
    const scaleY = ch / ih;
    const fitScale = Math.min(scaleX, scaleY) * 0.95; // 5% buffer margin

    viewState.current.scale = fitScale;
    viewState.current.offsetX = (cw - iw * fitScale) / 2;
    viewState.current.offsetY = (ch - ih * fitScale) / 2;
  };

  // --- Render HTML5 Canvas Drawing Loop ---
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;

    // Clear Canvas
    ctx.clearRect(0, 0, cw, ch);

    const img = currentImageRef.current;
    if (!img) {
      // Draw select directory invitation text
      ctx.fillStyle = '#8E8E93';
      ctx.font = 'bold 14px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.fillText("📂 Click 'Select Project Directory' in the sidebar to begin inspecting drawings.", cw / 2, ch / 2);
      return;
    }

    const { scale, offsetX, offsetY } = viewState.current;

    // Apply scaling and panning translations
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw the main full-resolution drawing blueprint
    ctx.drawImage(img, 0, 0);

    // Draw bounding boxes
    activeAnnotations.current.forEach(ann => {
      const [x0, y0, x1, y1] = ann.box;
      
      // Scale lines to look sharp at any zoom level
      ctx.lineWidth = Math.max(1, 2 / scale);
      ctx.strokeStyle = ann.color;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

      // Draw label badges
      ctx.fillStyle = ann.color;
      ctx.font = `bold ${Math.max(10, 11 / scale)}px "Segoe UI"`;
      ctx.textBaseline = 'bottom';
      
      const badgeText = ` ${ann.class} `;
      const textWidth = ctx.measureText(badgeText).width;
      const textHeight = Math.max(12, 14 / scale);
      
      // Draw background flag box
      ctx.fillRect(x0, y0 - textHeight, textWidth, textHeight);
      
      // Label text
      ctx.fillStyle = ann.color === '#FFD600' ? '#000000' : '#FFFFFF';
      ctx.fillText(badgeText, x0, y0);
    });

    // Draw live drag rectangle preview if drawing
    if (viewState.current.isDrawing) {
      const { drawStartX, drawStartY, mouseX, mouseY } = viewState.current;
      
      // Calculate drawing start and end coords in image space
      const x0 = (drawStartX - offsetX) / scale;
      const y0 = (drawStartY - offsetY) / scale;
      const x1 = (mouseX - offsetX) / scale;
      const y1 = (mouseY - offsetY) / scale;

      ctx.lineWidth = Math.max(1, 1.5 / scale);
      ctx.strokeStyle = CLASSES[activeClassKey].color;
      ctx.setLineDash([Math.max(2, 4 / scale), Math.max(2, 4 / scale)]);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
    }

    ctx.restore();
  };

  // --- Canvas Interaction Event Listeners ---
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentImageRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (e.button === 2 || e.button === 1 || activeToolRef.current === 'pan' || spacePressed.current) {
      // Panning active (Right-click, middle-click, spacebar drag, or hand tool)
      e.preventDefault();
      viewState.current.isPanning = true;
      viewState.current.panStartX = mx - viewState.current.offsetX;
      viewState.current.panStartY = my - viewState.current.offsetY;
      updateCursor(true);
    } else if (e.button === 0) {
      // Left-Click Drawing
      viewState.current.isDrawing = true;
      viewState.current.drawStartX = mx;
      viewState.current.drawStartY = my;
      viewState.current.mouseX = mx;
      viewState.current.mouseY = my;
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentImageRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Track mouse coordinates
    viewState.current.mouseX = mx;
    viewState.current.mouseY = my;

    if (viewState.current.isPanning) {
      viewState.current.offsetX = mx - viewState.current.panStartX;
      viewState.current.offsetY = my - viewState.current.panStartY;
      drawCanvas();
    } else if (viewState.current.isDrawing) {
      drawCanvas();
    }

    // Update bottom status coordinate trackers
    const { scale, offsetX, offsetY, imgWidth, imgHeight } = viewState.current;
    const imgX = Math.max(0, Math.min(Math.round((mx - offsetX) / scale), imgWidth));
    const imgY = Math.max(0, Math.min(Math.round((my - offsetY) / scale), imgHeight));
    
    // Live update coordinates
    const zoomPct = Math.round(scale * 100);
    document.getElementById('status-coord').innerText = `Zoom: ${zoomPct}% | Image Coordinates: ${imgX}, ${imgY}`;
  };

  const handleMouseUp = (e) => {
    if (e.button === 2 || e.button === 1 || activeToolRef.current === 'pan' || spacePressed.current) {
      viewState.current.isPanning = false;
      updateCursor(false);
    } else if (e.button === 0 && viewState.current.isDrawing) {
      viewState.current.isDrawing = false;
      
      const { scale, offsetX, offsetY, drawStartX, drawStartY, mouseX, mouseY, imgWidth, imgHeight } = viewState.current;
      
      // Convert start and end points to original image coordinate space
      const x0_img = (drawStartX - offsetX) / scale;
      const y0_img = (drawStartY - offsetY) / scale;
      const x1_img = (mouseX - offsetX) / scale;
      const y1_img = (mouseY - offsetY) / scale;

      const rx0 = Math.max(0, Math.min(x0_img, imgWidth));
      const ry0 = Math.max(0, Math.min(y0_img, imgHeight));
      const rx1 = Math.max(0, Math.min(x1_img, imgWidth));
      const ry1 = Math.max(0, Math.min(y1_img, imgHeight));

      const bx0 = Math.min(rx0, rx1);
      const by0 = Math.min(ry0, ry1);
      const bx1 = Math.max(rx0, rx1);
      const by1 = Math.max(ry0, ry1);

      // Validate rect size to avoid registration of accidental clicks
      if (bx1 - bx0 > 4 && by1 - by0 > 4) {
        const activeClass = CLASSES[activeClassKey];
        const newAnn = {
          class: activeClass.name,
          color: activeClass.color,
          box: [bx0, by0, bx1, by1]
        };

        const copy = [...activeAnnotations.current, newAnn];
        setAnnotations(copy);
        
        // Auto-save changes immediately
        setTimeout(() => {
          saveAnnotations();
          drawCanvas();
        }, 0);
      }
    }
  };

  // Viewport Zooming (follows browser mouse cursor with ultra-smooth delta scaling)
  const handleWheel = (e) => {
    e.preventDefault();
    if (!currentImageRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const { scale, offsetX, offsetY } = viewState.current;

    // Check configuration mode via ref to guarantee fresh values
    if (scrollModeRef.current === 'zoom') {
      // --- MOUSE MODE: Scroll to Zoom ---
      const imgX = (mx - offsetX) / scale;
      const imgY = (my - offsetY) / scale;

      const delta = e.deltaY;
      // Ultra-smooth dynamic zoom factor in log space
      const zoomFactor = Math.max(0.7, Math.min(1.4, Math.exp(-delta * 0.002)));
      const newScale = Math.max(0.05, Math.min(50.0, scale * zoomFactor));

      viewState.current.scale = newScale;
      viewState.current.offsetX = mx - imgX * newScale;
      viewState.current.offsetY = my - imgY * newScale;
    } else {
      // --- TRACKPAD MODE: Scroll/Swipe to Pan, Pinch/Ctrl to Zoom ---
      if (e.ctrlKey) {
        // Pinch-to-zoom or Ctrl + Scroll
        const imgX = (mx - offsetX) / scale;
        const imgY = (my - offsetY) / scale;

        const delta = e.deltaY;
        // Premium smooth zoom factor optimized specifically for high-speed trackpad gestures
        const zoomFactor = Math.max(0.7, Math.min(1.4, Math.exp(-delta * 0.008)));
        const newScale = Math.max(0.05, Math.min(50.0, scale * zoomFactor));

        viewState.current.scale = newScale;
        viewState.current.offsetX = mx - imgX * newScale;
        viewState.current.offsetY = my - imgY * newScale;
      } else {
        // Horizontal and vertical two-finger trackpad panning or mouse scroll vertical panning
        viewState.current.offsetX -= e.deltaX;
        viewState.current.offsetY -= e.deltaY;
      }
    }

    drawCanvas();
  };

  // Adjust canvas bounds on window configure resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;

      if (currentImageRef.current) {
        fitImageToCanvas(currentImageRef.current.width, currentImageRef.current.height);
      }
      drawCanvas();
    };

    window.addEventListener('resize', handleResize);
    
    // Trigger initial configure
    setTimeout(handleResize, 100);

    return () => window.removeEventListener('resize', handleResize);
  }, [currentImageIndex]);

  // --- Keyboard Bindings (Case-Insensitive) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // Intercept Spacebar for temporary panning
      if (e.code === 'Space') {
        e.preventDefault();
        if (!spacePressed.current) {
          spacePressed.current = true;
          updateCursor();
        }
        return;
      }

      const key = e.key.toLowerCase();
      
      // Switch active drawing/panning tools
      if (key === 'h') {
        setActiveTool('pan');
        activeToolRef.current = 'pan';
        updateCursor();
        setStatus('✋ Tool Swapped to: Pan/Move Mode (H)', 'var(--txt-primary)');
      } else if (key === 'd' || key === 'a') {
        setActiveTool('draw');
        activeToolRef.current = 'draw';
        updateCursor();
        setStatus('✏️ Tool Swapped to: Bounding Box Drawing Mode (D)', 'var(--txt-primary)');
      } else if (CLASSES[key]) {
        // Automatically switch back to draw mode when selecting annotation classes
        setActiveTool('draw');
        activeToolRef.current = 'draw';
        setActiveClassKey(key);
        updateCursor();
        setStatus(`🎯 Selected Annotation Class: '${CLASSES[key].name}'`, 'var(--txt-primary)');
      } else if (e.key === 'Backspace') {
        deleteLastAnnotation();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'ArrowLeft') {
        prevImage();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        spacePressed.current = false;
        updateCursor();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentImageIndex, images]);

  // --- Navigations ---
  const nextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex(prev => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
  };

  // --- Status Banner Helper ---
  const setStatus = (msg, color = 'var(--txt-muted)') => {
    setStatusMessage(msg);
    setStatusColor(color);
  };

  // --- Helper to verify/request read-write permissions ---
  const verifyPermission = async (fileHandle, readWrite = true) => {
    const options = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    try {
      if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
      }
      if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
      }
    } catch (e) {
      console.error('Permission check failed:', e);
    }
    return false;
  };

  // --- Client-Side PDF.js Blueprint Page Extractor ---
  const convertPdfToJpg = async () => {
    if (!directoryHandle) {
      alert('Please select a project folder directory first.');
      return;
    }

    // Verify/request write permission immediately during this click user-activation
    const hasPermission = await verifyPermission(directoryHandle, true);
    if (!hasPermission) {
      alert('Write permission is required on the project folder to extract PDF pages.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (!window.pdfjsLib) {
        alert('PDF library is loading. Please wait a moment and try again.');
        return;
      }

      setPdfConverting(true);
      setPdfMessage('Loading PDF Blueprint document...');
      
      try {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
          try {
            const arrayBuffer = this.result;
            const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdfDoc.numPages;

            const pdfBaseName = file.name.substring(0, file.name.lastIndexOf('.'));

            for (let i = 1; i <= totalPages; i++) {
              setPdfMessage(`Rendering page ${i} of ${totalPages} at 200 DPI...`);
              
              const page = await pdfDoc.getPage(i);
              
              // 200 DPI matrix scale ratio (200 / 72 standard points)
              const scale = 200.0 / 72.0;
              const viewport = page.getViewport({ scale });
              
              // Render PDF onto an offscreen canvas
              const offscreenCanvas = document.createElement('canvas');
              offscreenCanvas.width = viewport.width;
              offscreenCanvas.height = viewport.height;
              const ctx = offscreenCanvas.getContext('2d');
              
              await page.render({
                canvasContext: ctx,
                viewport: viewport
              }).promise;

              // Convert canvas drawing to standard JPG Blob
              const jpegBlob = await new Promise(resolve => {
                offscreenCanvas.toBlob(resolve, 'image/jpeg', 0.95);
              });

              // Save directly into the selected project directory
              const pageNumStr = i.toString().padStart(3, '0');
              const outImgName = `${pdfBaseName}_page_${pageNumStr}.jpg`;
              
              const pageHandle = await directoryHandle.getFileHandle(outImgName, { create: true });
              const writable = await pageHandle.createWritable();
              await writable.write(jpegBlob);
              await writable.close();
            }

            setPdfConverting(false);
            alert(`Successfully extracted ${totalPages} pages directly into your project directory.\n\nImages are named '${pdfBaseName}_page_XXX.jpg' and stacked sequentially.`);
            
            setStatus(`Extracted ${totalPages} PDF blueprint pages.`, 'var(--accent-green)');
            await scanDirectory(directoryHandle);

          } catch (err) {
            console.error(err);
            setPdfConverting(false);
            alert(`PDF Processing failed:\n${err.message}`);
          }
        };
        fileReader.readAsArrayBuffer(file);
      } catch (err) {
        console.error(err);
        setPdfConverting(false);
        alert(`Failed to load PDF file:\n${err.message}`);
      }
    };

    input.click();
  };

  // --- High-Resolution Annotation "Burning" Export Tool ---
  const exportAnnotatedImage = async () => {
    if (!currentImageRef.current || currentImageIndex === -1) {
      alert('No drawing loaded to export.');
      return;
    }

    // Verify/request write permission immediately during this click user-activation
    const hasPermission = await verifyPermission(directoryHandle, true);
    if (!hasPermission) {
      alert('Write permission is required on the project folder to save exports.');
      return;
    }

    setStatus('📤 Generating annotated high-resolution blueprint...', 'var(--accent-amber)');

    try {
      const img = currentImageRef.current;
      const w_img = img.width;
      const h_img = img.height;

      // Spawn offscreen high-res rendering canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = w_img;
      offscreen.height = h_img;
      const ctx = offscreen.getContext('2d');

      // Draw original blueprint
      ctx.drawImage(img, 0, 0);

      // Scale fonts & lines proportional to megapixel dimensions
      const lineWidth = Math.max(2, Math.round(w_img * 0.003));
      const fontSize = Math.max(12, Math.round(w_img * 0.008));
      
      ctx.lineWidth = lineWidth;

      for (const ann of activeAnnotations.current) {
        const [x0, y0, x1, y1] = ann.box;

        // Bounding Box
        ctx.strokeStyle = ann.color;
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

        // Badge Background Flag & Label
        ctx.fillStyle = ann.color;
        ctx.font = `bold ${fontSize}px "Segoe UI"`;
        ctx.textBaseline = 'bottom';
        
        const labelText = ` ${ann.class} `;
        const textWidth = ctx.measureText(labelText).width;
        const textHeight = fontSize + 6;

        ctx.fillRect(x0, y0 - textHeight, textWidth, textHeight);

        // Text color contrast
        ctx.fillStyle = ann.color === '#FFD600' ? '#000000' : '#FFFFFF';
        ctx.fillText(labelText, x0, y0 - 3);
      }

      // Convert drawing to a high-quality JPG blob
      const exportBlob = await new Promise(resolve => {
        offscreen.toBlob(resolve, 'image/jpeg', 0.95);
      });

      // Write directly to subfolder
      const exportsFolderHandle = await directoryHandle.getDirectoryHandle('annotated_exports', { create: true });
      const imgName = images[currentImageIndex].name;
      
      const fileHandle = await exportsFolderHandle.getFileHandle(imgName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(exportBlob);
      await writable.close();

      setStatus('📤 Exported annotated drawing to annotated_exports folder', 'var(--accent-green)');
      alert(`Export Complete!\n\nSuccessfully saved annotated blueprint to the 'annotated_exports' folder.`);
    } catch (err) {
      console.error(err);
      setStatus(`❌ Export failed: ${err.message}`, 'var(--accent-red)');
      alert(`Export Failed:\n${err.message}`);
    }
  };

  // --- Organizes Images, YOLO Labels & Burned Drawings in an External Folder ---
  const exportYoloDataset = async () => {
    if (!directoryHandle || images.length === 0) {
      alert('No drawings to export. Please open a project directory first.');
      return;
    }

    try {
      setStatus('Prompting for destination folder...', 'var(--accent-amber)');
      const destHandle = await window.showDirectoryPicker();
      
      // Verify write permission on the selected destination folder immediately during user activation
      const hasPermission = await verifyPermission(destHandle, true);
      if (!hasPermission) {
        setStatus('❌ Permission denied on destination folder.', 'var(--accent-red)');
        alert('Write permission is required on the selected destination folder.');
        return;
      }
      
      setStatus('📦 Preparing dataset subfolders in destination...', 'var(--accent-amber)');
      const imagesFolder = await destHandle.getDirectoryHandle('images', { create: true });
      const labelsFolder = await destHandle.getDirectoryHandle('labels', { create: true });
      const annotatedFolder = await destHandle.getDirectoryHandle('annotated_images', { create: true });

      let exportCount = 0;

      for (const imgObj of images) {
        const txtName = imgObj.name.substring(0, imgObj.name.lastIndexOf('.')) + '.txt';
        
        try {
          const txtHandle = await directoryHandle.getFileHandle(txtName);
          const labelFile = await txtHandle.getFile();
          const labelText = await labelFile.text();
          
          // 1. Copy YOLO label file
          const targetTxtHandle = await labelsFolder.getFileHandle(txtName, { create: true });
          const txtWritable = await targetTxtHandle.createWritable();
          await txtWritable.write(labelText);
          await txtWritable.close();

          // 2. Copy original blueprint image file
          const imageFile = await imgObj.handle.getFile();
          const targetImgHandle = await imagesFolder.getFileHandle(imgObj.name, { create: true });
          const imgWritable = await targetImgHandle.createWritable();
          await imgWritable.write(imageFile);
          await imgWritable.close();

          // 3. Generate and burn annotated drawing
          setStatus(`Burn-rendering annotations onto ${imgObj.name}...`, 'var(--accent-amber)');
          
          const imgUrl = URL.createObjectURL(imageFile);
          const img = new Image();
          img.src = imgUrl;
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          const w_img = img.width;
          const h_img = img.height;

          // Parse coordinates from label text
          const imgAnnotations = parseYoloData(labelText, w_img, h_img);

          // Offscreen drawing
          const offscreen = document.createElement('canvas');
          offscreen.width = w_img;
          offscreen.height = h_img;
          const ctx = offscreen.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // Draw annotations
          const lineWidth = Math.max(2, Math.round(w_img * 0.003));
          const fontSize = Math.max(12, Math.round(w_img * 0.008));
          ctx.lineWidth = lineWidth;

          for (const ann of imgAnnotations) {
            const [x0, y0, x1, y1] = ann.box;

            // Bounding Box
            ctx.strokeStyle = ann.color;
            ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

            // Badge Flag & Label
            ctx.fillStyle = ann.color;
            ctx.font = `bold ${fontSize}px "Segoe UI"`;
            ctx.textBaseline = 'bottom';
            
            const labelTextStr = ` ${ann.class} `;
            const textWidth = ctx.measureText(labelTextStr).width;
            const textHeight = fontSize + 6;

            ctx.fillRect(x0, y0 - textHeight, textWidth, textHeight);

            ctx.fillStyle = ann.color === '#FFD600' ? '#000000' : '#FFFFFF';
            ctx.fillText(labelTextStr, x0, y0 - 3);
          }

          // Output high-quality JPG blob
          const exportBlob = await new Promise(resolve => {
            offscreen.toBlob(resolve, 'image/jpeg', 0.95);
          });

          // Write annotated image
          const targetAnnotatedHandle = await annotatedFolder.getFileHandle(imgObj.name, { create: true });
          const annotatedWritable = await targetAnnotatedHandle.createWritable();
          await annotatedWritable.write(exportBlob);
          await annotatedWritable.close();

          URL.revokeObjectURL(imgUrl);
          exportCount++;
        } catch (e) {
          // File may not exist (no annotations for this image), skip
          console.log(`Skipping unannotated or error image ${imgObj.name}:`, e);
        }
      }

      setStatus(`📦 Dataset package successfully written to selected folder!`, 'var(--accent-green)');
      alert(`Dataset Packager Complete!\n\nSuccessfully wrote ${exportCount} annotated datasets into your selected folder:\n\n📁 /images/ (raw files)\n📁 /labels/ (YOLO annotations)\n📁 /annotated_images/ (burned files)`);
    } catch (err) {
      console.error(err);
      setStatus(`❌ Dataset export failed: ${err.message}`, 'var(--accent-red)');
      alert(`Dataset Packager Failed:\n${err.message}`);
    }
  };

  return (
    <div className="app-container">
      <Head>
        <title>Collaborative Engineering Drawing Annotation Web App</title>
        <meta name="description" content="Hostable web drawing annotation tool for professional blueprints. Multi-user lock, high DPI, client-side PDF convert." />
      </Head>

      {/* Main Workspace Layout */}
      <div className="workspace-container">
        {/* Sidebar Panel */}
        <aside className="sidebar">
          {/* Quick Actions */}
          <div className="section-title">QUICK ACTIONS</div>
          <button className="btn-primary" onClick={selectDirectory} style={{ marginBottom: '8px' }}>
            📂 Select Project Directory
          </button>

          <button className="btn-secondary" onClick={copyInviteLink} style={{ marginBottom: '8px', border: '1px dashed var(--accent-blue)', color: 'var(--accent-blue-hover)' }}>
            👥 Copy Teammate Invite Link
          </button>
          
          <div className="action-grid-2x2">
            <button className="btn-secondary" onClick={convertPdfToJpg}>
              📕 Convert PDF
            </button>
            <button className="btn-secondary" onClick={saveAnnotations}>
              💾 Save Labels
            </button>
          </div>
          
          <button className="btn-green" onClick={exportAnnotatedImage} style={{ marginBottom: '4px' }}>
            📤 Export Single Drawing
          </button>
          
          <button className="btn-primary" onClick={exportYoloDataset} style={{ marginBottom: '8px', backgroundColor: 'var(--accent-green)' }}>
            📦 Export Dataset Package
          </button>



          {/* Directory Files Selector */}
          <div className="section-title">DRAWINGS IN FOLDER</div>
          <div className="drawing-list-container">
            {images.length === 0 ? (
              <div style={{ color: 'var(--txt-muted)', fontSize: '12px', padding: '16px', textAlign: 'center' }}>
                No active folder loaded.
              </div>
            ) : (
              <ul className="drawing-list">
                {images.map((img, idx) => (
                  <li
                    key={img.name}
                    className={`drawing-item ${idx === currentImageIndex ? 'active' : ''}`}
                    onClick={() => setCurrentImageIndex(idx)}
                  >
                    <span>{img.name}</span>
                    {img.count > 0 && <span className="count-badge">{img.count}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Interactive Keyboard Shortcuts Grid */}
          <div className="section-title">LEGEND & KEY SHORTCUTS</div>
          <div className="legend-container">
            {Object.entries(CLASSES).map(([key, item]) => {
              const activeCount = annotations.filter(a => a.class === item.name).length;
              return (
                <div
                  key={key}
                  className={`legend-cell ${key === activeClassKey ? 'active' : ''}`}
                  onClick={() => {
                    setActiveClassKey(key);
                    setStatus(`🎯 Selected Annotation Class: '${item.name}'`);
                  }}
                >
                  <span className="legend-key">{key.toUpperCase()}</span>
                  <span className="legend-swatch" style={{ backgroundColor: item.color }} />
                  <span className="legend-name">
                    {item.name}{activeCount > 0 ? ` (${activeCount})` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* CAD Blueprint Drawing Workspace */}
        <main className="canvas-workspace">
          {directoryHandle && (
            <div className="canvas-toolbar">
              <button 
                className={`toolbar-btn ${activeTool === 'draw' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('draw');
                  activeToolRef.current = 'draw';
                  updateCursor();
                  setStatus('✏️ Bounding Box Drawing Mode (D)');
                }}
                title="Drawing Tool (Press 'D' or 'A')"
              >
                ✏️ Draw Box
              </button>
              <button 
                className={`toolbar-btn ${activeTool === 'pan' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool('pan');
                  activeToolRef.current = 'pan';
                  updateCursor();
                  setStatus('✋ Pan / Move Mode (H) - Hold [Spacebar] to temporarily pan');
                }}
                title="Pan/Move Tool (Press 'H' or Hold [Spacebar])"
              >
                ✋ Move
              </button>

              {/* Premium Visual Divider */}
              <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.15)', margin: '4px 6px' }} />

              <button 
                className={`toolbar-btn ${scrollMode === 'pan' ? 'active' : ''}`}
                onClick={() => {
                  setScrollMode('pan');
                  setStatus('💻 Scroll Mode: Trackpad Pan (2-finger swipe to pan, pinch/Ctrl+scroll to zoom)', 'var(--accent-blue-hover)');
                }}
                title="Trackpad Mode: Two-finger swipe to pan, pinch-to-zoom"
              >
                💻 Trackpad Pan
              </button>
              <button 
                className={`toolbar-btn ${scrollMode === 'zoom' ? 'active' : ''}`}
                onClick={() => {
                  setScrollMode('zoom');
                  setStatus('🖱️ Scroll Mode: Mouse Zoom (Scroll wheel to zoom, drag/Space to pan)', 'var(--accent-blue-hover)');
                }}
                title="Mouse Mode: Scroll wheel zooms directly, drag to pan"
              >
                🖱️ Mouse Zoom
              </button>
            </div>
          )}

          {/* Web Engine Viewport Canvas */}
          {!directoryHandle ? (
            <div className="no-directory-overlay">
              <h2 className="no-directory-title">Collaborative Engineering Annotation Tool</h2>
              <p className="no-directory-subtitle">
                A high-performance serverless drawing annotation system designed for teams. 
                Keep files strictly on your shared local network or synced cloud drives.
              </p>
              <button className="btn-primary" onClick={selectDirectory} style={{ maxWidth: '240px' }}>
                📂 Select Project Directory
              </button>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="viewport-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              onWheel={handleWheel}
              style={{ cursor: canvasCursor }}
            />
          )}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="status-bar">
        <span className="status-left" style={{ color: statusColor }}>
          {statusMessage}
        </span>
        <span id="status-coord" className="status-right">
          Zoom: --% | Coordinates: --, --
        </span>
      </footer>

      {/* PDF Conversion Dynamic Overlay */}
      {pdfConverting && (
        <div className="overlay">
          <div className="modal-content">
            <h3 className="modal-title">PDF Extraction</h3>
            <div className="spinner" />
            <p className="modal-body">{pdfMessage}</p>
          </div>
        </div>
      )}

      {/* Onboarding Welcome Modal */}
      {showOnboarding && (
        <div className="overlay" style={{ zIndex: 200 }}>
          <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'left' }}>
            <h3 className="modal-title" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👥 Joint Teammate Onboarding
            </h3>
            <p className="modal-body" style={{ color: 'var(--txt-primary)', fontSize: '13.5px', marginBottom: '14px' }}>
              You have been invited to collaborate on the project: <strong style={{ color: 'var(--accent-amber)' }}>{invitedProjectName}</strong>!
            </p>
            <p className="modal-body" style={{ fontSize: '12.5px', marginBottom: '16px', lineHeight: '1.5' }}>
              This system is fully serverless. Your drawings remain private in your local project folder (synced via OneDrive, Dropbox, or LAN). Multiple team members can work on different drawings inside the same folder simultaneously.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--txt-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Sync Local Project Folder
                </label>
                <p style={{ fontSize: '12px', color: 'var(--txt-muted)', marginBottom: '8px' }}>
                  Choose your local synced copy of the project folder. Once granted access, the tool will instantly connect and load all files.
                </p>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      setStatus('Prompting for folder access...', 'var(--accent-amber)');
                      const handle = await window.showDirectoryPicker();
                      setDirectoryHandle(handle);
                      setStatus('Access granted. Scanning drawings...', 'var(--accent-blue)');
                      await scanDirectory(handle);
                      setShowOnboarding(false);
                    } catch (err) {
                      console.error(err);
                      setStatus('⚠️ Folder access cancelled or failed.', 'var(--accent-red)');
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  📂 Select Local Project Folder & Connect
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--bg-border)', paddingTop: '12px' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowOnboarding(false)}
                style={{ width: 'auto', padding: '6px 16px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
