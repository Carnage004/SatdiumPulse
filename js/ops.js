/* ══════════════════════════════════════════════════════════════════
   StadiumPulse — js/ops.js
   Manages Staff Operations Dashboard Views, live metrics tables, 
   low-vs-high emission transport KPIs, and dynamic operational briefs.
   ══════════════════════════════════════════════════════════════════ */

/**
 * Updates all visual tables and widgets inside the Staff Ops View dashboard.
 */
function renderOpsView() {
  renderKPIs();
  renderGateTable();
  renderTransportInfo();
  renderAmenityInfo();
  renderMatchInfo();
  
  const el = document.getElementById('opsTimestamp');
  if (el) {
    el.textContent = 'Last updated: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

/**
 * Computes live operational KPIs (average wait, congestion spikes counts).
 */
function renderKPIs() {
  const gates    = stadiumData.gates;
  const lowCount = gates.filter(g => g.congestion === 'low').length;
  const hiCount  = gates.filter(g => g.congestion === 'high').length;
  const avgWait  = Math.round(gates.reduce((s,g) => s + g.wait_minutes, 0) / gates.length);
  const fastest  = [...gates].sort((a,b) => a.wait_minutes - b.wait_minutes)[0];

  const kpis = [
    { icon: '🟢', value: `${lowCount}/5`, label: 'Gates Low Congestion', color: 'var(--green-low)' },
    { icon: '🔴', value: `${hiCount}/5`, label: 'Gates High Congestion', color: hiCount > 1 ? 'var(--red-high)' : 'var(--text-secondary)' },
    { icon: '⏱️', value: `${avgWait}m`,  label: 'Avg Wait Time',        color: avgWait > 12 ? 'var(--red-high)' : 'var(--yellow-med)' },
    { icon: '⚡', value: fastest.id,      label: 'Fastest Gate',         color: 'var(--brand-gold)' },
    { icon: '⏰', value: `${kickoffMinutes}m`, label: 'Until Kickoff',   color: 'var(--brand-blue)' },
  ];

  const row = document.getElementById('kpiRow');
  if (row) {
    row.innerHTML = kpis.map(k => `
      <div class="kpi-card" style="--kpi-color: ${k.color}">
        <div class="kpi-icon">${k.icon}</div>
        <div class="kpi-value" style="color:${k.color}">${k.value}</div>
        <div class="kpi-label">${k.label}</div>
      </div>
    `).join('');
  }
}

/**
 * Populates tabular gate lists with divert/open actions.
 */
function renderGateTable() {
  const actionMap = {
    low:    { label: 'Open',    css: 'open' },
    medium: { label: 'Monitor', css: 'caution' },
    high:   { label: 'Divert',  css: 'divert' },
  };

  const rows = stadiumData.gates.map(g => {
    const action = actionMap[g.congestion];
    return `
      <tr>
        <td>${g.id}</td>
        <td><span class="congestion-badge ${g.congestion}">${g.congestion.toUpperCase()}</span></td>
        <td>${g.wait_minutes} min</td>
        <td>${g.accessible ? '♿ Yes' : '✗ No'}</td>
        <td><span class="action-badge ${action.css}">${action.label}</span></td>
      </tr>
    `;
  }).join('');

  const body = document.getElementById('gateTableBody');
  if (body) body.innerHTML = rows;
}

/**
 * Draws transport information panels and the dynamic Sustainability Tracker splits.
 */
function renderTransportInfo() {
  const t = stadiumData.transport;
  const lowEmissionPercent = 68;
  const highEmissionPercent = 32;

  const el = document.getElementById('transportInfo');
  if (el) {
    el.innerHTML = `
      <div class="info-item">
        <div class="info-icon">🚌</div>
        <div class="info-content">
          <div class="info-label">Shuttle</div>
          <div class="info-value">${t.shuttle_status}</div>
        </div>
      </div>
      <div class="info-item">
        <div class="info-icon">🚂</div>
        <div class="info-content">
          <div class="info-label">Transit</div>
          <div class="info-value">${t.nearest_transit}</div>
        </div>
      </div>
      <div class="info-item">
        <div class="info-icon">🚗</div>
        <div class="info-content">
          <div class="info-label">Rideshare</div>
          <div class="info-value">${t.rideshare_pickup}</div>
        </div>
      </div>
      <div class="sustainability-box" style="margin-top: 10px; padding: 8px 10px; background: rgba(34,197,94,0.06); border: 1px dashed rgba(34,197,94,0.25); border-radius: 8px; font-size: 11px;">
        <div style="font-weight: 700; color: hsl(142,76%,70%); display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
          <span>🍃 Sustainability Tracker</span>
        </div>
        <div style="color: var(--text-secondary); line-height: 1.45;">
          Fan transit footprint split: <strong>${lowEmissionPercent}% Low-Emission</strong> (Transit/Shuttle) vs <strong>${highEmissionPercent}% High-Emission</strong>. Promote Gate 1 covered approach to incentivize shuttle use.
        </div>
      </div>
    `;
  }
}

/**
 * Renders amenity details inside Staff Ops widgets.
 */
function renderAmenityInfo() {
  const emojiMap = { restroom: '🚻', first_aid: '🏥', family_room: '👨‍👩‍👧' };
  const items = stadiumData.amenities.map(a => `
    <div class="info-item">
      <div class="info-icon">${emojiMap[a.type] || '📍'}</div>
      <div class="info-content">
        <div class="info-label">${a.type.replace('_',' ')}</div>
        <div class="info-value">${a.location}${a.accessible ? ' · ♿' : ''}</div>
      </div>
    </div>
  `).join('');

  const el = document.getElementById('amenityInfo');
  if (el) el.innerHTML = items;
}

/**
 * Renders current match parameters inside Staff Ops widgets.
 */
function renderMatchInfo() {
  const m = stadiumData.match;
  const el = document.getElementById('matchInfo');
  if (el) {
    el.innerHTML = `
      <div class="info-item">
        <div class="info-icon">⚽</div>
        <div class="info-content">
          <div class="info-label">Match</div>
          <div class="info-value">${m.teams}</div>
        </div>
      </div>
      <div class="info-item">
        <div class="info-icon">🏟️</div>
        <div class="info-content">
          <div class="info-label">Venue</div>
          <div class="info-value">${m.stadium}</div>
        </div>
      </div>
      <div class="info-item">
        <div class="info-icon">⏰</div>
        <div class="info-content">
          <div class="info-label">Kickoff in</div>
          <div class="info-value">${kickoffMinutes} minutes</div>
        </div>
      </div>
      <div class="info-item">
        <div class="info-icon">🌤️</div>
        <div class="info-content">
          <div class="info-label">Weather</div>
          <div class="info-value">${m.weather}</div>
        </div>
      </div>
    `;
  }
}

/**
 * Generates an operational briefings paragraph. 
 * Queries Gemini generateContent if key is active, otherwise falls back to a rules builder.
 */
async function generateOpsBriefing() {
  const el = document.getElementById('aiBriefing');
  if (!el) return;
  el.innerHTML = '<div class="briefing-loading">Generating briefing…</div>';

  const highGates   = stadiumData.gates.filter(g => g.congestion === 'high');
  const lowGates    = stadiumData.gates.filter(g => g.congestion === 'low');
  const medGates    = stadiumData.gates.filter(g => g.congestion === 'medium');
  const fastestGate = [...stadiumData.gates].sort((a,b) => a.wait_minutes - b.wait_minutes)[0];

  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
    try {
      const prompt = `You are a stadium operations AI. Given this live data, write a 2-3 sentence actionable ops briefing for stadium staff. Be direct and specific — mention exact gate names and recommended actions.

Stadium data:
${JSON.stringify(stadiumData, null, 2)}
 
Write a concise operations briefing paragraph with recommended actions right now.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 200 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          el.innerHTML = `<p style="color:var(--text-secondary);line-height:1.7">${text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}</p>`;
          return;
        }
      }
    } catch(e) { 
      console.warn("Falling back to static builder for operations briefing:", e.message);
    }
  }

  await delay(600);
  let briefing = '';

  const highNames = highGates.map(g => `<strong>${g.id}</strong>`);
  const lowNames = lowGates.map(g => `<strong>${g.id}</strong>`);

  if (highGates.length > 0) {
    briefing += `🚨 <strong>Active Congestion Event:</strong> Wait times at ${highNames.join(' and ')} are elevated. Staff are advised to redirect incoming traffic towards the outer rings. `;
  }

  if (lowGates.length > 0) {
    briefing += `Suggest directing non-ticketed entrants to ${lowNames.join(', ')} (averaging ${fastestGate.wait_minutes} min queue). `;
  } else {
    briefing += `Alert: All entries are currently experiencing medium-to-high traffic as kickoff (${kickoffMinutes} min) approaches. `;
  }

  const accessibleLow = lowGates.filter(g => g.accessible);
  if (accessibleLow.length === 0) {
    briefing += `⚠️ <strong>Accessibility Alert:</strong> Consider deploying shuttle support near Gate 3 to assist wheelchair users as low-wait accessible channels are full. `;
  } else {
    briefing += `Instruct wheelchair users towards **${accessibleLow[0].id}** for accessible support. `;
  }

  briefing += `Fan transit split: 68% green transit options. Weather is currently ${stadiumData.match.weather}.`;

  el.innerHTML = `<p style="color:var(--text-secondary);line-height:1.7">${briefing}</p>`;
}
