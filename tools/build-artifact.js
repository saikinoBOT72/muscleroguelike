#!/usr/bin/env node
/**
 * index.html を Artifact 用の断片に変換する。
 * Artifact は <!doctype>…<head>…<body> の骨組みを公開時に付けるため、
 * <title> / <style> / 本体 / <script> だけを取り出して出力する。
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const pick = (re, name) => {
  const m = src.match(re);
  if (!m) throw new Error(name + ' が index.html に見つかりません');
  return m[1];
};

const style = pick(/<style>([\s\S]*?)<\/style>/, '<style>');
const body  = pick(/<body>([\s\S]*?)<\/body>/, '<body>');

const out = `<title>筋トレ融合ローグライク</title>
<style>
/* Artifact のリセットに body の余白が残らないよう明示する */
html, body { margin: 0; padding: 0; }
${style.trim()}
</style>
${body.trim()}
`;

const dest = path.join(__dirname, '..', 'dist', 'artifact.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('生成:', dest, '(' + (out.length / 1024).toFixed(0) + ' KB)');
