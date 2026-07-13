/* ══════════════════════════════════════════════════════════════════
   StadiumPulse — js/main.js
   Bootstraps the application, coordinates geolocation watches, countdowns,
   simulations, seating section lookup, manual overrides, and tab views.
   ══════════════════════════════════════════════════════════════════ */

/**
 * Main application bootstrapper. Pre-loads match fixtures, geolocates,
 * and initializes map structures and welcome feeds.
 */
async function init() {
  const loadingStatus = document.getElementById('loadingStatus');
  if (loadingStatus) loadingStatus.textContent = "Locating live match stadium...";

  try {
    const res = await fetch('stadium.json');
    stadiumData = await res.json();
    kickoffMinutes = stadiumData.match.kickoff_in_minutes;
  } catch (e) {
    console.warn('Could not load stadium.json, using embedded fallback data');
    stadiumData = getEmbeddedData();
    kickoffMinutes = 42;
  }

  await loadStadiumsData();
  populateStadiumSelect();

  let targetMatch = null;
  let targetVenue = null;
  let statusMessage = "";

  if (venueMatches && venueStadiums) {
    const now = Date.now();
    const DURATION_MS = MATCH_DURATION_MIN * 60 * 1000;

    let live = venueMatches.find(m => {
      const ko = new Date(m.kickoff_utc).getTime();
      return now >= ko && now < ko + DURATION_MS;
    });

    let upcoming = null;
    if (!live) {
      upcoming = venueMatches
        .filter(m => new Date(m.kickoff_utc).getTime() > now)
        .sort((a,b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))[0] || null;
    }

    targetMatch = live || upcoming;
    if (targetMatch) {
      targetVenue = venueStadiums.find(s => s.id === targetMatch.stadium_id);
      if (live) {
        statusMessage = `⚽ Live Now: ${targetMatch.teams} at ${targetMatch.stadium_name}`;
      } else {
        statusMessage = `📅 Next match: ${targetMatch.teams} at ${targetMatch.stadium_name}`;
      }
    } else {
      targetVenue = venueStadiums.find(s => s.id === 'metlife') || venueStadiums[0];
      statusMessage = `Showing ${targetVenue.name} — no live matches right now.`;
    }
  } else {
    statusMessage = "Showing MetLife Stadium — no live matches right now.";
  }

  if (targetVenue) {
    applyStadiumContext(targetVenue, targetMatch);
  }

  enforceGateBaseline();
  initGateAlertStates();

  if (loadingStatus) loadingStatus.textContent = statusMessage;

  await delay(1500);

  const loader = document.getElementById('loadingScreen');
  if (loader) loader.classList.add('fade-out');

  renderMap();
  renderHeader();
  startCountdown();
  startLiveSimulation();
  initGeolocation();          
  initMapZoomPan();           
  showWelcomeMessage();
  renderOpsView();

}

/**
 * Loads metadata index of host stadiums and dates from stadiums.json.
 */
async function loadStadiumsData() {
  try {
    const res = await fetch('stadiums.json');
    const data = await res.json();
    venueStadiums = data.stadiums;
    venueMatches  = data.matches;
  } catch (e) {
    console.warn('Could not load stadiums.json:', e.message);
  }
}

/**
 * Shifts stadium focus (translating gate coordinates, resetting countdowns).
 */
function applyStadiumContext(stadium, match) {
  if (!stadiumData) return;

  currentVenue = stadium;
  updateVenueBadge(stadium);

  const select = document.getElementById('stadiumSelect');
  if (select) {
    select.value = stadium.id;
  }

  stadiumData.match.stadium = stadium.name;

  if (match) {
    stadiumData.match.teams = match.teams;
    const now = Date.now();
    const ko  = new Date(match.kickoff_utc).getTime();
    kickoffMinutes = Math.round((ko - now) / 60000);
    stadiumData.match.kickoff_in_minutes = kickoffMinutes;
  } else {
    stadiumData.match.teams = "Argentina vs Croatia";
    kickoffMinutes = 42;
    stadiumData.match.kickoff_in_minutes = 42;
  }

  stadiumData.gates.forEach(gate => {
    const offset = GATE_OFFSETS.find(o => o.id === gate.id);
    if (offset) {
      gate.lat = stadium.lat + offset.dLat;
      gate.lng = stadium.lng + offset.dLng;
    }
  });

  if (fanLat !== null && fanLng !== null) {
    computeGateDistances();
    updateUserDotOnMap();
  }

  const mapTitle = document.getElementById('mapTitle');
  if (mapTitle) {
    mapTitle.textContent = stadium.name;
  }

  enforceGateBaseline();
  drawRouteHighlight(null);
  updateProactiveRecommendations();
}

function populateStadiumSelect() {
  const select = document.getElementById('stadiumSelect');
  if (!select || !venueStadiums) return;
  select.innerHTML = '';
  venueStadiums.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.city})`;
    select.appendChild(opt);
  });
}

function handleManualStadiumSelect(stadiumId) {
  if (!venueStadiums) return;
  const target = venueStadiums.find(s => s.id === stadiumId);
  if (target) {
    applyStadiumContext(target, findActiveMatchForStadium(target.id));
    renderMap();
    renderHeader();
    renderOpsView();
    detectLiveMatch();
    addMessage('ai', `🏟️ Switched stadium view to **${target.name}**.`);
  }
}

/**
 * Haversine scan verifying if user's real GPS is within 500m of a tracked WC venue.
 */
function identifyNearestStadium() {
  if (!venueStadiums || fanLat === null || fanLng === null) return;

  const RADIUS_M = 500; 
  let nearest = null;
  let nearestDist = Infinity;

  venueStadiums.forEach(s => {
    const d = haversineMetres(fanLat, fanLng, s.lat, s.lng);
    if (d < RADIUS_M && d < nearestDist) {
      nearestDist = d;
      nearest = s;
    }
  });

  if (nearest && nearest.id !== currentVenue?.id) {
    applyStadiumContext(nearest, findActiveMatchForStadium(nearest.id));
    renderMap();
    renderHeader();
    renderOpsView();
    detectLiveMatch();
    addMessage('ai', `🏟️ GPS located you at **${nearest.name}**! Switched stadium context.`);
  } else if (!nearest && currentVenue === null) {
    updateVenueBadge(null);
  }
}

function updateVenueBadge(venue) {
  const badge = document.getElementById('venueBadge');
  const text  = document.getElementById('venueBadgeText');
  if (!badge) return;

  if (venue) {
    text.textContent = venue.name;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function detectLiveMatch() {
  if (!venueMatches) return;

  const now = Date.now();
  const DURATION_MS = MATCH_DURATION_MIN * 60 * 1000;

  let live = venueMatches.find(m => {
    const ko = new Date(m.kickoff_utc).getTime();
    return now >= ko && now < ko + DURATION_MS;
  });

  let upcoming = null;
  if (!live) {
    upcoming = venueMatches
      .filter(m => new Date(m.kickoff_utc).getTime() > now)
      .sort((a,b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))[0] || null;
  }

  liveMatchData = live || upcoming || null;
  renderLiveMatchCard();
}

/**
 * Updates match clock timelines, distance-to-match counts, or airflight estimators.
 */
function renderLiveMatchCard() {
  const card = document.getElementById('liveMatchCard');
  if (!card || !liveMatchData) {
    if (card) card.classList.add('hidden');
    return;
  }

  const m = liveMatchData;
  const now = Date.now();
  const ko  = new Date(m.kickoff_utc).getTime();
  const isLive = now >= ko && now < ko + MATCH_DURATION_MIN * 60_000;

  let clockText = '';
  if (isLive) {
    const elapsedMin = Math.floor((now - ko) / 60_000);
    clockText = `⏱ ${elapsedMin}' elapsed`;
  } else {
    const diffMs = ko - now;
    const diffH  = Math.floor(diffMs / 3_600_000);
    const diffM  = Math.floor((diffMs % 3_600_000) / 60_000);
    const diffD  = Math.floor(diffH / 24);
    if (diffD > 0) clockText = `In ${diffD}d ${diffH % 24}h`;
    else if (diffH > 0) clockText = `In ${diffH}h ${diffM}m`;
    else clockText = `In ${diffM}m`;
  }

  let distText   = '–';
  let flightText = '';
  if (fanLat !== null && fanLng !== null) {
    const distKm = haversineMetres(fanLat, fanLng, m.lat, m.lng) / 1000;
    if (distKm < 1) {
      distText = `📍 ${Math.round(distKm * 1000)}m away`;
    } else {
      distText   = `📍 ${Math.round(distKm).toLocaleString()} km away`;
      const flightH = Math.round(distKm / 800);
      if (flightH > 0) flightText = `~${flightH}h ✈️ by air`;
    }
  }

  const statusEl = document.getElementById('lmcStatus');
  if (statusEl) {
    statusEl.textContent  = isLive ? 'LIVE NOW' : 'NEXT';
    statusEl.className    = `lmc-status ${isLive ? 'live' : 'next'}`;
  }
  
  const teamsEl = document.getElementById('lmcTeams');
  if (teamsEl) teamsEl.textContent = m.teams;

  const metaEl = document.getElementById('lmcMeta');
  if (metaEl) metaEl.textContent = `${m.stage} · ${m.stadium_name}, ${m.city}`;

  const distEl = document.getElementById('lmcDistance');
  if (distEl) distEl.textContent = distText;

  const flightEl = document.getElementById('lmcFlight');
  if (flightEl) flightEl.textContent = flightText;

  const clockEl = document.getElementById('lmcClock');
  if (clockEl) clockEl.textContent = clockText;

  card.classList.remove('hidden', 'is-live', 'is-next');
  card.classList.add(isLive ? 'is-live' : 'is-next');
}

function updateCountdownDisplay() {
  const el = document.getElementById('countdown');
  if (!el) return;
  if (kickoffMinutes <= 0) {
    el.textContent = '⚽ IN PROGRESS';
    el.style.color = 'var(--green-low)';
  } else {
    const h = Math.floor(kickoffMinutes / 60);
    const m = kickoffMinutes % 60;
    el.textContent = h > 0
      ? `KO in ${h}h ${String(m).padStart(2,'0')}m`
      : `KO in ${m}m`;
  }
}

function startCountdown() {
  setInterval(() => {
    if (kickoffMinutes > 0) kickoffMinutes--;
    updateCountdownDisplay();
  }, 60_000);
}

function startLiveSimulation() {
  setInterval(() => {
    nudgeCongestion();
    renderMap();
    detectLiveMatch();           
    checkProactiveAlerts();      
    if (activeTab === 'ops') renderOpsView();
  }, 30_000);
}

function nudgeCongestion() {
  enforceGateBaseline();
  if (!isGateCongestionActive()) return; 

  const levels = ['low', 'medium', 'high'];
  const waitRanges = { low: [1, 5], medium: [6, 12], high: [14, 25] };

  const idx  = Math.floor(Math.random() * stadiumData.gates.length);
  const gate = stadiumData.gates[idx];

  const curIdx = levels.indexOf(gate.congestion);
  const delta  = Math.random() < 0.5 ? -1 : 1;
  const newIdx = Math.max(0, Math.min(2, curIdx + delta));

  gate.congestion = levels[newIdx];
  const [lo, hi] = waitRanges[gate.congestion];
  gate.wait_minutes = Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Searches for seating section routes, updating DOM highlights and scroll focus.
 * IMPORTANT: drawRouteHighlight() is the single authority for all route/section
 * visual state on the map. Do NOT call highlightSection() separately — it would
 * redundantly add .highlighted classes that drawRouteHighlight manages internally.
 * clearSectionHighlight() must always run before a new draw (it does, via
 * drawRouteHighlight(null) being called inside it).
 */
function findMySection(input) {
  const raw = (input || '').trim().replace(/^sec(tion)?\s*/i, '');
  if (!raw) return;

  const canonical = getCanonicalSection(raw);
  if (!canonical) {
    showSeatResult(`❓ Section <strong>${raw}</strong> isn’t in the layout data. Try 108, 120, 214, or 340.`, false);
    clearSectionHighlight();
    return;
  }

  const layout  = VENUE_LAYOUTS.metlife.sections[canonical];
  const gate    = stadiumData.gates.find(g => g.id === layout.nearestGate);
  const waitStr = gate ? `${gate.wait_minutes} min wait` : '';
  const congStr = gate ? ` · ${gate.congestion} congestion` : '';
  const accStr  = gate?.accessible ? ' ♿ accessible' : '';

  const enteredNum = parseInt(raw, 10);
  const isExact    = String(enteredNum) === canonical;
  const noteStr    = isExact ? '' : ` (nearest to Sec ${enteredNum}):`;

  drawRouteHighlight(canonical);
  highlightGate(layout.nearestGate);

  showSeatResult(
    `🎟 Section <strong>${canonical}</strong>${noteStr} → Enter via <strong>${layout.nearestGate}</strong> · ${waitStr}${congStr}${accStr}`,
    true
  );

  targetSection = { section: canonical, nearestGate: layout.nearestGate, level: layout.level, side: layout.side };

  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.placeholder = `Ask about Section ${canonical} or StadiumPulse…`;
    chatInput.focus();
  }
}

function showSeatResult(html, visible) {
  const el = document.getElementById('seatResult');
  if (!el) return;
  el.innerHTML = html;
  if (visible) el.classList.remove('hidden');
  else         el.classList.add('hidden');
}

function clearSectionHighlight() {
  document.querySelectorAll('.section-label').forEach(el => el.classList.remove('highlighted'));
  targetSection = null;
  drawRouteHighlight(null);
}

function highlightSection(sectionId) {
  clearSectionHighlight();
  
  document.querySelectorAll('.section-label').forEach(el => {
    if (el.textContent.includes(sectionId)) el.classList.add('highlighted');
  });
}

function onSectionClick(sectionId) {
  if (isSimMode) return; 
  const input = document.getElementById('seatInput');
  if (input) input.value = sectionId;
  findMySection(sectionId);

  const result = document.getElementById('seatResult');
  if (result) result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function geocodeCity(input) {
  if (!input) return null;
  const key = input.toLowerCase().trim();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  const partialKey = Object.keys(CITY_COORDS).find(k => k.includes(key) || key.includes(k));
  return partialKey ? CITY_COORDS[partialKey] : null;
}

function handleCitySubmit() {
  const inputEl = document.getElementById('cityInput');
  if (!inputEl) return;
  const input = inputEl.value.trim();
  if (!input) return;

  const coords = geocodeCity(input);
  if (!coords) {
    inputEl.style.borderColor = 'hsl(0,86%,60%)';
    setTimeout(() => inputEl.style.borderColor = '', 2000);
    addMessage('ai', `❓ I couldn’t find "${input}" in my city database. Try a major city name like "London", "Tokyo", or "Buenos Aires".`);
    return;
  }

  const [lat, lng] = coords;
  applyFanPosition(lat, lng, null);

  const panel = document.getElementById('cityInputPanel');
  if (panel) panel.classList.add('hidden');
  
  setLocationStatus('simulate', `City: ${input}`);
  detectLiveMatch();

  if (liveMatchData) {
    const distKm = haversineMetres(lat, lng, liveMatchData.lat, liveMatchData.lng) / 1000;
    addMessage('ai', `📍 Location set to **${input}**. You’re **${Math.round(distKm).toLocaleString()} km** from the ${liveMatchData.teams} match at ${liveMatchData.stadium_name}. ${Math.round(distKm/800) > 0 ? `That’s ~${Math.round(distKm/800)} hours by air. ✈️` : ''}`);
  } else {
    addMessage('ai', `📍 Location set to **${input}**. Ask me about the nearest match or gate info!`);
  }
}

function dismissLocationBanner() {
  const banner = document.getElementById('locationBanner');
  if (banner) banner.classList.add('hidden');
}

function setLocationStatus(state, text) {
  const dot  = document.getElementById('locationStatusDot');
  const span = document.getElementById('locationStatusText');
  if (dot) dot.className = `location-status-dot ${state}`;
  if (span) span.textContent = text;
}

function showFallbackBanner(message) {
  const banner = document.getElementById('locationBanner');
  const textEl = document.getElementById('locationBannerText');
  if (textEl) textEl.textContent = message;
  if (banner) banner.classList.remove('hidden');
}

/**
 * Geolocation watchPosition initializer.
 */
function initGeolocation() {
  if (!navigator.geolocation) {
    useFallbackLocation('GPS not supported on this browser.');
    return;
  }

  setLocationStatus('acquiring', 'Acquiring GPS…');

  geoWatchId = navigator.geolocation.watchPosition(
    (position) => {
      if (isSimMode) return; 
      isGpsFallback = false;
      applyFanPosition(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy
      );
      setLocationStatus('live', `GPS live (±${Math.round(position.coords.accuracy)}m)`);
    },
    (error) => {
      if (isSimMode) return;
      let reason = 'Location unavailable.';
      if (error.code === error.PERMISSION_DENIED) {
        reason = 'Location access denied by user.';
      } else if (error.code === error.TIMEOUT) {
        reason = 'GPS signal timed out.';
      }
      useFallbackLocation(reason);
    },
    {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 5_000,
    }
  );
}

function useFallbackLocation(reason) {
  if (isSimMode) return;
  isGpsFallback = true;
  applyFanPosition(FALLBACK_LAT, FALLBACK_LNG, null);
  setLocationStatus('fallback', 'Approx. location');
  showFallbackBanner(`Using approximate location — ${reason.replace(/\.?$/, '')}. Enable GPS for live tracking.`);
  const panel = document.getElementById('cityInputPanel');
  if (panel) panel.classList.remove('hidden');
}

function toggleSimMode() {
  isSimMode = !isSimMode;
  const btn = document.getElementById('simToggle');
  const svg = document.getElementById('stadiumMap');

  if (isSimMode) {
    if (btn) btn.classList.add('active');
    if (svg) svg.classList.add('sim-mode');
    setLocationStatus('simulate', 'Sim mode — click map');
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
    addMessage('ai', '🗺️ **Simulate Location** is ON. Click anywhere on the stadium map to drop a pin and set your position. StadiumPulse will use that location for distance-aware answers!');
  } else {
    if (btn) btn.classList.remove('active');
    if (svg) svg.classList.remove('sim-mode');
    initGeolocation();
    addMessage('ai', '📱 Simulate Location is OFF. Returning to real GPS tracking.');
  }
}

function renderHeader() {
  const teams = document.getElementById('matchTeams');
  const weather = document.getElementById('weather');
  if (teams) teams.textContent = stadiumData.match.teams;
  if (weather) weather.textContent = stadiumData.match.weather;
  updateCountdownDisplay();
}

function showWelcomeMessage() {
  const bestGate = [...stadiumData.gates].sort((a,b) => a.wait_minutes - b.wait_minutes)[0];
  addMessage('ai', `👋 Welcome to **${stadiumData.match.stadium}**! I'm StadiumPulse, your AI concierge for today's match.\n\n⚽ **${stadiumData.match.teams}** kicks off in **${kickoffMinutes} minutes**. Right now, **${bestGate.id}** has the shortest wait (${bestGate.wait_minutes} min). Ask me anything — in any language!`);
}

function switchTab(tab) {
  activeTab = tab;

  document.getElementById('fanView').classList.toggle('hidden', tab !== 'fan');
  document.getElementById('opsView').classList.toggle('hidden', tab !== 'ops');
  document.getElementById('tabFan').classList.toggle('active', tab === 'fan');
  document.getElementById('tabOps').classList.toggle('active', tab === 'ops');

  if (tab === 'ops') {
    renderOpsView();
    generateOpsBriefing();
  }
}

/**
 * Sets the fan's current coordinates and accuracy, and triggers map & recommended updates.
 */
function applyFanPosition(lat, lng, accuracy) {
  fanLat = lat;
  fanLng = lng;
  fanAccuracy = accuracy;

  computeGateDistances();
  updateUserDotOnMap();
  updateProactiveRecommendations();
}

/**
 * Handle SVG map clicks to drop a simulation pin when Simulate Location is ON.
 */
function onMapClick(event) {
  if (!isSimMode) return;

  const svg = document.getElementById('stadiumMap');
  if (!svg) return;

  const rect = svg.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const svgX = (mouseX * (480 / rect.width) - panX) / zoomScale;
  const svgY = (mouseY * (380 / rect.height) - panY) / zoomScale;

  const coords = svgToGeo(svgX, svgY);
  applyFanPosition(coords.lat, coords.lng, null);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('gate-node')) {
    const gateName = e.target.getAttribute('data-gate');
    if (gateName) onGateClick(gateName);
  }
});

// Boot the application on script load
init();
