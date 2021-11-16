// ==UserScript==
// @name         阿里云盘
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  支持生成文件下载链接，支持视频播放页面打开自动播放/播放区点击暂停继续/播放控制器拖拽调整位置，支持自定义分享密码，突破视频2分钟限制，...
// @author       You
// @require      https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @require      https://unpkg.com/ajax-hook@2.0.3/dist/ajaxhook.min.js
// @match        https://www.aliyundrive.com/s/*
// @match        https://www.aliyundrive.com/drive*
// @icon         https://gw.alicdn.com/imgextra/i3/O1CN01aj9rdD1GS0E8io11t_!!6000000000620-73-tps-16-16.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var $ = $ || window.$;
    var obj = {
        file_page: {
            parent_file_id: "root",
            token_type: "",
            access_token: "",
            items: []
        },
    };

    obj.customSharePwd = function () {
        $(document).on("DOMNodeInserted", ".ant-modal-root", function() {
            if ($(".input-share-pwd").length == 0) {
                var sharePwd = localStorage.getItem("share_pwd");
                var html = '<div class="pick-wrapper--3pNxV"><div class="ant-dropdown-trigger share-expire-wrapper--3y_Nn" data-spm-anchor-id="aliyundrive.drive.0.i4.6af76c75XMD1rF">自定义提取码</div></div>';
                html += '<input type="text" class="ant-input input-share-pwd" value="' + (sharePwd ? sharePwd : "") + '" placeholder="" style="margin-left: 12px;width: 99px;height: 28px;line-height: normal;border: 1px solid #D4D7DE;text-align: center;"></div>'
                $(".share-by-url--LfcNg").append(html);
            }
        });

        window.ah.proxy({
            onRequest: (config, handler) => {
                if (config.url.includes("/share_link/create") || config.url.includes("/share_link/update")) {
                    var sharePwd = localStorage.getItem("share_pwd");
                    if (sharePwd) {
                        var body = JSON.parse(config.body);
                        body.share_pwd = sharePwd;
                        config.body = JSON.stringify(body);
                    }
                }
                handler.next(config);
            },
            onResponse: (response, handler) => {
                if ((response.config.url).includes("/share_link/create") || (response.config.url).includes("/share_link/update")) {
                    var sharePwd = localStorage.getItem("share_pwd");
                    if (sharePwd) {
                        if ((response.config.body).includes(sharePwd)) {
                            obj.showTipSuccess("自定义分享密码 成功");
                        }
                        else {
                            localStorage.removeItem("share_pwd");
                            obj.showTipError("自定义分享密码 失败，请修改分享密码后重试");
                        }
                    }
                }
                handler.next(response);
            },
            onError: (err, handler) => {
                handler.next(err)
            }
        })

        $(document).on("change", ".input-share-pwd", function () {
            var value = this.value;
            localStorage.setItem("share_pwd", value);
        });
    };

    obj.unlockVideoLimit = function () {
        window.ah.proxy({
            onRequest: (config, handler) => {
                handler.next(config);
            },
            onResponse: (response, handler) => {
                if ((response.config.url).includes("/file/get_share_link_video_preview_play_info")) {
                    var responseJson = JSON.parse(response.response);
                    responseJson.video_preview_play_info.live_transcoding_task_list.forEach(function (item) {
                        item.preview_url = item.url;
                    });
                    response.response = JSON.stringify(responseJson);
                }
                handler.next(response);
            },
            onError: (err, handler) => {
                handler.next(err)
            }
        })
    };

    obj.videoPageOptimization = function () {
        $(document).on("DOMNodeInserted", ".video-player--29_72 .btn--1cZfA", function() {
            var elevideo = document.querySelector("video");
            if (elevideo.paused) {
                $(this).click();
            }
            setTimeout(function () {
                try {
                    elevideo.paused && elevideo.play();
                    $(".video-player--29_72").css({opacity: 0});
                } catch (a) {};
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
                $(that).css({cursor: "move"});
                var $that = $(that).children("div:first");
                var $document = $(document);

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

    obj.initDownloadSharePage = function () {
        if ($(".button-download--batch").length) {
            return;
        }
        if ($(".action--9-qBb").length) {
            obj.file_page.access_token || obj.tokenRefresh();

            var html = '<div class="button-wrapper--1UkG6 button-download--batch" data-type="primary">显示链接</div>';
            $(".action--9-qBb").append(html);
            $(".button-download--batch").on("click", obj.showDownloadSharePage);
        }
        else {
            setTimeout(obj.initDownloadSharePage, 500)
        }
    };

    obj.initDownloadHomePage = function () {
        if ($(".button-download--batch").length) {
            return;
        }
        if ($(".actions--2qvID").length) {
            obj.file_page.access_token || obj.tokenRefresh();

            var html = '<div style="margin:0px 8px;"></div><button class="button--2Aa4u primary--3AJe5 button-download--batch">显示链接</button>';
            $(".actions--2qvID").append(html);
            $(".button-download--batch").on("click", obj.showDownloadHomePage);
        }
        else {
            setTimeout(obj.initDownloadHomePage, 1000)
        }
    };

    obj.showDownloadSharePage = function () {
        if (obj.file_page.access_token) {
            obj.showTipLoading("正在获取链接...");
        }
        else {
            obj.showTipError("缺少必要参数，请登陆后刷新此页面重试！");
            return;
        }

        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            console.error("致命错误：获取分享文件列表失败");
            obj.showTipError("致命错误：获取分享文件列表失败");
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
                        if (item.type == "folder") {
                            obj.getShareMultiDownloadUrl([{file_id: item.file_id}], share_id, item.name, function (download_url) {
                                item.download_url = download_url;
                                var html = '<p>' + (++index) + '：' + item.name + '</p>';
                                html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" href="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
                                $(".item-list").append(html);
                            });
                        }
                        else {
                            obj.getShareLinkDownloadUrl(item.file_id, share_id, function (download_url) {
                                item.download_url = download_url;
                                var html = '<p>' + (++index) + '：' + item.name + '</p>';
                                html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" href="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
                                $(".item-list").append(html);
                            });
                        }
                    }, 66 * index);
                }
            });
            obj.hideTip();
        }, 500);
    };

    obj.showDownloadHomePage = function () {
        if (obj.file_page.access_token) {
            obj.showTipLoading("正在获取链接...");
        }
        else {
            obj.showTipError("缺少必要参数，请登陆后刷新此页面重试！");
            return;
        }

        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            console.error("致命错误：获取个人文件列表失败");
            obj.showTipError("致命错误：获取个人文件列表失败");
            return;
        }

        var Re = function(e) {
            var t = document.createElement("a");
            t.rel = "noopener";
            t.href = e;
            t.download = "download";
            //t.target = "_blank";
            (function(e) {
                try {
                    e.dispatchEvent(new MouseEvent("click"))
                } catch (n) {
                    var t = document.createEvent("MouseEvents");
                    t.initMouseEvent("click", !0, !0, window, 0, 0, 0, 80, 20, !1, !1, !1, !1, 0, null);
                    e.dispatchEvent(t);
                }
            }(t));
        };

        obj.showBox('<div class="item-list" style="padding: 20px; height: 410px; overflow-y: auto;"></div>');
        var rowStyle = "margin:10px 0px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;";

        if (fileList.length > 1) {
            var archive_name = "".concat(fileList[0].name, "等").concat(fileList.length, "个文件");
            var fileIdList = [];
            fileList.forEach(function (item, index) {
                fileIdList.push({file_id: item.file_id});
            });
            var drive_id = fileList[0].drive_id;
            obj.getHomeMultiDownloadUrl(fileIdList, drive_id, archive_name, function (download_url) {
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
                    if (item.type == "folder") {
                        html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" href="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
                    }
                    else {
                        html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
                    }
                    $(".item-list").append(html);
                }
                else {
                    setTimeout(function() {
                        if (item.type == "folder") {
                            obj.getHomeMultiDownloadUrl([{file_id: item.file_id}], item.drive_id, item.name, function (download_url) {
                                item.download_url = download_url;
                                var html = '<p>' + (++index) + '：' + item.name + '</p>';
                                html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" href="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
                                $(".item-list").append(html);
                            });
                        }
                        else {
                            obj.getHomeLinkDownloadUrl(item.file_id, item.drive_id, function (download_url) {
                                item.download_url = download_url;
                                var html = '<p>' + (++index) + '：' + item.name + '</p>';
                                html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
                                $(".item-list").append(html);
                            });
                        }
                    }, 66 * index);
                }
            });

            obj.hideTip();

            $(document).on("click", ".item-list a", function(event) {
                var url = $(this).attr("href");
                if (!url) {
                    url = $(this).attr("title");
                    Re(url);
                }
            });
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
            console.error("致命错误：劫持文件列表失败");
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
            var $this = $(this);
            if ($this.attr("data-is-selected") == "true") {
                var data_index = $this.closest("[data-index]").attr("data-index");
                data_index && selectedFileList.push(fileList[data_index]);
            }
        });

        return selectedFileList.length ? selectedFileList : fileList;
    };

    obj.addPageFileList = function () {
        var open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("load", function() {
                if (this.readyState == 4 && this.status == 200) {
                    var response, responseURL = this.responseURL;
                    if (responseURL.indexOf("/token/refresh") > 0) {
                        response = JSON.parse(this.response);
                        if (response.access_token && response.token_type) {
                            obj.file_page.access_token = response.access_token;
                            obj.file_page.token_type = response.token_type;
                        }
                    }
                    else if (responseURL.indexOf("/file/list") > 0) {
                        var parent_file_id = ((location.href.match(/\/folder\/(\w+)/) || [])[1]) || "root";
                        var body = JSON.parse(this.config.body);
                        if (body.parent_file_id != parent_file_id) {
                            //排除【保存 移动 等行为触发】
                            return;
                        }
                        if (parent_file_id != obj.file_page.page_id) {
                            //变换页面
                            obj.file_page.page_id = parent_file_id;
                            obj.file_page.items = [];
                        }

                        response = JSON.parse(this.response);
                        obj.file_page.items = obj.file_page.items.concat(response.items);
                        obj.showTipSuccess("文件列表获取完成 共：" + obj.file_page.items.length + "项");
                    }
                }
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
            url: "https://api.aliyundrive.com/token/refresh",
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

    obj.getHomeMultiDownloadUrl = function (files, drive_id, archive_name, callback) {
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/adrive/v1/file/multiDownloadUrl",
            data: JSON.stringify({
                archive_name: archive_name,
                download_infos: [{
                    drive_id: drive_id,
                    files: files
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

    obj.getHomeLinkDownloadUrl = function (file_id, drive_id, callback) {
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/v2/file/get_download_url",
            data: JSON.stringify({
                drive_id: drive_id,
                file_id: file_id
            }),
            headers: {
                "authorization": "".concat(obj.file_page.token_type || "", " ").concat(obj.file_page.access_token || ""),
                "content-type": "application/json;charset=utf-8"
            },
            async: true,
            success: function (response) {
                if (response.url) {
                    callback && callback(response.url);
                }
                else {
                    console.error("getHomeLinkDownloadUrl 失败", response);
                    callback && callback("");
                }
            },
            error: function (error) {
                console.error("getHomeLinkDownloadUrl 错误", error);
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
            return {};
        }
        try {
            return JSON.parse(n);
        } catch (n) {
            return {};
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
            obj.hideTip();
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
        obj.initDownloadSharePage();

        obj.unlockVideoLimit();
        obj.videoPageOptimization();
    }
    else if (url.indexOf(".aliyundrive.com/drive") > 0) {
        obj.addPageFileList();
        obj.initDownloadHomePage();

        obj.customSharePwd();

        obj.videoPageOptimization();
    }
    console.log("=== 阿里云盘 ===");

    // Your code here...
})();
