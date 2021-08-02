// ==UserScript==
// @name         天翼云盘-下载不求人
// @namespace    http://tampermonkey.net/
// @version      0.4.2
// @description  让下载成为一件愉快的事情
// @author       You
// @match        https://cloud.189.cn/web/*
// @match        https://h5.cloud.189.cn/*
// @icon         https://cloud.189.cn/web/logo.ico
// @require      https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @require      https://cdn.bootcdn.net/ajax/libs/crypto-js/4.0.0/crypto-js.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
 
(function() {
    'use strict';
    var $ = $ || window.$;
    var obj = {
        file_page: {
            folderId: -11,
            shareInfo: {},
            fileListAO: {},
            sessionKey: ""
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
        if (window.IsPC) {
            var $Vue = (document.querySelector(".content") || document.querySelector(".p-web")).__vue__;
            if (opts.type == "loading") {
                $Vue.$loading.show(opts);
            }
            else {
                $Vue.$toast.show(opts);
            }
        }
        else if (window.app) {
            opts.type = (opts.type).replace("error", "fail");
            window.app.$toast.show(opts);
        }
    };
 
    obj.hideNotify = function() {
        if (window.IsPC) {
            var $Vue = (document.querySelector(".content") || document.querySelector(".p-web")).__vue__;
            $Vue.$toast.hide();
            $Vue.$loading.hide();
        }
        else if (window.app) {
            window.app.$toast.hide();
            window.app.$loading.hide();
        }
    };
 
    obj.getFileSize = function(e, t, n, i) {
        if (!(e && e.toString().search(/B|K|M|G|T/) > -1)) {
            var o, a, r, s = parseFloat(e), l = Math.abs(s);
            void 0 === t && (t = 2);
            void 0 === n && (n = !0);
            l < 1024 ? (t = 0, o = s, a = "B") :
            l < 921600 ? (o = s / 1024, a = "K") :
            l < 943718400 ? (o = s / 1048576, a = "M") :
            l < 966367641600 || 0 === t && l < 1099511627776 ? (o = s / 1073741824, a = "G") :
            (o = s / 1099511627776, a = "T");
            o = (Math.round(o * Math.pow(10, t)) / parseFloat(Math.pow(10, t))).toFixed(t);
            r = i && t > 0 ? o !== Math.floor(o) ? o : parseInt(Math.floor(o), 10) : o;
            n && (r += a);
            return r;
        }
        else {
            return e;
        }
    };
 
    obj.getSignatureMobile = function (e) {
        for (var t = 1; t < arguments.length; t++) {
            var n = arguments[t];
            for (var r in n) {
                Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r])
            }
        }
        var i = []
        for (var s in e){
            i.push(s + "=" + e[s]);
        }
        i.sort(function(e, t) {
            return e > t ? 1 : e < t ? -1 : 0
        })
        e = i.join("&");
        return CryptoJS.MD5(e).toString();
    };
 
    obj.getDownloadUrlMobile = function (fileId, shareId) {
        var accessToken = localStorage.getItem("accessToken").replace(/[\"\\]/g, "")
        , timestamp = Date.now()
        , data = Object.assign({
            AccessToken: accessToken,
            Timestamp: timestamp,
            fileId: fileId
        }, shareId ? {dt: 1, shareId: shareId} : {})
        , signature = obj.getSignatureMobile(data);
 
        return new Promise(function (resolve) {
            $.ajax({
                url: "https://api.cloud.189.cn/open/file/getFileDownloadUrl.action" + "?fileId=" + fileId + (shareId ? "&dt=1&shareId=" + shareId : ""),
                headers: {
                    Accept: "application/json;charset=UTF-8",
                    AccessToken: accessToken,
                    Signature: signature,
                    "Sign-Type": 1,
                    Timestamp: timestamp
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
 
    obj.buildPackageUrlMobile = function (folderId, shareId) {
        var url = "https://api.cloud.189.cn/downloadMultiFiles.action";
    };
 
    obj.getSelectedFileListMobile = function () {
        var fileListAO = obj.file_page.fileListAO;
        if (fileListAO.count == 0) {
            return fileListAO.fileList || fileListAO.folderList || [];
        }
 
        var selectedFileList = [], selectedNotFileList = [], fileList = [];
        var $route = window.app.$route;
        if (["singleFile", "MultiFile"].includes($route.name)) {
            fileListAO.folderList.forEach(function (item) {
                item.isFolder = true;
                selectedFileList.push(item);
            });
            selectedFileList.push.apply(selectedFileList, fileListAO.fileList);
        }
        else if (["cloud", "family"].includes($route.name)) {
        }
 
        if (selectedFileList.length) {
            return selectedFileList;
        }
        else {
            return selectedNotFileList;
        }
    };
 
    obj.showBoxMobile = function (body) {
        var template = '<div class="mask"></div><div class="dialog"><div class="confirm-header"><h2 class="confirm-title">文件下载</h2></div> <div class="confirm-body" style="max-height: 10rem;"></div><div class="confirm-footer"> <button class="btn confirm-btn confirm success">取消</button></div></div>';
        if ($(".confirm-container").length == 0) {
            $("body").append('<div class="dialog-container confirm-container"><!----> <!----></div>');
        }
 
        $(".confirm-container").append(template);
        $(".confirm-container .confirm-body").append(body);
        $(".confirm-container").show();
 
        $(".confirm-container .confirm-btn").off("click").on("click", function () {
            $(".confirm-container").hide();
            $(".confirm-container .mask").remove();
            $(".confirm-container .dialog").remove();
        });
    };
 
    obj.showDownloadMobile = function () {
        if (! localStorage.getItem("accessToken")) {
            obj.showTipError("无法显示链接，请登录后重试");
            return;
        }
 
        var fileList = obj.getSelectedFileListMobile();
        if (fileList.length == 0) {
            obj.showTipError("getSelectedFileListMobile 获取选中文件出错");
            return;
        }
 
        obj.showTipLoading("正在获取链接...");
        var html = '<div style="padding: 0px; height: 350px; overflow-y: auto;">';
        var rowStyle = "margin:10px 0px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;";
 
        var shareInfo = obj.file_page.shareInfo,
            shareId = Object.keys(shareInfo).length > 0 ? shareInfo.shareId : "";
 
        var retCount = 0;
        fileList.forEach(function (item, index) {
            if (item.isFolder) {
                //item.downloadUrl = obj.buildPackageUrlMobile(item.id, shareId);
                html += '<p>' + (++index) + '：' + (item.name ? item.name : item.id) + ' || <font color="green">文件夹</font></p>';
                //html += '<p style="' + rowStyle + '"><a title="' + item.downloadUrl + '" href="' + item.downloadUrl + '" style="color: blue;">' + item.downloadUrl + '</a></p>';
                retCount++;
            }
            else {
                obj.getDownloadUrlMobile(item.id, shareId).then(function (downloadUrl) {
                    item.downloadUrl = downloadUrl;
                    html += '<p>' + (++index) + '：' + (item.name ? item.name : item.id) + ' || <font color="green">' + obj.getFileSize(item.size) + '</font></p>';
                    html += '<p style="' + rowStyle + '"><a title="' + item.downloadUrl + '" href="' + item.downloadUrl + '" style="color: blue;">' + item.downloadUrl + '</a></p>';
                    retCount++;
                });
            }
        });
        var waitId = setInterval(function(){
            if (retCount == fileList.length){
                html += '</div>';
                obj.showBoxMobile(html);
                obj.hideNotify();
                clearInterval(waitId);
            }
        }, 500);
    };
 
    obj.initDownloadPageMobile = function () {
        if ($(".btn-show-link").length) {
            return;
        }
        if ($(".btn-group").length) {
            $(".btn-group").append('<div data-v-3645ff0d="" class="item nomal btn-show-link">显示链接</div>');
            $(".btn-show-link").on("click", obj.showDownloadMobile);
        }
    };
 
    obj.getDownloadUrl = function (fileId, shareId) {
        return new Promise(function (resolve) {
            $.ajax({
                url: "https://cloud.189.cn/api/open/file/getFileDownloadUrl.action" + "?noCache".concat(Math.random(), "&fileId=").concat(fileId, "&dt=").concat(1, "&shareId=").concat(shareId || ""),
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
 
    obj.buildPackageUrl = function (folderId, shareId) {
        var sessionKey = obj.file_page.sessionKey || sessionStorage.getItem("sessionKey");
        if (sessionKey) {
            return "https://cloud.189.cn/downloadMultiFiles.action?sessionKey=" + sessionKey + "&fileIdS=" + folderId + "&downloadType=" + (shareId ? 3 : 1) + (shareId ? "&shareId=" + shareId : "");
        }
        else {
            return ""
        }
    };
 
    obj.getSelectedFileList = function () {
        var fileListAO = obj.file_page.fileListAO;
        if (fileListAO.count == 0) {
            return fileListAO.fileList || fileListAO.folderList || [];
        }
 
        var $Vue = document.querySelector(".c-file-list").__vue__;
        if ($Vue instanceof Object) {
            if ($Vue.selectLength > 0) {
                return $Vue.selectedList;
            }
            else {
                return $Vue.fileList;
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
        var login_user = window._ux21cn.cookie.get("COOKIE_LOGIN_USER");
        if (!login_user || login_user.length == 16) {
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
 
        var shareInfo = obj.file_page.shareInfo,
            shareId = Object.keys(shareInfo).length > 0 ? shareInfo.shareId : "";
 
        if (fileList.length > 1 && obj.file_page.folderId > 0) {
            var downloadUrl = obj.buildPackageUrl(obj.file_page.folderId, shareId);
            html += '<p>压缩包</p>';
            html += '<p style="' + rowStyle + '"><a title="' + downloadUrl + '" href="' + downloadUrl + '" style="color: blue;">' + downloadUrl + '</a></p>';
            html += '<p>&nbsp;</p>';
        }
 
        var retCount = 0;
        fileList.forEach(function (item, index) {
            item.id || (item.id = item.fileId);
            item.name || (item.name = item.fileName);
            item.size || (item.size = item.fileSize);
 
            if (item.isFolder) {
                item.downloadUrl = item.downloadUrl || obj.buildPackageUrl(item.id, shareId);
                html += '<p>' + (++index) + '：' + (item.name ? item.name : item.id) + ' || <font color="green">文件夹</font></p>';
                html += '<p style="' + rowStyle + '"><a title="' + item.downloadUrl + '" href="' + item.downloadUrl + '" style="color: blue;">' + item.downloadUrl + '</a></p>';
                retCount++;
            }
            else {
                if (item.downloadUrl) {
                    html += '<p>' + (++index) + '：' + (item.name ? item.name : item.id) + ' || <font color="green">' + obj.getFileSize(item.size) + '</font></p>';
                    html += '<p style="' + rowStyle + '"><a title="' + item.downloadUrl + '" href="' + item.downloadUrl + '" style="color: blue;">' + item.downloadUrl + '</a></p>';
                    retCount++;
                }
                else {
                    obj.getDownloadUrl(item.id, shareId).then(function (downloadUrl) {
                        item.downloadUrl = downloadUrl;
                        html += '<p>' + (++index) + '：' + (item.name ? item.name : item.id) + ' || <font color="green">' + obj.getFileSize(item.size) + '</font></p>';
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
                if (responseURL.indexOf("/getUserBriefInfo.action") > 0) {
                    if (response.sessionKey) {
                        obj.file_page.sessionKey = response.sessionKey;
                    }
                }
                if (response instanceof Object && response.res_code == 0) {
                    if (responseURL.indexOf("/getShareInfoByCode.action") > 0) {
                        if (response.shareId) {
                            obj.file_page.shareInfo = response;
                        }
                    }
                    else if (responseURL.indexOf("/listShareDir.action") > 0 || responseURL.indexOf("/listFiles.action") > 0) {
                        obj.file_page.folderId = (/shareDirFileId=(\d+)/.exec(responseURL) || /folderId=(\d+)/.exec(responseURL) || [])[1] || -11;
                        if (response.fileListAO) {
                            obj.file_page.fileListAO = response.fileListAO;
                            if (window.app) {
                                obj.initDownloadPageMobile();
                            }
                            else {
                                obj.initDownloadPage();
                            }
                            obj.showTipSuccess("文件加载完成 共：" + (response.fileListAO.count || (response.fileListAO.fileList || []).length) + "项");
                        }
                    }
                }
            }, false);
            open.apply(this, arguments);
        };
    }();
 
    // Your code here...
})();
