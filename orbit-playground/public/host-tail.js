
const PLAYGROUND_EARTH_RADIUS_KM = 6371;
let playgroundLoop = false;

function playgroundResumeClock() {
  timelineStartTime = performance.now() - (currentRenderFrame / RENDER_FPS) * 1000;
}

function playgroundRefresh() {
  const playing = timelinePlaying;
  setRenderFrame(currentRenderFrame, { playing: false });
  if (playing) {
    hasIntroStarted = true;
    timelinePlaying = true;
    playgroundResumeClock();
  }
}

function installOrbitPlaygroundHost() {
  if (window.__ORBIT_PLAYGROUND_UI__) {
    camera.fov = 40;
    camera.updateProjectionMatrix();
    document.documentElement.classList.add("orbit-playground-on");
    document.body.classList.add("orbit-playground-on");
    document.body.dataset.aspect = document.body.dataset.aspect || "fill";
    resizeRenderers();
    renderScene();
  }

  window.__ORBIT_PLAYGROUND__ = {
    isReady: () => isSceneReady,
    ready: sceneReadyPromise,
    getFps: () => RENDER_FPS,
    getDurationMs: () => TIMELINE_DURATION_MS,
    getTotalFrames: () => RENDER_TIMELINE_TOTAL_FRAMES,
    getFrame: () => currentRenderFrame,
    isPlaying: () => timelinePlaying,
    play() {
      hasIntroStarted = true;
      if (currentRenderFrame >= RENDER_TIMELINE_TOTAL_FRAMES - 1) {
        currentRenderFrame = 0;
      }
      timelinePlaying = true;
      playgroundResumeClock();
    },
    pause() {
      timelinePlaying = false;
    },
    seek(frame) {
      const playing = timelinePlaying;
      setRenderFrame(frame, { playing: false });
      if (playing) {
        hasIntroStarted = true;
        timelinePlaying = true;
        playgroundResumeClock();
      }
    },
    setLoop(value) {
      playgroundLoop = Boolean(value);
    },
    getParams() {
      const orbit = mission.getOrbitParams?.() ?? route.mission;
      const altitudeKm = Math.round((Number(orbit.orbitRadius) - 1) * PLAYGROUND_EARTH_RADIUS_KM);
      return {
        inclinationDeg: Number(orbit.inclinationDeg),
        raanDeg: Number(orbit.raanDeg),
        orbitRadius: Number(orbit.orbitRadius),
        altitudeKm,
      };
    },
    setOrbit({ altitudeKm, inclinationDeg, raanDeg } = {}) {
      const next = {};
      if (Number.isFinite(Number(altitudeKm))) {
        next.orbitRadius = 1 + Number(altitudeKm) / PLAYGROUND_EARTH_RADIUS_KM;
      }
      if (Number.isFinite(Number(inclinationDeg))) {
        next.inclinationDeg = Number(inclinationDeg);
      }
      if (Number.isFinite(Number(raanDeg))) {
        next.raanDeg = Number(raanDeg);
      }
      mission.applyOrbitParams?.(next);
      playgroundRefresh();
    },
    setCraftTexture(name, texture, dimensions) {
      mission.setCraftTexture?.(name, texture, dimensions);
      playgroundRefresh();
    },
    setCraftModel(name, object) {
      mission.setCraftModel?.(name, object);
      playgroundRefresh();
    },
    clearCraftModel(name) {
      mission.clearCraftModel?.(name);
      playgroundRefresh();
    },
    setAspect(mode) {
      const next = mode === "9x16" || mode === "16x9" ? mode : "fill";
      document.body.dataset.aspect = next;
      camera.fov = next === "9x16" ? 77 : 40;
      camera.updateProjectionMatrix();
      handleWindowResize();
      playgroundRefresh();
    },
  };
}

installOrbitPlaygroundHost();
