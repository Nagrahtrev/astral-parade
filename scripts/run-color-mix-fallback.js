// run-color-mix-fallback.js

// 为 Lightning CSS 编译输出的 color-mix() -> var() 降级生成 rgba() fallback
// 能解决不支持 color-mix() 的浏览器上透明度丢失的问题

// 从 @supports 块收集 color-mix() -> rgba() 映射，用 rgba() 替换根级 var() 降级，为未覆盖的 (selector, prop) 插入新 rgba() 规则，并替换 @supports 块外残留的 color-mix()

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const inputFile = path.resolve(__dirname, '../static/css/tailwind-build.css');
const outputFile = path.resolve(__dirname, '../static/css/tailwind-fallback-output.css');

const CUSTOM_PROPERTIES = {
  '--my-color-black':   { r: 2,   g: 2,   b: 3 },
  '--my-color-white':   { r: 238, g: 238, b: 238 },
  '--my-color-red':     { r: 84,  g: 18,  b: 18 },
  '--my-color-green':   { r: 139, g: 154, b: 70 },
  '--my-color-dgray':   { r: 49,  g: 49,  b: 49 },
  '--my-color-gray':    { r: 227, g: 227, b: 227 },
  '--color-color-black':  { r: 2,   g: 2,   b: 3 },
  '--color-color-white':  { r: 238, g: 238, b: 238 },
  '--color-color-red':    { r: 84,  g: 18,  b: 18 },
  '--color-color-green':  { r: 139, g: 154, b: 70 },
  '--color-color-dgray':  { r: 49,  g: 49,  b: 49 },
  '--color-color-gray':   { r: 227, g: 227, b: 227 },
};

// 解析 color-mix() 表达式，返回 rgba() 字符串
/*
 * 【支持格式】
 *  color-mix(in srgb, var(--my-color-black) 20%, transparent)
 *  color-mix(in oklab, var(--color-color-black) 20%, transparent)
 *  color-mix(in srgb, var(--my-color-black) 20%, var(--my-color-white) 80%)
 *  color-mix(in oklab, var(--color-color-black) 20%, var(--color-color-white) 80%)
 *  color-mix(in srgb, var(--my-color-black) 3%, transparent)
 *  支持色空间：oklab, srgb, lch, lab
 */
function resolveColorMix(value) {
  return value.replace(/color-mix\(\s*in\s+(oklab|srgb|lch|lab)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/gi, (match, colorSpace, arg1, arg2) => {
    const c1 = parseColorArg(arg1.trim());
    const c2 = parseColorArg(arg2.trim());
    if (!c1 || !c2) return match;

    const mixed = mixColors(c1, c2);
    if (!mixed) return match;

    return `rgba(${mixed.r}, ${mixed.g}, ${mixed.b}, ${mixed.a})`;
  });
}

// 解析颜色参数
// 格式：var(--my-color-black) 20% 或 transparent
function parseColorArg(arg) {
  if (/^transparent$/i.test(arg)) {
    return { r: 0, g: 0, b: 0, a: 0, percentage: 0 };
  }

  const match = arg.match(/^var\(\s*(--[\w-]+)\s*\)\s+([\d.]+)%$/);
  if (!match) return null;

  const propName = match[1];
  const percentage = parseFloat(match[2]) / 100;

  let color = CUSTOM_PROPERTIES[propName];
  if (!color) {
    // 尝试 --color-color-xxx 映射到 --my-color-xxx
    const altName = propName.replace(/^--color-color-/, '--my-color-');
    color = CUSTOM_PROPERTIES[altName];
  }
  if (!color) return null;

  return { r: color.r, g: color.g, b: color.b, a: 1, percentage };
}

//混合两种颜色
function mixColors(c1, c2) {
  if (c1.a === 0 && c1.percentage === 0) {
    const alpha = Math.round(c2.percentage * 1000) / 1000;
    return { r: c2.r, g: c2.g, b: c2.b, a: Math.min(alpha, 1) };
  }
  if (c2.a === 0 && c2.percentage === 0) {
    const alpha = Math.round(c1.percentage * 1000) / 1000;
    return { r: c1.r, g: c1.g, b: c1.b, a: Math.min(alpha, 1) };
  }
  const totalPct = c1.percentage + c2.percentage;
  const w1 = totalPct > 0 ? c1.percentage / totalPct : 0.5;
  const w2 = totalPct > 0 ? c2.percentage / totalPct : 0.5;
  return {
    r: Math.round(c1.r * w1 + c2.r * w2),
    g: Math.round(c1.g * w1 + c2.g * w2),
    b: Math.round(c1.b * w1 + c2.b * w2),
    a: Math.round((c1.a * w1 + c2.a * w2) * 1000) / 1000,
  };
}


// 检查一个 declaration 是否在 @supports 块内
function isInSupports(decl) {
  let parent = decl.parent;
  while (parent) {
    if (parent.type === 'atrule' && parent.name === 'supports') return true;
    parent = parent.parent;
  }
  return false;
}

// 检查一个 declaration 是否在 @media 块内
function isInMedia(decl) {
  let parent = decl.parent;
  while (parent) {
    if (parent.type === 'atrule' && parent.name === 'media') return true;
    parent = parent.parent;
  }
  return false;
}

async function main() {
  console.log(`读取: ${inputFile}`);
  const css = fs.readFileSync(inputFile, 'utf8');

  console.log('运行 color-mix fallback 插件...');

  const result = await postcss([
    {
      postcssPlugin: 'postcss-color-mix-fallback',
      OnceExit(root) {
        // 1 - 从所有 @supports 块收集 color-mix() -> rgba() 映射
        const colorMixMap = new Map();

        root.walkAtRules('supports', (atRule) => {
          if (!/color-mix/i.test(atRule.params)) return;

          atRule.walkRules((rule) => {
            const selector = rule.selector;
            rule.walkDecls((decl) => {
              if (decl.value.includes('color-mix(')) {
                const resolved = resolveColorMix(decl.value);
                if (resolved !== decl.value) {
                  if (!colorMixMap.has(selector)) {
                    colorMixMap.set(selector, new Map());
                  }
                  const propMap = colorMixMap.get(selector);
                  // 防止 @media 嵌套的条目覆盖根级别的正确值
                  if (!propMap.has(decl.prop)) {
                    propMap.set(decl.prop, {
                      value: resolved,
                      important: decl.important,
                    });
                  }
                }
              }
            });
          });
        });

        // 2 - 用 rgba() 替换根级 var() 降级
        let fixedVarCount = 0;

        root.walkDecls((decl) => {
          if (isInSupports(decl)) return;

          const hasColorVar = /var\(\s*--(?:my-)?color-[\w-]+\s*\)/.test(decl.value);
          if (!hasColorVar) return;

          const selectorMap = colorMixMap.get(decl.parent.selector);
          if (!selectorMap) return;

          const entry = selectorMap.get(decl.prop);
          if (!entry) return;

          decl.value = entry.value;
          if (entry.important) {
            decl.important = true;
          }
          fixedVarCount++;
        });

        console.log(`  修复了 ${fixedVarCount} 个 Lightning CSS var() 降级`);

        // 3 - 为未覆盖的 (selector, prop) 插入新 rgba() 规则
        if (colorMixMap.size > 0) {
          let firstSupports = null;
          root.walkAtRules('supports', (atRule) => {
            if (/color-mix/i.test(atRule.params)) {
              if (!firstSupports) firstSupports = atRule;
            }
          });

          if (firstSupports) {
            // 找到根级别的祖先节点
            let target = firstSupports;
            let targetParent = firstSupports.parent;
            while (targetParent.type !== 'root') {
              target = targetParent;
              targetParent = targetParent.parent;
            }

            let insertedRuleCount = 0;

            for (const [selector, propMap] of colorMixMap) {
              // 找出已修复的 (selector, prop)，只插入未覆盖的
              const alreadyFixed = new Set();
              root.walkRules(rule => {
                if (rule.selector === selector && !isInSupports(rule)) {
                  rule.walkDecls(decl => {
                    if (decl.value.startsWith('rgba(')) {
                      alreadyFixed.add(decl.prop);
                    }
                  });
                }
              });

              const newDecls = [];
              for (const [prop, entry] of propMap) {
                if (!alreadyFixed.has(prop)) {
                  newDecls.push({ prop, value: entry.value, important: entry.important });
                }
              }

              if (newDecls.length > 0) {
                const newRule = postcss.rule({ selector });
                for (const decl of newDecls) {
                  newRule.append(postcss.decl({
                    prop: decl.prop,
                    value: decl.value,
                    important: decl.important,
                  }));
                }
                targetParent.insertBefore(target, newRule);
                insertedRuleCount++;
              }
            }

            console.log(`  插入了 ${insertedRuleCount} 条新 rgba() 规则`);
          }
        }

        // 4 - 替换 @supports 块外的 color-mix()
        let inlineReplacedCount = 0;
        root.walkDecls((decl) => {
          if (!isInSupports(decl) && decl.value.includes('color-mix(')) {
            const resolved = resolveColorMix(decl.value);
            if (resolved !== decl.value) {
              decl.value = resolved;
              inlineReplacedCount++;
            }
          }
        });
        if (inlineReplacedCount > 0) {
          console.log(`  内联替换了 ${inlineReplacedCount} 个 color-mix()`);
        }
      },
    },
  ]).process(css, {
    from: inputFile,
    to: outputFile,
  });

  // 写入output
  fs.writeFileSync(outputFile, result.css, { encoding: 'utf8' });
  console.log(`已写入: ${outputFile}`);

  // 验证
  const writtenCss = fs.readFileSync(outputFile, 'utf8');
  const colorMixCount = (writtenCss.match(/color-mix\(/g) || []).length;
  const rgbaCount = (writtenCss.match(/rgba\(\d+/g) || []).length;
  const varColorCount = (writtenCss.match(/var\(\s*--(?:my|color)-color-/g) || []).length;
  console.log(`剩余 color-mix(): ${colorMixCount}`);
  console.log(`rgba() 总数: ${rgbaCount}`);
  console.log(`剩余 var(--color-*): ${varColorCount}`);
  console.log(`文件大小: ${writtenCss.length} 字节`);
}

main().catch((err) => {
  console.error('错误:', err);
  process.exit(1);
});