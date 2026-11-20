    getOrbitParams() {
      return {
        inclinationDeg: missionConfig.inclinationDeg,
        raanDeg: missionConfig.raanDeg,
        orbitRadius: missionConfig.orbitRadius,
      };
    },
    applyOrbitParams(next = {}) {
      if (Number.isFinite(Number(next.inclinationDeg))) {
        missionConfig.inclinationDeg = Number(next.inclinationDeg);
      }
      if (Number.isFinite(Number(next.raanDeg))) {
        missionConfig.raanDeg = Number(next.raanDeg);
      }
      if (Number.isFinite(Number(next.orbitRadius))) {
        missionConfig.orbitRadius = Number(next.orbitRadius);
      }
      rebuildOrbitVisuals();
      if (lastState) {
        updateCrafts(lastState);
      }
      return this.getOrbitParams();
    },
    setCraftTexture(name, texture, dimensions = {}) {
      const craft = name === "tiangong" ? tiangong : shenzhou;
      const billboard = craft.userData.billboard;
      if (!billboard) {
        return;
      }
      if (craft.userData.model) {
        craft.remove(craft.userData.model);
        craft.userData.model = null;
      }
      billboard.visible = true;
      billboard.material.map = texture;
      billboard.material.needsUpdate = true;
      const imageWidth = Number(dimensions.width);
      const imageHeight = Number(dimensions.height);
      if (imageWidth > 0 && imageHeight > 0) {
        const height = craft.userData.baseHeight || 0.046;
        craft.userData.baseHeight = height;
        craft.userData.baseWidth = height * (imageWidth / imageHeight);
      }
      scaleBillboard(craft, lastState);
    },
    setCraftModel(name, object) {
      const craft = name === "tiangong" ? tiangong : shenzhou;
      if (!object) {
        return;
      }
      if (craft.userData.model) {
        craft.remove(craft.userData.model);
      }
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
      object.scale.multiplyScalar(0.09 / maxDim);
      object.position.set(0, 0, 0);
      craft.add(object);
      craft.userData.model = object;
      if (craft.userData.billboard) {
        craft.userData.billboard.visible = false;
      }
    },
    clearCraftModel(name) {
      const craft = name === "tiangong" ? tiangong : shenzhou;
      if (craft.userData.model) {
        craft.remove(craft.userData.model);
        craft.userData.model = null;
      }
      if (craft.userData.billboard) {
        craft.userData.billboard.visible = true;
      }
    },
