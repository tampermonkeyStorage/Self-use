// ==UserScript==
// @name         百度网盘视频播放器
// @namespace    http://tampermonkey.net/
// @version      0.1.9
// @description  播放器替换为DPlayer
// @author       You
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/play/video
// @match        https://pan.baidu.com/mbox/streampage*
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    var obj = {
        video_page: {
            info: [],
            quality: [],
            adToken: ""
        }
    };

    obj.fetchVideoInfoHomePage = function (callback) {
        var instanceForSystem = obj.require("system-core:context/context.js").instanceForSystem
        , router = instanceForSystem.router
        , uk = instanceForSystem.locals.get("uk")
        , path = router.query.get("path");

        var jQuery = obj.getJquery()
        , target = jQuery.stringify([path]);
        jQuery.ajax({
            url: "/api/filemetas",
            data: {
                target: target,
                dlink: 1
            },
            success: function(i) {
                if (i && 0 === i.errno && i.info && i.info[0]) {
                    obj.video_page.info = i.info;
                    callback && callback(i.info[0]);
                } else {
                    obj.msg("视频加载失败，请刷新页面后重试", "failure");
                    callback && callback("");
                }
            },
            error: function(i) {
                obj.msg("视频加载失败，请刷新页面后重试", "failure");
                callback && callback("");
            }
        })
    };

    obj.playVideoHomePage = function () {
        var instanceForSystem = obj.require("system-core:context/context.js").instanceForSystem
        , router = instanceForSystem.router
        , uk = instanceForSystem.locals.get("uk")
        , path = router.query.get("path")
        , vip = obj.getVip();

        function getUrl (i) {
            return location.protocol + "//" + location.host + "/api/streaming?path=" + encodeURIComponent(path) + "&app_id=250528&clienttype=0&type=" + i + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
        }

        var file = obj.video_page.info[0], resolution = file.resolution;
        obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
            obj.addQuality(getUrl, resolution);

            obj.useDPlayer();
        });
    };

    obj.playVideoSharePage = function () {
        unsafeWindow.locals.get("file_list", "sign", "timestamp", "share_uk", "shareid", function(file_list, sign, timestamp, share_uk, shareid) {
            if (file_list.length > 1 || file_list[0].mediaType != "video") {
                return;
            }

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

    obj.playVideoStreamPage = function () {
        var getParam = obj.require("base:widget/tools/service/tools.url.js").getParam;
        var file = {
            from_uk: getParam("from_uk"),
            to: getParam("to"),
            fs_id: getParam("fs_id"),
            name: getParam("name") || "",
            type: getParam("type"),
            md5: getParam("md5"),
            msg_id: getParam("msg_id"),
            path: decodeURIComponent(decodeURIComponent(getParam("path")))
        };

        function getUrl (i) {
            return location.protocol + "//" + location.host + "/mbox/msg/streaming?from_uk=" + file.from_uk + "&to=" + file.to + "&msg_id=" + file.msg_id + "&fs_id=" + file.fs_id + "&type=" + file.type + "&stream_type=" + i;
        }

        obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
            obj.addQuality(getUrl, "width:1920,height:1080");

            obj.useDPlayer();
        });
    };

    obj.getAdToken = function (url, callback) {
        var jQuery = obj.getJquery();
        jQuery.ajax({
            url: url,
        }).done(function(n) {
            if (133 === n.errno && 0 !== n.adTime) {
                obj.video_page.adToken = n.adToken;
            }
            callback && callback();
        }).fail(function(n) {
            var t = jQuery.parseJSON(n.responseText);
            if (t && 133 === t.errno && 0 !== t.adTime) {
                obj.video_page.adToken = t.adToken;
                callback && callback();
            }
            else {
                console.warn("尝试再次获取 adToken");
                setTimeout(function () { obj.getAdToken(url, callback) }, 500);
            }
        });
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
        , a = e.match(/width:(\d+),height:(\d+)/) || ["", "", ""]
        , i = +a[1] * +a[2];
        return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t
    };

    obj.useDPlayer = function () {
        obj.dPlayerSupport(function (result) {
            if (result) {
                obj.dPlayerStart();
            }
        });
    };

    obj.dPlayerSupport = function (callback) {
        var urlArr = [
            [
                "https://cdn.jsdelivr.net/npm/hls.js/dist/hls.min.js",
                "https://cdn.jsdelivr.net/npm/dplayer/dist/DPlayer.min.js",
            ],
            [
                "https://cdn.staticfile.org/hls.js/1.1.4/hls.min.js",
                "https://cdn.staticfile.org/dplayer/1.26.0/DPlayer.min.js",
            ],
            [
                "https://cdn.bootcdn.net/ajax/libs/hls.js/1.1.4/hls.min.js",
                "https://cdn.bootcdn.net/ajax/libs/dplayer/1.26.0/DPlayer.min.js",
            ],
        ];
        (function laodcdn(urlArr, index = 0) {
            var arr = urlArr[index];
            if (arr) {
                var promises = [];
                arr.forEach(function (url, index) {
                    promises.push(obj.loadScript(url));
                });
                Promise.all(promises).then(function(results) {
                    if (results.length == arr.length) {
                        callback && callback(unsafeWindow.DPlayer);
                    }
                    else {
                        console.error("laodcdn 发生错误！", index, results);
                        laodcdn(urlArr, ++index);
                    }
                }).catch(function(error) {
                    console.error("laodcdn 发生错误！", index, error);
                    laodcdn(urlArr, ++index);
                });
            }
            else {
                callback && callback(unsafeWindow.DPlayer);
            }
        })(urlArr);
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
                obj.getJquery()("#layoutMain").attr("style", "z-index: 42;");
                obj.getJquery()(".header-box").remove();
            }
        }
        else {
            console.warn("尝试再次获取播放器容器");
            return setTimeout(obj.dPlayerStart, 500);
        }

        var options = {
            container: dPlayerNode,
            video: {
                quality: obj.video_page.quality,
                defaultQuality: 0,
                pic: unsafeWindow.locals.get("file_list") ? unsafeWindow.locals.get("file_list")[0].thumbs.url3 : ""
            },
            autoplay: true,
            screenshot: true,
            hotkey: true,
            airplay: true,
            volume: 1.0,
            playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 4],
            contextmenu: [
                {
                    text: "作者加油",
                    link: "https://cdn.jsdelivr.net/gh/tampermonkeyStorage/Self-use@main/appreciation.png",
                },
            ],
            theme: "#b7daff"
        };

        try {
            var dPlayer = new unsafeWindow.DPlayer(options);
            dPlayer.on("error", function () {
                setTimeout(function () {
                    if (isNaN(dPlayer.video.duration)) {
                        location.reload();
                    }
                }, 3000);
            });

            dPlayer.speed(localStorage.getItem("dplayer-speed") || 1);
            dPlayer.on("ratechange", function () {
                dPlayer.notice("播放速度：" + dPlayer.video.playbackRate);
                localStorage.getItem("dplayer-speed") == dPlayer.video.playbackRate || localStorage.setItem("dplayer-speed", dPlayer.video.playbackRate);
            });

            obj.getJquery()(dPlayerNode).nextAll().remove();
            location.pathname == "/mbox/streampage" && obj.getJquery()(dPlayerNode).css("height", "480px");

            obj.resetPlayer();
            obj.msg("DPlayer 播放器创建成功");
        } catch (error) {
            obj.msg("播放器创建失败", "failure");
        }
    };

    obj.resetPlayer = function () {
        obj.async("file-widget-1:videoPlay/context.js", function(c) {
            var count, id = count = setInterval(function() {
                var context = c.getContext() || {}, playerInstance = context.playerInstance;
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

    obj.loadScript = function (src) {
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

    obj.require = function (name) {
        return unsafeWindow.require(name);
    };

    obj.async = function (name, callback) {
        unsafeWindow.require.async(name, callback);
    };

    obj.getJquery = function () {
        return unsafeWindow.$ || unsafeWindow.jQuery || obj.require("base:widget/libs/jquerypacket.js");
    };

    obj.getVip = function () {
        return obj.require("base:widget/vip/vip.js").getVipValue();
    };

    obj.msg = function (msg, mode) {
        obj.require("system-core:system/uiService/tip/tip.js").show({ vipType: "svip", mode: mode || "success", msg: msg});
    };

    obj.run = function () {
        var url = location.href;
        if (url.indexOf(".baidu.com/s/") > 0) {
            obj.playVideoSharePage();
        }
        else if (url.indexOf(".baidu.com/play/video#/video") > 0) {
            obj.fetchVideoInfoHomePage(function (info) {
                if (info) {
                    obj.playVideoHomePage();
                }
            });
            window.onhashchange = function (e) {
                location.reload();
            }
        }
        else if (url.indexOf(".baidu.com/mbox/streampage") > 0) {
            obj.playVideoStreamPage();
        }
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
