#!/usr/bin/env python3
"""Serve the Shenzhou/Tiangong Three.js Earth scene with a live playground panel."""

from __future__ import annotations

import argparse
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
DEFAULT_EARTH = Path("/tmp/threejs-earth-workspace/threejs-earth")
DEFAULT_MEDIA_SPRITES = Path("/cursor/stores/self/media")
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787

SPRITE_NAMES = {"shenzhou.png", "tiangong.png"}

START_INTRO_NEEDLE = """function startIntroAfterFirstReadyFrame() {
  if (renderOptions.isExportMode) {
    setRenderFrame(0, { playing: false });
    return;
  }"""

START_INTRO_PATCH = """function startIntroAfterFirstReadyFrame() {
  if (renderOptions.isExportMode || window.__ORBIT_PLAYGROUND_UI__) {
    hasIntroStarted = true;
    setRenderFrame(0, { playing: false });
    return;
  }"""

LOOP_NEEDLE = """  if (elapsedMs >= TIMELINE_DURATION_MS) {
    timelinePlaying = false;
  }"""

RENDER_SCENE_NEEDLE = """function renderScene() {
  lighting.update();
"""

RENDER_SCENE_PATCH = """function renderScene() {
  lighting.update();
  mission.alignHeadings?.(camera);
"""

LOOP_PATCH = """  if (elapsedMs >= TIMELINE_DURATION_MS) {
    if (typeof playgroundLoop !== "undefined" && playgroundLoop) {
      timelineStartTime = now;
      currentRenderFrame = 0;
      return 0;
    }
    timelinePlaying = false;
  }"""

CLOSEUP_CAMERA_NEEDLE = """  const lookBlend =
    timeMs <= CAMERA_INTRO_DURATION_MS
      ? 0.22 + introProgress * 0.18
      : THREE.MathUtils.lerp(0.4, 0.82, Math.min(1, chaseProgress * 1.1 + closeup * 0.3));
  cameraLookTarget.copy(cameraGlobeCenter).lerp(cameraFocusLocal, lookBlend);

  const offset = cameraFocusLocal.clone().sub(cameraGlobeCenter);
  if (offset.lengthSq() < 0.000001) {
    offset.set(0.15, 0.35, 1);
  }
  offset.normalize();
  const cameraOffset = offset.clone();
  cameraOffset.y += 0.18;"""

CLOSEUP_CAMERA_PATCH = """  const closeupEase = easeInOutCubic(closeup);
  const chaseLook = THREE.MathUtils.lerp(
    0.4,
    0.82,
    Math.min(1, chaseProgress * 1.1)
  );
  const lookBlend =
    timeMs <= CAMERA_INTRO_DURATION_MS
      ? 0.22 + introProgress * 0.18
      : THREE.MathUtils.lerp(chaseLook, 1, closeupEase);
  cameraLookTarget.copy(cameraGlobeCenter).lerp(cameraFocusLocal, lookBlend);

  const offset = cameraFocusLocal.clone().sub(cameraGlobeCenter);
  if (offset.lengthSq() < 0.000001) {
    offset.set(0.15, 0.35, 1);
  }
  offset.normalize();
  const cameraOffset = offset.clone();
  cameraOffset.y += THREE.MathUtils.lerp(0.18, 0, closeupEase);"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Orbit playground local server")
    parser.add_argument("--earth", default=os.environ.get("THREEJS_EARTH_DIR", str(DEFAULT_EARTH)))
    parser.add_argument("--sprites", default=os.environ.get("ORBIT_SPRITES_DIR", ""))
    parser.add_argument("--host", default=os.environ.get("ORBIT_PLAYGROUND_HOST", DEFAULT_HOST))
    parser.add_argument("--port", type=int, default=int(os.environ.get("ORBIT_PLAYGROUND_PORT", DEFAULT_PORT)))
    return parser.parse_args()


def resolve_sprites_dir(explicit: str, earth: Path) -> Path | None:
    candidates = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    candidates.append(DEFAULT_MEDIA_SPRITES)
    candidates.append(earth / "textures" / "crafts")
    for path in candidates:
        if (path / "shenzhou.png").is_file() and (path / "tiangong.png").is_file():
            return path
    return None


def inject_html(html: str) -> str:
    if "__ORBIT_PLAYGROUND_UI__" in html:
        return html
    head_snippet = """    <link rel="stylesheet" href="/playground/playground.css" />
    <script>
      window.__ORBIT_PLAYGROUND_UI__ = true;
      document.documentElement.classList.add("orbit-playground-on");
    </script>
"""
    body_snippet = """    <script type="module" src="/playground/playground.js"></script>
"""
    if "</head>" in html:
        html = html.replace("</head>", head_snippet + "</head>", 1)
    if "</body>" in html:
        html = html.replace("</body>", body_snippet + "</body>", 1)
    else:
        html += body_snippet
    return html


def patch_index_js(source: str, host_tail: str) -> str:
    text = source
    if START_INTRO_NEEDLE in text:
        text = text.replace(START_INTRO_NEEDLE, START_INTRO_PATCH, 1)
    if LOOP_NEEDLE in text:
        text = text.replace(LOOP_NEEDLE, LOOP_PATCH, 1)
    if "alignHeadings" not in text and RENDER_SCENE_NEEDLE in text:
        text = text.replace(RENDER_SCENE_NEEDLE, RENDER_SCENE_PATCH, 1)
    if CLOSEUP_CAMERA_NEEDLE in text:
        text = text.replace(CLOSEUP_CAMERA_NEEDLE, CLOSEUP_CAMERA_PATCH, 1)
    if "installOrbitPlaygroundHost" not in text:
        text = text.rstrip() + "\n" + host_tail
    return text


def patch_mission_js(source: str, rebuild: str, methods: str) -> str:
    text = source
    text = text.replace(
        "  const orbitRing = createOrbitRing(",
        "  let orbitRing = createOrbitRing(",
        1,
    )
    text = text.replace(
        "  const flownPath = createFlownOrbitPath(",
        "  let flownPath = createFlownOrbitPath(",
        1,
    )
    if "function rebuildOrbitVisuals" not in text:
        marker = "  return {\n    group,"
        if marker not in text:
            raise RuntimeError("Could not find missionOrbit return block to patch.")
        text = text.replace(marker, rebuild + "  return {\n    group,", 1)
    if "applyOrbitParams(" not in text:
        marker = "    syncBillboards() {"
        if marker not in text:
            raise RuntimeError("Could not find syncBillboards to patch.")
        text = text.replace(marker, methods.rstrip() + "\n    syncBillboards() {", 1)
    return text


class PlaygroundHandler(BaseHTTPRequestHandler):
    earth_dir: Path
    sprites_dir: Path | None
    host_tail: str
    mission_rebuild: str
    mission_methods: str

    def log_message(self, format: str, *args: object) -> None:
        print(f"[playground] {self.address_string()} {args[0]}")

    def _send(self, body: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _not_found(self, path: str) -> None:
        self._send(f"Not found: {path}\n".encode(), "text/plain; charset=utf-8", 404)

    def resolve_file(self, rel: str) -> Path | None:
        if rel.startswith("playground/"):
            candidate = PUBLIC / rel.removeprefix("playground/")
            return candidate if candidate.is_file() else None

        if rel == "src/cz2fLaunch.js":
            overlay = PUBLIC / "cz2fLaunch.js"
            if overlay.is_file():
                return overlay

        name = Path(rel).name
        if (
            self.sprites_dir
            and name in SPRITE_NAMES
            and (rel.startswith("textures/crafts/") or rel.startswith("playground/sprites/"))
        ):
            candidate = self.sprites_dir / name
            if candidate.is_file():
                return candidate

        candidate = self.earth_dir / rel
        if candidate.is_file():
            return candidate
        return None

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        rel = unquote(parsed.path).lstrip("/")
        if rel == "" or rel.endswith("/"):
            rel = "index.html"

        if rel == "index.html":
            source = (self.earth_dir / "index.html").read_text(encoding="utf-8")
            html = inject_html(source)
            self._send(html.encode("utf-8"), "text/html; charset=utf-8")
            return

        if rel == "index.js":
            source = (self.earth_dir / "index.js").read_text(encoding="utf-8")
            text = patch_index_js(source, self.host_tail)
            self._send(text.encode("utf-8"), "text/javascript; charset=utf-8")
            return

        if rel == "src/missionOrbit.js":
            source = (self.earth_dir / "src/missionOrbit.js").read_text(encoding="utf-8")
            text = patch_mission_js(source, self.mission_rebuild, self.mission_methods)
            self._send(text.encode("utf-8"), "text/javascript; charset=utf-8")
            return

        path = self.resolve_file(rel)
        if path is None:
            self._not_found(rel)
            return

        data = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        elif path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif path.suffix == ".html":
            content_type = "text/html; charset=utf-8"
        self._send(data, content_type)


def main() -> int:
    args = parse_args()
    earth = Path(args.earth).expanduser().resolve()
    if not (earth / "index.html").is_file() or not (earth / "index.js").is_file():
        raise SystemExit(
            f"threejs-earth not found at {earth}. Pass --earth /path/to/threejs-earth"
        )

    sprites = resolve_sprites_dir(args.sprites, earth)
    host_tail = (PUBLIC / "host-tail.js").read_text(encoding="utf-8")
    mission_rebuild = (PUBLIC / "mission-rebuild.js").read_text(encoding="utf-8")
    mission_methods = (PUBLIC / "mission-methods.js").read_text(encoding="utf-8")

    PlaygroundHandler.earth_dir = earth
    PlaygroundHandler.sprites_dir = sprites
    PlaygroundHandler.host_tail = host_tail
    PlaygroundHandler.mission_rebuild = mission_rebuild
    PlaygroundHandler.mission_methods = mission_methods

    server = ThreadingHTTPServer((args.host, args.port), PlaygroundHandler)
    url = f"http://{args.host}:{args.port}/"
    print(f"Orbit playground")
    print(f"  Earth:   {earth}")
    print(f"  Sprites: {sprites or '(none found, using earth textures if present)'}")
    print(f"  Open:    {url}")
    print("  Stop with Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
