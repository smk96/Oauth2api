# 部署说明

本项目同时支持两种部署方式：

- **VPS 常驻 Node 服务**：使用 `vps.js` 启动 Express 服务。
- **Vercel Serverless Functions**：继续使用根目录 `api/*.js` 作为 Vercel Functions，`public/` 作为静态站点。

## 文件清单

| 文件 | 用途 |
| --- | --- |
| `vps.js` | VPS/本地 Node 服务入口 |
| `vercel.json` | Vercel Functions、缓存和响应头配置 |
| `package.json` | 启动脚本、依赖、Node 版本要求 |
| `package-lock.json` | 锁定依赖版本，保证部署可复现 |
| `.env.template` | VPS 环境变量模板 |
| `ecosystem.config.cjs` | PM2 常驻运行配置 |
| `.gitignore` | 排除 `node_modules`、`.env`、日志文件 |

## 环境变量

| 变量 | VPS | Vercel | 说明 |
| --- | --- | --- | --- |
| `HOST` | 可选 | 不需要 | VPS 监听地址，默认 `0.0.0.0` |
| `PORT` | 可选 | 不需要 | VPS 监听端口，默认 `3000` |
| `DATA_DIR` | 可选 | 不需要 | VPS SQLite 数据目录，默认 `./data` |
| `DB_PATH` | 可选 | 不需要 | VPS SQLite 数据库文件，默认 `./data/mail.db` |
| `PASSWORD` | 可选 | 可选 | 保护取信、刷新 Token、AI 接口 |
| `SEND_PASSWORD` | 可选 | 可选 | 保护 `/api/send-mail` |
| `AI_API_KEY` | 可选 | 可选 | OpenAI 兼容接口 Key |
| `AI_API_URL` | 可选 | 可选 | OpenAI 兼容接口地址，不带 `/v1/chat/completions` |
| `AI_MODEL` | 可选 | 可选 | AI 模型名 |

VPS 使用 `.env` 文件；Vercel 在 Project Settings -> Environment Variables 配置。

## 数据存储和页面访问

VPS 部署时，邮箱管理数据默认存储在 SQLite 数据库：

```text
data/mail.db
```

数据库表：

- `emails`：邮箱账号、密码、Client ID、Refresh Token、备注、分组
- `groups`：分组列表

VPS 可以通过环境变量调整数据库位置：

```env
DATA_DIR=./data
DB_PATH=./data/mail.db
```

前端仍保留少量浏览器本地设置：

- `password`：接口访问密码
- `mailLimit`：默认获取邮件数量

Vercel 没有持久磁盘，数据库接口会禁用，前端会自动回退到浏览器 `localStorage`。

`/mail.html` 页面默认有前端访问门禁：

```text
账号：adinm
密码：adinm123
```

登录状态保存在 `sessionStorage.mailAccessGranted`，关闭浏览器后需要重新登录。

注意：这是前端门禁，不等同于服务端鉴权。VPS 生产环境建议额外配置 Nginx Basic Auth、Cloudflare Access 或其它服务端访问控制。

## VPS 部署

要求：

- **Node.js 18+**
- 开放运行端口，默认 `3000`

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.template .env
```

按需修改 `.env`：

```env
HOST=0.0.0.0
PORT=3000
PASSWORD=your-password
SEND_PASSWORD=your-send-password
AI_API_KEY=your-api-key
AI_API_URL=https://api.example.com
AI_MODEL=your-model-name
```

### 3. 启动

```bash
npm start
```

访问：

```text
http://服务器IP:3000/
http://服务器IP:3000/mail.html
http://服务器IP:3000/healthz
```

健康检查应返回：

```json
{"ok":true}
```

### 4. PM2 常驻运行

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

查看状态：

```bash
pm2 list
pm2 logs ms-oauth2-api
```

重启：

```bash
pm2 restart ms-oauth2-api
```

### 5. Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

如果使用 HTTPS，可以用 Certbot 或面板申请证书。

## Vercel 部署

Vercel 会自动识别：

- `api/*.js` -> Serverless Functions
- `public/*` -> 静态页面
- `vercel.json` -> Functions 和缓存配置

### 1. 导入项目

在 Vercel 中导入 GitHub 仓库。

推荐配置：

| 配置项 | 值 |
| --- | --- |
| Framework Preset | Other |
| Build Command | 留空 |
| Output Directory | 留空 |
| Install Command | `npm install` |

### 2. 配置环境变量

在 Vercel Project Settings -> Environment Variables 添加：

```text
PASSWORD
SEND_PASSWORD
AI_API_KEY
AI_API_URL
AI_MODEL
```

没有使用 AI 或发信功能时，对应变量可以不填。

### 3. 部署后检查

访问：

```text
https://你的项目.vercel.app/
https://你的项目.vercel.app/mail.html
https://你的项目.vercel.app/api/refresh-token
```

`/api/refresh-token` 不带参数返回 `400` 是正常的，说明函数已运行。

### 4. 本地模拟 Vercel

需要安装 Vercel CLI：

```bash
npm install -g vercel
vercel dev
```

或：

```bash
npm run vercel:dev
```

## 路由对照

| 路径 | VPS | Vercel |
| --- | --- | --- |
| `/` | `public/index.html` | `public/index.html` |
| `/mail.html` | 静态页面，禁用缓存 | 静态页面，禁用缓存 |
| `/assets/*` | 长缓存静态资源 | 长缓存静态资源 |
| `/api/mail-all` | Express 挂载 API | Vercel Function |
| `/api/mail-new` | Express 挂载 API | Vercel Function |
| `/api/refresh-token` | Express 挂载 API | Vercel Function |
| `/api/send-mail` | Express 挂载 API | Vercel Function |
| `/api/ai` | Express 挂载 API | Vercel Function |
| `/healthz` | VPS 健康检查 | 不适用 |

## 两分钟自检

### VPS

```bash
npm install
npm start
curl http://127.0.0.1:3000/healthz
curl -I http://127.0.0.1:3000/mail.html
curl -i http://127.0.0.1:3000/api/refresh-token
```

预期：

- `/healthz` 返回 `{"ok":true}`
- `/mail.html` 返回 `200`
- `/api/refresh-token` 返回 `400`，因为缺少参数

### Vercel

```bash
npm install -g vercel
vercel dev
```

然后访问：

```text
http://localhost:3000/mail.html
http://localhost:3000/api/refresh-token
```

部署线上后再检查：

```text
https://你的项目.vercel.app/mail.html
https://你的项目.vercel.app/api/refresh-token
```

## 注意事项

- Vercel Serverless 有运行时长限制，`vercel.json` 当前配置 `maxDuration: 60`。
- VPS 更适合长期稳定运行、较大批量邮箱操作。
- 真实收信、发信、刷新 Token 需要有效的 `email`、`client_id`、`refresh_token`。
- 前端账号数据保存在浏览器 `localStorage`，更换浏览器或清理缓存会丢失本地数据。
