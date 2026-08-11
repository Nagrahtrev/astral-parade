// submit-indexnow.mjs
//
// 用法:
//   npm run indexnow:submit                      # 自动构建后调用，仅提交新/变更 URL
//   npm run indexnow:submit -- --all             # 强制提交 sitemap 中全部 URL
//   npm run indexnow:submit -- --dry-run         # 只打印将要提交的内容
//   npm run indexnow:submit -- --include blog    # 只提交匹配正则的 URL
//
// 环境变量:
//   INDEXNOW_KEY             IndexNow key（不设置则自动从 static/*.txt 发现）
//   INDEXNOW_HOST            默认为 aspr-works.top
//   INDEXNOW_WINDOW_DAYS     仅提交最近 N 天内更新的 URL（默认 7）
//   INDEXNOW_ENABLED=0       跳过提交
//   VERCEL_ENV               自动检测：非 production 时跳过

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ----------------------------------------------------------- Config -----------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");
const DEBUG = process.argv.includes("--debug");

const includeIdx = process.argv.indexOf("--include");
const INCLUDE_PATTERN = includeIdx >= 0 && includeIdx + 1 < process.argv.length
  ? new RegExp(process.argv[includeIdx + 1])
  : /^https:\/\/aspr-works\.top\/blog\//;

const HOST = process.env.INDEXNOW_HOST || "aspr-works.top";
const WINDOW_DAYS = parseInt(process.env.INDEXNOW_WINDOW_DAYS || "7", 10);
const ENABLED = process.env.INDEXNOW_ENABLED !== "0";
const STATE_FILE = join(PROJECT_ROOT, "resources", "indexnow-state.json");

// ----------------------------------------------------------- Utilities --------------------------------------------------------

function log(...args) { console.log(...args); }
function warn(...args) { console.warn(...args); }

// 自动从 static/ 发现 IndexNow key
function discoverKey() {
  if (process.env.INDEXNOW_KEY) {
    if (DEBUG) log(`  [debug] 使用环境变量 INDEXNOW_KEY`);
    return process.env.INDEXNOW_KEY;
  }

  const staticDir = join(PROJECT_ROOT, "static");
  if (!existsSync(staticDir)) {
    warn("  [警告] static/ 目录不存在，无法自动发现 IndexNow key");
    return "";
  }

  const files = readdirSync(staticDir);
  for (const f of files) {
    if (!f.endsWith(".txt")) continue;
    const basename = f.slice(0, -4);
    if (/^[a-f0-9]{16,128}$/i.test(basename)) {
      try {
        const content = readFileSync(join(staticDir, f), "utf-8").trim();
        if (content === basename) {
          if (DEBUG) log(`  [debug] 在 static/${f} 发现 IndexNow key`);
          return basename;
        }
      } catch {}
    }
  }

  warn("  [警告] 未在 static/ 中找到 IndexNow key 文件");
  return "";
}

// 解析 sitemap.xml，返回 [{url, lastmod}]
function parseSitemap() {
  const sitemapPath = join(PROJECT_ROOT, "public", "sitemap.xml");
  if (!existsSync(sitemapPath)) {
    warn("  [警告] public/sitemap.xml 不存在，请先运行 hugo build");
    return [];
  }

  const xml = readFileSync(sitemapPath, "utf-8");
  const urls = [];
  const urlRegex = /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g;
  let match;
  while ((match = urlRegex.exec(xml)) !== null) {
    urls.push({ url: match[1], lastmod: match[2] || "" });
  }
  return urls;
}

// 读取变更状态文件
function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    } catch {}
  }
  return {};
}

// 保存变更状态文件
function saveState(state) {
  if (DRY_RUN) return;
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// 确定需要提交的 URL
function selectUrls(allUrls, state) {
  const withLastmod = allUrls.filter(u => u.lastmod);
  const withoutLastmod = allUrls.filter(u => !u.lastmod);

  if (ALL) {
    log(`  --all 模式：提交全部 URL`);
    return allUrls.map(u => u.url);
  }

  // 有 lastmod 的：比较状态文件中的记录
  const selected = new Set();

  // 时间窗口回退（当状态文件为空时）
  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - windowMs);

  let newCount = 0, updatedCount = 0, windowCount = 0;

  for (const { url, lastmod } of withLastmod) {
    const lmDate = new Date(lastmod);
    if (isNaN(lmDate.getTime())) continue;

    if (state[url]) {
      // 已有记录：检查 lastmod 是否更新
      if (new Date(state[url]) < lmDate) {
        selected.add(url);
        updatedCount++;
      }
    } else {
      // 无记录：检查是否在时间窗口内
      if (lmDate >= cutoff) {
        selected.add(url);
        windowCount++;
      }
    }
  }

  // 没有 lastmod 的 URL（旧文章）- 仅在无状态且无 lastmod 可参考时
  // 不自动提交无 lastmod 的旧 URL，避免 spam
  if (withoutLastmod.length > 0 && DEBUG) {
    log(`  [debug] ${withoutLastmod.length} 个 URL 缺少 lastmod，跳过`);
  }

  // 第一次运行（状态文件为空 + 时间窗口覆盖不到）的友好提示
  if (Object.keys(state).length === 0 && selected.size === 0) {
    log(`  ℹ 首次运行且 ${WINDOW_DAYS} 天内无更新，如需提交全部 URL 请使用 --all`);
  }

  if (DEBUG) {
    log(`  [debug] 新增: ${newCount}, 更新: ${updatedCount}, 窗口内: ${windowCount}`);
  }

  return [...selected].filter(url => INCLUDE_PATTERN.test(url));
}

// 带指数退避的 POST
async function submitWithRetry(body, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });

      // 200/202 = 成功（202 表示 key 正在验证中）
      if (res.status === 200 || res.status === 202) {
        log(`   ✓ 提交成功 (HTTP ${res.status})`);
        return true;
      }

      // 429 = 限流
      if (res.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
        warn(`   ⚠ 限流 (429), ${(delay / 1000).toFixed(1)}s 后重试...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // 403/422 = 配置错误
      if (res.status === 403) {
        warn(`   ✗ 403 Forbidden — key 文件可能尚未验证，请部署后稍等再试`);
      } else if (res.status === 422) {
        const err = await res.text();
        warn(`   ✗ 422 Unprocessable — URL 或 host 不匹配: ${err}`);
      } else {
        warn(`   ✗ HTTP ${res.status}`);
      }
      return false;

    } catch (e) {
      if (i < maxRetries - 1) {
        warn(`   ⚠ 网络错误: ${e.message}, 重试中...`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      warn(`   ✗ 网络错误: ${e.message}`);
      return false;
    }
  }
  return false;
}

// ----------------------------------------------------------- Main -----------------------------------------------------------

async function main() {
  log("=== IndexNow 提交 ===");

  // 环境守卫
  if (!ENABLED) {
    log("  > INDEXNOW_ENABLED=0，跳过");
    return;
  }

  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    log(`  > VERCEL_ENV=${process.env.VERCEL_ENV}，跳过（仅 production 环境提交）`);
    return;
  }

  // 获取 key
  const KEY = discoverKey();
  if (!KEY) {
    warn("  ✗ 未找到 IndexNow key，请设置 INDEXNOW_KEY 环境变量或添加 {key}.txt 到 static/");
    return;
  }
  log(`  Key: ${KEY.slice(0, 8)}...`);

  // 解析 sitemap
  log("-- 解析 sitemap --");
  const allUrls = parseSitemap();
  log(`  ${allUrls.length} 个 URL`);

  // 选出需要提交的 URL
  const state = loadState();
  log(`  状态记录: ${Object.keys(state).length} 条`);

  const urls = selectUrls(allUrls, state);
  if (urls.length === 0) {
    log("  ✓ 没有需要提交的 URL，跳过");
    return;
  }
  log(`  待提交: ${urls.length} 个 URL`);

  if (DEBUG) {
    for (const u of urls) log(`    ${u}`);
  }

  if (DRY_RUN) {
    log("\n[DRY RUN] 以下 URL 将被提交：");
    for (const u of urls) log(`  ${u}`);
    log(`\n  共 ${urls.length} 个 URL（未实际提交）`);
    return;
  }

  // 分批提交（每批最多 1000 个）
  const CHUNK_SIZE = 1000;
  let successCount = 0;

  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    const body = {
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList: chunk,
    };

    log(`\n  提交第 ${Math.floor(i / CHUNK_SIZE) + 1} 批 (${chunk.length} 个)...`);
    const ok = await submitWithRetry(body);
    if (ok) successCount += chunk.length;

    // 批次之间稍微等待
    if (i + CHUNK_SIZE < urls.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 更新状态文件
  const newState = { ...state };
  const now = new Date().toISOString();
  for (const url of urls) {
    const entry = allUrls.find(u => u.url === url);
    newState[url] = entry?.lastmod || now;
  }
  saveState(newState);

  log(`\n=== 完成: ${successCount}/${urls.length} 个 URL 已提交 ===`);
}

main().catch(e => {
  console.error("\n[错误]", e.message);
  if (DEBUG) console.error(e.stack);
  process.exit(1);
});
