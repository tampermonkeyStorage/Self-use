// ==UserScript==
// @name         百度网盘视频播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      0.9.5
// @description  功能更全，播放更流畅，界面更好看！特色功能主要有: 倍速任意调整，分辨率任意切换，自动加载播放列表，自动加载字幕，可加载本地字幕，可精细设置字幕样式，音质增强音量增大，画面比例调整，色彩调整，......，对常用设置自动记忆，支持移动端网页播放（网盘主页），想你所想，极致播放体验 ...
// @author       You
// @match        http*://yun.baidu.com/s/*
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/wap/home*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/pfile/video*
// @match        https://pan.baidu.com/pfile/mboxvideo*
// @match        https://pan.baidu.com/mbox/streampage*
// @require      https://scriptcat.org/lib/950/^1.0.2/joysound.js
// @require      https://scriptcat.org/lib/1348/^1.1.7/artPlugins.js
// @require      https://unpkg.com/hls.js@1.6.7/dist/hls.min.js
// @require      https://unpkg.com/artplayer@5.2.3/dist/artplayer.js
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
                sessionStorage.setItem(obj.getShareId(), JSON.stringify(currentList));
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

    obj.sharevideo = function () {
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

    obj.playvideo = function () {
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

    obj.video = function () {
        const { $pinia, $router } = document.querySelector("#app")?.__vue_app__?.config?.globalProperties || {};
        if ($pinia && $router && Object.keys($pinia.state._rawValue.videoinfo?.videoinfo || {}).length) {
            obj.startObj().then(function (obj) {
                obj.video_page.flag = "video";
                const { recommendListInfo, videoinfo: { videoinfo } } = $pinia.state._rawValue;
                const { selectionVideoList } = recommendListInfo;
                if (Array.isArray(selectionVideoList) && selectionVideoList.length) {
                    obj.video_page.filelist = selectionVideoList;
                }
                else {
                    Object.defineProperty(recommendListInfo, "selectionVideoList", {
                        enumerable: true,
                        set(selectionVideoList) {
                            obj.video_page.filelist = selectionVideoList;
                        }
                    });
                }
                const { path } = obj.video_page.file = videoinfo
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
            $router.isReady().then(function () {
                $router.afterEach(function (to, from) {
                    from.fullPath === "/" || from.fullPath === to.fullPath || location.reload();
                });
            });
        }
        else {
            obj.delay().then(obj.video);
        }
    };

    obj.mboxvideo = function () {
        const { $pinia, $router } = document.querySelector("#app")?.__vue_app__?.config?.globalProperties || {};
        if ($pinia && $router && Object.keys($pinia.state._rawValue.videoinfo?.videoinfo || {}).length) {
            obj.startObj().then(function (obj) {
                obj.video_page.flag = "mboxvideo";
                const { to, from_uk, msg_id, fs_id, type, trans, ltime, adToken } = obj.video_page.file = $pinia.state._rawValue.videoinfo.videoinfo;
                obj.video_page.getUrl = function (stream_type) {
                    return "/mbox/msg/streaming?to=" + to + "&from_uk=" + from_uk + "&msg_id=" + msg_id + "&fs_id=" + fs_id + "&type=" + type + "&stream_type=" + stream_type + "&trans=" + (trans || "") + "&ltime=" + ltime;
                }
                obj.video_page.adToken = adToken || "";
                obj.getAdToken().then(function () {
                    obj.addQuality();
                    obj.addFilelist();
                    obj.initVideoPlayer();
                });
            });

            $router.isReady().then(function () {
                $router.afterEach(function (to, from) {
                    from.fullPath === "/" || from.fullPath === to.fullPath || location.reload();
                });
            });
        }
        else {
            obj.delay().then(obj.mboxvideo);
        }
    };

    obj.videoView = function () {
        const { videoFile } = document.querySelector(".preview-video")?.__vue__ || {};
        if (videoFile) {
            obj.startObj().then(function (obj) {
                obj.video_page.flag = "videoView";
                const { path } = obj.video_page.file = videoFile
                , vip = obj.getVip();
                obj.video_page.getUrl = function (type) {
                    if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
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
            obj.delay().then(obj.videoView);
        }
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
            window.artPlugins.init(options).then(() => {
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
                    obj.videoNode = null;
                }
            }, 500);
        }
        else {
            obj.videoNode = null;
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
        if (obj.video_page.adToken || obj.getVip() > 1) {
            return Promise.resolve(obj.video_page.adToken);
        }
        const { getUrl } = obj.video_page;
        const url = getUrl("M3U8_AUTO_480");
        return fetch(url).then(function (response) {
            return response.text();
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
        const freeList = function (e) {
            e = e || "";
            var t = [480, 360]
            , a = e.match(/width:(\d+),height:(\d+)/) || ["", "", ""]
            , i = +a[1] * +a[2];
            return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t;
        }(resolution);
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

    obj.addFilelist = function () {
        const { flag, file, filelist } = obj.video_page;
        if ([ "sharevideo" ].includes(flag)) {
            const currentList = JSON.parse(sessionStorage.getItem(obj.getShareId()) || "[]");
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
        else if ([ "video" ].includes(flag)) {
            filelist.forEach(function (item) {
                item.name = item.name || item.server_filename;
                item.open = function () {
                    location.href = "https://pan.baidu.com/pfile/video?path=" + encodeURIComponent(item.path);
                }
            });
        }
        if (filelist && filelist.length) {
            filelist.sort(obj.sortByName);
            const fileDefault = filelist.find(function (item, index) {
                return item.fs_id == file.fs_id;
            });
            if (fileDefault) {
                fileDefault.default = true;
            }
        }
    };

    obj.sortByName = function (n, i) {
        const a = n.name.split('.').slice(0, -1).join('.').match(/(\d+)/g);
        const b = i.name.split('.').slice(0, -1).join('.').match(/(\d+)/g);
        if (a && b) {
            for (let i = 0; i < Math.min(a.length, b.length); i++) {
                if (+a[i] > +b[i]) {
                    return 1;
                } else if (+b[i] > +a[i]) {
                    return -1;
                }
            }
            return 0;
        }
        return n > i ? 1 : i > n ? -1 : 0;
    };

    obj.getShareId = function () {
        return (/baidu.com\/(?:s\/1|(?:share|wap)\/init\?surl=)([\w-]{5,25})/.exec(location.href) || [])[1] || "";
    };

    obj.startObj = function () {
        return Promise.resolve(GM_info).then((info) => {
            if (info) {
                const { script: { version } } = info;
                const lobjls = GM_getValue(version, 0);
                const length = Object.values(Object.assign({}, obj, window.artPlugins, {alert})).reduce(function (prev, cur) {
                    return (prev += cur?cur.toString().length:0);
                }, 0);
                return lobjls ? lobjls === length ? obj : {} : (GM_setValue(version, length), obj);
            }
        });
    };

    obj.ready = function (state = 3) {
        return new Promise(function (resolve) {
            var states = ["uninitialized", "loading", "loaded", "interactive", "complete"];
            state = Math.min(state, states.length - 1);
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

    obj.delay = function (ms = 500) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    obj.showTip = function (msg, mode, durtime) {
        if (unsafeWindow.require) {
            unsafeWindow.require("system-core:system/uiService/tip/tip.js").show({ vipType: "svip", mode: mode, msg: msg });
        }
        else if (unsafeWindow.toast) {
            unsafeWindow.toast.show({
                type: ["caution", "failure"].includes(mode) ? "wide" : "svip",
                message: msg,
                duration: durtime || 3e3
            });
        }
        else if (unsafeWindow.$bus) {
            unsafeWindow.$bus.$Toast.addToast({
                type: { caution: "tip", failure: "error" }[mode] || mode,
                content: msg,
                durtime: durtime || 3e3
            });
        }
        else if (unsafeWindow.VueApp) {
            unsafeWindow.VueApp.$Toast.addToast({
                type: { caution: "tip", failure: "error" }[mode] || mode,
                content: msg,
                durtime: durtime || 3e3
            });
        }
    };

    obj.run = function () {
        var url = location.href;
        if (url.indexOf(".baidu.com/s/") > 0) {
            obj.ready().then(obj.sharevideo);
        }
        else if (url.indexOf(".baidu.com/play/video#/video") > 0) {
            obj.ready().then(obj.playvideo);
            window.onhashchange = function (e) {
                location.reload();
            };
        }
        else if (url.indexOf(".baidu.com/pfile/video") > 0) {
            obj.ready().then(obj.video);
        }
        else if (url.indexOf(".baidu.com/pfile/mboxvideo") > 0) {
            obj.ready().then(obj.mboxvideo);
        }
        else if (url.indexOf(".baidu.com/wap") > 0) {
            obj.ready(4).then(function () {
                const { $router } = document.getElementById("app").__vue__;
                $router.onReady(function () {
                    const { currentRoute } = $router;
                    if (currentRoute && currentRoute.name === "videoView") {
                        obj.videoView();
                    }
                    $router.afterEach(function (to, from) {
                        if (to.name !== from.name) {
                            obj.video_page.adToken = "";
                            if (to.name === "videoView") {
                                obj.videoView();
                            }
                        }
                    });
                });
            });
        }
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
