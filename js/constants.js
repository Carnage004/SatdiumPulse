/* ══════════════════════════════════════════════════════════════════
   StadiumPulse — js/constants.js
   Holds the static configuration, system prompts, static maps, and 
   global variables shared across modules.
   ══════════════════════════════════════════════════════════════════ */


// Match configuration parameters
const MATCH_DURATION_MIN = 105;
const PRE_MATCH_CONGESTION_WINDOW_MIN = 180; // 3 hours before kickoff

// Default GPS coordinates when real GPS coordinates are inaccessible
const FALLBACK_LAT = 40.8135;
const FALLBACK_LNG = -74.0745;

// Base gate offsets relative to MetLife centroid (40.8135, -74.0745)
const GATE_OFFSETS = [
  { id: "Gate 1", dLat: 0.0013, dLng: 0.0 },
  { id: "Gate 2", dLat: 0.0,    dLng: -0.0023 },
  { id: "Gate 3", dLat: 0.0,    dLng: 0.0023 },
  { id: "Gate 4", dLat: -0.0015,dLng: -0.0015 },
  { id: "Gate 5", dLat: -0.0015,dLng: 0.0017 }
];

// Reference coordinates for converting geographic GPS to map SVG coordinates
const GEO_REF = {
  lat1: 40.8148, lng1: -74.0745, svgX1: 240, svgY1: 42,
  lat2: 40.8120, lng2: -74.0760, svgX2: 80,  svgY2: 290,
};

// Fixed SVG map coordinates for gates G1-G5
const SVG_GATE_COORDS = {
  'Gate 1': { x: 240, y: 42 },
  'Gate 2': { x: 50,  y: 140 },
  'Gate 3': { x: 430, y: 140 },
  'Gate 4': { x: 80,  y: 290 },
  'Gate 5': { x: 400, y: 290 }
};

// Layout mapping to calculate internal directions and gates
const VENUE_LAYOUTS = {
  metlife: {
    sections: {
      '214': { svgId: 'section214', center: { x: 133, y: 110 }, nearestGate: 'Gate 2', level: 'Upper', side: 'West' },
      '120': { svgId: 'section120', center: { x: 347, y: 110 }, nearestGate: 'Gate 3', level: 'Upper', side: 'East' },
      '108': { svgId: 'section108', center: { x: 133, y: 278 }, nearestGate: 'Gate 4', level: 'Lower', side: 'West' },
      '340': { svgId: 'section340', center: { x: 347, y: 278 }, nearestGate: 'Gate 5', level: 'Upper', side: 'East' },
    }
  }
};

// Coordinate database for Manual City Input geocoding
const CITY_COORDS = {
  // USA
  'new york': [40.7128, -74.0060], 'new york city': [40.7128, -74.0060], 'nyc': [40.7128, -74.0060],
  'los angeles': [34.0522, -118.2437], 'la': [34.0522, -118.2437],
  'chicago': [41.8781, -87.6298], 'houston': [29.7604, -95.3698],
  'phoenix': [33.4484, -112.0740], 'philadelphia': [39.9526, -75.1652],
  'san antonio': [29.4241, -98.4936], 'san diego': [32.7157, -117.1611],
  'dallas': [32.7767, -96.7970], 'san jose': [37.3382, -121.8863],
  'austin': [30.2672, -97.7431], 'miami': [25.7617, -80.1918],
  'atlanta': [33.7490, -84.3880], 'boston': [42.3601, -71.0589],
  'seattle': [47.6062, -122.3321], 'denver': [39.7392, -104.9903],
  'las vegas': [36.1699, -115.1398], 'portland': [45.5051, -122.6750],
  'kansas city': [39.0997, -94.5786], 'nashville': [36.1627, -86.7816],
  'minneapolis': [44.9778, -93.2650], 'new orleans': [29.9511, -90.0715],
  'pittsburgh': [40.4406, -79.9959], 'cleveland': [41.4993, -81.6944],
  'st louis': [38.6270, -90.1994], 'baltimore': [39.2904, -76.6122],
  'detroit': [42.3314, -83.0458], 'memphis': [35.1495, -90.0490],
  'indianapolis': [39.7684, -86.1581], 'charlotte': [35.2271, -80.8431],
  'columbus': [39.9612, -82.9988], 'louisville': [38.2527, -85.7585],
  'san francisco': [37.7749, -122.4194], 'sf': [37.7749, -122.4194],
  'washington': [38.9072, -77.0369], 'dc': [38.9072, -77.0369],
  'washington dc': [38.9072, -77.0369],
  // Canada
  'toronto': [43.6532, -79.3832], 'vancouver': [49.2827, -123.1207],
  'montreal': [45.5017, -73.5673], 'calgary': [51.0447, -114.0719],
  'ottawa': [45.4215, -75.6972], 'edmonton': [53.5461, -113.4938],
  // Mexico
  'mexico city': [19.4326, -99.1332], 'guadalajara': [20.6597, -103.3496],
  'monterrey': [25.6866, -100.3161], 'tijuana': [32.5027, -117.0041],
  // UK / Europe
  'london': [51.5074, -0.1278], 'paris': [48.8566, 2.3522],
  'berlin': [52.5200, 13.4050], 'madrid': [40.4168, -3.7038],
  'barcelona': [41.3851, 2.1734], 'rome': [41.9028, 12.4964],
  'amsterdam': [52.3676, 4.9041], 'brussels': [50.8503, 4.3517],
  'vienna': [48.2082, 16.3738], 'zurich': [47.3769, 8.5417],
  'munich': [48.1351, 11.5820], 'frankfurt': [50.1109, 8.6821],
  'lisbon': [38.7169, -9.1395], 'stockholm': [59.3293, 18.0686],
  'copenhagen': [55.6761, 12.5683], 'oslo': [59.9139, 10.7522],
  'warsaw': [52.2297, 21.0122], 'prague': [50.0755, 14.4378],
  'budapest': [47.4979, 19.0402], 'bucharest': [44.4268, 26.1025],
  'athens': [37.9838, 23.7275], 'istanbul': [41.0082, 28.9784],
  // Asia / Pacific
  'tokyo': [35.6762, 139.6503], 'osaka': [34.6937, 135.5023],
  'beijing': [39.9042, 116.4074], 'shanghai': [31.2304, 121.4737],
  'hong kong': [22.3193, 114.1694], 'singapore': [1.3521, 103.8198],
  'dubai': [25.2048, 55.2708], 'mumbai': [19.0760, 72.8777],
  'delhi': [28.6139, 77.2090], 'bangalore': [12.9716, 77.5946],
  'bangkok': [13.7563, 100.5018], 'jakarta': [6.2088, 106.8456],
  'seoul': [37.5665, 126.9780], 'kuala lumpur': [3.1390, 101.6869],
  'sydney': [-33.8688, 151.2093], 'melbourne': [-37.8136, 144.9631],
  'auckland': [-36.8485, 174.7633],
  // Africa / Middle East
  'cairo': [30.0444, 31.2357], 'nairobi': [-1.2921, 36.8219],
  'johannesburg': [-26.2041, 28.0473], 'cape town': [-33.9249, 18.4241],
  'lagos': [6.5244, 3.3792], 'casablanca': [33.5731, -7.5898],
  'riyadh': [24.7136, 46.6753], 'abu dhabi': [24.4539, 54.3773],
  // South America
  'sao paulo': [-23.5505, -46.6333], 'rio de janeiro': [-22.9068, -43.1729],
  'buenos aires': [-34.6037, -58.3816], 'bogota': [4.7110, -74.0721],
  'lima': [-12.0464, -77.0428], 'santiago': [-33.4489, -70.6693],
};

// System Prompt guiding the Gemini assistant personality & rules
const SYSTEM_PROMPT = `You are StadiumPulse, an AI concierge for fans at a FIFA World Cup 2026 stadium.

You will be given a JSON snapshot of live stadium operations data (gate congestion, match clock, amenities, transport) and a fan's question, which may be in any language.

You should directly and specifically answer questions in the following categories:
1. Getting TO the stadium (directions, transit, driving, parking) — use the transport details to describe transit stations, shuttles, and rideshare points. Also refer to CO2 emissions footprints: Shuttle is low [Eco: low], Transit/walking is lowest [Eco: lowest], Rideshare is medium [Eco: medium], Private car is high [Eco: high].
2. Gate/entrance questions (congestion, wait times, which gate is fastest) — use gate congestion data.
3. Inside-stadium navigation (finding sections, seats, restrooms, first aid) — use target_section and amenities data.
4. Accessibility questions — recommend only accessible: true gates or restrooms.
5. Live match / distance questions — use live_match distance_km and flight_hours relative to the fan's location.
6. General event info (kickoff time, weather, teams playing).

Rules:
- Always respond in the same language the fan used.
- Ground every answer in the provided JSON data — never invent congestion numbers, wait times, or locations that aren't in the data.
- If the fan mentions an accessibility need (wheelchair, sensory sensitivity, etc.), only recommend gates/routes marked accessible: true.
- Keep answers short, practical, and friendly — 2-3 sentences max, like a helpful local guide, not a customer service script.
- If asked about crowd/congestion, always suggest the lowest-congestion viable alternative if one exists.
- Only redirect/fallback to an out-of-scope message when the question is genuinely unrelated to the stadium/event (e.g. "what's the capital of France").
- When mentioning a specific gate (e.g. Gate 1, Gate 5), include it exactly as "Gate N" so it can be highlighted on the map.
- If fan_location is provided in the data, factor real proximity into your answer — prioritise the closest viable gate and mention its distance in metres.
- If identified_venue is provided, reference that stadium by name.
- If target_section is provided, give specific routing directions to reach that seating section via the nearest gate.
- If the fan asks "how do I get to my seat" or similar without specifying a section number, ask a brief clarifying question (e.g., "Which section is your seat in?").
- When introducing yourself, always use the name StadiumPulse.
- If weather indicates rain/showers/extreme conditions, proactively mention this and advise covered routes/gates or indoor amenities.
- If recommending a transport mode, recommend the greener alternative and show its eco-rating tag (e.g. [Eco: low], [Eco: lowest]).`;

// State variables shared across modules
let stadiumData    = null;
let kickoffMinutes = 42;
let activeTab      = 'fan';
let currentRouteHighlight = null;

let venueStadiums  = null;     
let venueMatches   = null;     
let currentVenue   = null;     
let liveMatchData  = null;     
let targetSection  = null;     

let gateLastAlertStates = {}; 

let recognition = null;
let isRecognizing = false;
let isVoiceEnabled = false; 

let zoomScale = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let hasDragged = false;
let startDragX = 0;
let startDragY = 0;

let fanLat      = null;
let fanLng      = null;
let fanAccuracy = null;
let geoWatchId  = null;

let isSimMode     = false;
let isGpsFallback = false;

let gateDistances = {};
let highlightedGate = null;

let isProcessingChat = false;
let needsAccessibility = false;
