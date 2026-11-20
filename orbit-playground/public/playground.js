import * as THREE from "three";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";

const panel = document.createElement("aside");
panel.id = "orbit-playground";
panel.className = "orbit-playground";
panel.innerHTML = `
  <h1>轨道预览</h1>
  <p class="sub">改参数立刻看画面，用系统录屏即可。不导出视频。</p>

  <fieldset>
    <legend>播放</legend>
    <div class="buttons">
      <button type="button" data-play>播放</button>
      <button type="button" data-pause>暂停</button>
    </div>
    <div class="row">
      <input data-scrub type="range" min="0" max="519" value="0" />
      <output data-time>0.0s</output>
    </div>
    <label class="check"><input data-loop type="checkbox" /> 循环</label>
  </fieldset>

  <fieldset>
    <legend>画幅</legend>
    <select data-aspect>
      <option value="fill" selected>铺满窗口</option>
      <option value="16x9">16:9</option>
      <option value="9x16">9:16 竖屏</option>
    </select>
  </fieldset>

  <fieldset>
    <legend>轨道</legend>
    <label>高度</label>
    <div class="row">
      <input data-altitude type="range" min="200" max="1500" step="1" value="917" />
      <output data-altitude-out>917 km</output>
    </div>
    <label>倾角</label>
    <div class="row">
      <input data-inclination type="range" min="0" max="90" step="0.1" value="41.1" />
      <output data-inclination-out>41.1°</output>
    </div>
    <label>升交点赤经</label>
    <div class="row">
      <input data-raan type="range" min="0" max="360" step="0.1" value="10.2" />
      <output data-raan-out>10.2°</output>
    </div>
  </fieldset>

  <fieldset>
    <legend>神舟 PNG</legend>
    <label class="file">上传精灵
      <input data-shenzhou-png type="file" accept="image/png,image/webp,image/jpeg" />
    </label>
    <img class="preview" data-shenzhou-preview alt="" hidden />
  </fieldset>

  <fieldset>
    <legend>天宫 PNG</legend>
    <label class="file">上传精灵
      <input data-tiangong-png type="file" accept="image/png,image/webp,image/jpeg" />
    </label>
    <img class="preview" data-tiangong-preview alt="" hidden />
  </fieldset>

  <fieldset>
    <legend>3D 模型（可选）</legend>
    <select data-model-target>
      <option value="shenzhou">挂到神舟</option>
      <option value="tiangong">挂到天宫</option>
    </select>
    <div class="buttons" style="margin-top:8px">
      <label class="file">上传 gltf/glb
        <input data-model-file type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" />
      </label>
      <button type="button" data-model-clear>去掉模型</button>
    </div>
  </fieldset>

  <p class="status" data-status>等待场景…</p>
`;
document.body.append(panel);

const els = {
  play: panel.querySelector("[data-play]"),
  pause: panel.querySelector("[data-pause]"),
  scrub: panel.querySelector("[data-scrub]"),
  time: panel.querySelector("[data-time]"),
  loop: panel.querySelector("[data-loop]"),
  aspect: panel.querySelector("[data-aspect]"),
  altitude: panel.querySelector("[data-altitude]"),
  altitudeOut: panel.querySelector("[data-altitude-out]"),
  inclination: panel.querySelector("[data-inclination]"),
  inclinationOut: panel.querySelector("[data-inclination-out]"),
  raan: panel.querySelector("[data-raan]"),
  raanOut: panel.querySelector("[data-raan-out]"),
  shenzhouPng: panel.querySelector("[data-shenzhou-png]"),
  shenzhouPreview: panel.querySelector("[data-shenzhou-preview]"),
  tiangongPng: panel.querySelector("[data-tiangong-png]"),
  tiangongPreview: panel.querySelector("[data-tiangong-preview]"),
  modelTarget: panel.querySelector("[data-model-target]"),
  modelFile: panel.querySelector("[data-model-file]"),
  modelClear: panel.querySelector("[data-model-clear]"),
  status: panel.querySelector("[data-status]"),
};

const gltfLoader = new GLTFLoader();
let draggingScrub = false;

function setStatus(text, tone = "") {
  els.status.textContent = text;
  els.status.dataset.tone = tone;
}

function host() {
  return window.__ORBIT_PLAYGROUND__;
}

function waitForHost() {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = () => {
      const api = host();
      if (api?.isReady?.()) {
        resolve(api);
        return;
      }
      if (api?.ready) {
        api.ready.then(() => resolve(api)).catch(reject);
        return;
      }
      if (performance.now() - started > 120000) {
        reject(new Error("场景加载超时"));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function syncScrub(api) {
  if (draggingScrub) {
    return;
  }
  const frame = api.getFrame();
  const fps = api.getFps();
  els.scrub.max = String(api.getTotalFrames() - 1);
  els.scrub.value = String(frame);
  els.time.textContent = `${(frame / fps).toFixed(1)}s`;
}

function applyOrbitFromInputs(api) {
  api.setOrbit({
    altitudeKm: Number(els.altitude.value),
    inclinationDeg: Number(els.inclination.value),
    raanDeg: Number(els.raan.value),
  });
  els.altitudeOut.textContent = `${els.altitude.value} km`;
  els.inclinationOut.textContent = `${Number(els.inclination.value).toFixed(1)}°`;
  els.raanOut.textContent = `${Number(els.raan.value).toFixed(1)}°`;
}

async function loadPng(api, name, file, preview) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    api.clearCraftModel(name);
    api.setCraftTexture(name, texture, {
      width: image.width,
      height: image.height,
    });
    preview.src = url;
    preview.hidden = false;
    setStatus(`${name === "tiangong" ? "天宫" : "神舟"} PNG 已替换`);
  };
  image.onerror = () => setStatus("图片无法读取", "error");
  image.src = url;
}

async function loadModel(api, name, file) {
  const url = URL.createObjectURL(file);
  try {
    const gltf = await gltfLoader.loadAsync(url);
    api.setCraftModel(name, gltf.scene);
    setStatus(`已把 ${file.name} 挂到${name === "tiangong" ? "天宫" : "神舟"}`);
  } catch (error) {
    setStatus(`模型加载失败：${error.message || error}`, "error");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const api = await waitForHost();
const params = api.getParams();
els.altitude.value = String(params.altitudeKm);
els.inclination.value = String(params.inclinationDeg.toFixed(1));
els.raan.value = String(params.raanDeg.toFixed(1));
applyOrbitFromInputs(api);
els.scrub.max = String(api.getTotalFrames() - 1);
syncScrub(api);
els.shenzhouPreview.src = "./textures/crafts/shenzhou.png";
els.shenzhouPreview.hidden = false;
els.tiangongPreview.src = "./textures/crafts/tiangong.png";
els.tiangongPreview.hidden = false;
setStatus("就绪。点播放，或拖轨道参数。");

els.play.addEventListener("click", () => {
  api.play();
  els.play.setAttribute("aria-pressed", "true");
});
els.pause.addEventListener("click", () => {
  api.pause();
  els.play.setAttribute("aria-pressed", "false");
});
els.loop.addEventListener("change", () => api.setLoop(els.loop.checked));
els.aspect.addEventListener("change", () => api.setAspect(els.aspect.value));
els.altitude.addEventListener("input", () => applyOrbitFromInputs(api));
els.inclination.addEventListener("input", () => applyOrbitFromInputs(api));
els.raan.addEventListener("input", () => applyOrbitFromInputs(api));
els.scrub.addEventListener("pointerdown", () => {
  draggingScrub = true;
});
els.scrub.addEventListener("pointerup", () => {
  draggingScrub = false;
});
els.scrub.addEventListener("input", () => {
  const frame = Number(els.scrub.value);
  api.seek(frame);
  els.time.textContent = `${(frame / api.getFps()).toFixed(1)}s`;
});
els.shenzhouPng.addEventListener("change", () => {
  const file = els.shenzhouPng.files?.[0];
  if (file) {
    void loadPng(api, "shenzhou", file, els.shenzhouPreview);
  }
});
els.tiangongPng.addEventListener("change", () => {
  const file = els.tiangongPng.files?.[0];
  if (file) {
    void loadPng(api, "tiangong", file, els.tiangongPreview);
  }
});
els.modelFile.addEventListener("change", () => {
  const file = els.modelFile.files?.[0];
  if (file) {
    void loadModel(api, els.modelTarget.value, file);
  }
});
els.modelClear.addEventListener("click", () => {
  api.clearCraftModel(els.modelTarget.value);
  setStatus("已去掉 3D 模型，改回 PNG");
});

const tick = () => {
  syncScrub(api);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
