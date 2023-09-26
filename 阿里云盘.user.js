// ==UserScript==
// @name         阿里云盘
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      4.2.2
// @description  支持生成文件下载链接（多种下载姿势），支持第三方播放器DPlayer（支持自动/手动添加字幕，突破视频2分钟限制，选集，上下集，自动记忆播放，跳过片头片尾, 字幕设置随心所欲...），...
// @author       You
// @match        https://www.aliyundrive.com/*
// @connect      aliyundrive.com
// @connect      aliyuncs.com
// @connect      lc-cn-n1-shared.com
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
// @require      https://scriptcat.org/lib/950/^1.0.1/Joysound.js
// @require      //https://scriptcat.org/lib/1286/^1.0.1/dpPlugins.js
// @require      https://cdn.staticfile.org/jquery/3.6.0/jquery.min.js
// @require      https://cdn.staticfile.org/hls.js/1.4.12/hls.min.js
// @require      https://cdn.staticfile.org/dplayer/1.27.1/DPlayer.min.js
// @require      https://cdn.staticfile.org/m3u8-parser/7.1.0/m3u8-parser.min.js
// @require      https://cdn.staticfile.org/localforage/1.10.0/localforage.min.js
// @icon         https://gw.alicdn.com/imgextra/i3/O1CN01aj9rdD1GS0E8io11t_!!6000000000620-73-tps-16-16.ico
// @antifeature  ads
// @antifeature  membership
// @antifeature  payment
// @antifeature  referral-link
// @antifeature  tracking
// @run-at       document-body
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    var $ = $ || window.$;
    var obj = {
        errNum: 0,
        headers: {},
        file_page: {
            send_params: {},
            items: []
        },
        video_page: {
            video_info: {},
            video_items: []
        }
    };

    obj.httpListener = function () {
        (function(send) {
            XMLHttpRequest.prototype.send = function (sendParams) {
                this.addEventListener("load", function(event) {
                    if (this.readyState == 4 && this.status == 200) {
                        var response = this.response || this.responseText, responseURL = this.responseURL;
                        if (responseURL.endsWith("/users/device/create_session") || responseURL.endsWith("/users/device/renew_session")) {
                            obj.headers = this._header_;
                        }
                        else if (responseURL.indexOf("/file/list") > 0 || responseURL.indexOf("/file/search") > 0) {
                            if (this._header_.hasOwnProperty("x-signature")) {
                                obj.headers = this._header_;
                            }
                            obj.initFilesInfo(sendParams, response);
                        }
                        else if (responseURL.indexOf("/file/get_video_preview_play_info") > 0) {
                            obj.initPlayInfo(response);
                            if (obj.isSharePage()) {
                                obj.getPlayInfo((response) => {
                                    if (response instanceof Object) {
                                        obj.initPlayInfo(response);
                                        obj.initDPlayer();
                                    }
                                });
                                return;
                            }
                            obj.initDPlayer();
                        }
                    }
                }, false);
                send.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.send);
    };

    obj.initDPlayer = function () {
        var container, videoNode = document.querySelector("video");
        if (videoNode) {
            container = document.getElementById("dplayer");
            if (!container) {
                container = document.createElement("div");
                container.setAttribute("id", "dplayer");
                container.setAttribute("style", "width: 100%; height: 100%;");
                var videoParentNode = videoNode.parentNode.parentNode;
                videoParentNode.parentNode.replaceChild(container, videoParentNode);
            }
            else {
                if (window.player) {
                    const quality = obj.getQuality();
                    window.player.options.video.quality = quality;
                    window.player.quality = quality[ obj.getDefaultQuality(quality) ];
                    window.player.events.trigger('episode_end');
                }
                return;
            }
        }

        const quality = obj.getQuality();
        const defaultQuality = obj.getDefaultQuality(quality);
        if (!quality.length) {
            return obj.showTipError("获取播放信息失败：请刷新网页重试");
        }

        try {
            var notice = window.DPlayer.prototype.notice;
            window.DPlayer.prototype.notice = function (text, time, opacity, id = "default") {
                notice.call(this, text, time, opacity, id);
            };

            const player = window.player = new window.DPlayer({
                container: container,
                video: {
                    quality: quality,
                    defaultQuality: defaultQuality,
                    customType: {
                        hls: function (video, player) {
                            const Hls = window.Hls;
                            if (Hls.isSupported()) {
                                const hls = new Hls({
                                    maxBufferLength: 30 * 2,
                                });
                                hls.loadSource(video.src);
                                hls.attachMedia(video);
                                player.plugins.hls = hls;
                            }
                            else {
                                this.notice('Error: Hls is not supported.');
                            }
                        },
                    }
                },
                subtitle: {
                    url: [],
                    defaultSubtitle: 0,
                    type: "webvtt",
                    fontSize: (localStorage.getItem("dplayer-subtitle-fontSize") || 5) + "vh",
                    bottom: (localStorage.getItem("dplayer-subtitle-bottom") || 10) + "%",
                    color: localStorage.getItem("dplayer-subtitle-color") || "#ffd821",
                },
                subtitles: [],
                file: obj.video_page.video_info,
                fileList: obj.video_page.video_items,
                autoplay: true,
                screenshot: true,
                hotkey: true,
                airplay: true,
                volume: 1.0,
                playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4],
                contextmenu: [
                    {
                        text: "👍 爱发电 不再弹出 👍",
                        link: "https://afdian.net/order/create?plan_id=be4f4d0a972811eda14a5254001e7c00",
                        click: obj.showDialog
                    }
                ],
                theme: obj.getRandomColor()
            });
            if (window.dpPlugins) {
                window.dpPlugins.init(player, obj);

                if (!player.events.type('subtitle_start')) {
                    player.events.playerEvents.push('subtitle_start');
                }
                player.on('subtitle_start', () => {
                    obj.getFolderSubtitle().then((subtitleFiles) => {
                        const sublist = subtitleFiles.filter((item) => item.download_url || item.url);
                        player.options.subtitles = obj.getVideoInfoSubtitle().concat(sublist);
                        player.events.trigger('subtitle_end');
                    }).catch(() => {
                        player.options.subtitles = obj.getVideoInfoSubtitle();
                        player.events.trigger('subtitle_end');
                    });
                });

                if (!player.events.type('video_start')) {
                    player.events.playerEvents.push('video_start');
                }
                player.on('video_start', () => {
                    obj.getPlayInfo((response) => {
                        if (response instanceof Object) {
                            obj.initPlayInfo(response);
                            const quality = obj.getQuality();
                            player.options.video.quality = quality;
                            player.quality = quality[ player.qualityIndex ] || quality[ obj.getDefaultQuality(quality) ];
                            player.events.trigger('video_end');
                        }
                    });
                });

                if (!player.events.type('episode_start')) {
                    player.events.playerEvents.push('episode_start');
                }
                player.on('episode_start', () => {
                    obj.video_page.video_info = player.options.fileList[player.fileIndex];
                    obj.getPlayInfo((response) => {
                        if (response instanceof Object) {
                            obj.initPlayInfo(response);
                            const quality = obj.getQuality();
                            player.options.video.quality = quality;
                            player.quality = quality[ obj.getDefaultQuality(quality) ];
                            document.querySelector("[class^=header-file-name], [class^=header-center] div span").innerText = player.options.file.name;
                            player.events.trigger('episode_end');
                        }
                    });
                });
            }

            $("#root > div.modal--nw7G9 > div > div.content--9N3Eh > div.header--u7XR- > div.header-left--Kobd9").one("click", function () {
                console.info("VideoPreviewer exit");
                player.destroy();
            });
        } catch (error) {
            console.error("播放器创建错误", error);
        }
    };

    obj.getQuality = function (live_task_list) {
        var task_list = live_task_list || obj.video_page.video_info?.video_preview_play_info?.live_transcoding_task_list || [];
        if (Array.isArray(task_list) && task_list.length) {
            task_list = task_list.filter(item => item.url);
            var templates = {
                UHD: "4K 超清",
                QHD: "2K 超清",
                FHD: "1080 全高清",
                HD: "720 高清",
                SD: "540 标清",
                LD: "360 流畅"
            };
            task_list.forEach(function (item, index) {
                Object.assign(item, {
                    name: templates[item.template_id],
                    type: "hls"
                });
            });
            return task_list;
        }
        return [];
    };

    obj.getDefaultQuality = function (quality = []) {
        if (Array.isArray(quality) && quality.length) {
            const localDefault = localStorage.getItem("dplayer-defaultQuality");
            if (localDefault) {
                const index = quality.findIndex((item) => item.name == localDefault);
                return index < 0 ? quality.length - 1 : index;
            }
            return quality.length - 1;
        }
        return quality.length - 1;
    };

    obj.getVideoInfoSubtitle = function (subtitle_task_list) {
        var task_list = subtitle_task_list || obj.video_page.video_info?.video_preview_play_info?.live_transcoding_subtitle_task_list || [];
        if (Array.isArray(task_list) && task_list.length) {
            var templates = {
                jpn: "日文字幕",
                chi: "中文字幕",
                eng: "英文字幕"
            };
            task_list.forEach(function (item, index) {
                Object.assign(item, {
                    type: "vtt",
                    name: templates[item.language] || item.name || "未知语言",
                    lang: item.language
                });
            });
            return task_list;
        }
        return [];
    };

    obj.getFolderSubtitle = function () {
        const sublist = obj.searchSubtitleFiles();
        if (sublist.length) {
            return obj.getDownloadUrl(sublist);
        }
        else {
            return Promise.reject();
        }
    };

    obj.searchSubtitleFiles = function () {
        const extensions = ["webvtt", "vtt", "srt", "ssa", "ass"];
        const subfileList = obj.file_page.items.filter(function (item) {
            return item.type === "file" && extensions.includes(item.file_extension.toLowerCase());
        });
        if (subfileList.length) {
            const videofileList = obj.file_page.items.filter(function (item) {
                return item.type === "file" && item.category == "video";
            });
            if (videofileList.length === 1) {
                return subfileList;
            }
            var filterSubFile = [];
            var videoName = obj.video_page.video_items.find((item) => {
                return item.file_id === obj.video_page.video_info.file_id;
            })?.name;
            videoName && (videoName = videoName.split('.').slice(0, -1).join(".").toLowerCase());
            while (videoName) {
                filterSubFile = subfileList.filter((item) => {
                    const fileName = item.name.replace("." + item.file_extension, "").toLowerCase();
                    return fileName.includes(videoName) || videoName.includes(fileName);
                });
                if (filterSubFile.length) {
                    break
                }
                videoName = videoName.split('.').slice(0, -1).join(".").toLowerCase();
            }
            return filterSubFile;
        }
        return [];
    };

    obj.initFilesInfo = function (sendParams, response) {
        const { send_params, } = obj.file_page;
        try { sendParams = JSON.parse(sendParams) } catch (error) { };
        try { response = JSON.parse(response) } catch (error) { };
        if (sendParams instanceof Object && response instanceof Object) {
            const { order_by, order_direction, parent_file_id } = sendParams || {};
            if (!(order_by === send_params.order_by && order_direction === send_params.order_direction && parent_file_id === send_params.parent_file_id)) {
                obj.file_page.items = [];
            }
            obj.file_page.send_params = sendParams;
            obj.file_page.items.find((item) => item?.file_id === response.items[0]?.file_id) || (obj.file_page.items = obj.file_page.items.concat(response.items));
            obj.showTipSuccess("文件列表获取完成 共：" + obj.file_page.items.length + "项");

            if (obj.file_page.items.length) {
                obj.isHomePage() ? obj.initDownloadHomePage() : obj.initDownloadSharePage();
            }
        }
    };

    obj.initPlayInfo = function (response) {
        try { response = JSON.parse(response) } catch (error) { };
        if (response instanceof Object) {
            obj.video_page.video_info = response;

            if (obj.video_page.video_items.length === 0) {
                obj.video_page.video_items = obj.file_page.items.filter(function (item, index) {
                    return item.type == "file" && item.category == "video";
                });
            }
        }
    };

    obj.getPlayInfo = function (callback) {
        obj.get_video_play_info().then ((response) => {
            callback && callback(response);
        }, () => {
            obj.create_session().then(() => {
                setTimeout(() => {
                    obj.get_video_play_info().then((response) => {
                        callback && callback(response);
                    }, (error) => {
                        callback && callback("");
                    });
                }, 500);
            });
        });
    };

    obj.get_video_play_info = function () {
        return obj.refresh_token().then (() => {
            return obj.isHomePage() ? obj.get_video_preview_play_info() : obj.get_share_token().then(() => {
                return obj.get_share_link_video_preview_play_info();
            });
        });
    };

    obj.get_video_preview_play_info = function () {
        const { token_type, access_token } = obj.getItem("token");
        const { drive_id, file_id } = obj.video_page.video_info;
        const { "x-device-id": x_id, "x-signature": x_signature } = obj.headers;
        return fetch("https://api.aliyundrive.com/v2/file/get_video_preview_play_info", {
            body: JSON.stringify({
                category: "live_transcoding",
                drive_id: drive_id,
                file_id: file_id,
                template_id: "",
                get_subtitle_info: !0
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8",
                "x-device-id": x_id || obj.getItem("cna") || obj.uuid(),
                "x-signature": x_signature
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        }).then((response) => {
            return response;
        });
    };

    obj.get_share_link_video_preview_play_info = function () {
        const { file_id, share_id } = obj.video_page.video_info;
        const { token_type, access_token } = obj.getItem("token");
        const { share_token } = obj.getItem("shareToken");
        const { "x-device-id": x_id, "x-signature": x_signature } = obj.headers;
        return fetch("https://api.aliyundrive.com/v2/file/get_share_link_video_preview_play_info", {
            body: JSON.stringify({
                category: "live_transcoding",
                file_id: file_id,
                get_preview_url: true,
                share_id: share_id || obj.getShareId(),
                template_id: "",
                get_subtitle_info: !0
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8",
                "x-share-token": share_token,
                "x-device-id": x_id || obj.getItem("cna") || obj.uuid(),
                "x-signature": x_signature
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        }).then((response) => {
            return response;
        });
    };

    obj.create_session = function () {
        return obj.secp256k1Support().then (function () {
            const { device_id, user_id, token_type, access_token } = obj.getItem("token");
            const { crypto, Secp256k1, Global: { app_id } } = unsafeWindow;
            const privateKeyBuf = crypto.getRandomValues(new Uint8Array(32));
            const privateKey = Secp256k1.uint256(privateKeyBuf, 16);
            const publicKey = Secp256k1.generatePublicKeyFromPrivateKeyData(privateKey);
            const pubKey = "04" + publicKey.x + publicKey.y;
            const nonce = 0;
            const encoder = new TextEncoder();
            const data = encoder.encode(`${app_id}:${device_id}:${user_id}:${nonce}`);
            return crypto.subtle.digest("SHA-256", data).then(function (hashBuffer) {
                const hashUint8 = new Uint8Array(hashBuffer);
                const digest = Secp256k1.uint256(hashUint8, 16);
                const sig = Secp256k1.ecsign(privateKey, digest);
                const signature = sig.r + sig.s + "00";
                const { "x-device-id": x_id } = obj.headers;
                return new Promise(function (resolve, reject) {
                    $.ajax({
                        type: "post",
                        url: "https://api.aliyundrive.com/users/v1/users/device/create_session",
                        data: JSON.stringify({
                            deviceName: obj.getBrowser().browser.name + "浏览器",
                            modelName: obj.getBrowser().os.name + "网页版",
                            pubKey: pubKey
                        }),
                        headers: {
                            "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                            "content-type": "application/json;charset=utf-8",
                            "x-device-id": obj.getItem("cna"),
                            "x-signature": signature
                        },
                        success: function (response) {
                            resolve(response.result);
                        },
                        error: function (error) {
                            reject(error);
                        }
                    });
                });
            });
        });
    };

    obj.secp256k1Support = function () {
        return obj.loadJs("https://unpkg.com/bn.js/lib/bn.js").then(() => {
            return obj.loadJs("https://unpkg.com/@lionello/secp256k1-js/src/secp256k1.js");
        });
    };

    obj.getBrowser = function () {
        return obj.browser || function(i, o) {
            var n = i.navigator && i.navigator.userAgent ? i.navigator.userAgent : ""
            , l = "object"
            , a = "function"
            , c = "string"
            , p = "version"
            , d = "name"
            , F = "Facebook"
            , k = "BlackBerry"
            , U = {
                ME: "4.90",
                "NT 3.11": "NT3.51",
                "NT 4.0": "NT4.0",
                2e3: "NT 5.0",
                XP: ["NT 5.1", "NT 5.2"],
                Vista: "NT 6.0",
                7: "NT 6.1",
                8: "NT 6.2",
                8.1: "NT 6.3",
                10: ["NT 6.4", "NT 10.0"],
                RT: "ARM"
            }
            , z = function (e, t) {
                for (var n in t) {
                    if (typeof t[n] === l && t[n].length > 0) {
                        for (var r = 0; r < t[n].length; r++) {
                            if (R(t[n][r], e)) {
                                return "?" === n ? o : n;
                            }
                        }
                    } else if (R(t[n], e)) {
                        return "?" === n ? o : n;
                    }
                }
                return e;
            }
            , R = function (e, t) {
                return typeof e === c && -1 !== L(t).indexOf(L(e));
            }
            , L = function (e) {
                return e.toLowerCase();
            }
            , Z = function (e, t) {
                for (var n, r, i, s, c, u, d = 0; d < t.length && !c; ) {
                    var f = t[d], h = t[d + 1];
                    for (n = r = 0; n < f.length && !c; ) {
                        if (c = f[n++].exec(e)) {
                            for (i = 0; i < h.length; i++) {
                                u = c[++r];
                                typeof (s = h[i]) === l && s.length > 0 ? 2 === s.length ? typeof s[1] == a ? this[s[0]] = s[1].call(this, u) : this[s[0]] = s[1] : 3 === s.length ? typeof s[1] !== a || s[1].exec && s[1].test ? this[s[0]] = u ? u.replace(s[1], s[2]) : o : this[s[0]] = u ? s[1].call(this, u, s[2]) : o : 4 === s.length && (this[s[0]] = u ? s[3].call(this, u.replace(s[1], s[2])) : o) : this[s] = u || o;
                            }
                        }
                    }
                    d += 2;
                }
            }
            , r = {
                browser: [
                    [/\b(?:crmo|crios)\/([\w\.]+)/i],
                    [p, [d, "Chrome"]],
                    [/edg(?:e|ios|a)?\/([\w\.]+)/i],
                    [p, [d, "Edge"]],
                    [/(opera mini)\/([-\w\.]+)/i, /(opera [mobiletab]{3,6})\b.+version\/([-\w\.]+)/i, /(opera)(?:.+version\/|[\/ ]+)([\w\.]+)/i],
                    [d, p],
                    [/opios[\/ ]+([\w\.]+)/i],
                    [p, [d, "Opera Mini"]],
                    [/\bopr\/([\w\.]+)/i],
                    [p, [d, "Opera"]],
                    [/(kindle)\/([\w\.]+)/i, /(lunascape|maxthon|netfront|jasmine|blazer)[\/ ]?([\w\.]*)/i, /(avant |iemobile|slim)(?:browser)?[\/ ]?([\w\.]*)/i, /(ba?idubrowser)[\/ ]?([\w\.]+)/i, /(?:ms|\()(ie) ([\w\.]+)/i, /(flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon|rekonq|puffin|brave|whale|qqbrowserlite|qq)\/([-\w\.]+)/i, /(weibo)__([\d\.]+)/i],
                    [d, p],
                    [/(?:\buc? ?browser|(?:juc.+)ucweb)[\/ ]?([\w\.]+)/i],
                    [p, [d, "UCBrowser"]],
                    [/\bqbcore\/([\w\.]+)/i],
                    [p, [d, "WeChat(Win) Desktop"]],
                    [/micromessenger\/([\w\.]+)/i],
                    [p, [d, "WeChat"]],
                    [/konqueror\/([\w\.]+)/i],
                    [p, [d, "Konqueror"]],
                    [/trident.+rv[: ]([\w\.]{1,9})\b.+like gecko/i],
                    [p, [d, "IE"]],
                    [/yabrowser\/([\w\.]+)/i],
                    [p, [d, "Yandex"]],
                    [/(avast|avg)\/([\w\.]+)/i],
                    [[d, /(.+)/, "$1 Secure Browser"], p],
                    [/\bfocus\/([\w\.]+)/i],
                    [p, [d, "Firefox Focus"]],
                    [/\bopt\/([\w\.]+)/i],
                    [p, [d, "Opera Touch"]],
                    [/coc_coc\w+\/([\w\.]+)/i],
                    [p, [d, "Coc Coc"]],
                    [/dolfin\/([\w\.]+)/i],
                    [p, [d, "Dolphin"]],
                    [/coast\/([\w\.]+)/i],
                    [p, [d, "Opera Coast"]],
                    [/miuibrowser\/([\w\.]+)/i],
                    [p, [d, "MIUI Browser"]],
                    [/fxios\/([-\w\.]+)/i],
                    [p, [d, "Firefox"]],
                    [/\bqihu|(qi?ho?o?|360)browser/i],
                    [[d, "360 Browser"]],
                    [/(oculus|samsung|sailfish)browser\/([\w\.]+)/i],
                    [[d, /(.+)/, "$1 Browser"], p],
                    [/(comodo_dragon)\/([\w\.]+)/i],
                    [[d, /_/g, " "], p],
                    [/(electron)\/([\w\.]+) safari/i, /(tesla)(?: qtcarbrowser|\/(20\d\d\.[-\w\.]+))/i, /m?(qqbrowser|baiduboxapp|2345Explorer)[\/ ]?([\w\.]+)/i],
                    [d, p],
                    [/(metasr)[\/ ]?([\w\.]+)/i, /(lbbrowser)/i],
                    [d],
                    [/((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w\.]+);)/i],
                    [[d, F], p],
                    [/safari (line)\/([\w\.]+)/i, /\b(line)\/([\w\.]+)\/iab/i, /(chromium|instagram)[\/ ]([-\w\.]+)/i],
                    [d, p],
                    [/\bgsa\/([\w\.]+) .*safari\//i],
                    [p, [d, "GSA"]],
                    [/headlesschrome(?:\/([\w\.]+)| )/i],
                    [p, [d, "Chrome Headless"]],
                    [/ wv\).+(chrome)\/([\w\.]+)/i],
                    [[d, "Chrome WebView"], p],
                    [/droid.+ version\/([\w\.]+)\b.+(?:mobile safari|safari)/i],
                    [p, [d, "Android Browser"]],
                    [/(chrome|omniweb|arora|[tizenoka]{5} ?browser)\/v?([\w\.]+)/i],
                    [d, p],
                    [/version\/([\w\.]+) .*mobile\/\w+ (safari)/i],
                    [p, [d, "Mobile Safari"]],
                    [/version\/([\w\.]+) .*(mobile ?safari|safari)/i],
                    [p, d],
                    [/webkit.+?(mobile ?safari|safari)(\/[\w\.]+)/i],
                    [d, [p, z, { "1.0": "/8", 1.2: "/1", 1.3: "/3", "2.0": "/412", "2.0.2": "/416", "2.0.3": "/417", "2.0.4": "/419", "?": "/" }]],
                    [/(webkit|khtml)\/([\w\.]+)/i],
                    [d, p],
                    [/(navigator|netscape\d?)\/([-\w\.]+)/i],
                    [[d, "Netscape"], p],
                    [/mobile vr; rv:([\w\.]+)\).+firefox/i],
                    [p, [d, "Firefox Reality"]],
                    [/ekiohf.+(flow)\/([\w\.]+)/i, /(swiftfox)/i, /(icedragon|iceweasel|camino|chimera|fennec|maemo browser|minimo|conkeror|klar)[\/ ]?([\w\.\+]+)/i, /(seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([-\w\.]+)$/i, /(firefox)\/([\w\.]+)/i, /(mozilla)\/([\w\.]+) .+rv\:.+gecko\/\d+/i, /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir|obigo|mosaic|(?:go|ice|up)[\. ]?browser)[-\/ ]?v?([\w\.]+)/i, /(links) \(([\w\.]+)/i],
                    [d, p]
                ],
                os: [
                    [/microsoft (windows) (vista|xp)/i],
                    [d, p],
                    [/(windows) nt 6\.2; (arm)/i, /(windows (?:phone(?: os)?|mobile))[\/ ]?([\d\.\w ]*)/i, /(windows)[\/ ]?([ntce\d\. ]+\w)(?!.+xbox)/i],
                    [d, [p, z, U]],
                    [/(win(?=3|9|n)|win 9x )([nt\d\.]+)/i],
                    [[d, "Windows"], [p, z, U]],
                    [/ip[honead]{2,4}\b(?:.*os ([\w]+) like mac|; opera)/i, /cfnetwork\/.+darwin/i],
                    [[p, /_/g, "."], [d, "iOS"]],
                    [/(mac os x) ?([\w\. ]*)/i, /(macintosh|mac_powerpc\b)(?!.+haiku)/i],
                    [[d, "Mac OS"], [p, /_/g, "."]],
                    [/droid ([\w\.]+)\b.+(android[- ]x86)/i],
                    [p, d],
                    [/(android|webos|qnx|bada|rim tablet os|maemo|meego|sailfish)[-\/ ]?([\w\.]*)/i, /(blackberry)\w*\/([\w\.]*)/i, /(tizen|kaios)[\/ ]([\w\.]+)/i, /\((series40);/i],
                    [d, p],
                    [/\(bb(10);/i],
                    [p, [d, k]],
                    [/(?:symbian ?os|symbos|s60(?=;)|series60)[-\/ ]?([\w\.]*)/i],
                    [p, [d, "Symbian"]],
                    [/mozilla\/[\d\.]+ \((?:mobile|tablet|tv|mobile; [\w ]+); rv:.+ gecko\/([\w\.]+)/i],
                    [p, [d, "Firefox OS"]],
                    [/web0s;.+rt(tv)/i, /\b(?:hp)?wos(?:browser)?\/([\w\.]+)/i],
                    [p, [d, "webOS"]],
                    [/crkey\/([\d\.]+)/i],
                    [p, [d, "Chromecast"]],
                    [/(cros) [\w]+ ([\w\.]+\w)/i],
                    [[d, "Chromium OS"], p],
                    [/(nintendo|playstation) ([wids345portablevuch]+)/i, /(xbox); +xbox ([^\);]+)/i, /\b(joli|palm)\b ?(?:os)?\/?([\w\.]*)/i, /(mint)[\/\(\) ]?(\w*)/i, /(mageia|vectorlinux)[; ]/i, /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-\/ ]?(?!chrom|package)([-\w\.]*)/i, /(hurd|linux) ?([\w\.]*)/i, /(gnu) ?([\w\.]*)/i, /\b([-frentopcghs]{0,5}bsd|dragonfly)[\/ ]?(?!amd|[ix346]{1,2}86)([\w\.]*)/i, /(haiku) (\w+)/i],
                    [d, p],
                    [/(sunos) ?([\w\.\d]*)/i],
                    [[d, "Solaris"], p],
                    [/((?:open)?solaris)[-\/ ]?([\w\.]*)/i, /(aix) ((\d)(?=\.|\)| )[\w\.])*/i, /\b(beos|os\/2|amigaos|morphos|openvms|fuchsia|hp-ux)/i, /(unix) ?([\w\.]*)/i],
                    [d, p]
                ]
            }
            , getBrowser = function () {
                var e, t = {};
                t.name = o;
                t.version = o;
                Z.call(t, n, r.browser);
                t.major = typeof (e = t.version) === c ? e.replace(/[^\d\.]/g, "").split(".")[0] : o;
                return t;
            }
            , getOS = function () {
                var e = {};
                e.name = o;
                e.version = o;
                Z.call(e, n, r.os);
                return e;
            }
            , getUA = function () {
                return n;
            };

            obj.browser = {
                ua: getUA(),
                browser: getBrowser(),
                os: getOS()
            };
            return obj.browser;
        }("object" == typeof window ? window : unsafeWindow);
    };

    obj.uuid = function () {
        var cna = localStorage.getItem("cna");
        if (cna) return cna;
        for (var i = function(e) {
            return "string" == typeof e && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i.test(e);
        }, s = [], l = 0; l < 256; ++l) s.push((l + 256).toString(16).substr(1));
        return function(e) {
            e[6] = 15 & e[6] | 64;
            e[8] = 63 & e[8] | 128;
            var t = (s[e[(t = 0) + 0]] + s[e[t + 1]] + s[e[t + 2]] + s[e[t + 3]] + "-" + s[e[t + 4]] + s[e[t + 5]] + "-" + s[e[t + 6]] + s[e[t + 7]] + "-" + s[e[t + 8]] + s[e[t + 9]] + "-" + s[e[t + 10]] + s[e[t + 11]] + s[e[t + 12]] + s[e[t + 13]] + s[e[t + 14]] + s[e[t + 15]]).toLowerCase();
            if (!i(t)) return null;
            localStorage.setItem("cna", t);
            return t;
        }(window.crypto.getRandomValues(new Uint8Array(16)));
    };

    /*******************************************************/

    obj.initDownloadHomePage = function () {
        if ($(".button-download--batch").length) {
            return;
        }
        if ($("#root header").length) {
            var html = '<div style="margin:0px 8px;"></div><button class="button--WC7or primary--NVxfK small--e7LRt modal-footer-button--9CQLU button-download--batch">显示链接</button>';
            $("#root header:eq(0)").append(html);
            $(".button-download--batch").on("click", obj.showDownload);
        }
        else {
            setTimeout(obj.initDownloadHomePage, 1000)
        }
    };

    obj.initDownloadSharePage = function () {
        if ($(".button-download--batch").length) {
            return;
        }
        if ($("#root [class^=banner] [class^=right]").length) {
            var html = '<div class="button-download--batch to-app--r7fcK" style="height: 36px;border-radius: 18px;display: flex;flex-direction: column;justify-content: center;align-items: center;padding: 0px 28px;background: linear-gradient(105deg, #446dff 2%, rgba(99, 125, 255, 0.75) 100%),#fff;font-size: 14px;line-height: 17px;text-align: center;color: var(--basic_white);cursor: pointer;">显示链接</div>';
            $("#root [class^=banner] [class^=right]").prepend(html);
            $(".button-download--batch").on("click", obj.showDownload);
        }
        else {
            setTimeout(obj.initDownloadSharePage, 500)
        }
    };

    obj.showDownload = function () {
        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            return;
        }
        else if (fileList.length > 10) {
            obj.showTipLoading("正在努力获取直链中 。。。 请不好重复点击。建议小批量获取", 10e3);
        }
        obj.getDownloadUrl(fileList).then((fileList) => {
            obj.showBox(fileList);
        });
    };

    obj.getDownloadUrl = function (fileList) {
        obj.errNum = 0;
        return obj.refresh_token().then (() => {
            return obj.isHomePage() ? obj.getDownloadUrlHomePage(fileList) : obj.get_share_token().then(() => {
                return obj.getDownloadUrlSharePage(fileList);
            });
        });
    };

    obj.getDownloadUrlHomePage = function (fileList) {
        if (!Array.isArray(fileList)) {
            fileList = [fileList];
        }
        var promises = [];
        fileList.forEach(function (item, index) {
            if (item.type == "file") {
                if (!((item.download_url || item.url) && obj.getTokenExpires(item))) {
                    promises.push(obj.get_download_url(item.file_id, item.drive_id));
                }
            }
        });
        return Promise.allSettled(promises).then((results) => {
            results.forEach(function (item, index) {
                if (item.status == "fulfilled") {
                    const findIndex = fileList.findIndex((fitem) => {
                        return fitem.file_id === item.value.file_id;
                    });
                    obj.setTokenExpires(fileList[index], 14400);
                    Object.assign(fileList[index], item.value);
                }
            });
            let invalid = fileList.findIndex((item) => {
                if (item.type == "file" && !(item.download_url || item.url)) {
                    return true;
                }
                return false;
            });
            if (invalid > -1) {
                if (++obj.errNum > 10) {
                    return fileList;
                }
                else {
                    return obj.getDownloadUrlHomePage(fileList);
                }
            }
            else {
                obj.hideNotify();
                return fileList;
            }
        });
    };

    obj.getDownloadUrlSharePage = function (fileList) {
        if (!Array.isArray(fileList)) {
            fileList = [fileList];
        }
        var promises = [];
        fileList.forEach(function (item, index) {
            if (item.type == "file") {
                if (!((item.download_url || item.url) && obj.getTokenExpires(item))) {
                    promises.push(obj.get_share_link_download_url(item.file_id, item.share_id));
                }
            }
        });
        return Promise.allSettled(promises).then((results) => {
            results.forEach(function (item, index) {
                if (item.status == "fulfilled") {
                    const findIndex = fileList.findIndex((fitem) => {
                        return fitem.file_id === item.value.file_id;
                    });
                    obj.setTokenExpires(fileList[index], 600);
                    Object.assign(fileList[index], item.value);
                }
            });
            let invalid = fileList.findIndex((item) => {
                if (item.type == "file" && !(item.download_url || item.url)) {
                    return true;
                }
                return false;
            });
            if (invalid > -1) {
                if (++obj.errNum > 10) {
                    return fileList;
                }
                else {
                    return obj.getDownloadUrlSharePage(fileList);
                }
            }
            else {
                obj.hideNotify();
                return fileList;
            }
        });
    };

    obj.get_download_url = function (file_id, drive_id) {
        const { token_type, access_token } = obj.getItem("token");
        const { "x-device-id": x_id, "x-signature": x_signature } = obj.headers;
        return fetch("https://api.aliyundrive.com/v2/file/get_download_url", {
            body: JSON.stringify({
                expire_sec: 14400,
                drive_id: drive_id,
                file_id: file_id
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8",
                "x-device-id": x_id || obj.getItem("cna") || obj.uuid(),
                "x-signature": x_signature
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        });
    };

    obj.get_share_link_download_url = function (file_id, share_id) {
        const { token_type, access_token } = obj.getItem("token");
        const { "x-device-id": x_id, "x-signature": x_signature } = obj.headers;
        return fetch("https://api.aliyundrive.com/v2/file/get_share_link_download_url", {
            body: JSON.stringify({
                file_id: file_id,
                share_id: share_id
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8",
                "x-share-token": obj.getItem("shareToken").share_token
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        });
    };

    obj.getSelectedFileList = function () {
        var selectedFileList = [], fileList = obj.file_page.items;
        if (fileList.length == 0) {
            return [];
        }
        var nodeList = document.querySelectorAll('[data-index]');
        if (nodeList.length) {
            nodeList.forEach(function(ele) {
                if (ele.querySelector('[data-is-selected="true"]')) {
                    selectedFileList.push(fileList[ele.dataset.index]);
                }
            });
            return selectedFileList.length ? selectedFileList : fileList;
        }
        else {
            obj.showTipError("无法获取页面结构，请反馈");
            return fileList;
        }
    };

    obj.showBox = function (fileList) {
        $('<div class="ant-modal-root"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle0"><div role="document" class="ant-modal modal-wrapper--2yJKO modal-wrapper--5SA7y" style="width: 60%;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle0">文件下载</div></div><div class="ant-modal-body"><div class="icon-wrapper--3dbbo icon-wrapper--TbIdu"><span data-role="icon" data-render-as="svg" data-icon-type="PDSClose" class="close-icon--33bP0 icon--d-ejA close-icon--KF5OX icon--D3kMk "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSClose"></use></svg></span></div><div class="container--1RqbN container--yXiG-"><div class="list--13IBL list--ypYX0"></div></div></div><div class="ant-modal-footer"><div class="footer--1r-ur footer--zErav"><div class="buttons--nBPeo buttons--u5Y-e"></div></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>').appendTo(document.body).find(".list--13IBL,.list--ypYX0").append(
            fileList.map((item, index) => {
                var isfile = item.type == "file", bc = isfile ? `bc://http/${btoa(unescape(encodeURIComponent(`AA/${encodeURIComponent(item.name)}/?url=${encodeURIComponent((item.download_url || item.url))}&refer=${encodeURIComponent('https://www.aliyundrive.com/')}ZZ`)))}` : ``;
                return `<div class="item--18Z6t item--v0KyS" title="${ isfile ? `文件大小：${ obj.bytesToSize(item.size) }` : `请进入文件夹下载` }"><span style="width: 100%;">${++index}：${item.name}</span>${ isfile ? `<a title="${bc}" href="${bc}">BitComet</a>` : ``}</div>`
                         + (isfile ? `<div class="item--18Z6t item--v0KyS"><span style="width: 100%;"><a title=${(item.download_url || item.url)} href=${(item.download_url || item.url)}>${(item.download_url || item.url)}</a></span></div>` : ``);
            }).join("\n")
        ).closest(".ant-modal-root").find(".buttons--nBPeo,.buttons--u5Y-e").append(
            '<button class="button--2Aa4u primary--3AJe5 small---B8mi button--WC7or primary--NVxfK small--e7LRt">IDM 导出文件</button>' +
            '<button class="button--2Aa4u primary--3AJe5 small---B8mi button--WC7or primary--NVxfK small--e7LRt">M3U 导出文件</button>' +
            '<button class="button--2Aa4u primary--3AJe5 small---B8mi button--WC7or primary--NVxfK small--e7LRt">Aria2 推送</button>' +
            '<button class="button--2Aa4u primary--3AJe5 button--WC7or primary--NVxfK" style="margin-left: 0;width: auto;border: 0 solid transparent;">⚙️</button>'
        ).children().on("click", function () {
            var singleList = fileList.filter(function (item) {
                return item.type == "file" && (item.download_url || item.url);
            });
            if (singleList.length) {
                var folderName = singleList[0]?.name + "等" + singleList.length + "个文件";
                var $this = $(this), $text = $this.text(), index = $this.index();
                switch(index) {
                    case 0:
                        obj.downloadFile(singleList.map((item, index) => [`<`, (item.download_url || item.url), `referer: https://www.aliyundrive.com/`, `User-Agent: ${navigator.userAgent}`, `>`].join(`\r\n`)).join(`\r\n`) + `\r\n`, (folderName || "IDM 导出文件") + ".ef2");
                        break;
                    case 1:
                        var videoList = singleList.filter(function (item) {
                            return item.category == "video";
                        });
                        if (videoList.length) {
                            obj.downloadFile(`#EXTM3U\r\n#EXTVLCOPT:http-referrer=https://www.aliyundrive.com/\r\n` + singleList.map((item, index) => [ `#EXTINF:-1, ${item.name}`, (item.download_url || item.url) ].join(`\r\n`)).join(`\r\n`), (folderName || "M3U 导出文件") + ".m3u");
                        }
                        else {
                            obj.showTipError("未找到有效视频文件");
                        }
                        break;
                    case 2:
                        $this.text("正在推送");
                        var downData = singleList.map(function (item, index) {
                            return {
                                id: "",
                                jsonrpc: "2.0",
                                method: "aria2.addUri",
                                params:[
                                    "token:" + (obj.getItem("aria-token") || ""),
                                    [ (item.download_url || item.url) ],
                                    {
                                        out: item.name,
                                        dir: (obj.getItem("aria-dir") || "D:\/aliyundriveDownloads") + (folderName ? "\/" + folderName : ""),
                                        referer: "https://www.aliyundrive.com/",
                                        "user-agent": navigator.userAgent
                                    }
                                ]
                            }
                        });
                        obj.aria2RPC(downData, function (result) {
                            if (result) {
                                obj.showTipSuccess("Aria2 推送完成，请查收");
                            }
                            else {
                                obj.showTipError("Aria2 推送失败 可能 Aria2 未启动或配置错误");
                            }
                            $this.text($text);
                        });
                        break;
                    case 3:
                        $('<div class="ant-modal-root"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle1" style=""><div role="document" class="ant-modal modal-wrapper--5SA7y" style="width: 340px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle1">Aria2 设置</div></div><div class="ant-modal-body"><div class="content-wrapper--S6SNu"><div>推送链接：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="http://127.0.0.1:6800/jsonrpc" action="click" type="text" class="ant-input ant-input-borderless"></span></div><div class="content-wrapper--S6SNu"><div>推送路径：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="D:\/aliyundriveDownloads" action="click" type="text" class="ant-input ant-input-borderless"></span></div><div class="content-wrapper--S6SNu"><div>RPC密钥：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="" action="click" type="text" class="ant-input ant-input-borderless"></span></div></div><div class="ant-modal-footer"><div class="footer--cytkB"><button class="button--WC7or secondary--vRtFJ small--e7LRt cancel-button--c-lzN">取消</button><button class="button--WC7or primary--NVxfK small--e7LRt">确定</button></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>').appendTo(document.body).find("button").on("click", function () {
                            var index = $(this).index();
                            if (index) {
                                $(this).closest(".ant-modal-content").find("input").each(function (index) {
                                    obj.setItem([ "aria-url", "aria-dir", "aria-token" ][index], $(this).val() || "");
                                });
                            }
                            $(this).closest(".ant-modal-root").remove();
                        }).closest(".ant-modal-content").find("input").each(function (index) {
                            $(this).val(obj.getItem([ "aria-url", "aria-dir", "aria-token" ][index]) || "");
                        });
                        break;
                    default:
                        break;
                }
            }
            else {
                obj.showTipError("未找到有效文件");
            }
        }).closest(".ant-modal-root").find(".icon-wrapper--3dbbo,.icon-wrapper--TbIdu").one("click", function () {
            $(this).closest(".ant-modal-root").remove();
        }).closest(".ant-modal-root").find(".list--13IBL.list--ypYX0 a").on("mousedown mouseup", function (event) {
            this.href = this.title;
        });
    };

    obj.downloadFile = function (content, filename) {
        var a = document.createElement("a");
        var blob = new Blob([content]);
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    obj.aria2RPC = function (downData, callback) {
        var urls = ["http://127.0.0.1:6800/jsonrpc", "http://localhost:16800/jsonrpc"];
        var url = obj.getItem("aria-url");
        obj.ajax({
            type: "post",
            url: url || urls[0],
            data: JSON.stringify(downData),
            success: function (response) {
                url || obj.setItem("aria-url", this.url);
                callback && callback(response);
            },
            error: function (error) {
                var index = urls.indexOf(this.url);
                if (index >= 0) {
                    if (index < urls.length - 1) {
                        obj.setItem("aria-url", urls[index + 1]);
                        setTimeout(function() { obj.aria2RPC(downData, callback) }, 500);
                    }
                    else {
                        console.error("Aria2 推送服务 错误：", this.url, error);
                        obj.removeItem("aria-url");
                        callback && callback("");
                    }
                }
                else {
                    obj.setItem("aria-url", urls[index + 1]);
                    setTimeout(function() { obj.aria2RPC(downData, callback) }, 500);
                }
            }
        });
    };

    obj.bytesToSize = function (e) {
        return (function () {
            var t = 1024;
            return e <= 0 ? "0 B" : e >= Math.pow(t, 4) ? "".concat(
                r(e / Math.pow(t, 4), 2), " TB") : e >= Math.pow(t, 3) ? "".concat(
                r(e / Math.pow(t, 3), 2), " GB") : e >= Math.pow(t, 2) ? "".concat(
                r(e / Math.pow(t, 2), 2), " MB") : e >= t ? "".concat(
                r(e / t, 2), " KB") : "".concat(
                r(e, 2), " B");
        })();
        function r(e) {
            var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 2
            , n = !(arguments.length > 2 && void 0 !== arguments[2]) || arguments[2];
            if (0 === e) {
                return "0";
            }
            var r = n ? e.toFixed(t) : i(e, t);
            return t ? r.replace(/0+$/, "").replace(/\.$/, "") : r;
        }
        function i(e, t) {
            return (Math.floor(e * Math.pow(10, t)) / Math.pow(10, t)).toFixed(t);
        }
    };

    /*******************************************************/

    obj.isHomePage = function () {
        return location.href.indexOf(".aliyundrive.com/drive") > 0;
    };

    obj.isSharePage = function () {
        return location.href.indexOf("aliyundrive.com/s/") > 0;
    };

    obj.getTokenExpires = function (file) {
        var t = file.expire_time, i = Number(file.expires_in), e = Date.parse(t) - Date.now();
        if (0 < e && e < 1e3 * i) return !0;
        return !1;
    };

    obj.setTokenExpires = function(file, time) {
        time = void 0 === time ? 600 : time;
        file.expire_time = new Date(Date.now() + time).toISOString();
        file.expires_in = time;
        return file;
    };

    obj.refresh_token = function () {
        var token = obj.getItem("token");
        if (!(token && token.refresh_token)) {
            return Promise.reject();
        }
        if (obj.getTokenExpires(token)) {
            return Promise.resolve();
        }
        return fetch("https://api.aliyundrive.com/token/refresh", {
            body: JSON.stringify({
                refresh_token: token.refresh_token
            }),
            headers: {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json",
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        }).then((response) => {
            obj.setItem("token", response);
            return response;
        });
    };

    obj.get_share_token = function () {
        var shareToken = obj.getItem("shareToken");
        if (!shareToken) {
            return Promise.reject();
        }
        if (obj.getTokenExpires(shareToken)) {
            return Promise.resolve();
        }
        const { "x-device-id": x_id, "x-signature": x_signature } = obj.headers;
        return fetch("https://api.aliyundrive.com/v2/share_link/get_share_token", {
            body: JSON.stringify({
                share_id: obj.getShareId(),
                share_pwd: ""
            }),
            headers: {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json",
                "x-device-id": x_id || obj.getItem("cna") || obj.uuid(),
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        }).then((response) => {
            obj.setItem("shareToken", response);
            return response;
        });
    };

    obj.ajax = function(option) {
        var details = {
            method: option.type || "get",
            url: option.url,
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
        if (option.data instanceof Object && (option.type || "").toUpperCase() !== "POST") {
            option.data = Object.keys(option.data).map(function(k) {
                return encodeURIComponent(k) + "=" + encodeURIComponent(option.data[k]).replace("%20", "+");
            }).join("&");
            option.url += (option.url.includes("?") ? "&" : "?") + option.data;
            delete option.data;
        }
        Object.assign(details, option);
        GM_xmlhttpRequest(details);
    };

    obj.getShareId = function () {
        var match = location.href.match(/aliyundrive\.com\/s\/([a-zA-Z\d]+)/);
        return match ? match[1] : null;
    };

    obj.loadJs = function (src) {
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
                Node.prototype.appendChild.call(document.head, script);
            });
        }
        return window.instances[src];
    };

    obj.getItem = function (n) {
        n = localStorage.getItem(n);
        if (!n) {
            return null;
        }
        try {
            return JSON.parse(n);
        } catch (e) {
            return n;
        }
    };

    obj.setItem = function (n, t) {
        n && t != undefined && localStorage.setItem(n, t instanceof Object ? JSON.stringify(t) : t);
    };

    obj.removeItem = function (n) {
        n != undefined && localStorage.removeItem(n);
    };

    obj.getRandomColor = function () {
        return "#" + ("00000" + (Math.random() * 0x1000000 << 0).toString(16)).substr(-6);
    };

    obj.showTipSuccess = function (message, time) {
        obj.showNotify({
            type: "success",
            message: message,
            time: time
        });
    };

    obj.showTipError = function (message, time) {
        obj.showNotify({
            type: "fail",
            message: message,
            time: time
        });
    };

    obj.showTipLoading = function (message, time) {
        obj.showNotify({
            type: "loading",
            message: message,
            time: time
        });
    };

    obj.showNotify = function (opts) {
        if (unsafeWindow.application) {
            unsafeWindow.application.showNotify(opts);
        }
        else {
            var css = [
                ".notify{display:none;position:absolute;top:0;left:25%;width:50%;text-align:center;overflow:hidden;z-index:1010}",
                ".notify .alert{display:inline-block;*display:inline;*zoom:1;min-width:110px;white-space:nowrap}",
                ".alert-success,.alert-fail,.alert-loading{padding:0 20px;line-height:34px;font-size:14px;color:#ffffff}",
                ".alert-success,.alert-loading{background:#36be63}",
                ".alert-fail{background:#ff794a}",
                ".fade{opacity:0;-webkit-transition:opacity .15s linear;-o-transition:opacity .15s linear;transition:opacity .15s linear}",
                ".fade.in{opacity:1}"
            ];
            $("<style></style>").text(css.join(" ")).appendTo(document.head || document.documentElement);
            $("body").append('<div id="J_Notify" class="notify" style="width: 650px; margin: 10px auto; display: none;"></div>');
            unsafeWindow.application = {
                notifySets: {
                    type_class_obj: {success: "alert-success", fail: "alert-fail", loading: "alert-loading"},
                    count: 0,
                    delay: 3e3
                },
                showNotify: function(opts) {
                    var that = this, class_obj = that.notifySets.type_class_obj, count = that.notifySets.count;
                    opts.type == "loading" && (delay *= 5);
                    if ($(".alert").length == 0) {
                        $("#J_Notify").empty().append('<div class="alert in fade"></div>').show();
                    }
                    else {
                        Object.keys(class_obj).forEach(function(key) {
                            $("#J_Notify").toggleClass(class_obj[key], false);
                        });
                    }
                    $(".alert").text(opts.message).addClass(class_obj[opts.type]);
                    that.notifySets.count += 1;

                    var delay = opts.time || that.notifySets.delay;
                    setTimeout(function() {
                        if (++count == that.notifySets.count) {
                            that.hideNotify();
                        }
                    }, delay);
                },
                hideNotify: function() {
                    $("#J_Notify").empty();
                }
            };
            obj.showNotify(opts);
        }
    };

    obj.hideNotify = function() {
        if (unsafeWindow.application) {
            unsafeWindow.application.hideNotify();
        }
    };

    obj.run = function() {
        obj.httpListener();
    }();

    console.log("=== 阿里云盘 好棒棒！===");

    // Your code here...
})();
