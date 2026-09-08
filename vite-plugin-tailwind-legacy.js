import fs from "fs";
import path from "path";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import postcssPresetEnv from "postcss-preset-env";
import postcssMediaMinmax from "postcss-media-minmax";
import postcssNesting from "postcss-nesting";
import * as culori from "culori";

const SPACING_MULTIPLIER = 4;
const UNSUPPORTED_PROPS = [
  'field-sizing', 'container', 'container-type',
  'container-name', 'accent-color'
];

const PEER_CSS = `.peer:-moz-placeholder-shown~.peer-placeholder-shown\\:top-1\\/2{top:50%}.peer:placeholder-shown~.peer-placeholder-shown\\:top-1\\/2{top:50%}.peer:-moz-placeholder-shown~.peer-placeholder-shown\\:-translate-y-1\\/2{--tw-translate-y:-50%;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.peer:placeholder-shown~.peer-placeholder-shown\\:-translate-y-1\\/2{--tw-translate-y:-50%;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.peer:-moz-placeholder-shown~.peer-placeholder-shown\\:scale-100{--tw-scale-x:1;--tw-scale-y:1;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.peer:placeholder-shown~.peer-placeholder-shown\\:scale-100{--tw-scale-x:1;--tw-scale-y:1;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.peer:focus~.peer-focus\\:top-2{top:.5rem}.peer:focus~.peer-focus\\:z-4{z-index:4}.peer:focus~.peer-focus\\:ml-0{margin-left:0}.peer:focus~.peer-focus\\:-translate-y-5{--tw-translate-y:-1.25rem}.peer:focus~.peer-focus\\:-translate-y-5,.peer:focus~.peer-focus\\:scale-75{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}.peer:focus~.peer-focus\\:scale-75{--tw-scale-x:.75;--tw-scale-y:.75}.peer:focus~.peer-focus\\:px-2{padding-left:.5rem;padding-right:.5rem}.peer:disabled~.peer-disabled\\:cursor-not-allowed{cursor:not-allowed}.peer:disabled~.peer-disabled\\:opacity-50{opacity:.5}.peer:disabled~.peer-disabled\\:opacity-70{opacity:.7}`;
const RESET_CSS = `*,::before,::after{box-sizing:border-box;border:0 solid #e5e7eb}::before,::after{--tw-content:""}*,::backdrop,::before,::after{--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-ring-offset-width:0px}`;

const variableCache = new Map();
const colorCache = new Map();

let originalVariables = {
  light: new Map(),
  dark: new Map(),
};
const processedDeclarations = new WeakSet();

function replacePeerRules(root) {
  root.walkRules((rule) => {
    if (rule.selector?.includes('peer')) rule.remove();
  });
  const parsed = postcss.parse(PEER_CSS);
  for (const node of parsed.nodes || []) {
    root.append(node.clone());
  }
}

function replaceTransformRule(root) {
  let found = false;
  root.walkRules((rule) => {
    if (!rule.selector) return;
    const selectors = rule.selector.split(',').map(s => s.trim());
    if (!selectors.some(s => s.includes('.transform'))) return;
    
    found = true;
    rule.walkDecls(/^(transform|--tw-(translate-[xy]|rotate(-[xyz])?|skew-[xy]|scale-[xy]))$/, decl => decl.remove());
    
    rule.append({
      prop: 'transform',
      value: 'translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))'
    });
  });
  return found;
}

function injectTailwindReset(root) {
  const resetRoot = postcss.parse(RESET_CSS);
  const nodes = resetRoot.nodes || [];
  for (let i = nodes.length - 1; i >= 0; i--) {
    root.prepend(nodes[i]);
  }
}

function captureOriginalVariables(root) {
  originalVariables = { light: new Map(), dark: new Map() };

  root.walkRules((rule) => {
    const selector = rule.selector?.trim();
    if (!selector) return;

    const isDark = selector.includes(".dark") || selector.includes('[data-theme="dark"]');
    const isLight = selector === ":root" || selector === "html" || selector.includes(":root");

    if (!isDark && !isLight) return;

    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith("--")) return;
      let value = decl.value;
      if (value?.includes("oklch(")) {
        value = convertOklchInString(value, "rgb");
      }
      if (isDark) originalVariables.dark.set(decl.prop, value);
      else if (isLight) originalVariables.light.set(decl.prop, value);
    });
  });

  for (const [name, value] of originalVariables.light) variableCache.set(`light:${name}`, value);
  for (const [name, value] of originalVariables.dark) variableCache.set(`dark:${name}`, value);
}

function resolveVariableWithCache(varName, root, isDark = false, depth = 0) {
  if (depth > 5) return null;

  const cacheKey = `${isDark ? "dark:" : "light:"}${varName}`;
  if (variableCache.has(cacheKey) && depth === 0) return variableCache.get(cacheKey);

  const primaryMap = isDark ? originalVariables.dark : originalVariables.light;
  const fallbackMap = isDark ? originalVariables.light : originalVariables.dark;

  let value = primaryMap.get(varName) || fallbackMap.get(varName);
  if (!value) return null;

  if (value.includes("var(")) {
    const innerMatch = value.match(/var\((--[^,)]+)/);
    if (innerMatch) {
      const resolvedInner = resolveVariableWithCache(innerMatch[1], root, isDark, depth + 1);
      if (resolvedInner) value = resolvedInner;
    }
  }

  if (value?.includes("oklch(")) {
    value = convertOklchInString(value, "rgb");
  }

  if (value && depth === 0) {
    variableCache.set(cacheKey, value);
  }

  return value;
}

function restoreVariables(root) {
  let count = 0;
  const targetProps = new Set(['background-color', 'color', 'border-color', 'outline-color', 'text-decoration-color', 'fill', 'stroke']);
  const colorPrefixes = ['bg-', 'text-', 'border-', 'outline-', 'decoration-', 'fill-', 'stroke-'];

  root.walkRules((rule) => {
    if (!rule.selector || rule.selector.includes('/')) return;

    rule.walkDecls((decl) => {
      if (!targetProps.has(decl.prop) || !/\brgba?\(/i.test(decl.value)) return;

      const classes = rule.selector.match(/\.([a-zA-Z0-9_-]+)/g);
      if (!classes) return;

      for (const cls of classes) {
        const className = cls.slice(1);
        const prefix = colorPrefixes.find(p => className.startsWith(p));
        if (!prefix) continue;

        const colorName = className.slice(prefix.length);
        const varName = `--${colorName}`;
        let exists = false;

        root.walkDecls(varName, () => { exists = true; });
        if (!exists) continue;

        decl.value = `var(${varName})`;
        count++;
        break;
      }
    });
  });

  return count;
}

function fixAllDarkModeSelectors(root) {
  let count = 0;

  root.walkAtRules('supports', (atRule) => {
    if (atRule.params?.includes('color-mix')) {
      atRule.remove();
      count++;
    }
  });

  root.walkRules((rule) => {
    if (!rule.selector) return;

    let selector = rule.selector;
    if (selector.includes(':is(.dark')) {
      selector = selector.replace(/:is\(\.dark\s+([^)]+)\)/g, '.dark $1')
                         .replace(/:is\(\.dark\*\)/g, '.dark');
    }
    selector = selector.replace(/\.dark\s+\.dark(\s+|$)/g, '.dark$1').replace(/\s+/g, ' ').trim();

    if (selector !== rule.selector) {
      rule.selector = selector;
      count++;
    }

    let hasColorMix = false;
    rule.walkDecls((decl) => {
      if (decl.value?.includes('color-mix')) {
        hasColorMix = true;
        const varMatch = decl.value.match(/var\((--[^)]+)\)/);
        if (varMatch) decl.value = `var(${varMatch[1]})`;
        else decl.remove();
      }
    });

    if (hasColorMix && (!rule.nodes || rule.nodes.length === 0)) {
      rule.remove();
      count++;
    }
  });

  return count;
}

function convertSpacingClasses(root) {
  let count = 0;
  const convertedSelectors = new Set();
  const rulesToConvert = [];
  
  root.walkRules((rule) => {
    if (!rule.selector || convertedSelectors.has(rule.selector) || rule.selector.includes('> *')) return;
    
    const spaceMatch = rule.selector.match(/\.(space)-([xy])-(\d+)/);
    if (!spaceMatch) return;
    
    rulesToConvert.push({
      rule,
      type: spaceMatch[1],
      direction: spaceMatch[2] || '',
      value: parseInt(spaceMatch[3])
    });
  });
  
  for (const { rule, type, direction, value } of rulesToConvert) {
    try {
      const pixelValue = `${value * SPACING_MULTIPLIER}px`;
      const halfValue = `${(value * SPACING_MULTIPLIER) / 2}px`;
      
      const declarations = [];
      rule.walkDecls((decl) => declarations.push({ prop: decl.prop, value: decl.value }));
      
      const parent = rule.parent;
      const index = parent.index(rule);
      rule.remove();
      
      let newSelector;
      let newDeclarations = [];
      
      if (type === 'space') {
        newSelector = `.space-${direction}-${value} > *:not(:last-child)`;
        newDeclarations = [{ prop: direction === 'y' ? 'margin-bottom' : 'margin-right', value: pixelValue }];
      } else {
        if (direction === 'x') {
          newSelector = `.gap-x-${value}`;
          newDeclarations = [{ prop: 'margin-left', value: halfValue }, { prop: 'margin-right', value: halfValue }];
        } else if (direction === 'y') {
          newSelector = `.gap-y-${value}`;
          newDeclarations = [{ prop: 'margin-top', value: halfValue }, { prop: 'margin-bottom', value: halfValue }];
        } else {
          newSelector = `.gap-${value}`;
          newDeclarations = [
            { prop: 'margin-top', value: halfValue },
            { prop: 'margin-bottom', value: halfValue },
            { prop: 'margin-left', value: halfValue },
            { prop: 'margin-right', value: halfValue }
          ];
        }
      }
      
      convertedSelectors.add(newSelector);
      const newRule = postcss.rule({ selector: newSelector });
      
      const ignoredProps = new Set(['gap', 'row-gap', 'column-gap', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'margin', '--tw-space-y-reverse', '--tw-space-x-reverse', 'margin-block-start', 'margin-block-end']);
      for (const decl of declarations) {
        if (!ignoredProps.has(decl.prop)) newRule.append({ prop: decl.prop, value: decl.value });
      }
      
      for (const decl of newDeclarations) {
        let exists = false;
        newRule.walkDecls((d) => { if (d.prop === decl.prop) exists = true; });
        if (!exists) newRule.append({ prop: decl.prop, value: decl.value });
      }
      
      if (parent.nodes[index]) parent.insertBefore(parent.nodes[index], newRule);
      else parent.append(newRule);
      
      count++;
    } catch (_) {}
  }
  
  return count;
}

function convertClassesWithOpacity(root) {
  let count = 0;
  const targetRules = [];

  root.walkRules((rule) => {
    if (!rule.selector) return;
    if (rule.selector.includes('/') || rule.selector.includes('\\/')) {
      if (/\b(bg|text|border|from|to|via|accent|ring|outline|decoration|shadow|divide|placeholder|caret|selection|marker|scrollbar|file)-/.test(rule.selector) || rule.selector.includes('ring')) {
        targetRules.push(rule);
      }
    }
  });

  const newDarkRules = [];

  for (const rule of targetRules) {
    if (!rule.parent) continue;

    try {
      const rawSelectors = rule.selector.split(',').map(s => s.trim());
      const parent = rule.parent;
      const index = parent.index(rule);

      const declarations = [];
      rule.walkDecls((decl) => declarations.push({ prop: decl.prop, value: decl.value }));
      rule.remove();

      for (const selector of rawSelectors) {
        const hasOpacity = selector.includes('/') || selector.includes('\\/');
        let opacity = 1;

        if (hasOpacity) {
          const match = selector.match(/\\?\/([0-9.]+)/);
          if (match) {
            const val = parseFloat(match[1]);
            opacity = val > 1 ? val / 100 : val;
          }
        }

        const newRule = postcss.rule({ selector });
        for (const decl of declarations) newRule.append({ prop: decl.prop, value: decl.value });

        const createdDarkRule = processRule(newRule, hasOpacity, opacity, root);
        parent.insertBefore(parent.nodes[index] || null, newRule);

        if (createdDarkRule) {
          newDarkRules.push({ parent, darkRule: createdDarkRule });
        }
      }
      count++;
    } catch (_) {}
  }

  for (const { parent, darkRule } of newDarkRules) {
    parent.append(darkRule);
  }

  return count;
}

function processRule(rule, hasOpacity, opacity, root) {
  let createdDarkRule = null;

  rule.walkDecls((decl) => {
    if (!decl.value) return;
    if (!/^(background|color|border|outline|text|fill|stroke|caret|accent|decoration|ring|shadow|--tw-ring-color|--tw-ring)/.test(decl.prop)) return;

    try {
      let selector = rule.selector || "";
      let cleanSelector = selector.replace(/\\\//g, '/');
      let isDark = selector.includes(".dark ") || selector.startsWith(".dark.") || selector.startsWith(".dark ") || selector.startsWith(".dark\\:") || selector.includes(" .dark\\:");

      if (isDark || !hasOpacity) return;

      let fullMatch = cleanSelector.match(/\.([a-zA-Z0-9_-]+)\\?\/([0-9.]+)/) || cleanSelector.match(/ring-([a-zA-Z0-9_-]+)\/([0-9.]+)/);
      if (!fullMatch) return;

      const className = fullMatch[1];
      const opacidade = fullMatch[2];
      const isRing = className.startsWith('ring-') || decl.prop === '--tw-ring-color' || decl.prop === '--tw-ring' || selector.includes('ring');

      if (!isRing) rule.selector = `.${className}\\/${opacidade}`;

      let rgb = null;
      let originalVarName = null;

      if (decl.value.includes("var(")) {
        const varMatches = decl.value.match(/var\((--[^,)]+)\)/g);
        if (varMatches) {
          for (const varMatch of varMatches) {
            const varNameMatch = varMatch.match(/var\((--[^,)]+)\)/);
            if (!varNameMatch) continue;
            originalVarName = varNameMatch[1];
            const varValue = resolveVariableWithCache(originalVarName, root, false);
            if (varValue) {
              const extracted = extractRgbWithCache(varValue);
              if (extracted) {
                rgb = extracted;
                break;
              }
            }
          }
        }
      }

      if (!rgb) rgb = extractRgbWithCache(decl.value);
      if (!rgb) return;

      const finalOpacity = hasOpacity ? opacity : 1;
      const rgbFormatted = `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`;

      if (isRing || decl.prop === '--tw-ring-color' || decl.prop === '--tw-ring' || finalOpacity < 1) {
        decl.value = `rgba(${rgbFormatted}, ${finalOpacity})`;
      } else {
        decl.value = `rgb(${rgbFormatted})`;
      }
      processedDeclarations.add(decl);

      rule.walkDecls('--tw-ring-opacity', (d) => d.remove());

      const darkSelector = isRing ? `.dark ${selector}` : `.dark .${className}\\/${opacidade}`;
      let darkRuleExists = false;

      root.walkRules((existingRule) => {
        if (existingRule.selector === darkSelector) darkRuleExists = true;
      });

      if (!darkRuleExists) {
        let darkRgb = originalVarName ? extractRgbWithCache(resolveVariableWithCache(originalVarName, root, true)) : null;
        if (!darkRgb) darkRgb = rgb;

        const darkRule = postcss.rule({ selector: darkSelector });
        const darkDecl = decl.clone();
        const darkRgbFormatted = `${Math.round(darkRgb.r)}, ${Math.round(darkRgb.g)}, ${Math.round(darkRgb.b)}`;

        if (isRing || decl.prop === '--tw-ring-color' || decl.prop === '--tw-ring' || finalOpacity < 1) {
          darkDecl.value = `rgba(${darkRgbFormatted}, ${finalOpacity})`;
        } else {
          darkDecl.value = `rgb(${darkRgbFormatted})`;
        }

        darkRule.append(darkDecl);
        createdDarkRule = darkRule;
      }
    } catch (_) {}
  });

  return createdDarkRule;
}

function convertAllColorMix(root) {
  let count = 0;

  root.walkRules((rule) => {
    if (!rule.selector) return;

    const selector = rule.selector;
    if (/(?:bg|text|border|from|to|via|accent|ring|outline|decoration|shadow|divide|placeholder|caret|selection|marker|scrollbar|file)-[^,]*\\?\/[0-9.]+/.test(selector)) return;

    const isDark = selector.includes(".dark ") || selector.startsWith(".dark.") || selector.startsWith(".dark ") || selector.startsWith(".dark\\:") || selector.includes(" .dark\\:") || selector.includes(":is(.dark");

    rule.walkDecls((decl) => {
      if (!decl.value?.includes("color-mix") || processedDeclarations.has(decl)) return;

      try {
        let newValue = decl.value;
        const matches = decl.value.match(/color-mix\([^)]*\)/g);
        if (!matches) return;

        matches.forEach((match) => {
          const converted = convertSingleColorMix(match, root, isDark);
          if (converted && converted !== match) {
            newValue = newValue.replace(match, converted);
            count++;
          }
        });

        if (newValue !== decl.value) {
          decl.value = newValue;
          processedDeclarations.add(decl);
        }
      } catch (_) {}
    });
  });

  return count;
}

function convertSingleColorMix(colorMixStr, root, isDark = false) {
  try {
    const content = colorMixStr.slice(11, -1);
    const parts = content.split(",");
    if (parts.length < 3) return colorMixStr;

    const baseColorPart = parts[1].trim();
    const mixColorPart = parts[2].trim();

    let baseColor = baseColorPart, basePercentage = 100;
    const baseMatch = baseColorPart.match(/^(var\(--[^)]+\))\s*([0-9.]+)%/);
    if (baseMatch) {
      baseColor = baseMatch[1];
      basePercentage = parseFloat(baseMatch[2]);
    }

    let mixColor = mixColorPart, mixPercentage = 50;
    const mixMatch = mixColorPart.match(/^(var\(--[^)]+\)|[a-zA-Z]+)\s*([0-9.]+)%/);
    if (mixMatch) {
      mixColor = mixMatch[1];
      mixPercentage = parseFloat(mixMatch[2]);
    }

    let baseValue = baseColor;
    if (baseColor.startsWith("var(--")) {
      const varName = baseColor.match(/var\((--[^)]+)\)/);
      if (varName) baseValue = resolveVariableWithCache(varName[1], root, isDark) || baseValue;
    }

    let mixValue = mixColor;
    if (mixColor.startsWith("var(--")) {
      const varName = mixColor.match(/var\((--[^)]+)\)/);
      if (varName) mixValue = resolveVariableWithCache(varName[1], root, isDark) || mixValue;
    }

    if (baseValue.includes("var(--") || mixValue.includes("var(--")) return colorMixStr;

    const baseRgb = extractRgbWithCache(baseValue);
    const mixRgb = extractRgbWithCache(mixValue);
    if (!baseRgb || !mixRgb) return colorMixStr;

    const mixRatio = mixPercentage / 100;
    const baseRatio = basePercentage / 100;
    const total = baseRatio + mixRatio;

    const finalBaseRatio = baseRatio / total;
    const finalMixRatio = mixRatio / total;

    const r = Math.round(baseRgb.r * finalBaseRatio + mixRgb.r * finalMixRatio);
    const g = Math.round(baseRgb.g * finalBaseRatio + mixRgb.g * finalMixRatio);
    const b = Math.round(baseRgb.b * finalBaseRatio + mixRgb.b * finalMixRatio);
    const a = baseRgb.a !== undefined ? baseRgb.a * finalBaseRatio + (mixRgb.a || 1) * finalMixRatio : 1;

    return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(4)})` : `rgb(${r}, ${g}, ${b})`;
  } catch (_) {
    return colorMixStr;
  }
}

function extractRgbWithCache(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return null;
  colorStr = colorStr.trim();
  if (colorCache.has(colorStr)) return colorCache.get(colorStr);
  
  const result = extractRgb(colorStr);
  colorCache.set(colorStr, result);
  return result;
}

function extractRgb(colorStr) {
  if (!colorStr) return null;
  
  let match = colorStr.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/) ||
              colorStr.match(/rgb\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\s*\)/);
  if (match) {
    return { r: parseFloat(match[1]), g: parseFloat(match[2]), b: parseFloat(match[3]), a: match[4] ? parseFloat(match[4]) : 1 };
  }
  
  match = colorStr.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (match) {
    return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16), a: 1 };
  }
  
  match = colorStr.match(/#([0-9a-f])([0-9a-f])([0-9a-f])/i);
  if (match) {
    return { r: parseInt(match[1] + match[1], 16), g: parseInt(match[2] + match[2], 16), b: parseInt(match[3] + match[3], 16), a: 1 };
  }
  
  const colorNames = {
    'white': { r: 255, g: 255, b: 255, a: 1 },
    'black': { r: 0, g: 0, b: 0, a: 1 },
    'transparent': { r: 0, g: 0, b: 0, a: 0 },
  };
  
  return colorNames[colorStr.toLowerCase().trim()] || null;
}

function convertTailwindOpacity(root) {
  let count = 0;
  
  root.walkAtRules('supports', (supportsRule) => {
    if (!supportsRule.params?.includes('color-mix')) return;
    
    const newRules = [];
    (supportsRule.nodes || []).forEach(child => {
      if (child.type !== 'rule') return;
      
      const newRule = child.clone();
      let hasConversion = false;
      
      newRule.walkDecls((decl) => {
        if (!decl.value?.includes('color-mix') || processedDeclarations.has(decl)) return;
        
        try {
          const match = decl.value.match(/color-mix\([^,]+,\s*var\((--[^)]+)\)\s*([0-9.]+)%/);
          if (!match) return;
          
          const opacity = parseFloat(match[2]) / 100;
          const isDark = child.selector?.includes(".dark\\:") || child.selector?.includes(".dark");
          const varValue = resolveVariableWithCache(match[1], root, isDark);
          if (!varValue) return;
          
          const rgb = extractRgbWithCache(varValue);
          if (rgb) {
            decl.value = `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${opacity})`;
            hasConversion = true;
            count++;
            processedDeclarations.add(decl);
          }
        } catch (_) {}
      });
      
      if (hasConversion) newRules.push(newRule);
    });
    
    if (newRules.length > 0) {
      newRules.forEach(rule => supportsRule.parent.insertBefore(supportsRule, rule));
    }
    supportsRule.remove();
  });
  
  return count;
}

function convertOklchInString(value, colorFormat = 'rgb') {
  if (!value || typeof value !== 'string' || !value.includes('oklch(')) return value;
  
  return value.replace(/oklch\([^)]*\)/g, (match) => {
    try {
      const parsed = culori.parse(match);
      if (!parsed) return match;
      
      if (colorFormat === 'hsl') {
        const hsl = culori.converter('hsl')(parsed);
        if (hsl) {
          const alpha = hsl.alpha !== undefined && hsl.alpha !== 1 ? `, ${hsl.alpha}` : '';
          return `hsl(${Math.round(hsl.h || 0)}, ${Math.round((hsl.s || 0) * 100)}%, ${Math.round((hsl.l || 0) * 100)}%${alpha})`;
        }
      } else {
        const rgb = culori.converter('rgb')(parsed);
        if (rgb) {
          const alpha = rgb.alpha !== undefined && rgb.alpha !== 1 ? `, ${rgb.alpha}` : '';
          return `rgb(${Math.round((rgb.r || 0) * 255)}, ${Math.round((rgb.g || 0) * 255)}, ${Math.round((rgb.b || 0) * 255)}${alpha})`;
        }
      }
      return match;
    } catch (_) {
      return match;
    }
  });
}

function convertVariableWithOpacity(value, root) {
  const match = value.match(/var\((--[^)]+)\)\s*\/\s*([0-9.]+)/);
  if (!match) return value;
  
  try {
    const opacityValue = parseFloat(match[2]);
    const opacity = opacityValue > 1 ? opacityValue / 100 : opacityValue;
    const varValue = resolveVariableWithCache(match[1], root, false);
    if (!varValue) return value;

    const rgb = extractRgbWithCache(varValue);
    if (rgb) return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${opacity})`;
  } catch (_) {}
  
  return value;
}

function convertGradientOpacity(root) {
  let count = 0;
  
  root.walkDecls((decl) => {
    if (!decl.value || processedDeclarations.has(decl)) return;
    if (decl.prop.startsWith('--tw-gradient-')) {
      try {
        const match = decl.value.match(/var\((--[^)]+)\)\s*([0-9.]+)%/);
        if (match) {
          const opacity = parseFloat(match[2]) / 100;
          const varValue = resolveVariableWithCache(match[1], root, false);
          if (varValue) {
            const rgb = extractRgbWithCache(varValue);
            if (rgb) {
              decl.value = `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${opacity})`;
              count++;
              processedDeclarations.add(decl);
            }
          }
        }
      } catch (_) {}
    }
  });
  
  return count;
}

function convertRingPseudoClasses(root) {
  let count = 0;

  root.walkRules((rule) => {
    if (!rule.selector) return;
    const { selector } = rule;
    if (!selector.includes('ring') || (!selector.includes('/') && !selector.includes('\\/')) || !selector.includes(':')) return;
    
    let hasVar = false;
    rule.walkDecls((decl) => {
      if (decl.value?.includes('var(')) hasVar = true;
    });
    if (!hasVar) return;

    try {
      const newRule = rule.clone();
      let modified = false;

      newRule.walkDecls((decl) => {
        if (!decl.value?.includes('var(') || processedDeclarations.has(decl)) return;

        const varMatch = decl.value.match(/var\((--[^)]+)\)/);
        if (!varMatch) return;

        const varName = varMatch[1];
        const lightRgb = extractRgbWithCache(resolveVariableWithCache(varName, root, false));
        if (!lightRgb) return;

        const darkRgb = extractRgbWithCache(resolveVariableWithCache(varName, root, true)) || lightRgb;
        const opacityMatch = selector.match(/\\?\/([0-9.]+)/);
        if (!opacityMatch) return;

        const opacityValue = parseFloat(opacityMatch[1]);
        const finalOpacity = opacityValue > 1 ? opacityValue / 100 : opacityValue;

        decl.value = `rgba(${Math.round(lightRgb.r)}, ${Math.round(lightRgb.g)}, ${Math.round(lightRgb.b)}, ${finalOpacity})`;
        modified = true;
        processedDeclarations.add(decl);
        count++;

        newRule.walkDecls('--tw-ring-opacity', (d) => d.remove());

        const darkSelector = `.dark ${selector}`;
        let darkRuleExists = false;
        root.walkRules((existingRule) => {
          if (existingRule.selector === darkSelector) darkRuleExists = true;
        });

        if (!darkRuleExists && darkRgb) {
          const darkRule = postcss.rule({ selector: darkSelector });
          const darkDecl = decl.clone();
          darkDecl.value = `rgba(${Math.round(darkRgb.r)}, ${Math.round(darkRgb.g)}, ${Math.round(darkRgb.b)}, ${finalOpacity})`;
          darkRule.append(darkDecl);
          root.append(darkRule);
        }
      });

      if (modified) rule.replaceWith(newRule);
    } catch (_) {}
  });

  return count;
}

function legacyTransformPlugin(options = {}) {
  const { colorFormat = 'rgb' } = options;
  
  return {
    postcssPlugin: 'legacy-transform',
    
    Root(root) {
      variableCache.clear();
      colorCache.clear();
      replacePeerRules(root);
      replaceTransformRule(root);
      injectTailwindReset(root);
      captureOriginalVariables(root);

      const conversionSteps = [
        convertClassesWithOpacity,
        convertRingPseudoClasses,
        convertAllColorMix,
        convertTailwindOpacity,
        convertGradientOpacity,
        fixAllDarkModeSelectors,
        convertSpacingClasses,
        restoreVariables,
      ];
      
      for (const step of conversionSteps) {
        try { step(root); } catch (_) {}
      }
      
      root.walkDecls((decl) => {
        if (!decl.value || processedDeclarations.has(decl)) return;
        if (decl.value.includes('var(--') && decl.value.includes('/')) {
          try {
            const converted = convertVariableWithOpacity(decl.value, root);
            if (converted !== decl.value) {
              decl.value = converted;
              processedDeclarations.add(decl);
            }
          } catch (_) {}
        }
      });

      root.walkDecls((decl) => {
        if (decl.value?.includes('oklch(')) {
          const original = decl.value;
          decl.value = convertOklchInString(decl.value, colorFormat);
          if (original !== decl.value) processedDeclarations.add(decl);
        }
      });

      ['layer', 'container'].forEach(name => {
        root.walkAtRules(name, (rule) => {
          (rule.nodes || []).forEach(child => rule.parent.insertBefore(rule, child));
          rule.remove();
        });
      });

      const propertyVariables = {};
      const propertiesToConvert = [];
      
      root.walkAtRules('property', (rule) => {
        let initialValue = null;
        rule.walkDecls('initial-value', (decl) => { initialValue = decl.value; });
        const varName = rule.params.trim();
        if (varName && initialValue !== null) {
          propertyVariables[varName] = convertOklchInString(initialValue, colorFormat);
          propertiesToConvert.push(rule);
        }
      });
      
      if (Object.keys(propertyVariables).length > 0) {
        let rootRule = null;
        root.walkRules(':root', (rule) => { rootRule = rule; });
        if (!rootRule) {
          rootRule = postcss.rule({ selector: ':root' });
          root.prepend(rootRule);
        }
        Object.entries(propertyVariables).forEach(([name, value]) => {
          let exists = false;
          rootRule.walkDecls(name, () => { exists = true; });
          if (!exists) rootRule.append({ prop: name, value });
        });
        propertiesToConvert.forEach(rule => rule.remove());
      }
      
      root.walkDecls((decl) => {
        if (!decl.value) return;
        decl.value = decl.value.replace(/\s*\bin\s+[a-z0-9_-]+\b/gi, '').trim();
      });
      
      root.walkRules((rule) => {
        let hasShorthand = false;
        const defaults = { rotate: [0, 0, 1, '0deg'], scale: [1, 1, 1], translate: [0, 0, 0] };
        
        rule.walkDecls(/^(rotate|scale|translate)$/, () => { hasShorthand = true; });
        if (!hasShorthand) return;
        
        const values = {};
        const declsToRemove = [];
        
        rule.walkDecls(/^(rotate|scale|translate)$/, (decl) => {
          const newValues = [...defaults[decl.prop]];
          const userValues = postcss.list.space(decl.value.replaceAll(/\)\s*var\(/g, ') var('));
          if (decl.prop === 'rotate' && userValues.length === 1) {
            newValues.splice(-1, 1, ...userValues);
          } else {
            newValues.splice(0, userValues.length, ...userValues);
          }
          values[decl.prop] = newValues;
          declsToRemove.push(decl);
        });
        
        const transformParts = ['translate', 'rotate', 'scale']
          .filter(p => values[p])
          .map(p => `${p}3d(${values[p].join(',')})`);
        
        if (transformParts.length > 0) {
          let hasTransform = false;
          rule.walkDecls('transform', () => { hasTransform = true; });
          if (!hasTransform) rule.append({ prop: 'transform', value: transformParts.join(' ') });
          declsToRemove.forEach(decl => decl.remove());
        }
      });
      
      root.walkDecls((decl) => {
        if (UNSUPPORTED_PROPS.includes(decl.prop)) decl.remove();
        else if (decl.value?.includes('var(')) {
          decl.value = decl.value.replace(/var\(([^,]+),\s*\)/g, 'var($1, )');
        }
      });
    }
  };
}

legacyTransformPlugin.postcss = true;

export default function TailwindLegacyPlugin(options = {}) {
  const {
    assetsDir = "dist/client/assets",
    publicPath = "/static/assets/",
    buildDir = "dist",
    injectInHTML = true,
    deleteStyles = [],
    outputCSSName = "tailwind-v3-legacy.css",
    browserScriptName = "browser-check.js",
    colorFormat = 'rgb',
    browsers = ["Chrome >= 90", "Opera >= 76", "Edge >= 90", "Firefox >= 88", "Safari >= 14"],
  } = options;

  let executed = false;

  return {
    name: "vite:vite-plugin-tailwind-legacy",
    apply: "build",
    enforce: "post",

    async closeBundle() {
      const root = process.cwd();

      // Trava do Vike SSG para rodar na 2ª etapa quando os HTMLs estiverem prontos
      const absoluteBuildDirCheck = path.resolve(root, buildDir);
      const htmlFilesCheck = [];
      findFiles(absoluteBuildDirCheck, (file) => {
        if (file.endsWith(".html")) htmlFilesCheck.push(file);
      });

      if (injectInHTML && htmlFilesCheck.length === 0 && !executed) {
        return;
      }

      if (executed) return;
      executed = true;

      console.info('[tailwind-legacy] 🚀 Processing CSS...');

      const possibleDirs = [path.resolve(root, buildDir), path.resolve(root, "dist/client"), path.resolve(root, "dist")];

      let absoluteBuildDir = null;
      let absoluteAssetsDir = null;

      for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
          absoluteBuildDir = dir;
          const assetsPath = path.join(dir, "assets");
          absoluteAssetsDir = fs.existsSync(assetsPath) ? assetsPath : path.resolve(root, assetsDir);
          break;
        }
      }

      if (!absoluteBuildDir) {
        console.warn('[tailwind-legacy] ⚠️ Build directory not found');
        return;
      }

      if (!absoluteAssetsDir) {
        absoluteAssetsDir = path.join(absoluteBuildDir, "assets");
        if (!fs.existsSync(absoluteAssetsDir)) fs.mkdirSync(absoluteAssetsDir, { recursive: true });
      }

      const cssFiles = [];
      findFiles(absoluteBuildDir, (filePath) => {
        if (filePath.endsWith(".css") && !filePath.endsWith(outputCSSName) && path.resolve(path.dirname(filePath)) !== path.resolve(absoluteAssetsDir)) {
          cssFiles.push(filePath);
        }
      });

      if (!cssFiles.length) {
        console.info('[tailwind-legacy] ℹ️ No CSS files to process');
        return;
      }

      const cssSources = cssFiles.map(file => {
        try { return fs.readFileSync(file, "utf8"); } catch (_) { return ""; }
      }).filter(Boolean);

      if (!cssSources.length) return;

      try {
        const processor = postcss([
          legacyTransformPlugin({ colorFormat }),
          postcssNesting(),
          postcssMediaMinmax(),
          autoprefixer({ overrideBrowserslist: browsers, grid: false }),
          postcssPresetEnv({
            stage: 3,
            browsers,
            autoprefixer: { grid: false },
            features: {
              "custom-properties": false,
              "logical-properties-and-values": false,
              "nesting-rules": false,
              "cascade-layers": false,
              "media-query-ranges": true,
              "color-functional-notation": false,
              "custom-media-queries": false,
              "custom-selectors": false,
              "color-rgb": false,
              "rgb-functional-notation": false,
              "selector-pseudo-class": false,
              "selector-pseudo-element": false,
              "matches-pseudo-class": false,
              "not-pseudo-class": false,
              "is-pseudo-class": false,
              "where-pseudo-class": false,  
            },
          }),
        ]);

        const result = await processor.process(cssSources.join("\n"), {
          from: undefined,
          to: path.join(absoluteAssetsDir, outputCSSName),
          map: { inline: true }
        });

        let finalCSS = result.css;
        if (finalCSS.includes('oklch(')) finalCSS = convertOklchInString(finalCSS, colorFormat);

        if (process.env.NODE_ENV === 'production') {
          finalCSS = finalCSS.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '')
                             .replace(/\s+/g, ' ')
                             .replace(/;\s*/g, ';')
                             .replace(/}\s*/g, '}')
                             .trim();
        } else {
          finalCSS = finalCSS.replace(/\n\s*\n/g, '\n').replace(/;\s*\n/g, ';\n').replace(/\}\s*\n/g, '}\n');
        }

        const cssOutputPath = path.join(absoluteAssetsDir, outputCSSName);
        fs.writeFileSync(cssOutputPath, `/* Tailwind Legacy CSS - ${new Date().toISOString()} */\n\n` + finalCSS, "utf8");

        console.info(`[tailwind-legacy] ✅ CSS generated: ${cssOutputPath}`);
        console.info(`[tailwind-legacy] 📦 Size: ${Math.round(finalCSS.length / 1024)}KB`);
      } catch (error) {
        console.error('[tailwind-legacy] ❌ Error:', error.message);
      }

      const jsOutputPath = path.join(absoluteAssetsDir, browserScriptName);
      fs.writeFileSync(jsOutputPath, createBrowserScript({ publicPath, outputCSSName, deleteStyles }), "utf8");
      console.info(`[tailwind-legacy] ✅ JS generated: ${jsOutputPath}`);

      if (injectInHTML) {
        const injected = injectScript(absoluteBuildDir, publicPath, browserScriptName);
        console.info(`[tailwind-legacy] 📄 Script injected into ${injected} HTML files`);
      }

      console.info('[tailwind-legacy] 🎉 Finished!');
    },
  };
}

function injectScript(dir, publicPath, scriptName) {
  let count = 0;
  const htmlFiles = [];
  
  findFiles(dir, (fullPath) => {
    if (fullPath.endsWith(".html") || fullPath.endsWith(".htm")) htmlFiles.push(fullPath);
  });

  for (const fullPath of htmlFiles) {
    try {
      let content = fs.readFileSync(fullPath, "utf8");
      if (content.includes(scriptName)) continue;
      
      const script = `<script src="${publicPath}${scriptName}"></script>\n`;
      if (/<\/body>/i.test(content)) content = content.replace(/<\/body>/i, `${script}</body>`);
      else if (/<\/html>/i.test(content)) content = content.replace(/<\/html>/i, `${script}</html>`);
      else content += script;
      
      fs.writeFileSync(fullPath, content, "utf8");
      count++;
    } catch (_) {}
  }
  return count;
}

function createBrowserScript({ publicPath, outputCSSName, deleteStyles }) {
  return `(function(){"use strict";const MIN_CHROME=111,MIN_SAFARI=16.4,MIN_FIREFOX=128,STYLES_TO_DELETE=${JSON.stringify(deleteStyles || [])};let legacyCSSLoaded=false,attempts=0,MAX_ATTEMPTS=10,observer=null,intervalId=null;function isLegacyBrowser(){const ua=navigator.userAgent;const chrome=ua.match(/Chrome\\/([0-9]+)/);if(chrome&&parseInt(chrome[1])<MIN_CHROME)return true;const safari=ua.match(/Version\\/([0-9.]+).*Safari/);if(safari&&parseFloat(safari[1])<MIN_SAFARI)return true;const firefox=ua.match(/Firefox\\/([0-9]+)/);if(firefox&&parseInt(firefox[1])<MIN_FIREFOX)return true;return false;}function matchesPattern(fileName,pattern){fileName=fileName.split('?')[0];if(pattern.indexOf('*')!==-1){var regexStr=pattern.replace(/\\*/g,'.*').replace(/[.+?^$()|[\]\\]/g,'\\$&');return new RegExp('^'+regexStr+'$','i').test(fileName);}return fileName===pattern;}function removeStylesheets(){var removed=[];document.querySelectorAll('link[rel="stylesheet"]').forEach(function(link){var href=link.getAttribute('href')||'';var fileName=href.split('/').pop().split('?')[0];if(STYLES_TO_DELETE.some(function(pattern){return matchesPattern(fileName,pattern);})){link.remove();removed.push(href);}});return removed;}function loadLegacyCSS(){if(document.querySelector('link[data-tailwind-legacy="true"]'))return;var link=document.createElement('link');link.rel='stylesheet';link.href='${publicPath}${outputCSSName}';link.setAttribute('data-tailwind-legacy','true');document.head.appendChild(link);}function tryRemoveStyles(){if(legacyCSSLoaded)return;if(attempts>=MAX_ATTEMPTS){legacyCSSLoaded=true;loadLegacyCSS();cleanup();return;}attempts++;if(removeStylesheets().length>0){legacyCSSLoaded=true;loadLegacyCSS();cleanup();}else{setTimeout(tryRemoveStyles,200);}}function cleanup(){if(observer){observer.disconnect();observer=null;}if(intervalId){clearInterval(intervalId);intervalId=null;}}if(isLegacyBrowser()){tryRemoveStyles();document.addEventListener('DOMContentLoaded',function(){setTimeout(tryRemoveStyles,100);});window.addEventListener('load',function(){setTimeout(tryRemoveStyles,200);});if(window.MutationObserver){observer=new MutationObserver(function(mutations){if(legacyCSSLoaded){cleanup();return;}if(mutations.some(function(m){return m.addedNodes.length>0&&Array.from(m.addedNodes).some(function(node){return node.tagName==='LINK'&&node.rel==='stylesheet';});})){setTimeout(tryRemoveStyles,50);}});observer.observe(document.head,{childList:true,subtree:true});if(document.body){observer.observe(document.body,{childList:true,subtree:true});}}intervalId=setInterval(function(){if(legacyCSSLoaded){clearInterval(intervalId);return;}tryRemoveStyles();},500);setTimeout(function(){clearInterval(intervalId);intervalId=null;},5000);}})();`;
}

function findFiles(dir, callback) {
  if (!fs.existsSync(dir)) return;
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      if (file.name === 'node_modules' || file.name.startsWith('.')) continue;
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) findFiles(fullPath, callback);
      else callback(fullPath);
    }
  } catch (_) {}
}