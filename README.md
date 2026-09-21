# 微软 OAuth2 邮箱管理 API

这是一个支持 **VPS** 和 **Vercel** 双部署方式的 Microsoft OAuth2 邮箱管理项目。

它提供：

- Outlook 邮箱 OAuth2 取信
- 收件箱 / 垃圾邮箱查看
- Refresh Token 批量刷新
- 邮箱分组管理
- 当前分组导出
- 邮箱和密码一键复制
- AI 邮件解读代理接口
- VPS 常驻服务和 Vercel Serverless Functions 双兼容

## 快速启动

### VPS / 本地 Node

```bash
npm install
cp .env.template .env
npm start
```

访问：

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/mail.html
http://127.0.0.1:3000/healthz
```

### Vercel

导入仓库到 Vercel，保持默认安装命令 `npm install`，Framework Preset 选 `Other` 或默认即可。

本地模拟：

```bash
npm install -g vercel
npm run vercel:dev
```

完整部署说明见 [DEPLOY.md](./DEPLOY.md)。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `HOST` | VPS 监听地址，默认 `0.0.0.0` |
| `PORT` | VPS 监听端口，默认 `3000` |
| `PASSWORD` | 接口访问密码，保护取信、刷新 Token、AI 接口 |
| `SEND_PASSWORD` | 发信接口密码，保护 `/api/send-mail` |
| `AI_API_KEY` | OpenAI 兼容接口 Key |
| `AI_API_URL` | OpenAI 兼容接口地址 |
| `AI_MODEL` | AI 模型名 |

VPS 使用 `.env`，Vercel 在 Project Settings -> Environment Variables 配置。

## 数据存储

VPS 部署时，邮箱账号和分组数据存储在 SQLite 数据库：

```text
data/mail.db
```

可通过环境变量修改：

```env
DATA_DIR=./data
DB_PATH=./data/mail.db
```

VPS 数据库存储内容：

| 数据 | 存储位置 |
| --- | --- |
| 邮箱账号、密码、Client ID、Refresh Token、备注 | SQLite `emails` 表 |
| 分组列表 | SQLite `groups` 表 |
| 接口访问密码 | 浏览器 `localStorage.password` |
| 默认获取邮件数量 | 浏览器 `localStorage.mailLimit` |
| 页面访问登录状态 | `sessionStorage.mailAccessGranted` |

Vercel 没有持久磁盘，`/mail.html` 会自动回退到浏览器 `localStorage` 存储。

旧版本浏览器本地已有邮箱数据时，VPS 数据库为空会自动迁移一次到 SQLite。

## 页面访问密码

`/mail.html` 默认开启前端访问门禁：

```text
账号：adinm
密码：adinm123
```

登录状态保存在当前浏览器会话的 `sessionStorage`，关闭浏览器后需要重新登录。

这是前端门禁，适合防止普通误访问；如果要强安全，VPS 建议再加 Nginx Basic Auth 或服务器侧鉴权。

## 账号导入格式

默认分隔符为：

```text
----
```

支持两种四段格式：

```text
邮箱----密码----Client ID----RefreshToken
```

也支持：

```text
邮箱----密码----RefreshToken----Client ID
```

只有邮箱和密码也可以导入，后续可补充 Token 信息。

## API 路由

| 路径 | 方法 | 说明 |
| --- | --- | --- |
| `/api/mail-new` | GET / POST | 获取最新一封邮件 |
| `/api/mail-all` | GET / POST | 获取邮件列表 |
| `/api/refresh-token` | GET / POST | 刷新 Refresh Token |
| `/api/send-mail` | GET / POST | OAuth2 SMTP 发信 |
| `/api/process-inbox` | GET / POST | 清空收件箱 |
| `/api/process-junk` | GET / POST | 清空垃圾箱 |
| `/api/ai` | POST | OpenAI 兼容 AI 解读代理 |

## VPS 文件

| 文件 | 说明 |
| --- | --- |
| `vps.js` | Express 服务入口 |
| `.env.template` | VPS 环境变量模板 |
| `ecosystem.config.cjs` | PM2 配置 |

## Vercel 文件

| 文件 | 说明 |
| --- | --- |
| `api/*.js` | Vercel Functions |
| `public/*` | 静态页面 |
| `vercel.json` | Vercel 配置 |

## 健康检查

VPS：

```text
/healthz
```

返回：

```json
{"ok":true}
```

Vercel 没有 `/healthz`，可用 `/api/refresh-token` 检查函数是否运行。无参数返回 `400` 属于正常。

## 注意事项

- Node.js 需要 **18+**。
- 前端数据保存在浏览器 `localStorage`。
- Vercel 有 Serverless 运行时长限制，大批量操作更推荐 VPS。
- 真实邮箱功能需要有效的 `email`、`client_id`、`refresh_token`。
