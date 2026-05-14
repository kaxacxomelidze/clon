#!/usr/bin/env node
import {
  logger,
  runClone
} from "./chunk-CF5CN3V4.js";

// src/cli.ts
import { program } from "commander";
import { resolve } from "path";

// src/_server.ts
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var jobs = /* @__PURE__ */ new Map();
var activeOutDir = "";
var MIME = {
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "font/eot",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".avif": "image/avif",
  ".pdf": "application/pdf"
};
function getCliArgs() {
  const distCli = join(__dirname, "cli.js");
  if (existsSync(distCli)) return { cmd: process.execPath, args: [distCli] };
  return { cmd: "npx", args: ["tsx", join(__dirname, "cli.ts")] };
}
function sendSSE(res, data) {
  res.write("data: " + JSON.stringify(data) + "\n\n");
}
function broadcast(job, line) {
  job.lines.push(line);
  for (const res of job.listeners) sendSSE(res, line);
}
function serve(res, body, ct, status = 200) {
  res.writeHead(status, { "Content-Type": ct, "Access-Control-Allow-Origin": "*" });
  res.end(body);
}
function json(res, data, status = 200) {
  serve(res, JSON.stringify(data), "application/json", status);
}
function readBody(req) {
  return new Promise((ok, fail) => {
    let d = "";
    req.on("data", (c) => {
      d += c;
    });
    req.on("end", () => ok(d));
    req.on("error", fail);
  });
}
function listSites(baseDir) {
  if (!existsSync(baseDir)) return [];
  try {
    return readdirSync(baseDir).filter((name) => {
      try {
        return statSync(join(baseDir, name)).isDirectory();
      } catch {
        return false;
      }
    }).filter((name) => existsSync(join(baseDir, name, "route-map.json"))).map((name) => {
      let pageCount = 0;
      try {
        const map = JSON.parse(readFileSync(join(baseDir, name, "route-map.json"), "utf8"));
        pageCount = Object.keys(map).length;
      } catch {
      }
      return { hostname: name, pageCount };
    });
  } catch {
    return [];
  }
}
function outDirForHost(baseDir, hostname) {
  return join(baseDir, hostname);
}
var UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Web Cloner Studio</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.4;background:#0f172a;color:#cbd5e1;display:flex;flex-direction:column}
button{cursor:pointer;font:inherit}
input,select,textarea{font:inherit}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}

/* \u2500\u2500 Top bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#topbar{background:#1e293b;border-bottom:1px solid #2d3f57;padding:7px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;z-index:200}
#logo{color:#60a5fa;font-weight:700;font-size:14px;white-space:nowrap;letter-spacing:-.3px;display:flex;align-items:center;gap:6px}
#url-wrap{flex:1;max-width:560px;position:relative;display:flex}
#url-input{flex:1;background:#0a1628;border:1px solid #2d3f57;border-right:none;color:#e2e8f0;border-radius:6px 0 0 6px;padding:5px 11px;font-size:13px;outline:none;transition:border-color .15s}
#url-input:focus{border-color:#3b82f6}
#clone-btn{background:#2563eb;color:#fff;border:none;padding:5px 16px;border-radius:0 6px 6px 0;font-size:13px;font-weight:500;white-space:nowrap;transition:background .15s;display:flex;align-items:center;gap:5px}
#clone-btn:hover:not(:disabled){background:#1d4ed8}
#clone-btn:disabled{opacity:.5;cursor:default}
.sep{width:1px;background:#2d3f57;height:22px;flex-shrink:0;margin:0 2px}
.vp-group{display:flex;gap:2px}
.vp-btn{background:none;border:1px solid #2d3f57;color:#64748b;padding:4px 9px;border-radius:4px;font-size:12px;transition:all .15s}
.vp-btn:hover{border-color:#3b82f6;color:#93c5fd}
.vp-btn.on{background:#1e3a5f;border-color:#3b82f6;color:#93c5fd}
#zoom-sel{background:#0a1628;border:1px solid #2d3f57;color:#64748b;padding:4px 6px;border-radius:4px;font-size:12px;outline:none}
.top-action{background:none;border:1px solid #2d3f57;color:#64748b;padding:4px 12px;border-radius:4px;font-size:12px;transition:all .15s;white-space:nowrap}
.top-action:hover{border-color:#475569;color:#94a3b8}
.top-action.green{border-color:#166534;color:#86efac;background:#0d2218}
.top-action.green:hover{background:#166534}

/* \u2500\u2500 Workspace \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#workspace{flex:1;min-height:0;display:grid;grid-template-columns:200px 1fr 268px;overflow:hidden}

/* \u2500\u2500 Left sidebar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#sidebar{background:#1a2540;border-right:1px solid #2d3f57;display:flex;flex-direction:column;overflow:hidden}
.sb-head{padding:7px 11px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#3d5178;border-bottom:1px solid #1e2d47;flex-shrink:0;display:flex;align-items:center;justify-content:space-between}
.sb-head span{color:#3d5178}
.sb-scroll{overflow-y:auto;flex:1}
.site-row{display:flex;align-items:center;gap:7px;padding:7px 11px;cursor:pointer;border-bottom:1px solid #151e32;transition:background .1s}
.site-row:hover{background:#1e2d47}
.site-row.on{background:#162035}
.site-fav{width:14px;height:14px;border-radius:2px;flex-shrink:0;object-fit:contain}
.site-name{font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.site-row.on .site-name{color:#93c5fd}
.site-badge{font-size:9px;color:#3d5178;flex-shrink:0}
.page-btn{display:block;width:100%;text-align:left;background:none;border:none;color:#4a607f;padding:5px 11px 5px 20px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .1s,color .1s;border-bottom:1px solid transparent}
.page-btn:hover{background:#1e2d47;color:#94a3b8}
.page-btn.on{background:#162035;color:#60a5fa}
.sb-divider{height:1px;background:#1e2d47;flex-shrink:0}

/* \u2500\u2500 Preview area \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#preview-area{position:relative;background:#29333e;overflow:auto;display:flex;flex-direction:column;align-items:center}
#welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:20px;padding:48px;text-align:center}
#welcome h2{font-size:20px;color:#e2e8f0;font-weight:600}
#welcome p{color:#475569;max-width:380px;line-height:1.65;font-size:13px}
#welcome .tip{font-size:11px;color:#2d3f57;margin-top:4px}

/* Progress overlay */
#progress-overlay{position:absolute;inset:0;background:rgba(10,18,38,.96);display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;z-index:100;backdrop-filter:blur(2px)}
#progress-overlay.on{display:flex}
#pr-header{display:flex;flex-direction:column;align-items:center;gap:6px}
.pr-title{font-size:17px;font-weight:600;color:#e2e8f0}
#pr-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:#3d5178}
.pr-badge{padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;letter-spacing:.03em}
.pr-badge.running{background:#0d2035;color:#60a5fa;border:1px solid #1d4ed8}
.pr-badge.done{background:#0d2218;color:#4ade80;border:1px solid #166534}
.pr-badge.error{background:#1a0d0d;color:#f87171;border:1px solid #991b1b}
.pr-stats{display:flex;gap:28px}
.pr-stat{text-align:center}
.pr-num{font-size:30px;font-weight:700;color:#60a5fa;display:block;font-variant-numeric:tabular-nums}
.pr-lbl{font-size:10px;color:#3d5178;text-transform:uppercase;letter-spacing:.06em;margin-top:1px}
.pr-log-wrap{width:500px;max-height:160px;overflow-y:auto;background:#070e1c;border:1px solid #1e2d47;border-radius:8px;padding:10px 13px}
#pr-log{font-family:'Cascadia Code',Consolas,monospace;font-size:11px;color:#3d5178;white-space:pre-wrap;word-break:break-all}
#pr-actions{display:flex;gap:8px}
#cancel-btn{background:none;border:1px solid #334155;color:#64748b;padding:6px 22px;border-radius:6px;font-size:13px;transition:all .15s}
#cancel-btn:hover{border-color:#ef4444;color:#ef4444}
#dismiss-btn{background:#0d2218;border:1px solid #166534;color:#4ade80;padding:6px 22px;border-radius:6px;font-size:13px;display:none;transition:all .15s}
#dismiss-btn:hover{background:#166534}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{width:32px;height:32px;border:3px solid #1e2d47;border-top-color:#3b82f6;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
.spinner.done{border-color:#166534;border-top-color:#4ade80;animation:none}
.spinner.error{border-color:#7f1d1d;border-top-color:#ef4444;animation:none}

/* Frame scaler */
#frame-wrap{flex-shrink:0;padding:24px;display:none;align-items:flex-start;justify-content:center;width:100%}
#frame-wrap.on{display:flex}
#frame-scaler{position:relative;transform-origin:top center;background:#fff;box-shadow:0 8px 48px rgba(0,0,0,.6);border-radius:3px;overflow:hidden;transition:width .2s}
#preview-frame{width:100%;min-height:500px;border:none;display:block}
#editor-overlay{position:absolute;inset:0;z-index:10;display:none}
#editor-overlay.on{display:block}

/* \u2500\u2500 Right props panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#props{background:#1a2540;border-left:1px solid #2d3f57;overflow-y:auto;display:flex;flex-direction:column}
#p-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;color:#1e2d47}
#p-empty p{font-size:12px;line-height:1.65;color:#3d5178}
#p-body{flex:1;display:none}

/* Sections */
.sec{border-bottom:1px solid #1a2944}
.sec-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;user-select:none;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#3d5178;transition:color .15s}
.sec-hd:hover{color:#64748b}
.chev{transition:transform .2s;font-size:9px;opacity:.6}
.sec.cl .chev{transform:rotate(-90deg)}
.sec-bd{padding:9px 12px 13px;display:grid;gap:8px}
.sec.cl .sec-bd{display:none}

/* Element badges */
#el-info{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding-top:2px}
.bdg{display:inline-flex;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600}
.bdg-tag{background:#0d2544;color:#60a5fa}
.bdg-id{background:#0d2218;color:#86efac}
.bdg-cls{background:#1f1225;color:#c084fc;font-size:10px}

/* Prop rows */
.pr{display:grid;grid-template-columns:68px 1fr;align-items:center;gap:6px}
.pr>label{font-size:11px;color:#3d5178;white-space:nowrap}
.pr.full{grid-template-columns:1fr}
.pr.full>label{color:#3d5178;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}

/* Inputs */
.pi{background:#0a1628;border:1px solid #253347;color:#e2e8f0;border-radius:4px;padding:4px 8px;font-size:12px;outline:none;width:100%;transition:border-color .15s}
.pi:focus{border-color:#3b82f6}
.pi-sm{width:52px}
select.pi{padding:3px 6px}
textarea.pi{resize:vertical;min-height:52px;line-height:1.5}
.unit{font-size:10px;color:#334155;flex-shrink:0}

/* Color pair */
.clr-row{display:flex;align-items:center;gap:5px}
.pi-clr{width:30px;height:26px;padding:1px 2px;border:1px solid #253347;background:#0a1628;border-radius:4px;cursor:pointer;outline:none;flex-shrink:0}
.pi-hex{flex:1;min-width:0}

/* Button group */
.bg{display:flex;gap:2px;flex-wrap:wrap}
.bg-b{background:none;border:1px solid #253347;color:#3d5178;padding:3px 8px;border-radius:4px;font-size:12px;transition:all .15s;flex:1;justify-content:center}
.bg-b:hover{border-color:#475569;color:#64748b}
.bg-b.on{background:#1e3a5f;border-color:#3b82f6;color:#93c5fd}

/* Spacing cross */
.sp-cross{display:grid;grid-template-areas:'. t .' 'l c r' '. b .';grid-template-columns:48px 42px 48px;grid-template-rows:28px 28px 28px;gap:3px;justify-content:center;align-items:center}
.sp-cross input{text-align:center;background:#0a1628;border:1px solid #253347;color:#e2e8f0;border-radius:4px;padding:2px 0;font-size:12px;outline:none;width:100%;height:28px}
.sp-cross input:focus{border-color:#3b82f6}
.sp-t{grid-area:t}.sp-r{grid-area:r}.sp-b{grid-area:b}.sp-l{grid-area:l}
.sp-c{grid-area:c;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#1e2d47;background:#070e1c;border-radius:3px;height:100%}
.sp-lbl{font-size:10px;color:#3d5178;text-align:center;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}

/* Slider */
input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:linear-gradient(to right,#3b82f6 var(--pct,100%),#253347 var(--pct,100%));outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;border:2px solid #3b82f6;cursor:pointer}

/* Action buttons */
.act-btn{background:#0e1c33;border:1px solid #253347;color:#64748b;padding:6px 10px;border-radius:5px;font-size:12px;width:100%;text-align:left;transition:all .15s;display:flex;align-items:center;gap:6px}
.act-btn:hover{background:#162035;border-color:#3d5178;color:#94a3b8}
.act-del{background:#1a0d0d;border-color:#3d1515;color:#7f4040}
.act-del:hover{background:#2a1010;border-color:#ef4444;color:#fca5a5}

/* \u2500\u2500 Status bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#statusbar{background:#111c2e;border-top:1px solid #1e2d47;padding:5px 12px;display:flex;align-items:center;gap:8px;flex-shrink:0;font-size:11px}
#mode-wrap{display:flex;border:1px solid #253347;border-radius:4px;overflow:hidden}
.mode-btn{background:none;border:none;color:#3d5178;padding:3px 10px;font-size:11px;transition:all .15s}
.mode-btn.on{background:#253347;color:#e2e8f0}
.sb-sep{color:#1e2d47}
#el-path{flex:1;color:#3d5178;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Cascadia Code',Consolas,monospace;font-size:11px}
.sb-btn{background:none;border:1px solid #253347;color:#3d5178;padding:3px 8px;border-radius:4px;font-size:11px;transition:all .15s}
.sb-btn:hover:not(:disabled){border-color:#475569;color:#94a3b8}
.sb-btn:disabled{opacity:.25;cursor:default}
#sb-save{border-color:#166534;color:#4ade80;background:#0d2218}
#sb-save:hover:not(:disabled){background:#166534;color:#86efac}
#sb-save:disabled{opacity:.4}

/* Toast */
#toasts{position:fixed;bottom:44px;right:18px;z-index:9999;display:flex;flex-direction:column-reverse;gap:6px;pointer-events:none}
.toast{padding:9px 16px;border-radius:7px;font-size:13px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.5);pointer-events:auto;animation:tin .2s ease}
@keyframes tin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.toast.ok{background:#0d2218;color:#86efac;border:1px solid #166534}
.toast.err{background:#1a0d0d;color:#fca5a5;border:1px solid #991b1b}
.toast.inf{background:#0d2035;color:#93c5fd;border:1px solid #1d4ed8}
</style>
</head>
<body>

<!-- \u2500\u2500 Top bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="topbar">
  <div id="logo">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    Web Cloner Studio
  </div>
  <div id="url-wrap">
    <input id="url-input" type="url" placeholder="https://example.com" spellcheck="false" autocomplete="off">
    <button id="clone-btn">
      <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 14.5A6.5 6.5 0 1 1 8 1.5a6.5 6.5 0 0 1 0 13zM5.5 8l2.5-3.5V7h3v2H8v2.5z"/></svg>
      Clone
    </button>
  </div>
  <div class="sep"></div>
  <div class="vp-group">
    <button class="vp-btn on" data-vp="desktop" title="Desktop">&#128421;</button>
    <button class="vp-btn" data-vp="tablet" title="Tablet (768px)">&#128113;</button>
    <button class="vp-btn" data-vp="mobile" title="Mobile (390px)">&#128241;</button>
  </div>
  <select id="zoom-sel" title="Zoom">
    <option value="1">100%</option>
    <option value="0.9">90%</option>
    <option value="0.75">75%</option>
    <option value="0.6">60%</option>
    <option value="0.5">50%</option>
  </select>
  <div class="sep"></div>
  <button class="top-action green" id="tb-save" disabled>&#128190; Save</button>
</div>

<!-- \u2500\u2500 Workspace \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="workspace">

  <!-- Left sidebar -->
  <div id="sidebar">
    <div class="sb-head"><span>Sites</span><span id="site-count"></span></div>
    <div id="site-list"></div>
    <div class="sb-divider"></div>
    <div class="sb-head"><span>Pages</span></div>
    <div id="page-list" class="sb-scroll"></div>
  </div>

  <!-- Preview -->
  <div id="preview-area">
    <div id="welcome">
      <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#1e3a5f" stroke-width="2">
        <rect x="4" y="10" width="56" height="44" rx="4"/><path d="M4 22h56M16 16h2M24 16h2M32 16h2"/>
        <rect x="12" y="30" width="18" height="14" rx="2"/><rect x="34" y="30" width="18" height="6" rx="2"/><rect x="34" y="40" width="18" height="4" rx="2"/>
      </svg>
      <h2>Web Cloner Studio</h2>
      <p>Enter any URL above and click Clone to capture a website with all its assets. Then edit any element visually \u2014 text, colors, spacing, fonts \u2014 and save instantly.</p>
      <p class="tip">Previously cloned sites appear in the left sidebar</p>
    </div>

    <div id="progress-overlay">
      <div class="spinner" id="pr-spinner"></div>
      <div id="pr-header">
        <div class="pr-title" id="pr-title">Cloning\u2026</div>
        <div id="pr-meta">
          <span class="pr-badge running" id="pr-badge">Running</span>
          <span id="pr-started"></span>
          <span id="pr-elapsed-wrap" style="display:none">\xB7 <span id="pr-elapsed">0s</span> elapsed</span>
        </div>
      </div>
      <div class="pr-stats">
        <div class="pr-stat"><span class="pr-num" id="st-pages">0</span><div class="pr-lbl">Pages captured</div></div>
        <div class="pr-stat"><span class="pr-num" id="st-assets">0</span><div class="pr-lbl">Assets downloaded</div></div>
        <div class="pr-stat"><span class="pr-num" id="st-routes">0</span><div class="pr-lbl">API routes</div></div>
      </div>
      <div class="pr-log-wrap"><pre id="pr-log"></pre></div>
      <div id="pr-actions">
        <button id="cancel-btn">Cancel</button>
        <button id="dismiss-btn">View site &#8594;</button>
      </div>
    </div>

    <div id="frame-wrap">
      <div id="frame-scaler">
        <iframe id="preview-frame" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
        <div id="editor-overlay"></div>
      </div>
    </div>
  </div>

  <!-- Right: properties panel -->
  <div id="props">
    <div id="p-empty">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".2">
        <path d="M15 15l6 6M9.5 9.5a6.5 6.5 0 1 1 0 0z"/>
      </svg>
      <p>Click any element in the preview to inspect and edit its properties</p>
    </div>
    <div id="p-body">

      <!-- Element -->
      <div class="sec" id="sec-el">
        <div class="sec-hd"><span>Element</span><span class="chev">&#9660;</span></div>
        <div class="sec-bd"><div id="el-info"></div></div>
      </div>

      <!-- Content -->
      <div class="sec" id="sec-content">
        <div class="sec-hd"><span>Content</span><span class="chev">&#9660;</span></div>
        <div class="sec-bd">
          <div class="pr full"><label>Text content</label><textarea id="p-text" class="pi" rows="3"></textarea></div>
        </div>
      </div>

      <!-- Typography -->
      <div class="sec" id="sec-typo">
        <div class="sec-hd"><span>Typography</span><span class="chev">&#9660;</span></div>
        <div class="sec-bd">
          <div class="pr"><label>Family</label><input id="p-ff" class="pi" list="font-dl" placeholder="inherit" autocomplete="off"><datalist id="font-dl"><option value="Arial"><option value="Georgia"><option value="Helvetica Neue"><option value="Times New Roman"><option value="Verdana"><option value="Courier New"><option value="Trebuchet MS"><option value="Inter"><option value="Roboto"><option value="Open Sans"><option value="Lato"><option value="Poppins"><option value="Montserrat"><option value="Nunito"><option value="Raleway"><option value="Source Sans Pro"><option value="system-ui"><option value="sans-serif"><option value="serif"><option value="monospace"></datalist></div>
          <div class="pr"><label>Size</label><div style="display:flex;gap:5px;align-items:center"><input id="p-fs" class="pi pi-sm" type="number" min="1" max="500"><span class="unit">px</span></div></div>
          <div class="pr"><label>Weight</label><select id="p-fw" class="pi"><option value="100">100 Thin</option><option value="200">200 ExtraLight</option><option value="300">300 Light</option><option value="400">400 Normal</option><option value="500">500 Medium</option><option value="600">600 SemiBold</option><option value="700">700 Bold</option><option value="800">800 ExtraBold</option><option value="900">900 Black</option></select></div>
          <div class="pr"><label>Color</label><div class="clr-row"><input type="color" id="p-color" class="pi-clr"><input id="p-colorhex" class="pi pi-hex" maxlength="9" placeholder="#000000"></div></div>
          <div class="pr"><label>Align</label><div class="bg"><button class="bg-b" data-align="left" title="Left">&#8592;</button><button class="bg-b" data-align="center" title="Center">&#8596;</button><button class="bg-b" data-align="right" title="Right">&#8594;</button><button class="bg-b" data-align="justify" title="Justify">&#8644;</button></div></div>
          <div class="pr"><label>Style</label><div class="bg"><button class="bg-b" id="p-bold" title="Bold"><b>B</b></button><button class="bg-b" id="p-italic" title="Italic"><i>I</i></button><button class="bg-b" id="p-uline" title="Underline" style="text-decoration:underline">U</button><button class="bg-b" id="p-strike" title="Strikethrough" style="text-decoration:line-through">S</button></div></div>
          <div class="pr"><label>Line H.</label><input id="p-lh" class="pi pi-sm" type="number" min="0.5" max="6" step="0.05"></div>
          <div class="pr"><label>Spacing</label><div style="display:flex;gap:5px;align-items:center"><input id="p-ls" class="pi pi-sm" type="number" min="-5" max="20" step="0.5"><span class="unit">px</span></div></div>
        </div>
      </div>

      <!-- Background -->
      <div class="sec" id="sec-bg">
        <div class="sec-hd"><span>Background</span><span class="chev">&#9660;</span></div>
        <div class="sec-bd">
          <div class="pr"><label>Color</label><div class="clr-row"><input type="color" id="p-bg" class="pi-clr"><input id="p-bghex" class="pi pi-hex" maxlength="9" placeholder="transparent"></div></div>
          <div class="pr"><label>Opacity</label><div style="display:flex;align-items:center;gap:8px;flex:1"><input type="range" id="p-opacity" min="0" max="1" step="0.01"><span id="p-opval" style="font-size:11px;color:#3d5178;width:34px;text-align:right">100%</span></div></div>
        </div>
      </div>

      <!-- Spacing -->
      <div class="sec" id="sec-spacing">
        <div class="sec-hd"><span>Spacing</span><span class="chev">&#9660;</span></div>
        <div class="sec-bd" style="gap:14px">
          <div><div class="sp-lbl">Padding</div>
          <div class="sp-cross">
            <div></div><input class="sp-t" id="p-pt" type="number" min="0" title="Top"><div></div>
            <input class="sp-l" id="p-pl" type="number" min="0" title="Left"><div class="sp-c">P</div><input class="sp-r" id="p-pr2" type="number" min="0" title="Right">
            <div></div><input class="sp-b" id="p-pb" type="number" min="0" title="Bottom"><div></div>
          </div></div>
          <div><div class="sp-lbl">Margin</div>
          <div class="sp-cross">
            <div></div><input class="sp-t" id="p-mt" type="number" title="Top"><div></div>
            <input class="sp-l" id="p-ml" type="number" title="Left"><div class="sp-c">M</div><input class="sp-r" id="p-mr" type="number" title="Right">
            <div></div><input class="sp-b" id="p-mb" type="number" title="Bottom"><div></div>
          </div></div>
        </div>
      </div>

      <!-- Border -->
      <div class="sec" id="sec-border">
        <div class="sec-hd"><span>Border</span><span class="chev">&#9660;</span></div>
        <div class="sec-bd">
          <div class="pr"><label>Radius</label><div style="display:flex;gap:5px;align-items:center"><input id="p-bdr" class="pi pi-sm" type="number" min="0"><span class="unit">px</span></div></div>
          <div class="pr"><label>Width</label><div style="display:flex;gap:5px;align-items:center"><input id="p-bdw" class="pi pi-sm" type="number" min="0"><span class="unit">px</span></div></div>
          <div class="pr"><label>Style</label><select id="p-bds" class="pi"><option>none</option><option>solid</option><option>dashed</option><option>dotted</option><option>double</option><option>groove</option><option>ridge</option></select></div>
          <div class="pr"><label>Color</label><div class="clr-row"><input type="color" id="p-bdc" class="pi-clr"><input id="p-bdchex" class="pi pi-hex" maxlength="9"></div></div>
        </div>
      </div>

      <!-- Dimensions -->
      <div class="sec" id="sec-dims">
        <div class="sec-hd"><span>Dimensions</span><span class="chev">&#9660;</span></div>
        <div class="sec-bd">
          <div class="pr"><label>Width</label><input id="p-w" class="pi" placeholder="auto"></div>
          <div class="pr"><label>Height</label><input id="p-h" class="pi" placeholder="auto"></div>
          <div class="pr"><label>Min-width</label><input id="p-minw" class="pi" placeholder="none"></div>
          <div class="pr"><label>Max-width</label><input id="p-maxw" class="pi" placeholder="none"></div>
          <div class="pr"><label>Display</label><select id="p-disp" class="pi"><option value="">\u2014</option><option>block</option><option>inline</option><option>inline-block</option><option>flex</option><option>grid</option><option>none</option></select></div>
        </div>
      </div>

      <!-- Actions -->
      <div class="sec" id="sec-act">
        <div class="sec-hd"><span>Actions</span><span class="chev">&#9660;</span></div>
        <div class="sec-bd" style="gap:5px">
          <button class="act-btn" id="act-dup">&#8853; Duplicate element</button>
          <button class="act-btn" id="act-up">&#8593; Move up</button>
          <button class="act-btn" id="act-dn">&#8595; Move down</button>
          <button class="act-btn act-del" id="act-del">&#128465; Delete element</button>
        </div>
      </div>

    </div><!-- /p-body -->
  </div><!-- /props -->

</div><!-- /workspace -->

<!-- \u2500\u2500 Status bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="statusbar">
  <div id="mode-wrap">
    <button class="mode-btn on" data-mode="edit">Edit</button>
    <button class="mode-btn" data-mode="preview">Preview</button>
  </div>
  <span class="sb-sep">|</span>
  <div id="el-path">No element selected</div>
  <div style="margin-left:auto;display:flex;align-items:center;gap:5px">
    <button class="sb-btn" id="sb-undo" disabled title="Undo (Ctrl+Z)">&#8629; Undo</button>
    <button class="sb-btn" id="sb-redo" disabled title="Redo (Ctrl+Y)">&#8630; Redo</button>
    <span class="sb-sep">|</span>
    <button class="sb-btn" id="sb-save" disabled>&#128190; Save page</button>
  </div>
</div>

<div id="toasts"></div>

<script>
(function () {
'use strict';

// \u2500\u2500 State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
var S = {
  mode: 'edit',
  selEl: null,
  hovEl: null,
  activeHost: null,
  currentRoute: '/',
  viewport: 'desktop',
  zoom: 1,
  undo: [],
  undoIdx: -1,
  jobId: null,
  cancelled: false,
  baseOutDir: null,
};

// \u2500\u2500 DOM shortcuts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function g(id) { return document.getElementById(id); }
var urlInput    = g('url-input');
var cloneBtn    = g('clone-btn');
var cloneBtnHTML = cloneBtn.innerHTML;
var tbSave      = g('tb-save');
var progOverlay = g('progress-overlay');
var prTitle     = g('pr-title');
var prLog       = g('pr-log');
var stPages     = g('st-pages');
var stAssets    = g('st-assets');
var stRoutes    = g('st-routes');
var welcome     = g('welcome');
var frameWrap   = g('frame-wrap');
var frameScaler = g('frame-scaler');
var frame       = g('preview-frame');
var overlay     = g('editor-overlay');
var pEmpty      = g('p-empty');
var pBody       = g('p-body');
var elInfo      = g('el-info');
var elPath      = g('el-path');
var sbUndo      = g('sb-undo');
var sbRedo      = g('sb-redo');
var sbSave      = g('sb-save');
var siteList    = g('site-list');
var pageList    = g('page-list');

// \u2500\u2500 Toast \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function toast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast ' + (type || 'inf');
  el.textContent = msg;
  g('toasts').appendChild(el);
  setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(function(){ el.remove(); }, 300); }, 2800);
}

// \u2500\u2500 Collapsible sections \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
document.querySelectorAll('.sec-hd').forEach(function (hd) {
  hd.addEventListener('click', function () { hd.parentElement.classList.toggle('cl'); });
});

// \u2500\u2500 Viewport \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
var VP = { desktop: '100%', tablet: '768px', mobile: '390px' };
document.querySelectorAll('.vp-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.vp-btn').forEach(function (b) { b.classList.remove('on'); });
    btn.classList.add('on');
    S.viewport = btn.dataset.vp;
    applyViewport();
    deselect();
  });
});
function applyViewport() {
  var w = VP[S.viewport] || '100%';
  if (S.viewport === 'desktop') {
    frameScaler.style.width = '100%';
    frame.style.width = '100%';
  } else {
    frameScaler.style.width = w;
    frame.style.width = w;
  }
  applyZoom();
}
g('zoom-sel').addEventListener('change', function (e) {
  S.zoom = parseFloat(e.target.value);
  applyZoom();
});
function applyZoom() {
  frameScaler.style.transform = 'scale(' + S.zoom + ')';
  frameScaler.style.transformOrigin = 'top center';
  // Compensate container height so scrollbar stays accurate
  if (frame.contentDocument) {
    var h = frame.contentDocument.documentElement.scrollHeight;
    frameScaler.style.marginBottom = (h * S.zoom - h) + 'px';
  }
}

// \u2500\u2500 Clone \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
cloneBtn.addEventListener('click', startClone);
urlInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') startClone(); });

var elapsedTimer = null;
var cloneStartMs = 0;
var runningAssets = 0;

function fmtElapsed(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60); s = s % 60;
  var h = Math.floor(m / 60); m = m % 60;
  if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}

function startElapsed() {
  cloneStartMs = Date.now();
  runningAssets = 0;
  g('pr-elapsed').textContent = '0s';
  g('pr-elapsed-wrap').style.display = '';
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = setInterval(function () {
    g('pr-elapsed').textContent = fmtElapsed(Date.now() - cloneStartMs);
  }, 1000);
}

function stopElapsed() {
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
  if (cloneStartMs) g('pr-elapsed').textContent = fmtElapsed(Date.now() - cloneStartMs);
}

function setProgressState(state) {
  var badge = g('pr-badge');
  var spinner = g('pr-spinner');
  badge.className = 'pr-badge ' + state;
  spinner.className = 'spinner ' + (state === 'running' ? '' : state);
  if (state === 'running') { badge.textContent = 'Running'; }
  else if (state === 'done') { badge.textContent = 'Done'; }
  else { badge.textContent = 'Error'; }
}

function startClone() {
  var url = urlInput.value.trim();
  if (!url) { urlInput.focus(); return; }
  if (!/^https?:\\/\\//.test(url)) { url = 'https://' + url; urlInput.value = url; }
  S.cancelled = false;
  prLog.textContent = '';
  stPages.textContent = '0'; stAssets.textContent = '0'; stRoutes.textContent = '0';
  var hostname = '';
  try { hostname = new URL(url).hostname; prTitle.textContent = 'Cloning ' + hostname + '\u2026'; } catch(e) { prTitle.textContent = 'Cloning\u2026'; }
  g('pr-started').textContent = 'Started ' + new Date().toLocaleTimeString();
  g('dismiss-btn').style.display = 'none';
  g('cancel-btn').style.display = '';
  setProgressState('running');
  welcome.style.display = 'none';
  frameWrap.classList.remove('on');
  progOverlay.classList.add('on');
  cloneBtn.disabled = true; cloneBtn.textContent = 'Cloning\u2026';
  startElapsed();

  fetch('/api/clone', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url: url }) })
    .then(function (r) { return r.json(); })
    .then(function (d) { S.jobId = d.jobId; streamProgress(d.jobId); })
    .catch(function (e) {
      stopElapsed();
      setProgressState('error');
      cloneBtn.disabled = false; cloneBtn.innerHTML = cloneBtnHTML;
      toast('Failed to start: ' + e.message, 'err');
    });
}

g('cancel-btn').addEventListener('click', function () {
  S.cancelled = true;
  stopElapsed();
  if (S.jobId) fetch('/api/cancel/' + S.jobId, { method: 'POST' }).catch(function(){});
  progOverlay.classList.remove('on');
  if (!frameWrap.classList.contains('on')) welcome.style.display = '';
  cloneBtn.disabled = false; cloneBtn.innerHTML = cloneBtnHTML;
  toast('Cancelled', 'inf');
});

g('dismiss-btn').addEventListener('click', function () {
  progOverlay.classList.remove('on');
  if (!frameWrap.classList.contains('on')) welcome.style.display = '';
});

function streamProgress(jobId) {
  var es = new EventSource('/api/progress/' + jobId);
  es.onmessage = function (e) {
    if (S.cancelled) { es.close(); return; }
    var line = JSON.parse(e.data);
    var m;
    if ((m = line.match(/\\[(\\d+)\\//))) { stPages.textContent = m[1]; }
    if ((m = line.match(/Assets: \\+(\\d+)/))) {
      runningAssets += parseInt(m[1], 10);
      stAssets.textContent = String(runningAssets);
    }
    if ((m = line.match(/Detected (\\d+) API/))) { stRoutes.textContent = m[1]; }
    prLog.textContent += line + '\\n';
    prLog.parentElement.scrollTop = prLog.parentElement.scrollHeight;
    if (line === '[DONE]') { es.close(); onDone(); }
    else if (line.startsWith('[ERROR]')) {
      es.close(); stopElapsed(); setProgressState('error');
      cloneBtn.disabled = false; cloneBtn.innerHTML = cloneBtnHTML;
      g('cancel-btn').style.display = 'none';
      g('dismiss-btn').style.display = '';
      toast(line.slice(8) || 'Clone failed', 'err');
    }
  };
  es.onerror = function () { es.close(); pollJob(jobId); };
}

function pollJob(id) {
  if (S.cancelled) return;
  fetch('/api/job/' + id).then(function (r) { return r.json(); }).then(function (d) {
    if (d.status === 'done') onDone();
    else if (d.status === 'error') {
      stopElapsed(); setProgressState('error');
      cloneBtn.disabled = false; cloneBtn.innerHTML = cloneBtnHTML;
      g('cancel-btn').style.display = 'none'; g('dismiss-btn').style.display = '';
      toast('Clone failed', 'err');
    }
    else setTimeout(function () { pollJob(id); }, 1000);
  });
}

function onDone() {
  stopElapsed();
  setProgressState('done');
  cloneBtn.disabled = false; cloneBtn.innerHTML = cloneBtnHTML;
  tbSave.disabled = false; sbSave.disabled = false;
  g('cancel-btn').style.display = 'none';
  g('dismiss-btn').style.display = '';
  resetUndo();
  loadSites(true);
  toast('Clone complete!', 'ok');
  // Auto-dismiss after 3s if a site was loaded
  setTimeout(function () {
    if (frameWrap.classList.contains('on')) progOverlay.classList.remove('on');
  }, 3000);
}

// \u2500\u2500 Site list \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function loadSites(autoSelect) {
  fetch('/api/sites').then(function (r) { return r.json(); }).then(function (sites) {
    siteList.innerHTML = '';
    g('site-count').textContent = sites.length ? '(' + sites.length + ')' : '';
    sites.forEach(function (site) {
      var row = document.createElement('div');
      row.className = 'site-row' + (site.hostname === S.activeHost ? ' on' : '');
      row.innerHTML = '<img class="site-fav" src="https://www.google.com/s2/favicons?domain=' + site.hostname + '&sz=16" onerror="this.style.visibility='hidden'">'
        + '<span class="site-name" title="' + site.hostname + '">' + site.hostname + '</span>'
        + '<span class="site-badge">' + site.pageCount + 'p</span>';
      row.addEventListener('click', function () {
        fetch('/api/switch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ hostname: site.hostname }) })
          .then(function () {
            S.activeHost = site.hostname;
            document.querySelectorAll('.site-row').forEach(function (r2) { r2.classList.remove('on'); });
            row.classList.add('on');
            loadPages(site.hostname);
            tbSave.disabled = false; sbSave.disabled = false;
          });
      });
      siteList.appendChild(row);
    });
    if (autoSelect && sites.length) {
      var last = sites[sites.length - 1];
      if (!S.activeHost || sites.some(function(s){ return s.hostname === S.activeHost; })) {
        var target = S.activeHost || last.hostname;
        S.activeHost = target;
        var row2 = siteList.querySelector('[title="' + target + '"]');
        if (row2) row2.parentElement.classList.add('on');
        loadPages(target);
      }
    }
  });
}

function loadPages(hostname) {
  fetch('/api/routes?host=' + encodeURIComponent(hostname)).then(function (r) { return r.json(); }).then(function (routes) {
    pageList.innerHTML = '';
    routes.forEach(function (route) {
      var btn = document.createElement('button');
      btn.className = 'page-btn';
      btn.textContent = route === '/' ? '/ (home)' : route;
      btn.title = route;
      btn.addEventListener('click', function () { loadPage(route, btn); });
      pageList.appendChild(btn);
    });
    if (routes.length) loadPage(routes[0], pageList.firstChild);
  });
}

function loadPage(route, btn) {
  S.currentRoute = route;
  resetUndo();
  deselect();
  document.querySelectorAll('.page-btn').forEach(function (b) { b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  welcome.style.display = 'none';
  frameWrap.classList.add('on');
  frame.src = '/site?route=' + encodeURIComponent(route) + '&host=' + encodeURIComponent(S.activeHost || '');
}

// \u2500\u2500 Frame load \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
frame.addEventListener('load', function () {
  injectEditorCSS();
  applyMode();
  applyZoom();
  // Auto-size frame height
  try {
    var h = frame.contentDocument.documentElement.scrollHeight;
    if (h > 200) frame.style.height = h + 'px';
  } catch(e) {}
});

function injectEditorCSS() {
  try {
    var doc = frame.contentDocument;
    if (!doc || !doc.head || doc.getElementById('__ce__')) return;
    var s = doc.createElement('style');
    s.id = '__ce__';
    s.textContent = '.__h{outline:2px dashed rgba(59,130,246,.7)!important;outline-offset:2px!important;cursor:crosshair!important}.__s{outline:2px solid #3b82f6!important;outline-offset:2px!important}.__editing{cursor:text!important}';
    doc.head.appendChild(s);
  } catch(e) {}
}

// \u2500\u2500 Mode toggle \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
document.querySelectorAll('.mode-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    S.mode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(function (b) { b.classList.remove('on'); });
    btn.classList.add('on');
    applyMode();
  });
});
function applyMode() {
  if (S.mode === 'edit') { overlay.classList.add('on'); }
  else { overlay.classList.remove('on'); deselect(); }
}

// \u2500\u2500 Editor interactions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
var SKIP = { HTML:1, HEAD:1, BODY:1, SCRIPT:1, STYLE:1, META:1, LINK:1, NOSCRIPT:1, BR:1, IFRAME:1 };

function getEl(e) {
  try {
    var sr = frameScaler.getBoundingClientRect();
    var x = (e.clientX - sr.left) / S.zoom;
    var y = (e.clientY - sr.top) / S.zoom;
    var el = frame.contentDocument.elementFromPoint(x, y);
    while (el && SKIP[el.tagName]) el = el.parentElement;
    return el || null;
  } catch(err) { return null; }
}

overlay.addEventListener('mousemove', function (e) {
  var el = getEl(e);
  if (el === S.hovEl) return;
  if (S.hovEl && S.hovEl !== S.selEl) S.hovEl.classList.remove('__h');
  S.hovEl = el;
  if (el && el !== S.selEl) el.classList.add('__h');

  // Cursor
  overlay.style.cursor = el ? 'crosshair' : 'default';
});

overlay.addEventListener('mouseleave', function () {
  if (S.hovEl && S.hovEl !== S.selEl) { S.hovEl.classList.remove('__h'); S.hovEl = null; }
});

overlay.addEventListener('click', function (e) {
  var el = getEl(e);
  if (!el) { deselect(); return; }
  if (el === S.selEl) return; // single click on already-selected: no re-select (dblclick starts edit)
  select(el);
});

overlay.addEventListener('dblclick', function (e) {
  var el = getEl(e);
  if (el) startEdit(el);
});

function select(el) {
  deselect();
  S.selEl = el;
  el.classList.remove('__h');
  el.classList.add('__s');
  syncPanel(el);
  updatePath(el);
  pEmpty.style.display = 'none';
  pBody.style.display = '';
}

function deselect() {
  if (S.selEl) { S.selEl.classList.remove('__s', '__h', '__editing'); S.selEl.contentEditable = 'inherit'; }
  if (S.hovEl) { S.hovEl.classList.remove('__h'); }
  S.selEl = null; S.hovEl = null;
  pEmpty.style.display = '';
  pBody.style.display = 'none';
  elPath.textContent = 'No element selected';
}

function startEdit(el) {
  overlay.classList.remove('on');
  el.classList.add('__editing');
  el.contentEditable = 'true';
  el.focus();
  // Place cursor at end
  try { var r = frame.contentDocument.createRange(); r.selectNodeContents(el); r.collapse(false); var sel = frame.contentWindow.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch(e) {}
  function stop() {
    el.contentEditable = 'inherit';
    el.classList.remove('__editing');
    overlay.classList.add('on');
    if (el === S.selEl) { g('p-text').value = el.textContent || ''; }
    el.removeEventListener('blur', stop);
  }
  el.addEventListener('blur', stop);
}

function updatePath(el) {
  var parts = [];
  var cur = el;
  while (cur && cur.tagName && parts.length < 5) {
    var s = cur.tagName.toLowerCase();
    if (cur.id) s += '#' + cur.id;
    else {
      var cls = Array.prototype.filter.call(cur.classList, function(c){ return !c.startsWith('__'); });
      if (cls.length) s += '.' + cls[0];
    }
    parts.unshift(s);
    cur = cur.parentElement;
  }
  if (cur && cur.tagName) parts.unshift('\u2026');
  elPath.textContent = parts.join(' \u203A ');
}

// \u2500\u2500 Properties panel sync \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
var syncing = false;
function syncPanel(el) {
  syncing = true;
  try {
    var cs = frame.contentWindow.getComputedStyle(el);
    var is = el.style;

    // Element info
    var h = '<span class="bdg bdg-tag">' + el.tagName.toLowerCase() + '</span>';
    if (el.id) h += ' <span class="bdg bdg-id">#' + el.id + '</span>';
    Array.prototype.slice.call(el.classList).filter(function(c){ return !c.startsWith('__'); }).slice(0,5).forEach(function(c){
      h += ' <span class="bdg bdg-cls">.' + c + '</span>';
    });
    elInfo.innerHTML = h;

    // Content tab: only if element has purely text children
    var hasSub = !!el.querySelector('*');
    g('sec-content').style.opacity = hasSub ? '.45' : '1';
    g('p-text').value = hasSub ? '' : (el.textContent || '');
    g('p-text').disabled = hasSub;

    // Typography
    g('p-ff').value = (is.fontFamily || cs.fontFamily || '').replace(/['"]/g,'').split(',')[0].trim();
    g('p-fs').value = Math.round(parseFloat(cs.fontSize)) || '';
    g('p-fw').value = nearestWeight(cs.fontWeight);
    var col = rgb2hex(cs.color);
    g('p-color').value = col; g('p-colorhex').value = col;
    document.querySelectorAll('[data-align]').forEach(function(b){ b.classList.toggle('on', b.dataset.align === cs.textAlign); });
    g('p-bold').classList.toggle('on', parseInt(cs.fontWeight) >= 600);
    g('p-italic').classList.toggle('on', cs.fontStyle === 'italic');
    g('p-uline').classList.toggle('on', cs.textDecoration.indexOf('underline') >= 0);
    g('p-strike').classList.toggle('on', cs.textDecoration.indexOf('line-through') >= 0);
    var fsz = parseFloat(cs.fontSize) || 16;
    var lh = parseFloat(cs.lineHeight);
    g('p-lh').value = isNaN(lh) ? '' : (Math.round(lh/fsz*100)/100);
    g('p-ls').value = Math.round((parseFloat(cs.letterSpacing) || 0)*10)/10;

    // Background
    var bg = cs.backgroundColor;
    var isTransparent = !bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
    var bgHex = isTransparent ? '#ffffff' : rgb2hex(bg);
    g('p-bg').value = bgHex; g('p-bghex').value = isTransparent ? '' : bgHex;
    var op = parseFloat(is.opacity !== '' ? is.opacity : '1');
    if (isNaN(op)) op = 1;
    g('p-opacity').value = op;
    g('p-opacity').style.setProperty('--pct', Math.round(op*100) + '%');
    g('p-opval').textContent = Math.round(op*100) + '%';

    // Spacing
    g('p-pt').value = pxInt(cs.paddingTop);
    g('p-pr2').value = pxInt(cs.paddingRight);
    g('p-pb').value = pxInt(cs.paddingBottom);
    g('p-pl').value = pxInt(cs.paddingLeft);
    g('p-mt').value = pxInt(cs.marginTop);
    g('p-mr').value = pxInt(cs.marginRight);
    g('p-mb').value = pxInt(cs.marginBottom);
    g('p-ml').value = pxInt(cs.marginLeft);

    // Border
    g('p-bdr').value = pxInt(cs.borderTopLeftRadius);
    g('p-bdw').value = pxInt(cs.borderTopWidth);
    g('p-bds').value = cs.borderTopStyle || 'none';
    var bdc = rgb2hex(cs.borderTopColor);
    g('p-bdc').value = bdc; g('p-bdchex').value = bdc;

    // Dimensions
    g('p-w').value = is.width || '';
    g('p-h').value = is.height || '';
    g('p-minw').value = is.minWidth || '';
    g('p-maxw').value = is.maxWidth || '';
    g('p-disp').value = is.display || '';
  } catch(e) {}
  syncing = false;
}

function rgb2hex(v) {
  if (!v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)') return '#000000';
  var m = v.match(/d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0,3).map(function(n){ return ('0'+parseInt(n).toString(16)).slice(-2); }).join('');
}
function pxInt(v) { return Math.round(parseFloat(v)) || 0; }
function nearestWeight(v) {
  var n = parseInt(v); if (isNaN(n)) return v === 'bold' ? '700' : '400';
  return String([100,200,300,400,500,600,700,800,900].reduce(function(a,b){ return Math.abs(b-n)<Math.abs(a-n)?b:a; }));
}

// \u2500\u2500 Apply a style property \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function applyStyle(prop, val) {
  if (syncing || !S.selEl) return;
  var old = S.selEl.style[prop];
  S.selEl.style[prop] = val;
  recordUndo({ el: S.selEl, prop: prop, old: old, val: val });
}

// \u2500\u2500 Wiring helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function onIn(id, cb) { g(id).addEventListener('input', cb); }
function wire(id, prop, xform) {
  onIn(id, function(){ applyStyle(prop, xform ? xform(g(id).value) : g(id).value); });
}
function wireColorPair(cId, hId, prop) {
  g(cId).addEventListener('input', function(){ g(hId).value = g(cId).value; applyStyle(prop, g(cId).value); });
  g(hId).addEventListener('input', function(){
    var v = g(hId).value;
    if (/^#[0-9a-f]{6}$/i.test(v)) { g(cId).value = v; applyStyle(prop, v); }
  });
}
function px(v) { return v ? v + 'px' : ''; }

// Text
onIn('p-text', function(){
  if (syncing || !S.selEl || S.selEl.querySelector('*')) return;
  var old = S.selEl.textContent;
  S.selEl.textContent = g('p-text').value;
  recordUndo({ el: S.selEl, prop: 'textContent', old: old, val: g('p-text').value });
});

// Typography
wire('p-ff', 'fontFamily');
wire('p-fs', 'fontSize', px);
wire('p-fw', 'fontWeight');
wireColorPair('p-color', 'p-colorhex', 'color');
wire('p-lh', 'lineHeight');
wire('p-ls', 'letterSpacing', px);

// Align
document.querySelectorAll('[data-align]').forEach(function(btn){
  btn.addEventListener('click', function(){
    if (!S.selEl) return;
    document.querySelectorAll('[data-align]').forEach(function(b){ b.classList.remove('on'); });
    btn.classList.add('on');
    applyStyle('textAlign', btn.dataset.align);
  });
});

// Style toggles
function toggle(btnId, prop, valOn, valOff) {
  g(btnId).addEventListener('click', function(){
    if (!S.selEl) return;
    var cs = frame.contentWindow.getComputedStyle(S.selEl);
    var cur = cs[prop];
    var isOn = g(btnId).classList.contains('on');
    g(btnId).classList.toggle('on', !isOn);
    applyStyle(prop, isOn ? valOff : valOn);
  });
}
toggle('p-bold',   'fontWeight',    '700',          '400');
toggle('p-italic', 'fontStyle',     'italic',       'normal');
toggle('p-uline',  'textDecoration','underline',    'none');
toggle('p-strike', 'textDecoration','line-through', 'none');

// Background
wireColorPair('p-bg', 'p-bghex', 'backgroundColor');
onIn('p-opacity', function(){
  var v = g('p-opacity').value;
  g('p-opval').textContent = Math.round(parseFloat(v)*100) + '%';
  g('p-opacity').style.setProperty('--pct', Math.round(parseFloat(v)*100) + '%');
  applyStyle('opacity', v);
});

// Spacing
var spacingMap = { 'p-pt':'paddingTop','p-pr2':'paddingRight','p-pb':'paddingBottom','p-pl':'paddingLeft','p-mt':'marginTop','p-mr':'marginRight','p-mb':'marginBottom','p-ml':'marginLeft' };
Object.keys(spacingMap).forEach(function(id){ wire(id, spacingMap[id], px); });

// Border
wire('p-bdr', 'borderRadius', px);
wire('p-bdw', 'borderWidth',  px);
wire('p-bds', 'borderStyle');
wireColorPair('p-bdc', 'p-bdchex', 'borderColor');

// Dimensions
wire('p-w',    'width');
wire('p-h',    'height');
wire('p-minw', 'minWidth');
wire('p-maxw', 'maxWidth');
wire('p-disp', 'display');

// \u2500\u2500 Actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
g('act-del').addEventListener('click', function(){
  if (!S.selEl) return;
  var el = S.selEl, par = el.parentElement, nxt = el.nextSibling;
  deselect();
  par.removeChild(el);
  recordUndo({ type: 'del', el: el, par: par, nxt: nxt });
  toast('Element deleted', 'inf');
});
g('act-dup').addEventListener('click', function(){
  if (!S.selEl) return;
  var cl = S.selEl.cloneNode(true);
  cl.classList.remove('__s','__h','__editing');
  cl.contentEditable = 'inherit';
  S.selEl.parentElement.insertBefore(cl, S.selEl.nextSibling);
  toast('Duplicated', 'ok');
});
g('act-up').addEventListener('click', function(){
  if (!S.selEl) return;
  var prev = S.selEl.previousElementSibling;
  if (prev) S.selEl.parentElement.insertBefore(S.selEl, prev);
});
g('act-dn').addEventListener('click', function(){
  if (!S.selEl) return;
  var next = S.selEl.nextElementSibling;
  if (next) S.selEl.parentElement.insertBefore(next, S.selEl);
});

// \u2500\u2500 Undo / redo \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function recordUndo(op) {
  S.undo.splice(S.undoIdx + 1);
  S.undo.push(op);
  if (S.undo.length > 80) S.undo.shift(); else S.undoIdx++;
  refreshUndoBtns();
}
function resetUndo() { S.undo = []; S.undoIdx = -1; refreshUndoBtns(); }
function refreshUndoBtns() {
  sbUndo.disabled = S.undoIdx < 0;
  sbRedo.disabled = S.undoIdx >= S.undo.length - 1;
}
function applyOp(op, rev) {
  if (op.type === 'del') {
    if (rev) op.par.insertBefore(op.el, op.nxt);
    else     op.par.removeChild(op.el);
  } else {
    var v = rev ? op.old : op.val;
    if (op.prop === 'textContent') op.el.textContent = v;
    else op.el.style[op.prop] = v;
    if (op.el === S.selEl) syncPanel(op.el);
  }
}
sbUndo.addEventListener('click', function(){
  if (S.undoIdx < 0) return;
  applyOp(S.undo[S.undoIdx--], true);
  refreshUndoBtns();
});
sbRedo.addEventListener('click', function(){
  if (S.undoIdx >= S.undo.length - 1) return;
  applyOp(S.undo[++S.undoIdx], false);
  refreshUndoBtns();
});
document.addEventListener('keydown', function(e){
  var tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); sbUndo.click(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); sbRedo.click(); }
  if (e.key === 'Escape') deselect();
  if (e.key === 'Delete' && S.selEl) g('act-del').click();
});

// \u2500\u2500 Save \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function savePage() {
  var doc = frame.contentDocument;
  if (!doc) return;
  // Strip editor artifacts
  var ce = doc.getElementById('__ce__');
  if (ce) ce.remove();
  doc.querySelectorAll('.__s,.__h,.__editing').forEach(function(el){
    el.classList.remove('__s','__h','__editing');
    el.contentEditable = 'inherit';
  });
  var html = doc.documentElement.outerHTML;
  // Re-inject immediately so editing continues
  injectEditorCSS();

  tbSave.disabled = true; sbSave.disabled = true;
  tbSave.textContent = 'Saving\u2026';

  fetch('/api/save', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ route: S.currentRoute, html: html, host: S.activeHost }) })
    .then(function(r){ return r.json(); })
    .then(function(){ toast('Saved!', 'ok'); })
    .catch(function(){ toast('Save failed', 'err'); })
    .finally(function(){ tbSave.disabled = false; sbSave.disabled = false; tbSave.textContent = '\\u{1F4BE} Save'; });
}
tbSave.addEventListener('click', savePage);
sbSave.addEventListener('click', savePage);

// \u2500\u2500 Init \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
loadSites(false);

})();
</script>
</body>
</html>`;
async function handle(req, res, baseOutDir, port) {
  const u = new URL(req.url ?? "/", `http://localhost:${port}`);
  const path = u.pathname;
  const method = (req.method ?? "GET").toUpperCase();
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    if (path === "/" && method === "GET") return serve(res, UI_HTML, "text/html; charset=utf-8");
    if (path === "/api/sites" && method === "GET") {
      return json(res, listSites(baseOutDir));
    }
    if (path === "/api/switch" && method === "POST") {
      const { hostname } = JSON.parse(await readBody(req));
      const dir = outDirForHost(baseOutDir, hostname);
      if (existsSync(join(dir, "route-map.json"))) activeOutDir = dir;
      return json(res, { ok: true });
    }
    if (path === "/api/clone" && method === "POST") {
      const body = JSON.parse(await readBody(req));
      const { url: targetUrl, maxPages = "25", depth = "3", concurrency = "2" } = body;
      const hostname = new URL(targetUrl).hostname;
      const outDir = outDirForHost(baseOutDir, hostname);
      const jobId = randomUUID();
      const job = { id: jobId, status: "running", lines: [], outputDir: outDir, hostname, listeners: /* @__PURE__ */ new Set() };
      jobs.set(jobId, job);
      const { cmd, args: base } = getCliArgs();
      const argv = [...base, "clone", targetUrl, "--out", outDir, "--max-pages", maxPages, "--depth", depth, "--concurrency", concurrency, "--ignore-robots"];
      const child = spawn(cmd, argv, { stdio: ["ignore", "pipe", "pipe"] });
      job.proc = child;
      const pipe = (chunk) => chunk.toString().split("\n").filter(Boolean).forEach((l) => broadcast(job, l));
      child.stdout.on("data", pipe);
      child.stderr.on("data", pipe);
      child.on("close", (code) => {
        if (code === 0) {
          job.status = "done";
          activeOutDir = outDir;
          broadcast(job, "[DONE]");
        } else {
          job.status = "error";
          broadcast(job, "[ERROR] Clone failed (exit " + code + ")");
        }
        for (const r of job.listeners) r.end();
        job.listeners.clear();
      });
      return json(res, { jobId });
    }
    if (path.startsWith("/api/cancel/") && method === "POST") {
      const jobId = path.slice("/api/cancel/".length);
      const job = jobs.get(jobId);
      if (job?.proc) {
        try {
          job.proc.kill();
        } catch {
        }
      }
      if (job) {
        job.status = "error";
        for (const r of job.listeners) r.end();
        job.listeners.clear();
      }
      return json(res, { ok: true });
    }
    if (path.startsWith("/api/progress/") && method === "GET") {
      const jobId = path.slice("/api/progress/".length);
      const job = jobs.get(jobId);
      if (!job) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
      for (const l of job.lines) sendSSE(res, l);
      if (job.status !== "running") {
        res.end();
        return;
      }
      job.listeners.add(res);
      req.on("close", () => job.listeners.delete(res));
      return;
    }
    if (path.startsWith("/api/job/") && method === "GET") {
      const jobId = path.slice("/api/job/".length);
      const job = jobs.get(jobId);
      if (!job) {
        res.writeHead(404);
        res.end();
        return;
      }
      return json(res, { status: job.status });
    }
    if (path === "/api/routes" && method === "GET") {
      const host = u.searchParams.get("host") ?? "";
      const dir = host ? outDirForHost(baseOutDir, host) : activeOutDir;
      const mapPath = join(dir, "route-map.json");
      if (!dir || !existsSync(mapPath)) return json(res, []);
      const map = JSON.parse(readFileSync(mapPath, "utf8"));
      return json(res, Object.keys(map));
    }
    if (path === "/api/save" && method === "POST") {
      const { route, html, host } = JSON.parse(await readBody(req));
      const dir = host ? outDirForHost(baseOutDir, host) : activeOutDir;
      const mapPath = join(dir, "route-map.json");
      if (!dir || !existsSync(mapPath)) {
        res.writeHead(503);
        res.end("No active clone");
        return;
      }
      const map = JSON.parse(readFileSync(mapPath, "utf8"));
      const filename = map[route];
      if (!filename) {
        res.writeHead(404);
        res.end("Route not found");
        return;
      }
      writeFileSync(join(dir, "captured-pages", filename), html, "utf8");
      return json(res, { ok: true });
    }
    if (path === "/site" && method === "GET") {
      const route = u.searchParams.get("route") ?? "/";
      const host = u.searchParams.get("host") ?? "";
      const dir = host ? outDirForHost(baseOutDir, host) : activeOutDir;
      const mapPath = join(dir, "route-map.json");
      if (!dir || !existsSync(mapPath)) {
        res.writeHead(503);
        res.end("Not cloned yet");
        return;
      }
      const map = JSON.parse(readFileSync(mapPath, "utf8"));
      const filename = map[route] ?? map["/"];
      if (!filename) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const htmlPath = join(dir, "captured-pages", filename);
      if (!existsSync(htmlPath)) {
        res.writeHead(404);
        res.end("File missing");
        return;
      }
      return serve(res, readFileSync(htmlPath), "text/html; charset=utf-8");
    }
    if (path.startsWith("/_assets/") && method === "GET") {
      const host = u.searchParams.get("host") ?? "";
      const dir = host ? outDirForHost(baseOutDir, host) : activeOutDir;
      if (!dir) {
        res.writeHead(404);
        res.end();
        return;
      }
      const assetPath = join(dir, "public", path);
      if (!existsSync(assetPath)) {
        res.writeHead(404);
        res.end();
        return;
      }
      const dot = path.lastIndexOf(".");
      const ext = dot >= 0 ? path.slice(dot).toLowerCase() : "";
      return serve(res, readFileSync(assetPath), MIME[ext] ?? "application/octet-stream");
    }
    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error("[server]", err);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal error");
  }
}
async function startServer(baseOutDir, port) {
  const existing = listSites(baseOutDir);
  if (existing.length > 0) {
    const last = existing[existing.length - 1];
    activeOutDir = outDirForHost(baseOutDir, last.hostname);
  }
  const server = createServer((req, res) => handle(req, res, baseOutDir, port));
  await new Promise((resolve2) => server.listen(port, resolve2));
  const lines = [
    "",
    "  Web Cloner Studio",
    "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "  Local:  http://localhost:" + port,
    "",
    "  Open the URL above in your browser.",
    "  Enter a site URL and click Clone,",
    "  then edit any element visually.",
    ""
  ];
  console.log(lines.join("\n"));
  await new Promise(() => {
  });
}

// src/cli.ts
program.name("cloner").description("Web cloner: captures JS-heavy sites and generates a Next.js full-stack clone").version("0.1.0");
program.command("clone <url>").description("Clone a website").option("-o, --out <dir>", "Output directory", "./output/site").option("-m, --max-pages <n>", "Max pages to crawl", "50").option("-d, --depth <n>", "Max link depth", "3").option("-c, --concurrency <n>", "Concurrent browser contexts", "1").option("--ignore-robots", "Skip robots.txt check", false).option("-v, --verbose", "Print DEBUG lines to console (all detail goes to log file regardless)", false).action(async (url, options) => {
  await runClone({
    url,
    out: resolve(options.out),
    maxPages: parseInt(options.maxPages, 10),
    depth: parseInt(options.depth, 10),
    concurrency: parseInt(options.concurrency, 10),
    ignoreRobots: options.ignoreRobots,
    verbose: options.verbose
  });
});
program.command("serve").description("Start the web UI for cloning and editing sites").option("-p, --port <n>", "Port to listen on", "3333").option("-o, --out <dir>", "Base output directory for cloned sites", "./output").action(async (options) => {
  const port = parseInt(options.port, 10);
  const outDir = resolve(options.out);
  await startServer(outDir, port);
});
program.parseAsync(process.argv).catch((err) => {
  logger.error("Fatal error", err);
  logger.close();
  process.exit(1);
});
//# sourceMappingURL=cli.js.map