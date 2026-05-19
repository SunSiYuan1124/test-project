import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const dataDir = join(__dirname, "data");
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(join(dataDir, "homework.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const count = db.prepare("SELECT COUNT(*) AS count FROM assignments").get().count;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO assignments (subject, title, description, due_date, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  insert.run("语文", "完成《春》课后练习", "整理生字词，完成第 2、3、5 题。", "2026-05-21", "todo");
  insert.run("数学", "二次函数小测订正", "把错题过程写完整，家长签字。", "2026-05-22", "todo");
  insert.run("英语", "Unit 6 单词听写准备", "背诵单词表 A 组，明天课前抽查。", "2026-05-20", "done");
}

const json = (res, statusCode, payload) => {
  if (statusCode === 204) {
    res.writeHead(204);
    res.end();
    return;
  }

  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
};

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
};

const listAssignments = () => db
  .prepare(`
    SELECT id, subject, title, description, due_date AS dueDate, status, created_at AS createdAt
    FROM assignments
    ORDER BY status = 'done', due_date ASC, id DESC
  `)
  .all();

const validAssignment = (body) => {
  const subject = String(body.subject || "").trim();
  const title = String(body.title || "").trim();
  const dueDate = String(body.dueDate || "").trim();
  const description = String(body.description || "").trim();

  if (!subject || !title || !dueDate) {
    return { error: "科目、标题和截止日期不能为空。" };
  }

  return { subject, title, dueDate, description };
};

const serveStatic = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = normalize(join(publicDir, safePath));
  if (relative(publicDir, filePath).startsWith("..")) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/assignments" && req.method === "GET") {
      json(res, 200, listAssignments());
      return;
    }

    if (url.pathname === "/api/assignments" && req.method === "POST") {
      const parsed = validAssignment(await readJson(req));
      if (parsed.error) {
        json(res, 400, { message: parsed.error });
        return;
      }

      const result = db
        .prepare(`
          INSERT INTO assignments (subject, title, description, due_date)
          VALUES (?, ?, ?, ?)
        `)
        .run(parsed.subject, parsed.title, parsed.description, parsed.dueDate);

      json(res, 201, {
        id: result.lastInsertRowid,
        subject: parsed.subject,
        title: parsed.title,
        description: parsed.description,
        dueDate: parsed.dueDate,
        status: "todo"
      });
      return;
    }

    const statusMatch = url.pathname.match(/^\/api\/assignments\/(\d+)\/status$/);
    if (statusMatch && req.method === "PATCH") {
      const body = await readJson(req);
      const status = body.status === "done" ? "done" : "todo";
      const result = db
        .prepare("UPDATE assignments SET status = ? WHERE id = ?")
        .run(status, Number(statusMatch[1]));

      if (result.changes === 0) {
        json(res, 404, { message: "没有找到这条作业。" });
        return;
      }

      json(res, 200, { id: Number(statusMatch[1]), status });
      return;
    }

    const deleteMatch = url.pathname.match(/^\/api\/assignments\/(\d+)$/);
    if (deleteMatch && req.method === "DELETE") {
      const result = db
        .prepare("DELETE FROM assignments WHERE id = ?")
        .run(Number(deleteMatch[1]));

      if (result.changes === 0) {
        json(res, 404, { message: "没有找到这条作业。" });
        return;
      }

      json(res, 204, null);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    json(res, 500, { message: "服务器开小差了，请稍后再试。" });
  }
});

server.listen(port, () => {
  console.log(`Class homework board is running at http://localhost:${port}`);
});
