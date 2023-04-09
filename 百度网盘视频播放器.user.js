// ==UserScript==
// @name         BD网盘视频播放器
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.6.7
// @description  支持PC、移动端播放，支持任意倍速调整，支持记忆、连续播放，支持自由选集，支持画质增强，画面模式调节，画中画，支持音质增强，支持自动、手动添加字幕，。。。。。。
// @author       You
// @match        http*://yun.baidu.com/s/*
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/pfile/video*
// @match        https://pan.baidu.com/mbox/streampage*
// @connect      baidu.com
// @connect      baidupcs.com
// @connect      lc-cn-n1-shared.com
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.staticfile.org/hls.js/1.3.5/hls.min.js
// @require      https://cdn.staticfile.org/dplayer/1.26.0/DPlayer.min.js
// @require      https://cdn.staticfile.org/localforage/1.10.0/localforage.min.js
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @run-at       document-start
// @antifeature  ads
// @antifeature  membership
// @antifeature  payment
// @antifeature  referral-link
// @antifeature  tracking
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    var localforage = window.localforage;
    var obj = {
        video_page: {
            info: [],
            quality: [],
            categorylist: [],
            sub_info: [],
            adToken: "",
            flag: ""
        }
    };

    obj.storageFileListSharePage = function () {
        try {
            var currentList = obj.require('system-core:context/context.js').instanceForSystem.list.getCurrentList();
            if (currentList.length) {
                window.sessionStorage.setItem("sharePageFileList", JSON.stringify(currentList));
            }
            else {
                setTimeout(obj.storageFileListSharePage, 500);
            }
        }
        catch (error) { };
        window.onhashchange = function (e) {
            setTimeout(obj.storageFileListSharePage, 500);
        };
        document.querySelector(".fufHyA") && [ ...document.querySelectorAll(".fufHyA") ].forEach(element => {
            element.onclick = function () {
                setTimeout(obj.storageFileListSharePage, 500);
            };
        });
    };

    obj.fileForcePreviewSharePage = function () {
        obj.getJquery()(document).on("click", "#shareqr dd", function(event) {
            try {
                var selectedFile = obj.require('system-core:context/context.js').instanceForSystem.list.getSelected()
                , file = selectedFile[0];
                if (file.category == 1) {
                    var ext = file.server_filename.split(".").pop();
                    if (["ts"].includes(ext)) {
                        window.open("https://pan.baidu.com" + location.pathname + "?fid=" + file.fs_id, "_blank");
                    }
                }
            } catch (error) { }
        });
    };

    obj.playSharePage = function () {
        unsafeWindow.locals.get("file_list", "sign", "timestamp", "share_uk", "shareid", function(file_list, sign, timestamp, share_uk, shareid) {
            if (file_list.length > 1 || file_list[0].mediaType != "video") {
                obj.storageFileListSharePage();
                obj.fileForcePreviewSharePage();
                return;
            }
            obj.startObj((obj) => {
                var [ file ] = obj.video_page.info = file_list, resolution = file.resolution, fid = file.fs_id, vip = obj.getVip();
                function getUrl(i) {
                    return location.protocol + "//" + location.host + "/share/streaming?channel=chunlei&uk=" + share_uk + "&fid=" + fid + "&sign=" + sign + "&timestamp=" + timestamp + "&shareid=" + shareid + "&type=" + i + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
                }
                obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
                    obj.addQuality(getUrl, resolution);
                    obj.useDPlayer();
                });
            });
        });
    };

    obj.playHomePage = function () {
        obj.getJquery()(document).ajaxComplete(function (event, xhr, options) {
            var requestUrl = options.url;
            if (requestUrl.indexOf("/api/categorylist") >= 0) {
            }
            else if (requestUrl.indexOf("/api/filemetas") >= 0) {
                var response = xhr.responseJSON;
                if (response && response.info) {
                    obj.startObj((obj) => {
                        var [ file ] = obj.video_page.info = response.info, vip = obj.getVip();
                        function getUrl (i) {
                            if (i.includes(1080)) vip > 1 || (i = i.replace(1080, 720));
                            return location.protocol + "//" + location.host + "/api/streaming?path=" + encodeURIComponent(file.path) + "&app_id=250528&clienttype=0&type=" + i + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
                        }
                        obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
                            obj.addQuality(getUrl, file.resolution);
                            obj.useDPlayer();
                        });
                    });
                }
            }
        });
    };

    obj.playPfilePage = function () {
        var open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("load", function(event) {
                if (this.readyState == 4 && this.status == 200) {
                    var responseURL = this.responseURL;
                    if (responseURL.indexOf("/api/filemetas") > 0) {
                        var response = JSON.parse(this.response);
                        if (response.errno == 0 && Array.isArray(response.info) && response.info.length) {
                            if (response.info.length == 1 && obj.video_page.info.length == 0) {
                                obj.startObj((obj) => {
                                    var [ file ] = obj.video_page.info = response.info, vip = obj.getVip();
                                    function getUrl (i) {
                                        if (i.includes(1080)) vip > 1 || (i = i.replace(1080, 720));
                                        return location.protocol + "//" + location.host + "/api/streaming?path=" + encodeURIComponent(file.path) + "&app_id=250528&clienttype=0&type=" + i + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
                                    }
                                    obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
                                        obj.addQuality(getUrl, file.resolution);
                                        obj.useDPlayer();
                                    });
                                });
                            }
                            else {
                                obj.video_page.categorylist = response.info;
                            }
                        }
                    }
                }
            }, false);
            open.apply(this, arguments);
        };
    };

    obj.playStreamPage = function () {
        obj.getJquery()(document).ajaxComplete(function (event, xhr, options) {
            var requestUrl = options.url;
            if (requestUrl.indexOf("/mbox/msg/mediainfo") >= 0) {
                var response = xhr.responseJSON;
                if (response && response.info) {
                    obj.startObj((obj) => {
                        obj.video_page.adToken = response.adToken;
                        var getParam = obj.require("base:widget/tools/service/tools.url.js").getParam;
                        var [ file ] = obj.video_page.info = [{
                            from_uk: getParam("from_uk"),
                            to: getParam("to"),
                            fs_id: getParam("fs_id"),
                            name: getParam("name") || "",
                            type: getParam("type"),
                            md5: getParam("md5"),
                            msg_id: getParam("msg_id"),
                            path: decodeURIComponent(decodeURIComponent(getParam("path")))
                        }];
                        function getUrl (i) {
                            return location.protocol + "//" + location.host + "/mbox/msg/streaming?from_uk=" + file.from_uk + "&to=" + file.to + "&msg_id=" + file.msg_id + "&fs_id=" + file.fs_id + "&type=" + file.type + "&stream_type=" + i;
                        }
                        obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
                            obj.addQuality(getUrl, response.info.resolution);
                            obj.useDPlayer();
                        });
                    });
                }
            }
        });
    };

    obj.getAdToken = function (url, callback) {
        var adToken = obj.video_page.flag === "pfilevideo" ? "" : obj.require("file-widget-1:videoPlay/Werbung/WerbungConfig.js").getAdToken();
        if (obj.video_page.adToken || (obj.video_page.adToken = adToken) || obj.getVip() > 1) {
            return callback && callback();
        }
        var jQuery = obj.getJquery();
        jQuery.ajax({
            url: url,
        }).done(function(n) {
            if (133 === n.errno && 0 !== n.adTime) {
                obj.video_page.adToken = n.adToken;
            }
            callback && callback(obj.correct());
        }).fail(function(n) {
            var t = jQuery.parseJSON(n.responseText);
            if (t && 133 === t.errno && 0 !== t.adTime) {
                obj.video_page.adToken = t.adToken;
            }
            callback && callback(obj.correct());
        });
    };

    obj.getPoster = function() {
        var file = obj.video_page.info.length ? obj.video_page.info[0] : "";
        if (file && file.thumbs) {
            return Object.values(file.thumbs).pop();
        }
        return "";
    };

    obj.addQuality = function (getUrl, resolution) {
        var r = {
            1080: "超清 1080P",
            720: "高清 720P",
            480: "流畅 480P",
            360: "省流 360P"
        };
        var freeList = obj.freeList(resolution);
        obj.startObj.toString().includes("GM") && freeList.forEach(function (a, index) {
            obj.video_page.quality.push({
                name: r[a],
                url: getUrl("M3U8_AUTO_" + a) + "&isplayer=1&check_blue=1&adToken=" + encodeURIComponent(obj.video_page.adToken ? obj.video_page.adToken : ""),
                type: "hls"
            });
        });
    };

    obj.freeList = function (e) {
        e = e || "";
        var t = [480, 360]
        , a = obj.correct.toString().length == 940 ? e.match(/width:(\d+),height:(\d+)/) : ["", "", ""]
        , i = +a[1] * +a[2];
        return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t
    };

    obj.useDPlayer = function () {
        if (window.DPlayer) return obj.isAppreciation.toString().length == 865 && obj.dPlayerStart();
    };

    obj.dPlayerStart = function () {
        var dPlayerNode, videoNode = document.getElementById("video-wrap") || document.querySelector(".vp-video__player");
        if (videoNode) {
            dPlayerNode = document.getElementById("dplayer");
            if (!dPlayerNode) {
                dPlayerNode = document.createElement("div");
                dPlayerNode.setAttribute("id", "dplayer");
                dPlayerNode.setAttribute("style", "width: 100%; height: 100%;");
                obj.videoNode = videoNode.parentNode.replaceChild(dPlayerNode, videoNode);
            }
        }
        else {
            console.warn("尝试再次获取播放器容器");
            return setTimeout(obj.dPlayerStart, 500);
        }
        var quality = obj.video_page.quality, defaultQuality = quality.findIndex(function (item) {
            return item.name == localStorage.getItem("dplayer-quality");
        });
        var options = {
            container: dPlayerNode,
            video: {
                quality: quality,
                defaultQuality: defaultQuality < 0 ? 0 : defaultQuality || 0,
                customType: {
                    hls: function (video, player) {
                        const hls = new window.Hls({ maxBufferLength: 30 * 2 * 10 });
                        hls.loadSource(video.src);
                        hls.attachMedia(video);
                    },
                },
                pic: obj.getPoster()
            },
            subtitle: {
                url: "",
                type: "webvtt",
                color: localStorage.getItem("dplayer-subtitle-color") || "#ffd821",
                bottom: (localStorage.getItem("dplayer-subtitle-bottom") || 10) + "%",
                fontSize: (localStorage.getItem("dplayer-subtitle-fontSize") || 5) + "vh"
            },
            autoplay: true,
            screenshot: true,
            hotkey: true,
            airplay: true,
            volume: 1.0,
            contextmenu: [
                {
                    text: "👍 喜欢吗 👍 赞一个 👍",
                    link: "https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png"
                },
                {
                    text: "👍 为爱发电 不再弹出 👍",
                    link: "https://afdian.net/order/create?plan_id=dc4bcdfa5c0a11ed8ee452540025c377&product_type=0",
                    click: obj.showDialog
                },
            ],
            theme: "#b7daff"
        };
        try {
            var player = new window.DPlayer(options);
            obj.initPlayer(player);
            obj.resetPlayer();
            obj.msg("DPlayer 播放器创建成功");
        } catch (error) {
            obj.msg("播放器创建失败", "failure");
        }
    };

    obj.initPlayer = function (player) {
        var $ = obj.getJquery();
        obj.playerReady(player, function(player) {
            (obj.onPost.length && obj.onPost.toString().length == 467) || player.destroy();
            (obj.isIntegrity.length && obj.isIntegrity.toString().length == 627) || player.destroy();
            obj.isIntegrity(player, function() {
                const { container } = player;
                $(container).nextAll().remove();
                location.pathname == "/mbox/streampage" && $(container).css("height", "480px");
                $(document).on("change", ".afdian-order", function () {
                    if (this.value) {
                        if (this.value.match(/^202[\d]{22,25}$/)) {
                            if (this.value.match(/(\d)\1{7,}/g)) return;
                            localforage.getItem("users", (error, data) => {
                                (data && data.ON == this.value) || obj.onPost(this.value, function (users) {
                                    localforage.removeItem("menutap");
                                });
                            });
                        }
                        else {
                            obj.msg("\u6b64\u8ba2\u5355\u53f7\u4e0d\u5408\u89c4\u8303\uff0c\u8bf7\u91cd\u8bd5", "failure");
                        }
                    }
                });
            });
            obj.isAppreciation(function (data) {
                if (data) {
                    obj.dPlayerSetting(player);
                    obj.gestureInit(player);
                    obj.longPressInit(player);
                    obj.dblclickInit(player);
                    obj.dPlayerPip(player);
                    obj.dPlayerSubtitleSetting();
                }
                else {
                    player.on("contextmenu_show", function () {
                        $(".dplayer-menu").length || $(".dplayer-menu-item").length || player.destroy();
                        player.pause();
                    });
                }
            });
            obj.initPlayerEvents(player);
            obj.memoryPlay(player);
            obj.appreciation(player);
            obj.videoFit();
            obj.autoPlayEpisode();
            obj.addCueVideoSubtitle(player, function (textTracks) {
                if (textTracks) {
                    obj.selectSubtitles(textTracks);
                    player.subtitle.container.style.textShadow = "1px 0 1px #000, 0 1px 1px #000, -1px 0 1px #000, 0 -1px 1px #000, 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000";
                    player.subtitle.container.style.fontFamily = "黑体, Trajan, serif";
                }
            });
        });
    };

    obj.playerReady = function (player, callback) {
        if (player.isReady) {
            callback && callback(player);
        }
        else if (player.video.duration > 0 || player.video.readyState > 2) {
            player.isReady = true;
            callback && callback(player);
        }
        else {
            player.video.ondurationchange = function () {
                player.video.ondurationchange = null;
                player.isReady = true;
                callback && callback(player);
            }
        }
        setTimeout(function () {
            if (player.isReady) {
                sessionStorage.removeItem("startError");
                var pnum = GM_getValue("pnum", 1);
                GM_setValue("pnum", ++pnum);
                (obj.appreciation.length && obj.appreciation.toString().length == 551) || player.destroy();
                setTimeout(() => { obj.appreciation(player) }, player.video.duration / 2 * 1000);
            }
            else {
                if (sessionStorage.getItem("startError")) {
                    sessionStorage.removeItem("startError");
                }
                else {
                    sessionStorage.setItem("startError", 1);
                    location.reload();
                }
            }
        }, 8000);
    };

    obj.isIntegrity = function (player, callback) {
        const { options: { contextmenu } } = player;
        JSON.stringify(contextmenu).includes(6336167) || player.destroy();
        JSON.stringify(contextmenu).includes(2540025) || player.destroy();
        document.querySelector("#dplayer .dplayer-menu-item").addEventListener('click', () => {
            localforage.getItem("menutap", function(error, data) {
                localforage.setItem("menutap", (data = data || 0, ++data));
                data < 10 && GM_setValue("appreciation_show", Date.now() - 86400000 / 2);
            });
        });
        callback && callback();
    };

    obj.isAppreciation = function (callback) {
        localforage.getItem("users", function(error, data) {
            data?.expire_time ? localforage.getItem("users_sign", function(error, users_sign) {
                users_sign === btoa(encodeURIComponent(JSON.stringify(data))) ? Math.max(Date.parse(data.expire_time) - Date.now(), 0) ? callback && callback(data) : localforage.setItem("users", {expire_time: new Date().toISOString()}).then(() => {obj.isAppreciation(callback)}) : obj.usersPost(function (data) {
                    Math.max(Date.parse(data.expire_time) - Date.now() || 0, 0) ? (localforage.setItem("users", data), localforage.setItem("users_sign", btoa(encodeURIComponent(JSON.stringify(data)))), callback && callback(data)) : (localforage.removeItem("users"), callback && callback(""));
                });
            }) : callback && callback("");
        });
    };

    obj.initPlayerEvents = function (player) {
        player.on("error", function () {
            const { video: { duration } } = player;
            if (duration === 0 || duration === Infinity || duration.toString() === "NaN") {
            }
        });
        player.on("ended", function () {
            obj.isAppreciation(function (data) {
                if (data) {
                    localStorage.getItem("dplayer-autoplaynext") == "1" && obj.getJquery()(".next-icon").click();
                }
                else {
                    obj.msg("\u7231\u53d1\u7535\u0020\u81ea\u52a8\u8df3\u8f6c\u4e0b\u4e00\u96c6");
                    player.contextmenu.show(player.container.offsetWidth / 2.5, player.container.offsetHeight / 3);
                }
            });
        });
        player.on("quality_end", function () {
            localStorage.setItem("dplayer-quality", player.quality.name);
        });
        if (localStorage.getItem("dplayer-isfullscreen") == "true") {
            player.fullScreen.request("web");
            obj.getJquery()("#layoutHeader,.header-box").css("display", "none");
        }
        player.on("webfullscreen", function () {
            obj.getJquery()("#layoutHeader,.header-box").css("display", "none");
        });
        player.on("webfullscreen_cancel", function () {
            obj.getJquery()("#layoutHeader,.header-box").css("display", "block");
        });
        player.on("fullscreen", function () {
            screen.orientation.lock("landscape");
        });
        player.on("fullscreen_cancel", function () {
            screen.orientation.unlock();
        });
        document.querySelector(".dplayer .dplayer-full").addEventListener('click', () => {
            var isFullScreen = obj.appreciation(player) || player.fullScreen.isFullScreen("web") || player.fullScreen.isFullScreen("browser");
            localStorage.setItem("dplayer-isfullscreen", isFullScreen);
        });
    };

    obj.dPlayerSetting = function (player) {
        var $ = obj.getJquery();
        if ($(".dplayer-setting-autoposition").length) return;
        var html = '<div class="dplayer-setting-item dplayer-setting-autoposition"><span class="dplayer-label">自动记忆播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoposition" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-autoplaynext"><span class="dplayer-label">自动连续播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoplaynext" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-soundenhancement"><span class="dplayer-label">音质增强</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-soundenhancement" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-imageenhancement"><span class="dplayer-label">画质增强</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-imageenhancement" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        $(".dplayer-setting-origin-panel").append(html);
        const { user, template: { video } } = player;
        Object.assign(user.storageName, { autoposition: "dplayer-autoposition", autoplaynext: "dplayer-autoplaynext", imageenhancement: "dplayer-imageenhancement", soundenhancement: "dplayer-soundenhancement" });
        Object.assign(user.default, { autoposition: 0, autoplaynext: 1, imageenhancement: 0, soundenhancement: 0 });
        user.init();
        obj.customSpeed(player);

        user.get("autoposition") && ($(".dplayer-toggle-setting-input-autoposition").get(0).checked = true);
        user.get("autoplaynext") && ($(".dplayer-toggle-setting-input-autoplaynext").get(0).checked = true);
        user.get("soundenhancement") && ($(".dplayer-toggle-setting-input-soundenhancement").get(0).checked = true, obj.joySound(player, 1));
        user.get("imageenhancement") && ($(".dplayer-toggle-setting-input-imageenhancement").get(0).checked = true, video.style.cssText = "filter: contrast(1.01) brightness(1.05) saturate(1.1);");
        $(".dplayer-setting-autoposition").on("click", function() {
            var checked = !$(".dplayer-toggle-setting-input-autoposition").is(":checked");
            $(".dplayer-toggle-setting-input-autoposition").get(0).checked = checked;
            player.notice("自动记忆播放：" + (checked ? "开启" : "关闭"));
            user.set("autoposition", Number(checked));
        });
        $(".dplayer-setting-autoplaynext").on("click", function() {
            var checked = !$(".dplayer-toggle-setting-input-autoplaynext").is(":checked");
            $(".dplayer-toggle-setting-input-autoplaynext").get(0).checked = checked;
            user.set("autoplaynext", Number(checked));
        });
        $(".dplayer-setting-soundenhancement").on("click", function() {
            var checked = !$(".dplayer-toggle-setting-input-soundenhancement").is(":checked");
            $(".dplayer-toggle-setting-input-soundenhancement").get(0).checked = checked;
            obj.joySound(player, Number(checked));
            user.set("soundenhancement", Number(checked));
        });
        $(".dplayer-setting-imageenhancement").on("click", function() {
            var checked = !$(".dplayer-toggle-setting-input-imageenhancement").is(":checked");
            checked ? video.style.cssText = "filter: contrast(1.01) brightness(1.05) saturate(1.1);" : video.style.cssText = "";
            $(".dplayer-toggle-setting-input-imageenhancement").get(0).checked = checked;
            user.set("imageenhancement", Number(checked));
        });
    };

    obj.customSpeed = function (player) {
        var $ = obj.getJquery();
        if ($(".dplayer-setting-speed-item[data-speed='自定义']").length) return;
        this.appreciation || player.destroy();
        var localSpeed = localStorage.getItem("dplayer-speed");
        localSpeed && player.speed(localSpeed);
        $(".dplayer-setting-speed-panel").append('<div class="dplayer-setting-speed-item" data-speed="自定义"><span class="dplayer-label">自定义</span></div>');
        $(".dplayer-setting").append('<div class="dplayer-setting-custom-speed" style="display: none;right: 72px;position: absolute;bottom: 50px;width: 150px;border-radius: 2px;background: rgba(28,28,28,.9);padding: 7px 0;transition: all .3s ease-in-out;overflow: hidden;z-index: 2;"><div class="dplayer-speed-item" style="padding: 5px 10px;box-sizing: border-box;cursor: pointer;position: relative;"><span class="dplayer-speed-label" title="双击恢复正常速度" style="color: #eee;font-size: 13px;display: inline-block;vertical-align: middle;white-space: nowrap;">播放速度：</span><input type="number" style="width: 55px;height: 15px;top: 3px;font-size: 13px;border: 1px solid #fff;border-radius: 3px;text-align: center;" step=".1" max="16" min=".1"></div></div>');
        var custombox = $(".dplayer-setting-custom-speed");
        var input = $(".dplayer-setting-custom-speed input");
        input.val(localSpeed || 1);
        input.on("input propertychange", function(e) {
            var val = input.val();
            input.val(val);
            player.speed(val);
        });
        player.on("ratechange", function () {
            const { video: { playbackRate } } = player;
            player.notice("播放速度：" + playbackRate);
            localStorage.setItem("dplayer-speed", playbackRate);
            input.val(playbackRate);
        });
        $(".dplayer-setting-custom-speed span").dblclick(function() {
            input.val(1);
            player.speed(1);
        });
        $(".dplayer-setting-speed-item[data-speed='自定义']").on("click", function() {
            if (document.querySelector(".dplayer .dplayer-menu").classList.contains("dplayer-menu-show")) {
                obj.msg("\u8bf7\u4f7f\u7528\u7231\u53d1\u7535\u4f53\u9a8c\u6d4b\u8bd5\u529f\u80fd");
            }
            else {
                obj.isAppreciation(function (data) {
                    if (data) {
                        custombox.css("display") == "block" ? (custombox.css("display", "none"), player.setting.hide()) : custombox.css("display", "block");
                    }
                    else {
                        player.contextmenu.show(player.container.offsetWidth / 2.5, player.container.offsetHeight / 3);
                        obj.msg("\u8bf7\u4f7f\u7528\u7231\u53d1\u7535\u4f53\u9a8c\u6d4b\u8bd5\u529f\u80fd");
                    }
                });
            }
        }).prevAll().on("click", function() {
            custombox.css("display", "none");
        });
        player.template.mask.addEventListener("click", function() {
            obj.isAppreciation.toString().length == 865 || player.destroy();
            custombox.css("display", "none");
        });
    };

    obj.joySound = function (player, enabled = 0) {
        const { user, template: { video } } = player;
        window.Joysound || obj.initJoysound();
        if (window.Joysound && window.Joysound.isSupport()) {
            var joySound = player.joySound;
            joySound || (joySound = player.joySound = new window.Joysound());
            joySound._mediaElement || joySound.init(video);
            joySound.setEnabled(enabled);
        }
    };

    obj.initJoysound = function () {
        "undefined"!=typeof window&&(window.Joysound=window.Joysound||function(){return function(t){var e={};function n(i){if(e[i])return e[i].exports;var r=e[i]={i:i,l:!1,exports:{}};return t[i].call(r.exports,r,r.exports,n),r.l=!0,r.exports}return n.m=t,n.c=e,n.d=function(t,e,i){n.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:i})},n.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},n.t=function(t,e){if(1&e&&(t=n(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var i=Object.create(null);if(n.r(i),Object.defineProperty(i,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var r in t)n.d(i,r,function(e){return t[e]}.bind(null,r));return i},n.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return n.d(e,"a",e),e},n.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},n.p="",n(n.s="./src/index.ts")}({"./node_modules/@babel/runtime/helpers/construct.js":function(t,e,n){var i=n("./node_modules/@babel/runtime/helpers/setPrototypeOf.js"),r=n("./node_modules/@babel/runtime/helpers/isNativeReflectConstruct.js");function a(e,n,o){return r()?(t.exports=a=Reflect.construct,t.exports.default=t.exports,t.exports.__esModule=!0):(t.exports=a=function(t,e,n){var r=[null];r.push.apply(r,e);var a=new(Function.bind.apply(t,r));return n&&i(a,n.prototype),a},t.exports.default=t.exports,t.exports.__esModule=!0),a.apply(null,arguments)}t.exports=a,t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/@babel/runtime/helpers/createClass.js":function(t,e){function n(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}t.exports=function(t,e,i){return e&&n(t.prototype,e),i&&n(t,i),t},t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/@babel/runtime/helpers/extends.js":function(t,e){function n(){return t.exports=n=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var i in n)Object.prototype.hasOwnProperty.call(n,i)&&(t[i]=n[i])}return t},t.exports.default=t.exports,t.exports.__esModule=!0,n.apply(this,arguments)}t.exports=n,t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/@babel/runtime/helpers/getPrototypeOf.js":function(t,e){function n(e){return t.exports=n=Object.setPrototypeOf?Object.getPrototypeOf:function(t){return t.__proto__||Object.getPrototypeOf(t)},t.exports.default=t.exports,t.exports.__esModule=!0,n(e)}t.exports=n,t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/@babel/runtime/helpers/inheritsLoose.js":function(t,e,n){var i=n("./node_modules/@babel/runtime/helpers/setPrototypeOf.js");t.exports=function(t,e){t.prototype=Object.create(e.prototype),t.prototype.constructor=t,i(t,e)},t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/@babel/runtime/helpers/isNativeFunction.js":function(t,e){t.exports=function(t){return-1!==Function.toString.call(t).indexOf("[native code]")},t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/@babel/runtime/helpers/isNativeReflectConstruct.js":function(t,e){t.exports=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(t){return!1}},t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/@babel/runtime/helpers/setPrototypeOf.js":function(t,e){function n(e,i){return t.exports=n=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t},t.exports.default=t.exports,t.exports.__esModule=!0,n(e,i)}t.exports=n,t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/@babel/runtime/helpers/wrapNativeSuper.js":function(t,e,n){var i=n("./node_modules/@babel/runtime/helpers/getPrototypeOf.js"),r=n("./node_modules/@babel/runtime/helpers/setPrototypeOf.js"),a=n("./node_modules/@babel/runtime/helpers/isNativeFunction.js"),o=n("./node_modules/@babel/runtime/helpers/construct.js");function s(e){var n="function"==typeof Map?new Map:void 0;return t.exports=s=function(t){if(null===t||!a(t))return t;if("function"!=typeof t)throw new TypeError("Super expression must either be null or a function");if(void 0!==n){if(n.has(t))return n.get(t);n.set(t,e)}function e(){return o(t,arguments,i(this).constructor)}return e.prototype=Object.create(t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),r(e,t)},t.exports.default=t.exports,t.exports.__esModule=!0,s(e)}t.exports=s,t.exports.default=t.exports,t.exports.__esModule=!0},"./node_modules/events/events.js":function(t,e,n){"use strict";var i,r="object"==typeof Reflect?Reflect:null,a=r&&"function"==typeof r.apply?r.apply:function(t,e,n){return Function.prototype.apply.call(t,e,n)};i=r&&"function"==typeof r.ownKeys?r.ownKeys:Object.getOwnPropertySymbols?function(t){return Object.getOwnPropertyNames(t).concat(Object.getOwnPropertySymbols(t))}:function(t){return Object.getOwnPropertyNames(t)};var o=Number.isNaN||function(t){return t!=t};function s(){s.init.call(this)}t.exports=s,t.exports.once=function(t,e){return new Promise((function(n,i){function r(n){t.removeListener(e,a),i(n)}function a(){"function"==typeof t.removeListener&&t.removeListener("error",r),n([].slice.call(arguments))}m(t,e,a,{once:!0}),"error"!==e&&function(t,e,n){"function"==typeof t.on&&m(t,"error",e,n)}(t,r,{once:!0})}))},s.EventEmitter=s,s.prototype._events=void 0,s.prototype._eventsCount=0,s.prototype._maxListeners=void 0;var l=10;function c(t){if("function"!=typeof t)throw new TypeError('The "listener" argument must be of type Function. Received type '+typeof t)}function u(t){return void 0===t._maxListeners?s.defaultMaxListeners:t._maxListeners}function p(t,e,n,i){var r,a,o,s;if(c(n),void 0===(a=t._events)?(a=t._events=Object.create(null),t._eventsCount=0):(void 0!==a.newListener&&(t.emit("newListener",e,n.listener?n.listener:n),a=t._events),o=a[e]),void 0===o)o=a[e]=n,++t._eventsCount;else if("function"==typeof o?o=a[e]=i?[n,o]:[o,n]:i?o.unshift(n):o.push(n),(r=u(t))>0&&o.length>r&&!o.warned){o.warned=!0;var l=new Error("Possible EventEmitter memory leak detected. "+o.length+" "+String(e)+" listeners added. Use emitter.setMaxListeners() to increase limit");l.name="MaxListenersExceededWarning",l.emitter=t,l.type=e,l.count=o.length,s=l,console&&console.warn&&console.warn(s)}return t}function h(){if(!this.fired)return this.target.removeListener(this.type,this.wrapFn),this.fired=!0,0===arguments.length?this.listener.call(this.target):this.listener.apply(this.target,arguments)}function d(t,e,n){var i={fired:!1,wrapFn:void 0,target:t,type:e,listener:n},r=h.bind(i);return r.listener=n,i.wrapFn=r,r}function f(t,e,n){var i=t._events;if(void 0===i)return[];var r=i[e];return void 0===r?[]:"function"==typeof r?n?[r.listener||r]:[r]:n?function(t){for(var e=new Array(t.length),n=0;n<e.length;++n)e[n]=t[n].listener||t[n];return e}(r):A(r,r.length)}function g(t){var e=this._events;if(void 0!==e){var n=e[t];if("function"==typeof n)return 1;if(void 0!==n)return n.length}return 0}function A(t,e){for(var n=new Array(e),i=0;i<e;++i)n[i]=t[i];return n}function m(t,e,n,i){if("function"==typeof t.on)i.once?t.once(e,n):t.on(e,n);else{if("function"!=typeof t.addEventListener)throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type '+typeof t);t.addEventListener(e,(function r(a){i.once&&t.removeEventListener(e,r),n(a)}))}}Object.defineProperty(s,"defaultMaxListeners",{enumerable:!0,get:function(){return l},set:function(t){if("number"!=typeof t||t<0||o(t))throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received '+t+".");l=t}}),s.init=function(){void 0!==this._events&&this._events!==Object.getPrototypeOf(this)._events||(this._events=Object.create(null),this._eventsCount=0),this._maxListeners=this._maxListeners||void 0},s.prototype.setMaxListeners=function(t){if("number"!=typeof t||t<0||o(t))throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received '+t+".");return this._maxListeners=t,this},s.prototype.getMaxListeners=function(){return u(this)},s.prototype.emit=function(t){for(var e=[],n=1;n<arguments.length;n++)e.push(arguments[n]);var i="error"===t,r=this._events;if(void 0!==r)i=i&&void 0===r.error;else if(!i)return!1;if(i){var o;if(e.length>0&&(o=e[0]),o instanceof Error)throw o;var s=new Error("Unhandled error."+(o?" ("+o.message+")":""));throw s.context=o,s}var l=r[t];if(void 0===l)return!1;if("function"==typeof l)a(l,this,e);else{var c=l.length,u=A(l,c);for(n=0;n<c;++n)a(u[n],this,e)}return!0},s.prototype.addListener=function(t,e){return p(this,t,e,!1)},s.prototype.on=s.prototype.addListener,s.prototype.prependListener=function(t,e){return p(this,t,e,!0)},s.prototype.once=function(t,e){return c(e),this.on(t,d(this,t,e)),this},s.prototype.prependOnceListener=function(t,e){return c(e),this.prependListener(t,d(this,t,e)),this},s.prototype.removeListener=function(t,e){var n,i,r,a,o;if(c(e),void 0===(i=this._events))return this;if(void 0===(n=i[t]))return this;if(n===e||n.listener===e)0==--this._eventsCount?this._events=Object.create(null):(delete i[t],i.removeListener&&this.emit("removeListener",t,n.listener||e));else if("function"!=typeof n){for(r=-1,a=n.length-1;a>=0;a--)if(n[a]===e||n[a].listener===e){o=n[a].listener,r=a;break}if(r<0)return this;0===r?n.shift():function(t,e){for(;e+1<t.length;e++)t[e]=t[e+1];t.pop()}(n,r),1===n.length&&(i[t]=n[0]),void 0!==i.removeListener&&this.emit("removeListener",t,o||e)}return this},s.prototype.off=s.prototype.removeListener,s.prototype.removeAllListeners=function(t){var e,n,i;if(void 0===(n=this._events))return this;if(void 0===n.removeListener)return 0===arguments.length?(this._events=Object.create(null),this._eventsCount=0):void 0!==n[t]&&(0==--this._eventsCount?this._events=Object.create(null):delete n[t]),this;if(0===arguments.length){var r,a=Object.keys(n);for(i=0;i<a.length;++i)"removeListener"!==(r=a[i])&&this.removeAllListeners(r);return this.removeAllListeners("removeListener"),this._events=Object.create(null),this._eventsCount=0,this}if("function"==typeof(e=n[t]))this.removeListener(t,e);else if(void 0!==e)for(i=e.length-1;i>=0;i--)this.removeListener(t,e[i]);return this},s.prototype.listeners=function(t){return f(this,t,!0)},s.prototype.rawListeners=function(t){return f(this,t,!1)},s.listenerCount=function(t,e){return"function"==typeof t.listenerCount?t.listenerCount(e):g.call(t,e)},s.prototype.listenerCount=g,s.prototype.eventNames=function(){return this._eventsCount>0?i(this._events):[]}},"./node_modules/js-base64/base64.js":function(t,n,i){var r;!function(e,i){t.exports=function(e){"use strict";var i,a=(e=e||{}).Base64,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",s=function(t){for(var e={},n=0,i=t.length;n<i;n++)e[t.charAt(n)]=n;return e}(o),l=String.fromCharCode,c=function(t){if(t.length<2)return(e=t.charCodeAt(0))<128?t:e<2048?l(192|e>>>6)+l(128|63&e):l(224|e>>>12&15)+l(128|e>>>6&63)+l(128|63&e);var e=65536+1024*(t.charCodeAt(0)-55296)+(t.charCodeAt(1)-56320);return l(240|e>>>18&7)+l(128|e>>>12&63)+l(128|e>>>6&63)+l(128|63&e)},u=/[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g,p=function(t){return t.replace(u,c)},h=function(t){var e=[0,2,1][t.length%3],n=t.charCodeAt(0)<<16|(t.length>1?t.charCodeAt(1):0)<<8|(t.length>2?t.charCodeAt(2):0);return[o.charAt(n>>>18),o.charAt(n>>>12&63),e>=2?"=":o.charAt(n>>>6&63),e>=1?"=":o.charAt(63&n)].join("")},d=e.btoa&&"function"==typeof e.btoa?function(t){return e.btoa(t)}:function(t){if(t.match(/[^\x00-\xFF]/))throw new RangeError("The string contains invalid characters.");return t.replace(/[\s\S]{1,3}/g,h)},f=function(t){return d(p(String(t)))},g=function(t){return t.replace(/[+\/]/g,(function(t){return"+"==t?"-":"_"})).replace(/=/g,"")},A=function(t,e){return e?g(f(t)):f(t)};e.Uint8Array&&(i=function(t,e){for(var n="",i=0,r=t.length;i<r;i+=3){var a=t[i],s=t[i+1],l=t[i+2],c=a<<16|s<<8|l;n+=o.charAt(c>>>18)+o.charAt(c>>>12&63)+(void 0!==s?o.charAt(c>>>6&63):"=")+(void 0!==l?o.charAt(63&c):"=")}return e?g(n):n});var m,y=/[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g,v=function(t){switch(t.length){case 4:var e=((7&t.charCodeAt(0))<<18|(63&t.charCodeAt(1))<<12|(63&t.charCodeAt(2))<<6|63&t.charCodeAt(3))-65536;return l(55296+(e>>>10))+l(56320+(1023&e));case 3:return l((15&t.charCodeAt(0))<<12|(63&t.charCodeAt(1))<<6|63&t.charCodeAt(2));default:return l((31&t.charCodeAt(0))<<6|63&t.charCodeAt(1))}},I=function(t){return t.replace(y,v)},b=function(t){var e=t.length,n=e%4,i=(e>0?s[t.charAt(0)]<<18:0)|(e>1?s[t.charAt(1)]<<12:0)|(e>2?s[t.charAt(2)]<<6:0)|(e>3?s[t.charAt(3)]:0),r=[l(i>>>16),l(i>>>8&255),l(255&i)];return r.length-=[0,0,2,1][n],r.join("")},M=e.atob&&"function"==typeof e.atob?function(t){return e.atob(t)}:function(t){return t.replace(/\S{1,4}/g,b)},x=function(t){return M(String(t).replace(/[^A-Za-z0-9\+\/]/g,""))},C=function(t){return String(t).replace(/[-_]/g,(function(t){return"-"==t?"+":"/"})).replace(/[^A-Za-z0-9\+\/]/g,"")},w=function(t){return function(t){return I(M(t))}(C(t))};if(e.Uint8Array&&(m=function(t){return Uint8Array.from(x(C(t)),(function(t){return t.charCodeAt(0)}))}),e.Base64={VERSION:"2.6.4",atob:x,btoa:d,fromBase64:w,toBase64:A,utob:p,encode:A,encodeURI:function(t){return A(t,!0)},btou:I,decode:w,noConflict:function(){var t=e.Base64;return e.Base64=a,t},fromUint8Array:i,toUint8Array:m},"function"==typeof Object.defineProperty){var D=function(t){return{value:t,enumerable:!1,writable:!0,configurable:!0}};e.Base64.extendString=function(){Object.defineProperty(String.prototype,"fromBase64",D((function(){return w(this)}))),Object.defineProperty(String.prototype,"toBase64",D((function(t){return A(this,t)}))),Object.defineProperty(String.prototype,"toBase64URI",D((function(){return A(this,!0)})))}}return e.Meteor&&(Base64=e.Base64),t.exports?t.exports.Base64=e.Base64:void 0===(r=function(){return e.Base64}.apply(n,[]))||(t.exports=r),{Base64:e.Base64}}(e)}("undefined"!=typeof self?self:"undefined"!=typeof window?window:void 0!==e?e:this)},"./src/events.ts":function(t,e,n){"use strict";var i;n.r(e),function(t){t.ERROR="error",t.STATU_CHANGE="statuChange",t.JSWW_INIT_COMPLETE="jswwInitComplete"}(i||(i={})),e.default=i},"./src/index.ts":function(t,e,n){"use strict";n.r(e);var i,r,a=n("./node_modules/@babel/runtime/helpers/createClass.js"),o=n.n(a),s=n("./node_modules/@babel/runtime/helpers/inheritsLoose.js"),l=n.n(s),c=n("./node_modules/events/events.js"),u=n("./node_modules/@babel/runtime/helpers/extends.js"),p=n.n(u),h=n("./src/utils/log.ts"),d={logLevel:h.LOG_LEVEL.LEVEL_ERROR},f=function(){function t(){}return t.processConfig=function(t){var e=p()({},d);return p()(e,t),e},t}();!function(t){t[t.LIB_LOAD_ERROR=10]="LIB_LOAD_ERROR",t[t.INIT_ERROR=100]="INIT_ERROR",t[t.CREATE_SOURCE_ERROR=101]="CREATE_SOURCE_ERROR"}(i||(i={})),function(t){t.NETWORK_ERROR="networkError",t.MAIN_ERROR="mainError"}(r||(r={}));var g=n("./src/events.ts"),A=n("./src/lib/libjs-wrapper.ts"),m=n("./node_modules/js-base64/base64.js");function y(){return m.Base64.toUint8Array(v)}var v="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dGoLECoaIAMgARBJIANBCGogAxBIBEADQCADKAIMGiADIAMoAgxBBGoiAjYCDCACIAMoAggiAigCAGtBgCBGBEAgAyACQQRqNgIIIAMgAigCBDYCDAsgA0EIaiADEEgNAAsLIAEQDUEANgIAIAEQFUECSwRAA0AgASgCBCgCABAHIAEQJCABEBVBAksNAAsLQYAEIQICQAJAAkAgARAVQQFrDgIBAAILQYAIIQILIAEgAjYCEAsgA0EQaiQAIAQoAgQiASAEKAIIIgJHBEADQCAEEA0aIAEoAgAQByABQQRqIgEgAkcNAAsLIAQiASICKAIEIgMgASgCCEcEQANAIAIQBhogAiACKAIIQQRrNgIIIAIoAgggA0cNAAsLIAQoAgAEQCABEAYaIAEoAgAhBCABECMaIAQQBwsgAAsQBwsL0gIBB38jAEEgayIDJAAgAyAAKAIcIgQ2AhAgACgCFCEFIAMgAjYCHCADIAE2AhggAyAFIARrIgE2AhQgASACaiEEQQIhByADQRBqIQECfwJAAkAgACgCPCADQRBqQQIgA0EMahAAEC9FBEADQCAEIAMoAgwiBUYNAiAFQX9MDQMgASAFIAEoAgQiCEsiBkEDdGoiCSAFIAhBACAGG2siCCAJKAIAajYCACABQQxBBCAGG2oiCSAJKAIAIAhrNgIAIAQgBWshBCAAKAI8IAFBCGogASAGGyIBIAcgBmsiByADQQxqEAAQL0UNAAsLIARBf0cNAQsgACAAKAIsIgE2AhwgACABNgIUIAAgASAAKAIwajYCECACDAELIABBADYCHCAAQgA3AxAgACAAKAIAQSByNgIAQQAgB0ECRg0AGiACIAEoAgRrCyEEIANBIGokACAEC7gEAQZ/QeAAEAghAiMAQRBrIgQkACACIAE2AgQgAiAANgIAIwBBEGsiASQAIwBBEGsiAyQAIAJBDGoiByIFIgZBADYCCCAGQgA3AgAgA0EANgIMIAZBDGogA0EMahBEIANBEGokACAFQQA2AhAgAUEANgIMIAVBFGogAUEMahBFIAFBEGokACACQgA3AlAgAkF/NgJMIAJBAToASiACQQA7AUggAiAAQTJtNgJEIAJBADYCQCACQQA7ATQgAkEANgIwIAIgAEHoB202AiwgAkIANwJYAkACQAJAAkACQCACKAIAIgBB//kBTARAIABBgP0ARiAAQcC7AUZyDQEMAgsgAEGA+gFGIABBgPcCRnINACAAQcTYAkcNAQsgAigCBEEBa0EBSw0BQQEhAANAIARBADYCDCAHIARBDGoQECAAQeoHRwRAIABBAWohAAwBCwsgAkGA2AQQCCIANgIIIABBgNgEEAogAkGA2AQQCCIANgI4IABBgNgEEAogAkGA2AQQCCIANgI8IABBgNgEEAogAkF/IAIoAiwiAUEDdCIAIAFBAXQiAUH+////A3EgAUcbIgEQCCIDNgIkIAMgABAKIAIgARAIIgE2AiggASAAEAoMAwsgAigCBEEBa0ECSQ0BC0HxCRAWIAIoAgAhAAsCQCAAQf/5AUwEQCAAQYD9AEYNAiAAQcC7AUcNAQwCCyAAQYD6AUYgAEHE2AJGciAAQYD3AkZyDQELQYcKEBYLIARBEGokACACCxoAIAAgASgCCCAFEA4EQCABIAIgAyAEEDILCzcAIAAgASgCCCAFEA4EQCABIAIgAyAEEDIPCyAAKAIIIgAgASACIAMgBCAFIAAoAgAoAhQRBwALkQEAIAAgASgCCCAEEA4EQCABIAIgAxAxDwsCQCAAIAEoAgAgBBAORQ0AAkAgAiABKAIQRwRAIAEoAhQgAkcNAQsgA0EBRw0BIAFBATYCIA8LIAEgAjYCFCABIAM2AiAgASABKAIoQQFqNgIoAkAgASgCJEEBRw0AIAEoAhhBAkcNACABQQE6ADYLIAFBBDYCLAsL8gEAIAAgASgCCCAEEA4EQCABIAIgAxAxDwsCQCAAIAEoAgAgBBAOBEACQCACIAEoAhBHBEAgASgCFCACRw0BCyADQQFHDQIgAUEBNgIgDwsgASADNgIgAkAgASgCLEEERg0AIAFBADsBNCAAKAIIIgAgASACIAJBASAEIAAoAgAoAhQRBwAgAS0ANQRAIAFBAzYCLCABLQA0RQ0BDAMLIAFBBDYCLAsgASACNgIUIAEgASgCKEEBajYCKCABKAIkQQFHDQEgASgCGEECRw0BIAFBAToANg8LIAAoAggiACABIAIgAyAEIAAoAgAoAhgRCgALCzEAIAAgASgCCEEAEA4EQCABIAIgAxAzDwsgACgCCCIAIAEgAiADIAAoAgAoAhwRBQALGAAgACABKAIIQQAQDgRAIAEgAiADEDMLC7IDAQV/IwBBQGoiBCQAAn9BASAAIAFBABAODQAaQQAgAUUNABojAEFAaiIDJAAgASgCACIFQQRrKAIAIQYgBUEIaygCACEHIANBADYCFCADQdwkNgIQIAMgATYCDCADQYwlNgIIQQAhBSADQRhqQScQCiABIAdqIQECQCAGQYwlQQAQDgRAIANBATYCOCAGIANBCGogASABQQFBACAGKAIAKAIUEQcAIAFBACADKAIgQQFGGyEFDAELIAYgA0EIaiABQQFBACAGKAIAKAIYEQoAAkACQCADKAIsDgIAAQILIAMoAhxBACADKAIoQQFGG0EAIAMoAiRBAUYbQQAgAygCMEEBRhshBQwBCyADKAIgQQFHBEAgAygCMA0BIAMoAiRBAUcNASADKAIoQQFHDQELIAMoAhghBQsgA0FAayQAQQAgBSIBRQ0AGiAEQQhqQQRyQTQQCiAEQQE2AjggBEF/NgIUIAQgADYCECAEIAE2AgggASAEQQhqIAIoAgBBASABKAIAKAIcEQUAIAQoAiAiAEEBRgRAIAIgBCgCGDYCAAsgAEEBRgshACAEQUBrJAAgAAsLACAAECUaIAAQBwsIACAAECUQBwsFAEGACAsIACAAEDwQBwsIACAAED4QBwsIACAAED8QBwsIACAAEEAQBwsHACAAKAIECwwAIAAgASoCADgCAAvMDAELfyMAQTBrIgYkACAAEA0hAQJAIAAoAhBBgAhPBEAgACAAKAIQQYAIazYCECAGIAAoAgQoAgA2AhggABAkIAAgBkEYahBDDAELAkAgABAVIAAQI0kEQCAAEAYoAgAgACgCCGtBAnVFDQEgBkGACBAiNgIYIAZBGGohAiMAQTBrIgMkAAJAIAAiASgCCCABEAYoAgBHDQAgAUEIaiEEIAFBBGohByABKAIEIgAgASgCACIFSwRAIAQgACAEKAIAIAAgACAFa0ECdUEBakF+bUECdCIEahAoNgIAIAcgBygCACAEajYCAAwBCyADIAEQBigCACABKAIAa0EBdTYCGCADQQE2AiwgA0EYaiADQRhqIANBLGoQGygCACIAIABBAnYgARAGEBohACADQRBqIAEoAgQQDyEFIANBCGogASgCCBAPIQggACAFKAIAIAgoAgAQHiABIAAQCSAHIABBBGoQCSAEIABBCGoQCSABEAYgABAGEAkgABAZCyABEAYgASgCCCACEBggASABKAIIQQRqNgIIIANBMGokAAwCCyAGIAAQI0EBdDYCCCAGQQE2AgAgBkEYaiAGQQhqIAYQGygCACAAEBUgABAGEBohA0GACBAiIQQgBiABQYAIECohByMAQRBrIgEkACABIAQ2AgwgBkEIaiIEIgIgAUEMahBFIAIgBykCADcCBCABQRBqJAAgBiAEKAIANgIAIAYhByMAQTBrIgIkAAJAIAMiASgCCCABEAYoAgBHDQAgAUEIaiEIIAFBBGohCSABKAIEIgUgASgCACIKSwRAIAggBSAIKAIAIAUgBSAKa0ECdUEBakF+bUECdCIIahAoNgIAIAkgCSgCACAIajYCAAwBCyACIAEQBigCACABKAIAa0EBdTYCGCACQQE2AiwgAkEYaiACQRhqIAJBLGoQGygCACIFIAVBAnYgASgCEBAaIQUgAkEQaiABKAIEEA8hCiACQQhqIAEoAggQDyELIAUgCigCACALKAIAEB4gASAFEAkgCSAFQQRqEAkgCCAFQQhqEAkgARAGIAUQBhAJIAUQGQsgASgCECABKAIIIAcQGCABIAEoAghBBGo2AgggAkEwaiQAIAQoAgAaIARBADYCACAAKAIIIgUgACgCBEcEQANAIAVBBGsiBSEIIwBBMGsiByQAAkAgAygCBCABKAIARw0AIAEoAgggARAGKAIASQRAIAEQBiEJIAEgASgCBCABKAIIIgIgAiAJKAIAIAJrQQJ1QQFqQQJtQQJ0IglqEEE2AgQgASABKAIIIAlqNgIIDAELIAcgARAGKAIAIAEoAgBrQQF1NgIYIAdBATYCLCAHQRhqIAdBGGogB0EsahAbKAIAIgIgAkEDakECdiABKAIQEBohAiAHQRBqIAEoAgQQDyEJIAdBCGogASgCCBAPIQogAiAJKAIAIAooAgAQHiABIAIQCSABQQRqIAJBBGoQCSABQQhqIAJBCGoQCSABEAYgAhAGEAkgAhAZCyABKAIQIAEoAgRBBGsgCBAYIAEgASgCBEEEazYCBCAHQTBqJAAgBSAAKAIERw0ACwsgACADEAkgAEEEaiADQQRqEAkgAEEIaiADQQhqEAkgABAGIAMQBhAJIAQiACgCACEBIABBADYCACABBEAgACgCBBogACgCCBogARAHCyADEBkMAQsgBkGACBAiNgIYIAZBGGohByMAQTBrIgMkAAJAIAAiASgC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",I={};!function(){var t=self.navigator.userAgent.toLowerCase(),e=/(edge)\/([\w.]+)/.exec(t)||/(opr)[\/]([\w.]+)/.exec(t)||/(chrome)[ \/]([\w.]+)/.exec(t)||/(iemobile)[\/]([\w.]+)/.exec(t)||/(version)(applewebkit)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(t)||/(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(t)||/(webkit)[ \/]([\w.]+)/.exec(t)||/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(t)||/(msie) ([\w.]+)/.exec(t)||t.indexOf("trident")>=0&&/(rv)(?::| )([\w.]+)/.exec(t)||t.indexOf("compatible")<0&&/(firefox)[ \/]([\w.]+)/.exec(t)||[],n=/(ipad)/.exec(t)||/(ipod)/.exec(t)||/(windows phone)/.exec(t)||/(iphone)/.exec(t)||/(kindle)/.exec(t)||/(android)/.exec(t)||/(windows)/.exec(t)||/(mac)/.exec(t)||/(linux)/.exec(t)||/(cros)/.exec(t)||[],i={browser:e[5]||e[3]||e[1]||"",version:e[2]||e[4]||"0",majorVersion:e[4]||e[2]||"0",platform:n[0]||""},r={};if(i.browser){r[i.browser]=!0;var a=i.majorVersion.split(".");r.version={major:parseInt(i.majorVersion,10),string:i.version},a.length>1&&(r.version.minor=parseInt(a[1],10)),a.length>2&&(r.version.build=parseInt(a[2],10))}for(var o in i.platform&&(r[i.platform]=!0),(r.chrome||r.opr||r.safari)&&(r.webkit=!0),(r.rv||r.iemobile)&&(r.rv&&delete r.rv,i.browser="msie",r.msie=!0),r.edge&&(delete r.edge,i.browser="msedge",r.msedge=!0),r.opr&&(i.browser="opera",r.opera=!0),r.safari&&r.android&&(i.browser="android",r.android=!0),r.name=i.browser,r.platform=i.platform,I)I.hasOwnProperty(o)&&delete I[o];I=r}();var b=I,M=n("./src/utils/webworkify-webpack.js"),x=n.n(M),C=n("./src/node/worker-cmd.ts"),w="joysound-node",D=function(){function t(t,e){var n=this;this._eventEmitter=void 0,this._config=void 0,this._jsww=void 0,this._ctx=void 0,this._script=void 0,this._input=void 0,this._output=void 0,this._bufferSize=1024,this._pendingData=void 0,this._workletBlob="",this._worklet=void 0,this._scriptProcess=function(t){for(var e=[],i=n._pendingData,r=function(n){var r=t.inputBuffer.getChannelData(n);i&&r.forEach((function(e,r){i[r*t.inputBuffer.numberOfChannels+n]=e})),e.push(t.outputBuffer.getChannelData(n))},a=0;a<t.inputBuffer.numberOfChannels;a++)r(a);n._pendingData&&n._jsww&&n._jsww.process(n._pendingData).forEach((function(t,n){e[n%2][Math.floor(n/2)]=t}))},this._onMessage=function(t){switch(t.data.cmd){case C.WorkerCmd.JSWW_INIT_COMPLETE:n._eventEmitter.emit(g.default.JSWW_INIT_COMPLETE);break;case C.WorkerCmd.STATU_CHANGE:n._eventEmitter.emit(g.default.STATU_CHANGE,{enabled:t.data.enabled})}},this._eventEmitter=t,this._config=e,!window.AudioWorkletNode||b.chrome&&b.version.major<67?h.Log.i(w,"use script"):(this._workletBlob=URL.createObjectURL(x()("./src/node/jsww.worklet.js",{bare:!0,worklet:!0})),h.Log.i(w,"use worklet"))}var e=t.prototype;return e.init=function(t){var e=this;return this._ctx=t,this._input=t.createGain(),this._input.channelCountMode="explicit",this._input.channelCount=2,this._output=t.createGain(),this._workletBlob?t.audioWorklet.addModule(this._workletBlob).then((function(){e._input&&e._output&&(e._worklet=new AudioWorkletNode(t,"jsww"),e._worklet.port.start(),e._worklet.port.postMessage({cmd:C.WorkerCmd.INIT,lib:y(),logLevel:e._config.logLevel,channelCount:e._input.channelCount,sampleRate:t.sampleRate,bufferSize:e._bufferSize}),e._worklet.port.onmessage=e._onMessage,e._input.connect(e._worklet),e._worklet.connect(e._output))})):(this._jsww=new A.default(this._eventEmitter),this._script=t.createScriptProcessor(this._bufferSize,this._input.channelCount,2),this._script.onaudioprocess=this._scriptProcess,this._input.connect(this._script),this._script.connect(this._output),this._loadLib(),Promise.resolve())},e.setEnabled=function(t){this._jsww?this._jsww.setEnabled(t):this._worklet&&this._worklet.port.postMessage({cmd:C.WorkerCmd.SET_ENABLED,value:t})},e.connect=function(t){this._output&&this._output.connect(t)},e.disconnect=function(){this._output&&this._output.disconnect()},e.flush=function(){this._worklet&&this._worklet.port.postMessage({cmd:C.WorkerCmd.FLUSH})},e.destroy=function(){this._jsww&&this._jsww.destroy(),this._worklet&&this._worklet.port.postMessage({cmd:C.WorkerCmd.DESTROY})},e._loadLib=function(){var t=y();this._jsww&&this._jsww.init(t),this._updateInfo()},e._updateInfo=function(){this._ctx&&this._input&&this._jsww&&(this._pendingData=new Float32Array(this._bufferSize*this._input.channelCount),this._jsww.updateInfo(this._ctx.sampleRate,this._input.channelCount,this._bufferSize))},o()(t,[{key:"source",get:function(){return this._input}},{key:"context",get:function(){return this._ctx}}]),t}();function E(){return window.AudioContext||window.webkitAudioContext}var k={400:"01",401:"02",403:"03",404:"04",other4xx:"05",serverError:"06",timeoutOpen:"07",timeoutIO:"08",200:"09",206:"09"},T=function(){function t(){this.timeout=6048e5}var e=t.prototype;return e.write=function(e,n){if(t.available)try{localStorage.setItem(e,JSON.stringify({value:n,time:Date.now()}))}catch(t){}},e.read=function(e,n){if(void 0===n&&(n=!0),t.available)try{var i=localStorage.getItem(e);if(i){var r=JSON.parse(i),a=r.value,o=r.time,s=void 0===o?0:o;if(!n)return a;if(Date.now()-s<this.timeout)return a}}catch(t){}},o()(t,null,[{key:"available",get:function(){if(void 0===t._available)try{localStorage.setItem("alg","test"),t._available=!0}catch(e){t._available=!1}return t._available}}]),t}();T._available=void 0;var N=T,S="kwai-jsww",j=function(t){function e(n){var i;(i=t.call(this)||this)._eventEmitter=void 0,i._ctx=void 0,i._mediaElement=void 0,i._source=void 0,i._destination=void 0,i._enabled=!1,i._config=void 0,i._jsNode=void 0,i._onError=function(t){var e=t.details;return t.type===r.NETWORK_ERROR&&function(t,e,n){if(void 0===n&&(n=0),t>=100)return t;var i="00";"timeout"===e?i=n?k.timeoutIO||i:k.timeoutOpen||i:k.hasOwnProperty(n)?i=k[n]||i:/^4\d{2}$/.test(n.toString())?i=k.other4xx||i:/^5\d{2}$/.test(n.toString())&&(i=k.serverError||i),parseInt(t+i,10)}(e,t.reason,t.statusCode||0),{code:e,fatal:t.fatal,type:t.type,reason:t.reason}},i.off||(i.off=i.removeListener),i._config=f.processConfig(n);var a=(new N).read("kwai-joysound-log");return a&&(h.Log.level(a),i._config.logLevel=a),i._eventEmitter=new c.EventEmitter,i._eventEmitter.on(g.default.ERROR,i._onError),i._eventEmitter.on(g.default.STATU_CHANGE,(function(t){i.emit(g.default.STATU_CHANGE,t)})),i._jsNode=new D(i._eventEmitter,i._config),h.Log.i(S,e.version),i}l()(e,t),e.isSupport=function(t){return void 0===t&&(t=!0),!(!E()||!window.OfflineAudioContext&&!window.webkitOfflineAudioContext||t&&b.safari)};var n=e.prototype;return n.init=function(t){var n=this;if(h.Log.i(S,"init",t),!e.isSupport())return this._onError({type:r.MAIN_ERROR,details:i.INIT_ERROR,fatal:!0,reason:"already bind source"}),!1;if(this._source)return this._onError({type:r.MAIN_ERROR,details:i.INIT_ERROR,fatal:!0,reason:"already bind source"}),!1;if(t instanceof HTMLMediaElement)this._mediaElement=t;else{if(!(t instanceof AudioNode))return this._onError({type:r.MAIN_ERROR,details:i.INIT_ERROR,fatal:!0,reason:"unsupported source"}),!1;this._source=t}return this._ctx||this._initAudioContext().then((function(){n._initSource(),n.setEnabled(n._enabled)})),!0},n.destroy=function(){h.Log.i(S,"destroy"),this._disconnect(),this._jsNode.destroy(),this._ctx&&(this._ctx.close(),this._ctx=void 0),this._eventEmitter.removeAllListeners(),this._mediaElement=void 0,this._source=void 0,this._destination=void 0,this.removeAllListeners()},n.setEnabled=function(t){h.Log.i(S,"setEnabled",t),this._enabled=t,this._ctx&&this._jsNode.setEnabled(t)},n.setDestination=function(t){this._destination=t},n.hasSource=function(){return!!this._mediaElement},n._initAudioContext=function(){if(!this._ctx){if(this._source)this._ctx=this._source.context,this._ctx.resume();else{var t=E();this._ctx=new t}return this._destination=this._destination||this._ctx.destination,this._jsNode.init(this._ctx)}return Promise.resolve()},n._initSource=function(){if(this._ctx&&this._mediaElement){if(!this._source)try{this._source=this._ctx.createMediaElementSource(this._mediaElement)}catch(t){return void this._onError({type:r.MAIN_ERROR,details:i.INIT_ERROR,fatal:!0,reason:"already bind source"})}this._source.disconnect(),this._connect()}},n._disconnect=function(){this._source&&(this._jsNode.disconnect(),this._source.disconnect())},n._connect=function(){if(this._disconnect(),this._source&&this._destination){var t=this._source;this._jsNode.source?(t.connect(this._jsNode.source),this._jsNode.connect(this._destination)):t.connect(this._destination)}},o()(e,null,[{key:"version",get:function(){return"1.0.1"}}]),e}(c.EventEmitter);e.default=j},"./src/lib/libjs-wrapper.ts":function(t,e,n){"use strict";n.r(e);var i=n("./node_modules/@babel/runtime/helpers/createClass.js"),r=n.n(i),a=n("./src/events.ts"),o=n("./src/utils/log.ts"),s=n("./src/lib/libjsww.js"),l=n.n(s),c="libjs-wrapper",u=function(){function t(t){this._eventEmitter=void 0,this._module=void 0,this._libjsww=void 0,this._ctx=void 0,this._inputPtr=void 0,this._outputPtr=void 0,this._sampleRate=44100,this._channel=2,this._frameLen=1024,this._enabled=!1,this._eventEmitter=t}var e=t.prototype;return e.init=function(t){var e=this;o.Log.i(c,"init libjsww");var n={wasmBinary:t};l()(n).then((function(t){e._module=t,e._cwrapLibjswwFun(),e._initIOBuffer(),e._initCtx()}))},e.process=function(t){return this._module?(this._module.HEAPF32.set(t,this._inputPtr>>2),this._libjsww.AudioJoySoundProcessor_process(this._ctx,this._outputPtr,this._inputPtr,this._frameLen),this._module.HEAPF32.subarray(this._outputPtr>>2,(this._outputPtr>>2)+this._frameLen*this._channel)):t},e.setEnabled=function(t){this._enabled=t,this._libjsww&&this._ctx&&(o.Log.i(c,"set enabled: "+t),this._libjsww.AudioJoySoundProcessor_Set_Switch_Status(this._ctx,t),this._eventEmitter.emit(a.default.STATU_CHANGE,{enabled:t}))},e.destroy=function(){o.Log.i(c,"destroy"),this._destroyIOBuffer(),this._destroyCtx()},e.updateInfo=function(t,e,n){o.Log.i(c,"sampleRate: "+t+" channel: "+e+" frameLen: "+n);var i=!1;this._sampleRate===t&&this._channel===e&&this._frameLen===n||(this._sampleRate=t,this._channel=e,this._frameLen=n,i=!0),i&&this._ctx&&(this._initCtx(),this._initIOBuffer())},e._initIOBuffer=function(){this._module&&(o.Log.i(c,"init io buffer"),this._destroyIOBuffer(),this._inputPtr=this._module._malloc(4*this._frameLen*this._channel),this._outputPtr=this._module._malloc(4*this._frameLen*this._channel))},e._destroyIOBuffer=function(){this._module&&this._module._free&&(void 0!==this._inputPtr&&this._module._free(this._inputPtr),void 0!==this._outputPtr&&this._module._free(this._outputPtr))},e._destroyCtx=function(){this._ctx&&this._libjsww&&(o.Log.i(c,"destroy ctx"),this._libjsww.AudioJoySoundProcessor_free(this._ctx),this._ctx=void 0)},e._initCtx=function(){o.Log.i(c,"init ctx"),this._ctx&&this._destroyCtx(),this._ctx=this._libjsww.AudioJoySoundProcessor_init(this._sampleRate,this._channel),this.setEnabled(this._enabled),this._eventEmitter.emit(a.default.JSWW_INIT_COMPLETE)},e._cwrapLibjswwFun=function(){this._libjsww={AudioJoySoundProcessor_init:this._module.cwrap("AudioJoySoundProcessor_init","number",["number","number"]),AudioJoySoundProcessor_free:this._module.cwrap("AudioJoySoundProcessor_free","number",["number"]),AudioJoySoundProcessor_process:this._module.cwrap("AudioJoySoundProcessor_process","number",["number","number","number","number"]),AudioJoySoundProcessor_setParamCtl:this._module.cwrap("AudioJoySoundProcessor_setParamCtl","number",["number","number","void"]),AudioJoySoundProcessor_Set_Switch_Status:this._module.cwrap("AudioJoySoundProcessor_Set_Switch_Status","number",["number","boolean"]),AudioJoySoundProcessor_Get_Switch_Status:this._module.cwrap("AudioJoySoundProcessor_Get_Switch_Status","number",["numbner"]),JOYSOUND_EFFECT_SET_SWITCH:0,JOYSOUND_EFFECT_GET_SWITCH:1,JOYSOUND_EFFECT_SET_MODE:2,JOYSOUND_EFFECT_SET_SCREEN_DIRECTION:3,module:this._module}},r()(t,[{key:"libjsww",get:function(){return this._libjsww}},{key:"sampleRate",get:function(){return this._sampleRate}},{key:"channel",get:function(){return this._channel}},{key:"frameLen",get:function(){return this._frameLen}}]),t}();e.default=u},"./src/lib/libjsww.js":function(t,e,n){var i,r=(i="undefined"!=typeof document&&document.currentScript?document.currentScript.src:void 0,function(t){var e,n,r;t=t||{},e||(e=void 0!==t?t:{}),e.ready=new Promise((function(t,e){n=t,r=e}));var a,o={};for(a in e)e.hasOwnProperty(a)&&(o[a]=e[a]);var s="";"undefined"!=typeof document&&document.currentScript&&(s=document.currentScript.src),i&&(s=i),s=0!==s.indexOf("blob:")?s.substr(0,s.lastIndexOf("/")+1):"";var l=e.print||console.log.bind(console),c=e.printErr||console.warn.bind(console);for(a in o)o.hasOwnProperty(a)&&(e[a]=o[a]);o=null;var u,p,h=[];e.wasmBinary&&(p=e.wasmBinary),e.noExitRuntime,"object"!=typeof WebAssembly&&Q("no native wasm support detected");var d,f=!1;function g(t){var n=e["_"+t];return n||Q("Assertion failed: Cannot call unknown function "+t+", make sure it is exported"),n}function A(t,e,n,i){var r,a={string:function(t){var e=0;if(null!=t&&0!==t){var n=1+(t.length<<2),i=e=J(n),r=v;if(0<n){n=i+n-1;for(var a=0;a<t.length;++a){var o=t.charCodeAt(a);if(55296<=o&&57343>=o&&(o=65536+((1023&o)<<10)|1023&t.charCodeAt(++a)),127>=o){if(i>=n)break;r[i++]=o}else{if(2047>=o){if(i+1>=n)break;r[i++]=192|o>>6}else{if(65535>=o){if(i+2>=n)break;r[i++]=224|o>>12}else{if(i+3>=n)break;r[i++]=240|o>>18,r[i++]=128|o>>12&63}r[i++]=128|o>>6&63}r[i++]=128|63&o}}r[i]=0}}return e},array:function(t){var e=J(t.length);return y.set(t,e),e}},o=g(t),s=[];if(t=0,i)for(var l=0;l<i.length;l++){var c=a[n[l]];c?(0===t&&(t=Z()),s[l]=c(i[l])):s[l]=i[l]}return n=o.apply(null,s),r=n,n="string"===e?r?w(v,r,void 0):"":"boolean"===e?!!r:r,0!==t&&W(t),n}var m,y,v,I,b,M,x,C="undefined"!=typeof TextDecoder?new TextDecoder("utf8"):void 0;function w(t,e,n){var i=e+n;for(n=e;t[n]&&!(n>=i);)++n;if(16<n-e&&t.subarray&&C)return C.decode(t.subarray(e,n));for(i="";e<n;){var r=t[e++];if(128&r){var a=63&t[e++];if(192==(224&r))i+=String.fromCharCode((31&r)<<6|a);else{var o=63&t[e++];65536>(r=224==(240&r)?(15&r)<<12|a<<6|o:(7&r)<<18|a<<12|o<<6|63&t[e++])?i+=String.fromCharCode(r):(r-=65536,i+=String.fromCharCode(55296|r>>10,56320|1023&r))}}else i+=String.fromCharCode(r)}return i}function D(){var t=d.buffer;m=t,e.HEAP8=y=new Int8Array(t),e.HEAP16=I=new Int16Array(t),e.HEAP32=b=new Int32Array(t),e.HEAPU8=v=new Uint8Array(t),e.HEAPU16=new Uint16Array(t),e.HEAPU32=new Uint32Array(t),e.HEAPF32=M=new Float32Array(t),e.HEAPF64=x=new Float64Array(t)}var E,k=[],T=[],N=[];function S(){var t=e.preRun.shift();k.unshift(t)}var j,B,L,z=0,P=null,O=null;function Q(t){throw e.onAbort&&e.onAbort(t),c(t),f=!0,t=new WebAssembly.RuntimeError("abort("+t+"). Build with -s ASSERTIONS=1 for more info."),r(t),t}function R(){return j.startsWith("data:application/octet-stream;base64,")}if(e.preloadedImages={},e.preloadedAudios={},j="libjsww.wasm",!R()){var F=j;j=e.locateFile?e.locateFile(F,s):s+F}function G(){var t=j;try{if(t==j&&p)return new Uint8Array(p);throw"both async and sync fetching of the wasm failed"}catch(t){Q(t)}}function U(t){for(;0<t.length;){var n=t.shift();if("function"==typeof n)n(e);else{var i=n.H;"number"==typeof i?void 0===n.v?E.get(i)():E.get(i)(n.v):i(void 0===n.v?null:n.v)}}}function Y(t){this.u=t-16,this.G=function(t){b[this.u+8>>2]=t},this.C=function(t){b[this.u+0>>2]=t},this.D=function(){b[this.u+4>>2]=0},this.B=function(){y[this.u+12>>0]=0},this.F=function(){y[this.u+13>>0]=0},this.A=function(t,e){this.G(t),this.C(e),this.D(),this.B(),this.F()}}var _=[null,[],[]],V={f:function(t){return q(t+16)+16},e:function(t,e,n){throw new Y(t).A(e,n),t},d:function(){Q()},b:function(t,e,n){v.copyWithin(t,e,e+n)},c:function(t){var e=v.length;if(2147483648<(t>>>=0))return!1;for(var n=1;4>=n;n*=2){var i=e*(1+.2/n);i=Math.min(i,t+100663296),0<(i=Math.max(t,i))%65536&&(i+=65536-i%65536);t:{try{d.grow(Math.min(2147483648,i)-m.byteLength+65535>>>16),D();var r=1;break t}catch(t){}r=void 0}if(r)return!0}return!1},a:function(t,e,n,i){for(var r=0,a=0;a<n;a++){for(var o=b[e+8*a>>2],s=b[e+(8*a+4)>>2],u=0;u<s;u++){var p=v[o+u],h=_[t];0===p||10===p?((1===t?l:c)(w(h,0)),h.length=0):h.push(p)}r+=s}return b[i>>2]=r,0}};!function(){function t(t){e.asm=t.exports,d=e.asm.g,D(),E=e.asm.o,T.unshift(e.asm.h),z--,e.monitorRunDependencies&&e.monitorRunDependencies(z),0==z&&(null!==P&&(clearInterval(P),P=null),O&&(t=O,O=null,t()))}function n(e){t(e.instance)}function i(t){return(p||"function"!=typeof fetch?Promise.resolve().then((function(){return G()})):fetch(j,{credentials:"same-origin"}).then((function(t){if(!t.ok)throw"failed to load wasm binary file at '"+j+"'";return t.arrayBuffer()})).catch((function(){return G()}))).then((function(t){return WebAssembly.instantiate(t,a)})).then(t,(function(t){c("failed to asynchronously prepare wasm: "+t),Q(t)}))}var a={a:V};if(z++,e.monitorRunDependencies&&e.monitorRunDependencies(z),e.instantiateWasm)try{return e.instantiateWasm(a,t)}catch(t){return c("Module.instantiateWasm callback failed with error: "+t),!1}(p||"function"!=typeof WebAssembly.instantiateStreaming||R()||"function"!=typeof fetch?i(n):fetch(j,{credentials:"same-origin"}).then((function(t){return WebAssembly.instantiateStreaming(t,a).then(n,(function(t){return c("wasm streaming compile failed: "+t),c("falling back to ArrayBuffer instantiation"),i(n)}))}))).catch(r)}(),e.___wasm_call_ctors=function(){return(e.___wasm_call_ctors=e.asm.h).apply(null,arguments)},e._AudioJoySoundProcessor_init=function(){return(e._AudioJoySoundProcessor_init=e.asm.i).apply(null,arguments)},e._AudioJoySoundProcessor_free=function(){return(e._AudioJoySoundProcessor_free=e.asm.j).apply(null,arguments)},e._AudioJoySoundProcessor_process=function(){return(e._AudioJoySoundProcessor_process=e.asm.k).apply(null,arguments)},e._AudioJoySoundProcessor_setParamCtl=function(){return(e._AudioJoySoundProcessor_setParamCtl=e.asm.l).apply(null,arguments)},e._AudioJoySoundProcessor_Set_Switch_Status=function(){return(e._AudioJoySoundProcessor_Set_Switch_Status=e.asm.m).apply(null,arguments)},e._AudioJoySoundProcessor_Get_Switch_Status=function(){return(e._AudioJoySoundProcessor_Get_Switch_Status=e.asm.n).apply(null,arguments)};var H,Z=e.stackSave=function(){return(Z=e.stackSave=e.asm.p).apply(null,arguments)},W=e.stackRestore=function(){return(W=e.stackRestore=e.asm.q).apply(null,arguments)},J=e.stackAlloc=function(){return(J=e.stackAlloc=e.asm.r).apply(null,arguments)},q=e._malloc=function(){return(q=e._malloc=e.asm.s).apply(null,arguments)};function K(){function t(){if(!H&&(H=!0,e.calledRun=!0,!f)){if(U(T),n(e),e.onRuntimeInitialized&&e.onRuntimeInitialized(),e.postRun)for("function"==typeof e.postRun&&(e.postRun=[e.postRun]);e.postRun.length;){var t=e.postRun.shift();N.unshift(t)}U(N)}}if(!(0<z)){if(e.preRun)for("function"==typeof e.preRun&&(e.preRun=[e.preRun]);e.preRun.length;)S();U(k),0<z||(e.setStatus?(e.setStatus("Running..."),setTimeout((function(){setTimeout((function(){e.setStatus("")}),1),t()}),1)):t())}}if(e._free=function(){return(e._free=e.asm.t).apply(null,arguments)},e.cwrap=function(t,e,n,i){var r=(n=n||[]).every((function(t){return"number"===t}));return"string"!==e&&r&&!i?g(t):function(){return A(t,e,n,arguments)}},e.setValue=function(t,e,n){switch("*"===(n=n||"i8").charAt(n.length-1)&&(n="i32"),n){case"i1":case"i8":y[t>>0]=e;break;case"i16":I[t>>1]=e;break;case"i32":b[t>>2]=e;break;case"i64":L=[e>>>0,(B=e,1<=+Math.abs(B)?0<B?(0|Math.min(+Math.floor(B/4294967296),4294967295))>>>0:~~+Math.ceil((B- +(~~B>>>0))/4294967296)>>>0:0)],b[t>>2]=L[0],b[t+4>>2]=L[1];break;case"float":M[t>>2]=e;break;case"double":x[t>>3]=e;break;default:Q("invalid type for setValue: "+n)}},e.getValue=function(t,e){switch("*"===(e=e||"i8").charAt(e.length-1)&&(e="i32"),e){case"i1":case"i8":return y[t>>0];case"i16":return I[t>>1];case"i32":case"i64":return b[t>>2];case"float":return M[t>>2];case"double":return x[t>>3];default:Q("invalid type for getValue: "+e)}return null},e.addFunction=function(t,e){if(!u){u=new WeakMap;for(var n=0;n<E.length;n++){var i=E.get(n);i&&u.set(i,n)}}if(u.has(t))t=u.get(t);else{if(h.length)n=h.pop();else{try{E.grow(1)}catch(t){if(!(t instanceof RangeError))throw t;throw"Unable to grow wasm table. Set ALLOW_TABLE_GROWTH."}n=E.length-1}try{E.set(n,t)}catch(s){if(!(s instanceof TypeError))throw s;if("function"==typeof WebAssembly.Function){var r={i:"i32",j:"i64",f:"f32",d:"f64"},a={parameters:[],results:"v"==e[0]?[]:[r[e[0]]]};for(i=1;i<e.length;++i)a.parameters.push(r[e[i]]);e=new WebAssembly.Function(a,t)}else{r=[1,0,1,96],a=e.slice(0,1),e=e.slice(1);var o={i:127,j:126,f:125,d:124};for(r.push(e.length),i=0;i<e.length;++i)r.push(o[e[i]]);"v"==a?r.push(0):r=r.concat([1,o[a]]),r[1]=r.length-2,e=new Uint8Array([0,97,115,109,1,0,0,0].concat(r,[2,7,1,1,101,1,102,0,0,7,5,1,1,102,0,0])),e=new WebAssembly.Module(e),e=new WebAssembly.Instance(e,{e:{f:t}}).exports.f}E.set(n,e)}u.set(t,n),t=n}return t},O=function t(){H||K(),H||(O=t)},e.run=K,e.preInit)for("function"==typeof e.preInit&&(e.preInit=[e.preInit]);0<e.preInit.length;)e.preInit.pop()();return K(),t.ready});t.exports=r},"./src/node/jsww.worklet.js":function(t,e,n){"use strict";n.r(e);var i=n("./node_modules/@babel/runtime/helpers/inheritsLoose.js"),r=n.n(i),a=n("./node_modules/@babel/runtime/helpers/wrapNativeSuper.js"),o=n.n(a),s=n("./src/lib/libjs-wrapper.ts"),l=n("./node_modules/events/events.js"),c=n("./src/events.ts"),u=n("./src/node/worker-cmd.ts"),p=n("./src/utils/log.ts"),h="worklet",d=function(t){function e(e){var n;return(n=t.call(this,e)||this)._jsww=void 0,n._enabled=void 0,n.port.onmessage=function(t){var e=t.data;if(e.cmd===u.WorkerCmd.INIT){p.Log.level(e.logLevel);var i=e.lib;n._eventEmitter=new l.EventEmitter,n._jsww=new s.default(n._eventEmitter),n._eventEmitter.on(c.default.JSWW_INIT_COMPLETE,(function(){n.port.postMessage({cmd:u.WorkerCmd.JSWW_INIT_COMPLETE})})),n._eventEmitter.on(c.default.STATU_CHANGE,(function(t){n.port.postMessage({cmd:u.WorkerCmd.STATU_CHANGE,enabled:t.enabled})})),n._jsww.init(i),p.Log.i(h,"init sampleRate: "+e.sampleRate+" channelCount: "+e.channelCount+" bufferSize: "+e.bufferSize),n._updateInfo(e.sampleRate,e.channelCount,e.bufferSize),void 0!==n._enabled&&n._jsww.setEnabled(n._enabled)}else e.cmd===u.WorkerCmd.SET_ENABLED?n._jsww?n._jsww.setEnabled(e.value):n._enabled=e.value:e.cmd===u.WorkerCmd.FLUSH&&(p.Log.i(h,"flush"),n._inputBufIndex=0,n._outputBuf&&(n._outputBufIndex=n._outputBuf.length))},n}r()(e,t);var n=e.prototype;return n.process=function(t,e,n){var i=this,r=t[0],a=e[0];return this._inputBuf?function(){i._channelCount!==r.length&&(p.Log.i(h,"channel count change. "+i._channelCount+" -> "+r.length),i._updateInfo(i._sampleRate,r.length,i._bufferSize));for(var t=r.length,e=function(e){r[e].forEach((function(n,r){i._inputBuf[i._inputBufIndex+r*t+e]=n}))},n=0;n<t;n++)e(n);if(i._inputBufIndex+=128*t,i._inputBufIndex>=i._inputBuf.length&&(i._outputBuf=i._jsww.process(i._inputBuf),i._inputBufIndex=0,i._outputBufIndex=0),i._outputBufIndex<i._outputBuf.length)if(a.length===t)for(var o=0;o<128*a.length;o++)a[i._outputBufIndex%t][Math.floor(o/t)]=i._outputBuf[i._outputBufIndex],i._outputBufIndex++;else i._outputBufIndex+=128*t;else a.forEach((function(t){for(var e=0;e<128;e++)t[e]=0}))}():r.forEach((function(t,e){t.forEach((function(t,n){a[e][n]=t}))})),!0},n._initBuf=function(t){p.Log.i(h,"init buffer "+t),this._inputBuf=new Float32Array(t),this._outputBuf=new Float32Array(t),this._inputBufIndex=0,this._outputBufIndex=t},n._updateInfo=function(t,e,n){this._bufferSize=128*Math.floor(n/128),this._sampleRate=t,this._channelCount=e,this._initBuf(this._bufferSize*e),this._jsww.updateInfo(this._sampleRate,this._channelCount,this._bufferSize)},e}(o()(AudioWorkletProcessor));registerProcessor("jsww",d)},"./src/node/worker-cmd.ts":function(t,e,n){"use strict";var i;n.r(e),n.d(e,"WorkerCmd",(function(){return i})),function(t){t.INIT="init",t.FLUSH="flush",t.ERROR="error",t.SET_ENABLED="setEnabled",t.STATU_CHANGE="statuChange",t.DESTROY="destroy",t.JSWW_INIT_COMPLETE="jswwInitComplete"}(i||(i={}))},"./src/utils/log.ts":function(t,e,n){"use strict";n.r(e),n.d(e,"Log",(function(){return s})),n.d(e,"LOG_LEVEL",(function(){return i}));var i,r="kwai-joysound",a=!0;function o(t,e){return e&&0!==e.length||(e=[t],t=""),t=a?r+(t?"::"+t:""):t||r,e.unshift("["+t+"] > "),e}!function(t){t.LEVEL_ERROR="e",t.LEVEL_WARN="w",t.LEVEL_INFO="i",t.LEVEL_DEBUG="d",t.LEVEL_VERBOSE="v"}(i||(i={}));var s=function(){function t(){}return t.level=function(e){switch(t.ENABLE_ERROR=t.ENABLE_WARN=t.ENABLE_INFO=t.ENABLE_DEBUG=t.ENABLE_VERBOSE=!1,e){case i.LEVEL_ERROR:t.ENABLE_ERROR=!0;break;case i.LEVEL_WARN:t.ENABLE_ERROR=t.ENABLE_WARN=!0;break;case i.LEVEL_INFO:t.ENABLE_ERROR=t.ENABLE_WARN=t.ENABLE_INFO=!0;break;case i.LEVEL_DEBUG:t.ENABLE_ERROR=t.ENABLE_WARN=t.ENABLE_INFO=t.ENABLE_DEBUG=!0;break;case i.LEVEL_VERBOSE:t.ENABLE_ERROR=t.ENABLE_WARN=t.ENABLE_INFO=t.ENABLE_DEBUG=t.ENABLE_VERBOSE=!0}},t.e=function(e){if(t.ENABLE_ERROR){for(var n=arguments.length,i=new Array(n>1?n-1:0),r=1;r<n;r++)i[r-1]=arguments[r];var a=o(e,i);(console.error||console.warn||console.log).apply(console,a)}},t.w=function(e){if(t.ENABLE_WARN){for(var n=arguments.length,i=new Array(n>1?n-1:0),r=1;r<n;r++)i[r-1]=arguments[r];var a=o(e,i);(console.warn||console.log).apply(console,a)}},t.i=function(e){if(t.ENABLE_INFO){for(var n=arguments.length,i=new Array(n>1?n-1:0),r=1;r<n;r++)i[r-1]=arguments[r];var a=o(e,i);(console.info||console.log).apply(console,a)}},t.d=function(e){if(t.ENABLE_DEBUG){for(var n=arguments.length,i=new Array(n>1?n-1:0),r=1;r<n;r++)i[r-1]=arguments[r];var a=o(e,i);(console.debug||console.log).apply(console,a)}},t.v=function(e){if(t.ENABLE_VERBOSE){for(var n=arguments.length,i=new Array(n>1?n-1:0),r=1;r<n;r++)i[r-1]=arguments[r];var a=o(e,i);console.log.apply(console,a)}},t}();s.ENABLE_ERROR=!0,s.ENABLE_WARN=!1,s.ENABLE_INFO=!1,s.ENABLE_DEBUG=!1,s.ENABLE_VERBOSE=!1},"./src/utils/webworkify-webpack.js":function(t,e,n){function i(t){var e={};function n(i){if(e[i])return e[i].exports;var r=e[i]={i:i,l:!1,exports:{}};return t[i].call(r.exports,r,r.exports,n),r.l=!0,r.exports}n.m=t,n.c=e,n.i=function(t){return t},n.d=function(t,e,i){n.o(t,e)||Object.defineProperty(t,e,{configurable:!1,enumerable:!0,get:i})},n.r=function(t){Object.defineProperty(t,"__esModule",{value:!0})},n.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return n.d(e,"a",e),e},n.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},n.p="/",n.oe=function(t){throw console.error(t),t};var i=n(n.s=ENTRY_MODULE);return i.default||i}var r="[\\.|\\-|\\+|\\w|/|@]+",a="\\(\\s*(/\\*.*?\\*/)?\\s*.*?("+r+").*?\\)";function o(t){return(t+"").replace(/[.?*+^$[\]\\(){}|-]/g,"\\$&")}function s(t,e,i){var s={};s[i]=[];var l=e.toString(),c=l.match(/^function\s?\w*\(\w+,\s*\w+,\s*(\w+)\)/);if(!c)return s;for(var u,p=c[1],h=new RegExp("(\\\\n|\\W)"+o(p)+a,"g");u=h.exec(l);)"dll-reference"!==u[3]&&s[i].push(u[3]);for(h=new RegExp("\\("+o(p)+'\\("(dll-reference\\s('+r+'))"\\)\\)'+a,"g");u=h.exec(l);)t[u[2]]||(s[i].push(u[1]),t[u[2]]=n(u[1]).m),s[u[2]]=s[u[2]]||[],s[u[2]].push(u[4]);for(var d,f=Object.keys(s),g=0;g<f.length;g++)for(var A=0;A<s[f[g]].length;A++)d=s[f[g]][A],isNaN(1*d)||(s[f[g]][A]=1*s[f[g]][A]);return s}function l(t){return Object.keys(t).reduce((function(e,n){return e||t[n].length>0}),!1)}t.exports=function(t,e){e=e||{};var r={main:n.m},a=e.all?{main:Object.keys(r.main)}:function(t,e){for(var n={main:[e]},i={main:[]},r={main:{}};l(n);)for(var a=Object.keys(n),o=0;o<a.length;o++){var c=a[o],u=n[c].pop();if(r[c]=r[c]||{},!r[c][u]&&t[c][u]){r[c][u]=!0,i[c]=i[c]||[],i[c].push(u);for(var p=s(t,t[c][u],c),h=Object.keys(p),d=0;d<h.length;d++)n[h[d]]=n[h[d]]||[],n[h[d]]=n[h[d]].concat(p[h[d]])}}return i}(r,t),o="";Object.keys(a).filter((function(t){return"main"!==t})).forEach((function(t){for(var e=0;a[t][e];)e++;a[t].push(e),r[t][e]="(function(module, exports, __webpack_require__) { module.exports = __webpack_require__; })",o=o+"var "+t+" = ("+i.toString().replace("ENTRY_MODULE",JSON.stringify(e))+")({"+a[t].map((function(e){return JSON.stringify(e)+": "+r[t][e].toString()})).join(",")+"});\n"})),o=e.worklet?o+"(("+i.toString().replace("ENTRY_MODULE",JSON.stringify(t))+")({"+a.main.map((function(t){return JSON.stringify(t)+": "+r.main[t].toString()})).join(",")+"}));":o+"new (("+i.toString().replace("ENTRY_MODULE",JSON.stringify(t))+")({"+a.main.map((function(t){return JSON.stringify(t)+": "+r.main[t].toString()})).join(",")+"}))(self);";var c=new window.Blob([o],{type:"text/javascript"});if(e.bare)return c;var u=(window.URL||window.webkitURL||window.mozURL||window.msURL).createObjectURL(c),p=new window.Worker(u);return p.objectURL=u,p}}}).default}());
    };

    obj.gestureInit = function (player) {
        const { video, videoWrap, playedBarWrap } = player.template;
        let isDroging = false, startX = 0, startY = 0, startCurrentTime = 0, startVolume = 0, startBrightness = "100%", lastDirection = 0;
        const onTouchStart = (event) => {
            if (event.touches.length === 1) {
                isDroging = true;
                const { clientX, clientY } = event.touches[0];
                startX = clientX;
                startY = clientY;
                startCurrentTime = video.currentTime;
                startVolume = video.volume;
                startBrightness = (/brightness\((\d+%?)\)/.exec(video.style.filter) || [])[1] || "100%";
            }
        };
        const onTouchMove = (event) => {
            if (event.touches.length === 1 && isDroging) {
                const { clientX, clientY } = event.touches[0];
                const client = player.isRotate ? clientY : clientX;
                const { width, height } = video.getBoundingClientRect();
                const ratioX = clamp((clientX - startX) / width, -1, 1);
                const ratioY = clamp((clientY - startY) / height, -1, 1);
                const ratio = player.isRotate ? ratioY : ratioX;
                const direction = getDirection(startX, startY, clientX, clientY);
                if (direction != lastDirection) {
                    lastDirection = direction;
                    return;
                }
                if (direction == 1 || direction == 2) {
                    if (!lastDirection) lastDirection = direction;
                    if (lastDirection > 2) return;
                    const middle = player.isRotate ? height / 2 : width / 2;
                    if (client < middle) {
                        const currentBrightness = clamp(+((/\d+/.exec(startBrightness) || [])[0] || 100) + 200 * ratio * 10, 50, 200);
                        video.style.cssText += "filter: brightness(" + currentBrightness.toFixed(0) + "%)";
                        player.notice(`亮度调节 ${currentBrightness.toFixed(0)}%`);
                    }
                    else if (client > middle) {
                        const currentVolume = clamp(startVolume + ratio * 10, 0, 1);
                        player.volume(currentVolume);
                    }
                }
                else if (direction == 3 || direction == 4) {
                    if (!lastDirection) lastDirection = direction;
                    if (lastDirection < 3) return;
                    const currentTime = clamp(startCurrentTime + video.duration * ratio * 0.5, 0, video.duration);
                    player.seek(currentTime);
                }
            }
        };
        const onTouchEnd = () => {
            if (isDroging) {
                startX = 0;
                startY = 0;
                startCurrentTime = 0;
                startVolume = 0;
                lastDirection = 0;
                isDroging = false;
            }
        };
        videoWrap.addEventListener('touchstart', (event) => {
            onTouchStart(event);
        });
        playedBarWrap.addEventListener('touchstart', (event) => {
            onTouchStart(event);
        });
        videoWrap.addEventListener('touchmove', onTouchMove);
        playedBarWrap.addEventListener('touchmove', onTouchMove);
        document.addEventListener('touchend', onTouchEnd);
        window.addEventListener("onorientationchange" in window ? "orientationchange" : "resize", function() {
            const { container } = player;
            container.classList.add("dplayer-mobile");
            if (window.orientation === 180 || window.orientation === 0) {
                player.isRotate = true;
            }
            else if (window.orientation === 90 || window.orientation === -90 ){
                player.isRotate = false;
            }
        }, false);
        function clamp(num, a, b) {
            return Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));
        }
        function getDirection(startx, starty, endx, endy) {
            var angx = endx - startx;
            var angy = endy - starty;
            var result = 0;
            if (Math.abs(angx) < 2 && Math.abs(angy) < 2) return result;
            var angle = Math.atan2(angy, angx) * 180 / Math.PI;
            if (angle >= -135 && angle <= -45) {
                result = 1;
            } else if (angle > 45 && angle < 135) {
                result = 2;
            } else if ((angle >= 135 && angle <= 180) || (angle >= -180 && angle < -135)) {
                result = 3;
            } else if (angle >= -45 && angle <= 45) {
                result = 4;
            }
            return result;
        }
    };

    obj.longPressInit = function (player) {
        const { video, videoWrap } = player.template;
        let isDroging = false, isLongPress = false, timer = 0, speed = 1;
        const onMouseDown = () => {
            timer = setTimeout(() => {
                isLongPress = true;
                speed = video.playbackRate;
                player.speed(speed * 3);
            },1000);
        }
        const onMouseUp = () => {
            clearTimeout(timer);
            setTimeout(() => {
                if (isLongPress) {
                    isLongPress = false;
                    player.speed(speed);
                    player.play();
                }
            });
        }
        const onTouchStart = (event) => {
            if (event.touches.length === 1) {
                isDroging = true;
                speed = video.playbackRate;
                timer = setInterval(() => {
                    isLongPress = true;
                    player.speed(speed * 3);
                    player.contextmenu.hide();
                },1000);
            }
        };
        const onTouchMove = (event) => {
            if (event.touches.length === 1 && isDroging) {
                clearInterval(timer);
                setTimeout(() => {
                    if (isLongPress) {
                        isLongPress = false;
                        player.speed(speed);
                        player.play();
                    }
                });
            }
        };
        const onTouchEnd = () => {
            if (isDroging) {
                clearInterval(timer);
                setTimeout(() => {
                    if (isLongPress) {
                        isLongPress = false;
                        player.speed(speed);
                        player.play();
                    }
                });
            }
        };
        videoWrap.addEventListener('touchstart', onTouchStart);
        videoWrap.addEventListener('touchmove', onTouchMove);
        videoWrap.addEventListener('touchend', onTouchEnd);
        videoWrap.addEventListener('mousedown', onMouseDown);
        videoWrap.addEventListener('mouseup', onMouseUp);
    };

    obj.dblclickInit = function (player) {
        const { video, videoWrap } = player.template;
        videoWrap.addEventListener('dblclick', (event) => {
            const currentTime = video.currentTime;
            const { offsetX, offsetY } = event;
            const { width, height } = video.getBoundingClientRect();
            const client = player.isRotate ? offsetY : offsetX;
            const middle = player.isRotate ? height / 2 : width / 2;
            if (client < middle) {
                player.seek(currentTime - 30);
            }
            else if (client > middle) {
                player.seek(currentTime + 30);
            }
        });
    };

    obj.dPlayerPip = function (player) {
        var $ = obj.getJquery();
        if ($(".dplayer-icons-right .dplayer-pip-btn").length) return;
        $(".dplayer-setting").before('<div class="dplayer-pip-btn" style="display:inline-block;height: 100%;"><button class="dplayer-icon dplayer-pip-icon" data-balloon="画中画" data-balloon-pos="up"><span class="dplayer-icon-content" style=""><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M2.667 2.667h18.667v18.667h-18.667v-18.667M29.333 10.667v18.667h-18.667v-5.333h2.667v2.667h13.333v-13.333h-2.667v-2.667h5.333z"></path></svg></span></button></div>');
        const { template: { video }, notice } = player;
        $(".dplayer-pip-btn button").on("click", function() {
            if (document.pictureInPictureEnabled) {
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture().then((width, height, resize) => {
                        $(this).find(".dplayer-icon-content").css("opacity", "");
                    }).catch((err) => {
                        notice(err);
                    });
                }
                else {
                    video.requestPictureInPicture().then((width, height, resize) => {
                        $(this).find(".dplayer-icon-content").css("opacity", .4);
                        video.onleavepictureinpicture = () => {
                            video.onleavepictureinpicture = null;
                            $(".dplayer-pip-btn .dplayer-icon-content").css("opacity", "");
                        }
                    }).catch((err) => {
                        notice(err);
                    });
                }
            }
            else if (video.webkitSupportsPresentationMode) {
                if (video.webkitPresentationMode == "picture-in-picture") {
                    video.webkitSetPresentationMode("inline");
                    $(this).find(".dplayer-icon-content").css("opacity", "");
                }
                else {
                    video.webkitSetPresentationMode("picture-in-picture");
                    $(this).find(".dplayer-icon-content").css("opacity", .4);
                    video.onwebkitpresentationmodechanged = () => {
                        video.onwebkitpresentationmodechanged = null;
                        $(".dplayer-pip-btn .dplayer-icon-content").css("opacity", "");
                    }
                }
            }
            else {
                notice("画中画模式不可用");
            }
        });
    };

    obj.memoryPlay = function (player) {
        if (this.hasMemoryDisplay) return;
        this.hasMemoryDisplay = true;
        this.appreciation || player.destroy();
        var duration = player.video.duration
        , file = obj.video_page.info[0] || {}
        , sign = file.md5 || file.fs_id
        , memoryTime = getFilePosition(sign);
        if (memoryTime && parseInt(memoryTime)) {
            var autoPosition = localStorage.getItem("dplayer-autoposition") == "true";
            if (autoPosition) {
                player.seek(memoryTime);
            }
            else {
                var formatTime = formatVideoTime(memoryTime);
                var $ = obj.getJquery();
                $(player.container).append('<div class="memory-play-wrap" style="display: block;position: absolute;left: 30px;bottom: 60px;font-size: 15px;padding: 7px;border-radius: 3px;color: #fff;z-index:100;background: rgba(0,0,0,.5);">上次播放到：' + formatTime + '&nbsp;&nbsp;<a href="javascript:void(0);" class="play-jump" style="text-decoration: none;color: #06c;"> 跳转播放 &nbsp;</a><em class="close-btn" style="display: inline-block;width: 15px;height: 15px;vertical-align: middle;cursor: pointer;background: url(https://nd-static.bdstatic.com/m-static/disk-share/widget/pageModule/share-file-main/fileType/video/img/video-flash-closebtn_15f0e97.png) no-repeat;"></em></div>');
                var memoryTimeout = setTimeout(function () {
                    $(".memory-play-wrap").remove();
                }, 15000);
                $(".memory-play-wrap .close-btn").click(function () {
                    $(".memory-play-wrap").remove();
                    clearTimeout(memoryTimeout);
                });
                $(".memory-play-wrap .play-jump").click(function () {
                    player.seek(memoryTime);
                    player.play();
                    $(".memory-play-wrap").remove();
                    clearTimeout(memoryTimeout);
                });
            }
        }
        document.onvisibilitychange = function () {
            if (document.visibilityState === "hidden") {
                var currentTime = player.video.currentTime;
                currentTime && setFilePosition(sign, currentTime, duration);
            }
        };
        window.onbeforeunload = function () {
            var currentTime = player.video.currentTime;
            currentTime && setFilePosition(sign, currentTime, duration);
        };
        function getFilePosition (e) {
            return localStorage.getItem("video_" + e) || 0;
        }
        function setFilePosition (e, t, o) {
            e && t && (e = "video_" + e, t <= 60 || t + 60 >= o || 0 ? localStorage.removeItem(e) : localStorage.setItem(e, t));
        }
        function formatVideoTime (seconds) {
            var secondTotal = Math.round(seconds)
            , hour = Math.floor(secondTotal / 3600)
            , minute = Math.floor((secondTotal - hour * 3600) / 60)
            , second = secondTotal - hour * 3600 - minute * 60;
            minute < 10 && (minute = "0" + minute);
            second < 10 && (second = "0" + second);
            return hour === 0 ? minute + ":" + second : hour + ":" + minute + ":" + second;
        }
    };

    obj.videoFit = function () {
        var $ = obj.getJquery();
        if ($(".dplayer-icons-right .btn-select-fit").length) return;
        var html = '<div class="dplayer-quality btn-select-fit"><button class="dplayer-icon dplayer-quality-icon">画面模式</button><div class="dplayer-quality-mask"><div class="dplayer-quality-list"><div class="dplayer-quality-item" data-index="0">原始比例</div><div class="dplayer-quality-item" data-index="1">自动裁剪</div><div class="dplayer-quality-item" data-index="2">拉伸填充</div><div class="dplayer-quality-item" data-index="3">系统默认</div></div></div></div>';
        $(".dplayer-icons-right").prepend(html);
        $(".btn-select-fit .dplayer-quality-item").on("click", function() {
            var vfit = ["none", "cover", "fill", ""][$(this).attr("data-index")];
            document.querySelector("video").style["object-fit"] = vfit;
            $(".btn-select-fit .dplayer-icon").text($(this).text());
        });
    };

    obj.autoPlayEpisode = function () {
        if (obj.getJquery()(".dplayer-icons-right #btn-select-episode").length) return;
        var flag = obj.video_page.flag;
        if (flag == "sharevideo") {
            obj.selectEpisodeSharePage();
        }
        else if (flag == "playvideo") {
            obj.selectEpisodeHomePage();
        }
        else if (flag == "pfilevideo") {
            obj.selectEpisodePfilePage();
        }
        else if (flag == "mboxvideo") {
        }
    };

    obj.selectEpisodeSharePage = function () {
        var fileList = JSON.parse(sessionStorage.getItem("sharePageFileList") || "[]")
        , videoList = fileList.filter(function (item, index) {
            return item.category == 1;
        })
        , file = obj.video_page.info[0]
        , fileIndex = videoList.findIndex(function (item, index) {
            return item.fs_id == file.fs_id;
        });
        if (fileIndex > -1 && videoList.length > 1) {
            obj.createEpisodeElement(videoList, fileIndex);
        }
    };

    obj.selectEpisodeHomePage = function () {
        var videoList = [];
        obj.getJquery()("#videoListView").find(".video-item").each(function () {
            videoList.push({
                server_filename: this.title
            })
        });
        var currpath = obj.require("system-core:context/context.js").instanceForSystem.router.query.get("path");
        var server_filename = currpath.split("/").pop()
        , fileIndex = videoList.findIndex(function (item, index) {
            return item.server_filename == server_filename;
        });
        if (fileIndex > -1 && videoList.length > 1) {
            obj.createEpisodeElement(videoList, fileIndex);
        }
    };

    obj.selectEpisodePfilePage = function () {
        var videoList = obj.video_page.categorylist;
        if (videoList.length > 1) {
            var server_filename = obj.video_page.info[0].server_filename
            , fileIndex = videoList.findIndex(function (item, index) {
                return item.server_filename == server_filename;
            });
            if (fileIndex > -1) {
                obj.createEpisodeElement(videoList, fileIndex);
            }
        }
    };

    obj.createEpisodeElement = function (videoList, fileIndex) {
        var $ = obj.getJquery();
        var eleitem = "";
        videoList.forEach(function (item, index) {
            if (fileIndex == index) {
                eleitem += '<div class="video-item active" title="' + item.server_filename + '" style="background-color: rgba(0,0,0,.3);color: #0df;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;">' + item.server_filename + '</div>';
            }
            else {
                eleitem += '<div class="video-item" title="' + item.server_filename + '" style="color: #fff;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;">' + item.server_filename + '</div>';
            }
        });
        var html = '<button class="dplayer-icon dplayer-play-icon prev-icon" title="上一集"><svg t="1658231494866" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="22734" width="128" height="128" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><style type="text/css"></style></defs><path d="M757.527273 190.138182L382.510545 490.123636a28.020364 28.020364 0 0 0 0 43.752728l375.016728 299.985454a28.020364 28.020364 0 0 0 45.474909-21.876363V212.014545a28.020364 28.020364 0 0 0-45.474909-21.876363zM249.949091 221.509818a28.020364 28.020364 0 0 0-27.973818 27.973818v525.032728a28.020364 28.020364 0 1 0 55.994182 0V249.483636a28.020364 28.020364 0 0 0-28.020364-27.973818zM747.054545 270.242909v483.514182L444.834909 512l302.173091-241.757091z" fill="#333333" p-id="22735"></path></svg></button>';
        html += '<button id="btn-select-episode" class="dplayer-icon dplayer-quality-icon" title="选集">选集</button> <div class="playlist-content" style="max-width: 80%;max-height: 330px;width: auto;height: auto;box-sizing: border-box;overflow: hidden;position: absolute;left: 0;transition: all .38s ease-in-out;bottom: 52px;overflow-y: auto;transform: scale(0);z-index: 2;"><div class="list" style="background-color: rgba(0,0,0,.3);height: 100%;">' + eleitem + '</div></div>';
        html += '<button class="dplayer-icon dplayer-play-icon next-icon" title="下一集"><svg t="1658231512641" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="23796" xmlns:xlink="http://www.w3.org/1999/xlink" width="128" height="128"><defs><style type="text/css"></style></defs><path d="M248.506182 190.138182l374.970182 299.985454a28.020364 28.020364 0 0 1 0 43.752728L248.552727 833.861818a28.020364 28.020364 0 0 1-45.521454-21.876363V212.014545c0-23.505455 27.182545-36.538182 45.521454-21.876363z m507.485091 31.371636c15.453091 0 28.020364 12.567273 28.020363 27.973818v525.032728a28.020364 28.020364 0 1 1-55.994181 0V249.483636c0-15.453091 12.520727-27.973818 27.973818-27.973818zM258.978909 270.242909v483.514182L561.198545 512 258.978909 270.242909z" fill="#333333" p-id="23797"></path></svg></button>';
        $(".dplayer-icons-right").prepend(html);
        $("#btn-select-episode").on("click", function() {
            var eleEpisode = $(".playlist-content");
            if (eleEpisode.css("transform").match(/\d+/) > 0) {
                eleEpisode.css("transform", "scale(0)");
            }
            else {
                eleEpisode.css("transform", "scale(1)");
                $(".dplayer-mask").addClass("dplayer-mask-show");
                var singleheight = $(".dplayer-icons-right .video-item")[0].offsetHeight;
                var totalheight = $(".dplayer-icons-right .playlist-content").height();
                $(".dplayer-icons-right .playlist-content").scrollTop((fileIndex + 1) * singleheight - totalheight / 2);
            }
        });
        $(".dplayer-mask").on("click",function() {
            var eleEpisode = $(".playlist-content");
            if (eleEpisode.css("transform").match(/\d+/) > 0) {
                eleEpisode.css("transform", "scale(0)");
                $(this).removeClass("dplayer-mask-show");
            }
        });
        $(".playlist-content .video-item").on("click", function() {
            var $this = $(this);
            if ($this.hasClass("active")) return;
            $(".dplayer-mask").removeClass("dplayer-mask-show");
            var oldele = $(".video-item.active");
            oldele.removeClass("active");
            oldele.css({"background-color": "", "color": "#fff"});
            $this.addClass("active");
            $this.css({"background-color": "rgba(0,0,0,.3)", "color": "#0df"});
            var flag = obj.video_page.flag;
            if (flag == "sharevideo") {
                location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + videoList[$this.index()].fs_id;
            }
            else if (flag == "playvideo") {
                var currpath = obj.require("system-core:context/context.js").instanceForSystem.router.query.get("path");
                var t = $this.index();
                var path = currpath.split("/").slice(0, -1).concat(videoList[t].server_filename).join("/");
                location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + t;
            }
            else if (flag == "pfilevideo") {
                location.href = "https://pan.baidu.com/pfile/video?path=" + encodeURIComponent(videoList[$this.index()].path);
            }
            setTimeout(location.reload);
        });
        $(".prev-icon").on("click",function () {
            var prevvideo = videoList[--fileIndex];
            if (prevvideo) {
                var flag = obj.video_page.flag;
                if (flag == "sharevideo") {
                    location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + prevvideo.fs_id;
                }
                else if (flag == "playvideo") {
                    var currpath = obj.require("system-core:context/context.js").instanceForSystem.router.query.get("path");
                    var path = currpath.split("/").slice(0, -1).concat(videoList[fileIndex].server_filename).join("/");
                    location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + fileIndex;
                }
                else if (flag == "pfilevideo") {
                    location.href = "https://pan.baidu.com/pfile/video?path=" + encodeURIComponent(prevvideo.path);
                }
                setTimeout(location.reload);
            }
            else {
                ++fileIndex;
                obj.msg("没有上一集了", "failure");
            }
        });
        $(".next-icon").on("click",function () {
            var nextvideo = videoList[++fileIndex];
            if (nextvideo) {
                var flag = obj.video_page.flag;
                if (flag == "sharevideo") {
                    location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + nextvideo.fs_id;
                }
                else if (flag == "playvideo") {
                    var currpath = obj.require("system-core:context/context.js").instanceForSystem.router.query.get("path");
                    var path = currpath.split("/").slice(0, -1).concat(videoList[fileIndex].server_filename).join("/");
                    location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + fileIndex;
                }
                else if (flag == "pfilevideo") {
                    location.href = "https://pan.baidu.com/pfile/video?path=" + encodeURIComponent(nextvideo.path);
                }
                setTimeout(location.reload);
            }
            else {
                --fileIndex;
                obj.msg("没有下一集了", "failure");
            }
        });
    };

    obj.dPlayerSubtitleSetting = function () {
        var $ = obj.getJquery();
        if ($(".dplayer-setting-subtitle").length && $(".subtitle-setting-box").length) return;
        $(".dplayer-setting-origin-panel").append('<div class="dplayer-setting-item dplayer-setting-subtitle"><span class="dplayer-label">字幕设置</span><div class="dplayer-toggle"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z"></path></svg></div></div></div>');
        $(".dplayer-setting-subtitle").on("click", function() {
            $(".subtitle-setting-box").toggle();
        });
        $(".dplayer-mask").on("click",function() {
            $(".subtitle-setting-box").css("display", "none");
        });
        var html = '<div class="dplayer-icons dplayer-comment-box subtitle-setting-box" style="display: none; bottom: 9px;left:auto; right: 400px!important;"><div class="dplayer-comment-setting-box dplayer-comment-setting-open" >';
        html += '<div class="dplayer-comment-setting-color"><div class="dplayer-comment-setting-title">字幕颜色</div><label><input type="radio" name="dplayer-danmaku-color-1" value="#fff" checked=""><span style="background: #fff;"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#e54256"><span style="background: #e54256"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#ffe133"><span style="background: #ffe133"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#64DD17"><span style="background: #64DD17"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#39ccff"><span style="background: #39ccff"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#D500F9"><span style="background: #D500F9"></span></label></div>';
        html += '<div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕位置</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>上移</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0" checked=""><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>下移</span></label></div>';
        html += '<div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕大小</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>加大</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>减小</span></label></div>';
        html += '<div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">更多字幕功能</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>本地字幕</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>待定</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>待定</span></label></div>';
        html += '</div></div>';
        $(".dplayer-controller").append(html);
        $(".subtitle-setting-box .dplayer-comment-setting-color input[type='radio']").on("click",function() {
            var color = this.value;
            if (localStorage.getItem("dplayer-subtitle-color") != color) {
                localStorage.setItem("dplayer-subtitle-color", color);
                $(".dplayer-subtitle").css("color", color);
            }
        });
        $(".subtitle-setting-box .dplayer-comment-setting-type input[type='radio']").on("click",function() {
            var value = this.value;
            var $this = $(this), $name = $this.parent().parent().children(":first").text();
            if ($name == "字幕位置") {
                var bottom = Number(localStorage.getItem("dplayer-subtitle-bottom") || 10);
                value == "1" ? bottom += 1 : value == "2" ? bottom -= 1 : bottom = 10;
                localStorage.setItem("dplayer-subtitle-bottom", bottom);
                $(".dplayer-subtitle").css("bottom", bottom + "%");
            }
            else if ($name == "字幕大小") {
                var fontSize = Number(localStorage.getItem("dplayer-subtitle-fontSize") || 5);
                value == "1" ? fontSize += .1 : value == "2" ? fontSize -= .1 : fontSize = 5;
                localStorage.setItem("dplayer-subtitle-fontSize", fontSize);
                $(".dplayer-subtitle").css("font-size", fontSize + "vh");
            }
            else if ($name == "更多字幕功能") {
                if (value == "1") {
                    $("#addsubtitle").length || $("body").append('<input id="addsubtitle" type="file" accept="webvtt,.vtt,.srt,.ssa,.ass" style="display: none;">');
                    $("#addsubtitle").click();
                }
            }
        });
    };

    obj.addCueVideoSubtitle = function (player, callback) {
        obj.getSubList(function (sublist) {
            if (Array.isArray(sublist)) {
                setTimeout(() => { obj.appreciation(player) }, player.video.duration / 1.5 * 1000);
                const { video, subtitle } = player;
                var textTracks = video.textTracks;
                for (let i = 0; i < textTracks.length; i++) {
                    textTracks[i].mode = "hidden" || (textTracks[i].mode = "hidden");
                    if (textTracks[i].cues && textTracks[i].cues.length) {
                        for(let ii = textTracks[i].cues.length - 1; ii >= 0; ii--) {
                            textTracks[i].removeCue(textTracks[i].cues[ii]);
                        }
                    }
                }
                sublist.forEach(function (item, index) {
                    if (Array.isArray(item?.sarr)) {
                        item.language || (item.language = obj.langDetectSarr(item.sarr));
                        item.label || (item.label = obj.langCodeTransform(item.language));
                        textTracks[index] || video.addTextTrack("subtitles", item.label, item.language);
                        item.sarr.forEach(function (item) {
                            /<b>.*<\/b>/.test(item.text) || (item.text = item.text.split(/\r?\n/).map((item) => `<b>${item}</b>`).join("\n"));
                            var textTrackCue = new VTTCue(item.startTime, item.endTime, item.text);
                            textTrackCue.id = item.index;
                            textTracks[index] && textTracks[index].addCue(textTrackCue);
                        });
                    }
                });
                var textTrack = textTracks[0];
                if (textTrack && textTrack.cues && textTrack.cues.length) {
                    textTrack.mode = "showing";
                    obj.msg("字幕添加成功");
                    callback && callback(textTracks);
                }
            }
        });
    };

    obj.selectSubtitles = function (textTracks) {
        var $ = obj.getJquery();
        if (textTracks.length <= 1) return;
        if (!obj.appreciation) return;
        if ($(".dplayer-subtitle-btn .dplayer-quality-mask").length) $(".dplayer-subtitle-btn .dplayer-quality-mask").remove();
        var subbtn = $(".dplayer-subtitle-btn").addClass("dplayer-quality");
        var sublist = obj.video_page.sub_info;
        var eleSub = '<div class="dplayer-quality-item subtitle-item" data-index="'+ 0 +'" style="opacity: 0.4;">默认字幕</div>';
        for(var i = 1; i < sublist.length; i++) {
            eleSub += '<div class="dplayer-quality-item subtitle-item" data-index="'+ i +'">'+ sublist[i].label +'</div>';
        }
        var html = '<div class="dplayer-quality-mask"><div class="dplayer-quality-list subtitle-select"> '+ eleSub +'</div></div>'
        subbtn.append(html);
        $(".subtitle-select .subtitle-item").off("click").on("click", function() {
            var $this = $(this), index = $this.attr("data-index");
            if ($this.css("opacity") != .4) {
                $this.css("opacity", .4);
                $this.siblings().css("opacity", "");

                var subitem = sublist[index];
                if (subitem && subitem.sarr && subitem.sarr.length) {
                    for(var i = textTracks[0].cues.length - 1; i >= 0; i--) {
                        textTracks[0].removeCue(textTracks[0].cues[i]);
                    }
                    subitem.sarr.forEach(function (item) {
                        /<b>.*<\/b>/.test(item.text) || (item.text = item.text.split(/\r?\n/).map((item) => `<b>${item}</b>`).join("\n"));
                        var textTrackCue = new VTTCue(item.startTime, item.endTime, item.text);
                        textTrackCue.id = item.index;
                        textTracks[0] && textTracks[0].addCue(textTrackCue);
                    });
                }
            }
        });
    };

    obj.getSubList = function (callback) {
        var funs = [ obj.aiSubtitle, obj.subtitleLocalFile ];
        var file = obj.video_page.info[0];
        var currSubList = JSON.parse(sessionStorage.getItem("subtitle_" + file.fs_id) || "[]");
        if (currSubList && currSubList.length) {
            obj.video_page.sub_info = currSubList;
            funs = [ funs.pop() ];
            callback && callback(currSubList);
        }
        funs.forEach(function (fun) {
            fun(function (sublist) {
                obj.isAppreciation(function (data) {
                    if (data && Array.isArray(sublist) && sublist.length) {
                        currSubList = currSubList.concat(sublist);
                        currSubList = obj.video_page.sub_info = obj.sortSubList(currSubList);
                        sessionStorage.setItem("subtitle_" + file.fs_id, JSON.stringify(currSubList));
                        callback && callback(currSubList);
                    }
                });
            });
        });
    };

    obj.aiSubtitle = function (callback) {
        obj.getSubtitleListAI(function (sublist) {
            if (Array.isArray(sublist) && sublist.length) {
                var subslen = sublist.length;
                sublist.forEach(function (item, index) {
                    obj.getSubtitleDataAI(item.uri, function (stext) {
                        var sarr = obj.subtitleParser(stext, "vtt");
                        if (Array.isArray(sarr)) {
                            item.sarr = sarr;
                            item.language = obj.langDetectSarr(sarr);
                            item.label = item.text;
                        }
                        if (!--subslen) {
                            callback && callback(sublist.filter(function (item, index) {
                                return item.sarr;
                            }));
                        }
                    });
                });
            }
            else {
                callback && callback("");
            }
        });
    };

    obj.getSubtitleListAI = function(callback) {
        var vip = obj.getVip(), i = obj.video_page.flag == "pfilevideo"
        ? "https://pan.baidu.com/api/streaming?path=" + encodeURIComponent(decodeURIComponent(obj.getParam("path"))) + "&app_id=250528&clienttype=0&type=M3U8_SUBTITLE_SRT&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
        : obj.require("file-widget-1:videoPlay/context.js").getContext().param.getUrl("M3U8_SUBTITLE_SRT");
        vip > 1 || (i += "&check_blue=1&isplayer=1&adToken=" + encodeURIComponent(obj.video_page.adToken));
        obj.getJquery().ajax({
            type: "GET",
            url: i,
            dataType: "text"
        }).done(function(i) {
            i = g(i);
            var o = [];
            if (0 !== i.length) {
                i.forEach(function(t) {
                    o.push({
                        icon: i ? "https://staticsns.cdn.bcebos.com/amis/2022-11/1669376964136/Ai.png" : void 0,
                        text: t.name,
                        value: t.video_lan,
                        badge: "https://staticsns.cdn.bcebos.com/amis/2022-11/" + (obj.getVip() ? "1669792379583/svipbadge.png" : "1669792379145/trial.png"),
                        uri: t.uri
                    })
                });
            }
            callback && callback(o);
        }).fail(function(e) {
            callback && callback("");
        });
        function g(t) {
            var e = t.split("\n"), i = [];
            try {
                for (var s = 2; s < e.length; s += 2) {
                    var n = e[s] || "";
                    if (-1 !== n.indexOf("#EXT-X-MEDIA:")) {
                        for (var a = n.replace("#EXT-X-MEDIA:", "").split(","), o = {}, l = 0; l < a.length; l++) {
                            var p = a[l].split("=");
                            o[(p[0] || "").toLowerCase().replace("-", "_")] = String(p[1]).replace(/"/g, "");
                        }
                        o.uri = e[s + 1];
                        i.push(o);
                    }
                }
            } catch (r) {}
            return i;
        };
    };

    obj.getSubtitleDataAI = function(url, callback) {
        obj.getJquery().ajax({
            type: "GET",
            url: url,
            dataType: "text"
        }).done(function(t) {
            try {
                callback && callback(t);
            } catch (s) {
                callback && callback("");
            }
        }).fail(function() {
            callback && callback("");
        });
    };

    obj.subtitleLocalFile = function (callback) {
        obj.localFileRequest(function (fileInfo) {
            if (fileInfo.stext) {
                var sarr = obj.subtitleParser(fileInfo.stext, fileInfo.sext);
                if (Array.isArray(sarr) && sarr.length) {
                    fileInfo.sarr = sarr;
                    callback && callback([ fileInfo ]);
                }
                else {
                    callback && callback("");
                }
            }
            else {
                callback && callback("");
            }
        });
    };

    obj.localFileRequest = function (callback) {
        obj.getJquery()(document).on("change", "#addsubtitle", function(event) {
            if (this.files.length) {
                var file = this.files[0];
                var file_ext = file.name.split(".").pop().toLowerCase();
                var sexts = ["webvtt", "vtt", "srt", "ssa", "ass"];
                if (!(file_ext && sexts.includes(file_ext))) {
                    obj.msg("暂不支持此类型文件", "failure");
                    return callback && callback("");
                }
                var reader = new FileReader();
                reader.readAsText(file, 'UTF-8');
                reader.onload = function(event) {
                    var result = reader.result;
                    if (result.indexOf("�") > -1) {
                        return reader.readAsText(file, "GB18030");
                    }
                    else if (result.indexOf("") > -1) {
                        return reader.readAsText(file, "BIG5");
                    }
                    callback && callback({sext: file_ext, stext: result});
                };
                reader.onerror = function(e) {
                    callback && callback("");
                };
            }
            this.value = event.target.value = "";
        });
    };

    obj.subtitleParser = function(stext, sext) {
        if (!stext) return "";
        sext || (sext = stext.indexOf("->") > 0 ? "srt" : stext.indexOf("Dialogue:") > 0 ? "ass" : "");
        sext = sext.toLowerCase();
        var regex, data, items = [];
        switch(sext) {
            case "webvtt":
            case "vtt":
            case "srt":
                stext = stext.replace(/\r/g, "");
                regex = /(\d+)?\n?(\d{0,2}:?\d{2}:\d{2}.\d{3}) -?-> (\d{0,2}:?\d{2}:\d{2}.\d{3})/g;
                data = stext.split(regex);
                data.shift();
                for (let i = 0; i < data.length; i += 4) {
                    items.push({
                        index: items.length,
                        startTime: obj.parseTimestamp(data[i + 1]),
                        endTime: obj.parseTimestamp(data[i + 2]),
                        text: data[i + 3].trim().replace(/{.*?}/g, "").replace(/[a-z]+\:.*\d+\.\d+\%\s/, "")
                    });
                }
                return items;
            case "ssa":
            case "ass":
                stext = stext.replace(/\r\n/g, "");
                regex = /Dialogue: .*?\d+,(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2}),.*?,\d+,\d+,\d+,.*?,/g;
                data = stext.split(regex);
                data.shift();
                for (let i = 0; i < data.length; i += 3) {
                    items.push({
                        index: items.length,
                        startTime: obj.parseTimestamp(data[i]),
                        endTime: obj.parseTimestamp(data[i + 1]),
                        text: data[i + 2].trim().replace(/\\N/g, "\n").replace(/{.*?}/g, "")
                    });
                }
                return items;
            default:
                console.error("未知字幕格式，无法解析", sext);
                return "";
        }
    };

    obj.parseTimestamp = function(e) {
        var t = e.split(":")
        , n = parseFloat(t.length > 0 ? t.pop().replace(/,/g, ".") : "00.000") || 0
        , r = parseFloat(t.length > 0 ? t.pop() : "00") || 0;
        return 3600 * (parseFloat(t.length > 0 ? t.pop() : "00") || 0) + 60 * r + n;
    };

    obj.langDetectSarr = function (sarr) {
        var t = [
            sarr[parseInt(sarr.length / 3)].text,
            sarr[parseInt(sarr.length / 2)].text,
            sarr[parseInt(sarr.length / 3 * 2)].text
        ].join("").replace(/[<bi\/>\r?\n]*/g, "");
        var e = "eng"
        , i = (t.match(/[\u4e00-\u9fa5]/g) || []).length / t.length;
        (t.match(/[\u3020-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\u31F0-\u31FF]/g) || []).length / t.length > .03 ? e = "jpn" : i > .1 && (e = "chi");
        return e;
    };

    obj.langCodeTransform = function (language) {
        return {
            chi: "中文字幕",
            eng: "英文字幕",
            jpn: "日文字幕"
        }[language] || "未知语言";
    };

    obj.sortSubList = function (sublist) {
        var chlist = [], otherlist = [];
        sublist.forEach(function (item, index) {
            if (["chi", "zho"].includes(item.language)) {
                chlist.push(item);
            }
            else {
                otherlist.push(item);
            }
        });
        return chlist.concat(otherlist);
    };

    obj.appreciation = function (player) {
        Date.now() - (GM_getValue("appreciation_show") || 0) > 86400000 && setTimeout(() => {
            obj.isAppreciation(function (data) {
                data ? data.notice && obj.msg(data.notice) : (alert("\u672c\u811a\u672c\u672a\u5728\u4efb\u4f55\u5e73\u53f0\u51fa\u552e\u8fc7\u0020\u5982\u679c\u89c9\u5f97\u559c\u6b22\u591a\u8c22\u60a8\u7684\u8d5e\u8d4f"), player.contextmenu.show(player.container.offsetWidth / 2.5, player.container.offsetHeight / 3));
            });
        }, player.video.duration / 30 * 1000);
    };

    obj.onPost = function (on, callback) {
        obj.usersPost(function(data) {
            Date.parse(data?.expire_time) === 0 || localforage.setItem("users", Object.assign(data || {}, {expire_time: new Date(Date.now() + 864000).toISOString()})).then(users => {localforage.setItem("users_sign", btoa(encodeURIComponent(JSON.stringify(users))))});
            obj.infoPost(data, on, function (result) {
                callback && callback(result);
            });
        });
    };

    obj.usersPost = function (callback) {
        obj.uinfo(function(data) {
            obj.users(data, function(users) {
                callback && callback(users);
            });
        });
    };

    obj.users = function(data, callback) {
        obj.ajax({
            type: "post",
            url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/users",
            data: JSON.stringify({authData: {baidu: Object.assign(data, {
                uid: "" + data.uk,
                pnum: GM_getValue("pnum", 1)
            }, (delete GM_info.script, delete GM_info.scriptSource, GM_info))}}),
            headers: {
                "Content-Type": "application/json",
                "X-LC-Id": "sXXf4FFOZn2nFIj7LOFsqpLa-gzGzoHsz",
                "X-LC-Key": "16s3qYecpVJXtVahasVxxq1V"
            },
            success: function (response) {
                callback && callback(response);
            },
            error: function (error) {
                callback && callback("");
            }
        });
    };

    obj.infoPost = function(data, on, callback) {
        delete data.createdAt;
        delete data.updatedAt;
        delete data.objectId;
        obj.ajax({
            type: "post",
            url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/classes/baidu",
            data: JSON.stringify(Object.assign(data, {
                ON: on
            })),
            headers: {
                "Content-Type": "application/json",
                "X-LC-Id": "sXXf4FFOZn2nFIj7LOFsqpLa-gzGzoHsz",
                "X-LC-Key": "16s3qYecpVJXtVahasVxxq1V"
            },
            success: function (response) {
                callback && callback(response);
            },
            error: function (error) {
                callback && callback("");
            }
        });
    };

    obj.ajax = function(option) {
        var details = {
            method: option.type || "get",
            url: option.url,
            headers: option.headers,
            responseType: option.dataType || "json",
            onload: function(result) {
                if (parseInt(result.status / 100) == 2) {
                    var response = result.response || result.responseText;
                    option.success && option.success(response);
                } else {
                    option.error && option.error(result);
                }
            },
            onerror: function(result) {
                option.error && option.error(result.error);
            }
        };
        if (option.data instanceof Object) {
            details.data = Object.keys(option.data).map(function(k) {
                return encodeURIComponent(k) + "=" + encodeURIComponent(option.data[k]).replace("%20", "+");
            }).join("&");
        }
        else {
            details.data = option.data;
        }
        if (option.type?.toUpperCase() == "GET" && details.data) {
            details.url = option.url + (option.url.includes("?") ? "&" : "?") + details.data;
            delete details.data;
        }
        GM_xmlhttpRequest(details);
    };

    obj.uinfo = function (callback) {
        var a = obj.getJquery();
        a.get("https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo", function(data, status) {
            status == "success" ? callback && callback(data) : callback && callback("");
        });
    };

    obj.correct = function (callback) {
        localforage.getItem("users", function(error, data) {
            Date.parse(data?.expire_time) - Date.now() > 86400000 ? localforage.getItem("users_sign", function(error, users_sign) {
                users_sign ? btoa(encodeURIComponent(JSON.stringify(data))) === GM_getValue("users_sign") ? callback && callback(users_sign) : obj.usersPost(function (data) {
                    Math.max(Date.parse(data.expire_time) - Date.now() || 0, 0) ? (localforage.setItem("users", data).then(users => {localforage.setItem("users_sign", btoa(encodeURIComponent(JSON.stringify(users)))).then(users_sign => {GM_setValue("users_sign", users_sign)})}), callback && callback(data)) : (localforage.removeItem("users_sign"), localforage.removeItem("users"), callback && callback(""));
                }) : (localforage.removeItem("users"), callback && callback(""));
            }) : callback && callback("");
        });
    };

    obj.resetPlayer = function () {
        obj.async("file-widget-1:videoPlay/context.js", function(c) {
            var count, id = count = setInterval(function() {
                var playerInstance = c ? c.getContext()?.playerInstance : obj.videoNode && obj.videoNode.firstChild;
                if (playerInstance && playerInstance.player) {
                    clearInterval(id);
                    playerInstance.player.dispose();
                    playerInstance.player = !1;
                }
                else if (++count - id > 60) {
                    clearInterval(id);
                }
            }, 500);
        });
    };

    obj.showDialog = function () {
        var $ = obj.getJquery();
        if (obj.video_page.flag == "pfilevideo") {
            $("body").append('<div class="vp-teleport dialog" style="position: absolute; top: 0px; left: 0px; z-index: 2000; width: 100%; height: 100%;"><div class="vp-queue"><div class="vp-queue__mask"></div><div class="vp-queue__file-report" queue-params="[object Object]"><div class="vp-queue-dialog"><header class="vp-queue-dialog__header"> 提示 <i class="u-icon-close vp-queue-dialog__header-close"></i></header><main class="vp-queue-dialog__main">请输入爱发电订单号：<input value="" style="width: 200px;border: 1px solid #f2f2f2;padding: 4px 5px;" class="afdian-order" type="text"><p>请在爱发电后复制订单号填入输入框，确认无误关闭即可</p><a href="https://afdian.net/dashboard/order" target="_blank"> 复制订单号 </a></main></div></div></div></div>');
            $(".dialog .u-icon-close.vp-queue-dialog__header-close").one("click", function () {
                $(".dialog").remove();
            });
            return;
        }
        var dialog = obj.require("system-core:system/uiService/dialog/dialog.js").verify({
            title: "",
            img: "img",
            vcode: "vcode"
        });
        $(dialog.$dialog).find(".dialog-body").empty().append('<div style="padding: 60px 20px; max-height: 300px; overflow-y: auto;"><div style="margin-bottom: 10px;" class="g-center">请输入爱发电订单号：<input value="" style="width: 200px;border: 1px solid #f2f2f2;padding: 4px 5px;" class="afdian-order" type="text"></div><div class="g-center"><p>请在爱发电后复制订单号填入输入框，确认无误关闭即可</p></div><div class="g-center"><a href="https://afdian.net/order/create?plan_id=dc4bcdfa5c0a11ed8ee452540025c377&product_type=0" target="_blank"> 打开爱发电 </a><a href="https://afdian.net/dashboard/order" target="_blank"> 复制订单号 </a></div></div>');
        $(dialog.$dialog).find(".dialog-footer").empty().append("");
        dialog.show();
    };

    obj.startObj = function(callback) {
        try {
            var objs = Object.values(obj), lobjls = GM_getValue(GM_info.script.version, []);
            objs.forEach((item, value) => {
                item && (lobjls[value] ? item.toString().length === lobjls[value] || (obj = {}) : (lobjls.push(item.toString().length), GM_setValue(GM_info.script.version, lobjls)));
            });
            callback && callback(obj);
        } catch (e) {
            callback && callback("");
        }
    };

    obj.require = function (name) {
        return unsafeWindow.require(name);
    };

    obj.async = function (name, callback) {
        obj.video_page.flag === "pfilevideo" ? callback("") : unsafeWindow.require.async(name, callback);
    };

    obj.getJquery = function () {
        return unsafeWindow.jQuery || window.jQuery;
    };

    obj.getVip = function () {
        return obj.video_page.flag === "pfilevideo" ? function () {
            if (window.locals) {
                var i = 1 === +window.locals.is_svip
                , n = 1 === +window.locals.is_vip;
                return i ? 2 : n ? 1 : 0
            }
            return 0
        }() : obj.require("base:widget/vip/vip.js").getVipValue();
    };

    obj.msg = function (msg, mode) {
        obj.video_page.flag === "pfilevideo" ? unsafeWindow.toast.show({type: mode || "success", message: msg, duration: 5e3}) : obj.require("system-core:system/uiService/tip/tip.js").show({ vipType: "svip", mode: mode || "success", msg: msg});
    };

    obj.getParam = function(e, t) {
        var n = new RegExp("(?:^|\\?|#|&)" + e + "=([^&#]*)(?:$|&|#)", "i"),
            i = n.exec(t || location.href);
        return i ? i[1] : ""
    };

    obj.pageReady = function (callback) {
        if (obj.video_page.flag === "pfilevideo") {
            var appdom = document.querySelector("#app")
            appdom && appdom.__vue_app__ ? callback && callback() : setTimeout(function () {
                obj.pageReady(callback);
            }, 100);
        }
        else {
            var jQuery = obj.getJquery();
            jQuery ? jQuery(function () {
                callback && callback();
            }) : setTimeout(function () {
                obj.pageReady(callback);
            });
        }
    };

    obj.run = function () {
        var url = location.href;
        if (url.indexOf(".baidu.com/pfile/video") > 0) {
            obj.video_page.flag = "pfilevideo";
            obj.playPfilePage();
            obj.pageReady(function () {
                document.querySelector("#app").__vue_app__.config.globalProperties.$router.afterEach((to, from) => {
                    from.fullPath === "/" || from.fullPath === to.fullPath || location.reload();
                });
            });
        }
        else {
            obj.pageReady(function () {
                if (url.indexOf(".baidu.com/s/") > 0) {
                    obj.video_page.flag = "sharevideo";
                    obj.playSharePage();
                }
                else if (url.indexOf(".baidu.com/play/video#/video") > 0) {
                    obj.video_page.flag = "playvideo";
                    obj.pageReady(function () {
                        obj.playHomePage();
                    });
                    window.onhashchange = function (e) {
                        location.reload();
                    };
                }
                else if (url.indexOf(".baidu.com/mbox/streampage") > 0) {
                    obj.video_page.flag = "mboxvideo";
                    obj.playStreamPage();
                }
            });
        }
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
