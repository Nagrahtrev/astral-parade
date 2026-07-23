// watch-fallback.js

// 监听 tailwind-build.css 变更 -> 运行 color-mix fallback -> 写入 tailwind.css

// 使用方法：在 package.json 的 start 脚本中与 postcss --watch 并行运行
// concurrently "npm run watch" "node scripts/watch-fallback.js" "npm run dev"

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BUILD_CSS = path.resolve(__dirname, '..', 'static', 'css', 'tailwind-build.css');
const OUTPUT_CSS = path.resolve(__dirname, '..', 'static', 'css', 'tailwind-fallback-output.css');
const FINAL_CSS = path.resolve(__dirname, '..', 'static', 'css', 'tailwind.css');

const SCRIPTS_DIR = __dirname;

let pendingRun = false;
let running = false;
let debounceTimer = null;


// 判断文件是否有实际内容
function hasRealContent(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (stat.size < 50) return false;
    return true;
  } catch {
    return false;
  }
}

// 运行
function runFallbackPipeline() {
  if (running) {
    pendingRun = true;
    return;
  }

  // 检查源文件是否存在且有内容
  if (!hasRealContent(BUILD_CSS)) {
    console.log('[watch-fallback] 等待 tailwind-build.css 就绪...');
    return;
  }

  running = true;
  const startTime = Date.now();

  const fallbackScript = path.join(SCRIPTS_DIR, 'run-color-mix-fallback.js');
  const fallback = spawn(process.execPath, [fallbackScript], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let fallbackOutput = '';
  fallback.stdout.on('data', (data) => { fallbackOutput += data.toString(); });
  fallback.stderr.on('data', (data) => { fallbackOutput += data.toString(); });

  fallback.on('close', (code) => {
    if (code !== 0) {
      console.error(`[watch-fallback] !!! 失败 (exit=${code}):\n${fallbackOutput}`);
      running = false;
      return;
    }

    // 读取 fallback 输出并写入 tailwind.css
    if (!fs.existsSync(OUTPUT_CSS)) {
      console.error(`[watch-fallback] !!! 找不到 ${OUTPUT_CSS}`);
      running = false;
      return;
    }

    try {
      const content = fs.readFileSync(OUTPUT_CSS, 'utf8');
      fs.writeFileSync(FINAL_CSS, content, 'utf8');

      // 清理 fallback 临时输出文件
      try { fs.unlinkSync(OUTPUT_CSS); } catch(e) {}

      const rgbaCount = (content.match(/rgba\(\d+/g) || []).length;
      const colorMixCount = (content.match(/color-mix\(/g) || []).length;
      const elapsed = Date.now() - startTime;
      console.log(`[watch-fallback] ${rgbaCount} rgba(), ${colorMixCount} color-mix(), ${content.length} bytes (${elapsed}ms)`);
    } catch (err) {
      console.error(`[watch-fallback] !!! 写入错误:`, err.message);
    }

    running = false;
    if (pendingRun) {
      pendingRun = false;
      runFallbackPipeline();
    }
  });
}

// 文件变更处理
function onFileChange(eventType) {

  // 忽略删除事件
  if (eventType === 'rename' && !fs.existsSync(BUILD_CSS)) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // 再次确认文件存在且有内容
    if (!hasRealContent(BUILD_CSS)) return;
    console.log(`[watch-fallback] 检测到变更, 运行 fallback...`);
    runFallbackPipeline();
  }, 500);
}

// ------------- 启动 -------------

let waitCount = 0;
function waitForBuildCss() {
  if (hasRealContent(BUILD_CSS)) {
    console.log('[watch-fallback] 启动中，首次运行 fallback...');
    runFallbackPipeline();
    startWatching();
  } else {
    waitCount++;
    if (waitCount > 30) {
      console.log('[watch-fallback] 等待超时，启动文件监视模式...');
      startWatching();
      return;
    }
    setTimeout(waitForBuildCss, 500);
  }
}

function startWatching() {
  try {
    fs.watch(BUILD_CSS, onFileChange);
    console.log(`[watch-fallback] 正在监视: ${BUILD_CSS}`);
  } catch (err) {
    console.error(`[watch-fallback] 监视器启动失败:`, err.message);
  }
}

waitForBuildCss();