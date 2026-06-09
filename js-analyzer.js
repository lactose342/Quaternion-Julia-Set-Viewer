#!/usr/bin/env node

/**
 * js-analyzer.js
 * 指定ディレクトリ配下の .js ファイルを再帰的に走査し、
 * class・メソッド(行数付き)・function・import一覧をJSON形式で出力する。
 *
 * 使い方:
 *   node js-analyzer.js <対象ディレクトリ> [出力JSONパス]
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 正規表現 ────────────────────────────────────────────────────────────────

const RE_CLASS     = /^\s*(?:export\s+(?:default\s+)?)?class\s+(\w+)(?:\s+extends\s+(\w+))?/;
const RE_METHOD    = /^\s*(?:(?:static|async|get|set)\s+)*([#\w]+)\s*\([^)]*\)\s*(?:\{|$)/;
const RE_FUNC      = /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/;
const RE_FUNC_EXPR = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\*?\s*\w*\s*\(/;
// import 文: import ... from 'xxx' / import 'xxx'
const RE_IMPORT    = /^\s*import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/;

const EXCLUDED = new Set([
  "if", "for", "while", "switch", "catch",
  "super", "return", "await", "typeof", "instanceof",
  "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame",
  "fetch", "require", "resolve", "reject",
  "describe", "it", "test", "expect", "beforeEach", "afterEach",
  "console",
]);

// ─── ユーティリティ ──────────────────────────────────────────────────────────

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

// ─── 解析ロジック ────────────────────────────────────────────────────────────

function analyzeFile(filePath) {
  const lines     = fs.readFileSync(filePath, "utf-8").split("\n");
  const classes   = [];
  const functions = [];
  const imports   = [];

  let currentClass    = null;
  let classStartDepth = -1;

  // メソッド行数計測用
  let currentMethod     = null; // { ref, startLine, depth }
  let methodStartDepth  = -1;

  // クラス外の関数行数計測用
  let currentFunc      = null;
  let funcStartDepth   = -1;

  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const lineNum = i + 1;

    const depthBefore = braceDepth;
    braceDepth = updateDepth(line, braceDepth);

    // ── import 検出 ──
    const importMatch = line.match(RE_IMPORT);
    if (importMatch && !imports.includes(importMatch[1])) {
      imports.push(importMatch[1]);
    }

    // ── メソッド終了判定（クラス内） ──
    if (currentMethod && braceDepth <= methodStartDepth) {
      currentMethod.ref.lines = lineNum - currentMethod.startLine + 1;
      currentMethod = null;
      methodStartDepth = -1;
    }

    // ── クラス外関数 終了判定 ──
    if (currentFunc && braceDepth <= funcStartDepth) {
      currentFunc.ref.lines = lineNum - currentFunc.startLine + 1;
      currentFunc = null;
      funcStartDepth = -1;
    }

    // ── クラス終了判定 ──
    if (currentClass && braceDepth <= classStartDepth) {
      currentClass    = null;
      classStartDepth = -1;
    }

    // ── class 検出 ──
    const classMatch = line.match(RE_CLASS);
    if (classMatch) {
      currentClass = {
        name:    classMatch[1],
        extends: classMatch[2] || null,
        line:    lineNum,
        methods: [],
      };
      classes.push(currentClass);
      classStartDepth = depthBefore; // { を数える前の深度
      continue;
    }

    // ── クラス内: メソッド検出 ──
    if (currentClass) {
      const methodMatch = line.match(RE_METHOD);
      if (methodMatch && !EXCLUDED.has(methodMatch[1])) {
        const entry = { name: methodMatch[1], line: lineNum, lines: null };
        currentClass.methods.push(entry);
        currentMethod    = { ref: entry, startLine: lineNum };
        methodStartDepth = depthBefore; // メソッド { の前の深度
      }
      continue;
    }

    // ── function キーワード検出（クラス外） ──
    const funcMatch = line.match(RE_FUNC) || line.match(RE_FUNC_EXPR);
    if (funcMatch) {
      const entry = { name: funcMatch[1], line: lineNum, lines: null };
      functions.push(entry);
      currentFunc    = { ref: entry, startLine: lineNum };
      funcStartDepth = depthBefore;
    }
  }

  return { imports, classes, functions };
}

// ─── エントリポイント ────────────────────────────────────────────────────────

function main() {
  const [,, targetDir, outputPath] = process.argv;

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

  const result = {
    analyzedAt: new Date().toISOString(),
    fileCount:  jsFiles.length,
    files:      [],
  };

  for (const filePath of jsFiles) {
    const relativePath = path.relative(absTarget, filePath);
    try {
      const { imports, classes, functions } = analyzeFile(filePath);
      result.files.push({ file: relativePath, imports, classes, functions });
    } catch (err) {
      result.files.push({ file: relativePath, error: err.message });
    }
  }

  const outPath = outputPath
    ? path.resolve(outputPath)
    : path.join(process.cwd(), "js-analysis.json");

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`出力完了: ${outPath}`);
}

main();