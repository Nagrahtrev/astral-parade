// submit-baidu.mjs
//
// 用法:
//   npm run baidu:submit                  # 自动构建后调用，仅提交新/变更 URL
//   npm run baidu:submit -- --all         # 强制提交 sitemap 中全部 URL
//   npm run baidu:submit -- --dry-run     # 只打印将要提交的内容
//
// 环境变量:
//   BAIDU_TOKEN             百度站长平台 API token
//   INDEXNOW_HOST           默认为 aspr-works.top
//   INDEXNOW_WINDOW_DAYS    仅提交最近 N 天内更新的 URL（默认 7）
//   BAIDU_ENABLED=0         跳过提交
//   VERCEL_ENV              自动检测：非 production 时跳过

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ----------------------------------------------------------- Config -----------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");
const DEBUG = process.argv.includes("--debug");

const HOST = process.env.INDEXNOW_HOST || "aspr-works.top";
const WINDOW_DAYS = parseInt(process.env.INDEXNOW_WINDOW_DAYS || "7", 10);
const ENABLED = process.env.BAIDU_ENABLED !== "0";
const STATE_FILE = join(PROJECT_ROOT, "resources", "baidu-state.json");
const BAIDU_API = "https://data.zz.baidu.com/urls";

// ----------------------------------------------------------- Utilities --------------------------------------------------------

function log(...args) { console.log(...args); }
function warn(...args) { console.warn(...args); }

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
  if (ALL) {
    log(`  --all 模式：提交全部 URL`);
    return allUrls.map(u => u.url);
  }

  const selected = new Set();
  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - windowMs);

  for (const { url, lastmod } of allUrls) {
    if (!lastmod) continue;
    const lmDate = new Date(lastmod);
    if (isNaN(lmDate.getTime())) continue;

    if (state[url]) {
      if (new Date(state[url]) < lmDate) {
        selected.add(url);
      }
    } else {
      if (lmDate >= cutoff) {
        selected.add(url);
      }
    }
  }

  if (Object.keys(state).length === 0 && selected.size === 0) {
    log(`  ℹ 首次运行且 ${WINDOW_DAYS} 天内无更新，如需提交全部 URL 请使用 --all`);
  }

  return [...selected];
}

// 提交到 Baidu API
async function submitToBaidu(token, urls) {
  const endpoint = `${BAIDU_API}?site=${HOST}&token=${token}`;
  const body = urls.join("\n");

  if (DEBUG) {
    log(`  [debug] 端点: ${BAIDU_API}?site=${HOST}&token=***`);
    log(`  [debug] Body 长度: ${body.length} 字节`);
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body,
    });

    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      warn(`   ✗ 响应解析失败: ${text.slice(0, 200)}`);
      return { success: 0, remain: "?" };
    }

    if (res.ok && result.success !== undefined) {
      log(`   ✓ 成功: ${result.success}, 剩余额度: ${result.remain || "?"}`);
      if (result.not_same_site?.length) {
        warn(`   ⚠ 域名不匹配: ${result.not_same_site.length} 个`);
      }
      if (result.not_valid?.length) {
        warn(`   ⚠ 无效 URL: ${result.not_valid.length} 个`);
      }
      return result;
    }

    warn(`   ✗ 失败: HTTP ${res.status} — ${text.slice(0, 200)}`);
    return { success: 0, remain: "?", error: text };

  } catch (e) {
    warn(`   ✗ 网络错误: ${e.message}`);
    return { success: 0, remain: "?", error: e.message };
  }
}

// ----------------------------------------------------------- Main -----------------------------------------------------------

async function main() {
  log("=== Baidu 链接提交 ===");

  // 环境守卫
  if (!ENABLED) {
    log("  > BAIDU_ENABLED=0，跳过");
    return;
  }

  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    log(`  > VERCEL_ENV=${process.env.VERCEL_ENV}，跳过（仅 production 环境提交）`);
    return;
  }

  // 检查 token
  const TOKEN = process.env.BAIDU_TOKEN || "";
  if (!TOKEN) {
    log("  > BAIDU_TOKEN 未设置，跳过 Baidu 推送");
    log("    提示：在 Baidu 站长平台 ziyuan.baidu.com → 普通收录 → 链接提交 获取 token");
    return;
  }
  log(`  Token: ${TOKEN.slice(0, 6)}...`);

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

  // 百度限制单次最多 2000 条
  const CHUNK_SIZE = 2000;
  let totalSuccess = 0;
  let totalRemain = "?";

  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    log(`\n  提交第 ${Math.floor(i / CHUNK_SIZE) + 1} 批 (${chunk.length} 个)...`);
    const result = await submitToBaidu(TOKEN, chunk);
    totalSuccess += result.success || 0;
    totalRemain = result.remain || totalRemain;

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

  log(`\n=== 完成: ${totalSuccess}/${urls.length} 个 URL 已提交（剩余额度: ${totalRemain}）===`);
}

main().catch(e => {
  console.error("\n[错误]", e.message);
  if (DEBUG) console.error(e.stack);
  process.exit(1);
});
