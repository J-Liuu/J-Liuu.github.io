// === Osmosis / Water-Balance simulation (powers level 1K) =========================
// Extracted from index.html so 1K can be worked on — and eventually relocated to a
// separate 7th/8th-grade game — without touching the 6th-grade core.
//
// These are plain function declarations. This file is loaded as a classic <script>
// BEFORE the main inline script in index.html, so every function here is hoisted onto
// window and is callable from the engine, inline onclick handlers, and the membrane
// code. The functions reference shared engine state/helpers (state, currentLevel,
// demoSetTimeout, membraneFeedback, the OSMOSIS_* constants, etc.) at call time only;
// those still live in index.html.
//
// To REMOVE osmosis from the 6th-grade game: drop the <script src="sims/osmosis.js">
// tag and the levels/osmosis.js data + its spread.
//
// RELOCATION CHECKLIST (to lift 1K into a separate 7th/8th-grade game): this file now
// carries its own config constants (below). What still lives in index.html and would
// need to come along or be re-stubbed — all greppable by "osmosis" / "waterBalance":
//   - state fields: state.osmosis* and state.osmosisSideQuest* (initialized in the
//     main `state` object literal)
//   - engine seams keyed on `demoStage === "waterBalance"`: adjustStats (outsideSalt /
//     size), renderStats, isInteractiveGameLevel, loadLevel chat line, loseLevel death
//     handling, evaluateLossConditions, renderDetails death markup, runAction salt
//     buttons, checkWarnings, and the side-quest guard calls
//   - the WATER_CHANNEL_LEVEL_ID side-quest bridge (a membrane level id; drop the
//     bridge if the standalone game has no 1C water-channel level)
//   - SVG: the #osmosisVisual / #waterBalanceMeter groups in index.html, and the
//     .osmosis-* / osmosisDangerFlash rules in styles/main.css

    // --- Osmosis config (kept here so 1K carries its own constants) ---
    const OSMOSIS_CHALLENGE_LEVEL_ID = "osmosis-challenge";
    const OSMOSIS_GOAL_SECONDS = 20;
    const OSMOSIS_TICK_MS = 1000;
    const OSMOSIS_CENTER = { x: 450, y: 306 };
    const OSMOSIS_CHANNELS = [
      { angle: -90 },
      { angle: -30 },
      { angle: 30 },
      { angle: 90 },
      { angle: 150 },
      { angle: 210 }
    ];

    function maybeOfferOsmosisSideQuest() {
      if (levelChatId() !== WATER_CHANNEL_LEVEL_ID) return;
      if (levelIndexById(OSMOSIS_CHALLENGE_LEVEL_ID) < 0) return;
      if (state.osmosisSideQuestOffered || state.osmosisSideQuestCompleted || state.osmosisSideQuestActive) return;

      state.osmosisSideQuestOffered = true;
      bot("You followed water moving both ways through the channel. Want to see another water example? Try the Osmosis Challenge, and when you finish I will bring you right back to this water level.", {
        actions: "osmosisOffer"
      });
    }

    function startOsmosisSideQuest() {
      if (state.osmosisSideQuestChoiceMade) return;
      const osmosisIndex = levelIndexById(OSMOSIS_CHALLENGE_LEVEL_ID);
      if (osmosisIndex < 0) {
        bot("I cannot find the Osmosis Challenge yet, so keep going with the membrane levels for now.");
        return;
      }

      state.osmosisSideQuestChoiceMade = true;
      state.osmosisSideQuestActive = true;
      state.osmosisReturnLevelId = WATER_CHANNEL_LEVEL_ID;
      state.osmosisReturnMessageShown = false;
      renderChat();
      bot(`Great. I am opening the Osmosis Challenge as a quick side example. Finish the ${OSMOSIS_GOAL_SECONDS}-second balance goal, then I will bring you back here.`);
      loadLevel(osmosisIndex);
    }

    function declineOsmosisSideQuest() {
      if (state.osmosisSideQuestChoiceMade) return;
      state.osmosisSideQuestChoiceMade = true;
      renderChat();
      bot("No problem. Keep going from this water level when you are ready.");
    }

    function completeOsmosisSideQuest() {
      if (!state.osmosisSideQuestActive) {
        showOsmosisRecapPopup("win");
        return;
      }
      if (state.osmosisReturnMessageShown) return;
      state.osmosisReturnMessageShown = true;
      bot("Nice osmosis work. Read the recap, then I will send you back to the original water-channel recap so the lesson path stays clear.");
      showOsmosisRecapPopup("win");
    }

    function returnToWaterChannelRecap() {
      const returnIndex = levelIndexById(state.osmosisReturnLevelId || WATER_CHANNEL_LEVEL_ID);
      state.osmosisSideQuestActive = false;
      state.osmosisSideQuestCompleted = true;
      state.osmosisReturnLevelId = null;
      state.transportRecapOnStartIndex = 1;
      loadLevel(returnIndex >= 0 ? returnIndex : 1);
      bot("Back at the water-channel recap. This is the same water lesson you left, so you can continue without jumping ahead.");
    }

    function guardOsmosisSideQuestNavigation() {
      if (state.osmosisSideQuestActive && levelChatId() === OSMOSIS_CHALLENGE_LEVEL_ID) {
        bot(`Finish the Osmosis Challenge first. Once the cell stays healthy for ${OSMOSIS_GOAL_SECONDS} seconds, I will return you to the water level.`);
        return true;
      }
      return false;
    }

    function restoreOsmosisCellBody() {
      const resetNode = (node) => {
        if (!node) return;
        try {
          if (node.getAnimations) node.getAnimations().forEach(anim => anim.cancel());
        } catch (err) {}
        node.style.opacity = "1";
        node.style.visibility = "visible";
        node.style.display = "";
        node.style.filter = "";
        node.style.transform = "";
        node.style.transformBox = "";
        node.style.transformOrigin = "";
        node.removeAttribute("opacity");
        node.classList.remove("osmosis-danger");
      };

      [
        "osmosisCellScene",
        "osmosisCellMotionGroup",
        "osmosisChannelsGroup",
        "osmosisCellScaleGroup",
        "osmosisInnerRotateGroup",
        "osmosisCellGlow",
        "osmosisCellOuter",
        "osmosisCellRing",
        "osmosisCellLabel"
      ].forEach(id => {
        const node = document.getElementById(id);
        if (!node) return;
        resetNode(node);
        try {
          if (node.getAnimations) node.getAnimations({ subtree: true }).forEach(anim => anim.cancel());
        } catch (err) {}
      });

      document.querySelectorAll("#osmosisCellScaleGroup *, #osmosisChannelsGroup *").forEach(resetNode);

      const motionGroup = document.getElementById("osmosisCellMotionGroup");
      const scaleGroup = document.getElementById("osmosisCellScaleGroup");
      const rotateGroup = document.getElementById("osmosisInnerRotateGroup");
      const channelsGroup = document.getElementById("osmosisChannelsGroup");
      const cellGlow = document.getElementById("osmosisCellGlow");
      const cellOuter = document.getElementById("osmosisCellOuter");
      const cellRing = document.getElementById("osmosisCellRing");
      const label = document.getElementById("osmosisCellLabel");

      if (motionGroup) motionGroup.setAttribute("transform", `translate(${OSMOSIS_CENTER.x} ${OSMOSIS_CENTER.y}) rotate(0)`);
      if (scaleGroup) scaleGroup.setAttribute("transform", "scale(1)");
      if (rotateGroup) rotateGroup.setAttribute("transform", "rotate(0)");
      if (channelsGroup) channelsGroup.setAttribute("opacity", "1");

      document.querySelectorAll(".osmosis-channel").forEach((channelNode, i) => {
        const baseAngle = OSMOSIS_CHANNELS[i]?.angle ?? Number(channelNode.dataset.angle || 0);
        const angleRad = baseAngle * Math.PI / 180;
        const radius = 112;
        const x = Math.cos(angleRad) * radius;
        const y = Math.sin(angleRad) * radius;
        channelNode.setAttribute("opacity", "1");
        channelNode.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(baseAngle + 90).toFixed(1)})`);
      });

      if (cellGlow) {
        cellGlow.setAttribute("r", "112");
        cellGlow.setAttribute("fill", "rgba(34,197,94,.10)");
        cellGlow.setAttribute("stroke", "none");
      }
      if (cellOuter) {
        cellOuter.setAttribute("r", "99");
        cellOuter.setAttribute("fill", "rgba(34,197,94,.18)");
        cellOuter.setAttribute("stroke", "#4ade80");
        cellOuter.setAttribute("stroke-width", "6");
      }
      if (cellRing) {
        cellRing.setAttribute("r", "85");
        cellRing.setAttribute("fill", "rgba(34,197,94,.10)");
        cellRing.setAttribute("stroke", "rgba(134,239,172,.62)");
        cellRing.setAttribute("stroke-width", "2");
        cellRing.setAttribute("stroke-dasharray", "8 7");
        cellRing.setAttribute("opacity", "1");
        cellRing.style.opacity = "1";
      }
      if (label) {
        label.textContent = "Healthy Cell";
        label.setAttribute("fill", "#f8fafc");
      }
    }

    function triggerOsmosisDeathAnimation(kind) {
      const layer = document.getElementById("demoParticles");
      if (!layer) return;
      const center = OSMOSIS_CENTER;
      const scaleGroup = document.getElementById("osmosisCellScaleGroup");
      const cellOuter = document.getElementById("osmosisCellOuter");
      const cellGlow = document.getElementById("osmosisCellGlow");
      const cellRing = document.getElementById("osmosisCellRing");
      const label = document.getElementById("osmosisCellLabel");

      const stopDeathDangerFlash = () => {
        [scaleGroup, cellOuter, cellGlow, cellRing].forEach(node => {
          if (!node) return;
          node.classList.remove("osmosis-danger");
          try {
            if (node.getAnimations) node.getAnimations().forEach(anim => anim.cancel());
          } catch (err) {}
        });
        if (cellRing) {
          cellRing.classList.remove("osmosis-danger");
          cellRing.setAttribute("opacity", "0");
          cellRing.style.opacity = "0";
        }
      };
      stopDeathDangerFlash();

      // Do not use persistent fill-forwards animations on the real cell body.
      // That was the cause of the missing-cell reset bug.
      [scaleGroup, cellOuter, cellGlow, cellRing].forEach(node => {
        if (!node || !node.animate) return;
        node.animate([
          { opacity: 1 },
          { opacity: kind === "swellExplosion" ? .16 : .35 },
          { opacity: 1 }
        ], { duration: kind === "swellExplosion" ? 900 : 560, easing: "ease-in-out", fill: "none" });
      });
      setTimeout(stopDeathDangerFlash, kind === "swellExplosion" ? 920 : 580);

      if (kind === "swellExplosion") {
        if (label) {
          label.textContent = "Popped, you lose!";
          label.setAttribute("fill", "#fecdd3");
        }
        const burst = document.createElementNS("http://www.w3.org/2000/svg", "g");
        burst.setAttribute("class", "demo-particle osmosis-death-burst");
        layer.appendChild(burst);

        const shockwave = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        shockwave.setAttribute("cx", center.x);
        shockwave.setAttribute("cy", center.y);
        shockwave.setAttribute("r", "92");
        shockwave.setAttribute("fill", "rgba(56,189,248,.20)");
        shockwave.setAttribute("stroke", "#bae6fd");
        shockwave.setAttribute("stroke-width", "5");
        shockwave.setAttribute("filter", "drop-shadow(0 0 18px rgba(125,211,252,.95))");
        burst.appendChild(shockwave);
        shockwave.animate([
          { r: 92, opacity: .95 },
          { r: 300, opacity: 0 }
        ], { duration: 950, easing: "ease-out", fill: "forwards" });

        for (let i = 0; i < 34; i++) {
          const piece = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          const angle = (Math.PI * 2 * i) / 34;
          const startR = 74 + Math.random() * 34;
          const endR = 175 + Math.random() * 120;
          piece.setAttribute("cx", center.x + Math.cos(angle) * startR);
          piece.setAttribute("cy", center.y + Math.sin(angle) * startR);
          piece.setAttribute("r", 3 + Math.random() * 5);
          piece.setAttribute("fill", i % 3 === 0 ? "#bae6fd" : i % 3 === 1 ? "#38bdf8" : "#bbf7d0");
          piece.setAttribute("filter", "drop-shadow(0 0 8px rgba(125,211,252,.7))");
          burst.appendChild(piece);
          piece.animate([
            { transform: "translate(0px,0px) scale(1)", opacity: 1 },
            { transform: `translate(${Math.cos(angle) * endR}px, ${Math.sin(angle) * endR}px) scale(.25)`, opacity: 0 }
          ], { duration: 950 + Math.random() * 360, easing: "ease-out", fill: "forwards" });
        }
        setTimeout(() => { if (burst.isConnected) burst.remove(); }, 1500);
      } else {
        if (label) {
          label.textContent = "Shrunked, you lose!";
          label.setAttribute("fill", "#fef3c7");
        }
        const pop = document.createElementNS("http://www.w3.org/2000/svg", "g");
        pop.setAttribute("class", "demo-particle osmosis-death-pop");
        layer.appendChild(pop);

        const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("cx", center.x);
        ring.setAttribute("cy", center.y);
        ring.setAttribute("r", "18");
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke", "#fef3c7");
        ring.setAttribute("stroke-width", "5");
        ring.setAttribute("stroke-dasharray", "7 5");
        ring.setAttribute("filter", "drop-shadow(0 0 13px rgba(250,204,21,.95))");
        pop.appendChild(ring);
        ring.animate([
          { r: 18, opacity: 1 },
          { r: 70, opacity: 0 }
        ], { duration: 620, easing: "ease-out", fill: "forwards" });

        for (let i = 0; i < 14; i++) {
          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          const angle = (Math.PI * 2 * i) / 14;
          dot.setAttribute("cx", center.x);
          dot.setAttribute("cy", center.y);
          dot.setAttribute("r", 3 + Math.random() * 2);
          dot.setAttribute("fill", i % 2 ? "#fef3c7" : "#bbf7d0");
          pop.appendChild(dot);
          dot.animate([
            { transform: "translate(0px,0px) scale(1)", opacity: 1 },
            { transform: `translate(${Math.cos(angle) * (45 + Math.random() * 32)}px, ${Math.sin(angle) * (45 + Math.random() * 32)}px) scale(.2)`, opacity: 0 }
          ], { duration: 640, easing: "ease-out", fill: "forwards" });
        }
        setTimeout(() => { if (pop.isConnected) pop.remove(); }, 1050);
      }
    }

    function updateOsmosisVisuals() {
      const osmosisVisual = document.getElementById("osmosisVisual");
      if (!osmosisVisual) return;
      const isOsmosis = currentLevel().membraneDemoMode && currentLevel().demoStage === "waterBalance";
      osmosisVisual.classList.toggle("hidden-svg", !isOsmosis);
      if (!isOsmosis) return;

      if (state.levelLost) {
        const size = state.stats?.size ?? 50;
        const cellOuter = document.getElementById("osmosisCellOuter");
        const cellGlow = document.getElementById("osmosisCellGlow");
        const cellRing = document.getElementById("osmosisCellRing");
        const scaleGroup = document.getElementById("osmosisCellScaleGroup");
        const cellLabel = document.getElementById("osmosisCellLabel");
        [cellOuter, cellGlow, cellRing, scaleGroup].forEach(node => {
          if (!node) return;
          node.classList.remove("osmosis-danger");
          try {
            if (node.getAnimations) node.getAnimations().forEach(anim => anim.cancel());
          } catch (err) {}
        });
        if (cellRing) {
          cellRing.setAttribute("opacity", "0");
          cellRing.style.opacity = "0";
        }
        if (cellLabel) {
          cellLabel.textContent = size >= 70 ? "Popped, you lose!" : size <= 35 ? "Shrunked, you lose!" : "You lose!";
          cellLabel.setAttribute("fill", "#fecdd3");
        }
        return;
      }

      const salt = clamp(state.stats.outsideSalt ?? 50);
      const size = clamp(state.stats.size ?? 50);
      const cellOuter = document.getElementById("osmosisCellOuter");
      const cellGlow = document.getElementById("osmosisCellGlow");
      const cellRing = document.getElementById("osmosisCellRing");
      const scaleGroup = document.getElementById("osmosisCellScaleGroup");
      const cellLabel = document.getElementById("osmosisCellLabel");
      const timerLabel = document.getElementById("osmosisTimerLabel");
      const saltText = document.getElementById("outsideSaltVisualText");
      const saltFill = document.getElementById("outsideSaltVisualFill");
      const dirText = document.getElementById("osmosisWaterDirectionText");

      // Bigger visual change, but slower stat change: students get time to react.
      state.osmosisCellScaleBase = 0.52 + (size / 100) * 1.02;

      const danger = size <= 28 || size >= 82;
      let stroke = "#4ade80";
      let fill = "rgba(34,197,94,.18)";
      let glow = "rgba(34,197,94,.10)";
      let ring = "rgba(134,239,172,.62)";
      if (size <= 35) {
        stroke = danger ? "#fb7185" : "#fbbf24";
        fill = danger ? "rgba(251,113,133,.16)" : "rgba(251,191,36,.16)";
        glow = danger ? "rgba(251,113,133,.12)" : "rgba(251,191,36,.10)";
        ring = danger ? "rgba(251,113,133,.72)" : "rgba(253,224,71,.65)";
      } else if (size >= 70) {
        stroke = danger ? "#fb7185" : "#fbbf24";
        fill = danger ? "rgba(251,113,133,.16)" : "rgba(251,191,36,.16)";
        glow = danger ? "rgba(251,113,133,.12)" : "rgba(251,191,36,.10)";
        ring = danger ? "rgba(251,113,133,.72)" : "rgba(253,224,71,.65)";
      }

      if (cellOuter) {
        cellOuter.setAttribute("stroke", stroke);
        cellOuter.setAttribute("fill", fill);
        cellOuter.classList.toggle("osmosis-danger", danger);
      }
      if (cellGlow) {
        cellGlow.setAttribute("fill", glow);
        cellGlow.classList.toggle("osmosis-danger", danger);
      }
      if (cellRing) cellRing.setAttribute("stroke", ring);
      if (scaleGroup) scaleGroup.classList.toggle("osmosis-danger", danger);
      if (cellLabel) {
        cellLabel.textContent = size <= 35 ? "Shrinking!" : size >= 70 ? "Swelling!" : "Healthy Cell";
        cellLabel.setAttribute("fill", danger ? "#fecdd3" : "#f8fafc");
      }
        if (timerLabel) timerLabel.textContent = `Healthy Time: ${state.osmosisHealthySeconds || 0} / ${OSMOSIS_GOAL_SECONDS}s`;
      if (saltText) saltText.textContent = `${salt}`;
      if (saltFill) {
        saltFill.setAttribute("width", Math.max(8, 342 * salt / 100));
        saltFill.setAttribute("fill", salt > 60 ? "#fbbf24" : salt < 40 ? "#38bdf8" : "#34d399");
      }
      if (dirText) {
        dirText.textContent = salt > 60 ? "Too salty outside: salt traps water leaving the cell" : salt < 40 ? "Too watery outside: free water rushes into the cell" : "Balanced outside: water enters and exits equally";
        dirText.setAttribute("fill", salt > 60 ? "#fde68a" : salt < 40 ? "#bae6fd" : "#bbf7d0");
      }

      try {
        syncOsmosisAmbientSprites(salt);
      } catch (err) {
        console.warn("Osmosis sprite sync skipped:", err);
      }
    }

    function randomOsmosisOutsidePoint(minRadius = 205, maxRadius = 330) {
      for (let tries = 0; tries < 40; tries++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        let x = OSMOSIS_CENTER.x + Math.cos(angle) * radius;
        let y = OSMOSIS_CENTER.y + Math.sin(angle) * radius;
        x = Math.max(72, Math.min(828, x));
        y = Math.max(132, Math.min(492, y));
        const dist = Math.hypot(x - OSMOSIS_CENTER.x, y - OSMOSIS_CENTER.y);
        const tooCloseToSalt = (state.osmosisAmbientSprites || []).some(s =>
          s.type === "salt" && s.g && s.g.isConnected && Math.hypot(x - s.x, y - s.y) < 52
        );
        if (dist >= minRadius - 8 && !tooCloseToSalt) return { x, y };
      }
      return { x: 120 + Math.random() * 660, y: 140 + Math.random() * 330 };
    }

    function createOsmosisAmbientSprite(type) {
      const layer = document.getElementById("osmosisAmbientLayer");
      if (!layer) return null;
      const p = type === "salt" ? randomOsmosisOutsidePoint(235, 350) : randomOsmosisOutsidePoint(185, 330);
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", `demo-particle osmosis-${type}`);
      g.setAttribute("transform", `translate(${p.x} ${p.y})`);
      if (type === "salt") {
        g.innerHTML = `
          <rect x="-10" y="-10" width="20" height="20" rx="5" fill="#f8fafc" stroke="#fde68a" stroke-width="3"/>
          <text class="demo-particle-label" x="0" y="-18">Salt</text>`;
      } else {
        g.innerHTML = `
          <path d="M0,-9 C6,-4 8,2 6,8 C4,14 -4,14 -6,8 C-8,2 -6,-4 0,-9 Z" fill="#38bdf8" stroke="#bae6fd" stroke-width="2"/>
          <text class="demo-particle-label" x="0" y="-18">Water</text>`;
      }
      layer.appendChild(g);
      return {
        id: state.nextDemoObjectId++,
        type,
        g,
        x: p.x,
        y: p.y,
        vx: (Math.random() * 24 - 12) || 8,
        vy: (Math.random() * 24 - 12) || -8,
        phase: Math.random() * Math.PI * 2,
        busy: false,
        lassoed: false,
        anchored: false,
        trappedCount: 0,
        trappedSlots: { left: null, right: null, top: null, bottom: null }
      };
    }

    function syncOsmosisAmbientSprites(salt) {
      const layer = document.getElementById("osmosisAmbientLayer");
      if (!layer) return;
      state.osmosisAmbientSprites = (state.osmosisAmbientSprites || []).filter(s => s.g && s.g.isConnected);

      const targetSalt = salt > 55 ? Math.min(12, Math.round((salt - 45) / 4)) : 0;
      const targetWater = salt < 45 ? Math.min(20, 7 + Math.round((45 - salt) / 3)) : Math.max(3, Math.round((105 - salt) / 28));

      const countType = (type) => state.osmosisAmbientSprites.filter(s => s.type === type).length;
      while (countType("salt") < targetSalt) {
        const sprite = createOsmosisAmbientSprite("salt");
        if (sprite) state.osmosisAmbientSprites.push(sprite); else break;
      }
      while (countType("water") < targetWater) {
        const sprite = createOsmosisAmbientSprite("water");
        if (sprite) state.osmosisAmbientSprites.push(sprite); else break;
      }

      for (const type of ["salt", "water"]) {
        let sprites = state.osmosisAmbientSprites.filter(s =>
          s.type === type && !s.busy && !s.anchored && !(s.trappedCount > 0)
        );
        const target = type === "salt" ? targetSalt : targetWater;
        while (sprites.length > target) {
          const s = sprites.pop();
          if (s && s.g) s.g.remove();
          state.osmosisAmbientSprites = state.osmosisAmbientSprites.filter(sprite => sprite !== s);
        }
      }
    }

    function startOsmosisCellMotion() {
      const runId = state.demoRunId;

      function step(now) {
        try {
          if (runId !== state.demoRunId || !currentLevel().membraneDemoMode || currentLevel().demoStage !== "waterBalance") return;

          const t = now / 1000;
          const motionGroup = document.getElementById("osmosisCellMotionGroup");
          const scaleGroup = document.getElementById("osmosisCellScaleGroup");
          const rotateGroup = document.getElementById("osmosisInnerRotateGroup");

          const baseScale = state.osmosisCellScaleBase ?? 1;
          const breatheScale = baseScale * (1 + Math.sin(t * 2.2) * 0.035);

          // Planet-like spin: slow enough to read, but obvious enough to feel alive.
          const planetSpin = (t * 12) % 360;
          const wobble = Math.sin(t * 1.1) * 2.2;
          const planetAngle = planetSpin + wobble;
          state.osmosisCellAngle = planetAngle;

          // Channels do not scale in size. They only move outward/inward to stay attached to the shell.
          const channelRadius = Math.max(78, Math.min(168, 99 * breatheScale + 18));
          state.osmosisChannelRadius = channelRadius;

          if (motionGroup) {
            motionGroup.setAttribute("transform", `translate(${OSMOSIS_CENTER.x} ${OSMOSIS_CENTER.y}) rotate(${planetAngle.toFixed(2)})`);
          }

          document.querySelectorAll(".osmosis-channel").forEach((channelNode, i) => {
            const baseAngle = OSMOSIS_CHANNELS[i]?.angle ?? Number(channelNode.dataset.angle || 0);
            const angleRad = baseAngle * Math.PI / 180;
            const x = Math.cos(angleRad) * channelRadius;
            const y = Math.sin(angleRad) * channelRadius;
            channelNode.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(baseAngle + 90).toFixed(1)})`);
          });

          if (scaleGroup) {
            scaleGroup.setAttribute("transform", `scale(${breatheScale.toFixed(3)})`);
          }
          if (rotateGroup) {
            rotateGroup.setAttribute("transform", `rotate(${((t * 30) % 360).toFixed(2)})`);
          }

          const frameId = requestAnimationFrame(step);
          state.demoFrames.push(frameId);
        } catch (err) {
          console.warn("Osmosis cell motion paused instead of breaking the level:", err);
        }
      }

      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function startOsmosisAmbientMotion() {
      const runId = state.demoRunId;
      function step(now) {
        if (runId !== state.demoRunId || !currentLevel().membraneDemoMode || currentLevel().demoStage !== "waterBalance") return;
        const dt = 1 / 60;
        const size = state.osmosisCellScaleBase ?? 1;
        const baseAvoid = 134 * size;
        (state.osmosisAmbientSprites || []).forEach(sprite => {
          if (!sprite.g || !sprite.g.isConnected || sprite.busy || sprite.anchored) return;
          sprite.phase += dt * 2;
          sprite.x += sprite.vx * dt;
          sprite.y += sprite.vy * dt;
          if (sprite.x < 58 || sprite.x > 842) sprite.vx *= -1;
          if (sprite.y < 122 || sprite.y > 500) sprite.vy *= -1;
          sprite.x = Math.max(58, Math.min(842, sprite.x));
          sprite.y = Math.max(122, Math.min(500, sprite.y));

          const dx = sprite.x - OSMOSIS_CENTER.x;
          const dy = sprite.y - OSMOSIS_CENTER.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const avoidRadius = sprite.type === "salt" ? Math.max(218, baseAvoid + 78) : Math.max(160, baseAvoid + 20);
          if (dist < avoidRadius) {
            const push = (avoidRadius - dist) * (sprite.type === "salt" ? .09 : .045);
            sprite.vx += (dx / dist) * push;
            sprite.vy += (dy / dist) * push;
            sprite.x += (dx / dist) * push * .8;
            sprite.y += (dy / dist) * push * .8;
          }

          // Salt chunks bounce away from each other so their labels do not stack.
          if (sprite.type === "salt") {
            (state.osmosisAmbientSprites || []).forEach(other => {
              if (other === sprite || other.type !== "salt" || other.busy || !other.g || !other.g.isConnected) return;
              const odx = sprite.x - other.x;
              const ody = sprite.y - other.y;
              const odist = Math.max(1, Math.hypot(odx, ody));
              const minSaltDist = 54;
              if (odist < minSaltDist) {
                const repel = (minSaltDist - odist) * .075;
                sprite.vx += (odx / odist) * repel;
                sprite.vy += (ody / odist) * repel;
                sprite.x += (odx / odist) * repel * 1.6;
                sprite.y += (ody / odist) * repel * 1.6;
              }
            });
          }

          // Slight orbit feeling, like free particles drifting around a planet.
          const tangent = sprite.type === "water" ? .014 : .008;
          sprite.vx += (-dy / dist) * tangent;
          sprite.vy += (dx / dist) * tangent;

          const speed = Math.hypot(sprite.vx, sprite.vy);
          const maxSpeed = sprite.type === "water" ? 32 : 22;
          if (speed > maxSpeed) {
            sprite.vx = sprite.vx / speed * maxSpeed;
            sprite.vy = sprite.vy / speed * maxSpeed;
          }

          const wobbleX = Math.sin(sprite.phase) * 3;
          const wobbleY = Math.cos(sprite.phase * 1.3) * 3;
          sprite.g.setAttribute("transform", `translate(${(sprite.x + wobbleX).toFixed(1)} ${(sprite.y + wobbleY).toFixed(1)})`);
        });
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      }
      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function findNearestAmbientSprite(type, point) {
      const candidates = (state.osmosisAmbientSprites || []).filter(s =>
        s.type === type && !s.busy && s.g && s.g.isConnected
      );
      if (!candidates.length) return null;
      candidates.sort((a, b) => {
        const da = Math.hypot(a.x - point.x, a.y - point.y);
        const db = Math.hypot(b.x - point.x, b.y - point.y);
        return da - db;
      });
      return candidates[0];
    }

    function getOpenSaltSlot(saltSprite) {
      if (!saltSprite) return null;
      const order = ["left", "right", "top", "bottom"];
      return order.find(slot => !saltSprite.trappedSlots?.[slot]) || null;
    }

    function findNearestAvailableSaltSprite(point) {
      const candidates = (state.osmosisAmbientSprites || []).filter(s =>
        s.type === "salt" && !s.busy && s.g && s.g.isConnected && getOpenSaltSlot(s)
      );
      if (!candidates.length) return null;
      candidates.sort((a, b) => {
        const da = Math.hypot(a.x - point.x, a.y - point.y);
        const db = Math.hypot(b.x - point.x, b.y - point.y);
        return da - db;
      });
      return candidates[0];
    }

    function addWaterToSaltCluster(saltSprite, slot) {
      if (!saltSprite || !saltSprite.g || !saltSprite.g.isConnected) return;
      const slotOffsets = {
        left: { x: -28, y: 0 },
        right: { x: 28, y: 0 },
        top: { x: 0, y: -28 },
        bottom: { x: 0, y: 28 }
      };
      const offset = slotOffsets[slot];
      const water = document.createElementNS("http://www.w3.org/2000/svg", "path");
      water.setAttribute("d", "M0,-9 C6,-4 8,2 6,8 C4,14 -4,14 -6,8 C-8,2 -6,-4 0,-9 Z");
      water.setAttribute("fill", "#38bdf8");
      water.setAttribute("stroke", "#bae6fd");
      water.setAttribute("stroke-width", "2");
      water.setAttribute("transform", `translate(${offset.x} ${offset.y})`);
      water.setAttribute("class", `salt-cluster-water salt-slot-${slot}`);

      saltSprite.g.appendChild(water);
      saltSprite.trappedSlots[slot] = water;
      saltSprite.trappedCount = (saltSprite.trappedCount || 0) + 1;
      saltSprite.anchored = true;
      saltSprite.g.setAttribute("transform", `translate(${saltSprite.x} ${saltSprite.y})`);
    }

    function triggerSaltClusterFade(saltSprite) {
      if (!saltSprite || !saltSprite.g || !saltSprite.g.isConnected) return;
      saltSprite.busy = true;
      saltSprite.anchored = true;
      saltSprite.g.animate([
        { opacity: 1, filter: "drop-shadow(0 0 0px rgba(250,204,21,0))" },
        { opacity: 1, filter: "drop-shadow(0 0 18px rgba(250,204,21,.95)) drop-shadow(0 0 10px rgba(103,232,249,.85))" },
        { opacity: 1, filter: "drop-shadow(0 0 2px rgba(250,204,21,.25))" },
        { opacity: 1, filter: "drop-shadow(0 0 18px rgba(250,204,21,.95)) drop-shadow(0 0 10px rgba(103,232,249,.85))" },
        { opacity: 0, filter: "drop-shadow(0 0 0px rgba(250,204,21,0))" }
      ], { duration: 1200, easing: "ease-in-out" });
      demoSetTimeout(() => {
        if (saltSprite.g && saltSprite.g.isConnected) saltSprite.g.remove();
        state.osmosisAmbientSprites = (state.osmosisAmbientSprites || []).filter(s => s !== saltSprite);
      }, 1240);
    }

    function freezeEscapedWaterWithSalt(waterG, x, y, options = {}) {
      if (!waterG || !waterG.isConnected) return;
      const layer = document.getElementById("demoParticles");
      if (!layer) return;

      const allowCreateSalt = options.createSalt !== false;
      let saltSprite = findNearestAvailableSaltSprite({ x, y });
      if (!saltSprite && allowCreateSalt) {
        saltSprite = createOsmosisAmbientSprite("salt");
        if (saltSprite) {
          state.osmosisAmbientSprites.push(saltSprite);
          saltSprite.x = Math.max(72, Math.min(828, x + 62));
          saltSprite.y = Math.max(132, Math.min(492, y - 24));
          saltSprite.g.setAttribute("transform", `translate(${saltSprite.x} ${saltSprite.y})`);
        }
      }
      if (!saltSprite) {
        waterG.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
        demoSetTimeout(() => waterG.remove(), 460);
        return;
      }

      const slot = getOpenSaltSlot(saltSprite);
      if (!slot) {
        waterG.remove();
        return;
      }

      const slotOffsets = {
        left: { x: -28, y: 0 },
        right: { x: 28, y: 0 },
        top: { x: 0, y: -28 },
        bottom: { x: 0, y: 28 }
      };

      const sx = saltSprite.x;
      const sy = saltSprite.y;
      const target = {
        x: sx + slotOffsets[slot].x,
        y: sy + slotOffsets[slot].y
      };

      saltSprite.busy = true;
      saltSprite.anchored = true;
      saltSprite.vx = 0;
      saltSprite.vy = 0;
      saltSprite.g.setAttribute("transform", `translate(${sx} ${sy})`);

      const lasso = document.createElementNS("http://www.w3.org/2000/svg", "g");
      lasso.setAttribute("class", "demo-particle salt-lasso");
      const lassoPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      lassoPath.setAttribute("fill", "none");
      lassoPath.setAttribute("stroke", "#fde047");
      lassoPath.setAttribute("stroke-width", "4");
      lassoPath.setAttribute("stroke-linecap", "round");
      lassoPath.setAttribute("stroke-linejoin", "round");
      lassoPath.setAttribute("stroke-dasharray", "8 6");
      lassoPath.setAttribute("filter", "drop-shadow(0 0 12px rgba(250,204,21,.95))");

      const zaps = document.createElementNS("http://www.w3.org/2000/svg", "g");
      zaps.setAttribute("opacity", "0");
      const makeZap = (t, offset) => {
        const mx = sx + (target.x - sx) * t;
        const my = sy + (target.y - sy) * t;
        const z = document.createElementNS("http://www.w3.org/2000/svg", "path");
        z.setAttribute("d", `M${mx - 12},${my - 7} L${mx + 1},${my - 1} L${mx - 5},${my + 12} L${mx + 14},${my + 1}`);
        z.setAttribute("fill", "none");
        z.setAttribute("stroke", offset % 2 ? "#fef3c7" : "#67e8f9");
        z.setAttribute("stroke-width", "3");
        z.setAttribute("stroke-linecap", "round");
        z.setAttribute("stroke-linejoin", "round");
        z.setAttribute("filter", "drop-shadow(0 0 9px rgba(250,204,21,.9))");
        return z;
      };
      zaps.appendChild(makeZap(.34, 1));
      zaps.appendChild(makeZap(.62, 2));

      const anchorRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      anchorRing.setAttribute("cx", sx);
      anchorRing.setAttribute("cy", sy);
      anchorRing.setAttribute("r", "17");
      anchorRing.setAttribute("fill", "none");
      anchorRing.setAttribute("stroke", "#fde047");
      anchorRing.setAttribute("stroke-width", "3");
      anchorRing.setAttribute("stroke-dasharray", "5 5");
      anchorRing.setAttribute("filter", "drop-shadow(0 0 10px rgba(250,204,21,.9))");

      if (saltSprite.g && saltSprite.g.isConnected) {
        saltSprite.g.animate([
          { opacity: 1, filter: "drop-shadow(0 0 0px rgba(250,204,21,0))" },
          { opacity: 1, filter: "drop-shadow(0 0 14px rgba(250,204,21,.95))" },
          { opacity: 1, filter: "drop-shadow(0 0 4px rgba(250,204,21,.35))" }
        ], { duration: 420, iterations: 5, easing: "ease-in-out" });
      }

      lasso.appendChild(lassoPath);
      lasso.appendChild(anchorRing);
      lasso.appendChild(zaps);
      layer.appendChild(lasso);

      const startTime = performance.now();
      const duration = 1350;
      const pullStart = { x, y };
      const waterBody = waterG.querySelector(".demo-particle-body");

      function step(now) {
        if (!waterG.isConnected || !lasso.isConnected) return;
        const p = Math.min(1, (now - startTime) / duration);
        const ease = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const wx = pullStart.x + (target.x - pullStart.x) * ease;
        const wy = pullStart.y + (target.y - pullStart.y) * ease;
        const midX = (sx + wx) / 2 + Math.sin(now / 55) * 16;
        const midY = (sy + wy) / 2 + Math.cos(now / 62) * 12;
        lassoPath.setAttribute("d", `M${sx},${sy} Q${midX},${midY} ${wx},${wy}`);
        waterG.setAttribute("transform", `translate(${wx.toFixed(1)} ${wy.toFixed(1)})`);
        if (waterBody) waterBody.setAttribute("transform", `scale(${(1 + Math.sin(now / 70) * .08).toFixed(2)})`);
        zaps.setAttribute("opacity", (Math.floor(now / 110) % 2) ? "1" : ".25");

        if (p < 1) {
          const frameId = requestAnimationFrame(step);
          state.demoFrames.push(frameId);
        } else {
          zaps.setAttribute("opacity", "1");
          addWaterToSaltCluster(saltSprite, slot);
          waterG.remove();
          lasso.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: "ease-out" });
          demoSetTimeout(() => lasso.remove(), 520);

          saltSprite.busy = false;
          if ((saltSprite.trappedCount || 0) >= 4) {
            triggerSaltClusterFade(saltSprite);
          }
        }
      }
      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function osmosisPoint(radius, angleDeg, jitter = 0, includeCellRotation = true) {
      const rot = includeCellRotation ? (state.osmosisCellAngle || 0) : 0;
      const angle = (angleDeg + rot) * Math.PI / 180;
      const j = jitter ? (Math.random() * jitter * 2 - jitter) : 0;
      return {
        x: OSMOSIS_CENTER.x + Math.cos(angle) * (radius + j),
        y: OSMOSIS_CENTER.y + Math.sin(angle) * (radius + j)
      };
    }

    function osmosisChannelPoint(channel, offset = 0, jitter = 0) {
      return osmosisPoint((state.osmosisChannelRadius || 112) + offset, channel.angle, jitter, true);
    }

    function osmosisDockLine(channel) {
      const angleDeg = channel.angle + (state.osmosisCellAngle || 0);
      const angle = angleDeg * Math.PI / 180;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const base = state.osmosisChannelRadius || 112;
      return { angleDeg, ux, uy, base };
    }

    function pointOnDockLine(channel, radiusOffset = 0) {
      const d = osmosisDockLine(channel);
      return {
        x: OSMOSIS_CENTER.x + d.ux * (d.base + radiusOffset),
        y: OSMOSIS_CENTER.y + d.uy * (d.base + radiusOffset)
      };
    }

    function nearestOsmosisChannelToPoint(point, offset = 78) {
      let best = OSMOSIS_CHANNELS[0];
      let bestDist = Infinity;
      OSMOSIS_CHANNELS.forEach(channel => {
        const dock = pointOnDockLine(channel, offset);
        const dist = Math.hypot(point.x - dock.x, point.y - dock.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = channel;
        }
      });
      return best;
    }

    function findBestWaterAndChannelForDocking() {
      const candidates = (state.osmosisAmbientSprites || []).filter(s =>
        s.type === "water" && !s.busy && s.g && s.g.isConnected
      );

      if (!candidates.length) {
        const waterSprite = createOsmosisAmbientSprite("water");
        if (waterSprite) {
          state.osmosisAmbientSprites.push(waterSprite);
          return {
            waterSprite,
            channel: nearestOsmosisChannelToPoint({ x: waterSprite.x, y: waterSprite.y }, 78)
          };
        }
        return { waterSprite: null, channel: OSMOSIS_CHANNELS[0] };
      }

      let bestWater = candidates[0];
      let bestChannel = nearestOsmosisChannelToPoint({ x: bestWater.x, y: bestWater.y }, 78);
      let bestDist = Infinity;

      candidates.forEach(sprite => {
        OSMOSIS_CHANNELS.forEach(channel => {
          const dock = pointOnDockLine(channel, 78);
          const dist = Math.hypot(sprite.x - dock.x, sprite.y - dock.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestWater = sprite;
            bestChannel = channel;
          }
        });
      });

      return { waterSprite: bestWater, channel: bestChannel };
    }

    function feedAmbientWaterToSaltCluster(waterSprite) {
      if (!waterSprite || !waterSprite.g || !waterSprite.g.isConnected) return false;
      const saltSprite = findNearestAvailableSaltSprite({ x: waterSprite.x, y: waterSprite.y });
      if (!saltSprite) return false;

      const layer = document.getElementById("demoParticles");
      if (layer) layer.appendChild(waterSprite.g);
      waterSprite.busy = true;
      state.osmosisAmbientSprites = (state.osmosisAmbientSprites || []).filter(s => s !== waterSprite);
      freezeEscapedWaterWithSalt(waterSprite.g, waterSprite.x, waterSprite.y, { createSalt: false });
      return true;
    }

    function removeAmbientSprite(sprite) {
      state.osmosisAmbientSprites = (state.osmosisAmbientSprites || []).filter(s => s !== sprite);
      if (sprite && sprite.g && sprite.g.isConnected) sprite.g.remove();
    }

    function smoothStep(t) {
      t = Math.max(0, Math.min(1, t));
      return t * t * (3 - 2 * t);
    }

    function lerpPoint(a, b, t) {
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
    }

    function createLooseWaterParticle(x, y) {
      const g = demoGroup("", `<path d="M0,-8 C5,-4 7,1 6,6 C4,11 -4,11 -6,6 C-7,1 -5,-4 0,-8 Z" fill="#38bdf8" stroke="#e0f2fe" stroke-width="2"/>`, x, y);
      const label = g.querySelector(".demo-particle-label");
      if (label) label.remove();
      return g;
    }

    function waterDockPosition(startPoint, channel, progress, direction) {
      // No random jitter here: the channel rotates, but the droplet follows a smooth docking line.
      const d = osmosisDockLine(channel);
      const radialOffset = direction === "in"
        ? lerp(78, -82, smoothStep(progress))
        : lerp(-82, 78, smoothStep(progress));

      const channelPoint = {
        x: OSMOSIS_CENTER.x + d.ux * (d.base + radialOffset),
        y: OSMOSIS_CENTER.y + d.uy * (d.base + radialOffset)
      };

      if (direction === "in") {
        // Early in the path, smoothly blend from the original roaming-water position
        // into the rotating channel line. After that, follow the channel line only.
        const capture = smoothStep(Math.min(1, progress / .36));
        return lerpPoint(startPoint, channelPoint, capture);
      }

      return channelPoint;
    }

    function animateExistingWaterIntoChannel(waterSprite, channel, index = 0) {
      if (!waterSprite || !waterSprite.g || !waterSprite.g.isConnected) return false;
      const layer = document.getElementById("demoParticles");
      if (layer) layer.appendChild(waterSprite.g);

      waterSprite.busy = true;
      const startPoint = { x: waterSprite.x, y: waterSprite.y };
      const startTime = performance.now();
      const duration = 1950 + index * 60;
      const runId = state.demoRunId;
      const body = waterSprite.g.querySelector(".demo-particle-body");

      function step(now) {
        if (runId !== state.demoRunId || !waterSprite.g || !waterSprite.g.isConnected) return;
        const progress = Math.min(1, (now - startTime) / duration);
        const p = waterDockPosition(startPoint, channel, progress, "in");

        waterSprite.g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        waterSprite.g.style.opacity = progress > .90 ? Math.max(0, 1 - (progress - .90) / .10) : 1;
        if (body) body.setAttribute("transform", `scale(${(1 - progress * .10).toFixed(2)})`);

        if (progress < 1) {
          const frameId = requestAnimationFrame(step);
          state.demoFrames.push(frameId);
        } else {
          removeAmbientSprite(waterSprite);
        }
      }

      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
      return true;
    }

    function animateWaterOutOfChannel(channel, saltyTrap, index = 0) {
      const start = pointOnDockLine(channel, -82);
      const g = createLooseWaterParticle(start.x, start.y);
      const startTime = performance.now();
      const duration = 1650 + index * 60;
      const runId = state.demoRunId;
      const body = g.querySelector(".demo-particle-body");

      function step(now) {
        if (runId !== state.demoRunId || !g.isConnected) return;
        const progress = Math.min(1, (now - startTime) / duration);
        const p = waterDockPosition(start, channel, progress, "out");

        g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        if (body) body.setAttribute("transform", "scale(1)");

        if (progress < 1) {
          const frameId = requestAnimationFrame(step);
          state.demoFrames.push(frameId);
        } else if (saltyTrap) {
          freezeEscapedWaterWithSalt(g, p.x, p.y);
        } else {
          g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
          demoSetTimeout(() => g.remove(), 480);
        }
      }

      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function animateOsmosisWater(direction, intensity = 2) {
      const bursts = Math.max(1, Math.min(7, intensity));
      const saltyTrap = direction === "out" && (state.stats.outsideSalt ?? 50) > 60;

      for (let i = 0; i < bursts; i++) {
        demoSetTimeout(() => {
          if (direction === "in") {
            const dockTarget = findBestWaterAndChannelForDocking();
            if (dockTarget.waterSprite) {
              const hasSaltToClear = !!findNearestAvailableSaltSprite({ x: dockTarget.waterSprite.x, y: dockTarget.waterSprite.y });
              const balancedSaltCleanup = hasSaltToClear && (state.stats.outsideSalt ?? 50) <= 60;
              if (balancedSaltCleanup && feedAmbientWaterToSaltCluster(dockTarget.waterSprite)) return;
              animateExistingWaterIntoChannel(dockTarget.waterSprite, dockTarget.channel, i);
            }
          } else {
            const channel = OSMOSIS_CHANNELS[Math.floor(Math.random() * OSMOSIS_CHANNELS.length)];
            animateWaterOutOfChannel(channel, saltyTrap, i);
          }
        }, i * 130);
      }
    }

    function feedAddedWaterToSaltClusters(count = 5) {
      const layer = document.getElementById("demoParticles");
      if (!layer) return;

      let launched = 0;
      let attempts = 0;

      const pickSalt = () => {
        const salts = (state.osmosisAmbientSprites || []).filter(s =>
          s.type === "salt" &&
          !s.busy &&
          s.g && s.g.isConnected &&
          getOpenSaltSlot(s)
        );
        if (!salts.length) return null;

        // Prefer partly-filled salts so the player sees clusters complete and disappear.
        salts.sort((a, b) => (b.trappedCount || 0) - (a.trappedCount || 0));
        return salts[0];
      };

      const launchOne = () => {
        attempts += 1;
        if (launched >= count || attempts > count * 4) return;

        const salt = pickSalt();
        if (!salt) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = 86 + Math.random() * 70;
        const x = Math.max(72, Math.min(828, salt.x + Math.cos(angle) * dist));
        const y = Math.max(132, Math.min(492, salt.y + Math.sin(angle) * dist));
        const g = createLooseWaterParticle(x, y);
        freezeEscapedWaterWithSalt(g, x, y, { createSalt: false });

        launched += 1;

        if (launched < count) {
          // Wait long enough that a salt can finish one lasso before taking another.
          demoSetTimeout(launchOne, 1450);
        }
      };

      // Kick off a small chain of added water being grabbed by existing salt.
      demoSetTimeout(launchOne, 140);
    }

    function animateBalancedOsmosisExchange() {
      // Isotonic state: water still moves both ways, but the net effect is zero.
      animateOsmosisWater("in", 3);
      demoSetTimeout(() => {
        if (state.levelLost || !currentLevel().membraneDemoMode || currentLevel().demoStage !== "waterBalance") return;
        animateOsmosisWater("out", 2);
      }, 260);
    }

    function adjustOutsideSalt(delta, message) {
      if (!currentLevel().membraneDemoMode || currentLevel().demoStage !== "waterBalance") return;
      adjustStats({ outsideSalt: delta });
      if (delta < 0) {
        feedAddedWaterToSaltClusters(Math.min(6, Math.max(3, Math.ceil(Math.abs(delta) / 3))));
      }
      membraneFeedback(message + (delta < 0 ? " Added water can also get grabbed by outside salt until those salt clusters disappear." : " Water will move automatically through the cell's water channels."), 3, 5200);
      updateOsmosisVisuals();
    }

    function startWaterBalanceDemo() {
      state.osmosisHealthySeconds = 0;
      state.osmosisTickCount = 0;
      state.osmosisDriftDirection = Math.random() < .5 ? -1 : 1;
      restoreOsmosisCellBody();
      updateOsmosisVisuals();
      try {
        startOsmosisCellMotion();
        startOsmosisAmbientMotion();
      } catch (err) {
        console.warn("Osmosis motion setup skipped instead of breaking the level:", err);
      }
      membraneFeedback(`Keep Outside Salt Level near 50 for ${OSMOSIS_GOAL_SECONDS} seconds. You change the outside condition, and the whole cell swells or shrinks while water moves automatically through the channels.`, 3, 9000);

      demoSetInterval(() => {
        if (state.levelLost || !currentLevel().membraneDemoMode || currentLevel().demoStage !== "waterBalance") return;
        state.osmosisTickCount += 1;

        if (state.osmosisTickCount % 6 === 0) {
          if ((state.stats.outsideSalt ?? 50) >= 78) state.osmosisDriftDirection = -1;
          else if ((state.stats.outsideSalt ?? 50) <= 22) state.osmosisDriftDirection = 1;
          else if (Math.random() < .35) state.osmosisDriftDirection *= -1;
        }

        const salt = state.stats.outsideSalt ?? 50;
        adjustStats({ outsideSalt: state.osmosisDriftDirection * 2 });

        const nextSalt = state.stats.outsideSalt ?? 50;
        let waterDelta = 0;
        let sizeDelta = 0;
        let direction = "balanced";
        if (nextSalt > 70) { waterDelta = -4; sizeDelta = -3; direction = "out"; }
        else if (nextSalt > 60) { waterDelta = -3; sizeDelta = -2; direction = "out"; }
        else if (nextSalt < 30) { waterDelta = +5; sizeDelta = +5; direction = "in"; }
        else if (nextSalt < 40) { waterDelta = +4; sizeDelta = +3; direction = "in"; }
        else {
          const waterToward = (50 - (state.stats.water ?? 50));
          const sizeToward = (50 - (state.stats.size ?? 50));
          waterDelta = Math.abs(waterToward) <= 1 ? 0 : Math.sign(waterToward) * 2;
          sizeDelta = Math.abs(sizeToward) <= 1 ? 0 : Math.sign(sizeToward) * 2;
        }

        if (waterDelta || sizeDelta) adjustStats({ water: waterDelta, size: sizeDelta });
        if (direction === "out" || direction === "in") {
          animateOsmosisWater(direction, Math.abs(waterDelta) >= 4 ? 6 : 3);
        } else if (state.osmosisTickCount % 2 === 0) {
          animateBalancedOsmosisExchange();
        }

        const balanced = Math.abs((state.stats.outsideSalt ?? 50) - 50) <= 15 &&
          (state.stats.water ?? 50) >= 35 && (state.stats.water ?? 50) <= 70 &&
          (state.stats.size ?? 50) >= 38 && (state.stats.size ?? 50) <= 68;

        const dangerSize = (state.stats.size ?? 50) <= 18 || (state.stats.size ?? 50) >= 90;
        state.osmosisDangerTicks = dangerSize ? (state.osmosisDangerTicks || 0) + 1 : 0;

        if (balanced) state.osmosisHealthySeconds += 1;
        else state.osmosisHealthySeconds = Math.max(0, state.osmosisHealthySeconds - 1);

        updateOsmosisVisuals();
        evaluateLossConditions();

        if (!state.completedLevel && state.osmosisHealthySeconds >= OSMOSIS_GOAL_SECONDS) {
          markAction("waterBalanceSurvive");
          membraneFeedback(`Water balance held for ${OSMOSIS_GOAL_SECONDS} seconds. The cell stayed healthy!`, 4, 7000);
          completeOsmosisSideQuest();
        } else if (state.osmosisTickCount % 5 === 0) {
          if (nextSalt > 60) membraneFeedback("Outside is too salty, so water is leaving and the cell may shrink.", 2, 3600);
          else if (nextSalt < 40) membraneFeedback("Outside is too watery, so water is entering and the cell may swell.", 2, 3600);
          else membraneFeedback(`Balanced zone. Healthy time: ${state.osmosisHealthySeconds}/${OSMOSIS_GOAL_SECONDS}s`, 2, 3000);
        }
      }, OSMOSIS_TICK_MS);
    }

    function showOsmosisPreviewPopup() {
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return false;
      state.transportPreludePopupOpen = true;
      popup.innerHTML = `
        <div class="learning-card">
          <div class="learning-step">Osmosis Challenge Preview</div>
          <h3>Keep the Cell Balanced</h3>
          <div class="learning-grid">
            <div class="learning-sim-preview">
              <div class="intro-bubbles" aria-label="Osmosis controls and evidence">
                <div class="intro-bubble"><span>Salt</span>Outside Salt changes water direction</div>
                <div class="intro-bubble"><span>H2O</span>Water moves through channels</div>
                <div class="intro-bubble"><span>20s</span>Stay healthy for ${OSMOSIS_GOAL_SECONDS} seconds</div>
              </div>
            </div>
            <div class="learning-copy-column">
              <div class="learning-point-bubble big-panel">
                <p><b>What to watch:</b> Outside Salt Level, Water, and Cell size.</p>
                <p><b>Too salty outside:</b> water leaves the cell, so the cell shrinks.</p>
                <p><b>Too watery outside:</b> water enters the cell, so the cell swells.</p>
                <p><b>Your job:</b> use Add Salt, Add Water, or Balance Outside to keep the cell near the healthy zone.</p>
              </div>
            </div>
          </div>
          <div class="learning-actions">
            <button class="primary" onclick="beginOsmosisChallengeDemo()">Start Osmosis Challenge</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
      return true;
    }

    function showOsmosisRecapPopup(outcome = "win") {
      if (state.osmosisRecapShown && outcome !== "manual") return false;
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return false;
      state.osmosisRecapShown = true;
      state.transportPreludePopupOpen = true;

      const won = outcome === "win";
      const title = won ? "Osmosis Recap: Cell Stayed Healthy" : "Osmosis Recap: What Changed?";
      const result = won
        ? "You kept the outside environment close enough to balanced, so water moved in and out without swelling or shrinking the cell too much."
        : (state.lossReason || "The cell moved too far away from a healthy water balance.");
      const sideQuestActions = state.osmosisSideQuestActive ? `
            <button class="primary" onclick="returnToWaterChannelRecap()">Back to Water Recap</button>
          ` : "";
      const retryAction = won ? "" : `<button class="warning" onclick="retryOsmosisChallenge()">Retry Osmosis</button>`;

      popup.innerHTML = `
        <div class="learning-card">
          <div class="learning-step">${won ? "Challenge Complete" : "Challenge Recap"}</div>
          <h3>${title}</h3>
          <div class="learning-grid">
            <div class="learning-sim-preview">
              <div class="intro-bubbles" aria-label="Osmosis recap">
                <div class="intro-bubble"><span>50</span>Salt near 50 is balanced</div>
                <div class="intro-bubble"><span>Out</span>Too salty pulls water out</div>
                <div class="intro-bubble"><span>In</span>Too watery pushes water in</div>
              </div>
            </div>
            <div class="learning-copy-column">
              <div class="learning-point-bubble big-panel">
                <p><b>Result:</b> ${result}</p>
                <p><b>Science idea:</b> osmosis is water moving across a membrane toward the side that needs balance.</p>
                <p><b>Evidence:</b> the Outside Salt, Water, and Cell size values showed the cell shrinking, swelling, or staying healthy.</p>
              </div>
            </div>
          </div>
          <div class="learning-actions">
            ${retryAction}
            ${sideQuestActions}
            <button class="ghost" onclick="closeLearningPopup()">Close Recap</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
      return true;
    }

    function beginOsmosisChallengeDemo() {
      closeLearningPopup();
      runMembraneStageAnimation("waterBalance");
    }

    function retryOsmosisChallenge() {
      loadLevel(state.levelIndex);
    }
