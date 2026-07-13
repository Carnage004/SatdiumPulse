/* ══════════════════════════════════════════════════════════════════
   StadiumPulse — js/chat.js
   Manages the interactive AI concierge chat window, user submission, 
   eco-badge message text formatting, speech controls (TTS/STT), 
   and rule-based fallbacks.
   ══════════════════════════════════════════════════════════════════ */

/**
 * Handles submission of a chat message from the user input.
 * Implements a submission lock guard and disables buttons during network resolution.
 */
function handleSubmit(e) {
  if (e) e.preventDefault();
  if (isProcessingChat) return;

  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;

  const lowerText = text.toLowerCase();
  if (lowerText.includes('wheelchair') || lowerText.includes('accessible') || lowerText.includes('silla de ruedas') || lowerText.includes('handicap')) {
    needsAccessibility = true;
    updateProactiveRecommendations();
  }

  isProcessingChat = true;
  input.value = '';
  input.disabled = true;
  
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.disabled = true;

  addMessage('user', text);
  showTypingIndicator();

  getAIResponse(text)
    .then(reply => {
      removeTypingIndicator();
      addMessage('ai', reply);
      
      isProcessingChat = false;
      if (sendBtn) sendBtn.disabled = false;
      input.disabled = false;
      input.focus();

      speakText(reply);

      const mentioned = extractGateMention(reply);
      if (mentioned) highlightGate(mentioned);
    })
    .catch(err => {
      removeTypingIndicator();
      const fallback = getFallbackResponse(text);
      addMessage('ai', `Sorry, I had trouble connecting. ${fallback}`);
      
      isProcessingChat = false;
      if (sendBtn) sendBtn.disabled = false;
      input.disabled = false;
      input.focus();

      speakText(fallback);
    });
}

function sendChip(btn) {
  const chipText = btn.textContent.toLowerCase();
  if (chipText.includes('wheelchair') || chipText.includes('access')) {
    needsAccessibility = true;
    updateProactiveRecommendations();
  }
  document.getElementById('chatInput').value = btn.textContent.replace(/^[^\w¿]*/u, '').trim();
  handleSubmit(new Event('submit', { cancelable: true }));
}

/**
 * Appends a bubble to the messages log container.
 */
function addMessage(role, text, isAlert = false) {
  const area = document.getElementById('messagesArea');
  if (!area) return;

  const wrapper = document.createElement('div');
  wrapper.className = `message ${role} ${isAlert ? 'alert-msg' : ''}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = isAlert ? '⚠️' : (role === 'ai' ? '⚡' : '👤');

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  
  let formatted = formatMessageText(text);
  if (isAlert) {
    formatted = `<span class="live-alert-badge">⚡ LIVE ALERT</span>` + formatted;
  }
  bubble.innerHTML = formatted;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const inner = document.createElement('div');
  inner.style.display = 'flex';
  inner.style.flexDirection = 'column';
  inner.appendChild(bubble);
  inner.appendChild(meta);

  wrapper.appendChild(avatar);
  wrapper.appendChild(inner);
  area.appendChild(wrapper);

  area.scrollTop = area.scrollHeight;

  if (isAlert) {
    speakText(text);
  }
}

/**
 * Formats markup (bold markdown support, gate badges, leaf eco emission labels).
 */
function formatMessageText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/(Gate \d)/g, '<span class="gate-badge">🚪 $1</span>')
    .replace(/\[Eco:\s*lowest\]/gi, '<span class="eco-badge eco-lowest">🍃 Lowest Emissions</span>')
    .replace(/\[Eco:\s*low\]/gi, '<span class="eco-badge eco-low">🍃 Low Emissions</span>')
    .replace(/\[Eco:\s*medium\]/gi, '<span class="eco-badge eco-medium">🍃 Moderate Emissions</span>')
    .replace(/\[Eco:\s*high\]/gi, '<span class="eco-badge eco-high">⚠️ High Emissions</span>');
}

function showTypingIndicator() {
  const area = document.getElementById('messagesArea');
  if (!area) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'message ai';
  wrapper.id = 'typingWrapper';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = '⚡';

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

  wrapper.appendChild(avatar);
  wrapper.appendChild(indicator);
  area.appendChild(wrapper);
  area.scrollTop = area.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingWrapper');
  if (el) el.remove();
}

/**
 * Sets up SpeechRecognition interface bindings for Speech-to-Text inputs.
 */
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech recognition is not supported in this browser.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isRecognizing = true;
    const btn = document.getElementById('micBtn');
    if (btn) btn.classList.add('recording');
    document.getElementById('chatInput').placeholder = "Listening...";
  };

  recognition.onend = () => {
    isRecognizing = false;
    const btn = document.getElementById('micBtn');
    if (btn) btn.classList.remove('recording');
    document.getElementById('chatInput').placeholder = "Ask anything… in any language 🌍";
  };

  recognition.onresult = (event) => {
    const resultText = event.results[0][0].transcript;
    document.getElementById('chatInput').value = resultText;
    handleSubmit(new Event('submit', { cancelable: true }));
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e.error);
    isRecognizing = false;
    const btn = document.getElementById('micBtn');
    if (btn) btn.classList.remove('recording');
  };
}

function toggleVoiceInput() {
  if (!recognition) {
    initSpeechRecognition();
  }
  if (!recognition) {
    addMessage('ai', "🎙️ Voice input is not supported in this browser.");
    return;
  }
  if (isRecognizing) {
    recognition.stop();
  } else {
    recognition.lang = navigator.language || 'en-US';
    recognition.start();
  }
}

function toggleVoiceMute() {
  isVoiceEnabled = !isVoiceEnabled;
  const btn = document.getElementById('voiceMuteBtn');
  if (!btn) return;
  if (isVoiceEnabled) {
    btn.textContent = '🔊';
    btn.classList.add('active');
    addMessage('ai', '🔊 **Voice replies enabled**. I will read my answers aloud!');
  } else {
    btn.textContent = '🔇';
    btn.classList.remove('active');
    window.speechSynthesis.cancel();
    addMessage('ai', '🔇 **Voice replies muted**.');
  }
}

function speakText(text) {
  if (!isVoiceEnabled) return;
  window.speechSynthesis.cancel(); 

  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/\[Eco:[^\]]+\]/gi, '')
    .replace(/⚡ LIVE ALERT/gi, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = navigator.language || 'en-US';
  window.speechSynthesis.speak(utterance);
}

function extractGateMention(text) {
  const match = text.match(/Gate\s+([1-5])/i);
  return match ? `Gate ${match[1]}` : null;
}

/**
 * Builds the structural JSON context payload sent to the Gemini API models.
 */
function buildContextPayload() {
  const payload = JSON.parse(JSON.stringify(stadiumData));

  if (fanLat !== null && fanLng !== null) {
    payload.gates = payload.gates.map(g => ({
      ...g,
      distance_metres: gateDistances[g.id] !== undefined ? gateDistances[g.id] : null
    }));

    payload.fan_location = {
      lat: Math.round(fanLat * 1e6) / 1e6,
      lng: Math.round(fanLng * 1e6) / 1e6,
      accuracy_metres: fanAccuracy ? Math.round(fanAccuracy) : null,
      source: isSimMode ? 'simulated' : (isGpsFallback ? 'approximate_fallback' : 'gps_live'),
      closest_gate: (() => {
        const g = getClosestGate();
        return g ? { gate: g.id, distance_metres: gateDistances[g.id] } : null;
      })(),
      closest_accessible_gate: (() => {
        const g = getClosestGate(true);
        return g ? { gate: g.id, distance_metres: gateDistances[g.id] } : null;
      })(),
    };
  }

  if (currentVenue) {
    payload.identified_venue = {
      name:     currentVenue.name,
      city:     currentVenue.city,
      country:  currentVenue.country,
      capacity: currentVenue.capacity,
    };
  }

  if (targetSection) {
    payload.target_section = {
      section:      targetSection.section,
      nearest_gate: targetSection.nearestGate,
      level:        targetSection.level,
      side:         targetSection.side,
      gate_wait_minutes: stadiumData.gates.find(g => g.id === targetSection.nearestGate)?.wait_minutes ?? null,
    };
  }

  if (liveMatchData && fanLat !== null && fanLng !== null) {
    const distKm = haversineMetres(fanLat, fanLng, liveMatchData.lat, liveMatchData.lng) / 1000;
    payload.live_match = {
      teams:         liveMatchData.teams,
      stage:         liveMatchData.stage,
      stadium:       liveMatchData.stadium_name,
      city:          liveMatchData.city,
      kickoff_utc:   liveMatchData.kickoff_utc,
      distance_km:   Math.round(distKm),
      flight_hours:  Math.round(distKm / 800),
      status:        (() => {
        const now = Date.now();
        const ko  = new Date(liveMatchData.kickoff_utc).getTime();
        if (now >= ko && now < ko + MATCH_DURATION_MIN * 60_000) return 'live';
        return now < ko ? 'upcoming' : 'finished';
      })(),
    };
  } else if (liveMatchData) {
    payload.live_match = {
      teams:       liveMatchData.teams,
      stage:       liveMatchData.stage,
      stadium:     liveMatchData.stadium_name,
      city:        liveMatchData.city,
      kickoff_utc: liveMatchData.kickoff_utc,
      status:      'upcoming',
    };
  }

  return payload;
}

/**
 * Sends messages to Gemini models or catches fallback conditions.
 */
async function getAIResponse(userMessage) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    await delay(900 + Math.random() * 600);
    return getFallbackResponse(userMessage);
  }

  const contextData = buildContextPayload();
  const contextPayload = JSON.stringify(contextData, null, 2);
  const fullUserMessage = `Stadium operations data:\n\`\`\`json\n${contextPayload}\n\`\`\`\n\nFan question: ${userMessage}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: fullUserMessage }] }
        ],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.4, maxOutputTokens: 250 }
      })
    });

    if (!res.ok) throw new Error(`API returned status ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || getFallbackResponse(userMessage);
  } catch(e) {
    console.error("Gemini API error:", e);
    return getFallbackResponse(userMessage);
  }
}

/**
 * Custom rule-based routing to solve questions when the Gemini API Key is missing.
 */
function getFallbackResponse(question) {
  const q = question.toLowerCase();

  const byWait    = [...stadiumData.gates].sort((a,b) => a.wait_minutes - b.wait_minutes);
  const fastest   = byWait[0];
  const accessible= byWait.filter(g => g.accessible);
  const fastestAcc= accessible[0];
  const lowGates  = stadiumData.gates.filter(g => g.congestion === 'low');
  const highGates = stadiumData.gates.filter(g => g.congestion === 'high');

  const hasLocation  = fanLat !== null && fanLng !== null;
  const closestGate  = hasLocation ? getClosestGate()      : null;
  const closestAccG  = hasLocation ? getClosestGate(true)  : null;

  const distNote = (gate) => {
    const d = gateDistances[gate.id];
    return d !== undefined ? ` (${d}m away)` : '';
  };

  const weather = (stadiumData.match.weather || '').toLowerCase();
  const weatherAdvice = weather.includes('rain') || weather.includes('showers')
    ? " 🌧️ Note: It is raining today — Gate 1 features a fully covered entryway, whereas walkways from other parking zones are uncovered."
    : (weather.includes('heat') || weather.includes('hot') ? " ☀️ Note: High temperature today — stay hydrated and utilize cooling rooms near Section 120." : "");

  if (q.includes('silla de ruedas') || q.includes('wheelchair') || q.includes('accessible') || q.includes('acceso') || q.includes('handicap')) {
    const g = closestAccG || fastestAcc;
    const dNote = distNote(g);
    return `¡Claro! Para acceso en silla de ruedas, **${g.id}**${dNote} es su mejor opción ahora mismo — solo ${g.wait_minutes} minutos de espera y está completamente accesible. ${accessible.filter(x=>x.id!==g.id).length > 0 ? `**${accessible.find(x=>x.id!==g.id).id}** también es accesible.` : ''}${weatherAdvice} ♿`;
  }

  if (q.includes('baño') || q.includes('aseo') || q.includes('bano') || q.includes('dónde') || q.includes('donde')) {
    const restrooms = stadiumData.amenities.filter(a => a.type === 'restroom');
    return `Los aseos más cercanos están en **${restrooms[0].location}** y **${restrooms[1].location}** (ambos con acceso para sillas de ruedas). ¡Siga los carteles interiores! 🚻`;
  }

  if (q.includes('restroom') || q.includes('toilet') || q.includes('bathroom') || q.includes('wc')) {
    const restrooms = stadiumData.amenities.filter(a => a.type === 'restroom');
    return `The nearest restrooms are at **${restrooms[0].location}** and **${restrooms[1].location}** (both fully accessible). They're well-signposted from any concourse. 🚻`;
  }

  if (q.includes('first aid') || q.includes('medical') || q.includes('doctor') || q.includes('hurt') || q.includes('emergency')) {
    const fa = stadiumData.amenities.find(a => a.type === 'first_aid');
    return `First aid is located at **${fa.location}** and is fully accessible. Staff are on duty throughout the match — just head to that area or ask any steward. 🏥`;
  }

  if (q.includes('family') || q.includes('baby') || q.includes('child') || q.includes('kid') || q.includes('stroller')) {
    const fr = stadiumData.amenities.find(a => a.type === 'family_room');
    return `The family room is at **${fr.location}** — perfect for young children and nursing. It's quiet, accessible, and has changing facilities. 👨‍👩‍👧`;
  }

  if (q.includes('how do i get to') || q.includes('how to get to') || q.includes('getting to') || q.includes('directions to') || q.includes('transit') || q.includes('bus') || q.includes('train') || q.includes('uber') || q.includes('lyft') || q.includes('ride') || q.includes('shuttle') || q.includes('parking') || q.includes('home') || q.includes('leave') || q.includes('driving')) {
    const t = stadiumData.transport;
    const stadiumName = stadiumData.match.stadium || 'the stadium';
    return `To get to **${stadiumName}**, transit is highly recommended [Eco: lowest]. The **${t.nearest_transit}** is only a 12 min walk. Rideshare drop-off is at **${t.rideshare_pickup}** [Eco: medium], and shuttles run continuously **${t.shuttle_status}**. Transit is the greenest option!${weatherAdvice}`;
  }

  if (q.includes('fastest') || q.includes('quickest') || q.includes('least busy') || q.includes('congestion') || q.includes('crowd') || q.includes('busy') || q.includes('wait') || q.includes('queue')) {
    const lowList  = lowGates.map(g => `**${g.id}**${distNote(g)} (${g.wait_minutes} min)`).join(' and ');
    const highList = highGates.map(g => g.id).join(' and ');
    let resMsg = "";
    if (closestGate && closestGate.congestion !== 'high') {
      resMsg = `Your closest gate is **${closestGate.id}**${distNote(closestGate)} with a ${closestGate.wait_minutes} min wait. ${lowList ? `The overall fastest options are ${lowList}.` : ''} ${highList ? `Avoid **${highList}**.` : ''}`;
    } else {
      resMsg = `Right now, ${lowList || `**${fastest.id}**${distNote(fastest)} (${fastest.wait_minutes} min)`} ${lowGates.length > 1 ? 'are' : 'is'} your fastest options! ${highList ? `Avoid **${highList}** — they're heavily congested.` : ''}`;
    }
    return resMsg + weatherAdvice + " ⚡";
  }

  for (let i = 1; i <= 5; i++) {
    if (q.includes(`gate ${i}`)) {
      const gate = stadiumData.gates.find(g => g.id === `Gate ${i}`);
      if (gate) {
        const accessStr = gate.accessible ? '♿ wheelchair accessible' : '⚠️ no wheelchair access';
        return `**Gate ${i}** currently has **${gate.congestion}** congestion with a ~${gate.wait_minutes} minute wait (${accessStr}). ${gate.congestion === 'high' ? `I'd suggest **${fastest.id}** instead — only ${fastest.wait_minutes} min!` : 'Good choice right now!'}${weatherAdvice}`;
      }
    }
  }

  if (q.includes('kickoff') || q.includes('kick off') || q.includes('kick-off') || q.includes('start') || q.includes('begin') || q.includes('time')) {
    return `**${stadiumData.match.teams}** kicks off in **${kickoffMinutes} minutes** at ${stadiumData.match.stadium}. Weather is ${stadiumData.match.weather} — perfect match conditions! ⚽`;
  }

  if (q.includes('seat') || q.includes('section') || q.includes('mi asiento') || q.includes('my seat') || q.includes('214') || q.includes('108') || q.includes('120') || q.includes('340')) {
    let sec = null;
    const matchSec = q.match(/\b(108|120|214|340)\b/);
    if (matchSec) sec = matchSec[1];
    else if (targetSection) sec = targetSection.section;

    if (sec) {
      const layout = VENUE_LAYOUTS.metlife.sections[sec];
      const gate = stadiumData.gates.find(g => g.id === layout.nearestGate);
      return `To reach **Section ${sec}** (${layout.level} level, ${layout.side} side), enter via **${layout.nearestGate}** — currently ${gate?.wait_minutes || '?'} min wait${gate?.accessible ? ' ♿' : ''}. Follow concourse signs to your row once inside. 🎟${weatherAdvice}`;
    }
    return `Which section is your seat in? If you enter your section number (like 108, 120, 214, or 340) in the **Find My Seat** panel or tell me, I can give you step-by-step navigation instructions! 🎟`;
  }

  if (q.includes('how far') || q.includes('distance') || q.includes('flight') || q.includes('travel') || q.includes('from me') || q.includes('from my')) {
    if (liveMatchData && fanLat !== null) {
      const distKm = haversineMetres(fanLat, fanLng, liveMatchData.lat, liveMatchData.lng) / 1000;
      const flightH = Math.round(distKm / 800);
      const isLocal = distKm < 5;
      if (isLocal) return `You’re right here at **${liveMatchData.stadium_name}**! The ${liveMatchData.teams} match is on your doorstep. ⚽ Enjoy the game!`;
      return `The **${liveMatchData.teams}** match is at ${liveMatchData.stadium_name} in ${liveMatchData.city}. From your current location, that’s **${Math.round(distKm).toLocaleString()} km away** ${flightH > 0 ? `— roughly **~${flightH} hours by air**. ✈️` : ''} Watching on a screen tonight? 📺`;
    }
    return `Enable your location (or type your city below the map) and I'll calculate your distance to the live match and estimate your flight time! ✈️`;
  }

  return `I'm here to help you with stadium transport, gate congestion, inside navigation, accessibility, and World Cup event details at **${stadiumData.match.stadium}**. For other topics like that, you'll need to check a general search engine! ⚡`;
}
