// ==UserScript==
// @name         阿里云盘
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      5.0.0
// @description  想要更多更好更快，三方权益包您值得拥有
// @author       You
// @match        https://www.aliyundrive.com/*
// @match        https://www.alipan.com/*
// @connect      *
// @require      https://scriptcat.org/lib/950/^1.0.1/Joysound.js
// @require      https://scriptcat.org/lib/2163/^1.0.0/alipanThirdParty.js
// @require      https://scriptcat.org/lib/2164/^1.0.0/alipanArtPlugins.js
// @require      https://cdn.staticfile.org/hls.js/1.5.13/hls.min.js
// @require      https://cdn.staticfile.org/artplayer/5.1.6/artplayer.min.js
// @require      https://cdn.staticfile.org/jquery/3.6.0/jquery.min.js
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
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    var $ = $ || window.$;
    var obj = {
        file_page: {
            root_info: {},
            send_params: {},
            items: []
        },
        video_page: {
            video_info: {},
            video_items: [],
            subtitle_items: [],
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
                            obj.initPlayInfo(response);
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
                obj.file_page.items = [];
            }
            obj.file_page.send_params = sendParams;
            obj.file_page.items.find((item) => item?.file_id === response.items[0]?.file_id) || (obj.file_page.items = obj.file_page.items.concat(response.items));
            obj.showTipSuccess("文件列表获取完成 共：" + obj.file_page.items.length + "项");

            if (obj.file_page.items.length) {
                // obj.isHomePage() ? obj.initDownloadHomePage() : obj.initDownloadSharePage;
            }
        }
    };

    obj.initPlayInfo = function (response) {
        try { response = JSON.parse(response) } catch (error) { };
        if (response instanceof Object) {
            obj.video_page.video_info = response;
            obj.video_page.video_items = obj.file_page.items.filter(function (item, index) {
                return item.type == "file" && item.category == "video";
            });
        }
    };

    obj.initVideoPlayer = function () {
        obj.getVideoPreviewPlayInfo().then((response) => {
            delete response.file_id;
            Object.assign(obj.video_page.video_info, response);
            obj.replaceVideoPlayer().then(() => {
                const options = Object.assign({}, obj.video_page);
                window.alipanArtPlugins.init(options).then((art) => {
                    art.on('video_changed_start', (fileOption) => {
                        obj.initPlayInfo(fileOption);
                        obj.getVideoPreviewPlayInfo().then((response) => {
                            delete response.file_id;
                            Object.assign(obj.video_page.video_info, response);
                            const playOption = Object.assign({}, fileOption, response);
                            art.emit('video_changed_end', playOption);
                        });
                    });
                });
            });
        });
    };

    obj.replaceVideoPlayer = function () {
        var container, videoNode = document.querySelector("video");
        if (videoNode) {
            container = document.getElementById("artplayer");
            if (container) {
                return;
            }
            container = document.createElement("div");
            container.setAttribute("id", "artplayer");
            container.setAttribute("style", "width: 100%; height: 100%;");
            var videoParentNode = videoNode.parentNode.parentNode;
            videoParentNode.parentNode.replaceChild(container, videoParentNode);
            // document.querySelector("#root .enter-done")?.setAttribute("data-theme", "dark");
            return Promise.resolve();
        }
        else {
            obj.showTipLoading("正在替换视频播放器 ...", 1e3);
            setTimeout(obj.replaceVideoPlayer, 100);
        }
    };

    obj.getVideoPreviewPlayInfo = function () {
        const { drive_id, file_id, share_id } = obj.video_page.video_info;
        if (share_id) {
            return obj.saveFile().then((response) => {
                const { responses: [{ body, status }] } = response;
                if (status === 201) {
                    Object.assign(obj.video_page.video_info, { drive_id: body.drive_id });
                    const { drive_id, file_id } = body;
                    return window.alipanThirdParty.getVideoPreviewPlayInfo(drive_id, file_id).finally(() => {
                        window.alipanThirdParty.delete(drive_id, file_id);
                    });
                }
                else {
                    obj.showTipError("文件缓存失败，请自行清理网盘文件后重试。。。", 10e3);
                    return Promise.reject();
                }
            });
        }

        return window.alipanThirdParty.getVideoPreviewPlayInfo(drive_id, file_id);
    };

    obj.saveFile = function () {
        const { file_id, share_id } = obj.video_page.video_info;
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
