// notion-to-md
//
// 用法:
//   npm run notion:import -- --article 001           # 按编号从数据库导入
//   npm run notion:import -- --article 001,002,003   # 批量导入
//   npm run notion:import -- --page <page_id>        # 按页面 ID 导入
//   npm run notion:import [--dry-run] [--force] [--debug]
//
// 环境变量:
//   NOTION_TOKEN         Notion API Token
//   NOTION_DATABASE_ID   Notion 数据库 ID (--article 模式需要)
//   NOTION_PAGE_ID       默认页面 ID (直接运行时的回退值)

import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

// ----------------------------------------------------------- Config -----------------------------------------------------------

const TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID || "";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const DEBUG = process.argv.includes("--debug");

// --article <NNN>[,<NNN>]
const articleIdx = process.argv.indexOf("--article");
const ARTICLE_NUMBERS = articleIdx >= 0 && articleIdx + 1 < process.argv.length
  ? process.argv[articleIdx + 1].split(",").map(s => s.trim().padStart(3, "0"))
  : [];
// --page <id>
const pageIdx = process.argv.indexOf("--page");
const CLI_PAGE_ID = pageIdx >= 0 && pageIdx + 1 < process.argv.length
  ? process.argv[pageIdx + 1]
  : "";

// 单次转换中收集的图片/音频下载任务
const imageTasks = [];
const audioTasks = [];

// ----------------------------------------------------------- Utilities --------------------------------------------------------

// 带指数退避重试的 Notion API 调用
async function withRetry(fn, label, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); }
    catch (e) {
      if (e.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`  [retry] ${label}: 429, waiting ${(delay / 1000).toFixed(1)}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (e.status === 401) throw new Error("认证失败: 请检查 NOTION_TOKEN");
      if (e.status === 404) throw new Error("页面未找到: 请确认页面已与集成共享");
      throw e;
    }
  }
}

// YAML 安全字符串
function yamlStr(s) {
  if (!s) return '""';
  const str = String(s);
  if (/[:"#[\]{}\n]/.test(str) || str !== str.trim())
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return str;
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// 转义 HTML/Hugo 属性中的引号和反斜杠
function escapeAttr(s) {
  return String(s || "").replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ------------------------------------- Rich text -> inline markdown -------------------------------------

// 处理: 粗体、斜体、删除线、行内代码、链接、公式、mention、软换行

function richTextToMd(richText) {
  if (!richText || !richText.length) return "";

  // 1 - 将相邻且 bold/code/strike 状态相同的片段合并为一个组
  const merged = [];
  for (const t of richText) {
    const ann = t.annotations || {};
    const last = merged[merged.length - 1];
    if (last && last._bold === ann.bold && last._code === ann.code &&
        last._strike === ann.strikethrough && !last._href && !t.href) {
      last.items.push(t);
    } else {
      merged.push({
        _bold: ann.bold, _code: ann.code,
        _strike: ann.strikethrough, _href: t.href,
        items: [t],
      });
    }
  }

  // 2 - 检测相邻组之间的 * 号碰撞
  for (let i = 0; i < merged.length - 1; i++) {
    const a = merged[i], b = merged[i + 1];
    const aEndsBold     = a._bold && !a._strike && !a._href;
    const bStartsItalic = !b._bold && b.items.some(t => (t.annotations || {}).italic) && !b._strike && !b._href;
    const aEndsItalic   = !a._bold && a.items.some(t => (t.annotations || {}).italic) && !a._strike && !a._href;
    const bStartsBold   = b._bold && !b._strike && !b._href;
    if ((aEndsBold && bStartsItalic) || (aEndsItalic && bStartsBold)) {
      if (aEndsBold && bStartsItalic) b._useUnderscore = true;
      if (aEndsItalic && bStartsBold) a._useUnderscore = true;
    }
  }

  // 3 - 逐组渲染为 markdown
  return merged.map(group => {
    const hasItalic = group.items.some(t => (t.annotations || {}).italic);
    const lastItem = group.items[group.items.length - 1];
    const lastIsItalic = lastItem && (lastItem.annotations || {}).italic;
    const needsUnderscore = group._useUnderscore || (group._bold && hasItalic && lastIsItalic);
    const italicChar = needsUnderscore ? "_" : "*";

    let inner = group.items.map((t, idx) => {
      let text = (t.plain_text || "").replace(/\n/g, "  \n");  // 块内换行 -> 软换行
      const ann = t.annotations || {};

      if (t.type === "equation") return `$${text}$`;
      if (t.type === "mention") {
        if (t.mention?.type === "page") return `[${text}](https://notion.so/${t.mention.page.id})`;
        return text;
      }
      if (ann.code) return `\`${text}\``;

      if (ann.italic) {
        const prevItem = group.items[idx - 1];
        const prevEnd = prevItem ? (prevItem.plain_text || "").slice(-1) : "";
        const needSpace = italicChar === "_" && /[一-鿿　-〿＀-￯]/.test(prevEnd);
        return `${needSpace ? " " : ""}${italicChar}${text}${italicChar}`;
      }
      // 裸方括号转义
      if (!group._href) text = text.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
      // 行内连续空格转换
      text = text.replace(/  +(?!\n)/g, m => "&nbsp;".repeat(m.length - 1) + " ");
      return text;
    }).join("");

    // 外层包裹: 删除线 -> 粗体 -> 链接
    if (group._strike) inner = `~~${inner}~~`;
    if (group._bold) {
      if (hasItalic) inner = ` **${inner}** `;
      else inner = `**${inner}**`;
    }
    if (group._href) inner = `[${inner}](${group._href})`;
    return inner;
  }).join("");
}

// ----------------------------------------------------- Front matter -----------------------------------------------------

// 标题按 "NNN - 文章标题" 格式拆分
function buildFrontMatter(properties, { includeLastmod = false } = {}) {
  const titleProp = properties.Title || properties.title || properties.Name || properties.name;
  const rawTitle = titleProp?.title?.[0]?.plain_text || "";

  const match = rawTitle.match(/^(\S+)\s*[-–—]\s*(.+)$/);
  let number, title;
  if (match) {
    number = match[1].padStart(3, "0");
    title = match[2].trim();
  } else {
    const numMatch = rawTitle.match(/^(\d+)/);
    number = numMatch ? numMatch[1].padStart(3, "0") : "000";
    title = rawTitle;
    if (number === "000") console.warn(`  [警告] 标题格式不匹配 "NNN - Title": "${rawTitle}"`);
  }

  // properties -> frontMatter
  const dateProp = properties.Date || properties.date;
  const rawDate = dateProp?.date?.start || new Date().toISOString().slice(0, 10);
  const date = rawDate.slice(0, 10);

  const catProp = properties.Category || properties.category;
  const category = catProp?.select?.name || "";

  let tags = [];
  const tagCandidate = properties.Tag || properties.Tags || properties.tags;
  if (tagCandidate?.multi_select) {
    tags = tagCandidate.multi_select.map(t => t.name);
  } else {
    for (const [, v] of Object.entries(properties)) {
      if (v.type === "multi_select") { tags = v.multi_select.map(t => t.name); break; }
    }
  }

  const year = date.slice(0, 4);
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    "---",
    `title: "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    `date: ${date}`,
    includeLastmod ? `lastmod: ${today}` : null,
    `category: "${category.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    `year: "${year}"`,
    `tag: [${tags.map(t => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(", ")}]`,
    "---", "",
  ].filter(Boolean);
  return { number, title, date, category, year, tags, frontMatter: lines.join("\n") };
}

// ----------------------------------------------- Notion API helpers -----------------------------------------------

// 递归获取 block 的所有子级（处理分页）
async function listAllChildren(blockId) {
  const results = [];
  let cursor;
  while (true) {
    const res = await withRetry(
      () => notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 }),
      `listChildren:${blockId.slice(0, 8)}`
    );
    results.push(...res.results);
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return results;
}

// Notion API 要求逐 block 查询评论
async function fetchComments(rawBlocks) {
  const byBlock = new Map();

  const commentableTypes = new Set([
    "paragraph", "heading_1", "heading_2", "heading_3", "heading_4",
    "bulleted_list_item", "numbered_list_item", "to_do", "quote",
    "callout", "toggle", "table",
  ]);
  // 递归收集所有 block（含子级）
  _allBlocks = new Map();
  async function collectAll(blocks) {
    const all = [];
    for (const b of blocks) {
      _allBlocks.set(b.id, b);
      if (commentableTypes.has(b.type)) all.push(b);
      if (b.has_children) {
        try {
          const kids = await listAllChildren(b.id);
          const sub = await collectAll(kids);
          all.push(...sub);
        } catch {}
      }
    }
    return all;
  }
  const targets = await collectAll(rawBlocks);
  if (!targets.length) return byBlock;

  console.log(`   查询 ${targets.length} 个 block 的评论...`);
  let found = 0;

  // 并发控制
  const CONCURRENCY = 2;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (b) => {
        for (let retry = 0; retry < 3; retry++) {
          try {
            const res = await notion.comments.list({ block_id: b.id, page_size: 50 });
            return { blockId: b.id, comments: res.results };
          } catch (e) {
            if ((e.status === 429 || e.code === 'ECONNRESET') && retry < 2) {
              await new Promise(r => setTimeout(r, 800 * (retry + 1)));
              continue;
            }
            if (retry < 2) { await new Promise(r => setTimeout(r, 1000)); continue; }
          }
        }
        return { blockId: b.id, comments: [] };
      })
    );
    for (const r of results) {
      if (r.status !== "fulfilled") { console.warn(`    [警告] 评论查询失败: ${r.reason?.message || r.reason}`); continue; }
      const { blockId, comments } = r.value;
      if (!comments.length) continue;
      const texts = comments
        .map(c => c.rich_text?.map(t => t.plain_text).join("").trim())
        .filter(Boolean);
      if (texts.length) { byBlock.set(blockId, texts); found += texts.length; }
    }
    if (i + CONCURRENCY < targets.length) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  if (found === 0) {
    console.warn("  [警告] 未找到评论。如确认页面有评论，请检查:");
    console.warn("         1. 集成已启用 \"Read comments\" 权限");
    console.warn("         2. 页面已重新与集成共享");
  }
  return byBlock;
}

// 递归评论注入的状态
let _commentsByBlock = new Map();

// 将子 block 数组转换为 markdown
async function childrenToMd(children) {
  if (!children.length) return "";
  const mdblocks = await n2m.blocksToMarkdown(children);
  injectCommentTooltips(mdblocks, _commentsByBlock);
  return joinMdBlocks(mdblocks);
}

// 手动拼接 mdBlocks 为字符串
function joinMdBlocks(mdBlocks, indent = "") {
  const LIST_TYPES = new Set(["bulleted_list_item", "numbered_list_item", "to_do"]);
  let result = "";
  for (let i = 0; i < mdBlocks.length; i++) {
    const md = mdBlocks[i];
    let s = indent + (md.parent || "");
    // 子级列表加缩进
    if (md.children?.length) {
      s += "\n" + joinMdBlocks(md.children, indent + "    ");    // 4 空格
    }
    if (i > 0) {
      const prev = mdBlocks[i - 1];
      if (LIST_TYPES.has(md.type) && prev?.type === md.type) {
        result += "\n";
      } else {
        result += "\n\n";
      }
    }
    result += s;
  }
  return result;
}

// ---------------------------------------- Custom block transformers ----------------------------------------
function registerTransformers(n2m) {

  // ---- callout -> notice ----
  n2m.setCustomTransformer("callout", async (block) => {
    const data = block.callout;
    const emoji = data?.icon?.emoji || "";
    const isWarning = emoji.includes("⚠") || emoji === "❗";
    const type = isWarning ? "warning" : "notice";

    const innerText = richTextToMd(data?.rich_text);
    let childrenMd = "";
    if (block.has_children) {
      const kids = await listAllChildren(block.id);
      if (kids.length) childrenMd = "\n" + (await childrenToMd(kids));
    }
    return `{{< notice "${type}" >}}\n${innerText}${childrenMd}\n{{< /notice >}}`;
  });

  // ---- toggle -> accordion ----
  n2m.setCustomTransformer("toggle", async (block) => {
    const title = richTextToMd(block.toggle?.rich_text) || "fold";
    let content = "";
    if (block.has_children) {
      const kids = await listAllChildren(block.id);
      if (kids.length) content = await childrenToMd(kids);
    }
    return `{{< accordion "${escapeAttr(title)}" >}}\n${content}\n{{< /accordion >}}`;
  });

  // ---- image -> placeholder, 收集下载任务 ----
  n2m.setCustomTransformer("image", (block) => {
    const data = block.image;
    const url = data?.type === "external" ? data.external?.url : data?.file?.url;
    if (!url) return "<!-- IMAGE: no URL -->";
    const caption = data.caption?.map(t => t.plain_text).join("") || "";
    const idx = imageTasks.length;
    const placeholder = `__IMG_${idx}__`;
    imageTasks.push({ url, caption, alt: caption || "image", placeholder, blockId: block.id });
    return placeholder;
  });

  // ---- audio -> 收集下载任务 ----
  n2m.setCustomTransformer("audio", (block) => {
    const data = block.audio;
    const url = data?.type === "external" ? data.external?.url : data?.file?.url;
    if (!url) return "<!-- AUDIO: no URL -->";
    const caption = data.caption?.map(t => t.plain_text).join("") || "";
    const idx = audioTasks.length;
    const placeholder = `__AUDIO_${idx}__`;
    audioTasks.push({ url, caption, placeholder, blockId: block.id });
    return placeholder;
  });

  // ---- column_list -> tabs (legacy Notion columns) ----
  n2m.setCustomTransformer("column_list", async (block) => {
    let columns = [];
    if (block.has_children) {
      const children = await listAllChildren(block.id);
      columns = children.filter(c => c.type === "column");
    }
    if (!columns.length) return "";

    const parts = ["{{< tabs >}}"];
    let colNum = 0;
    for (const col of columns) {
      colNum++;
      let childContent = "", tabTitle = `Column ${colNum}`;
      if (col.has_children) {
        const grandkids = await listAllChildren(col.id);
        if (grandkids.length) {
          const h = grandkids.find(g => g.type?.startsWith("heading_"));
          if (h) tabTitle = richTextToMd(h[h.type]?.rich_text) || tabTitle;
          childContent = await childrenToMd(grandkids);
        }
      }
      parts.push(`{{< tab "${escapeAttr(tabTitle)}" >}}`, childContent, "{{< /tab >}}");
    }
    parts.push("{{< /tabs >}}");
    return parts.join("\n");
  });

  // ---- tab (newer Notion native tabs) -> tabs/tab ----
  n2m.setCustomTransformer("tab", async (block) => {
    const tabItems = [];
    if (block.has_children) {
      const children = await listAllChildren(block.id);
      for (const child of children) {
        const title = richTextToMd(child[child.type]?.rich_text) || "Tab";
        let content = "";
        if (child.has_children) {
          const grandkids = await listAllChildren(child.id);
          if (grandkids.length) content = await childrenToMd(grandkids);
        }
        tabItems.push({ title, content });
      }
    }
    if (!tabItems.length) return "";

    const parts = ["{{< tabs >}}"];
    for (const item of tabItems) {
      parts.push(`{{< tab "${escapeAttr(item.title)}" >}}`);
      if (item.content) parts.push(item.content);
      parts.push("{{< /tab >}}");
    }
    parts.push("{{< /tabs >}}");
    return parts.join("\n");
  });

  // ---- passthrough / skip ----
  n2m.setCustomTransformer("column", () => "");
  n2m.setCustomTransformer("divider", () => "----");
  n2m.setCustomTransformer("child_page", () => "");
  n2m.setCustomTransformer("child_database", () => "");
  n2m.setCustomTransformer("synced_block", async (block) => {
    if (block.has_children) {
      const kids = await listAllChildren(block.id);
      return await childrenToMd(kids);
    }
    return "";
  });
  n2m.setCustomTransformer("link_to_page", (block) => {
    const m = block.link_to_page;
    if (m?.page_id) return `[-> page:${m.page_id}]`;
    if (m?.database_id) return `[-> db:${m.database_id}]`;
    return "";
  });
  n2m.setCustomTransformer("table_of_contents", () => "");
  n2m.setCustomTransformer("breadcrumb", () => "");

  // ---- heading_4 ----
  n2m.setCustomTransformer("heading_4", (block) => {
    const text = richTextToMd(block.heading_4?.rich_text);
    if (!text) return false;
    return `#### ${text}`;
  });

  // ---- equation block -> span shortcode ----
  n2m.setCustomTransformer("equation", (block) => {
    const expr = block.equation?.expression || "";
    if (!expr) return "";
    return `{{< span style="font-size: 22px; margin: 40px 0; display: inline-block" >}}${expr}{{< /span >}}`;
  });

  // ---- embed detector: YouTube / SoundCloud links ----
  const embedDetector = (block) => {
    const rt = block[block.type]?.rich_text;
    if (!rt) return false;
    const text = rt.map(t => t.plain_text).join("").trim();
    const yt = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return `{{< youtube ${yt[1]} >}}`;
    const sc = text.match(/(?:https?:\/\/)?soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/);
    if (sc) return `{{< soundcloud url="${sc[0]}" color="020203" >}}`;
    return false;
  };

  // ---- paragraph ----
  n2m.setCustomTransformer("paragraph", (block) => {
    const embedResult = embedDetector(block);
    if (embedResult !== false) return embedResult;
    const rt = block.paragraph?.rich_text;
    if (!rt || rt.length === 0) return "<br>";   // 空区块
    return richTextToMd(rt);
  });

  // ---- 有序列表 ----
  n2m.setCustomTransformer("numbered_list_item", async (block) => {
    const text = richTextToMd(block.numbered_list_item?.rich_text);
    if (!text) return false;
    let s = `${block.__orderedIndex || 1}. ${text}`;
    if (block.has_children) {
      const kids = await listAllChildren(block.id);
      if (kids.length) {
        let subIdx = 0;
        for (const k of kids) {
          if (k.type === "numbered_list_item") { subIdx++; k.__orderedIndex = subIdx; }
        }
        // 子级每行加 4 空格缩进
        const childStr = (await childrenToMd(kids))
          .split("\n").map(line => "    " + line).join("\n");
        s += "\n" + childStr;
      }
    }
    return s;
  });
}

// ------------------------------------- Comment -> tooltip -------------------------------------

// blockId -> raw block
let _allBlocks = new Map();

// 为有评论的 block 注入 tooltip shortcode
function injectCommentTooltips(mdBlocks, commentsByBlock) {
  for (const md of mdBlocks) {
    const bid = md.blockId;
    if (bid && commentsByBlock.has(bid)) {
      const mdParent = md.parent;
      if (mdParent && !mdParent.startsWith("{{<") && !mdParent.startsWith("__IMG_") && mdParent !== "<br>") {
        const comments = commentsByBlock.get(bid);
        const tipText = comments.join("；").replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const raw = _allBlocks.get(bid);
        const rt = raw?.[raw.type]?.rich_text || raw?.[raw.type]?.title;
        let wrapped = false;

        if (rt && rt.length > 1) {
          const segments = rt.map(t => t.plain_text || "").filter(Boolean);
          let targetIdx = -1, bestScore = Infinity;
          for (let s = 0; s < segments.length; s++) {
            const seg = segments[s];
            if (seg.length < 2) continue;
            let score = seg.length;
            if (s === 0 || s === segments.length - 1) score += 100;
            if (score < bestScore) { bestScore = score; targetIdx = s; }
          }
          if (targetIdx >= 0) {
            const targetText = segments[targetIdx];
            const pos = mdParent.indexOf(targetText);
            if (pos >= 0) {
              md.parent = mdParent.slice(0, pos) +
                `{{< tooltip "${tipText}" >}}${targetText}{{< /tooltip >}}` +
                mdParent.slice(pos + targetText.length);
              wrapped = true;
            }
          }
        }
        if (!wrapped) {
          md.parent = `{{< tooltip "${tipText}" >}}${mdParent}{{< /tooltip >}}`;
        }
      }
    }
    if (md.children?.length) injectCommentTooltips(md.children, commentsByBlock);
  }
}

// -------------------------------------- 图片下载 & 转换 webp --------------------------------------

async function downloadImage(url, filePath, blockId) {
  let downloadUrl = url;
  // 通过 API 刷新 Notion 内部 URL（可能过期）
  if (blockId && (url.includes("amazonaws.com") || url.includes("notion.so") || url.includes("notion-images"))) {
    try {
      const block = await withRetry(
        () => notion.blocks.retrieve({ block_id: blockId }),
        `refresh-img:${blockId.slice(0, 8)}`
      );
      const fresh = block.image?.file?.url || block.image?.external?.url;
      if (fresh) downloadUrl = fresh;
    } catch (e) {
      console.warn(`    [警告] 刷新图片 URL 失败: ${e.message}`);
    }
  }

  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(filePath, buffer);
  return buffer;
}

// 下载图片 -> ffmpeg 转 webp -> 生成 image shortcode
async function downloadAndConvertImages(articleNumber) {
  if (!imageTasks.length) return new Map();
  const imgDir = join(PROJECT_ROOT, "static", "images", "blog", articleNumber);
  ensureDir(imgDir);
  const map = new Map();

  for (let i = 0; i < imageTasks.length; i++) {
    const { url, caption, alt, placeholder, blockId } = imageTasks[i];
    const idx = String(i + 1).padStart(3, "0");
    const webpPath = join(imgDir, `${idx}.webp`);
    const tmpPath = join(imgDir, `.tmp-${idx}`);

    console.log(`  [${i + 1}/${imageTasks.length}] ${url.slice(0, 80)}...`);
    try {
      const buf = await downloadImage(url, tmpPath, blockId);
      console.log(`    -> ${(buf.length / 1024).toFixed(0)} KB`);

      const r = spawnSync("ffmpeg", [
        "-y", "-i", tmpPath, "-c:v", "libwebp", "-quality", "80",
        "-compression_level", "6", webpPath,
      ], { stdio: "pipe", timeout: 30000 });

      if (r.status !== 0) {
        console.warn(`    [警告] ffmpeg 转换失败，保留原始格式`);
        const ext = url.match(/\.(png|jpg|jpeg|gif)(\?|$)/i)?.[1] || "png";
        writeFileSync(join(imgDir, `${idx}.${ext}`), buf);
        map.set(placeholder, `{{< image src="images/blog/${articleNumber}/${idx}.${ext}" caption="${escapeAttr(caption)}" alt="${escapeAttr(alt)}" width="" height="" center="true" >}}`);
      } else {
        console.log(`    -> ${idx}.webp`);
        map.set(placeholder, `{{< image src="images/blog/${articleNumber}/${idx}.webp" caption="${escapeAttr(caption)}" alt="${escapeAttr(alt)}" width="" height="" center="true" >}}`);
      }
    } catch (e) {
      console.error(`    [错误] ${e.message}`);
      map.set(placeholder, `<!-- IMAGE FAILED: ${url} -->`);
    } finally { try { unlinkSync(tmpPath); } catch {} }
  }
  return map;
}

// 下载音频 -> ffmpeg 转 aac -> 生成 audio shortcode
async function downloadAndConvertAudio(articleNumber) {
  if (!audioTasks.length) return new Map();
  const audioDir = join(PROJECT_ROOT, "static", "audio", "blog", articleNumber);
  ensureDir(audioDir);
  const map = new Map();

  for (let i = 0; i < audioTasks.length; i++) {
    const { url, caption, placeholder, blockId } = audioTasks[i];
    const idx = String(i + 1).padStart(3, "0");
    const m4aPath = join(audioDir, `${idx}.m4a`);
    const tmpPath = join(audioDir, `.tmp-${idx}`);

    console.log(`  [${i + 1}/${audioTasks.length}] ${url.slice(0, 80)}...`);
    try {
      const buf = await downloadImage(url, tmpPath, blockId);
      console.log(`    -> ${(buf.length / 1024).toFixed(0)} KB`);

      const r = spawnSync("ffmpeg", [
        "-y", "-i", tmpPath,
        "-ar", "44100", "-c:a", "aac", "-b:a", "128k",
        m4aPath,
      ], { stdio: "pipe", timeout: 60000 });

      if (r.status !== 0) {
        console.warn(`    [警告] ffmpeg 转换失败: ${r.stderr.toString().slice(-200)}`);
        map.set(placeholder, `<!-- AUDIO FAILED: ${url} -->`);
      } else {
        console.log(`    -> ${idx}.m4a`);
        const title = caption || `Track ${idx}`;
        map.set(placeholder, `{{< audio src="audio/blog/${articleNumber}/${idx}.m4a" title="${escapeAttr(title)}" >}}`);
      }
    } catch (e) {
      console.error(`    [错误] ${e.message}`);
      map.set(placeholder, `<!-- AUDIO FAILED: ${url} -->`);
    } finally { try { unlinkSync(tmpPath); } catch {} }
  }
  return map;
}

// -------------------------------------------------- 后处理 --------------------------------------------------

// 二次检测: 未处理的 YouTube/SoundCloud 裸链接
function detectEmbeds(mdString) {
  let result = mdString;
  result = result.replace(
    /(?<!["\w])https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)(?![^\s]*\))/g,
    (match, videoId) => match.includes("{{<") ? match : `{{< youtube ${videoId} >}}`
  );
  result = result.replace(
    /(?<!["\w])https?:\/\/soundcloud\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)(?![^\s]*\))/g,
    (match, path) => match.includes("{{<") ? match : `{{< soundcloud url="https://soundcloud.com/${path}" color="020203" >}}`
  );
  return result;
}

// 替换图片占位符 / 清理多余空行 / 裁剪末尾空区块
function postProcess(mdString, imageMap, audioMap = new Map()) {
  let result = mdString;
  for (const [ph, sc] of imageMap) result = result.replace(ph, sc);
  for (const [ph, sc] of audioMap) result = result.replace(ph, sc);
  result = detectEmbeds(result);

  const lines = result.split("\n");
  const out = [];
  let inFence = false, emptyRun = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      if (emptyRun > 2) emptyRun = 2;
      out.push(...Array(emptyRun).fill(""));
      emptyRun = 0;
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) { out.push(line); continue; }
    if (trimmed === "") { emptyRun++; continue; }

    if (emptyRun > 2) emptyRun = 2;
    out.push(...Array(emptyRun).fill(""));
    emptyRun = 0;
    out.push(line);
  }

  let final = out.join("\n").trim();

  final = final.replace(/(?:\n{1,2}<br>)+$/, "");
  return final;
}

// ---------------------------------------------------- Main pipeline ----------------------------------------------------

let notion;
let n2m;

// 转换单个页面 -> 写入 content/blog/<number>.md
async function convertPage(pageId) {
  imageTasks.length = 0;
  audioTasks.length = 0;

  // 1. 获取页面属性
  console.log("\n-- 获取页面属性 --");
  const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }), "retrieve");
  const meta = buildFrontMatter(page.properties, { includeLastmod: FORCE });
  console.log(`   #${meta.number}  "${meta.title}"`);
  console.log(`   ${meta.date}  |  ${meta.category}  |  [${meta.tags.join(", ")}]`);

  // 2. 获取 blocks
  console.log("-- 获取页面 blocks --");
  const rawBlocks = await listAllChildren(pageId);
  console.log(`   ${rawBlocks.length} 个顶层 block`);

  // 3. 获取评论
  console.log("-- 获取评论 --");
  const commentsByBlock = await fetchComments(rawBlocks);
  _commentsByBlock = commentsByBlock;
  console.log(`   ${commentsByBlock.size} 个 block 有评论`);

  if (DEBUG) {
    for (const b of rawBlocks) {
      const rt = b[b.type]?.rich_text;
      const txt = rt ? rt.map(t => t.plain_text).join("").slice(0, 60) : "(no text)";
      console.log(`   [${b.type}] ${txt}${b.has_children ? " (children)" : ""}${commentsByBlock.has(b.id) ? " [comments]" : ""}`);
    }
  }

  // 标注有序列表项的序号（按连续组递增）
  let orderedIdx = 0;
  for (const b of rawBlocks) {
    if (b.type === "numbered_list_item") {
      orderedIdx++;
      b.__orderedIndex = orderedIdx;
    } else {
      orderedIdx = 0;
    }
  }

  // 4. 注册 transformers，转换 blocks -> mdBlocks
  console.log("-- 转换中 --");
  n2m = new NotionToMarkdown({ notionClient: notion });
  registerTransformers(n2m);
  const mdblocks = await n2m.blocksToMarkdown(rawBlocks);

  // 5. 注入评论 tooltip
  if (commentsByBlock.size > 0) injectCommentTooltips(mdblocks, commentsByBlock);

  const rawMd = joinMdBlocks(mdblocks);
  console.log(`   ${rawMd.length} 字符`);

  // 6. 下载图片，转换为 webp
  console.log(`-- 处理图片 (${imageTasks.length} 张) --`);
  let imageMap = new Map();
  if (!DRY_RUN) {
    imageMap = await downloadAndConvertImages(meta.number);
  } else {
    for (let i = 0; i < imageTasks.length; i++) {
      const idx = String(i + 1).padStart(3, "0");
      const t = imageTasks[i];
      imageMap.set(t.placeholder,
        `{{< image src="images/blog/${meta.number}/${idx}.webp" caption="${escapeAttr(t.caption)}" alt="${escapeAttr(t.alt)}" width="" height="" center="true" >}}`);
    }
  }

  // 6b. 下载音频，转换为 M4A (44.1kHz AAC 128kbps)
  console.log(`-- 处理音频 (${audioTasks.length} 个) --`);
  let audioMap = new Map();
  if (!DRY_RUN) {
    audioMap = await downloadAndConvertAudio(meta.number);
  } else {
    for (let i = 0; i < audioTasks.length; i++) {
      const idx = String(i + 1).padStart(3, "0");
      const t = audioTasks[i];
      const title = t.caption || `Track ${idx}`;
      audioMap.set(t.placeholder,
        `{{< audio src="audio/blog/${meta.number}/${idx}.m4a" title="${escapeAttr(title)}" >}}`);
    }
  }

  // 7. 后处理
  const finalMd = postProcess(rawMd, imageMap, audioMap);

  // 8. 写入文件
  const fullContent = meta.frontMatter + "\n" + finalMd + "\n";
  const outputPath = join(PROJECT_ROOT, "content", "blog", `${meta.number}.md`);

  if (DRY_RUN) {
    console.log(`[DRY RUN] -> ${outputPath}`);
    console.log(`   ${fullContent.length} 字符  |  ${imageTasks.length} 张图片  |  ${audioTasks.length} 个音频`);
    console.log("============================== 预览 ==============================");
    console.log(fullContent);
  } else {
    if (existsSync(outputPath) && !FORCE) {
      console.error(`[错误] 文件已存在: ${outputPath}`);
      console.error("       使用 --force 覆盖");
      return meta.number;
    }
    writeFileSync(outputPath, fullContent, "utf-8");
    console.log(`[完成] ${outputPath}`);
    console.log(`   ${fullContent.length} 字符  |  ${imageTasks.length} 张图片  |  ${audioTasks.length} 个音频`);
  }
  return meta.number;
}

// 通过 REST API 查询数据库
async function queryDatabase(databaseId, filter) {
  const body = { page_size: 100 };
  if (filter) body.filter = filter;
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`数据库查询失败: ${err.message || res.status}`);
  }
  return res.json();
}

// 从数据库按文章编号查找页面 ID
async function findPageByArticle(articleNumber) {
  const db = await withRetry(() => notion.databases.retrieve({ database_id: DATABASE_ID }), "db-retrieve");
  const props = db.properties || {};
  const titlePropName = Object.entries(props).find(([, v]) => v.type === "title")?.[0];

  if (!titlePropName) {
    console.warn("  [警告] 数据库无 properties schema，全量查询后手动匹配...");
    const res = await queryDatabase(DATABASE_ID);
    if (!res.results.length) { console.warn("  [警告] 数据库中无页面"); return null; }
    for (const pg of res.results) {
      const pgProps = pg.properties || {};
      for (const [, v] of Object.entries(pgProps)) {
        if (v.type === "title") {
          const t = v.title?.[0]?.plain_text || "";
          if (t.startsWith(articleNumber)) {
            console.log(`   -> ${t}  (${pg.id.slice(0, 8)}...)`);
            return pg.id;
          }
        }
      }
    }
    console.warn(`  [警告] 未找到编号 ${articleNumber} 的文章`);
    return null;
  }

  const res = await queryDatabase(DATABASE_ID, {
    property: titlePropName,
    title: { starts_with: articleNumber },
  });

  if (!res.results.length) {
    console.warn(`  [警告] 未找到编号 ${articleNumber} 的文章`);
    return null;
  }

  const page = res.results[0];
  const title = page.properties[titlePropName]?.title?.[0]?.plain_text || "";
  console.log(`   -> ${title}  (${page.id.slice(0, 8)}...)`);
  return page.id;
}

async function main() {
  if (!TOKEN) { console.error("[错误] 请设置 NOTION_TOKEN 环境变量"); process.exit(1); }

  notion = new Client({ auth: TOKEN });

  console.log("=== Notion -> Markdown ===");
  console.log(`   模式: ${DRY_RUN ? "dry-run" : FORCE ? "force" : "normal"}`);

  if (ARTICLE_NUMBERS.length > 0) {
    if (!DATABASE_ID) { console.error("[错误] --article 需要设置 NOTION_DATABASE_ID"); process.exit(1); }
    console.log(`   数据库: ${DATABASE_ID.slice(0, 8)}...`);
    console.log(`   文章编号: [${ARTICLE_NUMBERS.join(", ")}]\n`);

    for (const num of ARTICLE_NUMBERS) {
      console.log(`-- 查询 #${num} --`);
      const pageId = await findPageByArticle(num);
      if (!pageId) continue;
      await convertPage(pageId);
    }
    console.log("\n============================== 全部完成 ==============================");
    return;
  }

  // 单页模式
  const PAGE_ID = CLI_PAGE_ID || process.env.NOTION_PAGE_ID || "";
  if (!PAGE_ID) {
    console.error("[错误] 请设置 NOTION_PAGE_ID 或使用 --page <id> 或 --article <NNN>");
    process.exit(1);
  }

  console.log(`   页面: ${PAGE_ID.slice(0, 8)}...\n`);
  await convertPage(PAGE_ID);
  console.log("\n=== 完成 ===");
}

main().catch(e => {
  console.error("\n[错误]", e.message);
  if (DEBUG) console.error(e.stack);
  process.exit(1);
});
