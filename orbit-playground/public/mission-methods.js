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
    alignHeadings(camera) {
      if (!camera || !tiangong?.visible) {
        return;
      }
      const uDeg = lastState?.tiangongU;
      if (!Number.isFinite(Number(uDeg))) {
        return;
      }
      const deltaDeg = 0.75;
      const before = orbitPosition(
        uDeg - deltaDeg,
        missionConfig.inclinationDeg,
        missionConfig.raanDeg,
        missionConfig.orbitRadius
      );
      const after = orbitPosition(
        uDeg + deltaDeg,
        missionConfig.inclinationDeg,
        missionConfig.raanDeg,
        missionConfig.orbitRadius
      );
      const tangentLocal = after.sub(before);
      if (tangentLocal.lengthSq() < 1e-12) {
        return;
      }
      tangentLocal.normalize();
      const parent = tiangong.parent;
      parent.updateWorldMatrix(true, false);
      const origin = tiangong.position.clone();
      const tip = origin.clone().add(tangentLocal);
      parent.localToWorld(origin);
      parent.localToWorld(tip);
      const tangentWorld = tip.sub(origin);
      if (tangentWorld.lengthSq() < 1e-12) {
        return;
      }
      tangentWorld.normalize();
      camera.updateMatrixWorld();
      const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const camBack = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
      const projected = tangentWorld
        .clone()
        .addScaledVector(camBack, -tangentWorld.dot(camBack));
      if (projected.lengthSq() < 1e-12) {
        return;
      }
      projected.normalize();
      const heading = Math.atan2(projected.dot(camRight), projected.dot(camUp));
      const billboard = tiangong.userData.billboard;
      if (billboard?.isSprite && billboard.material) {
        billboard.material.rotation = heading;
      }
      if (tiangong.userData.model) {
        const radial = tiangong.getWorldPosition(new THREE.Vector3()).normalize();
        const yAxis = radial
          .clone()
          .addScaledVector(tangentWorld, -radial.dot(tangentWorld));
        if (yAxis.lengthSq() < 1e-12) {
          yAxis.set(0, 1, 0);
        }
        yAxis.normalize();
        const zAxis = new THREE.Vector3().crossVectors(tangentWorld, yAxis).normalize();
        yAxis.crossVectors(zAxis, tangentWorld).normalize();
        const basis = new THREE.Matrix4().makeBasis(tangentWorld, yAxis, zAxis);
        const parentInverse = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        tiangong.quaternion.setFromRotationMatrix(parentInverse.multiply(basis));
      }
    },
