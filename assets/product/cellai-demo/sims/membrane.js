// === Membrane simulation =========================================================
// The interactive membrane demo engine for the 6th-grade CellAI Factory game:
// transport preludes, water/glucose/waste drag challenges, the smart-border toxin
// system (blocked/sneaky/damaging), Cleaner/Garbage-Man proteins, membrane repair,
// and the membrane-demo visuals/timers.
//
// Loaded as a classic <script> BEFORE the main inline script, so every function here
// is hoisted onto window and is callable from the engine, inline onclick handlers, and
// sims/osmosis.js. Shared engine state/helpers (state, currentLevel, setStats,
// renderStats, particle/burst, the demo-config constants, etc.) stay in index.html and
// are referenced here at call time only.

    function playLeverClickSfx() {
      const ctx = getSfxAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.115);
      master.connect(ctx.destination);

      const low = ctx.createOscillator();
      low.type = "triangle";
      low.frequency.setValueAtTime(145, now);
      low.frequency.exponentialRampToValueAtTime(72, now + 0.08);
      low.connect(master);
      low.start(now);
      low.stop(now + 0.12);

      const highGain = ctx.createGain();
      highGain.gain.setValueAtTime(0.0001, now + 0.015);
      highGain.gain.exponentialRampToValueAtTime(0.10, now + 0.02);
      highGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      highGain.connect(ctx.destination);

      const high = ctx.createOscillator();
      high.type = "square";
      high.frequency.setValueAtTime(620, now + 0.015);
      high.frequency.exponentialRampToValueAtTime(360, now + 0.055);
      high.connect(highGain);
      high.start(now + 0.015);
      high.stop(now + 0.06);
    }

    function playWastePackSfx() {
      const ctx = getSfxAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      master.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.055);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.12);
      osc.connect(master);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    function playVesicleBubbleSfx(delayStart = 0) {
      const ctx = getSfxAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime + Math.max(0, delayStart);
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.24, now + 0.012);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      master.connect(ctx.destination);

      [0, 0.055, 0.12, 0.19].forEach((delay, i) => {
        const popGain = ctx.createGain();
        popGain.gain.setValueAtTime(0.0001, now + delay);
        popGain.gain.exponentialRampToValueAtTime(0.18 - i * 0.025, now + delay + 0.008);
        popGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.105);
        popGain.connect(master);

        const pop = ctx.createOscillator();
        pop.type = i % 2 ? "sine" : "triangle";
        pop.frequency.setValueAtTime(430 + i * 95, now + delay);
        pop.frequency.exponentialRampToValueAtTime(115 + i * 35, now + delay + 0.095);
        pop.connect(popGain);
        pop.start(now + delay);
        pop.stop(now + delay + 0.115);
      });
    }

    function membraneDemoActionButtons(stage) {
      if (stage === "transport") {
        return "";
      }
      if (stage === "transportReview") {
        return `
          <button onclick="runAction('demoOxygenPass')">Show Oxygen Drift</button>
          <button onclick="runAction('demoGlucoseDoor')">Show Glucose Door</button>
          <button onclick="runAction('demoWaterGate')">Show Water Channel</button>
          <button onclick="runAction('demoWasteExit')">Show Waste Exit</button>
        `;
      }
      if (stage === "waterBalance") {
        return `
          <button class="warning" onclick="runAction('addSaltOutside')">Add Salt Outside</button>
          <button class="primary" onclick="runAction('addWaterOutside')">Add Water Outside</button>
          <button class="success" onclick="runAction('balanceOutside')">Balance Outside</button>
        `;
      }
      if (stage === "sneaky") {
        return `
          <button class="success" onclick="runAction('cleaner')">Send Cleaner Protein out (-5 ATP)</button>
          <button class="primary" onclick="runAction('trashTaker')">Send Garbage Man Protein out (-3 ATP)</button>
        `;
      }
      if (stage === "mixed") {
        return `
          <button class="success" onclick="runAction('cleaner')">Send Cleaner Protein out (-5 ATP)</button>
          <button class="primary" onclick="runAction('trashTaker')">Send Garbage Man Protein out (-3 ATP)</button>
          <button class="warning" onclick="runAction('repairMembrane')">Repair Membrane</button>
        `;
      }
      if (stage === "damaging") {
        return `<button class="warning" onclick="runAction('repairMembrane')">Repair Membrane</button>`;
      }
      return `<button onclick="runAction('demoGlucoseDoor')">Show Glucose Door</button><button onclick="runAction('demoWaterGate')">Show Water Channel</button><button onclick="runAction('demoWasteExit')">Show Waste Exit</button>`;
    }

    function stopMembraneDemo() {
      state.demoRunId += 1;
      state.demoTimers.forEach(id => { clearInterval(id); clearTimeout(id); });
      state.demoTimers = [];
      state.demoFrames.forEach(id => cancelAnimationFrame(id));
      state.demoFrames = [];
      const particles = document.getElementById("demoParticles");
      if (particles) particles.innerHTML = "";
      state.activeSneakyToxins = [];
      state.activeFloatingWaste = [];
      state.cleanupCrewUnits = [];
      state.trashTakerUnits = [];
      state.cleanupWaveActive = false;
      state.trashWaveActive = false;
      state.glucoseAirlockActive = false;
      state.nextDemoObjectId = 1;
      state.feedbackLockUntil = 0;
      state.feedbackPriority = 0;
      state.osmosisHealthySeconds = 0;
      state.osmosisDriftDirection = 1;
      state.osmosisTickCount = 0;
      state.osmosisCellScaleBase = 1;
      state.osmosisCellAngle = 0;
      state.osmosisChannelRadius = 112;
      state.osmosisDangerTicks = 0;
      state.osmosisAmbientSprites = [];
      state.transportPreludeActive = false;
      state.transportPreludePopupOpen = false;
      state.simpleMoleculeDragChallengeActive = false;
      state.simpleMoleculeDragSprites = [];
      state.simpleMoleculeDragCompleted = 0;
      state.simpleMoleculeDragPhase = "in";
      state.simpleMoleculeDragReviewQueued = false;
      state.waterDragChallengeActive = false;
      state.waterDragSprites = [];
      state.waterDragTransported = 0;
      state.waterDragReviewQueued = false;
      state.glucoseDragChallengeActive = false;
      state.glucoseDragSprites = [];
      state.glucoseDragTransported = 0;
      state.glucoseDragReviewQueued = false;
      state.glucoseLeverState = "up";
      state.glucoseLeverReadyAt = 0;
      state.glucoseInPocket = null;
      state.glucoseAirlockOverlay = null;
      state.glucoseLeverOverlay = null;
      state.wasteVesicleChallengeActive = false;
      state.wasteDragSprites = [];
      state.wasteVesicles = [];
      state.wasteVesicleExported = 0;
      state.wasteVesicleReviewQueued = false;
      state.combinedTransportReviewQueued = false;
      const transportPopup = document.getElementById("transportLearningPopup");
      if (transportPopup) {
        transportPopup.classList.remove("visible");
        transportPopup.innerHTML = "";
      }
      const ambientLayer = document.getElementById("osmosisAmbientLayer");
      if (ambientLayer) ambientLayer.innerHTML = "";
      state.membraneCracksUnlocked = false;
      restoreOsmosisCellBody();
    }

    function demoSetTimeout(fn, delay) {
      const runId = state.demoRunId;
      const id = setTimeout(() => {
        if (runId === state.demoRunId && currentLevel().membraneDemoMode) fn();
      }, delay);
      state.demoTimers.push(id);
      return id;
    }

    function demoSetInterval(fn, delay) {
      const runId = state.demoRunId;
      const id = setInterval(() => {
        if (runId === state.demoRunId && currentLevel().membraneDemoMode) fn();
        else clearInterval(id);
      }, delay);
      state.demoTimers.push(id);
      return id;
    }

    let membranePreparePromise = null;
    let wasteVesicleArtSourcePromise = null;

    function membraneIdleVariant(node, index, kind) {
      const variants = kind === "head" ? [
        ["head-drift-a", "3.1s", "-1.4s"],
        ["head-drift-b", "3.7s", "-3.1s"],
        ["head-drift-c", "4.4s", "-2.2s"],
        ["head-drift-d", "2.8s", "-2.5s"],
        ["head-drift-e", "4.9s", "-4.1s"],
        ["head-drift-f", "4.1s", "-1.8s"]
      ] : [
        ["tail-sway-a", "3.4s", "-2.6s"],
        ["tail-sway-b", "4.1s", "-1.7s"],
        ["tail-sway-c", "2.7s", "-2.1s"],
        ["tail-sway-d", "4.7s", "-3.8s"],
        ["tail-sway-e", "3.8s", "-3.2s"],
        ["tail-sway-f", "4.9s", "-1.3s"]
      ];
      const [name, duration, delay] = variants[index % variants.length];
      node.style.animationName = name;
      node.style.animationDuration = duration;
      node.style.animationDelay = delay;
    }

    function wrapMembraneImpactPart(node, outerClass, record) {
      const ns = "http://www.w3.org/2000/svg";
      const outer = document.createElementNS(ns, "g");
      outer.setAttribute("class", outerClass);
      outer.dataset.side = record.side;
      outer.dataset.lipidKey = record.key;
      outer.dataset.membraneAxis = String(record.axis);
      const impact = document.createElementNS(ns, "g");
      impact.setAttribute("class", "lipid-impact-motion");
      node.parentNode.insertBefore(outer, node);
      outer.appendChild(impact);
      impact.appendChild(node);
      return outer;
    }

    function configureInlineMembranePhospholipids(host) {
      const heads = Array.from(host.querySelectorAll("#hydrophilic-heads circle"));
      const headRecords = heads.map((node, index) => ({
        node,
        index,
        axis: Number(node.getAttribute("cx")) || 0,
        side: (Number(node.getAttribute("cy")) || 0) < 160 ? "right" : "left"
      }));

      ["left", "right"].forEach(side => {
        headRecords
          .filter(record => record.side === side)
          .sort((a, b) => a.axis - b.axis)
          .forEach((record, index) => { record.key = `${side}-${index}`; });
      });

      headRecords.forEach(record => {
        membraneIdleVariant(record.node, record.index, "head");
        record.node.classList.add("phospholipid-head");
        wrapMembraneImpactPart(record.node, "phospholipid phospholipid-idle", record);
      });

      Array.from(host.querySelectorAll("#hydrophobic-tails path")).forEach((path, index) => {
        const start = path.getPointAtLength(0);
        const side = start.y < 160 ? "right" : "left";
        const candidates = headRecords.filter(record => record.side === side);
        const nearest = candidates.reduce((best, record) => (
          !best || Math.abs(record.axis - start.x) < Math.abs(best.axis - start.x) ? record : best
        ), null);
        if (!nearest) return;
        membraneIdleVariant(path, index, "tail");
        path.style.transformOrigin = side === "right" ? "50% 0%" : "50% 100%";
        path.classList.add("phospholipid-tail");
        wrapMembraneImpactPart(path, "phospholipid-tail-idle", {
          side,
          key: nearest.key,
          axis: start.x
        });
      });
    }

    function prepareInteractiveMembrane() {
      if (membranePreparePromise) return membranePreparePromise;
      const host = document.getElementById("demoMembraneInline");
      const fallback = document.getElementById("demoMembraneFallback");
      if (!host) return Promise.resolve(false);
      membranePreparePromise = fetch("assets/cell-membrane.svg")
        .then(response => {
          if (!response.ok) throw new Error(`Membrane SVG failed to load: ${response.status}`);
          return response.text();
        })
        .then(sourceText => {
          const source = new DOMParser().parseFromString(sourceText, "image/svg+xml");
          if (source.querySelector("parsererror")) throw new Error("Membrane SVG could not be parsed.");
          const sourceRoot = source.documentElement;
          const parts = [sourceRoot.querySelector("defs"), sourceRoot.querySelector("style"), sourceRoot.querySelector("#membrane")]
            .filter(Boolean)
            .map(node => document.importNode(node, true));
          host.replaceChildren(...parts);
          configureInlineMembranePhospholipids(host);
          host.dataset.ready = "true";
          if (fallback) fallback.setAttribute("display", "none");
          return true;
        })
        .catch(error => {
          console.warn("Using the static membrane fallback.", error);
          return false;
        });
      return membranePreparePromise;
    }

    function screenVectorToLocal(element, screenX, screenY) {
      const matrix = element?.getScreenCTM?.();
      if (!matrix) return { x: 0, y: 0 };
      try {
        const inverse = matrix.inverse();
        const start = new DOMPoint(0, 0).matrixTransform(inverse);
        const end = new DOMPoint(screenX, screenY).matrixTransform(inverse);
        return { x: end.x - start.x, y: end.y - start.y };
      } catch (error) {
        return { x: 0, y: 0 };
      }
    }

    function screenPointToSvg(element, screenX, screenY) {
      const matrix = element?.getScreenCTM?.();
      if (!matrix) return null;
      try {
        return new DOMPoint(screenX, screenY).matrixTransform(matrix.inverse());
      } catch (error) {
        return null;
      }
    }

    function showMembraneContactEffect(impactX, impactY) {
      const layer = document.getElementById("demoParticles");
      const point = screenPointToSvg(layer, impactX, impactY);
      if (!layer || !point) return;
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x.toFixed(2));
      circle.setAttribute("cy", point.y.toFixed(2));
      circle.setAttribute("r", "13");
      circle.setAttribute("fill", "rgba(167,139,250,.16)");
      circle.setAttribute("stroke", "rgba(196,181,253,.8)");
      circle.setAttribute("stroke-width", "3");
      circle.setAttribute("pointer-events", "none");
      circle.style.transformBox = "fill-box";
      circle.style.transformOrigin = "center";
      layer.appendChild(circle);
      const animation = circle.animate([
        { opacity: .8, transform: "scale(.55)" },
        { opacity: .42, transform: "scale(1.15)", offset: .55 },
        { opacity: 0, transform: "scale(1.65)" }
      ], { duration: 220, easing: "ease-out" });
      animation.onfinish = () => circle.remove();
    }

    function triggerMembraneImpact(moleculeElement) {
      if (!moleculeElement?.isConnected) return;
      const visual = moleculeElement.querySelector(".demo-particle-body") || moleculeElement;
      const moleculeRect = visual.getBoundingClientRect();
      const impactX = moleculeRect.left + moleculeRect.width / 2;
      const impactY = moleculeRect.top + moleculeRect.height / 2;
      const host = document.getElementById("demoMembraneInline");
      const fallback = document.getElementById("demoMembraneFallback");
      const membraneRect = host?.dataset.ready === "true" ? host.getBoundingClientRect() : fallback?.getBoundingClientRect();
      if (!membraneRect) return;

      const membraneCenterX = membraneRect.left + membraneRect.width / 2;
      const hitSide = impactX < membraneCenterX ? "left" : "right";
      showMembraneContactEffect(impactX, impactY);

      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion && visual) {
        visual._impactAnimation?.cancel();
        visual._impactAnimation = visual.animate([
          { transform: "scale(1, 1)" },
          { transform: "scale(.91, 1.06)", offset: .22 },
          { transform: "scale(1.03, .98)", offset: .58 },
          { transform: "scale(1, 1)" }
        ], { duration: 320, easing: "ease-out" });
      }

      if (reducedMotion || host?.dataset.ready !== "true") return;
      const reactionRadius = 74;
      const heads = Array.from(host.querySelectorAll(`.phospholipid[data-side="${hitSide}"]`))
        .map(element => {
          const rect = element.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          return { element, centerY, distance: Math.abs(centerY - impactY) };
        })
        .filter(item => item.distance <= reactionRadius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

      const inwardX = hitSide === "left" ? 1 : -1;
      const allImpactGroups = Array.from(host.querySelectorAll(".lipid-impact-motion"));
      heads.forEach((item, index) => {
        const strength = Math.max(0, 1 - item.distance / reactionRadius);
        const verticalDirection = item.centerY < impactY ? -1 : 1;
        const screenX = inwardX * (1.2 + 4.4 * strength);
        const screenY = verticalDirection * (0.5 + 1.4 * strength);
        const key = item.element.dataset.lipidKey;
        const linkedGroups = allImpactGroups.filter(group => group.parentElement?.dataset.lipidKey === key);
        linkedGroups.forEach(group => {
          const local = screenVectorToLocal(group, screenX, screenY);
          group._impactAnimation?.cancel();
          group._impactAnimation = group.animate([
            { transform: "translate(0px, 0px)" },
            { transform: `translate(${local.x.toFixed(2)}px, ${local.y.toFixed(2)}px)`, offset: .22 },
            { transform: `translate(${(-local.x * .16).toFixed(2)}px, ${(-local.y * .16).toFixed(2)}px)`, offset: .62 },
            { transform: "translate(0px, 0px)" }
          ], { duration: 520, delay: index * 28, easing: "ease-out" });
        });
      });
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function animateDemoGroup(g, frames, duration, options = {}) {
      const runId = state.demoRunId;
      const start = performance.now();
      const removeAtEnd = options.removeAtEnd !== false;
      const sorted = frames.map((f, i) => ({ ...f, offset: f.offset ?? (i / Math.max(1, frames.length - 1)) })).sort((a, b) => a.offset - b.offset);
      const body = g.querySelector(".demo-particle-body");

      function step(now) {
        if (runId !== state.demoRunId || !g.isConnected) return;
        const progress = Math.min(1, (now - start) / duration);
        let a = sorted[0];
        let b = sorted[sorted.length - 1];
        for (let i = 0; i < sorted.length - 1; i++) {
          if (progress >= sorted[i].offset && progress <= sorted[i + 1].offset) {
            a = sorted[i];
            b = sorted[i + 1];
            break;
          }
        }
        const span = Math.max(.0001, b.offset - a.offset);
        const local = Math.max(0, Math.min(1, (progress - a.offset) / span));
        // Default easing is nice for lesson actions like glucose/water/waste.
        // Live particles use { linear: true } so they do not pause at every waypoint.
        const motionT = options.linear ? local : (local < .5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2);
        const x = lerp(a.x ?? 0, b.x ?? a.x ?? 0, motionT);
        const y = lerp(a.y ?? 0, b.y ?? a.y ?? 0, motionT);
        const rot = lerp(a.rot ?? 0, b.rot ?? a.rot ?? 0, motionT);
        const scale = lerp(a.scale ?? 1, b.scale ?? a.scale ?? 1, motionT);
        const opacity = lerp(a.opacity ?? 1, b.opacity ?? a.opacity ?? 1, motionT);

        // Move the whole particle+label together, but rotate/scale only the body.
        // This keeps labels readable above spinning damaging toxins.
        g.setAttribute("transform", `translate(${x} ${y})`);
        if (body) body.setAttribute("transform", `rotate(${rot}) scale(${scale})`);
        else g.setAttribute("transform", `translate(${x} ${y}) rotate(${rot}) scale(${scale})`);
        g.style.opacity = opacity;
        if (progress < 1) {
          const frameId = requestAnimationFrame(step);
          state.demoFrames.push(frameId);
        } else {
          if (typeof options.onDone === "function") options.onDone();
          if (removeAtEnd) demoSetTimeout(() => g.remove(), options.removeDelay ?? 120);
        }
      }
      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function setMembraneDemoMode(on) {
      const layer = document.getElementById("membraneDemoLayer");
      if (!layer) return;
      layer.classList.toggle("hidden-svg", !on);
      layer.classList.toggle("active", !!on);
      updateMembraneDemoVisuals();
    }

    function setDemoFeedbackText(text) {
      const node = document.getElementById("demoFeedback");
      if (!node) return;
      node.textContent = "";
      const words = String(text).split(/\s+/).filter(Boolean);
      const maxChars = 48;
      const lines = [];
      let line = "";
      words.forEach(word => {
        const next = line ? `${line} ${word}` : word;
        if (next.length > maxChars && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      });
      if (line) lines.push(line);
      const shownLines = lines.slice(0, 3);
      shownLines.forEach((lineText, idx) => {
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("x", "450");
        tspan.setAttribute("dy", idx === 0 ? "0" : "22");
        tspan.textContent = lineText;
        node.appendChild(tspan);
      });
      node.setAttribute("y", shownLines.length > 2 ? "18" : (shownLines.length > 1 ? "31" : "42"));
    }

    function membraneFeedback(text, priority = 1, hold = 4300) {
      if (state.levelLost && priority < 5) return;
      const now = Date.now();
      if (now < state.feedbackLockUntil && priority < state.feedbackPriority) return;
      setDemoFeedbackText(text);
      toast.textContent = text;
      state.feedbackLockUntil = now + hold;
      state.feedbackPriority = priority;
      setTimeout(() => {
        if (Date.now() >= state.feedbackLockUntil) state.feedbackPriority = 0;
      }, hold + 50);
    }

    function clearDemoInstructionText() {
      setDemoFeedbackText("");
      if (toast) toast.textContent = "";
      state.feedbackLockUntil = 0;
      state.feedbackPriority = 0;
    }

    function updateMembraneDemoVisuals() {
      const stage = currentLevel().demoStage;
      const isOsmosis = currentLevel().membraneDemoMode && stage === "waterBalance";
      const health = clamp(state.stats.membraneHealth ?? 100);
      const fill = document.getElementById("membraneHealthFill");
      const healthText = document.getElementById("membraneHealthText");
      const strip = document.getElementById("demoMembraneStrip");
      const demoFeedbackNode = document.getElementById("demoFeedback");
      if (fill && healthText) {
        fill.setAttribute("width", Math.max(0, 220 * health / 100));
        fill.setAttribute("fill", health <= 24 ? "#fb7185" : health <= 49 ? "#fbbf24" : "#34d399");
        healthText.textContent = health;
      }
      if (strip) {
        strip.classList.toggle("damaged", health <= 49);
        strip.setAttribute("stroke", health <= 24 ? "#fb7185" : health <= 49 ? "#fbbf24" : "#34d399");
      }
      const crackStage = stage === "damaging" || stage === "mixed";
      document.querySelectorAll(".demo-crack").forEach((crack, i) => {
        const visible = crackStage && state.membraneCracksUnlocked && health < (98 - i * 14);
        crack.classList.toggle("visible", visible);
      });

      // Keep the blocked-toxin level visually focused on the membrane blocking toxins.
      // Non-transport demo stages can hide the transport controls.
      const hideTransportDoors = stage === "blocked";
      const hideWaterChannelOnly = stage === "sneaky";
      ["glucoseDoor", "waterGate", "wasteExit"].forEach(id => {
        const node = document.getElementById(id);
        if (node) {
          const shouldHide = hideTransportDoors || (hideWaterChannelOnly && id === "waterGate");
          node.classList.toggle("hidden-svg", shouldHide);
          node.style.pointerEvents = shouldHide ? "none" : "";
        }
      });

      const water = clamp(state.stats.water ?? 50);
      const waterFill = document.getElementById("waterBalanceFill");
      const waterText = document.getElementById("waterBalanceText");
      const waterTrack = document.getElementById("waterBalanceTrack");
      if (waterFill && waterText) {
        let label = "Balanced";
        let color = "#34d399";
        if (water < 30) { label = "Too Dry"; color = water < 15 ? "#fb7185" : "#fbbf24"; }
        if (water > 75) { label = "Too Full"; color = water > 85 ? "#fb7185" : "#fbbf24"; }
        waterFill.setAttribute("width", Math.max(10, 150 * water / 100));
        waterFill.setAttribute("fill", color);
        waterText.textContent = label;
        waterFill.classList.toggle("water-balance-critical", water > 85 || water < 15);
        if (waterTrack) waterTrack.setAttribute("stroke", water > 85 || water < 15 ? "#fb7185" : "rgba(255,255,255,.22)");
      }

      const isTransportPrelude = currentLevel().membraneDemoMode && stage === "transport";
      const isTransportReview = currentLevel().membraneDemoMode && stage === "transportReview";
      const isWaterDrag = isWaterDragLevel(currentLevel());
      const isGlucoseDrag = isGlucoseDragLevel(currentLevel());
      const isWasteVesicle = isWasteVesicleLevel(currentLevel());
      ["glucoseDoor", "waterGate", "wasteExit"].forEach(id => {
        const node = document.getElementById(id);
        if (node) {
          const shouldHide = isOsmosis || (isTransportPrelude && !(isWaterDrag && id === "waterGate")) || (isGlucoseDrag && id === "glucoseDoor") || (isWasteVesicle && id === "wasteExit") || hideTransportDoors || (hideWaterChannelOnly && id === "waterGate");
          node.classList.toggle("hidden-svg", shouldHide);
          node.style.pointerEvents = shouldHide || isWaterDrag || isGlucoseDrag || isWasteVesicle ? "none" : "";
        }
      });
      ["membraneHealthMeter", "waterBalanceMeter"].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.classList.toggle("hidden-svg", isOsmosis || isTransportPrelude || isTransportReview);
      });
      ["demoMembraneStrip", "demoCracks"].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.classList.toggle("hidden-svg", isOsmosis);
      });
      document.querySelectorAll(".demo-side-label, .demo-region-outside, .demo-region-inside").forEach(node => {
        node.classList.toggle("hidden-svg", isOsmosis);
      });
      if (demoFeedbackNode) demoFeedbackNode.classList.toggle("hidden-svg", isOsmosis);

      updateOsmosisVisuals();
    }

    function demoGroup(label, shapeMarkup, x, y) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-particle");
      g.setAttribute("transform", `translate(${x} ${y})`);
      g.innerHTML = `<g class="demo-particle-body">${shapeMarkup}</g>${label === "Water" ? "" : `<text class="demo-particle-label" x="0" y="-24">${label}</text>`}`;
      document.getElementById("demoParticles").appendChild(g);
      return g;
    }

    function randomMembraneGapY() {
      // Avoid the visible glucose door, water gate, and waste exit.
      // These lanes pass through the membrane gaps between those features.
      const lanes = [
        { center: 204, jitter: 10 },
        { center: 318, jitter: 12 },
        { center: 430, jitter: 10 }
      ];
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      return lane.center + (Math.random() * 2 - 1) * lane.jitter;
    }

    function demoBubble(text, x, y, duration = 4200) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-bubble");
      g.innerHTML = `<rect x="${x - 150}" y="${y - 28}" width="300" height="44" rx="16" fill="rgba(2,6,23,.86)" stroke="rgba(255,255,255,.24)"/><text x="${x}" y="${y}">${text}</text>`;
      document.getElementById("demoParticles").appendChild(g);
      g.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .82 }, { opacity: 0 }], { duration, easing: "ease-in-out" });
      setTimeout(() => g.remove(), duration + 80);
    }

    function spawnOxygen(options = {}) {
      if (!currentLevel().membraneDemoMode) return;
      const { afterOverlay = false, behindExisting = true } = options;
      const y = randomMembraneGapY();
      const drift = Math.random() * 10 - 5;
      const shape = `<circle cx="0" cy="0" r="7" fill="rgba(255,255,255,.55)" stroke="rgba(219,234,254,.60)" stroke-width="2"/>`;
      const g = demoGroup("Oxygen", shape, 72, y);
      const label = g.querySelector(".demo-particle-label");
      if (label) label.remove();
      const layer = document.getElementById("demoParticles");
      if (layer && afterOverlay) {
        const overlay = layer.querySelector(".transport-prelude-overlay");
        if (overlay) layer.insertBefore(g, overlay.nextSibling);
        else if (layer.firstChild) layer.insertBefore(g, layer.firstChild);
      } else if (behindExisting && layer && layer.firstChild) {
        layer.insertBefore(g, layer.firstChild);
      }
      const body = g.querySelector(".demo-particle-body");
      if (body) body.style.opacity = .55;
      g.style.opacity = .45;
      animateDemoGroup(g, [
        { x: 72, y, opacity: .42, scale: .96, offset: 0 },
        { x: 270, y: y + drift * .35, opacity: .42, scale: .96, offset: .32 },
        { x: 450, y: y + drift * .65, opacity: .40, scale: .94, offset: .56 },
        { x: 826, y: y + drift, opacity: .38, scale: .94, offset: 1 }
      ], 5600, { linear: true });
    }

    function startBackgroundOxygen(options = {}) {
      const spawn = () => spawnOxygen(options);
      demoSetInterval(spawn, 1700);
      spawn();
      demoSetTimeout(spawn, 850);
    }

    function spawnBlockedToxin() {
      if (!currentLevel().membraneDemoMode) return;
      const y = randomMembraneGapY();
      const g = demoGroup("Blocked Toxin", `<circle cx="0" cy="0" r="13" fill="#7c3aed" stroke="#ddd6fe" stroke-width="3"/>`, 84, y);
      animateDemoGroup(g, [
        { x: 84, y, opacity: 1, offset: 0 },
        { x: 260, y: y + 3, opacity: 1, offset: .34 },
        { x: 414, y: y + 5, opacity: 1, scale: 1, offset: .60 },
        { x: 386, y: y - 15, opacity: 1, scale: 1.16, offset: .68 },
        { x: 250, y: y - 42, opacity: 1, scale: 1, offset: .84 },
        { x: 42, y: y - 62, opacity: 1, offset: 1 }
      ], 4400, { linear: true, onDone: () => markAction("demoBlockedToxin") });
    }

    function randomHelperSpawnPoint(index = 0) {
      const ySpan = HELPER_SPAWN_ZONE.yMax - HELPER_SPAWN_ZONE.yMin;
      return {
        x: HELPER_SPAWN_ZONE.entryX + (index % 2) * 8,
        y: HELPER_SPAWN_ZONE.yMin + Math.random() * ySpan
      };
    }

    function helperExitPoint(fromY) {
      return {
        x: HELPER_SPAWN_ZONE.exitX,
        y: Math.max(HELPER_SPAWN_ZONE.yMin, Math.min(HELPER_SPAWN_ZONE.yMax, fromY + (Math.random() * 42 - 21)))
      };
    }

    function getRoamingSneakyToxins() {
      state.activeSneakyToxins = state.activeSneakyToxins.filter(t => t.g && t.g.isConnected && t.status !== "removed");
      return state.activeSneakyToxins.filter(t => t.status === "roaming" && !t.targeted);
    }

    function cleanupDemoSparkle(x, y, color = "#bbf7d0") {
      const layer = document.getElementById("demoParticles");
      if (!layer) return;
      for (let i = 0; i < 9; i++) {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const angle = (Math.PI * 2 * i) / 9;
        const dist = 18 + Math.random() * 16;
        c.setAttribute("class", "demo-particle");
        c.setAttribute("cx", x);
        c.setAttribute("cy", y);
        c.setAttribute("r", 3 + Math.random() * 2);
        c.setAttribute("fill", color);
        layer.appendChild(c);
        c.animate([
          { transform: "translate(0px, 0px)", opacity: 1 },
          { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`, opacity: 0 }
        ], { duration: 680, easing: "ease-out" });
        demoSetTimeout(() => c.remove(), 760);
      }
    }

    function startSneakyRoam(toxin) {
      const runId = state.demoRunId;
      toxin.status = "roaming";
      toxin.vx = (Math.random() < .5 ? -1 : 1) * (10 + Math.random() * 8);
      toxin.vy = (Math.random() < .5 ? -1 : 1) * (8 + Math.random() * 8);
      toxin.phase = Math.random() * Math.PI * 2;
      toxin.last = performance.now();

      function step(now) {
        if (runId !== state.demoRunId || !toxin.g || !toxin.g.isConnected || toxin.status !== "roaming") return;
        const dt = Math.min(.05, (now - toxin.last) / 1000);
        toxin.last = now;
        toxin.phase += dt * 2.2;
        toxin.x += toxin.vx * dt;
        toxin.y += toxin.vy * dt;

        // The roam zone begins well inside the cell, to the right of the membrane doors.
        // That keeps sneaky toxins out of the Glucose Door, Water Gate, and Waste Exit lanes.
        if (toxin.x < SNEAKY_ROAM_ZONE.xMin) { toxin.x = SNEAKY_ROAM_ZONE.xMin; toxin.vx = Math.abs(toxin.vx); }
        if (toxin.x > SNEAKY_ROAM_ZONE.xMax) { toxin.x = SNEAKY_ROAM_ZONE.xMax; toxin.vx = -Math.abs(toxin.vx); }
        if (toxin.y < SNEAKY_ROAM_ZONE.yMin) { toxin.y = SNEAKY_ROAM_ZONE.yMin; toxin.vy = Math.abs(toxin.vy); }
        if (toxin.y > SNEAKY_ROAM_ZONE.yMax) { toxin.y = SNEAKY_ROAM_ZONE.yMax; toxin.vy = -Math.abs(toxin.vy); }

        const wiggle = Math.sin(toxin.phase * 2.3) * 8;
        toxin.g.setAttribute("transform", `translate(${toxin.x} ${toxin.y})`);
        const body = toxin.g.querySelector(".demo-particle-body");
        if (body) body.setAttribute("transform", `rotate(${wiggle}) scale(${1 + Math.sin(toxin.phase) * .035})`);
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      }
      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function spawnSneakyToxin() {
      if (!currentLevel().membraneDemoMode) return;
      const activeCount = state.activeSneakyToxins.filter(t => t.g && t.g.isConnected && ["entering", "roaming", "targeted"].includes(t.status)).length;
      if (activeCount >= 20) return;
      const y = randomMembraneGapY();
      const roamX = 575 + Math.random() * 95;
      const roamY = Math.max(SNEAKY_ROAM_ZONE.yMin + 8, Math.min(SNEAKY_ROAM_ZONE.yMax - 8, y + (Math.random() * 86 - 43)));
      const g = demoGroup("Sneaky Toxin", `<circle cx="0" cy="0" r="10" fill="#f97316" stroke="#fed7aa" stroke-width="3"/>`, 82, y);
      // Keep the label while it approaches the membrane, then remove it once the toxin is inside.
      // This keeps the roaming cytoplasm area from getting crowded with overlapping text.
      demoSetTimeout(() => {
        if (g && g.isConnected) {
          const label = g.querySelector(".demo-particle-label");
          if (label) label.remove();
        }
      }, 4700);
      const toxin = {
        id: state.nextDemoObjectId++,
        x: roamX,
        y: roamY,
        vx: 0,
        vy: 0,
        status: "entering",
        g,
        targeted: false,
        assignedCleanupCrewId: null
      };
      state.activeSneakyToxins.push(toxin);
      animateDemoGroup(g, [
        { x: 82, y, opacity: 1, offset: 0 },
        { x: 300, y: y + 2, opacity: 1, offset: .38 },
        { x: 414, y, opacity: 1, offset: .58 },
        { x: 430, y: y - 10, opacity: 1, scale: .92, offset: .66 },
        { x: 418, y: y + 11, opacity: 1, scale: .88, offset: .74 },
        { x: 452, y: y - 4, opacity: 1, scale: .82, offset: .82 },
        { x: roamX, y: roamY, opacity: 1, scale: 1, offset: 1 }
      ], 5600, { linear: true, removeAtEnd: false, onDone: () => {
        const label = g.querySelector(".demo-particle-label");
        if (label) label.remove();
        if (!g.isConnected || state.levelLost) return;
        markAction("demoSneakyToxin");
        adjustStats({ toxinsInside: +1 });
        if (state.levelLost) return;
        membraneFeedback("Sneaky toxin slipped inside! Toxins Inside increased, but Waste stays the same until cleanup.", 2, 4200);
        startSneakyRoam(toxin);
      }});
    }

    function cleanupLineupSlot(index) {
      return { x: 580 + index * 50, y: 388 + (index % 2) * 18 };
    }

    function createCleanerGroup(id, x, y, index) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-particle cleanup-crew");
      g.setAttribute("transform", `translate(${x} ${y})`);
      g.setAttribute("filter", "drop-shadow(0 0 10px rgba(34,197,94,.58))");
      g.innerHTML = `
        <g class="demo-particle-body">
          <rect x="-24" y="-24" width="48" height="48" rx="13" fill="#22c55e" stroke="#bbf7d0" stroke-width="3"/>
          <circle cx="0" cy="-3" r="7" fill="#052e16" opacity=".18"/>
          <path d="M-14,-5 L14,-5" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
          <path d="M-5,-10 L5,-10" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
          <path d="M-10,9 L0,15 L10,9" stroke="#dcfce7" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="0" y="22" fill="#052e16" font-size="8" font-weight="900" text-anchor="middle">CLEAN</text>
        </g>
        <text class="demo-particle-label" x="0" y="-44">
          <tspan x="0" dy="0">Cleaner</tspan>
          <tspan x="0" dy="13">Protein</tspan>
        </text>`;
      document.getElementById("demoParticles").appendChild(g);
      const crew = { id, g, status: "chasing", targetId: null, index, role: "cleaner" };
      state.cleanupCrewUnits.push(crew);
      return crew;
    }

    function createTrashTakerGroup(id, x, y, index) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-particle trash-taker");
      g.setAttribute("transform", `translate(${x} ${y})`);
      g.setAttribute("filter", "drop-shadow(0 0 10px rgba(59,130,246,.5))");
      g.innerHTML = `
        <g class="demo-particle-body">
          <rect x="-24" y="-24" width="48" height="48" rx="13" fill="#38bdf8" stroke="#dbeafe" stroke-width="3"/>
          <rect x="-10" y="-3" width="20" height="17" rx="4" fill="#475569" stroke="#f8fafc" stroke-width="2"/>
          <path d="M-13,-6 L13,-6" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
          <path d="M-5,-10 L5,-10" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
          <text x="0" y="22" fill="#082f49" font-size="8" font-weight="900" text-anchor="middle">GARB</text>
        </g>
        <text class="demo-particle-label" x="0" y="-46">
          <tspan x="0" dy="0">Garbage Man</tspan>
          <tspan x="0" dy="13">Protein</tspan>
        </text>`;
      document.getElementById("demoParticles").appendChild(g);
      const taker = { id, g, status: "hauling", index, role: "trashTaker" };
      state.trashTakerUnits.push(taker);
      return taker;
    }

    function getFloatingWasteBlocks() {
      return state.activeFloatingWaste.filter(waste =>
        waste.g &&
        waste.g.isConnected &&
        waste.status === "floating" &&
        !waste.targeted
      );
    }

    function startWasteFloat(waste) {
      const runId = state.demoRunId;
      waste.baseX = waste.x;
      waste.baseY = waste.y;
      waste.phase = Math.random() * Math.PI * 2;
      waste.last = performance.now();

      function step(now) {
        if (runId !== state.demoRunId || !waste.g || !waste.g.isConnected || waste.status !== "floating") return;
        const dt = Math.min(.05, (now - waste.last) / 1000);
        waste.last = now;
        waste.phase += dt * 1.8;
        const floatX = waste.baseX + Math.sin(waste.phase) * 9;
        const floatY = waste.baseY + Math.cos(waste.phase * 1.25) * 7;
        waste.x = floatX;
        waste.y = floatY;
        waste.g.setAttribute("transform", `translate(${floatX} ${floatY})`);
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      }

      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function convertToxinToWaste(toxin, wastePoint, index, onFinished) {
      if (!toxin.g || !toxin.g.isConnected) { if (onFinished) onFinished(); return; }
      toxin.status = "waste";
      toxin.targeted = true;
      toxin.g.innerHTML = `
        <g class="demo-particle-body">
          <rect x="-13" y="-13" width="26" height="26" rx="6" fill="#94a3b8" stroke="#e2e8f0" stroke-width="3"/>
        </g>
        <text class="demo-particle-label" x="0" y="-26">Waste</text>`;
      toxin.g.setAttribute("transform", `translate(${wastePoint.x} ${wastePoint.y})`);
      cleanupDemoSparkle(wastePoint.x, wastePoint.y, "#e2e8f0");
      adjustStats({ toxinsInside: -1, waste: +5 });
      membraneFeedback("Cleaner Protein broke the toxin down into floating waste. Use Garbage Man Protein to move it to the Waste Exit.", 3, 4200);
      state.activeSneakyToxins = state.activeSneakyToxins.filter(t => t.id !== toxin.id);

      const waste = {
        id: state.nextDemoObjectId++,
        sourceToxinId: toxin.id,
        g: toxin.g,
        x: wastePoint.x,
        y: wastePoint.y,
        status: "floating",
        targeted: false,
        assignedTrashTakerId: null
      };
      state.activeFloatingWaste.push(waste);
      startWasteFloat(waste);
      if (onFinished) onFinished();
    }

    function dispatchTrashTaker(waste, slot, index, onFinished) {
      const spawn = randomHelperSpawnPoint(index);
      const exit = helperExitPoint(spawn.y);
      const taker = createTrashTakerGroup(state.nextDemoObjectId++, spawn.x, spawn.y, index);
      taker.targetWasteId = waste.id;
      waste.status = "targeted";
      waste.targeted = true;
      waste.assignedTrashTakerId = taker.id;
      const startX = spawn.x;
      const startY = spawn.y;
      const wasteX = waste.x;
      const wasteY = waste.y;

      demoSetTimeout(() => {
        if (!taker.g || !taker.g.isConnected || !waste.g || !waste.g.isConnected) { if (onFinished) onFinished(); return; }
        animateDemoGroup(taker.g, [
          { x: startX, y: startY, opacity: 1, scale: 1, offset: 0 },
          { x: wasteX, y: wasteY - 30, opacity: 1, scale: 1.04, offset: 1 }
        ], 1200 + index * 100, { linear: true, removeAtEnd: false, onDone: () => {
          if (!waste.g || !waste.g.isConnected || !taker.g || !taker.g.isConnected) { if (onFinished) onFinished(); return; }
          cleanupDemoSparkle(wasteX, wasteY, "#c7d2fe");
          waste.status = "queued";
          animateDemoGroup(waste.g, [
            { x: wasteX, y: wasteY, opacity: 1, scale: 1, offset: 0 },
            { x: slot.x, y: slot.y, opacity: 1, scale: .96, offset: 1 }
          ], 1350, { linear: true, removeAtEnd: false, onDone: () => {
            waste.x = slot.x;
            waste.y = slot.y;
            membraneFeedback("Garbage Man Protein moved the waste into the exit line.", 2, 2800);
            animateWasteExit(waste, slot, index, onFinished);
          }});
          animateDemoGroup(taker.g, [
            { x: wasteX, y: wasteY - 30, opacity: 1, scale: 1.03, offset: 0 },
            { x: slot.x, y: slot.y - 34, opacity: 1, scale: 1, offset: .56 },
            { x: exit.x - 18, y: exit.y, opacity: 1, scale: .95, offset: .88 },
            { x: exit.x, y: exit.y, opacity: 0, scale: .7, offset: 1 }
          ], 2650, { linear: true, onDone: () => {
            taker.status = "done";
            if (taker.g) taker.g.remove();
          }});
        }});
      }, 200 + index * 90);
    }

    function animateWasteExit(waste, slot, index, onFinished) {
      const wasteG = waste.g;
      waste.status = "exiting";
      demoSetTimeout(() => {
        if (!wasteG || !wasteG.isConnected) { if (onFinished) onFinished(); return; }
        animateDemoGroup(wasteG, [
          { x: slot.x, y: slot.y, opacity: 1, scale: 1, offset: 0 },
          { x: 520, y: WASTE_EXIT_POINT.y, opacity: 1, scale: 1, offset: .35 },
          { x: WASTE_EXIT_POINT.x, y: WASTE_EXIT_POINT.y, opacity: 1, scale: .9, offset: .58 },
          { x: WASTE_OUTSIDE_POINT.x, y: WASTE_OUTSIDE_POINT.y + index * 2, opacity: 1, scale: 1, offset: .92 },
          { x: WASTE_OUTSIDE_POINT.x - 18, y: WASTE_OUTSIDE_POINT.y + index * 2, opacity: 0, scale: .8, offset: 1 }
        ], 3900, { linear: true, onDone: () => {
          adjustStats({ waste: -5 });
          state.activeFloatingWaste = state.activeFloatingWaste.filter(w => w.id !== waste.id);
          membraneFeedback("Waste exited through the membrane.", 2, 2800);
          if (onFinished) onFinished();
        }});
      }, 620 + index * 460);
    }

    function runCleaner() {
      if (!currentLevel().membraneDemoMode) return;
      if (!["sneaky", "mixed"].includes(currentLevel().demoStage)) {
        membraneFeedback("Cleaner Protein is for sneaky toxins that are roaming inside the cytoplasm.", 2, 3600);
        return;
      }
      if (state.cleanupWaveActive) {
        membraneFeedback("Cleaner Protein is already working. Wait for this helper wave to finish.", 3, 3600);
        return;
      }
      const roaming = getRoamingSneakyToxins();
      if (!roaming.length) {
        membraneFeedback("No roaming sneaky toxins to clean yet. Wait for one to slip inside.", 2, 3600);
        return;
      }
      const costPerCleaner = 5;
      const affordable = Math.floor((state.stats.atp ?? 0) / costPerCleaner);
      const cleanerCount = Math.min(roaming.length, 5, affordable);
      if (cleanerCount <= 0) {
        membraneFeedback("Not enough ATP for Cleaner Protein. Bring in glucose or make ATP before the toxin buildup gets worse.", 4, 5200);
        return;
      }
      if (cleanerCount < Math.min(roaming.length, 5)) {
        membraneFeedback("Not enough ATP for full cleaning. Sending as many Cleaner Proteins as the cell can afford.", 4, 4800);
      } else {
        membraneFeedback("Cleaner Protein used ATP to catch sneaky toxins and turn them into floating waste.", 3, 4200);
      }
      markAction("cleaner");
      state.cleanupWaveActive = true;
      adjustStats({ atp: -cleanerCount * costPerCleaner });

      let remaining = cleanerCount;
      const finishOne = () => {
        remaining -= 1;
        if (remaining <= 0) {
          state.cleanupWaveActive = false;
          state.cleanupCrewUnits = state.cleanupCrewUnits.filter(c => c.g && c.g.isConnected);
          evaluateLossConditions();
        }
      };

      for (let i = 0; i < cleanerCount; i++) {
        const target = roaming[i];
        target.status = "targeted";
        target.targeted = true;
        target.assignedCleanupCrewId = state.nextDemoObjectId;
        const spawn = randomHelperSpawnPoint(i);
        const exit = helperExitPoint(spawn.y);
        const crew = createCleanerGroup(state.nextDemoObjectId++, spawn.x, spawn.y, i);
        crew.targetId = target.id;
        const targetX = target.x;
        const targetY = target.y;
        demoSetTimeout(() => {
          if (!crew.g || !crew.g.isConnected || !target.g || !target.g.isConnected) { finishOne(); return; }
          animateDemoGroup(crew.g, [
            { x: spawn.x, y: spawn.y, opacity: 1, scale: 1, offset: 0 },
            { x: targetX, y: targetY, opacity: 1, scale: 1.05, offset: 1 }
          ], 1600 + i * 120, { linear: true, removeAtEnd: false, onDone: () => {
            if (!target.g || !target.g.isConnected || !crew.g || !crew.g.isConnected) { finishOne(); return; }
            target.status = "captured";
            cleanupDemoSparkle(targetX, targetY, "#bbf7d0");
            convertToxinToWaste(target, { x: targetX + 14, y: targetY - 4 }, i, finishOne);
            animateDemoGroup(crew.g, [
              { x: targetX, y: targetY, opacity: 1, scale: 1.04, offset: 0 },
              { x: targetX + 10, y: targetY - 18, opacity: 1, scale: 1, offset: .28 },
              { x: exit.x - 18, y: exit.y, opacity: 1, scale: .96, offset: .88 },
              { x: exit.x, y: exit.y, opacity: 0, scale: .7, offset: 1 }
            ], 2100, { linear: true, onDone: () => {
              crew.status = "done";
              if (crew.g) crew.g.remove();
            }});
          }});
        }, i * 220);
      }
    }

    function runTrashTaker() {
      if (!currentLevel().membraneDemoMode) return;
      if (!["sneaky", "mixed"].includes(currentLevel().demoStage)) {
        demoWasteExit();
        markAction("demoWasteExit");
        return;
      }
      if (state.trashWaveActive) {
        membraneFeedback("Garbage Man Protein is already moving waste. Wait for this garbage wave to finish.", 3, 3600);
        return;
      }
      const floatingWaste = getFloatingWasteBlocks();
      if (!floatingWaste.length) {
        membraneFeedback("No floating waste yet. Send Cleaner Protein out first to turn sneaky toxins into waste.", 2, 4200);
        return;
      }

      const costPerTrashTaker = 3;
      const affordable = Math.floor((state.stats.atp ?? 0) / costPerTrashTaker);
      const takerCount = Math.min(floatingWaste.length, 5, affordable);

      if (takerCount <= 0) {
        membraneFeedback("Not enough ATP for Garbage Man Protein. Bring in glucose first, then move the waste out.", 4, 5200);
        return;
      }

      if (takerCount < Math.min(floatingWaste.length, 5)) {
        membraneFeedback("Not enough ATP for all floating waste. Sending as many Garbage Man Proteins as the cell can afford.", 4, 4800);
      } else {
        membraneFeedback("Garbage Man Protein used ATP to move floating waste to the Waste Exit.", 3, 4200);
      }

      markAction("trashTaker");
      state.trashWaveActive = true;
      adjustStats({ atp: -takerCount * costPerTrashTaker });

      let remaining = takerCount;
      const finishOne = () => {
        remaining -= 1;
        if (remaining <= 0) {
          state.trashWaveActive = false;
          state.trashTakerUnits = state.trashTakerUnits.filter(c => c.g && c.g.isConnected);
          evaluateLossConditions();
        }
      };

      for (let i = 0; i < takerCount; i++) {
        const waste = floatingWaste[i];
        const slot = cleanupLineupSlot(i);
        dispatchTrashTaker(waste, slot, i, finishOne);
      }
    }

    function runCleanupCrew() {
      runCleaner();
    }

    function damageMembrane(amount = 14) {
      state.membraneCracksUnlocked = true;
      adjustStats({ membraneHealth: -amount, transport: -4, waste: +3 });
      const strip = document.getElementById("demoMembraneStrip");
      if (strip) {
        strip.classList.add("damaged");
        demoSetTimeout(() => strip.classList.remove("damaged"), 950);
      }
      updateMembraneDemoVisuals();
      if ((state.stats.membraneHealth ?? 100) <= 24) {
        membraneFeedback("The membrane is critical. Repair it!", 4, 5200);
      }
    }

    function spawnDamagingToxin() {
      if (!currentLevel().membraneDemoMode) return;
      const y = randomMembraneGapY();
      const g = demoGroup("Damaging Toxin", `<path d="M0,-16 L6,-5 L17,-3 L8,5 L10,17 L0,10 L-10,17 L-8,5 L-17,-3 L-6,-5 Z" fill="#ef4444" stroke="#fecaca" stroke-width="3"/>`, 84, y);
      animateDemoGroup(g, [
        { x: 84, y, rot: 0, opacity: 1, offset: 0 },
        { x: 260, y: y - 2, rot: 80, opacity: 1, offset: .34 },
        { x: 426, y, rot: 165, opacity: 1, scale: 1, offset: .72 },
        { x: 435, y, rot: 210, opacity: 1, scale: 1.18, offset: .84 },
        { x: 438, y, rot: 250, opacity: 0, scale: .65, offset: 1 }
      ], 5000, { linear: true, onDone: () => {
        damageMembrane(15);
        markAction("demoDamagingToxin");
      }});
    }

    function transportPreludeIcon(prelude, kind) {
      if (kind === "sprite") {
        return `<svg viewBox="0 0 46 46" aria-label="${prelude.material} sprite">${prelude.spriteMarkup}</svg><b>${prelude.material} Sprite</b>`;
      }
      if (prelude.pathName === "Cell Membrane") {
        return `<img class="learning-membrane-icon" src="assets/cell-membrane.svg" alt="" /><b>Cell Membrane</b>`;
      }
      return `<svg viewBox="-54 -54 108 108" aria-label="${prelude.pathName}">${prelude.doorMarkup}</svg><b>${prelude.pathName}</b>`;
    }

    function transportDragPreviewIcon(prelude) {
      return `
        <div class="preview-drag-stage" aria-label="Mouse dragging the ${prelude.material} sprite">
          <div class="preview-drag-sprite" aria-hidden="true">
            <svg viewBox="0 0 46 46">${prelude.spriteMarkup}</svg>
          </div>
          <span class="preview-click-ring" aria-hidden="true"></span>
          <svg class="preview-drag-cursor" viewBox="0 0 34 40" aria-hidden="true">
            <path d="M5 3 L28 23 L17 25 L23 36 L16 39 L10 27 L3 34 Z" fill="#f8fafc" stroke="#0f172a" stroke-width="2.4" stroke-linejoin="round"/>
          </svg>
        </div>
        <b>${prelude.material} Sprite</b>
      `;
    }

    function vesiclePreviewIcon() {
      return `
        <svg class="vesicle-membrane-preview" viewBox="100 100 560 560" aria-label="Phospholipid vesicle">
          <image href="assets/cell-membrane-vesicle.svg" width="760" height="760"/>
        </svg>
        <b>Membrane Vesicle</b>
      `;
    }

    function transportPreludeTitle(prelude) {
      if (!prelude.subtitle) return escapeHtml(prelude.title);
      return `<span class="learning-title-main">${escapeHtml(prelude.title)}</span><span class="learning-title-sub">${escapeHtml(prelude.subtitle)}</span>`;
    }

    function legacyCellFunctionsIntroPopup(index = 0) {
      const level = currentLevel();
      if (!level.membraneDemoMode || level.demoStage !== "transport") return;
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return;
      state.transportPreludePopupOpen = true;
      popup.innerHTML = `
        <div class="learning-card cell-intro-card compact-preview-card">
          <div class="learning-step">Welcome, Cell Explorer</div>
          <h3>Learning the Functions of the Cell</h3>
          <p>Cells are like tiny factories. Each part has a job that helps the cell stay alive.</p>
          <p>In these first levels, you will watch tiny materials move across the cell membrane. Look closely, then use what you see as evidence.</p>
          <div class="intro-bubbles" aria-label="Materials you will watch">
            <div class="intro-bubble"><span>⚪</span>Oxygen slips in</div>
            <div class="intro-bubble"><span>💧</span>Water uses a channel</div>
            <div class="intro-bubble"><span>🟡</span>Glucose uses a door</div>
            <div class="intro-bubble"><span>🗑️</span>Waste leaves</div>
          </div>
          <p><b>Your mission:</b> Watch the animations, notice the pattern, and help the cell work like a smart factory.</p>
          <div class="learning-actions center-actions">
            <button class="primary" onclick="showTransportPreludePopup(${index})">Start Learning</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
    }

    function showCellFunctionsIntroPopup(index = 0) {
      const level = currentLevel();
      if (!level.membraneDemoMode || level.demoStage !== "transport") return;
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return;
      state.transportPreludePopupOpen = true;
      popup.innerHTML = `
        <div class="learning-card cell-intro-card compact-preview-card">
          <div class="learning-step">Welcome, Cell Explorer</div>
          <h3>Explore the Whole Cell</h3>
          <p>See what happens when you interact with parts of the cell.</p>
          <div class="whole-cell-preview" aria-label="Animated whole cell preview">
            <svg viewBox="0 0 260 260" role="img" aria-label="Whole cell with organelles">
              <defs>
                <radialGradient id="introCellFill" cx="42%" cy="36%" r="68%">
                  <stop offset="0%" stop-color="rgba(34,211,238,.38)" />
                  <stop offset="62%" stop-color="rgba(16,185,129,.20)" />
                  <stop offset="100%" stop-color="rgba(37,99,235,.12)" />
                </radialGradient>
              </defs>
              <g class="whole-cell-shell">
                <ellipse cx="130" cy="130" rx="98" ry="82" fill="url(#introCellFill)" stroke="#67e8f9" stroke-width="5" />
                <ellipse cx="130" cy="130" rx="82" ry="66" fill="none" stroke="rgba(187,247,208,.42)" stroke-width="2" stroke-dasharray="8 7" />
              </g>
              <g class="whole-cell-organelles">
                <circle cx="112" cy="114" r="30" fill="rgba(167,139,250,.44)" stroke="#ddd6fe" stroke-width="4" />
                <circle cx="112" cy="114" r="10" fill="#c4b5fd" />
                <ellipse cx="165" cy="150" rx="28" ry="14" fill="rgba(251,146,60,.36)" stroke="#fed7aa" stroke-width="4" transform="rotate(-24 165 150)" />
                <path d="M149 150 C157 143 171 143 181 150" fill="none" stroke="#fed7aa" stroke-width="3" stroke-linecap="round" />
                <ellipse cx="91" cy="161" rx="24" ry="13" fill="rgba(96,165,250,.34)" stroke="#bfdbfe" stroke-width="4" transform="rotate(20 91 161)" />
                <circle cx="168" cy="96" r="16" fill="rgba(132,204,22,.34)" stroke="#bef264" stroke-width="4" />
                <circle cx="78" cy="96" r="7" fill="#f9a8d4" />
                <circle cx="188" cy="126" r="6" fill="#f9a8d4" />
                <circle cx="132" cy="185" r="5" fill="#f9a8d4" />
              </g>
            </svg>
          </div>
          <p><b>Be ready:</b> Talk about what you observe.</p>
          <div class="learning-actions center-actions">
            <button class="primary" onclick="showTransportPreludePopup(${index})">Start Learning</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
    }

    function showTransportPreludePopup(index = 0) {
      const level = currentLevel();
      if (!level.membraneDemoMode || level.demoStage !== "transport") return;
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return;
      const i = Math.max(0, Math.min(TRANSPORT_PRELUDES.length - 1, Number.isInteger(currentLevel().transportPreludeIndex) ? currentLevel().transportPreludeIndex : index));
      state.transportPreludeIndex = i;
      state.transportPreludePopupOpen = true;
      const prelude = TRANSPORT_PRELUDES[i];
      popup.innerHTML = `
        <div class="learning-card compact-preview-card membrane-topic-card preview-card-transition">
          <div class="learning-step">Preview 1 of 2</div>
          <h3>${prelude.previewTitle || `${prelude.material} and the Membrane`}</h3>
          <div class="learning-grid single-panel">
            <div class="learning-copy-column">
              <div class="learning-point-bubble big-panel">
                <img class="membrane-focus-image" src="assets/cell-membrane.svg" alt="Phospholipid cell membrane" />
                <p><b>${prelude.previewLabel || "How it crosses"}:</b> ${prelude.previewRule}</p>
                ${prelude.previewTask ? `<p><b>Your turn:</b> ${prelude.previewTask}</p>` : ""}
              </div>
            </div>
          </div>
          <div class="learning-actions preview-actions one-action">
            <button class="primary" onclick="showTransportPreludeInfoPopup(${i})">See How to Play</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
    }

    function showTransportPreludeInfoPopup(index = 0) {
      const level = currentLevel();
      if (!level.membraneDemoMode || level.demoStage !== "transport") return;
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return;
      const i = Math.max(0, Math.min(TRANSPORT_PRELUDES.length - 1, index));
      state.transportPreludeIndex = i;
      state.transportPreludePopupOpen = true;
      const prelude = TRANSPORT_PRELUDES[i];
      const showVesicle = prelude.id === "waste" && isWasteVesicleLevel(level);
      const iconRowStyle = showVesicle ? ` style="grid-template-columns: repeat(3, minmax(0, 1fr));"` : "";
      popup.innerHTML = `
        <div class="learning-card compact-preview-card preview-card-transition">
          <div class="learning-step">Preview 2 of 2</div>
          <h3>${transportPreludeTitle(prelude)}</h3>
          <div class="learning-grid single-panel">
            <div class="learning-sim-preview">
              <div class="learning-icon-row large-icons${showVesicle ? " three-icons" : ""}"${iconRowStyle}>
                <div class="learning-icon large drag-tutorial-icon">${transportDragPreviewIcon(prelude)}</div>
                ${showVesicle ? `<div class="learning-icon large">${vesiclePreviewIcon()}</div>` : ""}
                <div class="learning-icon large">${transportPreludeIcon(prelude, "path")}</div>
              </div>
              <p><b>In the simulation:</b> ${prelude.simText}</p>
            </div>
          </div>
          <div class="learning-actions preview-actions two-actions">
            <button class="ghost" onclick="showTransportPreludePopup(${i})">Back to Membrane</button>
            <button class="primary" onclick="startTransportPreludeDemo(${i})">Start Activity</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
    }

    function clearTransportPreludeOverlay() {
      document.querySelectorAll(".transport-prelude-overlay").forEach(node => node.remove());
    }

    function centerTransportOverlay(prelude) {
      clearTransportPreludeOverlay();
      if (prelude.id !== "oxygen") return null;
      const layer = document.getElementById("demoParticles");
      if (!layer) return null;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-particle transport-prelude-overlay");
      g.innerHTML = `
        <text x="450" y="132" class="demo-hotspot-label">Cell Membrane</text>
      `;
      layer.appendChild(g);
      return g;
    }

    function currentTransportPreludeIndex() {
      const level = currentLevel();
      const idx = level && Number.isInteger(level.transportPreludeIndex) ? level.transportPreludeIndex : (state.transportPreludeIndex || 0);
      return Math.max(0, Math.min(TRANSPORT_PRELUDES.length - 1, idx));
    }

    function transportShape(prelude) {
      if (prelude.id === "oxygen") return `<circle class="oxygen-hit-area" cx="0" cy="0" r="13" fill="#ffffff" fill-opacity=".001" stroke="none"/><circle cx="0" cy="0" r="6" fill="#f8fafc" stroke="#bfdbfe" stroke-width="1.5"/>`;
      if (prelude.id === "largeMolecule") return `<circle cx="0" cy="0" r="18" fill="#7c3aed" stroke="#ddd6fe" stroke-width="3"/><circle cx="-7" cy="-7" r="4" fill="rgba(255,255,255,.32)"/>`;
      if (prelude.id === "water") return `<path d="M0,-18 C7,-10 13,-2 13,8 C13,19 7,27 0,27 C-7,27 -13,19 -13,8 C-13,-2 -7,-10 0,-18 Z" fill="#38bdf8" stroke="#bae6fd" stroke-width="3"/>`;
      if (prelude.id === "glucose") return `<polygon points="0,-13 12,-6 12,7 0,14 -12,7 -12,-6" fill="#fde047" stroke="#fff7ad" stroke-width="3"/>`;
      return `<rect x="-10" y="-10" width="20" height="20" rx="5" fill="#94a3b8" stroke="#e2e8f0" stroke-width="3"/>`;
    }

    function centeredPreludeFrames(prelude, i = 0) {
      const lanes = [238, 266, 294, 322, 252, 308];
      const y = lanes[i % lanes.length];
      if (prelude.id === "waste") {
        return [
          { x: 790 + i * 10, y, opacity: 1, scale: 1, offset: 0 },
          { x: 620, y, opacity: 1, scale: 1, offset: .30 },
          { x: 450, y, opacity: 1, scale: .92, offset: .58 },
          { x: 220 - i * 8, y, opacity: 1, scale: 1, offset: 1 }
        ];
      }
      return [
        { x: 105 - i * 8, y, opacity: 1, scale: 1, offset: 0 },
        { x: 290, y, opacity: 1, scale: 1, offset: .30 },
        { x: 450, y, opacity: 1, scale: .92, offset: .58 },
        { x: 682 + i * 8, y, opacity: 1, scale: 1, offset: 1 }
      ];
    }

    function startTransportPreludes() {
      if (typeof isCombinedTransportLevel === "function" && isCombinedTransportLevel()) {
        startCombinedTransportChallenge();
        return;
      }
      const idx = currentTransportPreludeIndex();
      state.transportPreludeIndex = idx;
      state.transportPreludeActive = false;
      state.transportPreludePopupOpen = false;
      state.transportPreludeFinished = false;
      clearTransportPreludeOverlay();
      if (state.transportRecapOnStartIndex !== null) {
        const recapIndex = Math.max(0, Math.min(TRANSPORT_PRELUDES.length - 1, state.transportRecapOnStartIndex));
        state.transportRecapOnStartIndex = null;
        demoSetTimeout(() => showTransportPreludeReviewPopup(recapIndex), 250);
        membraneFeedback("Here is the recap from the water-channel level. Continue from here when you are ready.", 2, 7000);
        return;
      }
      demoSetTimeout(() => {
        if (idx === 0) showCellFunctionsIntroPopup(idx);
        else showTransportPreludePopup(idx);
      }, 250);
      clearDemoInstructionText();
    }

    function replayTransportPrelude() {
      const level = currentLevel();
      if (!level.membraneDemoMode || level.demoStage !== "transport") return;
      const idx = Math.max(0, Math.min(TRANSPORT_PRELUDES.length - 1, state.transportPreludeIndex || 0));
      startTransportPreludeDemo(idx);
    }

    function glucoseAutoDoorMode(level = currentLevel()) {
      return !!(level?.glucoseDragChallenge?.autoDoor || (typeof isCombinedTransportLevel === "function" && isCombinedTransportLevel(level)));
    }

    function glucoseDragDoorY(level = currentLevel()) {
      const configuredY = Number(level?.glucoseDragChallenge?.doorY);
      return Number.isFinite(configuredY) ? configuredY : GLUCOSE_DRAG_DOOR_Y;
    }

    function combinedTransportTargetsComplete(level = currentLevel()) {
      if (typeof isCombinedTransportLevel !== "function" || !isCombinedTransportLevel(level)) return false;
      return (state.waterDragTransported || 0) >= waterDragGoal(level) &&
        (state.glucoseDragTransported || 0) >= glucoseDragGoal(level) &&
        (state.wasteVesicleExported || 0) >= wasteVesicleGoal(level);
    }

    function finishCombinedTransportPart(action, message) {
      const level = currentLevel();
      if (typeof isCombinedTransportLevel !== "function" || !isCombinedTransportLevel(level)) return false;
      markAction(action);
      renderStats();
      renderDetails();
      if (combinedTransportTargetsComplete(level) && !state.combinedTransportReviewQueued) {
        state.combinedTransportReviewQueued = true;
        state.transportPreludeActive = false;
        membraneFeedback("All three transport paths worked: water channel, glucose door, and vesicle waste export.", 4, 4200);
        demoSetTimeout(showCombinedTransportReviewPopup, 800);
      } else if (message) {
        membraneFeedback(message, 3, 2800);
      }
      return true;
    }

    function showCombinedTransportReviewPopup() {
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return;
      popup.innerHTML = `
        <div class="learning-card">
          <div class="learning-step">Level Complete</div>
          <h3>Membrane Transport Review</h3>
          <div class="learning-grid">
            <div class="learning-sim-preview">
              <div class="learning-icon-row" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
                <div class="learning-icon">${transportPreludeIcon(TRANSPORT_PRELUDES.find(item => item.id === "water"), "path")}</div>
                <div class="learning-icon">${transportPreludeIcon(TRANSPORT_PRELUDES.find(item => item.id === "glucose"), "path")}</div>
                <div class="learning-icon">${vesiclePreviewIcon()}</div>
              </div>
            </div>
            <div class="learning-copy-column">
              <div class="learning-point-bubble big-panel">
                <p><b>Water:</b> crossed only through the Water Channel.</p>
                <p><b>Glucose:</b> entered through the Glucose Door one at a time.</p>
                <p><b>Waste:</b> had to be packed into vesicles before release near the waste exit.</p>
              </div>
            </div>
          </div>
          <div class="learning-actions">
            <button class="primary" onclick="loadLevel(state.levelIndex + 1)">Next Level</button>
            <button class="ghost" onclick="closeLearningPopup()">Close</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
    }

    function setPreludeGlucoseGateState(overlay, side, open) {
      if (!overlay) return;
      const gate = overlay.querySelector(side === "outer" ? ".prelude-glucose-outer-gate" : ".prelude-glucose-inner-gate");
      if (!gate) return;

      // Treat the glucose door as a two-panel airlock instead of one generic door.
      // The outside/left panel slides left. The inside/right panel slides right.
      const shiftX = open ? (side === "outer" ? -18 : 18) : 0;
      gate.style.transformBox = "fill-box";
      gate.style.transformOrigin = "center";
      gate.animate([
        { transform: gate.style.transform || "translateX(0px)", opacity: gate.style.opacity || 1 },
        { transform: `translateX(${shiftX}px)`, opacity: open ? .38 : 1 }
      ], { duration: 260, easing: "ease-in-out", fill: "forwards" });
      gate.style.transform = `translateX(${shiftX}px)`;
      gate.style.opacity = open ? .38 : 1;
    }

    function runCenteredWaterPrelude(shape) {
      // Two quick rounds. The Water Channel is horizontal across the membrane.
      // Both entering and exiting water now spawn near the visible side edges,
      // move into line, pass through the same middle lane, then continue off-screen.
      const count = 4;
      const stagger = 500;
      const moveDuration = 3400;
      const roundGap = 360;
      const roundDuration = (count - 1) * stagger + moveDuration;
      const totalDuration = roundDuration * 2 + roundGap;

      for (let round = 0; round < 2; round++) {
        const roundStart = round * (roundDuration + roundGap);
        demoSetTimeout(() => {
          if (!currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
          const entering = [];
          const exiting = [];
          const laneY = 280;
          const entryQueueStartX = 360;
          const exitQueueStartX = 540;
          const spacing = 44;
          const leftVisibleEdgeX = 86;
          const rightVisibleEdgeX = 814;

          for (let n = 0; n < count; n++) {
            const queueX = entryQueueStartX - n * spacing;
            const spawnX = leftVisibleEdgeX + n * 8;
            entering.push({ g: demoGroup("Water", shape, spawnX, laneY), spawnX, queueX });
          }
          for (let n = 0; n < count; n++) {
            const queueX = exitQueueStartX + n * spacing;
            const spawnX = rightVisibleEdgeX - n * 8;
            exiting.push({ g: demoGroup("Water", shape, spawnX, laneY), spawnX, queueX });
          }

          entering.forEach((item, n) => {
            demoSetTimeout(() => {
              if (!item.g || !item.g.isConnected) return;
              animateDemoGroup(item.g, [
                { x: item.spawnX, y: laneY, opacity: 1, scale: 1, offset: 0 },
                { x: item.queueX, y: laneY, opacity: 1, scale: 1, offset: .16 },
                { x: 392, y: laneY, opacity: 1, scale: 1, offset: .30 },
                { x: 424, y: laneY, opacity: 1, scale: .94, offset: .46 },
                { x: 450, y: laneY, opacity: 1, scale: .84, offset: .60 },
                { x: 482, y: laneY, opacity: 1, scale: .94, offset: .74 },
                { x: 814 - n * 8, y: laneY, opacity: 1, scale: 1, offset: 1 }
              ], moveDuration, { linear: true });
            }, n * stagger);
          });

          exiting.forEach((item, n) => {
            demoSetTimeout(() => {
              if (!item.g || !item.g.isConnected) return;
              animateDemoGroup(item.g, [
                { x: item.spawnX, y: laneY, opacity: 1, scale: 1, offset: 0 },
                { x: item.queueX, y: laneY, opacity: 1, scale: 1, offset: .16 },
                { x: 508, y: laneY, opacity: 1, scale: 1, offset: .30 },
                { x: 476, y: laneY, opacity: 1, scale: .94, offset: .46 },
                { x: 450, y: laneY, opacity: 1, scale: .84, offset: .60 },
                { x: 418, y: laneY, opacity: 1, scale: .94, offset: .74 },
                { x: 86 + n * 8, y: laneY, opacity: 1, scale: 1, offset: 1 }
              ], moveDuration, { linear: true });
            }, n * stagger);
          });
        }, roundStart);
      }
      return totalDuration;
    }

    function simpleMoleculeDragKindFromPrelude(prelude) {
      return prelude.id === "largeMolecule" ? "largeMolecule" : "oxygen";
    }

    function simpleMoleculeDragConfig(kind) {
      if (kind === "largeMolecule") {
        return {
          action: "demoLargeMoleculeBlock",
          label: "Large Molecule",
          shape: transportShape({ id: "largeMolecule" }),
          completeText: "Large molecules bounced",
          successText: "Large molecule tested",
          finalText: "All 5 large molecules bounced off. Review what happened."
        };
      }
      return {
        action: "demoOxygenPass",
        label: "Oxygen",
        shape: transportShape({ id: "oxygen" }),
        completeText: "Oxygen slipped through",
        successText: "Oxygen transported",
        finalText: "All 5 oxygen molecules slipped through. Review what happened."
      };
    }

    function simpleMoleculeDragBounds(side) {
      return side === "inside"
        ? { xMin: MEMBRANE_ROAM_INSIDE_MIN_X, xMax: 824, yMin: 126, yMax: 428 }
        : { xMin: 92, xMax: MEMBRANE_ROAM_OUTSIDE_MAX_X, yMin: 126, yMax: 428 };
    }

    function randomSimpleMoleculeDragPoint(side = "outside") {
      const bounds = simpleMoleculeDragBounds(side);
      return {
        x: randomInRange(bounds.xMin + 28, bounds.xMax - 28),
        y: randomInRange(bounds.yMin + 28, bounds.yMax - 28)
      };
    }

    function clampSimpleMoleculePointToSide(point, side) {
      const bounds = simpleMoleculeDragBounds(side);
      return {
        x: Math.max(bounds.xMin, Math.min(bounds.xMax, point.x)),
        y: Math.max(bounds.yMin, Math.min(bounds.yMax, point.y))
      };
    }

    function setSimpleMoleculeSpritePosition(sprite) {
      if (sprite && sprite.g && sprite.g.isConnected) {
        sprite.g.setAttribute("transform", `translate(${sprite.x.toFixed(1)} ${sprite.y.toFixed(1)})`);
      }
    }

    function createSimpleMoleculeDragSprite(kind, side = "outside") {
      const config = simpleMoleculeDragConfig(kind);
      const point = randomSimpleMoleculeDragPoint(side);
      const g = demoGroup(config.label, config.shape, point.x, point.y);
      g.classList.add("simple-molecule-drag-sprite");
      const sprite = {
        id: state.nextDemoObjectId++,
        kind,
        side,
        g,
        x: point.x,
        y: point.y,
        vx: (Math.random() < .5 ? -1 : 1) * randomInRange(11, 23),
        vy: (Math.random() < .5 ? -1 : 1) * randomInRange(9, 21),
        dragging: false,
        busy: false,
        dragPointerId: null,
        dragStartX: null,
        dragStartY: null
      };
      g.addEventListener("pointerdown", event => startDraggingSimpleMoleculeSprite(event, sprite));
      state.simpleMoleculeDragSprites.push(sprite);
      return sprite;
    }

    function startDraggingSimpleMoleculeSprite(event, sprite) {
      const expectedSide = sprite.kind === "oxygen" && state.simpleMoleculeDragPhase === "out" ? "inside" : "outside";
      if (!state.simpleMoleculeDragChallengeActive || state.simpleMoleculeDragReviewQueued || state.simpleMoleculeDragPhase === "returnPrompt" || sprite.busy || sprite.side !== expectedSide) return;
      event.preventDefault();
      sprite.dragging = true;
      sprite.dragPointerId = event.pointerId;
      sprite.dragStartX = sprite.x;
      sprite.dragStartY = sprite.y;
      sprite.g.classList.add("dragging");
      sprite.g.parentNode.appendChild(sprite.g);
      try { sprite.g.setPointerCapture(event.pointerId); } catch (err) {}
      moveDraggedSimpleMoleculeSprite(event, sprite);
      sprite.g.addEventListener("pointermove", sprite._moveHandler = e => moveDraggedSimpleMoleculeSprite(e, sprite));
      sprite.g.addEventListener("pointerup", sprite._upHandler = e => releaseDraggedSimpleMoleculeSprite(e, sprite));
      sprite.g.addEventListener("pointercancel", sprite._cancelHandler = e => releaseDraggedSimpleMoleculeSprite(e, sprite));
    }

    function moveDraggedSimpleMoleculeSprite(event, sprite) {
      if (!sprite.dragging || sprite.dragPointerId !== event.pointerId) return;
      event.preventDefault();
      const point = clampSimpleMoleculePointToSide(svgPointFromEvent(event), sprite.side);
      sprite.x = point.x;
      sprite.y = point.y;
      setSimpleMoleculeSpritePosition(sprite);
    }

    function cleanupSimpleMoleculeDragHandlers(sprite) {
      if (!sprite || !sprite.g) return;
      if (sprite._moveHandler) sprite.g.removeEventListener("pointermove", sprite._moveHandler);
      if (sprite._upHandler) sprite.g.removeEventListener("pointerup", sprite._upHandler);
      if (sprite._cancelHandler) sprite.g.removeEventListener("pointercancel", sprite._cancelHandler);
      sprite._moveHandler = null;
      sprite._upHandler = null;
      sprite._cancelHandler = null;
      try {
        if (sprite.dragPointerId !== null) sprite.g.releasePointerCapture(sprite.dragPointerId);
      } catch (err) {}
      sprite.dragPointerId = null;
      sprite.g.classList.remove("dragging");
    }

    function releaseDraggedSimpleMoleculeSprite(event, sprite) {
      if (!sprite.dragging || sprite.dragPointerId !== event.pointerId) return;
      event.preventDefault();
      sprite.dragging = false;
      cleanupSimpleMoleculeDragHandlers(sprite);
      const dragDistance = Math.hypot(sprite.x - (sprite.dragStartX ?? sprite.x), sprite.y - (sprite.dragStartY ?? sprite.y));
      sprite.dragStartX = null;
      sprite.dragStartY = null;
      if (dragDistance < 18) return;
      const movingOutside = sprite.kind === "oxygen" && state.simpleMoleculeDragPhase === "out";
      if ((!movingOutside && sprite.x < 250) || (movingOutside && sprite.x > 650)) {
        membraneFeedback(`Release from the middle or near the membrane on the ${movingOutside ? "inside" : "outside"} of the cell.`, 2, 2600);
        return;
      }
      if (sprite.kind === "largeMolecule") launchSimpleMoleculeBounce(sprite);
      else launchSimpleMoleculePass(sprite);
    }

    function popTooBigBubble(x, y) {
      const layer = document.getElementById("demoParticles");
      if (!layer) return;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-bubble");
      g.setAttribute("transform", `translate(${x} ${y}) scale(.72)`);
      g.innerHTML = `
        <rect x="-52" y="-24" width="104" height="42" rx="21" fill="rgba(124,58,237,.92)" stroke="#ddd6fe" stroke-width="3"/>
        <text x="0" y="3">too big!</text>
      `;
      layer.appendChild(g);
      g.animate([
        { transform: `translate(${x}px, ${y}px) scale(.55)`, opacity: 0 },
        { transform: `translate(${x}px, ${y - 8}px) scale(1)`, opacity: 1, offset: .18 },
        { transform: `translate(${x}px, ${y - 28}px) scale(1.08)`, opacity: 1, offset: .62 },
        { transform: `translate(${x}px, ${y - 44}px) scale(.25)`, opacity: 0 }
      ], { duration: 1200, easing: "ease-out" });
      demoSetTimeout(() => g.remove(), 1280);
    }

    function completeSimpleMoleculeAttempt(sprite) {
      state.simpleMoleculeDragCompleted = Math.min(simpleMoleculeDragGoal(), (state.simpleMoleculeDragCompleted || 0) + 1);
      renderStats();
      const goal = simpleMoleculeDragGoal();
      const config = simpleMoleculeDragConfig(sprite.kind);
      if (state.simpleMoleculeDragCompleted >= goal) {
        if (sprite.kind === "oxygen" && state.simpleMoleculeDragPhase === "in") showOxygenReturnDirectionPopup();
        else finishSimpleMoleculeDragChallengeAfterFloat(sprite.kind);
      } else {
        const successText = sprite.kind === "oxygen"
          ? (state.simpleMoleculeDragPhase === "out" ? "Oxygen moved outside" : "Oxygen moved inside")
          : config.successText;
        membraneFeedback(`${successText}: ${state.simpleMoleculeDragCompleted}/${goal}`, 3, 2600);
      }
    }

    function replaceSimpleMoleculeSprite(sprite) {
      state.simpleMoleculeDragSprites = state.simpleMoleculeDragSprites.filter(item => item !== sprite);
      if (sprite.g && sprite.g.isConnected) sprite.g.remove();
      demoSetTimeout(() => {
        if (state.simpleMoleculeDragChallengeActive && !state.simpleMoleculeDragReviewQueued && state.simpleMoleculeDragCompleted < simpleMoleculeDragGoal()) {
          createSimpleMoleculeDragSprite(sprite.kind);
        }
      }, 420);
    }

    function nearestOxygenMembraneGap(sprite, incomingSide) {
      const host = document.getElementById("demoMembraneInline");
      const layer = document.getElementById("demoParticles");
      const moleculeRect = (sprite.g.querySelector(".demo-particle-body") || sprite.g).getBoundingClientRect();
      const moleculeScreenY = moleculeRect.top + moleculeRect.height / 2;
      if (host?.dataset.ready !== "true" || !layer) {
        return { localY: sprite.y, screenY: moleculeScreenY };
      }

      const simulationRect = document.getElementById("cellSvg")?.getBoundingClientRect();
      const headCenters = Array.from(host.querySelectorAll(`.phospholipid[data-side="${incomingSide}"]`))
        .map(head => {
          const rect = head.getBoundingClientRect();
          return { y: rect.top + rect.height / 2, rect };
        })
        .filter(item => !simulationRect || (item.rect.bottom >= simulationRect.top && item.rect.top <= simulationRect.bottom))
        .sort((a, b) => a.y - b.y);

      let gapScreenY = moleculeScreenY;
      let bestDistance = Infinity;
      for (let i = 0; i < headCenters.length - 1; i++) {
        const midpoint = (headCenters[i].y + headCenters[i + 1].y) / 2;
        const distance = Math.abs(midpoint - moleculeScreenY);
        if (distance < bestDistance) {
          bestDistance = distance;
          gapScreenY = midpoint;
        }
      }

      const membraneRect = host.getBoundingClientRect();
      const localPoint = screenPointToSvg(layer, membraneRect.left + membraneRect.width / 2, gapScreenY);
      return { localY: localPoint?.y ?? sprite.y, screenY: gapScreenY };
    }

    function animateOxygenDiffusionVisual(sprite, delay, duration, reducedMotion) {
      const visual = sprite.g.querySelector(".demo-particle-body");
      if (!visual) return;
      visual._diffusionAnimation?.cancel();
      const keyframes = reducedMotion ? [
        { opacity: 1 },
        { opacity: .8, offset: .25 },
        { opacity: .8, offset: .75 },
        { opacity: 1 }
      ] : [
        { transform: "scale(1, 1)", opacity: 1, filter: "blur(0px) drop-shadow(0 0 0 rgba(191,219,254,0))" },
        { transform: "scale(.91, 1.06)", opacity: .92, filter: "blur(.15px) drop-shadow(0 0 2px rgba(191,219,254,.3))", offset: .08 },
        { transform: "scale(.90, .95)", opacity: .78, filter: "blur(.55px) drop-shadow(0 0 3px rgba(147,197,253,.35))", offset: .45 },
        { transform: "scale(.94, 1.03)", opacity: .84, filter: "blur(.25px) drop-shadow(0 0 4px rgba(191,219,254,.45))", offset: .72 },
        { transform: "scale(1.03, 1.03)", opacity: 1, filter: "blur(0px) drop-shadow(0 0 8px rgba(219,234,254,.8))", offset: .86 },
        { transform: "scale(1, 1)", opacity: 1, filter: "blur(0px) drop-shadow(0 0 0 rgba(191,219,254,0))" }
      ];
      visual._diffusionAnimation = visual.animate(keyframes, {
        duration,
        delay,
        easing: "ease-in-out"
      });
    }

    function triggerOxygenMembraneReaction(impactY, incomingSide) {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const host = document.getElementById("demoMembraneInline");
      if (host?.dataset.ready !== "true") return;
      const reactionRadius = 64;
      const heads = Array.from(host.querySelectorAll(`.phospholipid[data-side="${incomingSide}"]`))
        .map(element => {
          const rect = element.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          return { element, centerY, distance: Math.abs(centerY - impactY) };
        })
        .filter(item => item.distance <= reactionRadius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 8);
      const allImpactGroups = Array.from(host.querySelectorAll(".lipid-impact-motion"));

      heads.forEach((item, index) => {
        const strength = Math.max(0, 1 - item.distance / reactionRadius);
        const awayFromGap = item.centerY < impactY ? -1 : 1;
        const screenY = awayFromGap * (0.6 + 1.3 * strength);
        const key = item.element.dataset.lipidKey;
        allImpactGroups
          .filter(group => group.parentElement?.dataset.lipidKey === key)
          .forEach(group => {
            const local = screenVectorToLocal(group, 0, screenY);
            group._impactAnimation?.cancel();
            group._impactAnimation = group.animate([
              { transform: "translate(0px, 0px)" },
              { transform: `translate(${local.x.toFixed(2)}px, ${local.y.toFixed(2)}px)`, offset: .3 },
              { transform: `translate(${(-local.x * .12).toFixed(2)}px, ${(-local.y * .12).toFixed(2)}px)`, offset: .68 },
              { transform: "translate(0px, 0px)" }
            ], { duration: 900, delay: index * 16, easing: "ease-out" });
          });
      });
    }

    function launchSimpleMoleculePass(sprite) {
      const movingOutside = state.simpleMoleculeDragPhase === "out";
      const targetSide = movingOutside ? "outside" : "inside";
      const incomingSide = movingOutside ? "right" : "left";
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      sprite.busy = true;
      sprite.g.classList.remove("simple-molecule-drag-sprite");
      sprite.g.style.pointerEvents = "none";
      const target = randomSimpleMoleculeDragPoint(targetSide);
      target.y = Math.max(142, Math.min(414, sprite.y + randomInRange(-18, 18)));
      const gap = nearestOxygenMembraneGap(sprite, incomingSide);
      const wiggle = sprite.id % 2 ? 1 : -1;
      const straightY = (sprite.y + target.y) / 2;
      const frames = reducedMotion
        ? (movingOutside ? [
            { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
            { x: 500, y: straightY, opacity: 1, scale: 1, offset: .18 },
            { x: 450, y: straightY, opacity: 1, scale: 1, offset: .48 },
            { x: 400, y: straightY, opacity: 1, scale: 1, offset: .74 },
            { x: target.x, y: target.y, opacity: 1, scale: 1, offset: 1 }
          ] : [
            { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
            { x: 400, y: straightY, opacity: 1, scale: 1, offset: .18 },
            { x: 450, y: straightY, opacity: 1, scale: 1, offset: .48 },
            { x: 500, y: straightY, opacity: 1, scale: 1, offset: .74 },
            { x: target.x, y: target.y, opacity: 1, scale: 1, offset: 1 }
          ])
        : (movingOutside ? [
            { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
            { x: 510, y: gap.localY, opacity: 1, scale: 1, offset: .12 },
            { x: 488, y: gap.localY + 2 * wiggle, opacity: 1, scale: 1, offset: .22 },
            { x: 466, y: gap.localY - 3 * wiggle, opacity: 1, scale: 1, offset: .38 },
            { x: 438, y: gap.localY + 3 * wiggle, opacity: 1, scale: 1, offset: .58 },
            { x: 410, y: gap.localY - wiggle, opacity: 1, scale: 1, offset: .74 },
            { x: 380, y: gap.localY, opacity: 1, scale: 1, offset: .84 },
            { x: target.x, y: target.y, opacity: 1, scale: 1, offset: 1 }
          ] : [
            { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
            { x: 390, y: gap.localY, opacity: 1, scale: 1, offset: .12 },
            { x: 412, y: gap.localY - 2 * wiggle, opacity: 1, scale: 1, offset: .22 },
            { x: 434, y: gap.localY + 3 * wiggle, opacity: 1, scale: 1, offset: .38 },
            { x: 462, y: gap.localY - 3 * wiggle, opacity: 1, scale: 1, offset: .58 },
            { x: 490, y: gap.localY + wiggle, opacity: 1, scale: 1, offset: .74 },
            { x: 520, y: gap.localY, opacity: 1, scale: 1, offset: .84 },
            { x: target.x, y: target.y, opacity: 1, scale: 1, offset: 1 }
          ]);
      animateOxygenDiffusionVisual(sprite, 260, 1050, reducedMotion);
      demoSetTimeout(() => triggerOxygenMembraneReaction(gap.screenY, incomingSide), 300);
      animateDemoGroup(sprite.g, frames, 1500, { linear: true, removeAtEnd: false, onDone: () => {
        sprite.x = target.x;
        sprite.y = target.y;
        sprite.side = targetSide;
        sprite.busy = false;
        sprite.vx = (Math.random() < .5 ? -1 : 1) * randomInRange(11, 23);
        sprite.vy = (Math.random() < .5 ? -1 : 1) * randomInRange(9, 21);
        sprite.g.classList.add("simple-molecule-drag-sprite");
        sprite.g.style.pointerEvents = "all";
        setSimpleMoleculeSpritePosition(sprite);
        adjustStats({ oxygen: movingOutside ? -2 : +2, transport: +1 });
        completeSimpleMoleculeAttempt(sprite);
      }});
    }

    const LARGE_MOLECULE_CONTACT_X = 396;

    function launchSimpleMoleculeBounce(sprite) {
      sprite.busy = true;
      sprite.g.classList.remove("simple-molecule-drag-sprite");
      sprite.g.style.pointerEvents = "none";
      demoSetTimeout(() => {
        popTooBigBubble(LARGE_MOLECULE_CONTACT_X + 20, sprite.y - 32);
        triggerMembraneImpact(sprite.g);
      }, 330);
      animateDemoGroup(sprite.g, [
        { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
        { x: LARGE_MOLECULE_CONTACT_X, y: sprite.y, opacity: 1, scale: 1.1, offset: .28 },
        { x: 358, y: sprite.y - 16, opacity: 1, scale: 1.04, offset: .52 },
        { x: 262, y: sprite.y - 34, opacity: .82, scale: .94, offset: .78 },
        { x: 126, y: sprite.y - 48, opacity: 0, scale: .76, offset: 1 }
      ], 1250, { linear: true, removeAtEnd: false, onDone: () => {
        completeSimpleMoleculeAttempt(sprite);
        replaceSimpleMoleculeSprite(sprite);
      }});
    }

    function startSimpleMoleculeDragFloatLoop() {
      const runId = state.demoRunId;
      let last = performance.now();
      function step(now) {
        if (runId !== state.demoRunId || !state.simpleMoleculeDragChallengeActive) return;
        const dt = Math.min(.04, Math.max(.001, (now - last) / 1000));
        last = now;
        state.simpleMoleculeDragSprites.forEach(sprite => {
          if (!sprite.g || !sprite.g.isConnected || sprite.dragging || sprite.busy) return;
          const bounds = simpleMoleculeDragBounds(sprite.side || "outside");
          sprite.x += sprite.vx * dt;
          sprite.y += sprite.vy * dt;
          if (sprite.x < bounds.xMin || sprite.x > bounds.xMax) sprite.vx *= -1;
          if (sprite.y < bounds.yMin || sprite.y > bounds.yMax) sprite.vy *= -1;
          sprite.x = Math.max(bounds.xMin, Math.min(bounds.xMax, sprite.x));
          sprite.y = Math.max(bounds.yMin, Math.min(bounds.yMax, sprite.y));
          setSimpleMoleculeSpritePosition(sprite);
        });
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      }
      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function startSimpleMoleculeDragChallenge(index, prelude) {
      const kind = simpleMoleculeDragKindFromPrelude(prelude);
      state.transportPreludeIndex = index;
      state.transportPreludeActive = true;
      state.simpleMoleculeDragChallengeActive = true;
      state.simpleMoleculeDragSprites = [];
      state.simpleMoleculeDragCompleted = 0;
      state.simpleMoleculeDragPhase = "in";
      state.simpleMoleculeDragReviewQueued = false;
      clearTransportPreludeOverlay();
      document.querySelectorAll("#demoParticles .demo-particle:not(.transport-prelude-overlay)").forEach(node => node.remove());
      renderStats();
      if (kind === "largeMolecule") startBackgroundOxygen();
      for (let i = 0; i < simpleMoleculeDragGoal(); i++) createSimpleMoleculeDragSprite(kind);
      startSimpleMoleculeDragFloatLoop();
      clearDemoInstructionText();
      renderDetails();
    }

    function showOxygenReturnDirectionPopup() {
      if (state.simpleMoleculeDragPhase !== "in") return;
      state.simpleMoleculeDragPhase = "returnPrompt";
      state.transportPreludePopupOpen = true;
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return;
      popup.innerHTML = `
      <div class="learning-card compact-preview-card membrane-topic-card">
          <div class="learning-step">Oxygen Checkpoint</div>
          <h3>Oxygen Can Move Both Ways</h3>
          <div class="learning-grid single-panel">
            <div class="learning-copy-column">
              <div class="learning-point-bubble big-panel">
                <img class="membrane-focus-image" src="assets/cell-membrane.svg" alt="Phospholipid cell membrane" />
                <p><b>Why?</b> Oxygen is tiny, so it can slip through the membrane in or out.</p>
                <p><b>Your turn:</b> Move the same 5 oxygen molecules back outside.</p>
              </div>
            </div>
          </div>
          <div class="learning-actions center-actions">
            <button class="primary" onclick="startOxygenReturnPhase()">Move Oxygen Back Outside</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
      membraneFeedback("The 5 oxygen molecules are inside. Now move them back out.", 4, 4200);
    }

    function startOxygenReturnPhase() {
      if (!isSimpleMoleculeDragLevel() || simpleMoleculeDragKind() !== "oxygen" || state.simpleMoleculeDragPhase !== "returnPrompt") return;
      const popup = document.getElementById("transportLearningPopup");
      if (popup) popup.classList.remove("visible");
      state.transportPreludePopupOpen = false;
      state.simpleMoleculeDragPhase = "out";
      state.simpleMoleculeDragCompleted = 0;
      state.simpleMoleculeDragSprites.forEach(sprite => {
        if (!sprite.g || !sprite.g.isConnected) return;
        sprite.busy = false;
        sprite.g.classList.add("simple-molecule-drag-sprite");
        sprite.g.style.pointerEvents = "all";
      });
      renderStats();
      membraneFeedback("Now drag the 5 oxygen molecules from inside toward the membrane so they move back outside.", 4, 5200);
      renderDetails();
    }

    function finishSimpleMoleculeDragChallengeAfterFloat(kind) {
      if (state.simpleMoleculeDragReviewQueued) return;
      state.simpleMoleculeDragReviewQueued = true;
      const config = simpleMoleculeDragConfig(kind);
      const finalText = kind === "oxygen"
        ? "All 5 oxygen molecules moved back outside. Review what the membrane allowed in both directions."
        : config.finalText;
      membraneFeedback(finalText, 4, 3600);
      demoSetTimeout(() => {
        if (!state.simpleMoleculeDragChallengeActive || !currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
        state.simpleMoleculeDragChallengeActive = false;
        state.transportPreludeActive = false;
        markAction(config.action);
        showTransportPreludeReviewPopup(currentTransportPreludeIndex());
        renderDetails();
      }, 1700);
    }

    function randomInRange(min, max) {
      return min + Math.random() * (max - min);
    }

    function waterDragShape() {
      return `<path d="M0,-18 C7,-10 13,-2 13,8 C13,19 7,27 0,27 C-7,27 -13,19 -13,8 C-13,-2 -7,-10 0,-18 Z" fill="#38bdf8" stroke="#bae6fd" stroke-width="3"/>`;
    }

    function waterDragBounds(side) {
      return WATER_DRAG_BOUNDS[side === "inside" ? "inside" : "outside"];
    }

    function randomWaterDragPoint(side) {
      const bounds = waterDragBounds(side);
      return {
        x: randomInRange(bounds.xMin + 22, bounds.xMax - 22),
        y: randomInRange(bounds.yMin + 24, bounds.yMax - 24)
      };
    }

    function svgPointFromEvent(event) {
      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: pt.x, y: pt.y };
      return pt.matrixTransform(ctm.inverse());
    }

    function clampWaterPointToSide(point, side) {
      const bounds = waterDragBounds(side);
      return {
        x: Math.max(bounds.xMin, Math.min(bounds.xMax, point.x)),
        y: Math.max(bounds.yMin, Math.min(bounds.yMax, point.y))
      };
    }

    function setWaterSpritePosition(sprite) {
      if (sprite && sprite.g && sprite.g.isConnected) {
        sprite.g.setAttribute("transform", `translate(${sprite.x.toFixed(1)} ${sprite.y.toFixed(1)})`);
      }
    }

    function createWaterDragSprite(side = waterDragStartSide()) {
      const point = randomWaterDragPoint(side);
      const g = demoGroup("Water", waterDragShape(), point.x, point.y);
      g.classList.add("water-drag-droplet");
      const sprite = {
        id: state.nextDemoObjectId++,
        g,
        side,
        x: point.x,
        y: point.y,
        vx: (Math.random() < .5 ? -1 : 1) * randomInRange(12, 24),
        vy: (Math.random() < .5 ? -1 : 1) * randomInRange(10, 22),
        dragging: false,
        busy: false,
        dragPointerId: null
      };
      g.addEventListener("pointerdown", event => startDraggingWaterSprite(event, sprite));
      state.waterDragSprites.push(sprite);
      return sprite;
    }

    function startDraggingWaterSprite(event, sprite) {
      if (!state.waterDragChallengeActive || state.waterDragReviewQueued || sprite.busy) return;
      if (sprite.side !== waterDragStartSide()) return;
      event.preventDefault();
      sprite.dragging = true;
      sprite.dragPointerId = event.pointerId;
      sprite.g.classList.add("dragging");
      sprite.g.parentNode.appendChild(sprite.g);
      try { sprite.g.setPointerCapture(event.pointerId); } catch (err) {}
      moveDraggedWaterSprite(event, sprite);
      sprite.g.addEventListener("pointermove", sprite._moveHandler = e => moveDraggedWaterSprite(e, sprite));
      sprite.g.addEventListener("pointerup", sprite._upHandler = e => releaseDraggedWaterSprite(e, sprite));
      sprite.g.addEventListener("pointercancel", sprite._cancelHandler = e => releaseDraggedWaterSprite(e, sprite));
    }

    function moveDraggedWaterSprite(event, sprite) {
      if (!sprite.dragging || sprite.dragPointerId !== event.pointerId) return;
      event.preventDefault();
      const point = clampWaterPointToSide(svgPointFromEvent(event), waterDragStartSide());
      sprite.x = point.x;
      sprite.y = point.y;
      setWaterSpritePosition(sprite);
    }

    function cleanupWaterDragHandlers(sprite) {
      if (!sprite || !sprite.g) return;
      if (sprite._moveHandler) sprite.g.removeEventListener("pointermove", sprite._moveHandler);
      if (sprite._upHandler) sprite.g.removeEventListener("pointerup", sprite._upHandler);
      if (sprite._cancelHandler) sprite.g.removeEventListener("pointercancel", sprite._cancelHandler);
      sprite._moveHandler = null;
      sprite._upHandler = null;
      sprite._cancelHandler = null;
      try {
        if (sprite.dragPointerId !== null) sprite.g.releasePointerCapture(sprite.dragPointerId);
      } catch (err) {}
      sprite.dragPointerId = null;
      sprite.g.classList.remove("dragging");
    }

    function releaseDraggedWaterSprite(event, sprite) {
      if (!sprite.dragging || sprite.dragPointerId !== event.pointerId) return;
      event.preventDefault();
      sprite.dragging = false;
      cleanupWaterDragHandlers(sprite);
      const throughChannel = Math.abs(sprite.y - WATER_DRAG_CHANNEL_Y) <= WATER_DRAG_CHANNEL_TOLERANCE;
      if (throughChannel) launchWaterDragSuccess(sprite);
      else launchWaterDragBounce(sprite);
    }

    function launchWaterDragSuccess(sprite) {
      const direction = waterDragDirection();
      const targetSide = waterDragTargetSide();
      const target = randomWaterDragPoint(targetSide);
      target.y = sprite.y;
      sprite.busy = true;
      sprite.g.classList.remove("water-drag-droplet");
      sprite.g.style.pointerEvents = "none";
      const frames = direction === "out" ? [
        { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
        { x: 505, y: sprite.y, opacity: 1, scale: 1, offset: .25 },
        { x: 450, y: sprite.y, opacity: 1, scale: .86, offset: .52 },
        { x: 395, y: sprite.y, opacity: 1, scale: .96, offset: .72 },
        { x: target.x, y: target.y, opacity: 1, scale: 1, offset: 1 }
      ] : [
        { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
        { x: 395, y: sprite.y, opacity: 1, scale: 1, offset: .25 },
        { x: 450, y: sprite.y, opacity: 1, scale: .86, offset: .52 },
        { x: 505, y: sprite.y, opacity: 1, scale: .96, offset: .72 },
        { x: target.x, y: target.y, opacity: 1, scale: 1, offset: 1 }
      ];
      animateDemoGroup(sprite.g, frames, 1450, { linear: true, removeAtEnd: false, onDone: () => {
        sprite.x = target.x;
        sprite.y = target.y;
        sprite.side = targetSide;
        sprite.busy = false;
        sprite.vx = (Math.random() < .5 ? -1 : 1) * randomInRange(10, 22);
        sprite.vy = (Math.random() < .5 ? -1 : 1) * randomInRange(9, 20);
        state.waterDragTransported = Math.min(waterDragGoal(), (state.waterDragTransported || 0) + 1);
        renderStats();
        const goal = waterDragGoal();
        membraneFeedback(`Water transported through: ${state.waterDragTransported}/${goal}`, 3, 2300);
        if (state.waterDragTransported >= goal) finishWaterDragChallengeAfterFloat();
      }});
    }

    function launchWaterDragBounce(sprite) {
      const direction = waterDragDirection();
      sprite.busy = true;
      sprite.g.classList.remove("water-drag-droplet");
      sprite.g.style.pointerEvents = "none";
      const frames = direction === "out" ? [
        { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
        { x: 500, y: sprite.y, opacity: 1, scale: 1, offset: .35 },
        { x: 538, y: sprite.y, opacity: .72, scale: .92, offset: .58 },
        { x: 824, y: sprite.y, opacity: 0, scale: .72, offset: 1 }
      ] : [
        { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
        { x: 400, y: sprite.y, opacity: 1, scale: 1, offset: .35 },
        { x: 362, y: sprite.y, opacity: .72, scale: .92, offset: .58 },
        { x: 92, y: sprite.y, opacity: 0, scale: .72, offset: 1 }
      ];
      membraneFeedback("That water hit the membrane away from the channel. Release it at the Water Channel lane.", 2, 3000);
      demoSetTimeout(() => triggerMembraneImpact(sprite.g), Math.round(1150 * .35));
      animateDemoGroup(sprite.g, frames, 1150, { linear: true, removeAtEnd: false, onDone: () => {
        state.waterDragSprites = state.waterDragSprites.filter(item => item !== sprite);
        if (sprite.g && sprite.g.isConnected) sprite.g.remove();
        demoSetTimeout(() => {
          if (state.waterDragChallengeActive && !state.waterDragReviewQueued && state.waterDragTransported < waterDragGoal()) {
            createWaterDragSprite(waterDragStartSide());
          }
        }, 450);
      }});
    }

    function startWaterDragFloatLoop() {
      const runId = state.demoRunId;
      let last = performance.now();
      function step(now) {
        if (runId !== state.demoRunId || !state.waterDragChallengeActive) return;
        const dt = Math.min(.04, Math.max(.001, (now - last) / 1000));
        last = now;
        state.waterDragSprites.forEach(sprite => {
          if (!sprite.g || !sprite.g.isConnected || sprite.dragging || sprite.busy) return;
          const bounds = waterDragBounds(sprite.side);
          sprite.x += sprite.vx * dt;
          sprite.y += sprite.vy * dt;
          if (sprite.x < bounds.xMin || sprite.x > bounds.xMax) sprite.vx *= -1;
          if (sprite.y < bounds.yMin || sprite.y > bounds.yMax) sprite.vy *= -1;
          sprite.x = Math.max(bounds.xMin, Math.min(bounds.xMax, sprite.x));
          sprite.y = Math.max(bounds.yMin, Math.min(bounds.yMax, sprite.y));
          setWaterSpritePosition(sprite);
        });
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      }
      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function startWaterDragChallenge(index, prelude) {
      state.transportPreludeIndex = index;
      state.transportPreludeActive = true;
      state.waterDragChallengeActive = true;
      state.waterDragSprites = [];
      state.waterDragTransported = 0;
      state.waterDragReviewQueued = false;
      clearTransportPreludeOverlay();
      document.querySelectorAll("#demoParticles .demo-particle:not(.transport-prelude-overlay)").forEach(node => node.remove());
      renderStats();
      const startSide = waterDragStartSide();
      for (let i = 0; i < waterDragGoal(); i++) createWaterDragSprite(startSide);
      startWaterDragFloatLoop();
      const startText = startSide === "outside" ? "outside-cell box" : "inside-cell box";
      clearDemoInstructionText();
      renderDetails();
    }

    function finishWaterDragChallengeAfterFloat() {
      if (state.waterDragReviewQueued) return;
      state.waterDragReviewQueued = true;
      if (finishCombinedTransportPart("demoWaterGate", "Water route complete. Keep moving glucose and packing waste.")) return;
      membraneFeedback("All 5 water droplets made it through. Watch them settle, then review what happened.", 4, 3600);
      demoSetTimeout(() => {
        if (!state.waterDragChallengeActive || !currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
        state.waterDragChallengeActive = false;
        state.transportPreludeActive = false;
        markAction("demoWaterGate");
        showTransportPreludeReviewPopup(currentTransportPreludeIndex());
        if (levelChatId() === WATER_CHANNEL_LEVEL_ID) maybeOfferOsmosisSideQuest();
        renderDetails();
      }, 1700);
    }

    function glucoseDragShape() {
      return `<polygon points="0,-15 13,-8 13,8 0,16 -13,8 -13,-8" fill="#fde047" stroke="#fff7ad" stroke-width="3"/>`;
    }

    function glucoseDragBounds(side) {
      return GLUCOSE_DRAG_BOUNDS[side === "inside" ? "inside" : "outside"];
    }

    function randomGlucoseDragPoint(side) {
      const bounds = glucoseDragBounds(side);
      return {
        x: randomInRange(bounds.xMin + 24, bounds.xMax - 24),
        y: randomInRange(bounds.yMin + 24, bounds.yMax - 24)
      };
    }

    function clampGlucosePointToOutside(point) {
      const bounds = glucoseDragBounds("outside");
      return {
        x: Math.max(bounds.xMin, Math.min(bounds.xMax, point.x)),
        y: Math.max(bounds.yMin, Math.min(bounds.yMax, point.y))
      };
    }

    function setGlucoseSpritePosition(sprite) {
      if (sprite && sprite.g && sprite.g.isConnected) {
        sprite.g.setAttribute("transform", `translate(${sprite.x.toFixed(1)} ${sprite.y.toFixed(1)})`);
      }
    }

    function createGlucoseDragSprite(side = "outside") {
      const point = randomGlucoseDragPoint(side);
      const g = demoGroup("Glucose", glucoseDragShape(), point.x, point.y);
      g.classList.add("glucose-drag-sprite");
      const sprite = {
        id: state.nextDemoObjectId++,
        g,
        side,
        x: point.x,
        y: point.y,
        vx: (Math.random() < .5 ? -1 : 1) * randomInRange(10, 20),
        vy: (Math.random() < .5 ? -1 : 1) * randomInRange(8, 18),
        dragging: false,
        busy: false,
        dragPointerId: null
      };
      g.addEventListener("pointerdown", event => startDraggingGlucoseSprite(event, sprite));
      state.glucoseDragSprites.push(sprite);
      return sprite;
    }

    function createGlucoseLeverOverlay() {
      const layer = document.getElementById("demoParticles");
      if (!layer) return null;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-particle glucose-lever-visual");
      g.setAttribute("transform", "translate(744 280)");
      g.dataset.knobY = "-39";
      g.innerHTML = `
        <rect x="-58" y="-88" width="116" height="176" rx="18" fill="rgba(15,23,42,.82)" stroke="rgba(253,224,71,.62)" stroke-width="3"/>
        <rect x="-38" y="-60" width="76" height="124" rx="16" fill="rgba(2,6,23,.46)" stroke="rgba(255,247,173,.42)" stroke-width="2"/>
        <text x="0" y="-67" class="demo-hotspot-label">Door Lever</text>
        <rect x="-10" y="-46" width="20" height="92" rx="10" fill="#1e293b" stroke="#fde047" stroke-width="3"/>
        <line x1="-24" y1="-39" x2="24" y2="-39" stroke="rgba(255,247,173,.42)" stroke-width="2" stroke-linecap="round"/>
        <line x1="-24" y1="39" x2="24" y2="39" stroke="rgba(255,247,173,.42)" stroke-width="2" stroke-linecap="round"/>
        <line class="lever-rod" x1="0" y1="0" x2="0" y2="-39" stroke="#facc15" stroke-width="10" stroke-linecap="round"/>
        <g class="lever-handle" transform="translate(0 -39)">
          <circle cx="0" cy="0" r="17" fill="#fde047" stroke="#fff7ad" stroke-width="4"/>
          <circle cx="-5" cy="-5" r="5" fill="rgba(255,255,255,.55)"/>
        </g>
      `;
      g.addEventListener("click", event => {
        event.stopPropagation();
        toggleGlucoseLever();
      });
      layer.appendChild(g);
      return g;
    }

    function createCenteredGlucoseAirlockOverlay() {
      const layer = document.getElementById("demoParticles");
      if (!layer) return null;
      const prelude = TRANSPORT_PRELUDES.find(item => item.id === "glucose");
      if (!prelude) return null;
      const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("class", "demo-particle glucose-airlock-visual");
      overlay.setAttribute("transform", `translate(450 ${glucoseDragDoorY()})`);
      overlay.innerHTML = prelude.doorMarkup;
      layer.appendChild(overlay);
      return {
        g: overlay,
        outer: overlay.querySelector(".prelude-glucose-outer-gate"),
        inner: overlay.querySelector(".prelude-glucose-inner-gate")
      };
    }

    function bringGlucoseChallengeControlsToFront() {
      const layer = document.getElementById("demoParticles");
      if (!layer) return;
      if (state.glucoseAirlockOverlay?.g?.isConnected) layer.appendChild(state.glucoseAirlockOverlay.g);
      if (state.glucoseLeverOverlay?.isConnected) layer.appendChild(state.glucoseLeverOverlay);
    }

    function showGlucoseInDoorPocket(sprite) {
      const overlay = state.glucoseAirlockOverlay?.g;
      if (!overlay || !overlay.isConnected || !sprite?.g?.isConnected) return;
      const layer = overlay.parentNode;
      if (!layer) return;

      layer.insertBefore(sprite.g, overlay.nextSibling);
      sprite.g.style.opacity = ".78";
      if (state.glucoseLeverOverlay?.isConnected) layer.appendChild(state.glucoseLeverOverlay);
    }

    function updateGlucoseLeverVisual() {
      const lever = state.glucoseLeverOverlay;
      if (!lever) return;
      const handle = lever.querySelector(".lever-handle");
      const rod = lever.querySelector(".lever-rod");
      const up = state.glucoseLeverState === "up";
      const targetY = up ? -39 : 39;
      const currentY = Number(lever.dataset.knobY || (up ? 39 : -39));
      const startY = Number.isFinite(currentY) ? currentY : targetY;
      const start = performance.now();
      const duration = 260;
      const token = String(start);
      lever.dataset.leverAnimToken = token;

      function draw(y) {
        lever.dataset.knobY = y.toFixed(2);
        if (handle) handle.setAttribute("transform", `translate(0 ${y.toFixed(2)})`);
        if (rod) rod.setAttribute("y2", y.toFixed(2));
      }

      function step(now) {
        if (!lever.isConnected || lever.dataset.leverAnimToken !== token) return;
        const raw = Math.min(1, (now - start) / duration);
        const t = raw < .5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        draw(startY + (targetY - startY) * t);
        if (raw < 1) {
          const frameId = requestAnimationFrame(step);
          state.demoFrames.push(frameId);
        } else {
          draw(targetY);
        }
      }

      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function setGlucoseLeverState(nextState, options = {}) {
      state.glucoseLeverState = nextState === "down" ? "down" : "up";
      const airlock = state.glucoseAirlockOverlay;
      if (airlock) {
        setGlucoseGateState(airlock.outer, "outer", state.glucoseLeverState === "up");
        setGlucoseGateState(airlock.inner, "inner", state.glucoseLeverState === "down");
      }
      updateGlucoseLeverVisual();
      if (!options.quiet) {
        membraneFeedback(state.glucoseLeverState === "up" ? "Lever up: left door open, right door closed." : "Lever down: right door open, left door closed.", 3, 2800);
      }
      if (state.glucoseLeverState === "down" && state.glucoseInPocket && !state.glucoseInPocket.busy) {
        releaseGlucoseFromPocket();
      }
    }

    function toggleGlucoseLever() {
      if (!state.glucoseDragChallengeActive || state.glucoseDragReviewQueued) return;
      const now = Date.now();
      if (now < (state.glucoseLeverReadyAt || 0)) return;
      state.glucoseLeverReadyAt = now + 1000;
      playLeverClickSfx();
      setGlucoseLeverState(state.glucoseLeverState === "up" ? "down" : "up");
    }

    function startDraggingGlucoseSprite(event, sprite) {
      if (!state.glucoseDragChallengeActive || state.glucoseDragReviewQueued || sprite.busy) return;
      if (state.glucoseInPocket && !glucoseAutoDoorMode()) {
        membraneFeedback("The door is occupied. Flip the lever down to release that glucose first.", 3, 3200);
        return;
      }
      if (sprite.side !== "outside") return;
      event.preventDefault();
      sprite.dragging = true;
      sprite.dragPointerId = event.pointerId;
      sprite.g.classList.add("dragging");
      sprite.g.parentNode.appendChild(sprite.g);
      bringGlucoseChallengeControlsToFront();
      try { sprite.g.setPointerCapture(event.pointerId); } catch (err) {}
      moveDraggedGlucoseSprite(event, sprite);
      sprite.g.addEventListener("pointermove", sprite._moveHandler = e => moveDraggedGlucoseSprite(e, sprite));
      sprite.g.addEventListener("pointerup", sprite._upHandler = e => releaseDraggedGlucoseSprite(e, sprite));
      sprite.g.addEventListener("pointercancel", sprite._cancelHandler = e => releaseDraggedGlucoseSprite(e, sprite));
    }

    function moveDraggedGlucoseSprite(event, sprite) {
      if (!sprite.dragging || sprite.dragPointerId !== event.pointerId) return;
      event.preventDefault();
      const point = clampGlucosePointToOutside(svgPointFromEvent(event));
      sprite.x = point.x;
      sprite.y = point.y;
      setGlucoseSpritePosition(sprite);
    }

    function cleanupGlucoseDragHandlers(sprite) {
      if (!sprite || !sprite.g) return;
      if (sprite._moveHandler) sprite.g.removeEventListener("pointermove", sprite._moveHandler);
      if (sprite._upHandler) sprite.g.removeEventListener("pointerup", sprite._upHandler);
      if (sprite._cancelHandler) sprite.g.removeEventListener("pointercancel", sprite._cancelHandler);
      sprite._moveHandler = null;
      sprite._upHandler = null;
      sprite._cancelHandler = null;
      try {
        if (sprite.dragPointerId !== null) sprite.g.releasePointerCapture(sprite.dragPointerId);
      } catch (err) {}
      sprite.dragPointerId = null;
      sprite.g.classList.remove("dragging");
    }

    function releaseDraggedGlucoseSprite(event, sprite) {
      if (!sprite.dragging || sprite.dragPointerId !== event.pointerId) return;
      event.preventDefault();
      sprite.dragging = false;
      cleanupGlucoseDragHandlers(sprite);
      const doorY = glucoseDragDoorY();
      const alignedWithDoor = Math.abs(sprite.y - doorY) <= GLUCOSE_DRAG_DOOR_TOLERANCE;
      if (!alignedWithDoor) {
        launchGlucoseBounce(sprite, "Glucose missed the door lane. Drag it toward the Glucose Door height.");
        return;
      }
      if (state.glucoseInPocket && state.glucoseInPocket !== sprite) {
        launchGlucoseBounce(sprite, "The glucose door is busy. Wait for the current glucose to finish transferring.");
        return;
      }
      if (glucoseAutoDoorMode()) {
        setGlucoseGateState(state.glucoseAirlockOverlay?.outer, "outer", true);
        setGlucoseGateState(state.glucoseAirlockOverlay?.inner, "inner", false);
        launchGlucoseToPocket(sprite);
        return;
      }
      if (state.glucoseLeverState !== "up") {
        launchGlucoseBounce(sprite, "The left door is closed. Click the lever up before dragging glucose in.");
        return;
      }
      launchGlucoseToPocket(sprite);
    }

    function launchGlucoseToPocket(sprite) {
      sprite.busy = true;
      state.glucoseInPocket = sprite;
      sprite.g.classList.remove("glucose-drag-sprite");
      sprite.g.style.pointerEvents = "none";
      const startY = sprite.y;
      const y = glucoseDragDoorY();
      animateDemoGroup(sprite.g, [
        { x: sprite.x, y: startY, opacity: 1, scale: 1, offset: 0 },
        { x: 390, y, opacity: 1, scale: 1, offset: .24 },
        { x: 420, y, opacity: 1, scale: .94, offset: .46 },
        { x: 450, y, opacity: 1, scale: .84, offset: 1 }
      ], 1150, { linear: true, removeAtEnd: false, onDone: () => {
        sprite.x = 450;
        sprite.y = y;
        sprite.side = "pocket";
        sprite.busy = false;
        setGlucoseSpritePosition(sprite);
        showGlucoseInDoorPocket(sprite);
        if (glucoseAutoDoorMode()) {
          membraneFeedback("Glucose entered the door. The outer door closes before the inside door opens.", 3, 2400);
          demoSetTimeout(() => {
            setGlucoseGateState(state.glucoseAirlockOverlay?.outer, "outer", false);
            demoSetTimeout(() => {
              setGlucoseGateState(state.glucoseAirlockOverlay?.inner, "inner", true);
              releaseGlucoseFromPocket();
            }, 320);
          }, 260);
        } else if (state.glucoseLeverState === "down") {
          releaseGlucoseFromPocket();
        } else {
          membraneFeedback("Glucose is inside the door. Flip the lever down to open the right door.", 4, 3600);
        }
      }});
    }

    function launchGlucoseBounce(sprite, message) {
      sprite.busy = true;
      sprite.g.classList.remove("glucose-drag-sprite");
      sprite.g.style.pointerEvents = "none";
      membraneFeedback(message, 3, 3400);
      const y = sprite.y;
      animateDemoGroup(sprite.g, [
        { x: sprite.x, y, opacity: 1, scale: 1, offset: 0 },
        { x: 404, y, opacity: 1, scale: 1, offset: .34 },
        { x: 356, y, opacity: .78, scale: .92, offset: .58 },
        { x: 118, y, opacity: 0, scale: .72, offset: 1 }
      ], 1050, { linear: true, removeAtEnd: false, onDone: () => {
        state.glucoseDragSprites = state.glucoseDragSprites.filter(item => item !== sprite);
        if (sprite.g && sprite.g.isConnected) sprite.g.remove();
        demoSetTimeout(() => {
          if (state.glucoseDragChallengeActive && !state.glucoseDragReviewQueued && state.glucoseDragTransported < glucoseDragGoal()) {
            createGlucoseDragSprite("outside");
            bringGlucoseChallengeControlsToFront();
          }
        }, 450);
      }});
      demoSetTimeout(() => triggerMembraneImpact(sprite.g), Math.round(1050 * .34));
    }

    function releaseGlucoseFromPocket() {
      const sprite = state.glucoseInPocket;
      if (!sprite || sprite.busy) return;
      sprite.busy = true;
      const target = randomGlucoseDragPoint("inside");
      target.y = sprite.y;
      sprite.g.style.opacity = "1";
      animateDemoGroup(sprite.g, [
        { x: sprite.x, y: sprite.y, opacity: 1, scale: .84, offset: 0 },
        { x: 480, y: sprite.y, opacity: 1, scale: .86, offset: .26 },
        { x: 510, y: sprite.y, opacity: 1, scale: .94, offset: .52 },
        { x: target.x, y: target.y, opacity: 1, scale: 1, offset: 1 }
      ], 1250, { linear: true, removeAtEnd: false, onDone: () => {
        sprite.x = target.x;
        sprite.y = target.y;
        sprite.side = "inside";
        sprite.busy = false;
        sprite.vx = (Math.random() < .5 ? -1 : 1) * randomInRange(9, 18);
        sprite.vy = (Math.random() < .5 ? -1 : 1) * randomInRange(8, 16);
        setGlucoseSpritePosition(sprite);
        if (state.glucoseInPocket === sprite) state.glucoseInPocket = null;
        if (glucoseAutoDoorMode()) {
          setGlucoseGateState(state.glucoseAirlockOverlay?.inner, "inner", false);
        }
        state.glucoseDragTransported = Math.min(glucoseDragGoal(), (state.glucoseDragTransported || 0) + 1);
        renderStats();
        const goal = glucoseDragGoal();
        if (state.glucoseDragTransported >= goal) {
          finishGlucoseDragChallengeAfterFloat();
        } else {
          membraneFeedback(glucoseAutoDoorMode()
            ? `Glucose transported through: ${state.glucoseDragTransported}/${goal}. Drag another glucose to the door.`
            : `Glucose transported through: ${state.glucoseDragTransported}/${goal}. Flip the lever up for the next glucose.`, 4, 3600);
        }
      }});
    }

    function startGlucoseDragFloatLoop() {
      const runId = state.demoRunId;
      let last = performance.now();
      function step(now) {
        if (runId !== state.demoRunId || !state.glucoseDragChallengeActive) return;
        const dt = Math.min(.04, Math.max(.001, (now - last) / 1000));
        last = now;
        state.glucoseDragSprites.forEach(sprite => {
          if (!sprite.g || !sprite.g.isConnected || sprite.dragging || sprite.busy || sprite.side === "pocket") return;
          const bounds = glucoseDragBounds(sprite.side);
          sprite.x += sprite.vx * dt;
          sprite.y += sprite.vy * dt;
          if (sprite.x < bounds.xMin || sprite.x > bounds.xMax) sprite.vx *= -1;
          if (sprite.y < bounds.yMin || sprite.y > bounds.yMax) sprite.vy *= -1;
          sprite.x = Math.max(bounds.xMin, Math.min(bounds.xMax, sprite.x));
          sprite.y = Math.max(bounds.yMin, Math.min(bounds.yMax, sprite.y));
          setGlucoseSpritePosition(sprite);
        });
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      }
      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function startGlucoseDragChallenge(index, prelude) {
      state.transportPreludeIndex = index;
      state.transportPreludeActive = true;
      state.glucoseDragChallengeActive = true;
      state.glucoseDragSprites = [];
      state.glucoseDragTransported = 0;
      state.glucoseDragReviewQueued = false;
      state.glucoseLeverState = "up";
      state.glucoseLeverReadyAt = 0;
      state.glucoseInPocket = null;
      state.glucoseAirlockActive = true;
      clearTransportPreludeOverlay();
      document.querySelectorAll("#demoParticles .demo-particle:not(.transport-prelude-overlay)").forEach(node => node.remove());
      renderStats();
      for (let i = 0; i < glucoseDragGoal(); i++) createGlucoseDragSprite("outside");
      state.glucoseAirlockOverlay = createCenteredGlucoseAirlockOverlay();
      if (glucoseAutoDoorMode()) {
        state.glucoseLeverOverlay = null;
        setGlucoseGateState(state.glucoseAirlockOverlay?.outer, "outer", false);
        setGlucoseGateState(state.glucoseAirlockOverlay?.inner, "inner", false);
      } else {
        state.glucoseLeverOverlay = createGlucoseLeverOverlay();
        setGlucoseLeverState("up", { quiet: true });
      }
      bringGlucoseChallengeControlsToFront();
      startGlucoseDragFloatLoop();
      clearDemoInstructionText();
      renderDetails();
    }

    function finishGlucoseDragChallengeAfterFloat() {
      if (state.glucoseDragReviewQueued) return;
      state.glucoseDragReviewQueued = true;
      if (finishCombinedTransportPart("demoGlucoseDoor", "Glucose route complete. Keep moving water and packing waste.")) return;
      membraneFeedback("All 5 glucose molecules made it through. Watch them settle, then review what happened.", 4, 3600);
      demoSetTimeout(() => {
        if (!state.glucoseDragChallengeActive || !currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
        state.glucoseDragChallengeActive = false;
        state.transportPreludeActive = false;
        state.glucoseAirlockActive = false;
        markAction("demoGlucoseDoor");
        showTransportPreludeReviewPopup(currentTransportPreludeIndex());
        renderDetails();
      }, 1700);
    }

    function wasteVesicleShape(size = 20) {
      const r = size / 2;
      return `<rect x="${-r}" y="${-r}" width="${size}" height="${size}" rx="5" fill="#94a3b8" stroke="#e2e8f0" stroke-width="3"/>`;
    }

    function loadWasteVesicleArtSource() {
      if (!wasteVesicleArtSourcePromise) {
        wasteVesicleArtSourcePromise = fetch("assets/cell-membrane-vesicle.svg")
          .then(response => {
            if (!response.ok) throw new Error(`Vesicle SVG failed to load: ${response.status}`);
            return response.text();
          });
      }
      return wasteVesicleArtSourcePromise;
    }

    function prefixImportedSvgIds(root, prefix) {
      const idMap = new Map();
      root.querySelectorAll("[id]").forEach(node => {
        const oldId = node.id;
        const newId = `${prefix}-${oldId}`;
        idMap.set(oldId, newId);
        node.id = newId;
      });
      root.querySelectorAll("*").forEach(node => {
        Array.from(node.attributes || []).forEach(attribute => {
          let value = attribute.value;
          idMap.forEach((newId, oldId) => {
            value = value.replaceAll(`url(#${oldId})`, `url(#${newId})`);
            if (value === `#${oldId}`) value = `#${newId}`;
          });
          if (value !== attribute.value) node.setAttribute(attribute.name, value);
        });
      });
    }

    function prepareWasteVesicleArtwork(vesicle) {
      const art = vesicle?.g?.querySelector(".vesicle-shell-art");
      if (!art) return Promise.resolve(false);
      if (vesicle.artReady) return Promise.resolve(true);
      return loadWasteVesicleArtSource()
        .then(sourceText => {
          if (!art.isConnected) return false;
          const source = new DOMParser().parseFromString(sourceText, "image/svg+xml");
          if (source.querySelector("parsererror")) throw new Error("Vesicle SVG could not be parsed.");
          const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
          [source.querySelector("defs"), source.querySelector("#vesicle")]
            .filter(Boolean)
            .forEach(node => container.appendChild(document.importNode(node, true)));
          prefixImportedSvgIds(container, `vesicle-${vesicle.id}`);
          art.replaceChildren(...Array.from(container.childNodes));
          art.querySelectorAll('[id$="-hydrophilic-heads"] circle').forEach(node => node.classList.add("vesicle-phospholipid-head"));
          art.querySelectorAll('[id$="-hydrophobic-tails"] path').forEach(node => node.classList.add("vesicle-phospholipid-tail"));
          vesicle.artReady = true;
          return true;
        })
        .catch(error => {
          console.warn("Using the static vesicle artwork fallback.", error);
          return false;
        });
    }

    function randomWasteVesiclePoint() {
      const bounds = WASTE_VESICLE_BOUNDS;
      return {
        x: randomInRange(bounds.xMin + 34, bounds.xMax - 34),
        y: randomInRange(bounds.yMin + 34, bounds.yMax - 34)
      };
    }

    function clampWastePoint(point) {
      const bounds = WASTE_VESICLE_BOUNDS;
      return {
        x: Math.max(bounds.xMin, Math.min(bounds.xMax, point.x)),
        y: Math.max(bounds.yMin, Math.min(bounds.yMax, point.y))
      };
    }

    function setWasteSpritePosition(sprite) {
      if (sprite?.g?.isConnected) {
        sprite.g.setAttribute("transform", `translate(${sprite.x.toFixed(1)} ${sprite.y.toFixed(1)})`);
      }
    }

    function setWasteVesiclePosition(vesicle) {
      if (vesicle?.g?.isConnected) {
        vesicle.g.setAttribute("transform", `translate(${vesicle.x.toFixed(1)} ${vesicle.y.toFixed(1)})`);
      }
    }

    function createWasteDragSprite() {
      const point = randomWasteVesiclePoint();
      const g = demoGroup("Waste", wasteVesicleShape(20), point.x, point.y);
      g.classList.add("waste-drag-sprite");
      const sprite = {
        id: state.nextDemoObjectId++,
        g,
        x: point.x,
        y: point.y,
        vx: (Math.random() < .5 ? -1 : 1) * randomInRange(10, 20),
        vy: (Math.random() < .5 ? -1 : 1) * randomInRange(9, 18),
        dragging: false,
        busy: false,
        dragPointerId: null
      };
      g.addEventListener("pointerdown", event => startDraggingWasteSprite(event, sprite));
      state.wasteDragSprites.push(sprite);
      return sprite;
    }

    function createWasteVesicle(index = 0) {
      const layer = document.getElementById("demoParticles");
      if (!layer) return null;
      const point = randomWasteVesiclePoint();
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-particle waste-vesicle");
      g.innerHTML = `
        <g class="vesicle-idle">
          <g class="vesicle-fusion-shape">
            <svg class="vesicle-shell-art" x="-50" y="-50" width="100" height="100" viewBox="100 100 560 560" aria-hidden="true" overflow="visible">
              <image href="assets/cell-membrane-vesicle.svg" width="760" height="760"/>
            </svg>
            <circle class="vesicle-shell" cx="0" cy="0" r="47" fill="none" stroke="transparent" stroke-width="3"/>
          </g>
          <g class="vesicle-cargo"></g>
        </g>
        <text class="demo-particle-label" x="0" y="-55">Vesicle</text>
      `;
      layer.appendChild(g);
      const vesicle = {
        id: state.nextDemoObjectId++,
        g,
        cargoLayer: g.querySelector(".vesicle-cargo"),
        shell: g.querySelector(".vesicle-shell"),
        idleLayer: g.querySelector(".vesicle-idle"),
        fusionShape: g.querySelector(".vesicle-fusion-shape"),
        x: point.x,
        y: point.y,
        radius: 47,
        vx: (index % 2 ? -1 : 1) * randomInRange(14, 24),
        vy: (Math.random() < .5 ? -1 : 1) * randomInRange(12, 20),
        cargo: [],
        status: "collecting"
      };
      setWasteVesiclePosition(vesicle);
      state.wasteVesicles.push(vesicle);
      prepareWasteVesicleArtwork(vesicle);
      return vesicle;
    }

    function startDraggingWasteSprite(event, sprite) {
      if (!state.wasteVesicleChallengeActive || state.wasteVesicleReviewQueued || sprite.busy) return;
      event.preventDefault();
      sprite.dragging = true;
      sprite.dragPointerId = event.pointerId;
      sprite.g.classList.add("dragging");
      sprite.g.parentNode.appendChild(sprite.g);
      try { sprite.g.setPointerCapture(event.pointerId); } catch (err) {}
      moveDraggedWasteSprite(event, sprite);
      sprite.g.addEventListener("pointermove", sprite._moveHandler = e => moveDraggedWasteSprite(e, sprite));
      sprite.g.addEventListener("pointerup", sprite._upHandler = e => releaseDraggedWasteSprite(e, sprite));
      sprite.g.addEventListener("pointercancel", sprite._cancelHandler = e => releaseDraggedWasteSprite(e, sprite));
    }

    function moveDraggedWasteSprite(event, sprite) {
      if (!sprite.dragging || sprite.dragPointerId !== event.pointerId) return;
      event.preventDefault();
      const point = clampWastePoint(svgPointFromEvent(event));
      sprite.x = point.x;
      sprite.y = point.y;
      setWasteSpritePosition(sprite);
    }

    function cleanupWasteDragHandlers(sprite) {
      if (!sprite?.g) return;
      if (sprite._moveHandler) sprite.g.removeEventListener("pointermove", sprite._moveHandler);
      if (sprite._upHandler) sprite.g.removeEventListener("pointerup", sprite._upHandler);
      if (sprite._cancelHandler) sprite.g.removeEventListener("pointercancel", sprite._cancelHandler);
      sprite._moveHandler = null;
      sprite._upHandler = null;
      sprite._cancelHandler = null;
      try {
        if (sprite.dragPointerId !== null) sprite.g.releasePointerCapture(sprite.dragPointerId);
      } catch (err) {}
      sprite.dragPointerId = null;
      sprite.g.classList.remove("dragging");
    }

    function nearestOpenWasteVesicle(sprite) {
      let best = null;
      let bestDistance = Infinity;
      state.wasteVesicles.forEach(vesicle => {
        if (vesicle.status !== "collecting" || vesicle.cargo.length >= WASTE_VESICLE_CAPACITY) return;
        const distance = Math.hypot(sprite.x - vesicle.x, sprite.y - vesicle.y);
        if (distance <= vesicle.radius && distance < bestDistance) {
          best = vesicle;
          bestDistance = distance;
        }
      });
      return best;
    }

    function releaseDraggedWasteSprite(event, sprite) {
      if (!sprite.dragging || sprite.dragPointerId !== event.pointerId) return;
      event.preventDefault();
      sprite.dragging = false;
      cleanupWasteDragHandlers(sprite);
      const vesicle = nearestOpenWasteVesicle(sprite);
      if (!vesicle) {
        membraneFeedback("Drop waste inside a vesicle bubble so it can be packaged for export.", 2, 2600);
        return;
      }
      packWasteIntoVesicle(sprite, vesicle);
    }

    function packWasteIntoVesicle(sprite, vesicle) {
      sprite.busy = true;
      sprite.g.classList.remove("waste-drag-sprite");
      sprite.g.style.pointerEvents = "none";
      const targetAngle = (vesicle.cargo.length / WASTE_VESICLE_CAPACITY) * Math.PI * 2 + .7;
      const targetLocal = {
        x: Math.cos(targetAngle) * 13,
        y: Math.sin(targetAngle) * 13
      };
      animateDemoGroup(sprite.g, [
        { x: sprite.x, y: sprite.y, opacity: 1, scale: 1, offset: 0 },
        { x: vesicle.x + targetLocal.x, y: vesicle.y + targetLocal.y, opacity: 1, scale: .82, offset: 1 }
      ], 420, { linear: true, removeAtEnd: false, onDone: () => {
        if (!vesicle.g?.isConnected || vesicle.status !== "collecting") {
          if (sprite.g?.isConnected) sprite.g.remove();
          return;
        }
        const cargoG = document.createElementNS("http://www.w3.org/2000/svg", "g");
        cargoG.innerHTML = wasteVesicleShape(14);
        vesicle.cargoLayer.appendChild(cargoG);
        const cargo = {
          g: cargoG,
          x: targetLocal.x,
          y: targetLocal.y,
          vx: (Math.random() < .5 ? -1 : 1) * randomInRange(7, 12),
          vy: (Math.random() < .5 ? -1 : 1) * randomInRange(7, 12)
        };
        vesicle.cargo.push(cargo);
        cargoG.setAttribute("transform", `translate(${cargo.x.toFixed(1)} ${cargo.y.toFixed(1)})`);
        playWastePackSfx();
        state.wasteDragSprites = state.wasteDragSprites.filter(item => item !== sprite);
        if (sprite.g?.isConnected) sprite.g.remove();
        membraneFeedback(`Waste packed in vesicle: ${vesicle.cargo.length}/${WASTE_VESICLE_CAPACITY}.`, 3, 2200);
        if (vesicle.cargo.length >= WASTE_VESICLE_CAPACITY) {
          launchWasteVesicleExport(vesicle);
        }
      }});
    }

    function drawWasteMembraneOpening(y) {
      const layer = document.getElementById("demoParticles");
      if (!layer) return null;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "demo-particle");
      g.setAttribute("transform", `translate(450 ${y})`);
      g.style.opacity = "0";
      g.innerHTML = `
        <ellipse cx="0" cy="0" rx="36" ry="55" fill="rgba(15,23,42,.97)" stroke="rgba(186,230,253,.72)" stroke-width="4"/>
        <path d="M0,-86 C-21,-62 -22,-40 -5,-24" fill="none" stroke="#34d399" stroke-width="13" stroke-linecap="round"/>
        <path d="M0,86 C-21,62 -22,40 -5,24" fill="none" stroke="#34d399" stroke-width="13" stroke-linecap="round"/>
        <path d="M-24,-30 C-8,-18 10,-18 26,-30" fill="none" stroke="rgba(186,230,253,.5)" stroke-width="3" stroke-linecap="round"/>
        <path d="M-24,30 C-8,18 10,18 26,30" fill="none" stroke="rgba(186,230,253,.5)" stroke-width="3" stroke-linecap="round"/>
        <path d="M30,-20 C8,-6 8,6 30,20" fill="none" stroke="#e0f2fe" stroke-width="6" stroke-linecap="round"/>
      `;
      layer.appendChild(g);
      g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out", fill: "forwards" });
      g.style.opacity = "1";
      demoSetTimeout(() => {
        if (!g.isConnected) return;
        g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease-in", fill: "forwards" });
        demoSetTimeout(() => g.remove(), 450);
      }, 1700);
      return g;
    }

    function wasteFusionContact(vesicle) {
      const layer = document.getElementById("demoParticles");
      const host = document.getElementById("demoMembraneInline");
      const fallback = document.getElementById("demoMembraneFallback");
      const membraneRect = host?.dataset.ready === "true" ? host.getBoundingClientRect() : fallback?.getBoundingClientRect();
      const vesicleRect = vesicle?.fusionShape?.getBoundingClientRect?.() || vesicle?.g?.getBoundingClientRect?.();
      if (!layer || !membraneRect) {
        return { x: 478, y: Math.max(190, Math.min(405, vesicle?.y || 280)), dockX: 520, screenX: 0, screenY: 0 };
      }
      const screenY = vesicleRect ? vesicleRect.top + vesicleRect.height / 2 : membraneRect.top + membraneRect.height / 2;
      const screenX = membraneRect.right - Math.max(1, membraneRect.width * .08);
      const local = screenPointToSvg(layer, screenX, screenY) || { x: 478, y: vesicle?.y || 280 };
      const y = Math.max(190, Math.min(405, local.y));
      return { x: local.x, y, dockX: local.x + vesicle.radius - 4, screenX, screenY };
    }

    function animateWasteFusionMembrane(screenY, reducedMotion = false) {
      const host = document.getElementById("demoMembraneInline");
      if (reducedMotion || host?.dataset.ready !== "true") return;
      const heads = Array.from(host.querySelectorAll('.phospholipid[data-side="right"]'))
        .map(element => {
          const rect = element.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          return { element, centerY, distance: Math.abs(centerY - screenY) };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6);
      const impactGroups = Array.from(host.querySelectorAll(".lipid-impact-motion"));
      heads.forEach((item, index) => {
        const vertical = item.centerY < screenY ? -1 : 1;
        const strength = Math.max(.45, 1 - item.distance / 90);
        const key = item.element.dataset.lipidKey;
        impactGroups
          .filter(group => group.parentElement?.dataset.lipidKey === key)
          .forEach(group => {
            const dock = screenVectorToLocal(group, 2.2 + 1.4 * strength, vertical * (.5 + .6 * strength));
            const pore = screenVectorToLocal(group, 3.1 + 1.2 * strength, vertical * (1.3 + 1.1 * strength));
            group._fusionAnimation?.cancel();
            group._fusionAnimation = group.animate([
              { transform: "translate(0px, 0px)" },
              { transform: `translate(${dock.x.toFixed(2)}px, ${dock.y.toFixed(2)}px)`, offset: .14 },
              { transform: `translate(${pore.x.toFixed(2)}px, ${pore.y.toFixed(2)}px)`, offset: .34 },
              { transform: `translate(${pore.x.toFixed(2)}px, ${pore.y.toFixed(2)}px)`, offset: .7 },
              { transform: `translate(${(-pore.x * .2).toFixed(2)}px, ${(-pore.y * .18).toFixed(2)}px)`, offset: .84 },
              { transform: `translate(${(pore.x * .08).toFixed(2)}px, ${(pore.y * .07).toFixed(2)}px)`, offset: .92 },
              { transform: "translate(0px, 0px)" }
            ], { duration: 2400, delay: index * 18, easing: "ease-in-out" });
          });
      });
    }

    function animateVesicleFusionSplit(vesicle, screenY, reducedMotion = false) {
      const art = vesicle?.g?.querySelector(".vesicle-shell-art");
      const host = document.getElementById("demoMembraneInline");
      if (reducedMotion || !art?.isConnected || host?.dataset.ready !== "true") return;
      const artRect = art.getBoundingClientRect();
      const contactThreshold = artRect.left + artRect.width * .46;
      const targets = Array.from(host.querySelectorAll('.phospholipid[data-side="right"]'))
        .map(element => {
          const rect = element.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })
        .filter(point => Math.abs(point.y - screenY) <= 82);
      const topTargets = targets.filter(point => point.y < screenY).sort((a, b) => b.y - a.y);
      const bottomTargets = targets.filter(point => point.y >= screenY).sort((a, b) => a.y - b.y);

      const animateParts = (selector, limit) => {
        let topIndex = 0;
        let bottomIndex = 0;
        Array.from(art.querySelectorAll(selector))
          .map(element => {
            const rect = element.getBoundingClientRect();
            return {
              element,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              distance: Math.hypot(rect.left + rect.width / 2 - contactThreshold, rect.top + rect.height / 2 - screenY)
            };
          })
          .filter(item => item.x <= contactThreshold)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, limit)
          .forEach(item => {
            const movesUp = item.y < screenY;
            const sideTargets = movesUp ? topTargets : bottomTargets;
            const targetIndex = movesUp ? topIndex++ : bottomIndex++;
            const target = sideTargets[Math.min(targetIndex, Math.max(0, sideTargets.length - 1))];
            const fallbackY = screenY + (movesUp ? -1 : 1) * (10 + targetIndex * 5);
            const screenDx = target ? target.x - item.x : -6;
            const screenDy = (target ? target.y : fallbackY) - item.y;
            const local = screenVectorToLocal(item.element, screenDx, screenDy);
            item.element.style.transformBox = "fill-box";
            item.element.style.transformOrigin = "center";
            item.element._fusionSplitAnimation?.cancel();
            item.element._fusionSplitAnimation = item.element.animate([
              { transform: "translate(0px, 0px)", opacity: 1 },
              { transform: `translate(${(local.x * .45).toFixed(2)}px, ${(local.y * .45).toFixed(2)}px)`, opacity: 1, offset: .35 },
              { transform: `translate(${local.x.toFixed(2)}px, ${local.y.toFixed(2)}px)`, opacity: .9, offset: .78 },
              { transform: `translate(${(local.x * 1.08).toFixed(2)}px, ${(local.y * 1.08).toFixed(2)}px)`, opacity: .48 }
            ], { duration: 760, easing: "ease-in-out", fill: "forwards" });
          });
      };

      animateParts(".vesicle-phospholipid-head", 14);
      animateParts(".vesicle-phospholipid-tail", 20);
    }

    function finishFusedWasteVesicle(vesicle) {
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mergeDuration = reducedMotion ? 220 : 560;
      vesicle.fusionShape?.animate([
        { transform: "translateX(-12px) scale(.68, 1.12)", opacity: 1 },
        { transform: "translateX(-29px) scale(.18, 1.42)", opacity: .42, offset: .7 },
        { transform: "translateX(-34px) scale(.06, 1.5)", opacity: 0 }
      ], { duration: mergeDuration, easing: "ease-in-out", fill: "forwards" });
      demoSetTimeout(() => {
        if (vesicle.g?.isConnected) vesicle.g.remove();
        state.wasteVesicles = state.wasteVesicles.filter(item => item !== vesicle);
        if (state.wasteVesicleExported >= wasteVesicleGoal()) {
          finishWasteVesicleChallengeAfterFloat();
        } else {
          membraneFeedback(`Waste exported: ${state.wasteVesicleExported}/${wasteVesicleGoal()}. Keep packing vesicles.`, 3, 3200);
        }
      }, mergeDuration + 30);
    }

    function releaseWasteFromFusionPore(vesicle, contact) {
      const layer = document.getElementById("demoParticles");
      if (!layer) return;
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const cargo = [...vesicle.cargo].sort((a, b) => a.x - b.x);
      vesicle.cargo = [];
      let released = 0;
      cargo.forEach((item, index) => {
        demoSetTimeout(() => {
          if (!item.g?.isConnected || !layer) return;
          const startX = vesicle.x + item.x;
          const startY = vesicle.y + item.y;
          item.g.parentNode?.removeChild(item.g);
          layer.appendChild(item.g);
          item.g.setAttribute("transform", `translate(${startX.toFixed(1)} ${startY.toFixed(1)})`);
          const bend = (index - (cargo.length - 1) / 2) * 8;
          animateDemoGroup(item.g, reducedMotion ? [
            { x: startX, y: startY, opacity: 1, scale: 1, offset: 0 },
            { x: contact.x - 5, y: contact.y + bend, opacity: 1, scale: .93, offset: .38 },
            { x: contact.x - 68 - index * 6, y: contact.y + bend, opacity: 1, scale: 1, offset: 1 }
          ] : [
            { x: startX, y: startY, opacity: 1, scale: 1, offset: 0 },
            { x: contact.x + 14, y: contact.y + bend * .25, opacity: 1, scale: .96, offset: .22 },
            { x: contact.x - 4, y: contact.y + bend * .55, opacity: 1, scale: .92, offset: .38 },
            { x: contact.x - 34, y: contact.y + bend + (index % 2 ? 4 : -4), opacity: 1, scale: .95, offset: .62 },
            { x: contact.x - 72 - index * 6, y: contact.y + bend, opacity: 1, scale: 1, offset: 1 }
          ], reducedMotion ? 480 : 860, { linear: false, removeAtEnd: false, onDone: () => {
            state.wasteVesicleExported = Math.min(wasteVesicleGoal(), (state.wasteVesicleExported || 0) + 1);
            adjustStats({ waste: -5, transport: index === cargo.length - 1 ? +1 : 0 });
            item.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, delay: 180, easing: "ease-in", fill: "forwards" });
            demoSetTimeout(() => item.g?.remove(), 500);
            released += 1;
            if (released === cargo.length) finishFusedWasteVesicle(vesicle);
          }});
        }, index * (reducedMotion ? 55 : 95));
      });
    }

    function launchWasteVesicleExport(vesicle) {
      if (!vesicle || vesicle.status !== "collecting") return;
      vesicle.status = "exporting";
      membraneFeedback("Full vesicle! It is docking at the membrane to export waste.", 4, 3200);
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const contact = wasteFusionContact(vesicle);
      if (currentLevel()?.wasteVesicleChallenge?.releaseAtWasteExit) contact.y = WASTE_EXIT_POINT.y;
      const approachDuration = reducedMotion ? 420 : 740;
      vesicle.idleLayer?._approachAnimation?.cancel();
      if (vesicle.idleLayer && !reducedMotion) {
        vesicle.idleLayer._approachAnimation = vesicle.idleLayer.animate([
          { transform: "translateY(0px) rotate(0deg) scale(1)" },
          { transform: "translateY(-2px) rotate(-1.2deg) scale(1.01, .99)", offset: .35 },
          { transform: "translateY(2px) rotate(.9deg) scale(.99, 1.01)", offset: .68 },
          { transform: "translateY(0px) rotate(0deg) scale(1)" }
        ], { duration: approachDuration, easing: "ease-in-out" });
      }
      animateDemoGroup(vesicle.g, [
        { x: vesicle.x, y: vesicle.y, opacity: 1, scale: 1, offset: 0 },
        { x: lerp(vesicle.x, contact.dockX, .72), y: contact.y - (reducedMotion ? 0 : 2), opacity: 1, scale: 1, offset: .58 },
        { x: contact.dockX, y: contact.y, opacity: 1, scale: 1, offset: 1 }
      ], approachDuration, { linear: false, removeAtEnd: false, onDone: () => {
        if (!vesicle.g?.isConnected) return;
        vesicle.x = contact.dockX;
        vesicle.y = contact.y;
        setWasteVesiclePosition(vesicle);
        const settledContact = wasteFusionContact(vesicle);
        settledContact.x = contact.x;
        settledContact.y = contact.y;
        prepareInteractiveMembrane().then(() => animateWasteFusionMembrane(settledContact.screenY || contact.screenY, reducedMotion));
        prepareWasteVesicleArtwork(vesicle).then(() => animateVesicleFusionSplit(vesicle, settledContact.screenY || contact.screenY, reducedMotion));
        vesicle.g.querySelector(".demo-particle-label")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" });
        vesicle.fusionShape?.animate([
          { transform: "translateX(0px) scale(1, 1)" },
          { transform: "translateX(-5px) scale(.88, 1.06)", offset: .35 },
          { transform: "translateX(-12px) scale(.68, 1.12)" }
        ], { duration: reducedMotion ? 260 : 720, easing: "ease-in-out", fill: "forwards" });
        playVesicleBubbleSfx();
        releaseWasteFromFusionPore(vesicle, settledContact);
      }});
    }

    function startWasteVesicleFloatLoop() {
      const runId = state.demoRunId;
      let last = performance.now();
      function step(now) {
        if (runId !== state.demoRunId || !state.wasteVesicleChallengeActive) return;
        const dt = Math.min(.04, Math.max(.001, (now - last) / 1000));
        last = now;
        const bounds = WASTE_VESICLE_BOUNDS;
        state.wasteDragSprites.forEach(sprite => {
          if (!sprite.g?.isConnected || sprite.dragging || sprite.busy) return;
          sprite.x += sprite.vx * dt;
          sprite.y += sprite.vy * dt;
          if (sprite.x < bounds.xMin || sprite.x > bounds.xMax) sprite.vx *= -1;
          if (sprite.y < bounds.yMin || sprite.y > bounds.yMax) sprite.vy *= -1;
          sprite.x = Math.max(bounds.xMin, Math.min(bounds.xMax, sprite.x));
          sprite.y = Math.max(bounds.yMin, Math.min(bounds.yMax, sprite.y));
          setWasteSpritePosition(sprite);
        });
        state.wasteVesicles.forEach(vesicle => {
          if (!vesicle.g?.isConnected || vesicle.status !== "collecting") return;
          vesicle.x += vesicle.vx * dt;
          vesicle.y += vesicle.vy * dt;
          if (vesicle.x - vesicle.radius < bounds.xMin || vesicle.x + vesicle.radius > bounds.xMax) vesicle.vx *= -1;
          if (vesicle.y - vesicle.radius < bounds.yMin || vesicle.y + vesicle.radius > bounds.yMax) vesicle.vy *= -1;
          vesicle.x = Math.max(bounds.xMin + vesicle.radius, Math.min(bounds.xMax - vesicle.radius, vesicle.x));
          vesicle.y = Math.max(bounds.yMin + vesicle.radius, Math.min(bounds.yMax - vesicle.radius, vesicle.y));
          setWasteVesiclePosition(vesicle);
          vesicle.cargo.forEach(cargo => {
            cargo.x += cargo.vx * dt;
            cargo.y += cargo.vy * dt;
            const distance = Math.hypot(cargo.x, cargo.y);
            if (distance > WASTE_VESICLE_CORE_RADIUS) {
              const nx = cargo.x / distance;
              const ny = cargo.y / distance;
              cargo.x = nx * WASTE_VESICLE_CORE_RADIUS;
              cargo.y = ny * WASTE_VESICLE_CORE_RADIUS;
              const outwardSpeed = cargo.vx * nx + cargo.vy * ny;
              if (outwardSpeed > 0) {
                cargo.vx -= 2 * outwardSpeed * nx;
                cargo.vy -= 2 * outwardSpeed * ny;
              }
            }
            cargo.g.setAttribute("transform", `translate(${cargo.x.toFixed(1)} ${cargo.y.toFixed(1)})`);
          });
        });
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      }
      const frameId = requestAnimationFrame(step);
      state.demoFrames.push(frameId);
    }

    function startWasteVesicleChallenge(index, prelude) {
      state.transportPreludeIndex = index;
      state.transportPreludeActive = true;
      state.wasteVesicleChallengeActive = true;
      state.wasteDragSprites = [];
      state.wasteVesicles = [];
      state.wasteVesicleExported = 0;
      state.wasteVesicleReviewQueued = false;
      clearTransportPreludeOverlay();
      document.querySelectorAll("#demoParticles .demo-particle:not(.transport-prelude-overlay)").forEach(node => node.remove());
      renderStats();
      for (let i = 0; i < wasteVesicleGoal(); i++) createWasteDragSprite();
      const vesicleCount = Math.ceil(wasteVesicleGoal() / WASTE_VESICLE_CAPACITY);
      for (let i = 0; i < vesicleCount; i++) createWasteVesicle(i);
      startWasteVesicleFloatLoop();
      clearDemoInstructionText();
      renderDetails();
    }

    function startCombinedTransportChallenge() {
      const waterPrelude = TRANSPORT_PRELUDES.find(item => item.id === "water");
      const glucosePrelude = TRANSPORT_PRELUDES.find(item => item.id === "glucose");
      const wastePrelude = TRANSPORT_PRELUDES.find(item => item.id === "waste");
      state.transportPreludeActive = true;
      state.transportPreludePopupOpen = false;
      state.transportPreludeFinished = false;
      state.waterDragChallengeActive = true;
      state.waterDragSprites = [];
      state.waterDragTransported = 0;
      state.waterDragReviewQueued = false;
      state.glucoseDragChallengeActive = true;
      state.glucoseDragSprites = [];
      state.glucoseDragTransported = 0;
      state.glucoseDragReviewQueued = false;
      state.glucoseLeverState = "up";
      state.glucoseLeverReadyAt = 0;
      state.glucoseInPocket = null;
      state.glucoseAirlockActive = true;
      state.wasteVesicleChallengeActive = true;
      state.wasteDragSprites = [];
      state.wasteVesicles = [];
      state.wasteVesicleExported = 0;
      state.wasteVesicleReviewQueued = false;
      state.combinedTransportReviewQueued = false;
      clearTransportPreludeOverlay();
      document.querySelectorAll("#demoParticles .demo-particle:not(.transport-prelude-overlay)").forEach(node => node.remove());
      renderStats();

      const waterStart = waterDragStartSide();
      for (let i = 0; i < waterDragGoal(); i++) createWaterDragSprite(waterStart);
      for (let i = 0; i < glucoseDragGoal(); i++) createGlucoseDragSprite("outside");
      for (let i = 0; i < wasteVesicleGoal(); i++) createWasteDragSprite();
      const vesicleCount = Math.ceil(wasteVesicleGoal() / WASTE_VESICLE_CAPACITY);
      for (let i = 0; i < vesicleCount; i++) createWasteVesicle(i);

      state.glucoseAirlockOverlay = createCenteredGlucoseAirlockOverlay();
      state.glucoseLeverOverlay = null;
      setGlucoseGateState(state.glucoseAirlockOverlay?.outer, "outer", false);
      setGlucoseGateState(state.glucoseAirlockOverlay?.inner, "inner", false);
      bringGlucoseChallengeControlsToFront();

      startWaterDragFloatLoop();
      startGlucoseDragFloatLoop();
      startWasteVesicleFloatLoop();
      clearDemoInstructionText();
      renderDetails();
    }

    function finishWasteVesicleChallengeAfterFloat() {
      if (state.wasteVesicleReviewQueued) return;
      state.wasteVesicleReviewQueued = true;
      if (finishCombinedTransportPart("demoWasteExit", "Waste route complete. Finish the other membrane paths.")) return;
      membraneFeedback("All waste was packed into vesicles and exported. Review what happened.", 4, 3600);
      demoSetTimeout(() => {
        if (!state.wasteVesicleChallengeActive || !currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
        state.wasteVesicleChallengeActive = false;
        state.transportPreludeActive = false;
        markAction("demoWasteExit");
        showTransportPreludeReviewPopup(currentTransportPreludeIndex());
        renderDetails();
      }, 1700);
    }

    function runCenteredGlucoseGatePrelude(shape, overlay) {
      // Glucose starts inside the visible outside-cell area, moves to the door, forms a readable queue,
      // then enters only after each side of the door has finished opening.
      const count = 4;
      const cycle = 2600;
      const moveDuration = 4200;
      const roundGap = 360;
      const roundDuration = (count - 1) * cycle + moveDuration;
      const totalDuration = roundDuration * 2 + roundGap;
      const y = 280;
      const queueStartX = 366;
      const spacing = 74;
      const preQueueGap = 78;

      for (let round = 0; round < 2; round++) {
        const roundStart = round * (roundDuration + roundGap);
        demoSetTimeout(() => {
          if (!currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
          const glucoseGroups = [];
          for (let n = 0; n < count; n++) {
            const queueX = queueStartX - n * spacing;
            const startX = queueX - preQueueGap;
            const g = demoGroup("Glucose", shape, startX, y);
            glucoseGroups.push({ g, queueX, startX });

            // First, visibly form the line from inside the outside-cell panel. Labels have enough space to read.
            animateDemoGroup(g, [
              { x: startX, y, opacity: 1, scale: 1, offset: 0 },
              { x: queueX, y, opacity: 1, scale: 1, offset: 1 }
            ], 1250 + n * 120, { linear: true, removeAtEnd: false });
          }

          glucoseGroups.forEach((item, n) => {
            demoSetTimeout(() => {
              if (!item.g || !item.g.isConnected) return;
              setPreludeGlucoseGateState(overlay, "outer", false);
              setPreludeGlucoseGateState(overlay, "inner", false);

              // Door panels still move quickly, but open before glucose reaches them.
              demoSetTimeout(() => setPreludeGlucoseGateState(overlay, "outer", true), 120);
              demoSetTimeout(() => setPreludeGlucoseGateState(overlay, "outer", false), 1550);
              demoSetTimeout(() => setPreludeGlucoseGateState(overlay, "inner", true), 2200);
              demoSetTimeout(() => setPreludeGlucoseGateState(overlay, "inner", false), 4050);

              animateDemoGroup(item.g, [
                { x: item.queueX, y, opacity: 1, scale: 1, offset: 0 },
                { x: 390, y, opacity: 1, scale: 1, offset: .18 },
                { x: 423, y, opacity: 1, scale: .94, offset: .32 },
                { x: 450, y, opacity: 1, scale: .86, offset: .50 },
                { x: 470, y, opacity: 1, scale: .86, offset: .62 },
                { x: 510, y, opacity: 1, scale: .9, offset: .78 },
                { x: 704 + n * 10, y, opacity: 1, scale: 1, offset: .9 },
                { x: 732 + n * 10, y, opacity: 0, scale: .82, offset: 1 }
              ], moveDuration + 360, { linear: true, removeDelay: 20 });
            }, 1450 + n * cycle);
          });
        }, roundStart);
      }
      return totalDuration;
    }

    function runCenteredWasteExitPrelude(shape) {
      const count = 4;
      const cycle = 980;
      const moveDuration = 4300;
      const roundGap = 360;
      const roundDuration = (count - 1) * cycle + moveDuration;
      const totalDuration = roundDuration * 2 + roundGap;
      const y = 280;
      const queueStartX = 560;
      const spacing = 58;

      for (let round = 0; round < 2; round++) {
        const roundStart = round * (roundDuration + roundGap);
        demoSetTimeout(() => {
          if (!currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
          for (let n = 0; n < count; n++) {
            const queueX = queueStartX + n * spacing;
            const g = demoGroup("Waste", shape, queueX, y);
            demoSetTimeout(() => {
              if (!g || !g.isConnected) return;
              animateDemoGroup(g, [
                { x: queueX, y, opacity: 1, scale: 1, offset: 0 },
                { x: 506, y, opacity: 1, scale: 1, offset: .26 },
                { x: 478, y, opacity: 1, scale: .94, offset: .42 },
                { x: 450, y, opacity: 1, scale: .86, offset: .56 },
                { x: 422, y, opacity: 1, scale: .94, offset: .70 },
                { x: 190 - n * 8, y, opacity: 1, scale: 1, offset: 1 }
              ], moveDuration, { linear: true });
            }, n * cycle);
          }
        }, roundStart);
      }
      return totalDuration;
    }

    function runCenteredBasicPreludeRounds(prelude, shape) {
      const count = 4;
      const stagger = 560;
      const moveDuration = 4600;
      const roundGap = 360;
      const roundDuration = (count - 1) * stagger + moveDuration;
      const totalDuration = roundDuration * 2 + roundGap;
      for (let round = 0; round < 2; round++) {
        demoSetTimeout(() => {
          if (!currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
          spawnTransportRow(prelude.material, shape, (n) => centeredPreludeFrames(prelude, n), moveDuration, count, stagger);
        }, round * (roundDuration + roundGap));
      }
      return totalDuration;
    }

    function runCenteredLargeMoleculePrelude(shape) {
      const largeCount = 4;
      const stagger = 620;
      const moveDuration = 3000;
      const roundGap = 500;
      const roundDuration = (largeCount - 1) * stagger + moveDuration;
      const totalDuration = roundDuration * 2 + roundGap;
      const largeLanes = [214, 266, 318, 370];

      for (let round = 0; round < 2; round++) {
        const roundStart = round * (roundDuration + roundGap);
        demoSetTimeout(() => {
          if (!currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;

          for (let i = 0; i < largeCount; i++) {
            const y = largeLanes[i % largeLanes.length];
            const startX = 102 - i * 8;
            demoSetTimeout(() => {
              if (!currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
              const g = demoGroup("Large Molecule", shape, startX, y);
              animateDemoGroup(g, [
                { x: startX, y, opacity: 1, scale: 1, offset: 0 },
                { x: 292, y: y - 2, opacity: 1, scale: 1.04, offset: .34 },
                { x: LARGE_MOLECULE_CONTACT_X, y, opacity: 1, scale: 1.13, offset: .58 },
                { x: 346, y: y + 12, opacity: .9, scale: 1, offset: .72 },
                { x: 146 - i * 8, y: y + 24, opacity: .65, scale: .9, offset: 1 }
              ], moveDuration, { linear: true });
              demoSetTimeout(() => triggerMembraneImpact(g), Math.round(moveDuration * .58));
            }, i * stagger);
          }
        }, roundStart);
      }

      return totalDuration;
    }

    function transportPreludeReviewPoints(prelude) {
      if (prelude.id === "oxygen") {
        return [
          "The same 5 oxygen molecules crossed into the cell and then crossed back outside.",
          "The phospholipid membrane is not a one-way wall.",
          "Tiny, nonpolar oxygen can slip through the membrane without a protein door.",
          "Oxygen moves randomly both ways, but overall more diffuses from higher concentration toward lower concentration."
        ];
      }
      if (prelude.id === "largeMolecule") {
        return [
          "Large molecules bounced off the membrane.",
          "They were too big or did not fit through that membrane spot.",
          "Faint oxygen still slipped through in the background because oxygen is tiny.",
          "The membrane is selective: some things pass, and some things are blocked."
        ];
      }
      if (prelude.id === "water") {
        if (isWaterDragLevel()) {
          const entered = waterDragDirection() === "in";
          return [
            entered ? "Water moved from outside into the cell." : "Water moved from inside out of the cell.",
            "It only crossed when it lined up with the Water Channel.",
            "Water released above or below the channel bounced off the membrane.",
            "Water can move both directions through channels when the cell needs balance."
          ];
        }
        return [
          "Water moved through the water channel.",
          "Some water went in.",
          "Some water went out.",
          "Water is small, but it uses a channel because the membrane is hard for water to cross."
        ];
      }
      if (prelude.id === "glucose") {
        if (isGlucoseDragLevel()) {
          return [
            "Glucose moved through the two-door glucose door.",
            "Lever up opened the left door so glucose could enter.",
            "Lever down opened the right door so glucose could leave into the cell.",
            "A controlled door helps the membrane decide what gets inside."
          ];
        }
        return [
          "Glucose moved into the cell.",
          "It used the glucose door.",
          "Glucose is a bigger sugar molecule, so it needs a special door."
        ];
      }
      if (isWasteVesicleLevel()) {
        return [
          "Waste moved into vesicle bubbles first.",
          "A vesicle is a small bubble that transports stuff around the cell.",
          "Each vesicle carried 3 waste pieces while they floated inside.",
          "A full vesicle docked at the membrane and opened an exit.",
          "The waste left the cell safely through the membrane."
        ];
      }
      return [
        "Waste moved out of the cell.",
        "It used the waste exit.",
        "Waste is stuff the cell does not need anymore.",
        "The cell uses exits to move waste out safely."
      ];
    }

    function showTransportPreludeReviewPopup(index = 0) {
      const level = currentLevel();
      if (!level.membraneDemoMode || level.demoStage !== "transport") return;
      const popup = document.getElementById("transportLearningPopup");
      if (!popup) return;
      const i = Math.max(0, Math.min(TRANSPORT_PRELUDES.length - 1, index));
      const prelude = TRANSPORT_PRELUDES[i];
      state.transportPreludeIndex = i;
      state.transportPreludePopupOpen = true;
      const points = transportPreludeReviewPoints(prelude).map(point => `<p>${point}</p>`).join("");
      const nextLabel = Number.isInteger(currentLevel().transportPreludeIndex) && i < TRANSPORT_PRELUDES.length - 1 ? "Next Membrane Lesson" : "Next Level";
      popup.innerHTML = `
        <div class="learning-card">
          <h3>What happened?</h3>
          <div class="learning-grid" style="margin-top: 12px;">
            <div class="learning-sim-preview">
              <div class="learning-icon-row">
                <div class="learning-icon">${transportPreludeIcon(prelude, "sprite")}</div>
                <div class="learning-icon">${transportPreludeIcon(prelude, "path")}</div>
              </div>
            </div>
            <div class="learning-copy-column">
              <div class="learning-point-bubble big-panel">
                ${points}
              </div>
            </div>
          </div>
          <div class="learning-actions">
            <button onclick="startTransportPreludeDemo(${i})">Replay</button>
            <button class="primary" onclick="continueAfterTransportPreludeReview(${i})">${nextLabel}</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
    }

    function continueAfterTransportPreludeReview(index = 0) {
      const popup = document.getElementById("transportLearningPopup");
      if (popup) popup.classList.remove("visible");
      clearTransportPreludeOverlay();
      document.querySelectorAll("#demoParticles .demo-particle:not(.transport-prelude-overlay)").forEach(node => node.remove());
      const i = Math.max(0, Math.min(TRANSPORT_PRELUDES.length - 1, index));
      state.transportPreludePopupOpen = false;
      if (Number.isInteger(currentLevel().transportPreludeIndex)) {
        state.transportPreludeFinished = true;
        loadLevel(state.levelIndex + 1);
      } else if (i < TRANSPORT_PRELUDES.length - 1) {
        state.transportPreludeIndex = i + 1;
        showTransportPreludePopup(i + 1);
      } else {
        state.transportPreludeFinished = true;
        loadLevel(state.levelIndex + 1);
      }
    }

    function startTransportPreludeDemo(index = 0) {
      const level = currentLevel();
      if (!level.membraneDemoMode || level.demoStage !== "transport") return;
      const i = Number.isInteger(level.transportPreludeIndex) ? currentTransportPreludeIndex() : Math.max(0, Math.min(TRANSPORT_PRELUDES.length - 1, index));
      const prelude = TRANSPORT_PRELUDES[i];
      state.transportPreludeIndex = i;
      state.transportPreludeActive = true;
      const transportPopup = document.getElementById("transportLearningPopup");
      if (transportPopup) transportPopup.classList.remove("visible");
      state.transportPreludePopupOpen = false;
      clearTransportPreludeOverlay();
      document.querySelectorAll("#demoParticles .demo-particle:not(.transport-prelude-overlay)").forEach(node => node.remove());
      const shape = transportShape(prelude);
      if ((prelude.id === "oxygen" || prelude.id === "largeMolecule") && isSimpleMoleculeDragLevel(level)) {
        startSimpleMoleculeDragChallenge(i, prelude);
        return;
      }
      if (prelude.id === "water" && isWaterDragLevel(level)) {
        startWaterDragChallenge(i, prelude);
        return;
      }
      if (prelude.id === "glucose" && isGlucoseDragLevel(level)) {
        startGlucoseDragChallenge(i, prelude);
        return;
      }
      if (prelude.id === "waste" && isWasteVesicleLevel(level)) {
        startWasteVesicleChallenge(i, prelude);
        return;
      }

      const overlay = centerTransportOverlay(prelude);
      let demoDuration = 0;
      if (prelude.id === "glucose") {
        demoDuration = runCenteredGlucoseGatePrelude(shape, overlay);
        adjustStats({ glucose: +8, atp: +5, transport: +1 });
      } else if (prelude.id === "largeMolecule") {
        startBackgroundOxygen({ afterOverlay: true });
        demoDuration = runCenteredLargeMoleculePrelude(shape);
        adjustStats({ transport: +1 });
      } else if (prelude.id === "water") {
        demoDuration = runCenteredWaterPrelude(shape);
        adjustStats({ water: +4, transport: +1 });
      } else if (prelude.id === "waste") {
        demoDuration = runCenteredWasteExitPrelude(shape);
        adjustStats({ waste: -12, transport: +1 });
      } else {
        demoDuration = runCenteredBasicPreludeRounds(prelude, shape);
        if (prelude.id === "oxygen") adjustStats({ oxygen: +12 });
      }

      markAction(prelude.action);
      membraneFeedback(prelude.simText, 3, 5200);

      demoSetTimeout(() => {
        state.transportPreludeActive = false;
        if (!currentLevel().membraneDemoMode || currentLevel().demoStage !== "transport") return;
        showTransportPreludeReviewPopup(i);
        if (prelude.id === "water") maybeOfferOsmosisSideQuest();
        renderDetails();
      }, demoDuration + 900);
    }

    function spawnTransportRow(label, shapeMarkup, framesFactory, duration, count = 5, stagger = 560) {
      // Same path + delayed starts = a clear horizontal row/queue moving forward.
      // Avoid y offsets here; those made the particles look like a vertical column.
      // A wider stagger keeps the labels from overlapping while they line up.
      for (let i = 0; i < count; i++) {
        demoSetTimeout(() => {
          const frames = framesFactory(i);
          const first = frames[0];
          const g = demoGroup(label, shapeMarkup, first.x, first.y);
          animateDemoGroup(g, frames, duration);
        }, i * stagger);
      }
    }

    function setGlucoseGateState(gate, side, open) {
      if (!gate) return;

      // The visible glucose door has two panels. Give each panel its own direction
      // so the right/inside door can clearly open and stay open while glucose exits.
      const shiftX = open ? (side === "outer" ? -20 : 20) : 0;
      gate.style.transformBox = "fill-box";
      gate.style.transformOrigin = "center";
      gate.animate([
        { transform: gate.style.transform || "translateX(0px)", opacity: gate.style.opacity || 1 },
        { transform: `translateX(${shiftX}px)`, opacity: open ? .42 : 1 }
      ], { duration: 320, easing: "ease-in-out", fill: "forwards" });
      gate.style.transform = `translateX(${shiftX}px)`;
      gate.style.opacity = open ? .42 : 1;
    }

    function createGlucoseAirlockOverlay() {
      const layer = document.getElementById("demoParticles");
      if (!layer) return null;
      const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("class", "demo-particle glucose-airlock-visual");
      overlay.innerHTML = `
        <rect x="420" y="132" width="60" height="42" rx="14" fill="rgba(253,224,71,.18)" stroke="#fff7ad" stroke-width="2"/>
        <rect x="433" y="139" width="34" height="28" rx="9" fill="rgba(2,6,23,.42)" stroke="rgba(255,247,173,.78)" stroke-width="2" stroke-dasharray="5 4"/>
                <rect class="glucose-outer-gate" x="421" y="135" width="10" height="36" rx="5" fill="#facc15" stroke="#fef9c3" stroke-width="2"/>
        <rect class="glucose-inner-gate" x="469" y="135" width="10" height="36" rx="5" fill="#facc15" stroke="#fef9c3" stroke-width="2"/>
      `;
      layer.appendChild(overlay);
      return {
        g: overlay,
        outer: overlay.querySelector(".glucose-outer-gate"),
        inner: overlay.querySelector(".glucose-inner-gate")
      };
    }

    function demoGlucoseDoor() {
      if (state.glucoseAirlockActive) {
        membraneFeedback("Glucose Door is already cycling. Watch the queued glucose go through one at a time.", 3, 4200);
        return;
      }
      state.glucoseAirlockActive = true;

      const y = 153;
      const count = 5;
      const cycleDelay = 7800;
      const travelDuration = 7000;

      // Spawn as a line right outside the Glucose Door. The first glucose is closest to the gate.
      const queueStartX = 364;
      const queueSpacing = 50;
      const shape = `<polygon points="0,-13 12,-6 12,7 0,14 -12,7 -12,-6" fill="#fde047" stroke="#fff7ad" stroke-width="3"/>`;
      const layer = document.getElementById("demoParticles");
      if (!layer) {
        state.glucoseAirlockActive = false;
        return;
      }

      const airlock = createGlucoseAirlockOverlay();
      if (!airlock) {
        state.glucoseAirlockActive = false;
        return;
      }
      // Keep the gate overlay above the glucose blocks so the opening/closing is visible.
      layer.appendChild(airlock.g);

      const glucoseGroups = [];
      for (let i = 0; i < count; i++) {
        const queueX = queueStartX - i * queueSpacing;
        const g = demoGroup("Glucose", shape, queueX, y);
        glucoseGroups[i] = { g, queueX };
      }

      for (let i = 0; i < count; i++) {
        demoSetTimeout(() => {
          const item = glucoseGroups[i];
          if (!item || !item.g || !item.g.isConnected) return;
          const { g, queueX } = item;
          setGlucoseGateState(airlock.outer, "outer", false);
          setGlucoseGateState(airlock.inner, "inner", false);

          // Gate panel animation speed stays the same. The glucose travel is slower.
          // Open the outer gate earlier and keep each gate open longer so the glucose fully clears it.
          demoSetTimeout(() => setGlucoseGateState(airlock.outer, "outer", true), 900);
          demoSetTimeout(() => setGlucoseGateState(airlock.outer, "outer", false), 3400);
          demoSetTimeout(() => {
            const pocket = airlock.g.querySelector("rect:nth-child(2)");
            if (pocket) {
              pocket.animate([
                { stroke: "rgba(255,247,173,.78)", opacity: 1 },
                { stroke: "#fde047", opacity: 1 },
                { stroke: "rgba(255,247,173,.78)", opacity: 1 }
              ], { duration: 650, easing: "ease-in-out" });
            }
          }, 3320);
          demoSetTimeout(() => setGlucoseGateState(airlock.inner, "inner", true), 4100);
          demoSetTimeout(() => setGlucoseGateState(airlock.inner, "inner", false), 7850);

          animateDemoGroup(g, [
            { x: queueX, y, opacity: 1, scale: 1, offset: 0 },
            { x: 392, y, opacity: 1, scale: 1, offset: .24 },
            { x: 414, y, opacity: 1, scale: 1, offset: .34 },
            { x: 450, y, opacity: 1, scale: .86, offset: .50 },
            { x: 470, y, opacity: 1, scale: .86, offset: .62 },
            { x: 510, y, opacity: 1, scale: .90, offset: .77 },
            { x: 824, y: y + 12, opacity: 1, scale: 1, offset: 1 }
          ], travelDuration, { linear: true, onDone: () => {
            if (state.levelLost) return;
            // The stat rises only after this individual glucose actually reaches the inside-cell box.
            // ATP also recovers a little as a simple beginner-game shortcut for glucose becoming usable fuel.
            adjustStats({ glucose: +4, atp: +10, transport: +1 });
            membraneFeedback("One glucose entered: glucose increased. Simple version: each glucose gave the cell +10 ATP as usable fuel.", 2, 3000);
            checkWarnings();
          }});
        }, i * cycleDelay);
      }

      demoSetTimeout(() => {
        if (airlock.g && airlock.g.isConnected) {
          airlock.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "ease-in-out" });
          demoSetTimeout(() => airlock.g.remove(), 700);
        }
        state.glucoseAirlockActive = false;
      }, count * cycleDelay + 900);

      membraneFeedback("Glucose starts as a line right outside the Glucose Door. It moves slower, and the inside door now stays open longer so each glucose can fully enter before it closes.", 3, 8500);
    }

    function demoOxygenPassReview() {
      const y = 194;
      const shape = `<circle cx="0" cy="0" r="13" fill="#f8fafc" stroke="#bfdbfe" stroke-width="3"/>`;
      spawnTransportRow("Oxygen", shape, () => [
        { x: 84, y, opacity: 1, scale: 1, offset: 0 },
        { x: 325, y: y - 6, opacity: 1, scale: 1, offset: .42 },
        { x: 450, y: y + 6, opacity: 1, scale: .92, offset: .60 },
        { x: 824, y: y + 10, opacity: 1, scale: 1, offset: 1 }
      ], 5200, 5, 520);
      adjustStats({ oxygen: +10, transport: +1 });
      membraneFeedback("Oxygen is small, so in this simple model it slips through the membrane without a special door.", 3, 5200);
    }

    function demoWaterGate() {
      const shape = `<path d="M0,-18 C7,-10 13,-2 13,8 C13,19 7,27 0,27 C-7,27 -13,19 -13,8 C-13,-2 -7,-10 0,-18 Z" fill="#38bdf8" stroke="#bae6fd" stroke-width="3"/>`;
      const count = 5;
      const stagger = 760;
      const duration = 5200;
      const laneY = 280;
      const entryQueueStartX = 356;
      const exitQueueStartX = 546;
      const spacing = 42;
      const leftVisibleEdgeX = 86;
      const rightVisibleEdgeX = 814;
      const entering = [];
      const exiting = [];

      for (let i = 0; i < count; i++) {
        const queueX = entryQueueStartX - i * spacing;
        const spawnX = leftVisibleEdgeX + i * 8;
        entering.push({ g: demoGroup("Water", shape, spawnX, laneY), spawnX, queueX });
      }
      for (let i = 0; i < count; i++) {
        const queueX = exitQueueStartX + i * spacing;
        const spawnX = rightVisibleEdgeX - i * 8;
        exiting.push({ g: demoGroup("Water", shape, spawnX, laneY), spawnX, queueX });
      }

      entering.forEach((item, i) => {
        demoSetTimeout(() => {
          if (!item.g || !item.g.isConnected) return;
          animateDemoGroup(item.g, [
            { x: item.spawnX, y: laneY, opacity: 1, scale: 1, offset: 0 },
            { x: item.queueX, y: laneY, opacity: 1, scale: 1, offset: .16 },
            { x: 400, y: laneY, opacity: 1, scale: 1, offset: .32 },
            { x: 450, y: laneY, opacity: 1, scale: .9, offset: .56 },
            { x: 512, y: laneY, opacity: 1, scale: .96, offset: .74 },
            { x: 814, y: laneY + 10, opacity: 1, scale: 1, offset: 1 }
          ], duration, { linear: true });
        }, i * stagger);
      });

      exiting.forEach((item, i) => {
        demoSetTimeout(() => {
          if (!item.g || !item.g.isConnected) return;
          animateDemoGroup(item.g, [
            { x: item.spawnX, y: laneY, opacity: 1, scale: 1, offset: 0 },
            { x: item.queueX, y: laneY, opacity: 1, scale: 1, offset: .16 },
            { x: 500, y: laneY, opacity: 1, scale: 1, offset: .32 },
            { x: 450, y: laneY, opacity: 1, scale: .9, offset: .56 },
            { x: 388, y: laneY, opacity: 1, scale: .96, offset: .74 },
            { x: 86, y: laneY - 10, opacity: 1, scale: 1, offset: 1 }
          ], duration, { linear: true });
        }, i * stagger);
      });

      adjustStats({ water: +2 });
      membraneFeedback("Water now spawns near the side edges, moves into line, passes through the same middle lane, then disappears near the side edges.", 3, 7600);
    }

    function demoWasteExit() {
      const y = 376;
      const shape = `<rect x="-10" y="-10" width="20" height="20" rx="5" fill="#94a3b8" stroke="#e2e8f0" stroke-width="3"/>`;
      const count = 5;
      const spacing = 48;
      const stagger = 560;
      for (let i = 0; i < count; i++) {
        const startX = 640 + i * spacing;
        demoSetTimeout(() => {
          const g = demoGroup("Waste", shape, startX, y);
          animateDemoGroup(g, [
            { x: startX, y, opacity: 1, scale: 1, offset: 0 },
            { x: 512, y, opacity: 1, scale: 1, offset: .26 },
            { x: 482, y, opacity: 1, scale: .94, offset: .42 },
            { x: 450, y, opacity: 1, scale: .86, offset: .56 },
            { x: 418, y, opacity: 1, scale: .94, offset: .70 },
            { x: 62 - i * 8, y, opacity: 1, scale: 1, offset: 1 }
          ], 5600, { linear: true });
        }, i * stagger);
      }
      adjustStats({ waste: -10 });
      membraneFeedback("Waste lines up inside the cell and leaves through the Waste Exit. This beginner demo does not cost ATP.", 3, 5200);
    }

    function animateWrenches() {
      const layer = document.getElementById("demoParticles");
      if (!layer) return;

      const fadeFor = (progress) => {
        if (progress < .12) return progress / .12;
        if (progress > .88) return Math.max(0, (1 - progress) / .12);
        return 1;
      };

      const spawnPivotWrench = (spot) => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "demo-particle repair-tool");
        g.setAttribute("filter", "drop-shadow(0 0 10px rgba(96,165,250,.62))");
        // The crescent/head is centered at 0,0, so the whole wrench pivots around the jaw instead of flying around.
        g.innerHTML = `
          <path d="M0,-15 A15,15 0 0 0 13,8 L6,10 L-2,2 L-10,10 L-16,5 A15,15 0 0 0 0,-15" fill="#e0f2fe" stroke="#60a5fa" stroke-width="3" stroke-linejoin="round"/>
          <rect x="-4" y="7" width="8" height="54" rx="4" fill="#94a3b8" stroke="#e2e8f0" stroke-width="2" transform="rotate(-28 0 7)"/>
          <circle cx="-14" cy="55" r="5" fill="#cbd5e1" stroke="#f8fafc" stroke-width="2"/>
        `;
        layer.appendChild(g);

        const start = performance.now();
        const duration = 5200;
        const swings = 4.25;
        function step(now) {
          const progress = Math.min(1, (now - start) / duration);
          const swing = Math.sin(progress * Math.PI * 2 * swings) * 20;
          const tinyPress = Math.sin(progress * Math.PI * 2 * swings) * 1.8;
          const opacity = fadeFor(progress);
          g.setAttribute("opacity", opacity);
          g.setAttribute("transform", `translate(${spot.x} ${spot.y + tinyPress}) rotate(${spot.angle + swing})`);
          if (progress < 1) {
            const frameId = requestAnimationFrame(step);
            state.demoFrames.push(frameId);
          } else {
            g.remove();
          }
        }
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      };

      const spawnStationaryHammer = (spot) => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "demo-particle repair-tool");
        g.setAttribute("filter", "drop-shadow(0 0 10px rgba(251,191,36,.55))");
        // Hammer head stays at the repair spot. Only the handle swings, so it reads as hammering in place.
        g.innerHTML = `
          <g class="hammer-body">
            <rect x="-21" y="-16" width="42" height="13" rx="4" fill="#fbbf24" stroke="#fef3c7" stroke-width="2"/>
            <rect x="-4" y="-4" width="8" height="50" rx="4" fill="#92400e" stroke="#fed7aa" stroke-width="2"/>
          </g>
          <g class="hammer-impact" opacity="0">
            <path d="M-22,4 L-35,13" stroke="#fde68a" stroke-width="4" stroke-linecap="round"/>
            <path d="M2,8 L0,25" stroke="#fde68a" stroke-width="4" stroke-linecap="round"/>
            <path d="M23,3 L36,11" stroke="#fde68a" stroke-width="4" stroke-linecap="round"/>
          </g>
        `;
        layer.appendChild(g);
        const impact = g.querySelector(".hammer-impact");

        const start = performance.now();
        const duration = 5000;
        const hits = 5;
        function step(now) {
          const progress = Math.min(1, (now - start) / duration);
          const phase = (progress * hits) % 1;
          const windup = phase < .55 ? phase / .55 : 1;
          const strike = phase >= .55 ? (phase - .55) / .45 : 0;
          const hitAngle = spot.angle - 28 + windup * 36 - strike * 32;
          const opacity = fadeFor(progress);
          g.setAttribute("opacity", opacity);
          g.setAttribute("transform", `translate(${spot.x} ${spot.y}) rotate(${hitAngle})`);
          if (impact) impact.setAttribute("opacity", phase > .58 && phase < .72 ? opacity : 0);
          if (progress < 1) {
            const frameId = requestAnimationFrame(step);
            state.demoFrames.push(frameId);
          } else {
            g.remove();
          }
        }
        const frameId = requestAnimationFrame(step);
        state.demoFrames.push(frameId);
      };

      [
        { x: 432, y: 145, angle: -22 },
        { x: 468, y: 215, angle: 24 },
        { x: 428, y: 304, angle: -24 },
        { x: 468, y: 385, angle: 20 }
      ].forEach((spot, i) => demoSetTimeout(() => spawnPivotWrench(spot), i * 520));

      [
        { x: 488, y: 188, angle: -14 },
        { x: 408, y: 330, angle: 14 },
        { x: 490, y: 414, angle: -18 }
      ].forEach((spot, i) => demoSetTimeout(() => spawnStationaryHammer(spot), 360 + i * 680));
    }

    function smartBorderIconRow(items) {
      return items.map(([icon, label]) => `
        <div class="intro-bubble">
          <span>${icon}</span>
          ${label}
        </div>
      `).join("");
    }

    function showSmartBorderPreviewPopup(stage) {
      const data = SMART_BORDER_PREVIEWS[stage];
      const popup = document.getElementById("transportLearningPopup");
      if (!data || !popup) return false;
      state.transportPreludePopupOpen = true;
      popup.innerHTML = `
        <div class="learning-card">
          <div class="learning-step">${data.step}</div>
          <h3>${data.title}</h3>
          <div class="learning-grid">
            <div class="learning-sim-preview">
              <div class="intro-bubbles" aria-label="What students will watch">
                ${smartBorderIconRow(data.icons)}
              </div>
            </div>
            <div class="learning-copy-column">
              <div class="learning-point-bubble big-panel">
                <p>${data.simple}</p>
                <p><b>In the simulation:</b> ${data.watch}</p>
                <p><b>Simple idea:</b> ${data.why}</p>
              </div>
            </div>
          </div>
          <div class="learning-actions">
            <button class="primary" onclick="beginSmartBorderStageDemo('${stage}')">Start Demo</button>
          </div>
        </div>
      `;
      popup.classList.add("visible");
      return true;
    }

    function beginSmartBorderStageDemo(stage) {
      closeLearningPopup();
      runMembraneStageAnimation(stage);
    }

    function runMembraneStageAnimation(stage) {
      if (stage !== "waterBalance" && stage !== "transport") {
        startBackgroundOxygen();
      }
      if (stage === "transport") {
        startTransportPreludes();
      } else if (stage === "transportReview") {
        membraneFeedback("Combined review: click each action to see oxygen, water, glucose, and waste cross in one membrane demo.", 2, 9000);
      } else if (stage === "waterBalance") {
        startWaterBalanceDemo();
      } else if (stage === "blocked") {
        membraneFeedback("Watch: purple toxins bounce away. Faded oxygen keeps drifting in the background.", 2, 9000);
        spawnBlockedToxin();
        demoSetTimeout(spawnBlockedToxin, 900);
        demoSetTimeout(spawnBlockedToxin, 1800);
        demoSetInterval(spawnBlockedToxin, 1500);
      } else if (stage === "sneaky") {
        membraneFeedback("Watch: orange toxins wiggle through, then Toxins Inside rises. Send Cleaner Protein out before the buildup reaches 20, then send Garbage Man Protein out for floating waste.", 2, 9000);
        spawnSneakyToxin();
        demoSetTimeout(spawnSneakyToxin, 1200);
        demoSetInterval(spawnSneakyToxin, 2000);
      } else if (stage === "damaging") {
        membraneFeedback("Watch: red toxins damage the membrane. Repair when health drops.", 2, 9000);
        demoSetTimeout(spawnDamagingToxin, 900);
        demoSetInterval(spawnDamagingToxin, 3000);
      } else if (stage === "mixed") {
        membraneFeedback("Live mixed demo: Cleaner Protein handles Toxins Inside. Garbage Man Protein spends ATP to handle waste. Repair Membrane handles cracks.", 2, 9000);
        const spawnMixed = () => {
          const r = Math.random();
          if (r < .32) spawnBlockedToxin();
          else if (r < .68) spawnSneakyToxin();
          else spawnDamagingToxin();
          markAction("demoMixedToxins");
        };
        spawnMixed();
        demoSetInterval(spawnMixed, 2000);
      }
    }

    function startMembraneDemo(stage) {
      stopMembraneDemo();
      state.membraneCracksUnlocked = false;
      setMembraneDemoMode(true);
      updateMembraneDemoVisuals();
      if (["blocked", "sneaky", "damaging", "mixed"].includes(stage)) {
        membraneFeedback("Read the preview first, then start the demo.", 2, 7000);
        showSmartBorderPreviewPopup(stage);
        return;
      }
      if (stage === "waterBalance") {
        membraneFeedback("Read the osmosis preview first, then start the challenge.", 2, 7000);
        showOsmosisPreviewPopup();
        return;
      }
      runMembraneStageAnimation(stage);
    }

    function leakIfMembraneDamaged() {
      if (state.levelLost) return;
      const health = state.stats.membraneHealth ?? 100;
      if (health <= 0) {
        evaluateLossConditions();
        return;
      }
      if (health < 25 && Math.random() < .25) {
        adjustStats({ atp: -3, glucose: -2, oxygen: -2, waste: +4, transport: -2 });
        membraneFeedback("The damaged membrane is leaking. Repair it!", 4, 4300);
      }
    }
