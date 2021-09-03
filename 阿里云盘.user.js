// ==UserScript==
// @name         阿里云盘
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  支持分享链接页面生成并展示下载链接，支持视频播放页面打开自动播放/播放区点击暂停继续/播放控制器拖拽调整位置，...
// @author       You
// @require      https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @match        https://www.aliyundrive.com/s/*
// @match        https://www.aliyundrive.com/drive*
// @icon         https://gw.alicdn.com/imgextra/i3/O1CN01aj9rdD1GS0E8io11t_!!6000000000620-73-tps-16-16.ico
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var $ = $ || window.$;
    var obj = {
        file_page: {
            token_type: "",
            access_token: "",
            items: []
        },
    };

    obj.unfreezeGlobal = function () {
        var global = window.Global;
        if (global instanceof Object) {
            Object.getOwnPropertyNames(global).forEach(function (key) {
                if (global[key] == false) {
                    global[key] = true;
                }
            })
        }
    };

    obj.videoPageOptimization = function () {
        $(document).on("DOMNodeInserted", ".btn--1cZfA", function() {
            $(this).click();
            var elevideo = document.querySelector("video");
            setTimeout(function () {
                elevideo.paused && elevideo.play();
                $(".video-player--29_72").css({opacity: 0});
            }, 500);
        });

        $(document).on("click", "video", function(event) {
            var elevideo = $(this).get(0);
            elevideo.paused && elevideo.play() || elevideo.pause();

            var opacity = elevideo.paused ? .9 : 0;
            $(".video-player--29_72").css({opacity: opacity});
        });

        $(document).on("mouseover mouseout mousedown", ".video-player--29_72", function(event) {
            var that = this;
            if (event.type == "mouseover" || event.type == "mouseout") {
                var opacity = event.type == "mouseover" ? .9 : 0;
                $(that).css({opacity: opacity});
                return;
            }

            var positionDiv = $(that).children("div:first").offset();
            var distenceX = event.pageX - positionDiv.left;
            var distenceY = event.pageY - positionDiv.top;

            $(document).mousemove(function(event){
                var $that = $(that).children("div:first");
                var $document = $(document);
                $that.css({cursor: "move"});

                var offsetX = event.pageX - distenceX;
                var offsetY = event.pageY - distenceY;
                if(offsetX < 0) {
                    offsetX = 0;
                }
                else {
                    var widthDifference = $document.width() - $that.outerWidth(true);
                    if (offsetX > widthDifference) {
                        offsetX = widthDifference;
                    }
                }

                if(offsetY < 0){
                    offsetY = 0;
                }
                else {
                    var heightDifference = $document.height() - $that.outerHeight(true);
                    if(offsetY > heightDifference) {
                        offsetY = heightDifference;
                    }
                }

                $that.offset({
                    left: offsetX,
                    top: offsetY
                })
            })

            $(document).mouseup(function(e){
                $(that).css({cursor: ""});
                $(document).off("mousemove");
            })
        });
    };

    obj.initSharePage = function () {
        if ($("#root input").length) {
            $(document).one("DOMNodeInserted", "#root header", obj.initDownloadSharePage);
        }
        else if ($("#root header").length) {
            obj.initDownloadSharePage();
        }
        else {
            setTimeout(obj.initSharePage, 500)
        }
    };

    obj.initDownloadSharePage = function () {
        if ($(".action--9-qBb").length && $(".button-download--batch").length == 0) {
            obj.tokenRefresh();

            var html = '<div style="margin:0px 8px;"></div><div class="button-wrapper--1UkG6 button-download--batch" data-type="primary" data-disabled="false" data-spm-anchor-id="0.0.0.i1.44273575TyIS3B">显示链接</div>';
            $(".action--9-qBb").append(html);

            $(".button-download--batch").on("click", obj.showDownload);
        }
        else {
            setTimeout(obj.initDownloadSharePage, 500)
        }
    };

    obj.showDownload = function () {
        if (obj.file_page.items && obj.file_page.access_token) {
            obj.showTipLoading("正在获取链接...");
        }
        else {
            obj.showTipError("缺少必要参数，请登陆后刷新此页面重试！");
            return;
        }

        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            console.error("致命错误：获取文件列表失败");
            obj.showTipError("致命错误：获取文件列表失败");
            return;
        }

        var share_id = obj.getShareId();
        obj.showBox('<div class="item-list" style="padding: 20px; height: 410px; overflow-y: auto;"></div>');
        var rowStyle = "margin:10px 0px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;";

        if (fileList.length > 1) {
            var archive_name = fileList[0].name + "等" + fileList.length + "个文件";
            var fileIdList = [];
            fileList.forEach(function (item, index) {
                fileIdList.push({file_id: item.file_id});
            });
            obj.getShareMultiDownloadUrl(fileIdList, share_id, archive_name, function (download_url) {
                if (download_url) {
                    var html = '<p>压缩包：' + archive_name + '</p>';
                    html += '<p style="' + rowStyle + '"><a title="' + download_url + '" href="' + download_url + '" style="color: blue;">' + download_url + '</a></p>';
                    $(".item-list").append(html);
                }
            });
        }

        setTimeout(function() {
            fileList.forEach(function (item, index) {
                if (item.download_url) {
                    var html = '<p>' + (++index) + '：' + item.name + '</p>';
                    html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" href="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
                    $(".item-list").append(html);
                }
                else {
                    setTimeout(function() {
                        obj.getShareLinkDownloadUrl(item.file_id, share_id, function (download_url) {
                            item.download_url = download_url;
                            var html = '<p>' + (++index) + '：' + item.name + '</p>';
                            html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" href="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
                            $(".item-list").append(html);
                        });
                    }, 66 * index);
                }
            });
            obj.hideTip()
        }, 500);
    };

    obj.showBox = function (body) {
        var template = '<div class="ant-modal-root ant-modal-my"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle1" style=""><div role="document" class="ant-modal modal-wrapper--2yJKO" style="width: 440px; transform-origin: 325.5px 243px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle1" data-spm-anchor-id="0.0.0.i12.35676c753FPwhu">文件下载</div></div><div class="ant-modal-body"><div class="icon-wrapper--3dbbo"><span data-role="icon" data-render-as="svg" data-icon-type="PDSClose" class="close-icon--33bP0 icon--d-ejA "><svg viewBox="0 0 1024 1024" data-spm-anchor-id="0.0.0.i11.35676c753FPwhu"><use xlink:href="#PDSClose" data-spm-anchor-id="0.0.0.i4.35676c753FPwhu"></use></svg></span></div>';
        template += body;
        template += '</div><div class="ant-modal-footer" data-spm-anchor-id="0.0.0.i10.35676c753FPwhu"></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>';
        $("body").append(template);
        $(".icon-wrapper--3dbbo").one("click", function () {
            $(".ant-modal-my").remove();
        });
    };

    obj.getSelectedFileList = function () {
        var selectedFileList = [], fileList = obj.file_page.items;
        if (fileList.length == 0) {
            return [];
        }

        var $node = "";

        if ($(".tbody--3Y4Fn  .tr--5N-1q.tr--3Ypim").length) {
            $node = $(".tbody--3Y4Fn  .tr--5N-1q.tr--3Ypim");
        }
        else if ($(".outer-wrapper--25yYA").length) {
            $node = $(".outer-wrapper--25yYA");
        }
        $node.each(function (index) {
            if ($(this).attr("data-is-selected") == "true") {
                selectedFileList.push(fileList[index]);
            }
        });

        return selectedFileList.length ? selectedFileList : fileList;
    };

    obj.addPageFileList = function () {
        var open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("load", function() {
                if (! (this.readyState == 4 && this.status == 200)) {
                    return;
                }
                var responseURL = this.responseURL;
                if (!responseURL.indexOf("/file/list") > 0) {
                    return;
                }

                var isShow = false;
                $(".ant-modal-root").each(function () {
                    if($(this).css('display') == "block") {
                        isShow = true;
                    }
                });
                if (isShow) { return; }

                var response = JSON.parse(this.response);
                if (response.items && response.items.length) {
                    obj.file_page.items = response.items;
                }

                obj.showTipSuccess("文件列表获取完成 共：" + obj.file_page.items.length + "项");
            }, false);
            open.apply(this, arguments);
        };
    };

    obj.tokenRefresh = function (callback) {
        var token = obj.getItem("token"), refresh_token = token ? token.refresh_token : null;
        if (!refresh_token) {
            obj.showTipError("如需要下载，请先登录！");
            callback && callback("");
            return;
        }

        $.ajax({
            type: "post",
            url: "https://websv.aliyundrive.com/token/refresh",
            data: JSON.stringify({
                refresh_token: refresh_token
            }),
            headers: {
                "Content-type": "application/json;charset=utf-8",
            },
            success: function (response) {
                if (response && response.access_token) {
                    obj.file_page.token_type = response.token_type;
                    obj.file_page.access_token = response.access_token;
                    callback && callback(response);
                }
                else {
                    callback && callback("");
                }
            },
            error: function () {
                callback && callback("");
            }
        });
    };

    obj.getShareMultiDownloadUrl = function (files, share_id, archive_name, callback) {
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/adrive/v1/file/multiDownloadUrl",
            data: JSON.stringify({
                archive_name: archive_name,
                download_infos: [{
                    files: files,
                    share_id: share_id
                }]
            }),
            headers: {
                "authorization": "".concat(obj.file_page.token_type || "", " ").concat(obj.file_page.access_token || ""),
                "content-type": "application/json;charset=utf-8"
            },
            async: true,
            success: function (response) {
                if (response.download_url) {
                    callback && callback(response.download_url);
                }
                else {
                    console.error("getShareMultiDownloadUrl 失败", response);
                    callback && callback("");
                }
            },
            error: function (error) {
                console.error("getShareMultiDownloadUrl 错误", error);
                callback && callback("");
            }
        });
    };

    obj.getShareLinkDownloadUrl = function (file_id, share_id, callback) {
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/v2/file/get_share_link_download_url",
            data: JSON.stringify({
                expire_sec: 600,
                file_id: file_id,
                share_id: share_id
            }),
            headers: {
                "authorization": "".concat(obj.file_page.token_type || "", " ").concat(obj.file_page.access_token || ""),
                "content-type": "application/json;charset=utf-8",
                "x-share-token": obj.getItem("shareToken").share_token
            },
            async: true,
            success: function (response) {
                if (response.download_url) {
                    callback && callback(response.download_url);
                }
                else {
                    console.error("getShareLinkDownloadUrl 失败", response);
                    callback && callback("");
                }
            },
            error: function (error) {
                console.error("getShareLinkDownloadUrl 错误", error);
                callback && callback("");
            }
        });
    };

    obj.getShareId = function () {
        var url = location.href;
        var match = url.match(/aliyundrive\.com\/s\/([a-zA-Z\d]+)/);
        return match ? match[1] : null;
    };

    obj.getItem = function(n) {
        n = window.localStorage.getItem(n);
        if (!n) {
            return null;
        }
        try {
            return JSON.parse(n);
        } catch (n) {
            return null;
        }
    };

    obj.showTipSuccess = function (msg, timeout) {
        obj.hideTip();

        var $element = $(".aDrive div");
        if ($element.length) {
            $element.append('<div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-success"><span data-role="icon" data-render-as="svg" data-icon-type="PDSCheckmarkCircleFill" class="success-icon--2Zvcy icon--d-ejA "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSCheckmarkCircleFill"></use></svg></span><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 44px; padding-right: 20px;"><div class="title-wrapper--3bQQ2">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div>');
        }
        else {
            $(document.body).append('<div class="aDrive"><div><div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-success"><span data-role="icon" data-render-as="svg" data-icon-type="PDSCheckmarkCircleFill" class="success-icon--2Zvcy icon--d-ejA "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSCheckmarkCircleFill"></use></svg></span><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 44px; padding-right: 20px;"><div class="title-wrapper--3bQQ2">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div></div></div></div>');
        }

        setTimeout(function () {
            obj.hideTip()
        }, timeout || 3000);
    };

    obj.showTipError = function (msg, timeout) {
        obj.hideTip();

        var $element = $(".aDrive div");
        if ($element.length) {
            $element.append('<div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-error"><span data-role="icon" data-render-as="svg" data-icon-type="PDSCloseCircleFill" class="error-icon--1Ov4I icon--d-ejA "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSCloseCircleFill"></use></svg></span><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 44px; padding-right: 20px;"><div class="title-wrapper--3bQQ2" data-spm-anchor-id="0.0.0.i41.35676c75yBZNPh">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div></div>');
        }
        else {
            $(document.body).append('<div><div class="aDrive"><div><div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-error"><span data-role="icon" data-render-as="svg" data-icon-type="PDSCloseCircleFill" class="error-icon--1Ov4I icon--d-ejA "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSCloseCircleFill"></use></svg></span><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 44px; padding-right: 20px;"><div class="title-wrapper--3bQQ2" data-spm-anchor-id="0.0.0.i41.35676c75yBZNPh">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div></div></div></div></div>');
        }

        setTimeout(function () {
            obj.hideTip()
        }, timeout || 3000);
    };

    obj.showTipLoading = function (msg, timeout) {
        obj.hideTip();

        var $element = $(".aDrive div");
        if ($element.length) {
            $element.append('<div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-loading"><div></div><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 20px; padding-right: 20px;"><div class="title-wrapper--3bQQ2">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div></div>');
        }
        else {
            $(document.body).append('<div><div class="aDrive"><div><div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-loading"><div></div><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 20px; padding-right: 20px;"><div class="title-wrapper--3bQQ2">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div></div></div></div></div>');
        }

        setTimeout(function () {
            obj.hideTip()
        }, timeout || 5000);
    };

    obj.hideTip = function() {
        var t = $(".aDrive-notice");
        t.length && "function" == typeof t.remove ? t.remove() : "function" == typeof t.removeNode && t.removeNode(!0);
    };

    var url = location.href;
    if (url.indexOf(".aliyundrive.com/s/") > 0) {
        obj.addPageFileList();
        obj.initSharePage();

        obj.videoPageOptimization();
    }
    else if (url.indexOf(".aliyundrive.com/drive") > 0) {
        obj.unfreezeGlobal();

        obj.videoPageOptimization();
    }

    // Your code here...
})();
