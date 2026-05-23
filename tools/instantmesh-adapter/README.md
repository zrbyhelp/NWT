# InstantMesh Adapter

这个独立服务把官方 Gradio InstantMesh 包装为 NWT 可调用的异步 REST API。适配器会读取 Gradio `/config` 自动识别当前“一步生成 GLB”的 workflow；如果遇到旧版三步 Demo，则回退到旧的预处理、多视图、导出 GLB 调用链路。

## 接口

- `POST /api/instantmesh/tasks`
- `GET /api/instantmesh/tasks/{taskId}`
- `GET /api/instantmesh/tasks/{taskId}/glb?token=...`

NWT 配置：

- 名称：`本地 InstantMesh Adapter`
- Base URL：`http://localhost:3002`
- API Key：`local-dev`
- 提交路径：`/api/instantmesh/tasks`
- 状态路径模板：`/api/instantmesh/tasks/{taskId}`
- 轮询间隔毫秒：`1500`
- 超时秒数：`900`

## 启动

先启动官方 InstantMesh Gradio，默认地址为 `http://localhost:43839`。

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 3002
```

Linux/macOS：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 3002
```

## 请求格式

`POST /api/instantmesh/tasks` 使用 `multipart/form-data`：

- `modelInputImage`：单张物品模型输入图，必填。
- `format`：默认 `glb`。
- `scaleHint`：可选，透传记录。
- `extraParams`：可选 JSON 字符串，可覆盖：
  - `sampleSteps`
  - `seed`
  - `removeBackground`

服务单机串行执行任务，避免本地显卡显存不足。任务状态保存在内存中，生成的 GLB 保存到 `outputs/`。
