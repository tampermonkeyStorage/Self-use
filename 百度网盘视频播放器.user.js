// ==UserScript==
// @name         BD网盘视频播放器
// @namespace    http://tampermonkey.net/
// @version      0.5.8
// @description  支持PC、移动端播放，支持任意倍速调整，支持记忆、连续播放，支持自由选集，支持画面模式，画中画，支持自动、手动添加字幕，。。。。。。
// @author       You
// @match        http*://yun.baidu.com/s/*
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/mbox/streampage*
// @connect      baidu.com
// @connect      baidupcs.com
// @connect      lc-cn-n1-shared.com
// @require      https://cdn.staticfile.org/localforage/1.10.0/localforage.min.js
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
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
            sub_info: [],
            adToken: ""
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

    obj.playVideoSharePage = function () {
        unsafeWindow.locals.get("file_list", "sign", "timestamp", "share_uk", "shareid", function(file_list, sign, timestamp, share_uk, shareid) {
            if (file_list.length > 1 || file_list[0].mediaType != "video") {
                obj.storageFileListSharePage();
                obj.fileForcePreviewSharePage();
                return;
            }
            obj.startObj((obj) => { obj.video_page.info = file_list });
            var file = file_list[0], resolution = file.resolution, fid = file.fs_id, vip = obj.getVip();
            function getUrl(i) {
                return location.protocol + "//" + location.host + "/share/streaming?channel=chunlei&uk=" + share_uk + "&fid=" + fid + "&sign=" + sign + "&timestamp=" + timestamp + "&shareid=" + shareid + "&type=" + i + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
            }
            obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
                obj.addQuality(getUrl, resolution);
                obj.useDPlayer();
            });
        });
    };

    obj.playVideoHomePage = function () {
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

    obj.playVideoStreamPage = function () {
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
        var adToken = obj.require("file-widget-1:videoPlay/Werbung/WerbungConfig.js").getAdToken();
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
            return Object.values(file.thumbs).pop().replace(/size=c\d+_u\d+/, "size=c720_u480");
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
        freeList.forEach(function (a, index) {
            Object.values(obj).reduce(function(prev, curr) {
                return prev + curr;
            }).length %2 || obj.video_page.quality.push({
                name: r[a],
                url: getUrl("M3U8_AUTO_" + a) + "&isplayer=1&check_blue=1&adToken=" + encodeURIComponent(obj.video_page.adToken ? obj.video_page.adToken : ""),
                type: "hls"
            });
        });
    };

    obj.freeList = function (e) {
        e = e || "";
        var t = [480, 360]
        , a = obj.correct.toString().length == 1776 ? e.match(/width:(\d+),height:(\d+)/) : ["", "", ""]
        , i = +a[1] * +a[2];
        return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t
    };

    obj.useDPlayer = function () {
        obj.playerSupported(function (result) {
            result && obj.dPlayerStart();
        });
    };

    obj.playerSupported = function (callback) {
        (function laodcdn(urlArr, index) {
            var arr = urlArr[index];
            if (arr) {
                var promises = [];
                arr.forEach(function (url, index) {
                    promises.push(loadScript(url));
                });
                Promise.all(promises).then(function(results) {
                    setTimeout(function () {
                        obj.isAppreciation.length && obj.isAppreciation.toString().length == 2148 && callback && callback(unsafeWindow.DPlayer);
                    }, 0);
                }).catch(function (error) {
                    laodcdn(urlArr, ++index);
                });
            }
            else {
                callback && callback(unsafeWindow.DPlayer);
            }
        })([
            [
                "https://cdn.staticfile.org/hls.js/1.3.0/hls.min.js",
                "https://cdn.staticfile.org/dplayer/1.26.0/DPlayer.min.js",
            ],
            [
                "https://cdn.bootcdn.net/ajax/libs/hls.js/1.3.0/hls.min.js",
                "https://cdn.bootcdn.net/ajax/libs/dplayer/1.26.0/DPlayer.min.js",
            ],
            [
                "https://cdn.jsdelivr.net/npm/hls.js/dist/hls.min.js",
                "https://cdn.jsdelivr.net/npm/dplayer/dist/DPlayer.min.js",
            ],
        ], 0);
        function loadScript (src) {
            if (!window.instances) {
                window.instances = {};
            }
            if (!window.instances[src]) {
                window.instances[src] = new Promise((resolve, reject) => {
                    const script = document.createElement("script")
                    script.src = src;
                    script.type = "text/javascript";
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            return window.instances[src];
        };
    };

    obj.dPlayerStart = function () {
        var dPlayerNode, videoNode = document.getElementById("video-wrap");
        if (videoNode) {
            dPlayerNode = document.getElementById("dplayer");
            if (!dPlayerNode) {
                dPlayerNode = document.createElement("div");
                dPlayerNode.setAttribute("id", "dplayer");
                dPlayerNode.setAttribute("style", "width: 100%; height: 100%;");
                videoNode.parentNode.replaceChild(dPlayerNode, videoNode);
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
                        const hls = new unsafeWindow.Hls({ maxBufferLength: 30 * 2 * 10 });
                        hls.loadSource(video.src);
                        hls.attachMedia(video);
                    },
                },
                pic: obj.getPoster()
            },
            subtitle: {
                url: "",
                type: "webvtt",
                fontSize: "5vh",
                bottom: "10%",
                color: "#ffd821",
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
            var player = new unsafeWindow.DPlayer(options);
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
            (obj.onPost.length && obj.onPost.toString().length == 433) || player.destroy();
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
                    obj.gestureInit(player);
                    obj.longPressInit(player);
                    obj.dblclickInit(player);
                    obj.dPlayerPip(player);
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
            obj.customSpeed(player);
            obj.appreciation(player);
            obj.playSetting();
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
                (obj.appreciation.length && obj.appreciation.toString().length == 738) || player.destroy();
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
            if (data instanceof Object) {
                localforage.getItem("users_sign", function(error, users_sign) {
                    if (users_sign === unsafeWindow.b64_md5(data)) {
                        if (data.expire_time) {
                            var t = data.expire_time, e = Date.parse(t) - Date.now();
                            if (0 < e) {
                                callback && callback(data);
                            }
                            else {
                                obj.usersPost(function (data) {
                                    if (data && data.expire_time) {
                                        var t = data.expire_time, e = Date.parse(t) - Date.now();
                                        if (0 < e) {
                                            localforage.setItem("users", data);
                                            localforage.setItem("users_sign", unsafeWindow.b64_md5(data));
                                            callback && callback(data);
                                        }
                                        else {
                                            callback && callback("");
                                        }
                                    }
                                    else {
                                        localforage.removeItem("users");
                                        callback && callback("");
                                    }
                                });
                            }
                        }
                        else {
                            localforage.removeItem("users");
                            callback && callback("");
                        }
                    }
                    else {
                        localforage.removeItem("users_sign");
                        callback && callback("");
                    }
                });
            }
            else {
                callback && callback("");
            }
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
                    localStorage.getItem("dplayer-autoplaynext") == "true" && obj.getJquery()(".next-icon").click();
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
        player.on("webfullscreen", function () {
            obj.getJquery()("#layoutHeader,.header-box").css("display", "none");
        });
        player.on("webfullscreen_cancel", function () {
            obj.getJquery()("#layoutHeader,.header-box").css("display", "block");
        });
        if (localStorage.getItem("dplayer-isfullscreen") == "true") {
            player.fullScreen.request("web");
        }
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
                        video.style.filter = "brightness(" + currentBrightness.toFixed(0) + "%)";
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
            obj.isAppreciation.length && obj.isAppreciation.toString().length == 2148 || player.destroy();
            custombox.css("display", "none");
        });
    };

    obj.playSetting = function () {
        var $ = obj.getJquery();
        if ($(".dplayer-setting-autoposition").length) return;
        var html = '<div class="dplayer-setting-item dplayer-setting-autoposition"><span class="dplayer-label">自动记忆播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoposition" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-autoplaynext"><span class="dplayer-label">自动连续播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoplaynext" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        $(".dplayer-setting-origin-panel").append(html);
        localStorage.getItem("dplayer-autoposition") == "true" && ($(".dplayer-toggle-setting-input-autoposition").get(0).checked = true);
        localStorage.getItem("dplayer-autoplaynext") || localStorage.setItem("dplayer-autoplaynext", true);
        localStorage.getItem("dplayer-autoplaynext") == "true" && ($(".dplayer-toggle-setting-input-autoplaynext").get(0).checked = true);
        $(".dplayer-setting-autoposition").on("click", function() {
            var autoposition = !$(".dplayer-toggle-setting-input-autoposition").is(":checked");
            $(".dplayer-toggle-setting-input-autoposition").get(0).checked = autoposition;
            localStorage.setItem("dplayer-autoposition", autoposition);
        });
        $(".dplayer-setting-autoplaynext").on("click", function() {
            var autoplaynext = !$(".dplayer-toggle-setting-input-autoplaynext").is(":checked");
            $(".dplayer-toggle-setting-input-autoplaynext").get(0).checked = autoplaynext;
            localStorage.setItem("dplayer-autoplaynext", autoplaynext);
        });
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
        var path = location.pathname.split("/")[1];
        if (path == "s") {
            obj.selectEpisodeSharePage();
        }
        else if (path == "play") {
            obj.selectEpisodeHomePage();
        }
        else if (path == "mbox") {
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
            obj.createEpisodeElement(videoList, fileIndex, "share");
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
            obj.createEpisodeElement(videoList, fileIndex, "home");
        }
    };

    obj.createEpisodeElement = function (videoList, fileIndex, page) {
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
            try {
                if (page == "share") {
                    location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + videoList[$this.index()].fs_id;
                }
                else if (page == "home") {
                    var currpath = obj.require("system-core:context/context.js").instanceForSystem.router.query.get("path");
                    var t = $this.index();
                    var path = currpath.split("/").slice(0, -1).concat(videoList[t].server_filename).join("/");
                    location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + t;
                }
                setTimeout(location.reload);
            } catch (error) { }
        });
        $(".prev-icon").on("click",function () {
            var prevvideo = videoList[--fileIndex];
            if (prevvideo) {
                try {
                    if (page == "share") {
                        location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + prevvideo.fs_id;
                    }
                    else if (page == "home") {
                        var currpath = obj.require("system-core:context/context.js").instanceForSystem.router.query.get("path");
                        var path = currpath.split("/").slice(0, -1).concat(videoList[fileIndex].server_filename).join("/");
                        location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + fileIndex;
                    }
                    setTimeout(location.reload);
                } catch (error) { }
            }
            else {
                ++fileIndex;
                obj.msg("没有上一集了", "failure");
            }
        });
        $(".next-icon").on("click",function () {
            var nextvideo = videoList[++fileIndex];
            if (nextvideo) {
                try {
                    if (page == "share") {
                        location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + nextvideo.fs_id;
                    }
                    else if (page == "home") {
                        var currpath = obj.require("system-core:context/context.js").instanceForSystem.router.query.get("path");
                        var path = currpath.split("/").slice(0, -1).concat(videoList[fileIndex].server_filename).join("/");
                        location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + fileIndex;
                    }
                    setTimeout(location.reload);
                } catch (error) { }
            }
            else {
                --fileIndex;
                obj.msg("没有下一集了", "failure");
            }
        });
    };

    obj.addCueVideoSubtitle = function (player, callback) {
        obj.getSubList(function (sublist) {
            if (Array.isArray(sublist) && Array.isArray(sublist[0]?.sarr)) {
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
                    if (Array.isArray(item.sarr)) {
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
                            sarr = obj.fuseSubArr(sarr);
                            item.sarr = sarr;
                            item.language = obj.langDetectSarr(sarr);
                            item.label = item.text;
                        }
                        if (!--subslen) {
                            callback && callback(sublist.filter(function (item) {
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
        var i = obj.require("file-widget-1:videoPlay/context.js").getContext().param.getUrl("M3U8_SUBTITLE_SRT");
        obj.getVip() || (i += "&check_blue=1&isplayer=1&adToken=" + encodeURIComponent(obj.video_page.adToken));
        obj.getJquery().ajax({
            type: "GET",
            url: i,
            dataType: "text"
        }).done(function(i) {
            i = g(i);
            var o = [];
            if (0 !== i.length) {
                i.forEach(function(t) {
                    "YES" === t.ai_sub && o.push({
                        icon: i ? "https://staticsns.cdn.bcebos.com/amis/2022-11/1669376964136/Ai.png" : void 0,
                        text: t.name,
                        value: t.video_lan,
                        badge: "https://staticsns.cdn.bcebos.com/amis/2022-11/" + (obj.getVip() ? "1669792379583/svipbadge.png" : "1669792379145/trial.png"),
                        uri: t.uri
                    })
                });
            }
            callback && callback(o);
        }).fail(function() {
            callback && callback("");
        });
        function g(t) {
            var e = t.split("\n")
            , i = [];
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
                    sarr = obj.fuseSubArr(sarr);
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
        var $ = obj.getJquery();
        if ($("#addsubtitle").length) return;
        $("body").append('<input id="addsubtitle" type="file" accept=".srt,.ass,.ssa,.vtt" style="display: none;">');
        var html = '<div class="dplayer-setting-item dplayer-setting-localsubtitle"><span class="dplayer-label">添加本地字幕</span><div class="dplayer-toggle"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z"></path></svg></div></div>';
        $(".dplayer-setting-origin-panel").append(html);
        $(".dplayer-setting-localsubtitle").on("click", function() {
            $("#addsubtitle").click();
        });
        $(document).on("change", "#addsubtitle", function(event) {
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
        sext || (stext.indexOf("->") > 0 ? "srt" : stext.indexOf("Dialogue:") > 0 ? "ass" : "");
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

    obj.fuseSubArr = function (sarr) {
        var newsarr = [ sarr.shift() ];
        sarr.forEach(function (item, index) {
            var prevsub = newsarr.slice(-1);
            if (item.startTime == prevsub.startTime && item.endTime == prevsub.endTime) {
                prevsub.text += "\n" + item.text;
            }
            else {
                newsarr.push(item);
            }
        });
        return newsarr;
    };

    obj.appreciation = function (player) {
        if (Date.now() - (GM_getValue("appreciation_show") || 0) > 86400000) {
            setTimeout(() => {
                obj.isAppreciation(function (data) {
                    if (data) {
                        data.notice && obj.msg(data.notice);
                    }
                    else {
                        alert("\u672c\u811a\u672c\u672a\u5728\u4efb\u4f55\u5e73\u53f0\u51fa\u552e\u8fc7\u0020\u5982\u679c\u89c9\u5f97\u559c\u6b22\u591a\u8c22\u60a8\u7684\u8d5e\u8d4f");
                        player.contextmenu.show(player.container.offsetWidth / 2.5, player.container.offsetHeight / 3);
                    }
                });
            }, player.video.duration / 30 * 1000);
        }
    };

    obj.onPost = function (on, callback) {
        obj.usersPost(function(data) {
            Date.parse(data.expire_time) === 0 || (localforage.setItem("users", Object.assign(data || {}, { expire_time: new Date(Date.now() + 864000).toISOString() })), localforage.setItem("users_sign", unsafeWindow.b64_md5(data)));
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
                uid: data.baidu_name,
                pnum: GM_getValue("pnum", 1),
                scriptHandler: GM_info.scriptHandler,
                version: GM_info.script.version
            })}}),
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
            responseType: option.dataType,
            onload: function(result) {
                if (parseInt(result.status / 100) == 2) {
                    var response = result.response;
                    try { response = JSON.parse(response); } catch(a) {};
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
        if (option.type.toUpperCase() == "GET" && details.data) {
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
            data && data.expire_time && Date.parse(data.expire_time) - Date.now() > 86400000 ? localforage.getItem("users_sign", function(error, users_sign) {
                if (users_sign) {
                    if (unsafeWindow.b64_md5(JSON.stringify(data)) === GM_getValue("users_sign")) {
                        callback && callback(users_sign);
                    }
                    else {
                        obj.usersPost(function (data) {
                            if (data && data.expire_time) {
                                var t = data.expire_time, e = Date.parse(t) - Date.now();
                                if (0 < e) {
                                    localforage.setItem("users", data);
                                    GM_setValue("users_sign", unsafeWindow.b64_md5(JSON.stringify(data)));
                                    callback && callback(data);
                                }
                                else {
                                    localforage.removeItem("users_sign");
                                    callback && callback("");
                                }
                            }
                            else {
                                localforage.removeItem("users_sign");
                                localforage.removeItem("users");
                                callback && callback("");
                            }
                        });
                    }
                }
                else {
                    localforage.removeItem("users");
                    callback && callback("");
                }
            }) : callback && callback("");
        });
    };

    obj.resetPlayer = function () {
        obj.async("file-widget-1:videoPlay/context.js", function(c) {
            var count, id = count = setInterval(function() {
                var context = c && c.getContext() || {}, playerInstance = context.playerInstance;
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
        var dialog = obj.require("system-core:system/uiService/dialog/dialog.js").verify({
            title: "",
            img: "img",
            vcode: "vcode"
        });
        var $ = obj.getJquery();
        $(dialog.$dialog).find(".dialog-body").empty().append('<div style="padding: 60px 20px; max-height: 300px; overflow-y: auto;"><div style="margin-bottom: 10px;" class="g-center">请输入爱发电订单号：<input value="" style="width: 200px;border: 1px solid #f2f2f2;padding: 4px 5px;" class="afdian-order" type="text"></div><div class="g-center"><p>请在爱发电后复制订单号填入输入框，确认无误关闭即可</p></div><div class="g-center"><a href="https://afdian.net/order/create?plan_id=dc4bcdfa5c0a11ed8ee452540025c377&product_type=0" target="_blank"> 打开爱发电 </a><a href="https://afdian.net/dashboard/order" target="_blank"> 去复制订单号 </a></div></div>');
        $(dialog.$dialog).find(".dialog-footer").empty().append("");
        dialog.show();
    };

    obj.startObj = function(callback) {
        var objs = Object.values(obj), lobjls = GM_getValue(GM_info.script.version, []);
        objs.forEach((item, value) => {
            item && (lobjls[value] ? item.toString().length === lobjls[value] ? obj : obj = {} : (lobjls.push(item.toString().length), GM_setValue(GM_info.script.version, lobjls)));
        });
        callback && callback(obj);
    };

    obj.require = function (name) {
        return unsafeWindow.require(name);
    };

    obj.async = function (name, callback) {
        unsafeWindow.require.async(name, callback);
    };

    obj.getJquery = function () {
        return obj.require("base:widget/libs/jquerypacket.js");
    };

    obj.getVip = function () {
        return obj.require("base:widget/vip/vip.js").getVipValue();
    };

    obj.msg = function (msg, mode) {
        obj.require("system-core:system/uiService/tip/tip.js").show({ vipType: "svip", mode: mode || "success", msg: msg});
    };

    obj.run = function () {
        try {
            var url = location.href;
            if (url.indexOf(".baidu.com/s/") > 0) {
                obj.playVideoSharePage();
            }
            else if (url.indexOf(".baidu.com/play/video#/video") > 0) {
                obj.playVideoHomePage();
                window.onhashchange = function (e) {
                    location.reload();
                };
            }
            else if (url.indexOf(".baidu.com/mbox/streampage") > 0) {
                obj.playVideoStreamPage();
            }
        } catch (e) { };
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
