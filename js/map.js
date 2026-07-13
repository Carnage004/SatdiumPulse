/* ══════════════════════════════════════════════════════════════════
   StadiumPulse — js/map.js
   Handles SVG stadium map rendering, gate nodes updating, user positioning,
   proximity indicators, and zoom/pan gesture handlers.
   ══════════════════════════════════════════════════════════════════ */

// Map helper to bind Gate IDs to their indexed DOM elements
const gatePositions = {
  'Gate 1': 1,
  'Gate 2': 2,
  'Gate 3': 3,
  'Gate 4': 4,
  'Gate 5': 5,
};

/**
 * Updates the SVG map nodes dynamically with wait times and congestion fill colors.
 */
function renderMap() {
  if (!stadiumData || !stadiumData.gates) return;
  stadiumData.gates.forEach(gate => {
    const num = gatePositions[gate.id];
    const node = document.getElementById(`gateNode${num}`);
    if (!node) return;

    node.setAttribute('data-congestion', gate.congestion);
    node.setAttribute('data-gate', gate.id);

    const waitText = node.querySelector('.gate-wait');
    if (waitText) waitText.textContent = `${gate.wait_minutes}m`;
  });
}

/**
 * Highlights a gate on the SVG map and pops open its operational tooltip.
 */
function highlightGate(gateName) {
  document.querySelectorAll('.gate-node.highlighted').forEach(n => n.classList.remove('highlighted'));
  if (!gateName) {
    highlightedGate = null;
    return;
  }

  const num = gatePositions[gateName];
  if (!num) return;

  const node = document.getElementById(`gateNode${num}`);
  if (node) {
    node.classList.add('highlighted');
    highlightedGate = gateName;

    showMapTooltip(num, gateName);

    // Auto-clear highlight after 8 seconds
    setTimeout(() => {
      node.classList.remove('highlighted');
      hideMapTooltip();
    }, 8000);
  }
}

/**
 * Renders tooltip overlays for highlighted gates.
 */
function showMapTooltip(num, gateName) {
  const gate = stadiumData.gates.find(g => g.id === gateName);
  if (!gate) return;

  const tooltip = document.getElementById('mapTooltip');
  const bg      = document.getElementById('tooltipBg');
  const title   = document.getElementById('tooltipTitle');
  const wait    = document.getElementById('tooltipWait');
  const access  = document.getElementById('tooltipAccess');

  const offsets = {
    1: { x: 255, y: 30 },
    2: { x: 65,  y: 125 },
    3: { x: 300, y: 125 },
    4: { x: 95,  y: 275 },
    5: { x: 270, y: 275 }
  };

  const pos = offsets[num];
  if (!pos || !tooltip) return;

  title.setAttribute('x', pos.x);
  title.setAttribute('y', pos.y);
  title.textContent = gateName.toUpperCase();

  wait.setAttribute('x', pos.x);
  wait.setAttribute('y', pos.y + 14);
  wait.textContent = `Wait: ${gate.wait_minutes} min · ${gate.congestion.toUpperCase()}`;

  access.setAttribute('x', pos.x);
  access.setAttribute('y', pos.y + 27);
  access.textContent = gate.accessible ? '♿ Accessible' : '⚠️ No wheelchair access';

  bg.setAttribute('x', pos.x - 6);
  bg.setAttribute('y', pos.y - 14);
  bg.setAttribute('width', 155);
  bg.setAttribute('height', 46);

  tooltip.setAttribute('opacity', 1);
}

function hideMapTooltip() {
  const tooltip = document.getElementById('mapTooltip');
  if (tooltip) tooltip.setAttribute('opacity', 0);
}

/**
 * Handle direct map clicks on gate nodes to query info about them.
 */
function onGateClick(gateName) {
  const gate = stadiumData.gates.find(g => g.id === gateName);
  if (!gate) return;

  const msg = `Tell me about ${gateName}`;
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = msg;
    handleSubmit(new Event('submit', { cancelable: true }));
  }
}

/**
 * Calculates Euclidean local gate distances inside the stadium SVG coordinate system.
 */
function computeGateDistances() {
  gateDistances = {};
  if (fanLat === null || fanLng === null) return;
  if (!isFanOnSite()) return; 

  const userSvg = geoToSvg(fanLat, fanLng);

  stadiumData.gates.forEach(gate => {
    const coords = SVG_GATE_COORDS[gate.id];
    if (coords) {
      const dx = userSvg.x - coords.x;
      const dy = userSvg.y - coords.y;
      gateDistances[gate.id] = Math.round(Math.sqrt(dx * dx + dy * dy));
    }
  });
}

/**
 * Draws a route highlight line from a section center to its nearest gate.
 * When clearing (sectionId is null/falsy), fully resets geometry and hides
 * the element with display:none so stale coordinates can never cause reflow flicker.
 *
 * ⚠️ IMPORTANT: This MUST be the ONLY place that draws route highlights or adds
 * the .highlighted class to .section-zone / .section-label elements.
 * clearSectionHighlight() MUST always run before a new draw — it does so
 * internally by removing all .highlighted classes at the top of this function.
 * Do NOT call highlightSection() separately before calling this — it would
 * redundantly add .highlighted classes causing stale arcs to stack visually.
 */
function drawRouteHighlight(sectionId) {
  // Always clear ALL highlighted section labels and gate nodes first
  document.querySelectorAll('.section-label.highlighted').forEach(el => el.classList.remove('highlighted'));
  document.querySelectorAll('.gate-node.highlighted').forEach(n => n.classList.remove('highlighted'));
  hideMapTooltip();

  const line = document.getElementById('routeHighlight');

  if (!sectionId) {
    // Full reset: null out state, zero geometry, hide completely
    currentRouteHighlight = null;
    if (line) {
      line.setAttribute('x1', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('x2', '0');
      line.setAttribute('y2', '0');
      line.setAttribute('opacity', '0');
      line.style.display = 'none';
    }
    return;
  }

  const layout = VENUE_LAYOUTS.metlife.sections[sectionId];
  if (!layout) {
    // Invalid section — treat as a clear
    currentRouteHighlight = null;
    if (line) {
      line.setAttribute('x1', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('x2', '0');
      line.setAttribute('y2', '0');
      line.setAttribute('opacity', '0');
      line.style.display = 'none';
    }
    return;
  }

  // Set state
  currentRouteHighlight = sectionId;

  // Highlight the matching section text label
  document.querySelectorAll('.section-label').forEach(el => {
    if (el.textContent.includes(sectionId)) el.classList.add('highlighted');
  });

  // Position and show the route line
  const gateCoords = SVG_GATE_COORDS[layout.nearestGate];
  if (line && gateCoords) {
    line.setAttribute('x1', gateCoords.x);
    line.setAttribute('y1', gateCoords.y);
    line.setAttribute('x2', layout.center.x);
    line.setAttribute('y2', layout.center.y);
    line.style.display = '';
    line.setAttribute('opacity', '0.85');
  }
}

/**
 * Scans the computed gateDistances values to identify the nearest gate.
 */
function getClosestGate(accessibleOnly = false) {
  const candidates = stadiumData.gates.filter(g =>
    gateDistances[g.id] !== undefined &&
    (!accessibleOnly || g.accessible)
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, g) =>
    gateDistances[g.id] < gateDistances[best.id] ? g : best
  );
}

/**
 * Positions the fan location dot on the SVG map. Bypasses real coordinates if user is remote.
 */
function updateUserDotOnMap() {
  if (fanLat === null || fanLng === null) return;

  const dot = document.getElementById('userLocationDot');
  const proxLabel = document.getElementById('proximityLabel');

  if (!isFanOnSite()) {
    if (dot) dot.setAttribute('opacity', 0);
    if (proxLabel) proxLabel.setAttribute('opacity', 0);
    setLocationStatus('fallback', 'Remote — Enable Simulate Location to test gate distances');
    return;
  }

  const { x, y } = geoToSvg(fanLat, fanLng);
  const cx = Math.max(15, Math.min(465, x));
  const cy = Math.max(15, Math.min(365, y));

  if (dot) {
    dot.setAttribute('transform', `translate(${cx},${cy})`);
    dot.setAttribute('opacity', 1);
  }

  const label = document.getElementById('userDotLabel');
  if (label) {
    if (fanAccuracy && !isSimMode) {
      label.textContent = `📍 You (±${Math.round(fanAccuracy)}m)`;
    } else if (isSimMode) {
      label.textContent = '📍 Sim';
    } else {
      label.textContent = '📍 You';
    }
  }

  updateProximityLabel();
}

/**
 * Draws proximity lines and text labels near the closest gate.
 */
function updateProximityLabel() {
  const closest = getClosestGate();
  if (!closest || gateDistances[closest.id] === undefined) return;

  const dist = gateDistances[closest.id];
  const num  = gatePositions[closest.id];

  const gp = SVG_GATE_COORDS[closest.id];
  if (!gp) return;

  const text = `↑ You are ${dist}m from ${closest.id}`;

  const proxLabel = document.getElementById('proximityLabel');
  const proxText  = document.getElementById('proxText');
  const proxBg    = document.getElementById('proxBg');

  if (proxText) proxText.textContent = text;
  
  const tw = text.length * 5.5;
  const th = 16;
  const pad = 6;

  let lx = gp.x - tw / 2 - pad;
  let ly = gp.y - 38;

  lx = Math.max(4, Math.min(480 - tw - pad * 2 - 4, lx));
  ly = Math.max(4, ly);

  if (proxBg) {
    proxBg.setAttribute('x', lx);
    proxBg.setAttribute('y', ly);
    proxBg.setAttribute('width',  tw + pad * 2);
    proxBg.setAttribute('height', th + pad * 0.5);
  }

  if (proxText) {
    proxText.setAttribute('x', lx + pad);
    proxText.setAttribute('y', ly + th - 3);
  }

  if (proxLabel) proxLabel.setAttribute('opacity', 1);
}

// ══════════════════════════════════════════════════════════════════
//  Map Zoom & Pan Controller Transform Bindings
// ══════════════════════════════════════════════════════════════════

function applyMapTransform() {
  const viewport = document.getElementById('mapViewport');
  if (viewport) {
    viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
  }
}

function boundPan() {
  const minX = 480 * (1 - zoomScale) - 50;
  const maxX = 50;
  const minY = 380 * (1 - zoomScale) - 50;
  const maxY = 50;
  panX = Math.max(minX, Math.min(maxX, panX));
  panY = Math.max(minY, Math.min(maxY, panY));
}

function zoomInMap() {
  adjustZoom(1.2);
}

function zoomOutMap() {
  adjustZoom(1 / 1.2);
}

function adjustZoom(factor) {
  const nextZoom = Math.max(1.0, Math.min(4.0, zoomScale * factor));
  const svgX = 240;
  const svgY = 190;
  
  panX = svgX - ((svgX - panX) / zoomScale) * nextZoom;
  panY = svgY - ((svgY - panY) / zoomScale) * nextZoom;
  zoomScale = nextZoom;
  
  boundPan();
  applyMapTransform();
}

function resetMapZoom() {
  zoomScale = 1.0;
  panX = 0;
  panY = 0;
  applyMapTransform();
}

/**
 * Initializes gesture listeners (drag-pan, wheel scroll, pinch zoom) on the SVG element.
 */
function initMapZoomPan() {
  const svg = document.getElementById('stadiumMap');
  if (!svg) return;

  const startDrag = (clientX, clientY) => {
    isPanning = true;
    panStartX = clientX - panX;
    panStartY = clientY - panY;
    startDragX = clientX;
    startDragY = clientY;
    hasDragged = false;
  };

  const moveDrag = (clientX, clientY, event) => {
    if (!isPanning) return;
    
    if (event && event.cancelable) {
      event.preventDefault();
    }

    const dx = clientX - startDragX;
    const dy = clientY - startDragY;
    if (Math.sqrt(dx*dx + dy*dy) > 5) {
      hasDragged = true;
    }

    panX = clientX - panStartX;
    panY = clientY - panStartY;
    
    boundPan();
    applyMapTransform();
  };

  const endDrag = () => {
    isPanning = false;
  };

  svg.addEventListener('mousedown', (e) => {
    if (e.button === 0) startDrag(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    moveDrag(e.clientX, e.clientY, e);
  });

  window.addEventListener('mouseup', () => {
    endDrag();
  });

  let startTouchDist = 0;
  let startTouchZoom = 1.0;

  svg.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      isPanning = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      startTouchDist = Math.sqrt((t1.clientX - t2.clientX)**2 + (t1.clientY - t2.clientY)**2);
      startTouchZoom = zoomScale;
    }
  }, { passive: false });

  svg.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY, e);
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.sqrt((t1.clientX - t2.clientX)**2 + (t1.clientY - t2.clientY)**2);
      
      const factor = dist / startTouchDist;
      const nextZoom = Math.max(1.0, Math.min(4.0, startTouchZoom * factor));
      
      const rect = svg.getBoundingClientRect();
      const midX = ((t1.clientX + t2.clientX) / 2) - rect.left;
      const midY = ((t1.clientY + t2.clientY) / 2) - rect.top;
      
      const svgX = (midX * (480 / rect.width) - panX) / zoomScale;
      const svgY = (midY * (380 / rect.height) - panY) / zoomScale;
      
      zoomScale = nextZoom;
      panX = midX * (480 / rect.width) - svgX * zoomScale;
      panY = midY * (380 / rect.height) - svgY * zoomScale;
      
      boundPan();
      applyMapTransform();
    }
  }, { passive: false });

  svg.addEventListener('touchend', () => {
    endDrag();
  });

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let nextZoom = zoomScale;
    if (e.deltaY < 0) {
      nextZoom = Math.min(4.0, zoomScale * zoomFactor);
    } else {
      nextZoom = Math.max(1.0, zoomScale / zoomFactor);
    }
    
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const svgX = (mouseX * (480 / rect.width) - panX) / zoomScale;
    const svgY = (mouseY * (380 / rect.height) - panY) / zoomScale;
    
    zoomScale = nextZoom;
    panX = mouseX * (480 / rect.width) - svgX * zoomScale;
    panY = mouseY * (380 / rect.height) - svgY * zoomScale;
    
    boundPan();
    applyMapTransform();
  }, { passive: false });
}
