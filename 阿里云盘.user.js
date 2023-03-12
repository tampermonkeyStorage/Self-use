// ==UserScript==
// @name         阿里云盘
// @namespace    http://tampermonkey.net/
// @version      3.1.0
// @description  一键跳转搜索适用于当前网站的脚本
// @match        *://*/*
// @icon         https://scriptcat.org/assets/logo.png
// @require      https://greasyfork.org/scripts/461573-script-statistics/code/script-statistics.js?version=1159644
// @connect      scriptcat.org
// @antifeature  tracking
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==
 
(function () {
    'use strict';
 
    new SC_Statistic({ scriptId: 886, banFrame: false });
    GM_registerMenuCommand("ScriptCat 搜索（雨露均占）", function () {
        GM_openInTab("https://scriptcat.org/search?keyword=" + document.title, { active: true });
    });
    GM_registerMenuCommand("ScriptCat 搜索（独爱一枝）", function () {
        GM_openInTab("https://scriptcat.org/search?domain=" + document.domain, { active: true });
    });
 
    // Your code here...
})();
