// ==UserScript==
// @name         百度网盘视频播放器（解锁版）
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  黑夜给了我黑色的眼睛，我却用它寻找光明。
// @author       You
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/mbox/streampage*
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var msg = function (msg, mode) {
        window.require && window.require("system-core:system/uiService/tip/tip.js").show({ vipType: "svip", mode: mode || "success", msg: msg});
    };

    window.require ? window.require.async("file-widget-1:videoPlay/context.js", function(c) {
        if (window.locals) {
            window.locals.set("is_svip", 1);
            window.locals.get("file_list", function(file_list) {
                if (Array.isArray(file_list) && file_list.length == 1 && file_list[0].mediaType == "video") {
                    try {
                        window.require("system-core:context/context.js").instanceForSystem.message.callSystem("share-video-after-transfer");
                    } catch (error) {
                        msg("不想保存到网盘 却很难", "failure");
                    }
                }
            });
        }

        var count, id = count = setInterval(function() {
            var context = c.getContext() || {}, playerInstance = context.playerInstance;
            if (playerInstance && playerInstance.player) {
                clearInterval(id);
                window.player = playerInstance.player; // 脱了脱了
                if (playerInstance.userInfo && playerInstance.userInfo.isSVip) {
                    msg("尊贵的 SVIP 用户，您好！");
                }
            }
            else if (++count - id > 60) {
                clearInterval(id);
                msg("not playerInstance", "failure");
            }
        }, 500);
    }) : alert("脚本已失效，谢谢您的陪伴，再见");

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
