// PostCSS 插件 for 低版本 iOS Safari
// 为 color-mix() 生成 rgba() fallback

// 遍历所有 @supports (color: color-mix(in lab, red, red)) 块，提取其中的 color-mix() 声明，解析 var() 为已知颜色值，计算 color-mix() 结果为 rgba()，在 @supports 块外部插入对应的 rgba() fallback
// 如此一来，@supports 块内的 color-mix() 值优先级更高，而不支持 color-mix() 的会自动去使用 rgba() fallback，

const postcss = require('postcss');

const CUSTOM_PROPERTIES = {
  '--my-color-black':  { r: 2,   g: 2,   b: 3 },
  '--my-color-red':    { r: 84,  g: 18,  b: 18 },
  '--my-color-green':  { r: 139, g: 154, b: 70 },
  '--my-color-white':  { r: 238, g: 238, b: 238 },
  '--my-color-gray':   { r: 227, g: 227, b: 227 },
  '--my-color-dgray':  { r: 49,  g: 49,  b: 49 },
  '--color-color-black':  { r: 2,   g: 2,   b: 3 },
  '--color-color-red':    { r: 84,  g: 18,  b: 18 },
  '--color-color-green':  { r: 139, g: 154, b: 70 },
  '--color-color-white':  { r: 238, g: 238, b: 238 },
  '--color-color-gray':   { r: 227, g: 227, b: 227 },
  '--color-color-dgray':  { r: 49,  g: 49,  b: 49 },
};

// 解析 color-mix() 函数，返回 rgba() 字符串
function resolveColorMix(value) {
  const colorMixRegex = /color-mix\(\s*in\s+(oklab|srgb|lch|lab)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/gi;

  return value.replace(colorMixRegex, (match, colorSpace, color1Str, color2Str) => {
    const color1 = parseColorArg(color1Str.trim());
    const color2 = parseColorArg(color2Str.trim());

    if (!color1 || !color2) return match;

    const result = mixColors(color1, color2);

    return `rgba(${result.r}, ${result.g}, ${result.b}, ${result.a})`;
  });
}


//解析单个颜色参数
function parseColorArg(arg) {
  arg = arg.trim();

  if (arg === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0, percentage: 0 };
  }

  const varMatch = arg.match(/var\(\s*(--[\w-]+)\s*\)\s+([\d.]+)%/);
  if (varMatch) {
    const rgb = CUSTOM_PROPERTIES[varMatch[1]];
    if (!rgb) return null;
    return {
      r: rgb.r, g: rgb.g, b: rgb.b, a: 1,
      percentage: parseFloat(varMatch[2]) / 100,
    };
  }

  const varOnlyMatch = arg.match(/var\(\s*(--[\w-]+)\s*\)/);
  if (varOnlyMatch) {
    const rgb = CUSTOM_PROPERTIES[varOnlyMatch[1]];
    if (!rgb) return null;
    return { r: rgb.r, g: rgb.g, b: rgb.b, a: 1, percentage: 1 };
  }

  return null;
}

// 混合两个颜色
function mixColors(c1, c2) {
  // 如果第二个颜色是 transparent
  if (c2.a === 0 && c2.percentage === 0) {
    const alpha = Math.round(c1.percentage * 1000) / 1000;
    return { r: c1.r, g: c1.g, b: c1.b, a: Math.min(alpha, 1) };
  }

  // 如果第一个颜色是 transparent
  if (c1.a === 0 && c1.percentage === 0) {
    const alpha = Math.round(c2.percentage * 1000) / 1000;
    return { r: c2.r, g: c2.g, b: c2.b, a: Math.min(alpha, 1) };
  }

  // 一般情况则按比例线性插值
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

module.exports = () => {
  return {
    postcssPlugin: 'postcss-color-mix-fallback',
    OnceExit(root) {

      const fallbacks = new Map();

      // 遍历所有 @supports 规则
      root.walkAtRules('supports', (atRule) => {
        const params = atRule.params;
        if (!/color-mix/i.test(params)) return;

        // 遍历 @supports 块内的所有规则
        atRule.walkRules((rule) => {
          const selector = rule.selector;

          rule.walkDecls((decl) => {
            if (decl.value.includes('color-mix(')) {
              const resolved = resolveColorMix(decl.value);
              if (resolved !== decl.value) {
                if (!fallbacks.has(selector)) {
                  fallbacks.set(selector, []);
                }
                fallbacks.get(selector).push({
                  prop: decl.prop,
                  value: resolved,
                  important: decl.important,
                });
              }
            }
          });
        });
      });

      // 在 @supports 块之前插入 fallback 规则
      if (fallbacks.size > 0) {
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

          for (const [selector, decls] of fallbacks) {
            const newRule = postcss.rule({ selector });
            for (const decl of decls) {
              newRule.append(postcss.decl({
                prop: decl.prop,
                value: decl.value,
                important: decl.important,
              }));
            }
            targetParent.insertBefore(target, newRule);
          }
        }
      }

      // 处理 @supports 块外的 color-mix()
      root.walkDecls((decl) => {
        let parent = decl.parent;
        let inSupports = false;
        while (parent) {
          if (parent.type === 'atrule' && parent.name === 'supports') {
            inSupports = true;
            break;
          }
          parent = parent.parent;
        }

        if (!inSupports && decl.value.includes('color-mix(')) {
          const resolved = resolveColorMix(decl.value);
          if (resolved !== decl.value) {
            decl.value = resolved;
          }
        }
      });
    },
  };
};

module.exports.postcss = true;