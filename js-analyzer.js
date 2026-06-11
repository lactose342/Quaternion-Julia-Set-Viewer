#!/usr/bin/env node

/**
 * js-analyzer.js
 * 指定ディレクトリ配下の .js ファイルを再帰的に走査し、
 * class・メソッド(行数付き)・function・import一覧をJSON形式で出力する。
 * AIアーキテクチャレビュー用のメタ情報も生成する。
 *
 * 使い方:
 *   node js-analyzer.js <対象ディレクトリ> [出力JSONパス]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ════════════════════════════════════════════════════════════════════════════
// 正規表現定義
// ════════════════════════════════════════════════════════════════════════════

// ── 既存 ──
const RE_CLASS = /^\s*(?:export\s+(?:default\s+)?)?class\s+(\w+)(?:\s+extends\s+(\w+))?/;
const RE_METHOD = /^\s*(?:(?:static|async|get|set)\s+)*([#\w]+)\s*\([^)]*\)\s*(?:\{|$)/;
const RE_FUNC = /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/;
const RE_FUNC_EXPR = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\*?\s*\w*\s*\(/;
const RE_IMPORT = /^\s*import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/;

// ── 追加 ──
// constructor検出
const RE_CONSTRUCTOR = /^\s*constructor\s*\(/;
// this.xxx = yyy（コンストラクタ内依存）
const RE_THIS_ASSIGN = /^\s*this\.(\w+)\s*=/;
// addEventListener / removeEventListener
const RE_ADD_LISTENER = /addEventListener\s*\(\s*['"]([^'"]+)['"]/g;
const RE_REMOVE_LISTENER = /removeEventListener\s*\(\s*['"]([^'"]+)['"]/g;
// dispatchEvent(new Event('xxx')) または dispatchEvent(new CustomEvent('xxx'))
const RE_DISPATCH_EVENT = /dispatchEvent\s*\(\s*new\s+(?:Custom)?Event\s*\(\s*['"]([^'"]+)['"]/g;
// DOM操作キーワード（カウント用）
const DOM_PATTERNS = [
  /document\.querySelector(?:All)?\s*\(/g,
  /document\.getElementById\s*\(/g,
  /document\.getElementsByClassName\s*\(/g,
  /\.appendChild\s*\(/g,
  /\.insertBefore\s*\(/g,
  /\.replaceChild\s*\(/g,
  /\.removeChild\s*\(/g,
  /\.innerHTML\s*[=+]/g,
  /\.textContent\s*[=+]/g,
  /\.classList\s*\./g,
];
// 簡易複雑度キーワード（McCabe近似）
const COMPLEXITY_RE = /\bif\b|\belse\s+if\b|\bswitch\b|\bcase\b|\bfor\b|\bwhile\b|\bcatch\b|&&|\|\|/g;
// Storeクラス検出（末尾がStore）
const RE_STORE_CLASS = /\b(\w+Store)\b/g;
// コメント行
const RE_LINE_COMMENT = /^\s*\/\//;
const RE_BLOCK_COMMENT_START = /^\s*\/\*/;
const RE_BLOCK_COMMENT_END = /\*\//;

const EXCLUDED = new Set([
  "if", "for", "while", "switch", "catch",
  "super", "return", "await", "typeof", "instanceof",
  "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame",
  "fetch", "require", "resolve", "reject",
  "describe", "it", "test", "expect", "beforeEach", "afterEach",
  "console",
]);

// ════════════════════════════════════════════════════════════════════════════
// ユーティリティ
// ════════════════════════════════════════════════════════════════════════════

function collectJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

/** { } の深度を1行分更新して返す（文字列・行コメントを簡易スキップ） */
function updateDepth(line, depth) {
  let inStr = null;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (inStr) {
      if (ch === inStr && line[j - 1] !== "\\") inStr = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
    } else if (ch === "/" && line[j + 1] === "/") {
      break;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    }
  }
  return depth;
}

/** 重複なしで配列に追加 */
function pushUnique(arr, value) {
  if (!arr.includes(value)) arr.push(value);
}

/** 正規表現の全マッチをキャプチャグループ1で返す（グローバルフラグ必須） */
function matchAll(text, re) {
  const results = [];
  let m;
  const clone = new RegExp(re.source, re.flags);
  while ((m = clone.exec(text)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/** ファイルパスからレイヤーを推定（最初のディレクトリセグメント） */
function inferLayer(relativePath) {
  const parts = relativePath.replace(/\\/g, "/").split("/");
  return parts.length > 1 ? parts[0] : null;
}

/** ファイル名（拡張子なし）を返す */
function basename(relativePath) {
  return path.basename(relativePath);
}

// ════════════════════════════════════════════════════════════════════════════
// フェーズ1: 収集フェーズ（ファイル単位の解析）
// ════════════════════════════════════════════════════════════════════════════

function analyzeFile(filePath) {
  const rawLines = fs.readFileSync(filePath, "utf-8").split("\n");
  const classes = [];
  const functions = [];
  const imports = [];

  // ── ファイル行情報 ──
  let totalLines = rawLines.length;
  let blankLines = 0;
  let commentLines = 0;
  let inBlockComment = false;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      blankLines++;
    } else if (inBlockComment) {
      commentLines++;
      if (RE_BLOCK_COMMENT_END.test(trimmed)) inBlockComment = false;
    } else if (RE_BLOCK_COMMENT_START.test(trimmed)) {
      commentLines++;
      if (!RE_BLOCK_COMMENT_END.test(trimmed)) inBlockComment = true;
    } else if (RE_LINE_COMMENT.test(trimmed)) {
      commentLines++;
    }
  }
  const codeLines = totalLines - blankLines - commentLines;

  const fileInfo = { totalLines, codeLines, commentLines, blankLines };

  // ── イベント情報・DOM操作 ──
  const fullText = rawLines.join("\n");

  const eventListeners = [...new Set(matchAll(fullText, RE_ADD_LISTENER))];
  const eventRemovals = [...new Set(matchAll(fullText, RE_REMOVE_LISTENER))];
  const eventDispatches = [...new Set(matchAll(fullText, RE_DISPATCH_EVENT))];
  const eventListenerCount = matchAll(fullText, RE_ADD_LISTENER).length;
  const eventRemovalCount = matchAll(fullText, RE_REMOVE_LISTENER).length;
  const eventDispatchCount = matchAll(fullText, RE_DISPATCH_EVENT).length;

  let domOperations = 0;
  for (const pat of DOM_PATTERNS) {
    const clone = new RegExp(pat.source, pat.flags);
    const found = fullText.match(clone);
    if (found) domOperations += found.length;
  }

  // ── Storeクラス依存 ──
  const storeNames = [...new Set(matchAll(fullText, RE_STORE_CLASS))];

  // ─── メイン解析ループ ────────────────────────────────────────────────────

  let currentClass = null;
  let classStartDepth = -1;
  let inConstructor = false;
  let constructorDepth = -1;

  let currentMethod = null;
  let methodStartDepth = -1;
  // メソッド本文収集用（複雑度計算のため）
  let currentMethodLines = [];

  let currentFunc = null;
  let funcStartDepth = -1;

  let braceDepth = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lineNum = i + 1;

    const depthBefore = braceDepth;
    braceDepth = updateDepth(line, braceDepth);

    // ── import 検出 ──
    const importMatch = line.match(RE_IMPORT);
    if (importMatch && !imports.includes(importMatch[1])) {
      imports.push(importMatch[1]);
    }

    // ── コンストラクタ終了 ──
    if (inConstructor && braceDepth <= constructorDepth) {
      inConstructor = false;
      constructorDepth = -1;
    }

    // ── メソッド終了（クラス内）──
    if (currentMethod && braceDepth <= methodStartDepth) {
      currentMethod.ref.lines = lineNum - currentMethod.startLine + 1;
      // 複雑度計算
      const body = currentMethodLines.join("\n");
      const matches = body.match(COMPLEXITY_RE);
      currentMethod.ref.complexity = matches ? matches.length : 0;
      currentMethod = null;
      methodStartDepth = -1;
      currentMethodLines = [];
    } else if (currentMethod) {
      currentMethodLines.push(line);
    }

    // ── クラス外関数 終了 ──
    if (currentFunc && braceDepth <= funcStartDepth) {
      currentFunc.ref.lines = lineNum - currentFunc.startLine + 1;
      currentFunc = null;
      funcStartDepth = -1;
    }

    // ── クラス終了 ──
    if (currentClass && braceDepth <= classStartDepth) {
      currentClass = null;
      classStartDepth = -1;
    }

    // ── class 検出 ──
    const classMatch = line.match(RE_CLASS);
    if (classMatch) {
      currentClass = {
        name: classMatch[1],
        extends: classMatch[2] || null,
        line: lineNum,
        methods: [],
        constructorDependencies: [],
        dependencyCount: 0,
      };
      classes.push(currentClass);
      classStartDepth = depthBefore;
      continue;
    }

    // ── クラス内処理 ──
    if (currentClass) {
      // constructor 検出
      if (RE_CONSTRUCTOR.test(line)) {
        inConstructor = true;
        constructorDepth = depthBefore;
      }

      // this.xxx = yyy（コンストラクタ内のみ）
      if (inConstructor) {
        const thisMatch = line.match(RE_THIS_ASSIGN);
        if (thisMatch) {
          pushUnique(currentClass.constructorDependencies, thisMatch[1]);
        }
      }

      // メソッド検出
      const methodMatch = line.match(RE_METHOD);
      if (methodMatch && !EXCLUDED.has(methodMatch[1])) {
        const entry = {
          name: methodMatch[1],
          line: lineNum,
          lines: null,
          complexity: 0,
        };
        currentClass.methods.push(entry);
        currentMethod = { ref: entry, startLine: lineNum };
        methodStartDepth = depthBefore;
        currentMethodLines = [];
      }
      continue;
    }

    // ── function キーワード検出（クラス外）──
    const funcMatch = line.match(RE_FUNC) || line.match(RE_FUNC_EXPR);
    if (funcMatch) {
      const entry = { name: funcMatch[1], line: lineNum, lines: null };
      functions.push(entry);
      currentFunc = { ref: entry, startLine: lineNum };
      funcStartDepth = depthBefore;
    }
  }

  // constructorDependencies → dependencyCount を確定
  for (const cls of classes) {
    cls.dependencyCount = cls.constructorDependencies.length;
  }

  return {
    fileInfo,
    imports,
    classes,
    functions,
    events: {
      eventListeners,
      eventListenerCount,
      eventRemovals,
      eventRemovalCount,
      eventDispatches,
      eventDispatchCount,
    },
    domOperations,
    stores: storeNames,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// フェーズ2: 解析フェーズ（全ファイルまたがる集約）
// ════════════════════════════════════════════════════════════════════════════

/**
 * import パスからファイルベース名を正規化して返す。
 * "./foo/Bar.js" → "Bar.js"
 * "./foo/Bar"    → "Bar.js"（.js補完）
 * 外部モジュール（"react" など）は null を返す
 */
function normalizeImportToFile(importPath) {
  if (!importPath.startsWith(".")) return null;
  let base = path.basename(importPath);
  if (!base.endsWith(".js")) base += ".js";
  return base;
}

/** レイヤー違反を検出（core → ui 方向のみ） */
const LAYER_ORDER = ["core", "domain", "store", "service", "ui", "view", "controller", "page"];

function detectLayerViolations(files) {
  const violations = [];

  for (const f of files) {
    if (f.error) continue;
    const fromLayer = f.layer;
    if (!fromLayer) continue;

    for (const imp of f.imports) {
      if (!imp.startsWith(".")) continue;
      // インポートパスからレイヤーを推定
      const normalized = imp.replace(/\\/g, "/");
      const parts = normalized.split("/").filter(Boolean);
      if (parts.length < 2) continue;
      // "../ui/xxx" → 上位ディレクトリ参照のケースを処理
      let toLayerCandidate = null;
      for (const part of parts) {
        if (LAYER_ORDER.includes(part)) {
          toLayerCandidate = part;
          break;
        }
      }
      if (!toLayerCandidate) continue;

      const fromIdx = LAYER_ORDER.indexOf(fromLayer);
      const toIdx = LAYER_ORDER.indexOf(toLayerCandidate);

      // 下位レイヤーが上位レイヤーに依存するのは違反（core→ui など）
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
        violations.push({
          from: fromLayer,
          to: toLayerCandidate,
          file: f.file,
          import: imp,
        });
      }
    }
  }
  return violations;
}

/** import逆引きグラフを構築 */
function buildDependencyGraph(files) {
  const graph = {};

  // まず全ファイルのノードを登録
  for (const f of files) {
    if (f.error) continue;
    const key = basename(f.file);
    if (!graph[key]) {
      graph[key] = { imports: [], importedBy: [] };
    }
    for (const imp of f.imports) {
      const resolved = normalizeImportToFile(imp);
      if (resolved) pushUnique(graph[key].imports, resolved);
    }
  }

  // importedBy を逆引き構築
  for (const [fileName, node] of Object.entries(graph)) {
    for (const imp of node.imports) {
      if (!graph[imp]) graph[imp] = { imports: [], importedBy: [] };
      pushUnique(graph[imp].importedBy, fileName);
    }
  }

  return graph;
}

// ════════════════════════════════════════════════════════════════════════════
// フェーズ3: サマリー生成フェーズ
// ════════════════════════════════════════════════════════════════════════════

function buildSummary(files, dependencyGraph, topN = 5) {
  // largestFiles: totalLines 降順
  const largestFiles = files
    .filter(f => !f.error && f.fileInfo)
    .map(f => ({ file: f.file, totalLines: f.fileInfo.totalLines }))
    .sort((a, b) => b.totalLines - a.totalLines)
    .slice(0, topN);

  // mostComplexMethods: complexity 降順
  const allMethods = [];
  for (const f of files) {
    if (f.error) continue;
    for (const cls of f.classes) {
      for (const m of cls.methods) {
        if (m.complexity != null) {
          allMethods.push({
            file: f.file,
            class: cls.name,
            method: m.name,
            lines: m.lines,
            complexity: m.complexity,
          });
        }
      }
    }
  }
  const mostComplexMethods = allMethods
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, topN);

  // mostDependentClasses: dependencyCount 降順
  const allClasses = [];
  for (const f of files) {
    if (f.error) continue;
    for (const cls of f.classes) {
      allClasses.push({
        file: f.file,
        class: cls.name,
        dependencyCount: cls.dependencyCount,
      });
    }
  }
  const mostDependentClasses = allClasses
    .sort((a, b) => b.dependencyCount - a.dependencyCount)
    .slice(0, topN);

  // mostImportedFiles: importedBy.length 降順
  const mostImportedFiles = Object.entries(dependencyGraph)
    .map(([file, node]) => ({ file, importedByCount: node.importedBy.length }))
    .filter(e => e.importedByCount > 0)
    .sort((a, b) => b.importedByCount - a.importedByCount)
    .slice(0, topN);

  return {
    largestFiles,
    mostComplexMethods,
    mostDependentClasses,
    mostImportedFiles,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// エントリポイント
// ════════════════════════════════════════════════════════════════════════════

function main() {
  const [, , targetDir, outputPath] = process.argv;

  if (!targetDir) {
    console.error("使い方: node js-analyzer.js <対象ディレクトリ> [出力JSONパス]");
    process.exit(1);
  }

  const absTarget = path.resolve(targetDir);
  if (!fs.existsSync(absTarget)) {
    console.error(`ディレクトリが見つかりません: ${absTarget}`);
    process.exit(1);
  }

  const jsFiles = collectJsFiles(absTarget);
  console.log(`対象ファイル数: ${jsFiles.length}`);

  // ── フェーズ1: 収集 ──────────────────────────────────────────────────────
  const collectedFiles = [];

  for (const filePath of jsFiles) {
    const relativePath = path.relative(absTarget, filePath);
    try {
      const { fileInfo, imports, classes, functions, events, domOperations, stores } =
        analyzeFile(filePath);

      collectedFiles.push({
        file: relativePath,
        layer: inferLayer(relativePath),
        fileInfo,
        imports,
        classes,
        functions,
        events,
        domOperations,
        stores,
      });
    } catch (err) {
      collectedFiles.push({ file: relativePath, error: err.message });
    }
  }

  // ── フェーズ2: 解析 ──────────────────────────────────────────────────────
  const layerViolations = detectLayerViolations(collectedFiles);
  const dependencyGraph = buildDependencyGraph(collectedFiles);

  // ── フェーズ3: サマリー生成 ──────────────────────────────────────────────
  const summary = buildSummary(collectedFiles, dependencyGraph);

  // ── 出力オブジェクト構築（後方互換: files 配列の既存フィールドはそのまま）──
  const result = {
    analyzedAt: new Date().toISOString(),
    fileCount: jsFiles.length,
    files: collectedFiles,
    architecture: {
      layerViolations,
    },
    dependencyGraph,
    summary,
  };

  const outPath = outputPath
    ? path.resolve(outputPath)
    : path.join(process.cwd(), "js-analysis.json");

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`出力完了: ${outPath}`);
}

main();