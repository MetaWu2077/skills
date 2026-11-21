import * as THREE from "three";

import { latLonToVector3 } from "./geo.js";

export const LAUNCH_DURATION_MS = 36000;
export const LAUNCH_END_DISTANCE = 3.15;
export const LAUNCH_END_LOOK_BLEND = 0.22;
export const LAUNCH_END_Y_BIAS = 0.18;

export const LAUNCH_EVENTS = [
  {
    id: "liftoff",
    start: 0,
    end: 0.1,
    clock0: 0,
    clock1: 18,
    kicker: "长征二号F · 酒泉",
    title: "点火起飞",
    status: "火箭垂直离开发射台，地平线保持水平",
  },
  {
    id: "pitch",
    start: 0.1,
    end: 0.2,
    clock0: 25,
    clock1: 90,
    kicker: "长征二号F · 程序转弯",
    title: "程序转弯",
    status: "从垂直逐渐低头，转入入轨方向",
  },
  {
    id: "boosters",
    start: 0.2,
    end: 0.34,
    clock0: 150,
    clock1: 158,
    kicker: "长征二号F · T+2 min 35 s",
    title: "助推器分离",
    status: "四枚助推器向外抛离，芯级继续爬升",
  },
  {
    id: "stage",
    start: 0.34,
    end: 0.48,
    clock0: 160,
    clock1: 172,
    kicker: "长征二号F · T+2 min 40 s",
    title: "一二级分离",
    status: "一级芯级脱落，二级点火继续加速",
  },
  {
    id: "fairing",
    start: 0.48,
    end: 0.62,
    clock0: 198,
    clock1: 214,
    kicker: "长征二号F · T+3 min 20 s",
    title: "整流罩抛离",
    status: "整流罩对开抛掉，飞船露出来",
  },
  {
    id: "cutoff",
    start: 0.62,
    end: 0.73,
    clock0: 470,
    clock1: 486,
    kicker: "长征二号F · T+7 min 50 s",
    title: "二级关机",
    status: "二级主机关机，进入滑行段",
  },
  {
    id: "sep",
    start: 0.73,
    end: 0.85,
    clock0: 490,
    clock1: 508,
    kicker: "长征二号F · T+8 min 10 s",
    title: "飞船分离",
    status: "神舟24号离开二级火箭",
  },
  {
    id: "arrays",
    start: 0.85,
    end: 1,
    clock0: 520,
    clock1: 560,
    kicker: "长征二号F · T+8 min 40 s",
    title: "太阳翼展开",
    status: "太阳翼展开，镜头拉远接入在轨段",
  },
];

const WHITE = 0xf3efe6;
const OFFWHITE = 0xddd6c8;
const RED = 0xb42318;
const DARK = 0x2a2e34;
const NOZZLE = 0x14171c;
const METAL = 0x8d949c;
const GREEN = 0x5a6b4a;
const PANEL = 0x2a4d9c;
const FLAME_CORE = 0xfff2b0;
const FLAME_OUTER = 0xff6a1a;

const Y_UP = new THREE.Vector3(0, 1, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function mat(color, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

function cyl(radiusTop, radiusBottom, height, color, segments = 20) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    mat(color)
  );
  mesh.castShadow = false;
  return mesh;
}

function formatTPlus(seconds) {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const rest = Math.floor(clamped % 60);
  return `T+${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function launchEventAt(progress) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return (
    LAUNCH_EVENTS.find((event) => t < event.end) ||
    LAUNCH_EVENTS[LAUNCH_EVENTS.length - 1]
  );
}

export function launchHud(progress) {
  const event = launchEventAt(progress);
  const local = THREE.MathUtils.clamp(
    (progress - event.start) / Math.max(0.0001, event.end - event.start),
    0,
    1
  );
  const clock = THREE.MathUtils.lerp(event.clock0, event.clock1, local);
  return {
    kicker: event.kicker,
    title: event.title,
    orbits: formatTPlus(clock),
    orbitsSuffix: event.id === "arrays" ? "接入在轨剖面" : "发射段 · 长征二号F",
    meta: event.status,
    status: event.status,
    progress: progress * 0.18,
    eventId: event.id,
  };
}

function eventLocal(progress, id) {
  const event = LAUNCH_EVENTS.find((item) => item.id === id);
  if (!event) {
    return 0;
  }
  return THREE.MathUtils.clamp(
    (progress - event.start) / Math.max(0.0001, event.end - event.start),
    0,
    1
  );
}

function sepAmount(local) {
  return THREE.MathUtils.smoothstep(local, 0.06, 0.58);
}

export function launchOrbitBlend(progress) {
  return THREE.MathUtils.smootherstep(THREE.MathUtils.clamp(progress, 0, 1), 0.58, 1);
}

export function createCz2fLaunch({
  padLatitude = 40.958,
  padLongitude = 100.291,
  insertionPoint,
} = {}) {
  const group = new THREE.Group();
  group.name = "CZ-2F launch";

  const S = 0.07;
  const pad = latLonToVector3(padLatitude, padLongitude, 1);
  const padNormal = pad.clone().normalize();
  const insertion =
    insertionPoint?.clone?.() ||
    latLonToVector3(padLatitude + 8, padLongitude + 6, 1.04);
  const pitchDir = insertion.clone().sub(pad);
  pitchDir.addScaledVector(padNormal, -pitchDir.dot(padNormal));
  if (pitchDir.lengthSq() < 1e-8) {
    pitchDir.set(0, 0, 1);
  }
  pitchDir.normalize();

  const profileSide = new THREE.Vector3().crossVectors(padNormal, pitchDir);
  if (profileSide.lengthSq() < 1e-8) {
    profileSide.crossVectors(padNormal, WORLD_UP);
  }
  if (profileSide.lengthSq() < 1e-8) {
    profileSide.set(1, 0, 0);
  }
  profileSide.normalize();

  const padDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.018, 40),
    new THREE.MeshBasicMaterial({
      color: 0x6a737c,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  padDisc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), padNormal);
  padDisc.position.copy(padNormal).multiplyScalar(1.0015);
  padDisc.renderOrder = 6;
  group.add(padDisc);

  function makeBooster() {
    const booster = new THREE.Group();
    const body = cyl(0.045 * S, 0.048 * S, 0.3 * S, WHITE);
    body.position.y = 0.16 * S;
    const stripe = cyl(0.047 * S, 0.047 * S, 0.028 * S, RED);
    stripe.position.y = 0.22 * S;
    const nozzle = cyl(0.028 * S, 0.038 * S, 0.05 * S, NOZZLE);
    nozzle.position.y = -0.01 * S;
    booster.add(body, stripe, nozzle);
    return booster;
  }

  const core = new THREE.Group();
  core.name = "first-stage";
  const coreBody = cyl(0.078 * S, 0.082 * S, 0.4 * S, WHITE);
  coreBody.position.y = 0.2 * S;
  const coreBand = cyl(0.083 * S, 0.083 * S, 0.03 * S, RED);
  coreBand.position.y = 0.32 * S;
  const coreNozzle = cyl(0.05 * S, 0.07 * S, 0.07 * S, NOZZLE);
  coreNozzle.position.y = -0.02 * S;
  core.add(coreBody, coreBand, coreNozzle);

  const boosters = [0, 1, 2, 3].map((index) => {
    const booster = makeBooster();
    const angle = (index * Math.PI) / 2;
    booster.position.set(
      Math.cos(angle) * 0.125 * S,
      0,
      Math.sin(angle) * 0.125 * S
    );
    return booster;
  });

  const second = new THREE.Group();
  second.name = "second-stage";
  const secondBody = cyl(0.074 * S, 0.078 * S, 0.26 * S, OFFWHITE);
  secondBody.position.y = 0.53 * S;
  const secondNozzle = cyl(0.03 * S, 0.048 * S, 0.05 * S, NOZZLE);
  secondNozzle.position.y = 0.38 * S;
  second.add(secondBody, secondNozzle);

  const fairingGeo = new THREE.CylinderGeometry(
    0.04 * S,
    0.08 * S,
    0.22 * S,
    18,
    1,
    false,
    0,
    Math.PI
  );
  const fairingL = new THREE.Mesh(fairingGeo, mat(WHITE));
  const fairingR = new THREE.Mesh(fairingGeo.clone(), mat(WHITE));
  fairingL.position.y = 0.76 * S;
  fairingR.position.y = 0.76 * S;
  fairingR.rotation.y = Math.PI;
  const fairingCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.04 * S, 0.06 * S, 16),
    mat(WHITE)
  );
  fairingCap.position.y = 0.9 * S;

  const tower = new THREE.Group();
  tower.name = "escape-tower";
  const towerMast = cyl(0.012 * S, 0.02 * S, 0.16 * S, DARK, 10);
  towerMast.position.y = 1.0 * S;
  const towerTip = cyl(0.004 * S, 0.01 * S, 0.06 * S, METAL, 8);
  towerTip.position.y = 1.1 * S;
  tower.add(towerMast, towerTip);
  for (let index = 0; index < 4; index += 1) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.004 * S, 0.05 * S, 0.028 * S),
      mat(DARK)
    );
    const angle = (index * Math.PI) / 2;
    fin.position.set(
      Math.cos(angle) * 0.022 * S,
      0.96 * S,
      Math.sin(angle) * 0.022 * S
    );
    tower.add(fin);
  }

  const shenzhouMini = new THREE.Group();
  shenzhouMini.name = "shenzhou-mini";
  const orbital = cyl(0.036 * S, 0.036 * S, 0.055 * S, OFFWHITE, 16);
  orbital.position.y = 0.8 * S;
  const returnCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.034 * S, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(0xe8e4dc)
  );
  returnCap.position.y = 0.77 * S;
  const service = cyl(0.038 * S, 0.04 * S, 0.05 * S, GREEN, 16);
  service.position.y = 0.73 * S;
  const panelL = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * S, 0.004 * S, 0.048 * S),
    mat(PANEL)
  );
  const panelR = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * S, 0.004 * S, 0.048 * S),
    mat(PANEL)
  );
  panelL.position.set(-0.04 * S, 0.73 * S, 0);
  panelR.position.set(0.04 * S, 0.73 * S, 0);
  shenzhouMini.add(orbital, returnCap, service, panelL, panelR);

  const flame1 = new THREE.Mesh(
    new THREE.ConeGeometry(0.055 * S, 0.16 * S, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: FLAME_OUTER,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flame1.rotation.x = Math.PI;
  flame1.position.y = -0.09 * S;
  const flame1Core = new THREE.Mesh(
    new THREE.ConeGeometry(0.022 * S, 0.12 * S, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: FLAME_CORE,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flame1Core.rotation.x = Math.PI;
  flame1Core.position.y = -0.06 * S;
  core.add(flame1, flame1Core);

  const flame2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.028 * S, 0.09 * S, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: FLAME_OUTER,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flame2.rotation.x = Math.PI;
  flame2.position.y = 0.33 * S;
  second.add(flame2);

  const vehicle = new THREE.Group();
  vehicle.name = "cz2f-vehicle";
  vehicle.add(core, second, fairingL, fairingR, fairingCap, tower, shenzhouMini, ...boosters);
  group.add(vehicle);

  const cameraLocal = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    up: new THREE.Vector3(),
  };
  const axisDir = new THREE.Vector3();
  const vehiclePos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  let orbitBlend = 0;

  const rest = {
    core: core.position.clone(),
    second: second.position.clone(),
    fairingL: fairingL.position.clone(),
    fairingR: fairingR.position.clone(),
    fairingCap: fairingCap.position.clone(),
    tower: tower.position.clone(),
    shenzhou: shenzhouMini.position.clone(),
    boosters: boosters.map((booster) => booster.position.clone()),
  };

  function resetPose() {
    core.position.copy(rest.core);
    core.rotation.set(0, 0, 0);
    second.position.copy(rest.second);
    second.rotation.set(0, 0, 0);
    fairingL.position.copy(rest.fairingL);
    fairingL.rotation.set(0, 0, 0);
    fairingR.position.copy(rest.fairingR);
    fairingR.rotation.set(0, Math.PI, 0);
    fairingCap.position.copy(rest.fairingCap);
    fairingCap.rotation.set(0, 0, 0);
    tower.position.copy(rest.tower);
    tower.rotation.set(0, 0, 0);
    shenzhouMini.position.copy(rest.shenzhou);
    shenzhouMini.rotation.set(0, 0, 0);
    boosters.forEach((booster, index) => {
      booster.position.copy(rest.boosters[index]);
      booster.rotation.set(0, 0, 0);
      booster.visible = true;
    });
    core.visible = true;
    second.visible = true;
    fairingL.visible = true;
    fairingR.visible = true;
    fairingCap.visible = true;
    tower.visible = true;
    shenzhouMini.visible = true;
    flame1.visible = true;
    flame1Core.visible = true;
    flame2.visible = false;
    panelL.rotation.z = 1.32;
    panelR.rotation.z = -1.32;
    panelL.scale.set(0.18, 1, 1);
    panelR.scale.set(0.18, 1, 1);
  }

  function update(progress) {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    resetPose();

    const climb = THREE.MathUtils.smoothstep(t, 0.018, 1);
    const altitude = 1.0034 + 0.108 * climb ** 1.12;
    const pitch = THREE.MathUtils.smootherstep(t, 0.1, 0.72) * 1.22;
    axisDir
      .copy(padNormal)
      .multiplyScalar(Math.cos(pitch))
      .addScaledVector(pitchDir, Math.sin(pitch))
      .normalize();
    vehiclePos.copy(axisDir).multiplyScalar(altitude);
    quat.setFromUnitVectors(Y_UP, axisDir);
    vehicle.position.copy(vehiclePos);
    vehicle.quaternion.copy(quat);

    const towerSep = THREE.MathUtils.smoothstep(t, 0.14, 0.2);
    const boosterSep = sepAmount(eventLocal(t, "boosters"));
    const stageSep = sepAmount(eventLocal(t, "stage"));
    const fairingSep = sepAmount(eventLocal(t, "fairing"));
    const cutoff = eventLocal(t, "cutoff");
    const craftSep = sepAmount(eventLocal(t, "sep"));
    const arrays = THREE.MathUtils.smoothstep(eventLocal(t, "arrays"), 0.05, 0.78);

    tower.position.copy(rest.tower).add(new THREE.Vector3(0, towerSep * 1.8 * S, 0));
    tower.visible = eventLocal(t, "boosters") < 0.15;

    boosters.forEach((booster, index) => {
      const angle = (index * Math.PI) / 2;
      booster.position.copy(rest.boosters[index]).add(
        new THREE.Vector3(
          Math.cos(angle) * boosterSep * 1.35 * S,
          -boosterSep * 0.45 * S,
          Math.sin(angle) * boosterSep * 1.35 * S
        )
      );
      booster.rotation.z = Math.cos(angle) * boosterSep * 0.45;
      booster.visible = eventLocal(t, "stage") < 0.25;
    });

    core.position.copy(rest.core).add(new THREE.Vector3(0, -stageSep * 2.35 * S, 0.2 * S * stageSep));
    core.rotation.z = -stageSep * 0.55;
    core.rotation.x = stageSep * 0.18;
    flame1.visible = stageSep < 0.42;
    flame1Core.visible = flame1.visible;
    flame2.visible = stageSep > 0.18 && cutoff < 0.35;
    const flicker = 0.88 + Math.sin(t * 70) * 0.12;
    flame1.scale.set(flicker, 1 + (1 - flicker) * 0.4, flicker);
    flame2.scale.set(1, 0.85 + flicker * 0.3, 1);
    if (cutoff > 0.35) {
      flame2.visible = false;
    }

    fairingL.position.copy(rest.fairingL).add(new THREE.Vector3(-fairingSep * 1.2 * S, fairingSep * 0.22 * S, 0));
    fairingL.rotation.z = fairingSep * 1.05;
    fairingR.position.copy(rest.fairingR).add(new THREE.Vector3(fairingSep * 1.2 * S, fairingSep * 0.22 * S, 0));
    fairingR.rotation.z = -fairingSep * 1.05;
    fairingCap.position.copy(rest.fairingCap).add(new THREE.Vector3(0, fairingSep * 0.95 * S, fairingSep * 0.25 * S));
    const hideFairing = eventLocal(t, "cutoff") > 0.08;
    fairingL.visible = !hideFairing;
    fairingR.visible = !hideFairing;
    fairingCap.visible = !hideFairing;

    shenzhouMini.position.copy(rest.shenzhou).add(new THREE.Vector3(0, craftSep * 1.9 * S, 0));
    second.position.copy(rest.second).add(new THREE.Vector3(0.12 * S * craftSep, -craftSep * 1.5 * S, 0));
    second.rotation.z = craftSep * 0.4;
    if (eventLocal(t, "arrays") > 0.35) {
      core.visible = false;
      second.visible = false;
    }

    panelL.rotation.z = THREE.MathUtils.lerp(1.32, 0, arrays);
    panelR.rotation.z = THREE.MathUtils.lerp(-1.32, 0, arrays);
    panelL.scale.set(THREE.MathUtils.lerp(0.18, 1, arrays), 1, 1);
    panelR.scale.set(THREE.MathUtils.lerp(0.18, 1, arrays), 1, 1);

    const fade = 1 - THREE.MathUtils.smoothstep(t, 0.9, 1);
    group.visible = fade > 0.02;
    padDisc.visible = fade > 0.35;

    const follow = vehiclePos.clone();
    if (craftSep > 0.05) {
      follow.addScaledVector(axisDir, craftSep * 0.04);
    }
    const camDist = THREE.MathUtils.lerp(0.108, 0.92, THREE.MathUtils.smootherstep(t, 0, 0.72));
    cameraLocal.up.copy(padNormal);
    cameraLocal.target.copy(follow);
    cameraLocal.position
      .copy(follow)
      .addScaledVector(profileSide, camDist)
      .addScaledVector(padNormal, THREE.MathUtils.lerp(0.006, 0.04, t));

    orbitBlend = launchOrbitBlend(t);
  }

  resetPose();
  update(0);

  return {
    group,
    update,
    getFocusPoint() {
      return vehicle.position.clone();
    },
    getCameraLocal() {
      return cameraLocal;
    },
    getOrbitBlend() {
      return orbitBlend;
    },
    setVisible(visible) {
      group.visible = Boolean(visible);
    },
  };
}
