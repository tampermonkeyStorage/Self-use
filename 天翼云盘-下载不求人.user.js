// ==UserScript==
// @name         天翼云盘-下载不求人
// @namespace    http://tampermonkey.net/
// @version      0.5.3
// @description  让下载成为一件愉快的事情
// @author       You
// @match        https://cloud.189.cn/web/*
// @icon         https://cloud.189.cn/web/logo.ico
// @require      https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var $ = $ || window.$;
    var obj = {
        file_page: {
            shareId: ""
        }
    };

    obj.showTipSuccess = function (text, time) {
        obj.showNotify({
            type: "success",
            text: text,
            time: time || 3000
        });
    };

    obj.showTipError = function (text, time) {
        obj.showNotify({
            type: "error",
            text: text,
            time: time || 3000
        });
    };

    obj.showTipLoading = function (text, time) {
        obj.showNotify({
            type: "loading",
            text: text,
            time: time || 3000
        });
    };

    obj.showNotify = function (opts) {
        var $Vue = (document.querySelector(".content") || document.querySelector(".p-web")).__vue__;
        if (opts.type == "loading") {
            $Vue.$loading.show(opts);
        }
        else {
            $Vue.$toast.show(opts);
        }
    };

    obj.hideNotify = function() {
        var $Vue = (document.querySelector(".content") || document.querySelector(".p-web")).__vue__;
        $Vue.$toast.hide();
        $Vue.$loading.hide();
    };

    obj.getDownloadUrl = function (fileId, shareId) {
        return new Promise(function (resolve) {
            $.ajax({
                url: "https://cloud.189.cn/api/open/file/getFileDownloadUrl.action?noCache=".concat(Math.random(), "&fileId=").concat(fileId, "&dt=1").concat(shareId ? "&shareId=" + shareId : ""),
                headers: {
                    accept: "application/json;charset=UTF-8"
                },
                async: true,
                success: function (t) {
                    if (0 === t.res_code) {
                        resolve(t.fileDownloadUrl);
                    }
                    else if ("InfoSecurityErrorCode" === t.res_code) {
                        obj.showTipError("文件内容违规，下载失败");
                        resolve("");
                    }
                    else {
                        obj.showTipError("下载失败，网络错误，刷新重试");
                        resolve("");
                    }
                },
                error: function () {
                    obj.showTipError("网络错误，刷新重试");
                    resolve("");
                }
            });
        });
    };

    obj.getSelectedFileList = function () {
        var $Vue;
        if (document.querySelector(".c-file-list")) {
            $Vue = document.querySelector(".c-file-list").__vue__;
            if ($Vue.selectLength > 0) {
                return $Vue.selectedList;
            }
            else {
                return $Vue.fileList;
            }
        }
        else if (document.querySelector(".info-detail")) {
            $Vue = document.querySelector(".info-detail").__vue__;
            if (Object.keys($Vue.fileDetail).length) {
                return [$Vue.fileDetail];
            }
            else {
                return [];
            }
        }
        else {
            return [];
        }
    };

    obj.showBox = function (body) {
        var template = '<div data-v-8956c4ce="" class="share-content"><div data-v-8956c4ce="" class="share-content-head"><span data-v-8956c4ce="" class="share-content-head-span">文件下载</span><span data-v-8956c4ce="" class="share-content-head-close">×</span></div><div data-v-8956c4ce="" class="share-detail" style="height: 450px;"></div>';
        if ($(".c-share").length == 0) {
            $("body").append('<section data-v-8956c4ce="" class="c-share" style="display: none;"></section>');
        }

        $(".c-share").append(template);
        $(".c-share .share-detail").append(body);
        $(".c-share").show();

        $(".c-share .share-content-head-close").off("click").on("click", function () {
            $(".c-share").hide();
            $(".c-share .share-content").remove();
        });
    };

    obj.showDownload = function () {
        var $Vue = document.querySelector(".p-main").__vue__;
        if (!$Vue.isLogin) {
            obj.showTipError("无法显示链接，请登录后重试");
            return;
        }

        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            obj.showTipError("getSelectedFileList 获取选中文件出错");
            return;
        }

        obj.showTipLoading("正在获取链接...");
        var html = '<div style="padding: 20px; height: 450px; overflow-y: auto;">';
        var rowStyle = "margin:10px 0px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;";

        var shareId = location.href.match("/web/main/") ? null : obj.file_page.shareId;
        var retCount = 0;
        fileList.forEach(function (item, index) {
            console.log(item);
            if (item.isFolder) {
                html += '<p>' + (++index) + '：' + (item.fileName ? item.fileName : item.fileId) + ' || <font color="green">请进入文件夹下载</font></p>';
                html += '<p style="' + rowStyle + '"></p>';
                retCount++;
            }
            else {
                if (item.downloadUrl) {
                    html += '<p>' + (++index) + '：' + (item.fileName ? item.fileName : item.fileId) + ' || <font color="green">' + item.fileSize + '</font></p>';
                    html += '<p style="' + rowStyle + '"><a title="' + item.downloadUrl + '" href="' + item.downloadUrl + '" style="color: blue;">' + item.downloadUrl + '</a></p>';
                    retCount++;
                }
                else {
                    obj.getDownloadUrl(item.fileId, shareId).then(function (downloadUrl) {
                        item.downloadUrl = downloadUrl;
                        html += '<p>' + (++index) + '：' + (item.fileName ? item.fileName : item.fileId) + ' || <font color="green">' + item.fileSize + '</font></p>';
                        html += '<p style="' + rowStyle + '"><a title="' + item.downloadUrl + '" href="' + item.downloadUrl + '" style="color: blue;">' + item.downloadUrl + '</a></p>';
                        retCount++;
                    });
                }
            }
        });
        var waitId = setInterval(function(){
            if (retCount == fileList.length){
                html += '</div>';
                obj.showBox(html);
                obj.hideNotify();
                clearInterval(waitId);
            }
        }, 500);
    };

    obj.initDownloadPage = function () {
        if ($(".btn-show-link").length) {
            return;
        }
        if ($(".file-operate").length) {
            $(".file-operate").append('<a data-v-7d1d0e5d class="btn btn-show-link" style="background: #2b89ea; position: relative">显示链接</a>');
            $(".btn").css({"margin-left": "5px", "margin-right": "5px"});
            $(".tips-save-box").css("display", "none");
            $(".btn-show-link").on("click", obj.showDownload);
        }
        else if ($(".FileHead_file-head-left_3AuQ6").length) {
            $(".FileHead_file-head-left_3AuQ6").append('<div class="FileHead_file-head-upload_kgWbF btn btn-show-link">显示链接</div>');
            $(".btn-show-link").on("click", obj.showDownload);
        }
    };

    obj.initPageFileInfo = function () {
        var open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("load", function() {
                if (! (this.readyState == 4 && this.status == 200)) {
                    return;
                }

                var responseURL = this.responseURL;
                var response = this.response;
                if (response instanceof Object && response.res_code == 0) {
                    if (responseURL.indexOf("/checkAccessCode.action") > 0 || responseURL.indexOf("/getShareInfoByCodeV2.action") > 0) {
                        if (response.shareId) {
                            obj.file_page.shareId = response.shareId;
                        }
                    }
                    else if (responseURL.indexOf("/listShareDir.action") > 0 || responseURL.indexOf("/listFiles.action") > 0) {
                        if (response.fileListAO) {
                            obj.initDownloadPage();
                            obj.showTipSuccess("文件加载完成 共：" + (response.fileListAO.count || (response.fileListAO.fileList || []).length) + "项");
                        }
                    }
                }
            }, false);
            open.apply(this, arguments);
        };
    }();

    console.log("=== 天翼云盘 ===");

    // Your code here...
})();
