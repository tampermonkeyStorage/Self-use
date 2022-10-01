// ==UserScript==
// @name         夸克网盘
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.2
// @description  你手捏一片金黄，像一个归来的王
// @author       You
// @match        https://pan.quark.cn/s/*
// @match        https://pan.quark.cn/list*
// @icon         https://pan.quark.cn/favicon.ico
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-body
// @grant none
// ==/UserScript==

(function () {
    'use strict';
    var $ = $ || window.$;
    var obj = {
        file_page: {
            share_list: [],
            home_list: [],
        }
    };

    obj.initSharePage = function () {
        obj.initPageFileList();
        obj.initSharePageVideoFile();
    };

    obj.initHomePage = function () {
        obj.initPageFileList();
        if (obj.file_page.home_list.length == 0) {
            obj.getHomePageFileList().then(function (result) {
                if (result && result.data && result.data.list.length) {
                    obj.file_page.home_list = result.data.list;
                    obj.initDownloadPage();
                }
            });
        }
    };

    obj.initVideoPage = function () {
        obj.autoResolution();
        obj.autoDelFileVideoPage();
    };

    obj.initSharePageVideoFile = function () {
        $(document).on("click", ".file-click-wrap", function (event) {
            var filelist = obj.getSelectedFileList();
            if (filelist.length == 1 && filelist[0].obj_category == "video") {
                obj.saveFileList(filelist).then(function (result) {
                    result && result.data && setTimeout(function () {
                        obj.taskFileList(result.data.task_id).then(function (result) {
                            if (result && result.code !== 0) return obj.showTipError(result.message);
                            var fids = result && result.data && result.data.save_as && result.data.save_as.save_as_top_fids;
                            if (Array.isArray(fids) && fids.length) {
                                $(".pc-cannot-preview-cancel").click();

                                var fidsStorage = JSON.parse(sessionStorage.getItem("delete_fids") || "[]");
                                sessionStorage.setItem("delete_fids", JSON.stringify(fidsStorage.concat(fids)));

                                window.open("https://pan.quark.cn/list#/video/" + fids[0], "_blank");

                                window.onmessage = function(event) {
                                    var fids = JSON.parse(sessionStorage.getItem("delete_fids") || "[]");
                                    if (event.origin == "https://pan.quark.cn" && event.data && fids.includes(event.data)) {
                                        obj.deleteFileList([ event.data ]).then(function (result) {
                                            result && result.data && obj.taskFileList(result.data.task_id).then(function (result) {
                                                if (result && result.code !== 0) return obj.showTipError(result.message);
                                                fids.splice(fids.indexOf(event.data), 1);
                                                sessionStorage.setItem("delete_fids", JSON.stringify(fids));
                                            });
                                        });
                                    }
                                }
                                window.onbeforeunload = function () {
                                    var fids = JSON.parse(sessionStorage.getItem("delete_fids") || "[]");
                                    obj.deleteFileList(fids).then(function (result) {
                                        result && result.data && obj.taskFileList(result.data.task_id).then(function (result) {
                                            if (result && result.code !== 0) return obj.showTipError(result.message);
                                            sessionStorage.removeItem("delete_fids");
                                        });
                                    });
                                };
                            }
                        });
                    }, 1e3);
                });
            };
        });
    };

    obj.getHomePageFileList = function () {
        var pdir_fid = ((location.hash.match(/all\/(\w+)/) || []) [1]) || 0;
        return obj.fetch("https://drive.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=" + pdir_fid + "&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc", null, "GET");
    };

    obj.playFile = function (fid) {
        fid || (fid = ((location.hash.match(/video\/(\w+)/) || []) [1]) || "");
        return obj.fetch("https://drive.quark.cn/1/clouddrive/file/v2/play?pr=ucpro&fr=pc", {
            fid: fid,
            resolutions: "normal,low,high,super,2k,4k",
            supports: "fmp4",
            use_right: "free_limit"
        }, "POST");
    };

    obj.initDownloadPage = function () {
        if ($(".btn-show-link").length) {
            return;
        }
        if ($(".file-info-share-buttom").length) {
            $(".file-info-share-buttom").prepend('<div class="share-downloa btn-show-link" title="请勿勾选文件夹"><span class="share-downloa-ico"></span><span class="share-downloa-text">显示链接</span></div>');
            $(".btn-show-link").on("click", obj.showDownloadSharePage);
        }
        else if ($(".btn-operate").length) {
            $(".btn-operate").append('<button type="button" class="ant-btn btn-file btn-show-link" title="请勿勾选文件夹"><span>显示链接</span></button>');
            $(".btn-show-link").on("click", obj.showDownloadHomePage);
        }
        else {
            setTimeout(obj.initDownloadPage, 500);
        }
    };

    obj.showDownloadSharePage = function () {
        var filelist = obj.getSelectedFileList();
        if (filelist.length == 0) return obj.showTipError("文件获取失败");

        obj.saveFileList(filelist).then(function (result) {
            setTimeout(function () {
                result && result.data && obj.taskFileList(result.data.task_id).then(function (result) {
                    if (result && result.code !== 0) return obj.showTipError(result.message);
                    var fids = result && result.data && result.data.save_as && result.data.save_as.save_as_top_fids;
                    fids && fids.length && obj.getDownloadUrl(fids).then(function (result) {
                        obj.showBox(result.data);

                        obj.deleteFileList(fids).then(function (result) {
                            result && result.data && obj.taskFileList(result.data.task_id).then(function (result) {
                                if (result && result.code !== 0) return obj.showTipError(result.message);
                            });
                        });
                    });
                });
            }, 1e3);
        });
    };

    obj.showDownloadHomePage = function () {
        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) return obj.showTipError("文件获取失败");

        var fids = [];
        fileList.forEach(function (item, index) {
            fids.push(item.fid);
        });
        obj.getDownloadUrl(fids).then(function (result) {
            obj.showBox(result.data);
        });
    };

    obj.showBox = function (filelist) {
        if (!(filelist && filelist.length)) return;
        var html = '<div class="ant-modal-root show-link-list"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap ant-modal-centered" role="dialog" aria-labelledby="rcDialogTitle0"><div role="document" class="ant-modal move-to-modal" style="width: 720px; transform-origin: 582px 153.5px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><button type="button" aria-label="Close" class="ant-modal-close"><span class="ant-modal-close-x"><i aria-label="图标: close" class="anticon anticon-close ant-modal-close-icon"><svg viewBox="64 64 896 896" focusable="false" class="" data-icon="close" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 0 0 203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"></path></svg></i></span></button><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle0">下载文件</div></div><div class="ant-modal-body"><div class="move-to-container"><ul class="ant-tree ant-tree-directory" role="tree" unselectable="on"></ul></div></div><div class="ant-modal-footer"><div class="move-to-footer "><div class="buttons-wrap"></div></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>';
        $("body").append(html);
        filelist.forEach(function (item, index) {
            $(".show-link-list").find(".ant-tree.ant-tree-directory").append('<li class="ant-tree-treenode-switcher-open ant-tree-treenode-selected" role="treeitem"><span class="ant-tree-switcher ant-tree-switcher-noop"></span><a title="' + item.download_url + '" href="' + item.download_url + '" style="color: blue;">' + item.file_name + '</a></li>');
        });
        $(".show-link-list").find(".ant-modal-close").on("click", function () {
            $(".show-link-list").remove();
        });

        $(".show-link-list .buttons-wrap").prepend('<button type="button" class="ant-btn btn-file"><span>👍一天不点赞浑身难受👍</span></button>');
        $(".show-link-list .buttons-wrap button:eq(-1)").on("click", function () {
            window.open("https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png", "_blank");
        });
        $(".show-link-list .buttons-wrap").prepend('<button type="button" class="ant-btn btn-file"><span>Aria2 推送</span></button>');
        $(".show-link-list .buttons-wrap button:eq(-2)").on("click", function () {
            var $this = $(this), $text = $this.text();
            $this.text("正在推送");
            var downData = [];
            filelist.forEach(function (item, index) {
                downData.push({
                    id: "",
                    jsonrpc: "2.0",
                    method: "aria2.addUri",
                    params:[
                        //"token:你的RPC密钥", // 替换你的RPC密钥
                        [ item.download_url ],
                        {
                            out: item.file_name,
                            dir: "D:\/quarkDownloads", // 下载路径
                            referer: "https://pan.quark.cn/",
                            "user-agent": navigator.userAgent,
                            header: [`cookie: ${document.cookie}`]
                        }
                    ]
                });
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
        });
    };

    obj.aria2RPC = function (downData, callback) {
        var urls = ["http://127.0.0.1:6800/jsonrpc", "http://localhost:16800/jsonrpc"];
        var url = sessionStorage.getItem("aria-url");
        $.ajax({
            type: "POST",
            url: url || urls[0],
            data: JSON.stringify(downData),
            crossDomain: true,
            processData: false,
            contentType: "application/json",
            success: function(result){
                url || sessionStorage.setItem("aria-url", this.url);
                callback && callback(result);
            },
            error: function (error) {
                var index = urls.indexOf(this.url);
                if (url) {
                    if (index < urls.length - 1) {
                        sessionStorage.setItem("aria-url", urls[index + 1]);
                        setTimeout(function() { obj.aria2RPC(downData, callback) }, 500);
                    }
                    else {
                        sessionStorage.removeItem("aria-url");
                        callback && callback("");
                    }
                }
                else {
                    sessionStorage.setItem("aria-url", urls[index + 1]);
                    setTimeout(function() { obj.aria2RPC(downData, callback) }, 500);
                }
            }
        });
    };

    obj.getSelectedFileList = function () {
        var list = obj.getShareId() ? obj.file_page.share_list : obj.file_page.home_list, fids = [];
        $(".ant-table-body tbody tr").each(function () {
            var $this = $(this);
            if ($this.find("input").get(0).checked) {
                fids.push($this.attr("data-row-key"));
            }
        });
        if (fids.length) {
            return list.filter(function (item) {
                return fids.includes(item.fid);
            });
        }
        else {
            return list;
        }
    };

    obj.getDownloadUrl = function (fids) {
        return obj.fetch("https://drive.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc", {fids: fids}, "POST");
    };

    obj.saveFileList = function (filelist, to_pdir_fid) {
        Array.isArray(filelist) || (filelist = [ filelist ]);
        var fid_list = [], fid_token_list = [];
        filelist.forEach(function (item) {
            fid_list.push(item.fid);
            fid_token_list.push(item.share_fid_token);
        });
        var _share_args = sessionStorage.getItem("_share_args")
        , value = JSON.parse(_share_args).value
        , pwd_id = value.pwd_id
        , stoken = value.stoken;

        return obj.fetch("https://drive.quark.cn/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc", {
            to_pdir_fid: to_pdir_fid || "0",
            fid_list: fid_list,
            fid_token_list: fid_token_list,
            pwd_id: pwd_id,
            stoken: stoken,
            pdir_fid: "0"
        }, "POST");
    };

    obj.deleteFileList = function (filelist) {
        Array.isArray(filelist) || (filelist = [ filelist ]);
        if (filelist.length == 0) return;
        var fid_list = [];
        filelist.forEach(function (item) {
            item && item.fid && fid_list.push(item.fid);
        });

        return obj.fetch("https://drive.quark.cn/1/clouddrive/file/delete?pr=ucpro&fr=pc", {
            action_type: 2,
            filelist: fid_list.length ? fid_list : filelist,
            exclude_fids: []
        }, "POST");
    };

    obj.taskFileList = function (task_id) {
        return obj.fetch("https://drive.quark.cn/1/clouddrive/task?pr=ucpro&fr=pc&task_id=" + task_id + "&retry_index=0", null, "GET");
    };

    obj.fetch = function (url, body, method) {
        return fetch(url, {
            headers: {
                "content-type": "application/json"
            },
            referrer: "https://pan.quark.cn/",
            referrerPolicy: "strict-origin-when-cross-origin",
            body: body ? JSON.stringify(body) : body,
            method: method || "POST",
            mode: "cors",
            credentials: "include"
        }).then(function (result) {
            return result.ok ? result.json() : "";
        }).catch(function(error) {
            console.error("fetch error", error);
        });
    };

    obj.autoDelFileVideoPage = function () {
        var fid = ((location.hash.match(/video\/(\w+)/) || []) [1]) || "";
        window.onbeforeunload = function () {
            window.opener.postMessage(fid, "/");
        };
    };

    obj.autoResolution = function () {
        var qbox = $(".keep-quality-text-box.keep-quality-active");
        if (qbox.length) {
            if (qbox.text() == "流畅") {
                obj.playFile().then(function (result) {
                    var video_list = result && result.data && result.data.video_list;
                    if (Array.isArray(video_list) && video_list.length) {
                        obj.defaultResolution(video_list);
                    }
                });
            }
        }
        else {
            setTimeout(obj.autoResolution, .5e3);
        }
    };

    obj.defaultResolution = function (video_list) {
        var findIndex = video_list.findIndex(function (item, index) {
            return item.video_info;
        })
        , video_info = video_list[findIndex].video_info;
        try {
            var video = document.querySelector("video");
            if (video.src !== video_info.url) {
                $(".keep-quality-text-box").eq(findIndex).click();
            }
            video.oncanplay = () => {
                video.play();
            };
        } catch (e) {
            throw new Error("\u753b\u8d28\u5207\u6362\u5f02\u5e38".concat(e))
        }
    };

    obj.getShareId = function () {
        return (window.location.pathname || "").split("/").slice(2)[0] || "";
    };

    obj.showTipSuccess = function (message, timeout) {
        if ($(".ant-message").length == 0) {
            $("body").append('<div class="ant-message"><span></span></div>');
        }
        $(".ant-message span").append('<div class="ant-message-notice"><div class="ant-message-notice-content"><div class="ant-message-custom-content ant-message-success"><i aria-label="icon: check-circle" class="anticon anticon-check-circle"><svg viewBox="64 64 896 896" focusable="false" class="" data-icon="check-circle" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 0 1-51.7 0L318.5 484.9c-3.8-5.3 0-12.7 6.5-12.7h46.9c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H699c6.5 0 10.3 7.4 6.5 12.7z"></path></svg></i><span>' + message + '</span></div></div></div>');
        setTimeout(function () {
            $(".ant-message span").empty();
        }, timeout || 3e3)
    };

    obj.showTipError = function (message, timeout) {
        if ($(".ant-message").length == 0) {
            $("body").append('<div class="ant-message"><span></span></div>');
        }
        $(".ant-message span").append('<div class="ant-message-notice"><div class="ant-message-notice-content"><div class="ant-message-custom-content ant-message-error"><i aria-label="icon: close-circle" class="anticon anticon-close-circle"><svg viewBox="64 64 896 896" focusable="false" class="" data-icon="close-circle" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm165.4 618.2l-66-.3L512 563.4l-99.3 118.4-66.1.3c-4.4 0-8-3.5-8-8 0-1.9.7-3.7 1.9-5.2l130.1-155L340.5 359a8.32 8.32 0 0 1-1.9-5.2c0-4.4 3.6-8 8-8l66.1.3L512 464.6l99.3-118.4 66-.3c4.4 0 8 3.5 8 8 0 1.9-.7 3.7-1.9 5.2L553.5 514l130 155c1.2 1.5 1.9 3.3 1.9 5.2 0 4.4-3.6 8-8 8z"></path></svg></i><span>' + message + '</span></div></div></div>');
        setTimeout(function () {
            $(".ant-message span").empty();
        }, timeout || 3e3)
    };

    obj.initPageFileList = function () {
        var open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("load", function() {
                if (this.readyState == 4 && this.status == 200) {
                    var responseURL = this.responseURL, response = this.response;
                    if (responseURL.indexOf("/clouddrive/share/sharepage/detail") > 0) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response && response.data && response.data.list.length) {
                            obj.file_page.share_list = response.data.list;
                            obj.initDownloadPage();
                            obj.showTipSuccess("share文件加载完成 共：" + response.data.list.length + "项");
                        }
                    }
                    else if (responseURL.indexOf("/clouddrive/file/sort") > 0) {
                        if ($(".ant-modal-mask").length && $(".ant-modal-mask").hasClass("ant-modal-mask-hidden") == false) return;
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response && response.data && response.data.list.length) {
                            obj.file_page.home_list = response.data.list;
                            obj.initDownloadPage();
                            obj.getShareId() || obj.showTipSuccess("home文件加载完成 共：" + response.data.list.length + "项");
                        }
                    }
                }
            }, false);
            open.apply(this, arguments);
        };
    };

    obj.run = function () {
        var url = location.href;
        if (url.indexOf(".quark.cn/s/") > 0) {
            obj.initSharePage();
        }
        else if (url.indexOf(".quark.cn/list") > 0) {
            if (url.indexOf(".quark.cn/list#/video/") > 0) {
                obj.initVideoPage();
            }
            else {
                obj.initHomePage();
            }
        }
    }();

    console.log("=== 夸克网盘 好棒棒！===");

    // Your code here...
})();