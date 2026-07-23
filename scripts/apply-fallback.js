// tailwind-fallback-output.css 复制到-> tailwind.css
// 在 run-color-mix-fallback.js 之后运行，同时清理临时文件 tailwind-build.css

const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'static', 'css', 'tailwind-fallback-output.css');
const dest = path.resolve(__dirname, '..', 'static', 'css', 'tailwind.css');
const buildTemp = path.resolve(__dirname, '..', 'static', 'css', 'tailwind-build.css');

if (!fs.existsSync(src)) {
  console.error('错误: 找不到 ' + src);
  console.error('请先运行: node scripts/run-color-mix-fallback.js');
  process.exit(1);
}

const content = fs.readFileSync(src, 'utf8');
fs.writeFileSync(dest, content, 'utf8');

try { fs.unlinkSync(src); } catch(e) {}
try { fs.unlinkSync(buildTemp); } catch(e) {}

const rgbaCount = (content.match(/rgba\(\d+/g) || []).length;
const colorMixCount = (content.match(/color-mix\(/g) || []).length;
console.log(`已应用 color-mix fallback: ${rgbaCount} rgba(), ${colorMixCount} color-mix(), ${content.length} 字节`);
