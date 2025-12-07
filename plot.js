// ====== plot.js - draggable partition lines + exact area partitions + AI Analysis ======
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('landCanvas');
  const ctx = canvas.getContext('2d');

  // Controls (expected to exist in the page)
  const drawBtn = document.getElementById('drawBtn');
  const undoBtn = document.getElementById('undoBtn');
  const okBtn = document.getElementById('okBtn');
  const resetBtn = document.getElementById('resetBtn');
  const generateBtn = document.getElementById('generateBtn');
  const customizeBtn = document.getElementById('customizeBtn');
  const heatmapBtn = document.getElementById('heatmapBtn');
  const aiBtn = document.getElementById('aiBtn'); // 🟢 NEW AI BUTTON
  const numPartitionsInput = document.getElementById('numPartitions');
  const refLengthInput = document.getElementById('refLength');
  const unitsSelect = document.getElementById('units'); // Note: might differ in HTML ID, checking logic below
  const areaTableBody = document.getElementById('areaTable');
  const totalAreaSpan = document.getElementById('totalArea');
  const imageInput = document.getElementById('imageUpload');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadModal = document.getElementById('uploadModal');
  const chooseFileBtn = document.getElementById('chooseFileBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const measureBtn = document.getElementById('measureBtn');
  const measureBox = document.getElementById('measureDistanceBox');
  const distanceInput = document.getElementById('boundaryDistance');

    // Map search UI
  const mapSearchContainer = document.getElementById('mapSearchContainer');
  const mapSearchInput     = document.getElementById('mapSearchInput');
  const mapSearchBtn       = document.getElementById('mapSearchBtn');

  if (mapSearchContainer) {
  mapSearchContainer.style.display = 'none';
  }

  let searchMarker = null; // marker for searched location


  // 🔹 Map mode elements
  const mapWrapper = document.getElementById('mapWrapper');
  const mapModeBtn = document.getElementById('mapModeBtn');
  const useMapBtn  = document.getElementById('useMapBtn');

  let map = null;
  let mapMode = false;        // true when using Google-map-like mode
  let mapDrawMode = false;    // true when clicking to draw polygon on map
  let mapLatLngs = [];        // vertices in lat/lon
  let mapPolyline = null;     // preview line
  let mapPolygon = null;      // closed polygon on map

  let geoMode = false;        // true when boundary is from real coordinates
  let boundaryGeo = null;     // lat/lng vertices for report


  // AI Elements
  const aiScanner = document.getElementById('aiScanner');
  const aiResultPanel = document.getElementById('aiResultPanel');
  const closeAiBtn = document.getElementById('closeAiBtn');
  const aiLoading = document.getElementById('aiLoading');
  const aiContent = document.getElementById('aiContent');

  // State
  let img = new Image();
  let imgLoaded = false;
  let drawMode = false;
  let drawingPreview = false;

  let boundaryPoints = [];
  let undoneStack = [];
  let boundaryFinal = null; // finalized polygon (array of {x,y})

  // partitions: array of objects { x: Number, dragging: Boolean }
  let partitions = [];
  let customizeMode = false;

  let pan = { x: 0, y: 0 };
  let scale = 1;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  // Measurement
  let measureMode = false;
  let measurePoints = [];
  let measurePath = [];
  
  // Heatmap State
  let showHeatmap = false;
  let heatmapCanvas = null; 

  // Scale calibration (meters-per-pixel)
  let scaleMetersPerPixel = null; // null until computed
  let currentUnit = 'm';

  const exportBtn = document.getElementById('exportBtn');

  // ===============================================
  // 🟢 NEW: AI ANALYSIS FEATURE LOGIC (Updated)
  // ===============================================
aiBtn && aiBtn.addEventListener('click', () => {
  // ❗ AI is ONLY for Google Map–based boundaries now

  // If we are still looking at the map, ask user to finalize first
  if (mapMode) {
    alert(
      'AI analysis works only on finalized boundaries drawn using "Use Google Map". ' +
      'Please finish selecting your boundary on the map and click OK first.'
    );
    return;
  }

  // We need a finalized map-based (geo) boundary
  if (!geoMode || !boundaryFinal || boundaryFinal.length < 3 || !Array.isArray(boundaryGeo) || !boundaryGeo.length) {
    alert(
      'AI analysis is available only for boundaries captured from Google Map.\n\n' +
      'Steps:\n' +
      '1. Click "Upload" → "Use Google Map".\n' +
      '2. Navigate to your location on the map.\n' +
      '3. Click "Draw" and select boundary vertices on the map.\n' +
      '4. Click "OK" to finalize the boundary.\n' +
      '5. Then click "AI Analysis".'
    );
    return;
  }

  // ✅ Valid geo boundary → run AI (geometry-based)
  aiScanner.classList.add('scanning');
  aiResultPanel.classList.remove('hidden');
  aiLoading.classList.remove('hidden');
  aiContent.classList.add('hidden');

  setTimeout(() => {
    performGeoAIAnalysis();  // 🔹 new function defined below
    aiScanner.classList.remove('scanning');
    aiLoading.classList.add('hidden');
    aiContent.classList.remove('hidden');
  }, 1500);
});



  closeAiBtn && closeAiBtn.addEventListener('click', () => {
    aiResultPanel.classList.add('hidden');
    aiScanner.classList.remove('scanning');
  });

function performGeoAIAnalysis() {
  // Geometry-based AI using boundaryFinal (metric coordinates) + boundaryGeo (lat/lon)
  try {
    // boundaryFinal is in local metric coordinates from latLngsToLocalMeters()
    const areaM2 = polygonArea(boundaryFinal); // treated as m² in geoMode
    const areaAcre = areaM2 / 4046.8564224;

    // Basic classification by area size
    let verdict = 'Moderate Potential';
    let score   = 75;
    let terrainType = 'Map-based (geometry only)';
    let insight = 'Boundary captured from Google Map coordinates. ' +
                  'AI is using parcel area and layout; satellite pixel features are not used.';

    if (areaAcre < 0.5) {
      verdict = 'Small Residential Plot';
      score   = 80;
      insight = 'Compact parcel, well-suited for individual residential or small commercial development.';
    } else if (areaAcre <= 5) {
      verdict = 'Residential / Mixed Use';
      score   = 85;
      insight = 'Mid-sized land parcel suitable for plotted residential layouts or mixed-use projects.';
    } else {
      verdict = 'Large-Scale / Agricultural Parcel';
      score   = 82;
      insight = 'Large tract of land, potentially viable for agriculture or phased township planning.';
    }

    // Fill the same UI fields used by previous AI system
    document.getElementById('aiScore').textContent        = Math.round(score);
    document.getElementById('aiVerdict').textContent      = verdict;
    document.getElementById('aiInsightText').textContent  = insight;
    document.getElementById('soilType').textContent       = terrainType;

    // No pixel information in map-only mode → mark feature bars as N/A
    document.getElementById('vegBar').style.width  = '0%';
    document.getElementById('vegVal').textContent  = 'N/A (map geometry only)';
    document.getElementById('roadBar').style.width = '0%';
    document.getElementById('roadVal').textContent = 'N/A (map geometry only)';
    document.getElementById('topoBar').style.width = '0%';
    document.getElementById('topoVal').textContent = 'N/A (map geometry only)';
  } catch (e) {
    console.error('Geo AI analysis failed', e);
    document.getElementById('aiInsightText').textContent =
      'Could not compute AI insight from map-based geometry.';
  }
}




//  EXPORT BUTTON LOGIC — FULL REPORT (WITH HEATMAP + AI)
// ===============================================
exportBtn && exportBtn.addEventListener('click', () => {
  if (!boundaryFinal) return alert('No boundary drawn to export.');

  exportBtn.disabled = true;
  const originalText = exportBtn.textContent;
  exportBtn.textContent = 'Preparing Report...';

  // 1️⃣ Ensure canvas is fully drawn (this includes heatmap if enabled)
  redraw();
  const imgData = canvas.toDataURL('image/png');

  // 2️⃣ Gather partition details safely
  const numPartitions = (partitions.length || 0) + 1;
  const referenceLength =
    refLengthInput && refLengthInput.value
      ? `${refLengthInput.value} ${unitsSelect?.value || 'm'}`
      : '—';

  const totalAreaText = totalAreaSpan ? totalAreaSpan.textContent : '—';

  const tableData = Array.from(areaTableBody.querySelectorAll('tr'))
    .map(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return ['-', '-'];
      return [cells[0].textContent || '-', cells[1].textContent || '-'];
    })
    .filter(r => r[0] !== '-' || r[1] !== '-'); // drop fully empty rows

  const now = new Date();

  // 3️⃣ READ HEATMAP + AI STATE FROM DOM
  const heatmapStatusText = (typeof showHeatmap !== 'undefined' && showHeatmap)
    ? 'Enabled (overlay visible in figure below)'
    : 'Disabled';

  const aiScoreVal    = document.getElementById('aiScore')?.textContent?.trim() || '';
  const aiVerdictVal  = document.getElementById('aiVerdict')?.textContent?.trim() || '';
  const aiInsightVal  = document.getElementById('aiInsightText')?.textContent?.trim() || '';
  const soilTypeVal   = document.getElementById('soilType')?.textContent?.trim() || '';

  const vegValText    = document.getElementById('vegVal')?.textContent?.trim() || '';
  const roadValText   = document.getElementById('roadVal')?.textContent?.trim() || '';
  const topoValText   = document.getElementById('topoVal')?.textContent?.trim() || '';

  // 🔹 3.1 Detect if boundary is from MAP / GEO mode (uses earth coordinates)
  const isGeoMode = (typeof geoMode !== 'undefined')
    && geoMode
    && Array.isArray(boundaryGeo)
    && boundaryGeo.length > 0;

  const boundarySource = isGeoMode
    ? 'Map-based (lat/lon – reference length not required)'
    : 'Canvas / Image-based (local scale)';

  // 🔹 3.2 Build vertex coordinate schedule (only for map mode)
  let vertexTableHtml = '';
  if (isGeoMode) {
    vertexTableHtml = `
      <h3 style="margin-top:10px;">Vertex Coordinate Schedule</h3>
      <table style="border-collapse:collapse; width:100%; margin-bottom:10px; font-size:10px;">
        <thead>
          <tr style="background:#e0e0e0;">
            <th style="border:1px solid #333; padding:4px;">Vertex</th>
            <th style="border:1px solid #333; padding:4px;">Latitude (°)</th>
            <th style="border:1px solid #333; padding:4px;">Longitude (°)</th>
          </tr>
        </thead>
        <tbody>
          ${
            boundaryGeo.map((ll, idx) => `
              <tr>
                <td style="border:1px solid #333; padding:4px;">V${idx + 1}</td>
                <td style="border:1px solid #333; padding:4px;">${ll.lat.toFixed(6)}</td>
                <td style="border:1px solid #333; padding:4px;">${ll.lng.toFixed(6)}</td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
      <p style="font-size:9px; margin-top:3px;">
        Note: Above coordinates are captured from the map interface at the time of partition finalization.
      </p>
    `;
  }

  // Only show AI section if score or verdict exist
  let aiSectionHtml = '';
  if (aiScoreVal || aiVerdictVal || aiInsightVal || soilTypeVal) {
    aiSectionHtml = `
      <h3 style="margin-top:15px;">AI-Based Land Suitability Analysis</h3>
      <table style="border-collapse:collapse; width:100%; margin-bottom:10px; font-size:12px;">
        <tr>
          <td style="padding:5px; border:1px solid #333; width:35%;">AI Score</td>
          <td style="padding:5px; border:1px solid #333;">${aiScoreVal || '—'}</td>
        </tr>
        <tr>
          <td style="padding:5px; border:1px solid #333;">AI Verdict</td>
          <td style="padding:5px; border:1px solid #333;">${aiVerdictVal || '—'}</td>
        </tr>
        <tr>
          <td style="padding:5px; border:1px solid #333;">Terrain Type</td>
          <td style="padding:5px; border:1px solid #333;">${soilTypeVal || '—'}</td>
        </tr>
      </table>

      <p style="font-size:11px; margin:3px 0;"><b>AI Insight:</b> ${aiInsightVal || 'No AI insight generated.'}</p>

      <h4 style="margin-top:10px; font-size:12px;">AI Feature Breakdown</h4>
      <table style="border-collapse:collapse; width:100%; font-size:11px;">
        <tr>
          <td style="padding:4px; border:1px solid #aaa; width:30%;">Vegetation Coverage</td>
          <td style="padding:4px; border:1px solid #aaa;">
            <div style="background:#eee; width:100%; height:10px; border-radius:4px; overflow:hidden;">
              <div style="height:10px; width:${vegValText.replace(/[^0-9]/g,'') || 0}%; background:#4caf50;"></div>
            </div>
            <span>${vegValText || '—'}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:4px; border:1px solid #aaa;">Road / Built-up Density</td>
          <td style="padding:4px; border:1px solid #aaa;">
            <div style="background:#eee; width:100%; height:10px; border-radius:4px; overflow:hidden;">
              <div style="height:10px; width:${roadValText.replace(/[^0-9]/g,'') || 0}%; background:#ff9800;"></div>
            </div>
            <span>${roadValText || '—'}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:4px; border:1px solid #aaa;">Topographical Variability</td>
          <td style="padding:4px; border:1px solid #aaa;">
            <div style="background:#eee; width:100%; height:10px; border-radius:4px; overflow:hidden;">
              <div style="height:10px; width:${topoValText.replace(/[^0-9]/g,'') || 0}%; background:#9c27b0;"></div>
            </div>
            <span>${topoValText || '—'}</span>
          </td>
        </tr>
      </table>
    `;
  }

  // 4️⃣ Create a full-screen overlay to host the report (VISIBLE)
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.backgroundColor = '#ffffff';
  overlay.style.zIndex = '99999';
  overlay.style.overflowY = 'auto';
  overlay.style.padding = '10px 0';              // slightly less padding
  overlay.style.fontFamily = 'Times New Roman, serif';
  overlay.style.boxSizing = 'border-box';

  // 5️⃣ Build the report container (NARROWER so it doesn't cut on right)
  const reportDiv = document.createElement('div');
  reportDiv.style.maxWidth = '650px';            // reduced from 800px
  reportDiv.style.margin = '0 10px';             // small left/right margin
  reportDiv.style.color = '#000';

  reportDiv.innerHTML = `
    <div style="display:flex; align-items:center; margin-bottom:10px;">
      <img src="./assets/logo.png" style="height:70px; margin-right:15px;" onerror="this.style.display='none'">
      <div style="flex:1; text-align:center;">
        <h1 style="margin:0; font-size:22px; text-transform:uppercase;">MapMyPlot</h1>
        <p style="margin:0; font-size:12px;">Official Land Partition Report</p>
      </div>
    </div>
    <hr>
    <p style="text-align:right; font-size:12px;">
      Report Date: ${now.toLocaleString("en-IN", {
        year:"numeric",
        month:"long",
        day:"numeric",
        hour:"2-digit",
        minute:"2-digit"
      })}<br>
      Reference No: REF-${now.getTime()}
    </p>

    <h3 style="margin-top:15px;">Plot Information</h3>
    <table style="border-collapse:collapse; width:100%; margin-bottom:15px; font-size:12px;">
      <tr>
        <td style="padding:5px; border:1px solid #333; width:35%;">Total Partitions</td>
        <td style="padding:5px; border:1px solid #333;">${tableData.length || numPartitions}</td>
      </tr>
      <tr>
        <td style="padding:5px; border:1px solid #333;">Reference Length</td>
        <td style="padding:5px; border:1px solid #333;">${referenceLength}</td>
      </tr>
      <tr>
        <td style="padding:5px; border:1px solid #333;">Total Area</td>
        <td style="padding:5px; border:1px solid #333;">${totalAreaText}</td>
      </tr>
      <tr>
        <td style="padding:5px; border:1px solid #333;">Heatmap Overlay</td>
        <td style="padding:5px; border:1px solid #333;">${heatmapStatusText}</td>
      </tr>
      <tr>
        <td style="padding:5px; border:1px solid #333;">Boundary Source</td>
        <td style="padding:5px; border:1px solid #333;">${boundarySource}</td>
      </tr>
    </table>

    <h3 style="margin-top:10px;">Partition Area Table</h3>
    <table style="border-collapse: collapse; width: 100%; margin-bottom:15px; font-size:12px; page-break-inside:auto;">
      <thead style="display:table-header-group;">
        <tr style="background:#e0e0e0;">
          <th style="border:1px solid #333; padding:5px;">S.No</th>
          <th style="border:1px solid #333; padding:5px;">Partition</th>
          <th style="border:1px solid #333; padding:5px;">Area</th>
        </tr>
      </thead>
      <tbody style="display:table-row-group;">
        ${
          tableData.length
            ? tableData
                .map(
                  (row, idx) => `
          <tr style="background-color:${idx % 2 === 0 ? '#f9f9f9' : '#fff'}; page-break-inside:avoid;">
            <td style="border:1px solid #333; padding:5px;">${idx + 1}</td>
            <td style="border:1px solid #333; padding:5px;">${row[0]}</td>
            <td style="border:1px solid #333; padding:5px;">${row[1]}</td>
          </tr>`
                )
                .join('')
            : `<tr>
                <td colspan="3" style="border:1px solid #333; padding:5px; text-align:center;">
                  No partition data available.
                </td>
              </tr>`
        }
      </tbody>
    </table>

    ${vertexTableHtml}
    ${aiSectionHtml}

    <h3 style="margin-top:10px;">Partition Figure</h3>
    <p style="font-size:11px; margin:5px 0;">
      Figure 1: Digitized plot boundary with computed partitions
      ${heatmapStatusText === 'Enabled (overlay visible in figure below)' ? 'and heatmap overlay.' : '.'}
    </p>
    <div style="text-align:center; margin:10px 0; page-break-inside:avoid;">
      <img src="${imgData}" style="max-width:100%; height:auto; border:1px solid #333;">
    </div>

    <hr>
    <div style="margin-top:30px; text-align:left;">
      <p style="font-size:12px;"><b>Authorized Signatory</b></p>
      <div style="border-top:1px solid #000; width:200px; margin-top:25px;"></div>
    </div>

    <div style="text-align:center; font-size:11px; margin-top:20px;">
      <p>Generated by MapMyPlot | This report can be attached as supporting evidence in land partition documentation and dispute resolution.</p>
    </div>
  `;

  overlay.appendChild(reportDiv);
  document.body.appendChild(overlay);

  // 6️⃣ html2pdf options
  const opt = {
    margin:       [10, 10, 15, 10],
    filename:     'land_partition_report.pdf',
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // 7️⃣ Generate PDF from the VISIBLE report
  html2pdf()
    .set(opt)
    .from(reportDiv)
    .save()
    .catch(err => {
      console.error('PDF Export Error:', err);
      alert('An error occurred while generating the PDF. See console for details.');
    })
    .finally(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
    });
});


  function resetStateForNewBoundary() {
    // similar to what resetBtn does, but we DO NOT touch toolbar or AI
    boundaryPoints = [];
    boundaryFinal = null;
    partitions = [];
    undoneStack = [];
    measureMode = false;
    measurePoints = [];
    measurePath = [];
    scaleMetersPerPixel = null;
    geoMode = false;
    boundaryGeo = null;
    totalAreaSpan && (totalAreaSpan.textContent = '—');
    areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr>`);
    distanceInput && (distanceInput.value = '');
  }

  function enterMapMode() {
    // 1) Clear any existing boundary / partitions
    resetStateForNewBoundary();

    // 2) Flag map mode
    mapMode = true;
    geoMode = false;
    boundaryGeo = null;
    imgLoaded = false;  // no base image
    heatmapCanvas = null;

    // 3) Show map, hide canvas
    canvas.style.display = 'none';
    mapWrapper.style.display = 'block';

    // 4) Initialize Leaflet map once
      // 4) Initialize Leaflet map once (with ROAD + SATELLITE layers)
  if (!map) {
    // Base layers
    const osmRoad = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    });

    const esriSat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }
    );

    // Create map with default view + road layer
    map = L.map('map', {
      center: [20.5937, 78.9629],  // India approx
      zoom: 5,
      layers: [osmRoad]
    });

    // Layer control to switch between road & satellite
    const baseLayers = {
      'Road Map': osmRoad,
      'Satellite': esriSat
    };
    L.control.layers(baseLayers).addTo(map);
  }


    // Ensure normal navigation active
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.touchZoom.enable();

    // Clear any previous drawings
    mapLatLngs = [];
    if (mapPolyline) {
      map.removeLayer(mapPolyline);
      mapPolyline = null;
    }
    if (mapPolygon) {
      map.removeLayer(mapPolygon);
      mapPolygon = null;
    }

    drawMode = false;
    mapDrawMode = false;
    updateModeIndicator();

     if (mapSearchContainer) {
    mapSearchContainer.style.display = 'flex';
  }
  }





  // ====== Canvas resize & DPR handling ======
  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // ====== Upload modal handlers ======
  uploadBtn && uploadBtn.addEventListener('click', () => uploadModal.style.display = 'flex');
  closeModalBtn && closeModalBtn.addEventListener('click', () => uploadModal.style.display = 'none');
  chooseFileBtn && chooseFileBtn.addEventListener('click', () => imageInput.click());
    useMapBtn && useMapBtn.addEventListener('click', () => {
    uploadModal.style.display = 'none';
    enterMapMode();
  });
    mapModeBtn && mapModeBtn.addEventListener('click', () => {
    enterMapMode();
  });


  imageInput && imageInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { 
        img.src = ev.target.result; 
        heatmapCanvas = null; // Clear old heatmap on new upload
        showHeatmap = false;
        heatmapBtn.classList.remove('active');
        uploadModal.style.display = 'none'; 
        // Hide AI panel if open
        aiResultPanel.classList.add('hidden');
        aiScanner.classList.remove('scanning');
    };
    reader.readAsDataURL(file);
  });
  img.onload = () => { imgLoaded = true; redraw(); };

  // ====== Basic helpers ======
  function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

  function drawImageOnCanvas() {
    // Note: We calculate dimensions here to return them for heatmap usage
    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);
    
    if (!imgLoaded) return { offsetX: 0, offsetY: 0, drawW: cw, drawH: ch }; // Fallback for no image

    const canvasRatio = cw / ch;
    const imgRatio = img.width / img.height;
    let drawW, drawH, offsetX, offsetY;
    if (imgRatio > canvasRatio) {
      drawW = cw; drawH = cw / imgRatio;
      offsetX = 0; offsetY = (ch - drawH) / 2;
    } else {
      drawH = ch; drawW = ch * imgRatio;
      offsetY = 0; offsetX = (cw - drawW) / 2;
    }
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    return { offsetX, offsetY, drawW, drawH };
  }

  // ====== Heatmap Logic (Green to Red) ======
  function createGradientPalette() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 256;
    pCanvas.height = 1;
    const pCtx = pCanvas.getContext('2d');
    
    const grad = pCtx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0.0, 'rgba(0,0,255,0)');
    grad.addColorStop(0.1, 'rgba(0,0,255,0.8)'); // Blue
    grad.addColorStop(0.3, 'rgba(0,255,255,0.8)'); // Cyan
    grad.addColorStop(0.5, 'rgba(0,255,0,0.8)');   // Green
    grad.addColorStop(0.7, 'rgba(255,255,0,0.8)'); // Yellow
    grad.addColorStop(1.0, 'rgba(255,0,0,0.8)');   // Red
    
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 256, 1);
    return pCtx.getImageData(0, 0, 256, 1).data;
  }

  function generateHeatmapCanvas(width, height) {
    const hCanvas = document.createElement('canvas');
    hCanvas.width = width;
    hCanvas.height = height;
    const hCtx = hCanvas.getContext('2d');

    // 1. Draw random black circles with low alpha
    const numPoints = 150; // Density of points
    for (let i = 0; i < numPoints; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * (Math.min(width, height) * 0.15) + 20; 
        
        const grd = hCtx.createRadialGradient(x, y, 0, x, y, radius);
        grd.addColorStop(0, 'rgba(0,0,0,0.3)'); // Intense center
        grd.addColorStop(1, 'rgba(0,0,0,0)');   // Transparent edge
        
        hCtx.fillStyle = grd;
        hCtx.beginPath();
        hCtx.arc(x, y, radius, 0, Math.PI * 2);
        hCtx.fill();
    }

    // 2. Colorize based on alpha density
    const imgData = hCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const palette = createGradientPalette();

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]; // Get calculated alpha from black circles
        if (alpha > 0) {
            // Map alpha (0-255) to palette index
            const offset = alpha * 4;
            data[i] = palette[offset];     // R
            data[i + 1] = palette[offset + 1]; // G
            data[i + 2] = palette[offset + 2]; // B
            data[i + 3] = palette[offset + 3] || 150; // Keep some transparency
        }
    }
    hCtx.putImageData(imgData, 0, 0);
    return hCanvas;
  }

  // Toggle Heatmap Button
  heatmapBtn && heatmapBtn.addEventListener('click', () => {
    showHeatmap = !showHeatmap;
    heatmapBtn.classList.toggle('active', showHeatmap);
    
    if (showHeatmap && !heatmapCanvas) {
        // Generate based on image size or canvas size
        const w = imgLoaded ? img.width : canvas.width;
        const h = imgLoaded ? img.height : canvas.height;
        heatmapCanvas = generateHeatmapCanvas(w, h);
    }
    redraw();
  });

  // ====== Drawing preview & final polygon ======
  function drawBoundaryPreview(mousePos) {
    if (boundaryPoints.length === 0 && !mousePos) return;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);

    if (boundaryPoints.length > 0) {
      ctx.strokeStyle = 'green';
      ctx.fillStyle = 'rgba(0,255,0,0.12)';
      ctx.lineWidth = Math.max(1, 2 / scale);
      ctx.beginPath();
      ctx.moveTo(boundaryPoints[0].x, boundaryPoints[0].y);
      for (let i = 1; i < boundaryPoints.length; i++) ctx.lineTo(boundaryPoints[i].x, boundaryPoints[i].y);
      ctx.stroke();
    }

    if (mousePos && boundaryPoints.length > 0) {
      const last = boundaryPoints[boundaryPoints.length - 1];
      ctx.strokeStyle = 'rgba(0,128,0,0.7)';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
    }

    ctx.fillStyle = 'red';
    boundaryPoints.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2); ctx.fill(); });

    ctx.restore();
  }

  // draw final polygon + partitions + measure path
  function drawBoundaryFinal() {
    if (!boundaryFinal) return;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);

    // polygon fill
    ctx.fillStyle = 'rgba(144,238,144,0.5)';
    ctx.strokeStyle = 'green';
    ctx.lineWidth = Math.max(1, 2 / scale);
    ctx.beginPath();
    ctx.moveTo(boundaryFinal[0].x, boundaryFinal[0].y);
    for (let i = 1; i < boundaryFinal.length; i++) ctx.lineTo(boundaryFinal[i].x, boundaryFinal[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // draw partition vertical segments (inner polygon segments)
    if (partitions && partitions.length) {
      ctx.strokeStyle = customizeMode ? 'red' : 'blue';
      ctx.lineWidth = Math.max(1, 2 / scale);
      partitions.forEach(p => {
        const ys = getPolygonIntersectionsAtX(p.x, boundaryFinal);
        for (let i = 0; i + 1 < ys.length; i += 2) {
          ctx.beginPath();
          ctx.moveTo(p.x, ys[i]);
          ctx.lineTo(p.x, ys[i + 1]);
          ctx.stroke();
        }
      });
    }

    // draw draggable handles (intersection points) when in customize mode
    if (customizeMode && partitions && partitions.length) {
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = Math.max(1, 1 / scale);
      partitions.forEach(p => {
        const ys = getPolygonIntersectionsAtX(p.x, boundaryFinal);
        for (let i = 0; i + 1 < ys.length; i += 2) {
          // draw small handle at top and bottom intersections
          const y0 = ys[i], y1 = ys[i + 1];
          [y0, y1].forEach(y => {
            ctx.beginPath();
            ctx.arc(p.x, y, 6 / scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
      });
    }

    // draw measure path
    if (measurePath.length > 0) {
      ctx.strokeStyle = 'orange';
      ctx.lineWidth = Math.max(2, 3 / scale);
      ctx.beginPath();
      ctx.moveTo(measurePath[0].x, measurePath[0].y);
      for (let i = 1; i < measurePath.length; i++) ctx.lineTo(measurePath[i].x, measurePath[i].y);
      ctx.stroke();
    }
    ctx.fillStyle = 'red';
    measurePoints.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2); ctx.fill(); });

    ctx.restore();
  }


  function redraw(mousePosForPreview) {
    clearCanvas();
    // 1. Draw Image
    const dims = drawImageOnCanvas(); // Returns {offsetX, offsetY, drawW, drawH}
    
    // 2. Draw Heatmap (if enabled)
    if (showHeatmap && heatmapCanvas) {
        ctx.save();
        ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);
        ctx.globalAlpha = 0.6; // Blending strength
        ctx.drawImage(heatmapCanvas, dims.offsetX, dims.offsetY, dims.drawW, dims.drawH);
        ctx.restore();
    }

    // 3. Draw Plot Lines
    if (!boundaryFinal) {
      if (drawMode) drawBoundaryPreview(mousePosForPreview);
      else drawBoundaryPreview(null);
    } else {
      drawBoundaryFinal();
      if (drawMode) drawBoundaryPreview(mousePosForPreview); // in case user toggles draw while polygon exists
    }
  }

  // ====== Geometry helpers ======
  function polygonArea(poly) {
    if (!poly || poly.length < 3) return 0;
    let a = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    return Math.abs(a / 2);
  }

  //to indicate the mode
function updateModeIndicator() {
  const el = document.getElementById("modeIndicator");
  if (!el) return;

  if (drawMode) {
    el.textContent = "Mode: Draw";
  } else if (measureMode) {
    el.textContent = "Mode: Measure";
  } else if (customizeMode) {
    el.textContent = "Mode: Customize";
  } else {
    el.textContent = "Mode: Normal";
  }
}

  function searchLocationOnMap() {
    if (!map || !mapMode) return;

    const query = mapSearchInput?.value.trim();
    if (!query) {
      alert('Please enter a location to search.');
      return;
    }

    mapSearchBtn && (mapSearchBtn.disabled = true);

    // Use Nominatim (OpenStreetMap geocoding)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    fetch(url, {
      headers: {
        // polite identification (optional but good practice)
        'Accept': 'application/json'
      }
    })
      .then(res => res.json())
      .then(results => {
        if (!results || !results.length) {
          alert('Location not found. Try a more specific query.');
          return;
        }

        const { lat, lon } = results[0];
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);

        if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
          alert('Could not parse location coordinates.');
          return;
        }

        // Center map on the search result
        map.setView([latNum, lonNum], 16);

        // Add / move marker
        if (searchMarker) {
          searchMarker.setLatLng([latNum, lonNum]);
        } else {
          searchMarker = L.marker([latNum, lonNum]).addTo(map);
        }
      })
      .catch(err => {
        console.error('Map search error:', err);
        alert('Error while searching location.');
      })
      .finally(() => {
        mapSearchBtn && (mapSearchBtn.disabled = false);
      });
  }



  // Clip polygon with vertical line x = c. If keepLeft true, returns polygon ∩ {x <= c}
  function clipPolygonByVertical(poly, c, keepLeft = true) {
    if (!poly || poly.length < 3) return [];
    const out = [];
    const eps = 1e-9;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const aIn = keepLeft ? (a.x <= c + eps) : (a.x >= c - eps);
      const bIn = keepLeft ? (b.x <= c + eps) : (b.x >= c - eps);

      if (aIn && bIn) {
        out.push({ x: b.x, y: b.y });
      } else if (aIn && !bIn) {
        const denom = (b.x - a.x);
        if (Math.abs(denom) > 1e-12) {
          const t = (c - a.x) / denom;
          const y = a.y + t * (b.y - a.y);
          out.push({ x: c, y });
        }
      } else if (!aIn && bIn) {
        const denom = (b.x - a.x);
        if (Math.abs(denom) > 1e-12) {
          const t = (c - a.x) / denom;
          const y = a.y + t * (b.y - a.y);
          out.push({ x: c, y });
        }
        out.push({ x: b.x, y: b.y });
      } // else both out
    }
    // remove near duplicates
    const cleaned = [];
    for (let i = 0; i < out.length; i++) {
      if (i === 0) cleaned.push(out[i]);
      else {
        const prev = cleaned[cleaned.length - 1];
        if (Math.hypot(prev.x - out[i].x, prev.y - out[i].y) > 1e-6) cleaned.push(out[i]);
      }
    }
    return cleaned;
  }

  // Return sorted y-coordinates where vertical line x intersects polygon edges
  function getPolygonIntersectionsAtX(x, poly) {
    const ys = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((a.x <= x && b.x >= x) || (b.x <= x && a.x >= x)) {
        if (Math.abs(b.x - a.x) < 1e-12) {
          ys.push(a.y, b.y);
        } else {
          const t = (x - a.x) / (b.x - a.x);
          if (t >= -1e-9 && t <= 1 + 1e-9) {
            const y = a.y + t * (b.y - a.y);
            ys.push(y);
          }
        }
      }
    }
    ys.sort((u, v) => u - v);
    // remove near duplicates
    const res = [];
    for (const y of ys) {
      if (res.length === 0 || Math.abs(res[res.length - 1] - y) > 1e-6) res.push(y);
    }
    return res;
  }

  // ====== Mouse coordinate helpers ======
  function getMousePosCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left - pan.x) / scale, y: (e.clientY - rect.top - pan.y) / scale };
  }

  // ====== Mouse events & partition dragging ======
  let activePartition = null;
  let activeHandle = null; // 'top' or 'bottom' or null (we only need to know that user clicked near an endpoint)

  canvas.addEventListener('mousedown', (e) => {
    const pos = getMousePosCanvas(e);

    // partition handle picking (only in customize mode)
    if (customizeMode && boundaryFinal && partitions.length) {
      const tol = 8 / scale; // tolerance in canvas coords
      for (let p of partitions) {
        const ys = getPolygonIntersectionsAtX(p.x, boundaryFinal);
        for (let i = 0; i + 1 < ys.length; i += 2) {
          const candidates = [ys[i], ys[i + 1]];
          for (let idx = 0; idx < candidates.length; idx++) {
            const y = candidates[idx];
            const d = Math.hypot(pos.x - p.x, pos.y - y);
            if (d <= tol) {
              // start dragging this partition's x
              activePartition = p;
              p.dragging = true;
              activeHandle = idx === 0 ? 'top' : 'bottom';
              return; // take precedence over other actions
            }
          }
        }
      }
    }

    // drawing polygon mode
    if (drawMode) {
      // close polygon if clicking near first point
      if (boundaryPoints.length > 2) {
        const first = boundaryPoints[0];
        const d = Math.hypot(pos.x - first.x, pos.y - first.y);
        if (d < 6 / Math.max(1, scale)) {
          boundaryPoints.push({ ...first });
          drawingPreview = false;
          redraw();
          return;
        }
      }
      boundaryPoints.push(pos);
      undoneStack = [];
      drawingPreview = true;
      redraw();
      return;
    }

    // measure mode (snap to boundary)
    if (measureMode && boundaryFinal) {
      if (measurePoints.length < 2) {
        const closest = closestPointOnBoundary(pos, boundaryFinal);
        measurePoints.push(closest);
        if (measurePoints.length === 2) {
          measurePath = getShortestBoundaryPath(boundaryFinal, measurePoints[0], measurePoints[1]);
          const distPx = measurePathLength(measurePath); // px
          if (scaleMetersPerPixel) {
            const distMeters = distPx * scaleMetersPerPixel;
            const out = metersToUnit(distMeters, currentUnit);
            distanceInput.value = `${out.toFixed(3)} ${currentUnit}`;
          } else {
            distanceInput.value = `${distPx.toFixed(3)} px (no scale)`;
          }
        }
        redraw();
        return;
      }
    }

    // otherwise start panning
    isDragging = true;
    dragStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  });

  canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePosCanvas(e);

    // dragging a partition in customize mode
    if (activePartition && activePartition.dragging) {
      // compute allowable range (don't cross neighbors)
      const idx = partitions.indexOf(activePartition);
      const boundaryMinX = Math.min(...boundaryFinal.map(p => p.x));
      const boundaryMaxX = Math.max(...boundaryFinal.map(p => p.x));
      const leftBound = (idx > 0) ? (partitions[idx - 1].x + 1e-3) : boundaryMinX;
      const rightBound = (idx < partitions.length - 1) ? (partitions[idx + 1].x - 1e-3) : boundaryMaxX;
      // clamp proposed x to [leftBound, rightBound]
      let proposedX = Math.max(leftBound, Math.min(rightBound, pos.x));

      // additionally ensure proposedX is within polygon's horizontal span at the handle's y
      // We do a simple check: if proposedX has 0 intersections (outside polygon), nudge it to nearest side
      const testYs = getPolygonIntersectionsAtX(proposedX, boundaryFinal);
      if (testYs.length < 2) {
        // attempt to nudge slightly left/right until we find intersections (bounded)
        const step = (rightBound - leftBound) / 100 || 1;
        let found = false;
        for (let sign of [0, -1, 1, -2, 2]) {
          const tryX = proposedX + sign * step;
          if (tryX < leftBound || tryX > rightBound) continue;
          if (getPolygonIntersectionsAtX(tryX, boundaryFinal).length >= 2) { proposedX = tryX; found = true; break; }
        }
        if (!found) {
          // fallback: don't move
          proposedX = activePartition.x;
        }
      }

      activePartition.x = proposedX;
      updateAreas(); // live update areas
      redraw();
      return;
    }

    // drawing preview while creating polygon
    if (drawMode && boundaryPoints.length > 0 && drawingPreview) {
      redraw(pos);
      return;
    }

    // panning
    if (isDragging) {
      pan.x = e.clientX - dragStart.x;
      pan.y = e.clientY - dragStart.y;
      redraw();
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (activePartition) activePartition.dragging = false;
    activePartition = null;
    activeHandle = null;
    isDragging = false;
    drawingPreview = false;
  });

  canvas.addEventListener('mouseout', () => {
    // cancel interactive states
    if (activePartition) activePartition.dragging = false;
    activePartition = null;
    activeHandle = null;
    isDragging = false;
    drawingPreview = false;
    redraw();
  });

  // ====== Draw / Undo / OK ======
  undoBtn && undoBtn.addEventListener('click', () => {
    if (boundaryPoints.length === 0) return;
    undoneStack.push(boundaryPoints.pop());
    redraw();
  });

    mapSearchBtn && mapSearchBtn.addEventListener('click', () => {
    searchLocationOnMap();
  });

  mapSearchInput && mapSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchLocationOnMap();
    }
  });


    function latLngsToLocalMeters(latLngs) {
    // Use first point as origin
    const R = 6378137; // Earth radius in meters
    const originLat = latLngs[0].lat * Math.PI / 180;
    const originLon = latLngs[0].lng * Math.PI / 180;

    // Compute local x,y in meters
    const pts = latLngs.map(ll => {
      const latRad = ll.lat * Math.PI / 180;
      const lonRad = ll.lng * Math.PI / 180;
      const dLat = latRad - originLat;
      const dLon = lonRad - originLon;
      const x = R * dLon * Math.cos(originLat); // east-west
      const y = R * dLat;                       // north-south
      return { x, y };
    });

    // Optional: recenter around (0,0) to keep numbers small
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return pts.map(p => ({ x: p.x - cx, y: p.y - cy }));
  }


    okBtn && okBtn.addEventListener('click', () => {
    if (mapMode) {
      // 🔹 Finalize map-based boundary
      if (!mapLatLngs || mapLatLngs.length < 3) {
        return alert('Select at least 3 points on the map to form a boundary.');
      }

      // Close polygon on map visually
      if (mapPolyline) {
        map.removeLayer(mapPolyline);
        mapPolyline = null;
      }
      if (mapPolygon) {
        map.removeLayer(mapPolygon);
      }
      mapPolygon = L.polygon(mapLatLngs, { color: 'green', fillOpacity: 0.2 }).addTo(map);

      // Convert lat/lon → local metric coordinates (meters)
      const metricPoints = latLngsToLocalMeters(mapLatLngs);

      // Save for geometric algorithms
      boundaryFinal = metricPoints;   // used by partition + area
      boundaryGeo   = mapLatLngs;     // used for labeling / PDF
      geoMode       = true;           // signal that areas are already in m² (no ref length)

      // Exit drawing mode
      mapDrawMode = false;
      map.off('click', onMapClickAddVertex);
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.touchZoom.enable();

      // Reset table + total (will be filled when Generate is clicked)
      totalAreaSpan && (totalAreaSpan.textContent = '—');
      areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr>`);

      // Reference length not required in geoMode
      if (refLengthInput) {
        refLengthInput.value = '';
        refLengthInput.placeholder = 'Not required in map mode';
      }

      // Hide map and go back to canvas-style visualization (optional)
      // If you want to continue seeing the polygon only on map, comment these 3 lines:
      mapMode = false;
      if (mapSearchContainer) {
        mapSearchContainer.style.display = 'none';
      }
      mapWrapper.style.display = 'none';
      canvas.style.display = 'block';

      // We don't set imgLoaded, so background is blank; polygon will be drawn on canvas
      updateModeIndicator();
      redraw();
      return;
    }

    // 🔹 Normal canvas flow (existing)
    if (boundaryPoints.length < 3) return alert('Draw a closed boundary first (at least 3 points).');
    const pts = boundaryPoints.slice();
    if (pts.length > 1) {
      const first = pts[0], last = pts[pts.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) pts.pop();
    }
    boundaryFinal = pts;
    boundaryPoints = [];
    drawMode = false;
    drawingPreview = false;
    drawBtn && drawBtn.classList.remove('active');

    partitions = [];
    measureMode = false;
    measurePoints = [];
    measurePath = [];
    measureBox && (measureBox.style.display = 'none');
    distanceInput && (distanceInput.value = '');
    totalAreaSpan && (totalAreaSpan.textContent = '—');
    areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr>`);

    // normal pixel-based scale
    geoMode = false;
    boundaryGeo = null;
    updateScaleFromInputs();

    // hide image after finalizing (your previous behaviour)
    imgLoaded = false;
    img.src = "";
    heatmapCanvas = null;

    updateModeIndicator();
    redraw();
  });


   drawBtn && drawBtn.addEventListener('click', () => {
    if (mapMode) {
      // 🔹 Map drawing toggle
      mapDrawMode = !mapDrawMode;
      drawBtn.classList.toggle('active', mapDrawMode);

      if (mapDrawMode) {
        updateModeIndicator();
        // disable map pan/zoom while drawing
        map.dragging.disable();
        map.scrollWheelZoom.disable();
        map.doubleClickZoom.disable();
        map.boxZoom.disable();
        map.touchZoom.disable();

        // set up click handler
        mapLatLngs = [];
        if (mapPolyline) { map.removeLayer(mapPolyline); mapPolyline = null; }
        if (mapPolygon)  { map.removeLayer(mapPolygon);  mapPolygon  = null; }

        map.on('click', onMapClickAddVertex);
      } else {
        // exit map drawing mode
        map.off('click', onMapClickAddVertex);
        map.dragging.enable();
        map.scrollWheelZoom.enable();
        map.doubleClickZoom.enable();
        map.boxZoom.enable();
        map.touchZoom.enable();
        updateModeIndicator();
      }
      return;
    }

    // 🔹 Normal canvas drawing (existing behaviour)
    drawMode = !drawMode;
    drawBtn.classList.toggle('active', drawMode);
    if (drawMode) {
      boundaryPoints = [];
      undoneStack = [];
      boundaryFinal = null;
      partitions = [];
      totalAreaSpan && (totalAreaSpan.textContent = '—');
      areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr>`);
    } else {
      drawingPreview = false;
    }
    updateModeIndicator();
    redraw();
  });

    function onMapClickAddVertex(e) {
    const latlng = e.latlng;
    mapLatLngs.push(latlng);

    // redraw preview polyline / polygon
    if (mapPolyline) {
      map.removeLayer(mapPolyline);
    }
    if (mapPolygon) {
      map.removeLayer(mapPolygon);
      mapPolygon = null;
    }

    if (mapLatLngs.length >= 2) {
      mapPolyline = L.polyline(mapLatLngs, { color: 'green' }).addTo(map);
    }

    // If user clicks near the first point to close, we can later check. For now,
    // allow them to press OK to finalize.
  }


  // ====== Wheel Zoom (centered on cursor) ======
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zoomFactor = 1 - e.deltaY * 0.00125;
    const newScale = scale * zoomFactor;
    // clamp to reasonable range
    if (newScale < 0.2 || newScale > 10) return;
    pan.x = mx - (mx - pan.x) * (newScale / scale);
    pan.y = my - (my - pan.y) * (newScale / scale);
    scale = newScale;
    redraw();
  }, { passive: false });

  // ====== Unit/scale helpers ======
  function lengthToMeters(length, unit) {
    switch (unit) {
      case 'm': return length;
      case 'ft': return length * 0.3048;
      case 'in': return length * 0.0254;
      case 'km': return length * 1000;
      case 'mi': return length * 1609.344;
      default: return length; // fallback
    }
  }
  function metersToUnit(lengthMeters, unit) {
    switch (unit) {
      case 'm': return lengthMeters;
      case 'ft': return lengthMeters / 0.3048;
      case 'in': return lengthMeters / 0.0254;
      case 'km': return lengthMeters / 1000;
      case 'mi': return lengthMeters / 1609.344;
      default: return lengthMeters;
    }
  }
function areaMeters2ToUnit(areaM2, unit) {
  switch (unit) {
    case 'm': return { value: areaM2, label: 'm²' };
    case 'ft': return { value: areaM2 / 0.09290304, label: 'ft²' }; // 1 m² = 10.7639 ft²
    case 'in': return { value: areaM2 / 0.00064516, label: 'in²' }; // 1 m² = 1550 in²
    case 'acre': return { value: areaM2 / 4046.8564224, label: 'acres' };
    default: return { value: areaM2, label: 'm²' }; // fallback
  }
}


function updateScaleFromInputs(lengthUnit = 'm') {
  if (!boundaryFinal || boundaryFinal.length < 2) { 
    scaleMetersPerPixel = null; 
    return; 
  }

  const refValue = parseFloat(refLengthInput.value);
  if (!refValue || !isFinite(refValue)) { 
    scaleMetersPerPixel = null; 
    return; 
  }

  const p1 = boundaryFinal[0], p2 = boundaryFinal[1];
  const refPixelLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (refPixelLen <= 0) { scaleMetersPerPixel = null; return; }

  const refMeters = lengthToMeters(refValue, lengthUnit);
  scaleMetersPerPixel = refMeters / refPixelLen; // meters per pixel
}


  // Keep scale updated when user edits inputs
  refLengthInput && refLengthInput.addEventListener('change', updateScaleFromInputs);
  unitsSelect && unitsSelect.addEventListener('change', () => { updateScaleFromInputs(); currentUnit = unitsSelect.value; });

  // ====== Partition generation (exact equal-area using binary search) ======
 generateBtn && generateBtn.addEventListener('click', () => {
  if (!boundaryFinal) return alert('Finalize boundary first.');
  const num = Math.max(1, parseInt(numPartitionsInput.value || '1', 10));
  if (num <= 0) return alert('Enter valid number of partitions.');

  // Read current units from selectors
  const lengthUnit = document.getElementById('lengthUnit')?.value || 'm';
  const areaUnit = document.getElementById('areaUnit')?.value || 'm';

  // Update scale based on reference length and length unit
  updateScaleFromInputs(lengthUnit);

  const totalAreaPx = polygonArea(boundaryFinal);
  if (totalAreaPx === 0) return alert('Zero area polygon.');

  // compute min&max X
  const minX = Math.min(...boundaryFinal.map(p => p.x));
  const maxX = Math.max(...boundaryFinal.map(p => p.x));

  const areaLeftOfX = (x) => polygonArea(clipPolygonByVertical(boundaryFinal, x, true));

  // create cut positions via binary search to achieve equal-area partitions
  partitions = [];
  for (let i = 1; i < num; i++) {
    const targetPx = (totalAreaPx * i) / num;
    let left = minX, right = maxX, mid = (left + right) / 2;
    for (let iter = 0; iter < 60; iter++) {
      mid = (left + right) / 2;
      const a = areaLeftOfX(mid);
      if (a < targetPx) left = mid;
      else right = mid;
    }
    const cutX = (left + right) / 2;
    partitions.push({ x: cutX, dragging: false });
  }

  // Update area table using selected area unit
  updateAreas(areaUnit);

  redraw();
});


  // update area table from current partitions (live)
function updateAreas(areaUnit = 'm') {
  if (!boundaryFinal) return;

  const minX = Math.min(...boundaryFinal.map(p => p.x));
  const maxX = Math.max(...boundaryFinal.map(p => p.x));
  const areaLeftOfX = (x) => polygonArea(clipPolygonByVertical(boundaryFinal, x, true));
  
  areaTableBody.innerHTML = '';
  let prevX = minX;
  const cutXs = partitions.map(p => p.x).concat([maxX]);

  let cumM2 = 0;
    for (let idx = 0; idx < cutXs.length; idx++) {
    const x = cutXs[idx];
    const areaPx = areaLeftOfX(x) - areaLeftOfX(prevX);
    const areaPxSafe = Math.max(0, areaPx);

    if (geoMode) {
      // 🔹 Here "areaPxSafe" is actually in m² already (metric boundary)
      const areaM2 = areaPxSafe;
      const converted = areaMeters2ToUnit(areaM2, areaUnit);
      areaTableBody.innerHTML += `<tr><td>P${idx + 1}</td><td>${converted.value.toFixed(4)} ${converted.label}</td></tr>`;
      cumM2 += areaM2;
    } else if (scaleMetersPerPixel) {
      const areaM2 = areaPxSafe * (scaleMetersPerPixel ** 2);
      const converted = areaMeters2ToUnit(areaM2, areaUnit);
      areaTableBody.innerHTML += `<tr><td>P${idx + 1}</td><td>${converted.value.toFixed(4)} ${converted.label}</td></tr>`;
      cumM2 += areaM2;
    } else {
      areaTableBody.innerHTML += `<tr><td>P${idx + 1}</td><td>${areaPxSafe.toFixed(3)} px² (no scale)</td></tr>`;
    }
    prevX = x;
  }

  // update total area display
  if (geoMode) {
    const totalConverted = areaMeters2ToUnit(cumM2, areaUnit);
    totalAreaSpan.textContent = `${totalConverted.value.toFixed(4)} ${totalConverted.label}`;
  } else if (scaleMetersPerPixel) {
    const totalConverted = areaMeters2ToUnit(cumM2, areaUnit);
    totalAreaSpan.textContent = `${totalConverted.value.toFixed(4)} ${totalConverted.label}`;
  } else {
    const totalPx = polygonArea(boundaryFinal);
    totalAreaSpan.textContent = `${totalPx.toFixed(3)} px² (no scale)`;
  }

}


// ====== Measurement helpers (unchanged) ======
  function closestPointOnBoundary(pt, poly) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const proj = closestPointOnSegment(pt, a, b);
      const d = Math.hypot(proj.x - pt.x, proj.y - pt.y);
      if (d < bestD) { bestD = d; best = proj; }
    }
    return best;
  }

  function closestPointOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    if (t <= 0) return { x: a.x, y: a.y };
    if (t >= 1) return { x: b.x, y: b.y };
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  function findClosestSegmentIndex(poly, pt) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const proj = closestPointOnSegment(pt, poly[i], poly[(i + 1) % poly.length]);
      const d = Math.hypot(proj.x - pt.x, proj.y - pt.y);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    return bestIdx;
  }

  function buildPath(poly, start, end, startIdx, endIdx, clockwise = true) {
    const path = [start];
    if (startIdx === endIdx) {
      path.push(end);
      return path;
    }
    if (clockwise) {
      let idx = startIdx;
      while (true) {
        idx = (idx + 1) % poly.length;
        path.push(poly[idx]);
        if (idx === endIdx) break;
      }
    } else {
      let idx = startIdx;
      while (true) {
        idx = (idx - 1 + poly.length) % poly.length;
        path.push(poly[idx]);
        if (idx === endIdx) break;
      }
    }
    path.push(end);
    return path;
  }

  function getShortestBoundaryPath(poly, p1, p2) {
    const i1 = findClosestSegmentIndex(poly, p1);
    const i2 = findClosestSegmentIndex(poly, p2);
    const path1 = buildPath(poly, p1, p2, i1, i2, true);
    const path2 = buildPath(poly, p1, p2, i1, i2, false);
    return measurePathLength(path1) <= measurePathLength(path2) ? path1 : path2;
  }

  function measurePathLength(path) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return len;
  }

  measureBtn && measureBtn.addEventListener('click', () => {
    if (!boundaryFinal) return alert('Finalize boundary first.');
    measureMode = !measureMode;
    measurePoints = [];
    measurePath = [];
    distanceInput && (distanceInput.value = '');
    measureBox && (measureBox.style.display = measureMode ? 'block' : 'none');
    measureBtn && measureBtn.classList.toggle('active', measureMode);
    updateModeIndicator();  // 🟢 new
    redraw();
  });

  

  // ====== Reset handler ======
  resetBtn && resetBtn.addEventListener('click', () => {
    boundaryPoints = [];
    boundaryFinal = null;
    partitions = [];
    undoneStack = [];
    imgLoaded = false;
    showHeatmap = false; 
    heatmapCanvas = null;
    pan = { x: 0, y: 0 };
    scale = 1;
    measureMode = false;
    measurePoints = [];
    measurePath = [];
    measureBox && (measureBox.style.display = 'none');
    totalAreaSpan && (totalAreaSpan.textContent = '—');
    areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr><tr><td>P2</td><td>—</td></tr>`);
    distanceInput && (distanceInput.value = '');
    scaleMetersPerPixel = null;
    heatmapBtn && heatmapBtn.classList.remove('active');
    
    // Hide AI elements
    aiResultPanel.classList.add('hidden');
    aiScanner.classList.remove('scanning');
    
    redraw();
  });

  // ====== Customize toggle ======
  customizeBtn && customizeBtn.addEventListener('click', () => {
    if (!boundaryFinal || partitions.length === 0) return alert('Generate partitions first.');
    customizeMode = !customizeMode;
    customizeBtn.classList.toggle('active', customizeMode);
    // when leaving customize mode, stop any active dragging
    if (!customizeMode) {
      partitions.forEach(p => p.dragging = false);
      activePartition = null;
      activeHandle = null;
    }
    updateModeIndicator();  // 🟢 new
    redraw();
  });

  // ====== Keyboard shortcuts ======
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      drawMode = false;
      drawBtn && drawBtn.classList.remove('active');
      drawingPreview = false;
      redraw();
    }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      if (boundaryPoints.length) {
        undoneStack.push(boundaryPoints.pop());
        redraw();
      }
    }
  });

  // initial UI values
  areaTableBody && (areaTableBody.innerHTML = `<tr><td>P1</td><td>—</td></tr>`);

});