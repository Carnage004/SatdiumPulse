/* ══════════════════════════════════════════════════════════════════
   StadiumPulse — js/utils.js
   Utility functions (Haversine formula, GPS-to-SVG coordinate
   conversions, helpers, and baseline gate rules).
   ══════════════════════════════════════════════════════════════════ */

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula. Used for global flight and distance metrics.
 */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const EARTH_RADIUS_METRES = 6371000;
  const toRad = degrees => degrees * Math.PI / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(a));
}

/**
 * Projects a geographic GPS lat/lng coordinate onto our 2D SVG stadium map viewBox coordinates.
 * Relies on the standard scale computed between two known physical coordinate pairs.
 */
function geoToSvg(lat, lng) {
  const { lat1, lng1, svgX1, svgY1, lat2, lng2, svgX2, svgY2 } = GEO_REF;
  
  const latScale = (svgY2 - svgY1) / (lat2 - lat1);
  const lngScale = (svgX2 - svgX1) / (lng2 - lng1);
  
  const svgX = svgX1 + (lng - lng1) * lngScale;
  const svgY = svgY1 + (lat - lat1) * latScale;
  
  return { x: svgX, y: svgY };
}

/**
 * Projects 2D SVG map coordinates back onto geographic GPS lat/lng coordinates.
 */
function svgToGeo(x, y) {
  const { lat1, lng1, svgX1, svgY1, lat2, lng2, svgX2, svgY2 } = GEO_REF;
  
  const latScale = (svgY2 - svgY1) / (lat2 - lat1);
  const lngScale = (svgX2 - svgX1) / (lng2 - lng1);
  
  const lng = lng1 + (x - svgX1) / lngScale;
  const lat = lat1 + (y - svgY1) / latScale;
  
  return { lat, lng };
}

/**
 * Returns a promise that resolves after the specified milliseconds.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanity check to determine if the fan is physically within a 500m radius of the stadium
 * so that we don't display raw GPS coordinates on the local map if they are remote.
 */
function isFanOnSite() {
  if (fanLat === null || fanLng === null || !currentVenue) return false;
  if (isSimMode) return true;
  
  const distToVenue = haversineMetres(fanLat, fanLng, currentVenue.lat, currentVenue.lng);
  return distToVenue <= 500;
}

/**
 * Maps any arbitrary 3-digit seating section number to the closest defined schematic segment.
 */
function getCanonicalSection(input) {
  const n = parseInt(input, 10);
  if (isNaN(n) || n < 100 || n > 399) return null;

  const layout = VENUE_LAYOUTS.metlife.sections;
  const sectionNums = Object.keys(layout).map(Number);
  
  return String(sectionNums.reduce((prev, curr) =>
    Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev
  ));
}

/**
 * Searches the match schedule database for a currently active or soonest upcoming match for a stadium.
 */
function findActiveMatchForStadium(stadiumId) {
  if (!venueMatches) return null;
  const now = Date.now();
  const DURATION_MS = MATCH_DURATION_MIN * 60 * 1000;
  
  // Find a match currently live
  let live = venueMatches.find(m => 
    m.stadium_id === stadiumId && 
    now >= new Date(m.kickoff_utc).getTime() && 
    now < new Date(m.kickoff_utc).getTime() + DURATION_MS
  );
  if (live) return live;
  
  // Or find the next upcoming match
  let upcoming = venueMatches
    .filter(m => m.stadium_id === stadiumId && new Date(m.kickoff_utc).getTime() > now)
    .sort((a,b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))[0] || null;
    
  return upcoming;
}

/**
 * Determines whether simulated gate congestion ticks should fluctuate.
 * Simulation is only active within the 3-hour pre-match window until the match concludes.
 */
function isGateCongestionActive() {
  return kickoffMinutes <= PRE_MATCH_CONGESTION_WINDOW_MIN && kickoffMinutes >= -MATCH_DURATION_MIN;
}

/**
 * Resets gate congestion to low and displays the gates opening status message 
 * when outside of the active pre-match window.
 */
function enforceGateBaseline() {
  const noteEl = document.getElementById('gatesStatusNote');
  if (!isGateCongestionActive()) {
    if (stadiumData && stadiumData.gates) {
      stadiumData.gates.forEach(g => {
        g.congestion = 'low';
        g.wait_minutes = 2;
      });
    }
    if (noteEl) {
      noteEl.textContent = "Gates open 3 hours before kickoff";
      noteEl.classList.remove('hidden');
    }
  } else {
    if (noteEl) {
      noteEl.classList.add('hidden');
    }
  }
}
