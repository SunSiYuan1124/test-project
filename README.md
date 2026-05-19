# 班级作业单网站

一个使用 Vue + SQLite 的班级作业管理小网站。当前版本包含作业列表、发布作业、状态切换、删除、搜索和筛选。

## 运行

需要 Node.js 24 或更高版本。

```bash
npm run dev
```

如果 PowerShell 禁止运行 `npm.ps1`，可以使用：

```bash
npm.cmd run dev
```

浏览器打开：

```text
http://localhost:3000
```

## 技术结构

- `server.js`：Node 后端、API 路由、SQLite 初始化。
- `data/homework.sqlite`：运行后自动生成的 SQLite 数据库。
- `public/index.html`：Vue 页面入口。
- `public/app.js`：前端交互逻辑。
- `public/styles.css`：页面样式。

## API

- `GET /api/assignments`：获取作业列表。
- `POST /api/assignments`：新增作业。
- `PATCH /api/assignments/:id/status`：切换完成状态。
- `DELETE /api/assignments/:id`：删除作业。
