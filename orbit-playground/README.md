# Orbit playground

本地浏览器预览：Three.js 地球 + 神舟/天宫任务动画。改倾角、轨道高度、换 PNG 精灵后立刻看到结果，用系统自带的屏幕录制即可，不必等 Puppeteer / ffmpeg。

不导出 GIF / MP4。

## 启动

需要本机已有带神舟任务的 `threejs-earth` 目录（含 `textures/` 地球贴图）。默认路径：

```text
/tmp/threejs-earth-workspace/threejs-earth
```

```bash
cd orbit-playground
python3 serve.py
```

或：

```bash
npm start
```

浏览器打开终端打印的地址，一般是：

```text
http://127.0.0.1:8787/
```

不要用 `file://`。地球贴图从 CDN 加载 Three.js，首次打开需要联网。

### 常用参数

```bash
python3 serve.py --port 8787 \
  --earth /tmp/threejs-earth-workspace/threejs-earth \
  --sprites /cursor/stores/self/media
```

| 参数 | 环境变量 | 含义 |
| --- | --- | --- |
| `--earth` | `THREEJS_EARTH_DIR` | threejs-earth 根目录（纹理 + 场景） |
| `--sprites` | `ORBIT_SPRITES_DIR` | 默认神舟/天宫 PNG，缺省则用 earth 里的 `textures/crafts/` |
| `--port` | `ORBIT_PLAYGROUND_PORT` | 端口，默认 `8787` |
| `--host` | `ORBIT_PLAYGROUND_HOST` | 监听地址，默认 `127.0.0.1` |

## 面板

- **播放 / 暂停 / 进度条**：现有任务时间线（酒泉起飞 → 1.5 圈追及 → 拉近对接）
- **循环**：到片尾后从头再放
- **画幅**：铺满 / 16:9 / 9:16（方便对着画面录屏）
- **轨道高度、倾角、升交点赤经**：拖动即生效
- **PNG 精灵**：分别上传神舟、天宫；默认用照片抠图
- **gltf / glb**：可选，加载后挂到对应飞船上（失败则仍用 PNG）

## 依赖

- Python 3（只用来起静态 HTTP 服务）
- 可选 Node：`npm start` 同样调用 `python3 serve.py`
- 本地 `threejs-earth` 资源目录
