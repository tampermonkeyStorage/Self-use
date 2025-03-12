// ==UserScript==
// @name         百度网盘视频播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      0.9.0-beta.6
// @description  功能更全，播放更流畅，界面更好看！特色功能主要有: 倍速任意调整，分辨率任意切换，自动加载播放列表，自动加载字幕可加载本地字幕可精细设置字幕样式，声音音质增强音量增大，画面比例调整，色彩饱和度、亮度、对比度调整，......，对常用设置自动记忆，支持移动端网页播放（网盘主页），想你所想，极致播放体验 ...
// @author       You
// @match        http*://yun.baidu.com/s/*
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/wap/home*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/pfile/video*
// @match        https://pan.baidu.com/pfile/mboxvideo*
// @match        https://pan.baidu.com/mbox/streampage*
// @require      https://scriptcat.org/lib/950/^1.0.0/Joysound.js
// @require      https://scriptcat.org/lib/1348/^1.0.6/artPlugins.js
// @require      https://unpkg.com/hls.js@1.5.20/dist/hls.min.js
// @require      https://unpkg.com/artplayer@5.2.2/dist/artplayer.js
// @require      https://unpkg.com/leancloud-storage@4.15.2/dist/av-min.js
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

    var obj = {
        video_page: {
            flag: "",
            file: {},
            filelist: [],
            quality: [],
            adToken: "",
        }
    };

    obj.currentList = function () {
        try {
            var currentList = unsafeWindow.require('system-core:context/context.js').instanceForSystem.list.getCurrentList();
            if (currentList.length) {
                sessionStorage.setItem("currentList", JSON.stringify(currentList));
            }
            else {
                setTimeout(obj.currentList, 500);
            }
        } catch (e) { }

        window.onhashchange = function (e) {
            setTimeout(obj.currentList, 500);
        };
        document.querySelector(".fufHyA") && [ ...document.querySelectorAll(".fufHyA") ].forEach(function (element) {
            element.onclick = function () {
                setTimeout(obj.currentList, 500);
            };
        });
    };

    obj.forcePreview = function () {
        unsafeWindow.jQuery(document).on("click", "#shareqr dd", function () {
            try {
                var selectedFile = unsafeWindow.require('system-core:context/context.js').instanceForSystem.list.getSelected()
                , file = selectedFile[0];
                if (file.category == 1) {
                    var ext = file.server_filename.split(".").pop().toLowerCase();
                    if (["ts", '3gp2','3g2','3gpp','amv','divx','dpg','f4v','m2t','m2ts','m2v','mpe','mpeg','mts','vob','webm','wxp','wxv','vob'].includes(ext)) {
                        window.open("https://pan.baidu.com" + location.pathname + "?fid=" + file.fs_id, "_blank");
                    }
                }
            } catch (error) { }
        });
    };

    obj.playSharePage = function () {
        if (unsafeWindow.require) {
            unsafeWindow.locals.get("file_list", "share_uk", "shareid", "sign", "timestamp", function (file_list, share_uk, shareid, sign, timestamp) {
                if (file_list.length == 1 && file_list[0].category == 1) {
                    obj.startObj().then(function (obj) {
                        obj.video_page.flag = "sharevideo";
                        const { fs_id } = obj.video_page.file = file_list[0]
                        , vip = obj.getVip();
                        obj.video_page.getUrl = function (type) {
                            return "/share/streaming?channel=chunlei&uk=" + share_uk + "&fid=" + fs_id + "&sign=" + sign + "&timestamp=" + timestamp + "&shareid=" + shareid + "&type=" + type + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken;
                        }
                        obj.getAdToken().then(function () {
                            obj.addQuality();
                            obj.addFilelist();
                            obj.initVideoPlayer();
                        });
                    });
                }
                else {
                    obj.currentList();
                    obj.forcePreview();
                }
            });
        }
        else {
        }
    };

    obj.playHomePage = function () {
        unsafeWindow.jQuery(document).ajaxComplete(function (event, xhr, options) {
            var response, requestUrl = options.url;
            if (requestUrl.indexOf("/api/categorylist") >= 0) {
                response = xhr.responseJSON;
                obj.video_page.filelist = response.info || [];
            }
            else if (requestUrl.indexOf("/api/filemetas") >= 0) {
                response = xhr.responseJSON;
                if (response && response.info) {
                    obj.startObj().then(function (obj) {
                        obj.video_page.flag = "playvideo";
                        const { path } = obj.video_page.file = response.info[0]
                        , vip = obj.getVip();
                        obj.video_page.getUrl = function (type) {
                            if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                            return "/api/streaming?path=" + encodeURIComponent(path) + "&app_id=250528&clienttype=0&type=" + type + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken;
                        }
                        obj.getAdToken().then(function () {
                            obj.addQuality();
                            obj.addFilelist();
                            obj.initVideoPlayer();
                        });
                    });
                }
            }
        });
    };

    obj.playPfilePage = function () {
        (function(open) {
            XMLHttpRequest.prototype.open = function () {
                this.addEventListener("load", function(event) {
                    if (this.readyState == 4 && this.status == 200) {
                        var responseURL = this.responseURL;
                        if (responseURL.indexOf("/api/filemetas") > 0) {
                            var response = JSON.parse(this.response);
                            if (response.errno == 0 && Array.isArray(response.info) && response.info.length) {
                                if (response.info.length == 1) {
                                    if (Object.keys(obj.video_page.file).length === 0) {
                                        obj.video_page.file = response.info[0];
                                    }
                                    else {
                                        obj.video_page.filelist = response.info;
                                    }
                                }
                                else {
                                    obj.video_page.filelist = response.info;
                                }
                                if (Object.keys(obj.video_page.file).length && obj.video_page.filelist.length) {
                                    XMLHttpRequest.prototype.open = open;
                                    obj.startObj().then(function (obj) {
                                        obj.video_page.flag = "video";
                                        const { path } = obj.video_page.file
                                        , vip = obj.getVip();
                                        obj.video_page.getUrl = function (type) {
                                            if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                                            return "/api/streaming?path=" + encodeURIComponent(path) + "&app_id=250528&clienttype=0&type=" + type + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
                                        }
                                        obj.getAdToken().then(function () {
                                            obj.addQuality();
                                            obj.addFilelist();
                                            obj.initVideoPlayer();
                                        });
                                    });
                                }
                            }
                        }
                    }
                }, false);
                open.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.open);
    };

    obj.playWapVideoPage = function () {
        const { __vue__ } = document.querySelector(".preview-video") || {};
        if (__vue__) {
            const { videoFile } = __vue__;
            if (videoFile) {
                obj.startObj().then(function (obj) {
                    obj.video_page.flag = "videoView";
                    const { path } = obj.video_page.file = videoFile;
                    obj.video_page.getUrl = function (type) {
                        if (type.includes(1080)) +unsafeWindow.locals?.isVip > 1 || (type = type.replace(1080, 720));
                        return "/rest/2.0/xpan/file?method=streaming&path=" + encodeURIComponent(path) + "&type=" + type;
                    }
                    obj.getAdToken().then(function () {
                        obj.addQuality();
                        obj.addFilelist();
                        obj.initVideoPlayer();
                    });
                });
            }
            else {
                obj.showTip("初始化中，等待页面加载 ...");
                setTimeout(obj.playWapVideoPage, 500);
            }
        }
        else {
            obj.showTip("未找到页面元素，请刷新网页 ...");
        }
    };

    obj.playIMPage = function () {
        (function(open) {
            XMLHttpRequest.prototype.open = function () {
                this.addEventListener("load", function(event) {
                    if (this.readyState == 4 && this.status == 200) {
                        var response, responseURL = this.responseURL;
                        if (responseURL.indexOf("/mbox/msg/mediainfo") > 0) {
                            response = JSON.parse(this.response);
                            if ((response.errno == 0 || response.errno == 133) && response.info) {
                                obj.video_page.adToken = response.adToken;
                                var getParam = function(e, t) {
                                    var o = new RegExp("(?:^|\\?|#|&)" + e + "=([^&#]*)(?:$|&|#)","i"), n = o.exec(t || location.href);
                                    return n ? encodeURI(n[1]) : "";
                                };
                                obj.video_page.file = Object.assign({
                                    to: getParam("to"),
                                    from_uk: getParam("from_uk"),
                                    msg_id: getParam("msg_id"),
                                    fs_id: getParam("fs_id"),
                                    type: getParam("type"),
                                    trans: "",
                                    ltime: response.ltime,
                                }, response.info);
                            }
                        }
                        else if (responseURL.indexOf("/api/filemetas") > 0) {
                            response = JSON.parse(this.response);
                            if (response.errno == 0 && Array.isArray(response.info) && response.info.length) {
                                obj.video_page.filelist = response.info;
                            }
                        }
                        if (Object.keys(obj.video_page.file).length && obj.video_page.filelist.length) {
                            XMLHttpRequest.prototype.open = open;
                            obj.startObj().then(function (obj) {
                                obj.video_page.flag = "mboxvideo";
                                const { to, from_uk, msg_id, fs_id, type, trans, ltime, resolution } = obj.video_page.file;
                                obj.video_page.getUrl = function (stream_type) {
                                    return "/mbox/msg/streaming?to=" + to + "&from_uk=" + from_uk + "&msg_id=" + msg_id + "&fs_id=" + fs_id + "&type=" + type + "&stream_type=" + stream_type + "&trans=" + trans + "&ltime=" + ltime;
                                }
                                obj.getAdToken().then(function () {
                                    obj.addQuality();
                                    obj.addFilelist();
                                    obj.initVideoPlayer();
                                });
                            });
                        }
                    }
                }, false);
                open.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.open);
    };

    obj.initVideoPlayer = function () {
        obj.replaceVideoPlayer().then(function () {
            const { file, filelist, quality, getUrl, adToken } = obj.video_page;
            const { url, type } = quality.find((item) => item.default) || quality[0];
            const options = {
                adToken,
                file,
                filelist,
                quality,
                getUrl,
                url,
                type,
                id: "" + file.fs_id,
                poster: (Object.values(file.thumbs || []).slice(-1)[0] || "").replace(/size=c\d+_u\d+/, "size=c850_u580")
            };
            window.artPlugins.init(options).then((art) => {
                obj.showTip("视频播放器已就绪 ...", "success");
                obj.destroyPlayer();
            });
        });
    };

    obj.replaceVideoPlayer = function () {
        const { flag } = obj.video_page;
        var container, videoNode = document.querySelector("#video-wrap, .vp-video__player, #app .video-content");
        if (videoNode) {
            while (videoNode.nextSibling) {
                videoNode.parentNode.removeChild(videoNode.nextSibling);
            }

            container = document.getElementById("artplayer");
            if (!container) {
                container = document.createElement("div");
                container.setAttribute("id", "artplayer");
                if ([ "videoView" ].includes(flag)) {
                    container.setAttribute("style", "width: 100%; height: 3.75rem;");
                }
                else {
                    container.setAttribute("style", "width: 100%; height: 100%;");
                }
                obj.videoNode = videoNode.parentNode.replaceChild(container, videoNode);
                container.parentNode.style.cssText += 'z-index: auto;'
                return Promise.resolve();
            }
        }
        else {
            obj.showTip("正在替换视频播放器 ...", "loading", 1e3);
            return obj.delay().then(function () {
                return obj.replaceVideoPlayer();
            });
        }
    };

    obj.destroyPlayer = function () {
        var count, id;
        const { flag } = obj.video_page;
        if ([ "sharevideo", "playvideo" ].includes(flag)) {
            unsafeWindow.require.async("file-widget-1:videoPlay/context.js", function (context) {
                id = count = setInterval(function () {
                    var playerInstance = context && context.getContext()?.playerInstance;
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
        }
        else if ([ "video", "mboxvideo" ].includes(flag)) {
            id = count = setInterval(function() {
                var playerInstance = obj.videoNode?.firstChild;
                if (playerInstance && playerInstance.player) {
                    clearInterval(id);
                    playerInstance.player.dispose();
                    playerInstance.player = !1;
                    obj.videoNode = null;
                }
                else if (++count - id > 60) {
                    clearInterval(id);
                }
            }, 500);
        }
    };

    obj.getVip = function () {
        if (unsafeWindow.yunData && !unsafeWindow.yunData.neglect) {
            return 1 === unsafeWindow.yunData.ISSVIP ? 2 : 1 === unsafeWindow.yunData.ISVIP ? 1 : 0;
        }
        if (unsafeWindow.locals) {
            var is_svip = false, is_vip = false;
            if (unsafeWindow.locals.get) {
                is_svip = 1 === +unsafeWindow.locals.get("is_svip");
                is_vip = 1 === +unsafeWindow.locals.get("is_vip");
                return is_svip ? 2 : is_vip ? 1 : 0;
            }
            is_svip = 1 === +unsafeWindow.locals.is_svip;
            is_vip = 1 === +unsafeWindow.locals.is_vip;
            return is_svip ? 2 : is_vip ? 1 : 0;
        }
        return 0;
    };

    obj.getAdToken = function () {
        if (obj.getVip() > 1) {
            return Promise.resolve(obj.video_page.adToken);
        }
        const { getUrl } = obj.video_page;
        const url = getUrl("M3U8_AUTO_480");
        return fetch(url).then(function (response) {
            return response.ok ? response.text() : Promise.reject();
        }).then(function (response) {
            try { response = JSON.parse(response) } catch (e) { }
            if (response && 133 === response.errno && 0 !== response.adTime) {
                obj.video_page.adToken = response.adToken;
            }
            return obj.video_page.adToken;
        });
    };

    obj.addQuality = function () {
        const { file: { resolution }, getUrl, adToken } = obj.video_page;
        const templates = {
            1080: "超清 1080P",
            720: "高清 720P",
            480: "流畅 480P",
            360: "省流 360P"
        };
        const freeList = obj.freeList(resolution);
        obj.video_page.quality = freeList.map(function (template, index) {
            return {
                html: templates[template],
                url: getUrl("M3U8_AUTO_" + template) + "&adToken=" + encodeURIComponent(adToken),
                default: index === 0,
                type: "hls"
            };
        });
        return obj.video_page.quality;
    };

    obj.freeList = function (e) {
        e = e || "";
        var t = [480, 360]
        , a = e.match(/width:(\d+),height:(\d+)/) || ["", "", ""]
        , i = +a[1] * +a[2];
        return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t;
    };

    obj.addFilelist = function () {
        const { flag, file, filelist } = obj.video_page;
        const { path } = file;
        if ([ "sharevideo" ].includes(flag)) {
            const currentList = JSON.parse(sessionStorage.getItem("currentList") || "[]");
            if (currentList.length) {
                currentList.forEach(function (item) {
                    if (item.category == 1) {
                        item.name = item.server_filename;
                        item.open = function () {
                            location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + item.fs_id;
                        }
                        filelist.push(item);
                    }
                });
            }
        }
        else if ([ "playvideo" ].includes(flag)) {
            filelist.forEach(function (item, index) {
                item.name = item.server_filename;
                item.open = function () {
                    location.href = "https://pan.baidu.com" + location.pathname + "#/video?path=" + encodeURIComponent(item.path) + "&t=" + index;
                }
            });
        }
        else if ([ "video", "mboxvideo" ].includes(flag)) {
            filelist.forEach(function (item) {
                item.name = item.server_filename;
                item.open = function () {
                    location.href = "https://pan.baidu.com/pfile/video?path=" + encodeURIComponent(item.path);
                }
            });
        }

        (filelist.find(function (item, index) {
            return item.fs_id == file.fs_id;
        }) || {}).default = true;
    };

    obj.startObj = function () {
        return Promise.resolve(GM_info).then((info) => {
            if (info) {
                const { script: { version } } = info;
                const lobjls = GM_getValue(version, 0)
                const length = Object.values(Object.assign({}, obj, window.artPlugins, {alert})).reduce(function (prev, cur) {
                    return (prev += cur?cur.toString().length:0);
                }, 0);
                return lobjls ? lobjls === length ? obj : {} : (GM_setValue(version, length), obj);
            }
            return obj;
        });
    };

    obj.ready = function (state = 3) {
        return new Promise(function (resolve) {
            var states = ["uninitialized", "loading", "loaded", "interactive", "complete"];
            state = Math.min(state, states.length - 1)
            if (states.indexOf(document.readyState) >= state) {
                window.setTimeout(resolve);
            }
            else {
                document.onreadystatechange = function () {
                    if (states.indexOf(document.readyState) >= state) {
                        document.onreadystatechange = null;
                        window.setTimeout(resolve);
                    }
                };
            }
        });
    };

    obj.delay = function (ms = 200) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    obj.showTip = function (content, type, durtime) {
        if (unsafeWindow.require) {
            const show = unsafeWindow.require("system-core:system/uiService/tip/tip.js").show;
            if (typeof content === 'object') {
                show(content);
            }
            else {
                show({
                    vipType: "svip",
                    mode: type,
                    msg: content
                });
            }
        }
        else if (unsafeWindow.toast) {
            if (typeof content === 'object') {
                unsafeWindow.toast.show(content);
            }
            else {
                unsafeWindow.toast.show({
                    message: content,
                    type: type,
                    duration: durtime || 3e3
                });
            }
        }
        else if (unsafeWindow.$bus) {
            if (typeof content === 'object') {
                unsafeWindow.$bus.$Toast.addToast(content);
            }
            else {
                unsafeWindow.$bus.$Toast.addToast({
                    content: content,
                    type: type || "tip",
                    durtime: durtime || 3e3
                });
            }
        }
        else if (unsafeWindow.VueApp) {
            if (["loading", "success", "error", "tip"].indexOf(type) == -1) {
                unsafeWindow.VueApp.$Toast.addToast(content);
            }
            else {
                unsafeWindow.VueApp.$Toast.addToast({
                    content: content,
                    type: type,
                    durtime: durtime || 3e3
                });
            }
        }
    };

    obj.run = function () {
        var url = location.href;
        if (url.indexOf(".baidu.com/s/") > 0) {
            obj.ready().then(function () {
                obj.playSharePage();
            });
        }
        else if (url.indexOf(".baidu.com/play/video#/video") > 0) {
            obj.ready().then(function () {
                obj.playHomePage();
            });
            window.onhashchange = function (e) {
                location.reload();
            };
        }
        else if (url.indexOf(".baidu.com/pfile/video") > 0) {
            obj.playPfilePage();
            obj.ready(4).then(function () {
                const { $router } = document.getElementById("app").__vue_app__.config.globalProperties;
                $router.isReady().then(function () {
                    $router.afterEach(function (to, from) {
                        from.fullPath === "/" || from.fullPath === to.fullPath || location.reload();
                    });
                });
            });
        }
        else if (url.indexOf(".baidu.com/wap") > 0) {
            obj.ready(4).then(function () {
                const { $router } = document.getElementById("app").__vue__;
                $router.onReady(function () {
                    const { currentRoute } = $router;
                    if (currentRoute && currentRoute.name === "videoView") {
                        obj.playWapVideoPage();
                    }
                    $router.afterEach(function (to, from) {
                        if (to.name !== from.name) {
                            obj.video_page.flag = to.name;
                            if (to.name === "videoView") {
                                location.reload();
                            }
                        }
                    });
                });
            });
        }
        else if (url.indexOf(".baidu.com/pfile/mboxvideo") > 0) {
            obj.playIMPage();
            obj.ready(4).then(function () {
                const { $router } = document.getElementById("app").__vue_app__.config.globalProperties;
                $router.isReady().then(function () {
                    $router.afterEach(function (to, from) {
                        from.fullPath === "/" || from.fullPath === to.fullPath || location.reload();
                    });
                });
            });
        }
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
