// ==UserScript==
// @name         阿里云盘
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      5.1.1
// @description  让视频播放变成我想要的那个样子
// @author       You
// @match        https://www.alipan.com/*
// @match        https://www.aliyundrive.com/*
// @connect      alipan.com
// @connect      aliyundrive.com
// @require      https://scriptcat.org/lib/950/^1.0.1/Joysound.js
// @require      https://scriptcat.org/lib/2163/^1.0.0/alipanThirdParty.js
// @require      //https://scriptcat.org/lib/2164/^1.0.3/alipanArtPlugins.js
// @require      https://cdn.jsdelivr.net/gh/tampermonkeyStorage/Self-use@refs/heads/main/alipanArtPlugins.js
// @require      https://unpkg.com/hls.js@1.5.15/dist/hls.min.js
// @require      https://unpkg.com/artplayer@5.2.3/dist/artplayer.js
// @require      https://unpkg.com/leancloud-storage@4.15.2/dist/av-min.js
// @require      https://unpkg.com/m3u8-parser@7.2.0/dist/m3u8-parser.min.js
// @icon         https://gw.alicdn.com/imgextra/i3/O1CN01aj9rdD1GS0E8io11t_!!6000000000620-73-tps-16-16.ico
// @antifeature  ads
// @antifeature  membership
// @antifeature  payment
// @antifeature  referral-link
// @antifeature  tracking
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    var obj = {
        file_page: {
            root_info: {},
            send_params: {},
            file_items: []
        },
        video_page: {
            video_info: {},
            video_file: {},
            video_items: [],
            subtitle_items: []
        }
    };

    obj.httpListener = function () {
        (function(send) {
            XMLHttpRequest.prototype.send = function (sendParams) {
                this.addEventListener("load", function(event) {
                    if (this.readyState == 4 && this.status == 200) {
                        var response = this.response || this.responseText || "", responseURL = this.responseURL;
                        if (responseURL.indexOf("/file/list") > 0 || responseURL.indexOf("/file/search") > 0) {
                            obj.initFilesInfo(sendParams, response);
                        }
                        else if (responseURL.indexOf("/file/get_video_preview_play_info") > 0) {
                            obj.initVideoPlayInfo(response);
                            obj.initVideoPlayer();
                        }
                    }
                }, false);
                send.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.send);
    };

    obj.initFilesInfo = function (sendParams, response) {
        const { send_params, } = obj.file_page;
        try { sendParams = JSON.parse(sendParams) } catch (error) { };
        try { response = JSON.parse(response) } catch (error) { };
        if (sendParams instanceof Object && response instanceof Object) {
            const { order_by, order_direction, parent_file_id } = sendParams || {};
            if (!(order_by === send_params.order_by && order_direction === send_params.order_direction && parent_file_id === send_params.parent_file_id)) {
                obj.file_page.file_items = [];
            }
            obj.file_page.send_params = sendParams;
            obj.file_page.file_items.find((item) => item?.file_id === response.items[0]?.file_id) || (obj.file_page.file_items = obj.file_page.file_items.concat(response.items));
            obj.showTipSuccess("文件列表获取完成 共：" + obj.file_page.file_items.length + "项");

            if (obj.file_page.file_items.length) {
                // obj.isHomePage() ? obj.initDownloadHomePage() : obj.initDownloadSharePage;
            }
        }
    };

    obj.initVideoPlayInfo = function (response) {
        try { response = JSON.parse(response) } catch (error) { };
        if (response instanceof Object) {
            obj.video_page.video_info = response;
            obj.video_page.video_items = obj.file_page.file_items.filter(function (item, index) {
                return item.type == "file" && item.category == "video";
            });
            obj.video_page.video_file = obj.file_page.file_items.find(function (item, index) {
                return item.type == "file" && item.file_id == response.file_id;
            });
            obj.video_page.subtitle_items = obj.file_page.file_items.filter(function (item, index) {
                return item.type == "file" && item.category === "others" && ["vtt", "srt", "ass", "ssa"].includes(item.file_extension.toLowerCase());
            });
        }
    };

    obj.initVideoPlayer = function () {
        obj.getVideoPreviewPlayInfo().then((response) => {
            Object.assign(obj.video_page.video_info, response);
            obj.replaceVideoPlayer().then(() => {
                const options = Object.assign({}, obj.video_page);
                window.alipanArtPlugins.init(options).then((art) => {
                    art.once('ready', function () {
                        obj.getSublistByPan().then(function (sublist) {
                            sublist.length && art.emit('sublist', sublist);
                        });
                    });
                    art.on('resume', (fileOption) => {
                        obj.video_page.video_file = fileOption;
                        obj.getVideoPreviewPlayInfo().then((response) => {
                            art.emit('resumeed', response);
                        });
                    });
                    art.on('reload', (fileOption) => {
                        obj.video_page.video_file = fileOption;
                        obj.getVideoPreviewPlayInfo().then((response) => {
                            art.emit('reloaded', response);
                            const filenameNode = document.querySelector("[class^=header-file-name], [class^=filename] span, [class^=header-center] div span");
                            if (filenameNode) {
                                filenameNode.innerText = fileOption.name;
                            }
                            obj.getSublistByPan().then(function (sublist) {
                                sublist.length && art.emit('sublist', sublist);
                            });
                        });
                    });

                    const closeNode = document.querySelector('[class^="header-"] [data-icon-type="PDSClose"], [class^="header-"] [data-icon-type="PDSChevronLeft"]');
                    closeNode && closeNode.addEventListener('click', function () {
                        art.destroy();
                    }, { once: true });
                });
            });
        });
    };

    obj.replaceVideoPlayer = function () {
        var container, videoNode = document.querySelector("video");
        if (videoNode) {
            container = document.getElementById("artplayer");
            if (container) {
                return Promise.resolve();
            }

            container = document.createElement("div");
            container.setAttribute("id", "artplayer");
            container.setAttribute("style", "width: 100%; height: 100%;");
            var videoParentNode = videoNode.parentNode.parentNode;
            videoParentNode.parentNode.replaceChild(container, videoParentNode);
            return Promise.resolve();
        }
        else {
            obj.showTipLoading("正在替换视频播放器 ...", 1e3);
            return obj.delay().then(function () {
                return obj.replaceVideoPlayer();
            });
        }
    };

    obj.getVideoPreviewPlayInfo = function () {
        return window.alipanThirdParty.getVipInfo().then((info) => {
            const { thirdPartyVip, thirdPartyVipExpire } = info || {};
            if (thirdPartyVip) {
                return obj.getVideoPreviewPlayInfoThirdParty();
            }
            else {
                return Promise.reject();
            }
        }).catch(() => {
            return obj.getVideoPreviewPlayInfoWeb();
        });
    };

    obj.getVideoPreviewPlayInfoThirdParty = function () {
        const { drive_id, file_id, share_id } = obj.video_page.video_file || obj.video_page.video_info;
        if (share_id) {
            return obj.saveFile(file_id, share_id).then((response) => {
                const { responses: [{ body, status }] } = response;
                if (status === 201) {
                    const { drive_id, file_id } = body;
                    return window.alipanThirdParty.getVideoPreviewPlayInfo(drive_id, file_id).finally(() => {
                        window.alipanThirdParty.delete(drive_id, file_id);
                    });
                }
                else {
                    obj.showTipError("文件缓存失败，可能网盘存储空间已满 ...", 5e3);
                    return Promise.reject();
                }
            });
        }
        return window.alipanThirdParty.getVideoPreviewPlayInfo(drive_id, file_id);
    };

    obj.getVideoPreviewPlayInfoWeb = function () {
        return obj.refresh().then (() => {
            const { drive_id, file_id, share_id } = obj.video_page.video_file || obj.video_page.video_info;
            if (share_id) {
                return obj.saveFile(file_id, share_id).then((response) => {
                    const { responses: [{ body, status }] } = response;
                    if (status === 201) {
                        const { drive_id, file_id } = body;
                        return obj.get_video_preview_play_info(drive_id, file_id).finally(() => {
                            obj.deleteFile(drive_id, file_id);
                        });
                    }
                    else {
                        obj.showTipError("文件缓存失败，可能网盘存储空间已满 ...", 5e3);
                        return Promise.reject();
                    }
                });
            }
            return obj.get_video_preview_play_info(drive_id, file_id);
        });
    };

    obj.get_video_preview_play_info = function (drive_id, file_id) {
        const { token_type, access_token } = obj.getItem("token");
        return fetch("https://api.aliyundrive.com/v2/file/get_video_preview_play_info", {
            body: JSON.stringify({
                category: "live_transcoding",
                drive_id: drive_id,
                file_id: file_id,
                template_id: "",
                get_subtitle_info: !0,
                mode: "high_res",
                url_expire_sec: 14400
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8",
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        });
    };

    obj.getSublistByPan = function () {
        const filelist = obj.filterSubFilesByPan();
        if (filelist.length) {
            return obj.getDownloadUrlBatch(filelist).then(function (filelist) {
                const sublist = filelist.map(function (item, index) {
                    return {
                        html: `内挂字幕「${item.file_extension}」`,
                        name: item.name,
                        url: item.url,
                        type: item.file_extension
                    };
                });
                return sublist;
            });
        }
        return Promise.resolve([]);
    };

    obj.filterSubFilesByPan = function () {
        const { video_file, subtitle_items, video_items } = obj.video_page;
        if (!subtitle_items.length) return [];
        if (video_items.length === 1) return subtitle_items;

        const getBaseName = (fileName) => fileName.split('.').slice(0, -1).join('.').toLowerCase();
        const subItems = subtitle_items.map(item => ({
            item,
            base: getBaseName(item.name)
        }));
        const videoBase = getBaseName(video_file.name);
        const videoVariants = [];
        let currentVariant = videoBase;
        while (currentVariant) {
            videoVariants.push(currentVariant);
            currentVariant = currentVariant.split('.').slice(0, -1).join('.');
        }
        for (const variant of videoVariants) {
            const matched = subItems.filter(({ base }) => base.includes(variant) || variant.includes(base));
            if (matched.length) return matched.map(({ item }) => item);
        }
        return [];
    };

    obj.getDownloadUrlBatch = function (fileList) {
        if (!Array.isArray(fileList)) {
            fileList = [fileList];
        }
        var promises = fileList.map(function (item) {
            return item.type == "file" && obj.getDownloadUrl(item).then((response) => {
                item.url = response.url;
                return item;
            });
        }).filter(Boolean);
        return Promise.allSettled(promises).then((results) => {
            return fileList;
        });
    };

    obj.getDownloadUrl = function (file) {
        return obj.refresh().then (() => {
            const { drive_id, file_id, share_id } = file;
            if (share_id) {
                return obj.saveFile(file_id, share_id).then((response) => {
                    const { responses: [{ body, status }] } = response;
                    if (status === 201) {
                        const { drive_id, file_id } = body;
                        return obj.get_download_url(drive_id, file_id).finally(() => {
                            obj.deleteFile(drive_id, file_id);
                        });
                    }
                    else {
                        obj.showTipError("文件缓存失败，请自行清理网盘文件后重试。。。", 10e3);
                        return Promise.reject();
                    }
                });
            }

            return obj.get_download_url(drive_id, file_id);
        });
    };

    obj.get_download_url = function (drive_id, file_id) {
        const { token_type, access_token } = obj.getItem("token");
        return fetch("https://api.aliyundrive.com/v2/file/get_download_url", {
            body: JSON.stringify({
                expire_sec: 14400,
                drive_id: drive_id,
                file_id: file_id
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8",
                "x-canary": "client=windows,app=adrive,version=v6.0.0",
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        });
    };

    obj.saveFile = function (file_id, share_id) {
        const { token_type, access_token, default_drive_id } = obj.getItem("token");
        const { share_token } = obj.getItem("shareToken");
        return fetch("https://api.aliyundrive.com/adrive/v4/batch", {
            body: JSON.stringify({
                requests: [
                    {
                        body: {
                            auto_rename: true,
                            file_id: file_id,
                            share_id: share_id,
                            to_parent_file_id: "root",
                            to_drive_id: default_drive_id
                        },
                        headers: {
                            "Content-Type": "application/json"
                        },
                        id: "0",
                        method: "POST",
                        url: "/file/copy"
                    }
                ],
                resource: "file"
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8",
                "x-share-token": share_token
            },
            method: "POST"
        }).then((response) => {
            return response.ok ? response.json() : Promise.reject();
        });
    };

    obj.deleteFile = function (drive_id, file_id) {
        const { token_type, access_token } = obj.getItem("token");
        return fetch("https://api.aliyundrive.com/v3/file/delete", {
            body: JSON.stringify({
                drive_id: drive_id,
                file_id: file_id
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8",
            },
            method: "POST"
        });
    };

    obj.refresh = function () {
        const token = obj.getItem("token") || {};
        if (obj.tokenExpires(token)) {
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

    obj.tokenExpires = function (file) {
        var t = file.expire_time, i = Number(file.expires_in), e = Date.parse(t) - Date.now();
        if (0 < e && e < 1e3 * i) return !0;
        return !1;
    };

    obj.getItem = function (n) {
        n = localStorage.getItem(n);
        if (!n) return null;
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

    obj.isSharePage = function () {
        return location.href.indexOf("aliyundrive.com/s/") > 0 || location.href.indexOf("alipan.com/s/") > 0;
    };

    obj.delay = function (ms = 500) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

            var style = document.createElement('style');
            style.textContent = css.join(" ");
            (document.head || document.documentElement).appendChild(style);

            var notifyDiv = document.createElement('div');
            notifyDiv.id = 'J_Notify';
            notifyDiv.className = 'notify';
            notifyDiv.style.cssText = 'width: 650px; margin: 10px auto; display: none;';
            document.body.appendChild(notifyDiv);

            unsafeWindow.application = {
                notifySets: {
                    type_class_obj: {success: "alert-success", fail: "alert-fail", loading: "alert-loading"},
                    count: 0,
                    delay: 3e3
                },
                showNotify: function(opts) {
                    var that = this,
                        class_obj = that.notifySets.type_class_obj,
                        count = that.notifySets.count,
                        notifyEl = document.getElementById('J_Notify'),
                        alertEl;

                    if (opts.type == "loading") {
                        that.notifySets.delay *= 5;
                    }

                    if (!notifyEl.querySelector('.alert')) {
                        notifyEl.innerHTML = '<div class="alert in fade"></div>';
                        notifyEl.style.display = 'block';
                    } else {
                        Object.keys(class_obj).forEach(function(key) {
                            notifyEl.classList.remove(class_obj[key]);
                        });
                    }

                    alertEl = notifyEl.querySelector('.alert');
                    alertEl.textContent = opts.message;
                    alertEl.classList.add(class_obj[opts.type]);
                    that.notifySets.count += 1;

                    var delay = opts.time || that.notifySets.delay;
                    setTimeout(function() {
                        if (++count == that.notifySets.count) {
                            that.hideNotify();
                        }
                    }, delay);
                },
                hideNotify: function() {
                    var notifyEl = document.getElementById('J_Notify');
                    notifyEl.innerHTML = '';
                    notifyEl.style.display = 'none';
                }
            };
            obj.showNotify(opts);
        }
    };

    obj.hideNotify = function () {
        if (unsafeWindow.application) {
            unsafeWindow.application.hideNotify();
        }
    };

    obj.run = function () {
        obj.httpListener();
    }();

    console.log("=== 阿里云盘 好棒棒！===");

    // Your code here...
})();
