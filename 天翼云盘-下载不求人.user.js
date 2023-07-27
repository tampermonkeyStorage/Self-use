// ==UserScript==
// @name         天翼云盘-下载不求人
// @namespace    http://tampermonkey.net/
// @version      0.8.1
// @description  让下载成为一件愉快的事情
// @author       You
// @match        https://cloud.189.cn/web/*
// @connect      189.cn
// @icon         https://cloud.189.cn/web/logo.ico
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.staticfile.org/blueimp-md5/2.19.0/js/md5.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';
    var $ = $ || window.$;
    var obj = {};

    obj.showTipSuccess = function (text, time) {
        obj.showNotify({
            type: "success",
            text: text
        });
    };

    obj.showTipError = function (text, time) {
        obj.showNotify({
            type: "error",
            text: text
        });
    };

    obj.showTipLoading = function (text, time) {
        obj.showNotify({
            type: "loading",
            text: text
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

    obj.getFinalUrl = function (url) {
        return new Promise(function (resolve) {
            const xhr = GM_xmlhttpRequest({
                url: url,
                method: "get",
                onreadystatechange: function(response) {
                    if (response.readyState === 4 || response.finalUrl !== url) {
                        xhr.abort();
                        if (!xhr.mark) {
                            xhr.mark = true;
                            resolve(response.finalUrl);
                        }
                    }
                },
                onerror: function (error) {
                    resolve("");
                }
            });
        });
    };

    obj.getAccessToken = function () {
        var accessToken = localStorage.getItem("accessToken");
        if (accessToken) return Promise.resolve(accessToken);
        return obj.getFinalUrl("https://api.cloud.189.cn/open/oauth2/ssoH5.action").then(function (location) {
            if (location) {
                var accessToken = (/accessToken=(.+)/.exec(location) || [])[1];
                accessToken && localStorage.setItem("accessToken", accessToken);
                return accessToken;
            }
            else {
                return "";
            }
        });
    };

    obj.getSignature = function (e) {
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
        return window.md5(e);
    };

    obj.getFileDownloadUrl = function (fileId, shareId) {
        var accessToken = localStorage.getItem("accessToken").replace(/[\"\\]/g, "")
        , timestamp = Date.now()
        , data = Object.assign({
            AccessToken: accessToken,
            Timestamp: timestamp,
            fileId: fileId
        }, shareId ? {dt: 1, shareId: shareId} : {})
        , signature = obj.getSignature(data);

        return new Promise(function (resolve) {
            $.ajax({
                url: "https://api.cloud.189.cn/open/file/getFileDownloadUrl.action?fileId=" + fileId + (shareId ? "&dt=1&shareId=" + shareId : ""),
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
                    localStorage.removeItem("accessToken");
                    resolve("");
                }
            });
        });
    };

    obj.getDownloadUrl = function (fileId, shareId) {
        if (localStorage.getItem("accessToken")) {
            return obj.getFileDownloadUrl(fileId, shareId);
        }
        else {
            return Promise.resolve("");
        }
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
        var html = '<section class="Directory_c-directory-list_wNNms show-link-list" style=""><div class="Directory_directory-content_22Yq7"><div class="Directory_directory-content-head_31-xU"><h3>显示链接</h3><span></span></div><div class="Directory_directory-content-wrapper_4Ezq3"><div class="Directory_directory-content-list_1yQ2p" style="height:410px;">' + body + '</div></div><div class="Directory_directory-content-bottom_2h5CC"><div class="Directory_button-group_23dIK"><button class="Directory_directory-button_PJfdV">打赏作者</button><button class="Directory_directory-button_PJfdV">复制全部链接</button></div><div class="Directory_button-group_23dIK"></div><div class="Directory_button-group_23dIK"><button class="Directory_directory-button-confirm_YFyF3 close">关闭</button></div></div></div></section>';
        $(".Directory_c-directory-list_wNNms").parent().append(html);
        $(".show-link-list").find(".close").on("click", function () {
            $(".show-link-list").remove();
        });
        $(".show-link-list .Directory_button-group_23dIK:eq(0) button:eq(0)").on("click", function () {
            window.open("https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png", "_blank");
        });
        $(".show-link-list .Directory_button-group_23dIK:eq(0) button:eq(1)").on("click", function () {
            var urls = [];
            $(".show-link-list a").each(function (index, value) {
                urls.push(this.href);
            });
            if (urls.length) {
                GM_setClipboard(urls.join("\r\n"));
                obj.showTipSuccess(urls.length + " 条链接已复制");
            }
        });
    };

    obj.showDownload = function () {
        var $Vue = document.querySelector(".main-box").__vue__;
        var accessToken = localStorage.getItem("accessToken");
        if (!$Vue.isLogin && !accessToken) {
            return obj.showTipError("无法显示链接，请登录后重试");
        }

        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            return obj.showTipError("getSelectedFileList 获取选中文件出错");
        }

        obj.showTipLoading("正在获取链接...");
        var html = '<div style="padding: 20px; height: 410px;">';
        var rowStyle = "margin:10px 0px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;";

        var retCount = 0;
        fileList.forEach(function (item, index) {
            if (item.isFolder) {
                html += '<p>' + (++index) + '：' + (item.fileName ? item.fileName : item.fileId) + ' || <font color="green">请进入文件夹下载</font></p>';
                html += '<p style="' + rowStyle + '"></p>';
                retCount++;
            }
            else {
                if (item.downloadUrl) {
                    html += '<p>' + (++index) + '：' + (item.fileName ? item.fileName : item.fileId) + '</p>';
                    html += '<p style="' + rowStyle + '"><a title="' + item.downloadUrl + '" href="' + item.downloadUrl + '" style="color: blue;">' + item.downloadUrl + '</a></p>';
                    retCount++;
                }
                else {
                    obj.getDownloadUrl(item.fileId, item.shareId).then(function (downloadUrl) {
                        item.downloadUrl = downloadUrl;
                        html += '<p>' + (++index) + '：' + (item.fileName ? item.fileName : item.fileId) + '</p>';
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
        }, 200);
    };

    obj.initDownloadPage = function () {
        if ($(".btn-show-link").length) {
            return;
        }
        if ($(".file-operate").length) {
            var node = document.querySelector(".file-operate a"), attrName = node ? node.getAttributeNames()[0] : "";
            $(".file-operate").append('<a ' + attrName + ' class="btn btn-show-link" style="margin-left: 60px;background: #2b89ea; position: relative">显示链接</a>');
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
                if (this.readyState == 4 && this.status == 200) {
                    var responseURL = this.responseURL;
                    if (responseURL.indexOf("/listShareDir.action") > 0 || responseURL.indexOf("/listFiles.action") > 0) {
                        var response = this.response;
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response && response.res_code == 0 && response.fileListAO) {
                            obj.initDownloadPage();
                            obj.showTipSuccess("文件加载完成 共：" + (response.fileListAO.count || (response.fileListAO.fileList || []).length) + "项");
                            obj.getAccessToken().then(function (accessToken) {
                                if (!accessToken && GM_info.scriptHandler === "Violentmonkey") obj.showTipError("无法适配暴力猴，请更换脚本管理器"); //v2.13.1
                            });
                        }
                    }
                }
            }, false);
            open.apply(this, arguments);
        };
    }();

    console.info("=== 天翼云盘 好棒棒！===");

    // Your code here...
})();
