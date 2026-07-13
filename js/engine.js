/* ══════════════════════════════════════════════════════════════════
   StadiumPulse — js/engine.js
   Decision-making engine that calculates real-time gate recommendations
   and monitors proactive wait-time congestion events.
   ══════════════════════════════════════════════════════════════════ */

/**
 * Syncs the initial operations baseline data structure with alert state trackers.
 */
function initGateAlertStates() {
  if (!stadiumData || !stadiumData.gates) return;
  stadiumData.gates.forEach(gate => {
    gateLastAlertStates[gate.id] = { congestion: gate.congestion, wait: gate.wait_minutes };
  });
  updateProactiveRecommendations();
}

/**
 * Checks for sudden shifts in queue times and sends unsolicited warning notifications to fans.
 */
function checkProactiveAlerts() {
  enforceGateBaseline();
  if (!isGateCongestionActive()) return; 
  if (!stadiumData || !stadiumData.gates) return;
  
  stadiumData.gates.forEach(gate => {
    const prev = gateLastAlertStates[gate.id];
    if (prev) {
      const waitDiff = gate.wait_minutes - prev.wait;
      const spikedToHigh = gate.congestion === 'high' && prev.congestion !== 'high';
      const waitSpiked = waitDiff >= 5;

      if (spikedToHigh || waitSpiked) {
        const fastest = [...stadiumData.gates].sort((a,b) => a.wait_minutes - b.wait_minutes)[0];
        const alertMsg = `⚠️ **${gate.id}** wait time increased to **${gate.wait_minutes} min** (${gate.congestion} congestion). I suggest using **${fastest.id}** instead, where the wait is only **${fastest.wait_minutes} min**.`;
        
        addMessage('ai', alertMsg, true); 
      }
    }
    gateLastAlertStates[gate.id] = { congestion: gate.congestion, wait: gate.wait_minutes };
  });
  
  updateProactiveRecommendations();
}

/**
 * Dynamic scorer computing the optimal entryway. Updates both the Fan view
 * "Recommended for You" card and the Staff "Recommended Action" cards.
 */
function updateProactiveRecommendations() {
  const card = document.getElementById('recommendedCard');
  const actionCard = document.getElementById('recommendedActionCard');
  if (!stadiumData || !stadiumData.gates) return;

  const gates = stadiumData.gates;
  const weather = (stadiumData.match.weather || "").toLowerCase();

  // Score each gate's suitability index
  let scoredGates = gates.map(gate => {
    let score = 100;
    
    // Penalize queue times (-2 points/min)
    score -= (gate.wait_minutes * 2);

    // Penalize distance if fan is local (-0.05 points/metre)
    if (fanLat !== null && fanLng !== null && gateDistances[gate.id] !== undefined) {
      score -= (gateDistances[gate.id] * 0.05);
    }

    // Heavy penalty for non-accessible entryways if needed (-100 points)
    if (needsAccessibility && !gate.accessible) {
      score -= 100;
    }

    // Adapt to rain conditions: penalize uncovered walk paths (-15 points)
    if ((weather.includes('rain') || weather.includes('showers')) && gate.id !== 'Gate 1') {
      score -= 15;
    }

    return { gate, score };
  });

  scoredGates.sort((a, b) => b.score - a.score);

  const top = scoredGates[0].gate;
  const topScore = scoredGates[0].score;

  // Identify close runner-up channels (within 15 points suitability index)
  let runnerUp = null;
  if (scoredGates.length > 1) {
    const diff = topScore - scoredGates[1].score;
    if (diff <= 15) {
      runnerUp = scoredGates[1].gate;
    }
  }

  // Generate dynamic explanation reasoning
  let whyReasons = [];
  if (top.congestion === 'low') {
    whyReasons.push('lowest congestion');
  } else {
    whyReasons.push('low wait time');
  }

  if (fanLat !== null && fanLng !== null && gateDistances[top.id] !== undefined) {
    whyReasons.push(`closest to your location (${gateDistances[top.id]}m away)`);
  }

  if (needsAccessibility && top.accessible) {
    whyReasons.push('wheelchair accessible route');
  }

  if (weather.includes('rain') || weather.includes('showers')) {
    if (top.id === 'Gate 1') {
      whyReasons.push('features covered entryway for shelter from rain');
    } else {
      whyReasons.push('sheltered indoor pathways nearby');
    }
  } else if (weather.includes('heat') || weather.includes('hot')) {
    whyReasons.push('nearest hydration and cooling stations');
  }

  const whyText = whyReasons.length > 0
    ? `Why: ${whyReasons.join(' + ')}.`
    : 'Why: Optimal balance of accessibility, wait times, and current stadium weather conditions.';

  let gateDistText = '';
  if (fanLat !== null && fanLng !== null && gateDistances[top.id] !== undefined) {
    gateDistText = ` · ${gateDistances[top.id]}m away`;
  }

  // Draw Fan Recommendation Card
  if (card) {
    card.classList.remove('hidden');
    let runnerUpHtml = '';
    if (runnerUp) {
      runnerUpHtml = `
        <div class="rec-runnerup">
          <span>💡</span>
          <span><strong>${runnerUp.id}</strong> is also a good option (${runnerUp.wait_minutes} min wait) if you prefer to avoid crowds.</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="rec-title">
        <span>✅</span> RECOMMENDED FOR YOU
      </div>
      <div class="rec-gate-details">
        ${top.id} — ${top.wait_minutes} min wait${gateDistText}${top.accessible ? ' ♿' : ''}
      </div>
      <div class="rec-why">
        ${whyText}
      </div>
      ${runnerUpHtml}
    `;
  }

  // Draw Operational Action Card for staff
  if (actionCard) {
    actionCard.classList.remove('hidden');
    const sortedCongested = [...gates].sort((a,b) => b.wait_minutes - a.wait_minutes);
    const worst = sortedCongested[0];
    const bestForDivert = top;

    let opActionText = "";
    if (worst.congestion === 'high') {
      opActionText = `Divert inbound flows away from **${worst.id}** (currently overloaded at ${worst.wait_minutes} min wait) towards **${bestForDivert.id}** (${bestForDivert.wait_minutes} min wait). Consider deploying support teams at **${worst.id}**.`;
    } else {
      opActionText = `All gates operating within normal bounds. General GENERAL advise directing flows towards **${bestForDivert.id}** for optimal stadium load balancing.`;
    }

    actionCard.innerHTML = `
      <div class="rec-action-title">
        <span>🤖</span> RECOMMENDED OPERATIONAL ACTION
      </div>
      <div class="rec-action-body">
        ${opActionText}
      </div>
    `;
  }
}
