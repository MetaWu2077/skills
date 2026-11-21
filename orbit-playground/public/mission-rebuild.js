  function rebuildOrbitVisuals() {
    const nextRing = createOrbitRing({
      inclinationDeg: missionConfig.inclinationDeg,
      raanDeg: missionConfig.raanDeg,
      radius: missionConfig.orbitRadius,
      color: 0xb7dcff,
      opacity: 0.3,
    });
    nextRing.visible = orbitRing.visible;
    nextRing.material.opacity = orbitRing.material.opacity;
    group.remove(orbitRing);
    orbitRing.geometry.dispose();
    orbitRing.material.dispose();
    group.add(nextRing);
    orbitRing = nextRing;

    const flownDeg = lastState
      ? Math.max(0, lastState.shenzhouU - missionConfig.insertionArgumentDeg)
      : 0;
    const nextFlown = createFlownOrbitPath({
      insertionArgumentDeg: missionConfig.insertionArgumentDeg,
      inclinationDeg: missionConfig.inclinationDeg,
      raanDeg: missionConfig.raanDeg,
      radius: missionConfig.orbitRadius,
      color: missionConfig.shenzhouColor,
      revs: totalRevs + 0.35,
    });
    nextFlown.mesh.visible = flownPath.mesh.visible;
    group.remove(flownPath.mesh);
    flownPath.mesh.geometry.dispose();
    flownPath.mesh.material.dispose();
    group.add(nextFlown.mesh);
    flownPath = nextFlown;
    flownPath.setFlownDegrees(flownDeg);
  }

