// ==UserScript==
// @name         夸克网盘
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.5
// @description  你手捏一片金黄，像一个归来的王
// @author       You
// @match        https://pan.quark.cn/s/*
// @match        https://pan.quark.cn/list*
// @connect      quark.cn
// @icon         https://pan.quark.cn/favicon.ico
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-body
// @grant        GM_xmlhttpRequest
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

    obj.httpListener = function () {
        (function(send) {
            XMLHttpRequest.prototype.send = function (sendParams) {
                this.addEventListener("load", function(event) {
                    if (this.readyState == 4 && this.status == 200) {
                        var response = this.response || this.responseText, responseURL = this.responseURL;
                        if (responseURL.indexOf("/clouddrive/share/sharepage/detail") > 0) {
                            obj.initFileList(response);
                        }
                        else if (responseURL.indexOf("/clouddrive/file/sort") > 0) {
                            if ($(".ant-modal-mask").length && !$(".ant-modal-mask").hasClass("ant-modal-mask-hidden")) return;
                            obj.initFileList(response);
                        }
                    }
                }, false);
                send.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.send);
    };

    obj.initFileList = function (response) {
        try { response = JSON.parse(response) } catch (error) { };
        var list = response?.data?.list;
        if ((list || []).length) {
            var index = parseInt(list.length / 3);
            if (list[index].fid === obj.file_page.share_list[index]?.fid || list[index].fid === obj.file_page.home_list[index]?.fid) {
                return;
            }
            if (obj.getShareId()) {
                obj.file_page.share_list = list;
                obj.showTipSuccess("share文件加载完成 共：" + list.length + "项");
            }
            else {
                obj.file_page.home_list = response.data.list;
                obj.showTipSuccess("home文件加载完成 共：" + list.length + "项");
            }
            obj.initDownloadPage();
        }
    };

    obj.initSharePage = function () {
        obj.httpListener();
        obj.openVideoSharePage();
    };

    obj.initHomePage = function () {
        obj.httpListener();
        if (obj.file_page.home_list.length == 0) {
            obj.getFileListHomePage().then(function (response) {
                obj.initFileList(response);
            });
        }
    };

    obj.initVideoPage = function () {
        obj.autoDelFileVideoPage();
    };

    obj.getFileListHomePage = function () {
        var pdir_fid = ((location.hash.match(/.+\/([a-z\d]{32})/) || []) [1]) || 0;
        return fetch("https://drive.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=" + pdir_fid + "&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc", {
            body: null,
            method: "GET",
            credentials: "include"
        }).then(function (result) {
            return result.ok ? result.json() : Promise.reject();
        }).then(function (result) {
            return result.code == 0 ? result : Promise.reject(result);
        });
    };

    obj.openVideoSharePage = function () {
        $(document).on("click", ".file-click-wrap", function (event) {
            var filelist = obj.getSelectedFileList();
            if (filelist.length == 1 && filelist[0].obj_category == "video") {
                obj.dir().then(function (data) {
                    var pdir_fid = data.pdir_fid;
                    return obj.save(filelist, pdir_fid).then(function (data) {
                        var task_id = data.task_id;
                        return obj.waitTask(task_id).then(function (data) {
                            var fids = data.save_as && data.save_as.save_as_top_fids;
                            var fidsStorage = JSON.parse(sessionStorage.getItem("delete_fids") || "[]");
                            sessionStorage.setItem("delete_fids", JSON.stringify(fidsStorage.concat(fids)));
                            $(".pc-cannot-preview-cancel").click();
                            window.open("https://pan.quark.cn/list#/video/" + fids[0], "_blank");
                            window.onmessage = function (event) {
                                var fids = JSON.parse(sessionStorage.getItem("delete_fids") || "[]");
                                if (event.origin == "https://pan.quark.cn" && event.data && fids.includes(event.data)) {
                                    obj.delete([ event.data ]).then(function (data) {
                                        obj.task(data.task_id).then(function (data) {
                                            fids.splice(fids.indexOf(event.data), 1);
                                            sessionStorage.setItem("delete_fids", JSON.stringify(fids));
                                        });
                                    });
                                }
                            }
                            window.onbeforeunload = function () {
                                var fids = JSON.parse(sessionStorage.getItem("delete_fids") || "[]");
                                obj.delete(fids).then(function (data) {
                                    obj.task(data.task_id).then(function (result) {
                                        sessionStorage.removeItem("delete_fids");
                                    });
                                });
                            };
                        });
                    });
                });
            };
        });
    };

    obj.autoDelFileVideoPage = function () {
        var fid = ((location.hash.match(/video\/(\w+)/) || []) [1]) || "";
        window.onbeforeunload = function () {
            window.opener.postMessage(fid, "/");
        };
    };

    obj.initDownloadPage = function () {
        if ($(".btn-show-link").length) {
            return;
        }
        if ($(".file-info-share-buttom").length) {
            $(".file-info-share-buttom").prepend('<div class="share-downloa btn-show-link" title="自动过滤不可下载文件"><span class="share-downloa-ico"></span><span class="share-downloa-text">显示链接</span></div>');
            $(".btn-show-link").on("click", obj.showDownloadSharePage);
        }
        else if ($(".btn-main").length) {
            $(".btn-main").append('<button type="button" class="ant-btn btn-file btn-show-link" title="自动过滤不可下载文件"><img class="btn-icon" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbC1ydWxlPSJub256ZXJvIiBzdHJva2U9IiM1NTUiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNNiA5bDIgMiAyLTJ6Ii8+PHBhdGggZD0iTTExIDVoMS41NTNjLjg1IDAgMS4xNi4wOTMgMS40Ny4yNjcuMzExLjE3NC41NTYuNDMuNzIyLjc1Ni4xNjYuMzI2LjI1NS42NS4yNTUgMS41NHY0Ljg3M2MwIC44OTItLjA4OSAxLjIxNS0uMjU1IDEuNTQtLjE2Ni4zMjctLjQxLjU4My0uNzIyLjc1Ny0uMzEuMTc0LS42Mi4yNjctMS40Ny4yNjdIMy40NDdjLS44NSAwLTEuMTYtLjA5My0xLjQ3LS4yNjdhMS43NzggMS43NzggMCAwMS0uNzIyLS43NTZjLS4xNjYtLjMyNi0uMjU1LS42NS0uMjU1LTEuNTRWNy41NjNjMC0uODkyLjA4OS0xLjIxNS4yNTUtMS41NC4xNjYtLjMyNy40MS0uNTgzLjcyMi0uNzU3LjMxLS4xNzQuNjItLjI2NyAxLjQ3LS4yNjdIOCIvPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTggMXY5Ii8+PC9nPjwvc3ZnPg=="><span>显示链接</span></button>');
            $(".btn-show-link").on("click", obj.showDownloadHomePage);
        }
        else {
            setTimeout(obj.initDownloadPage, 500);
        }
    };

    obj.showDownloadSharePage = function () {
        var filelist = obj.getSelectedFileList();
        if ((filelist = filelist.filter(function (item) {
            return item.category; // 0: 文件夹
        })).length === 0) return obj.showTipError("未获取到可下载文件");
        obj.downloadUrlSharePage(filelist).then(function (data) {
            obj.showBox(data);
        });
    };

    obj.showDownloadHomePage = function () {
        var filelist = obj.getSelectedFileList();
        if ((filelist = filelist.filter(function (item) {
            return item.category; // 0: 文件夹
        })).length === 0) return obj.showTipError("未获取到可下载文件");
        obj.downloadUrlHomePage(filelist).then(function (data) {
            obj.showBox(data);
        });
    };

    obj.showBox = function (filelist) {
        if (!(filelist && filelist.length)) return;
        var html = '<div class="ant-modal-root show-link-list"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap ant-modal-centered" role="dialog" aria-labelledby="rcDialogTitle0"><div role="document" class="ant-modal move-to-modal" style="width: 720px; transform-origin: 582px 153.5px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><button type="button" aria-label="Close" class="ant-modal-close"><span class="ant-modal-close-x"><i aria-label="图标: close" class="anticon anticon-close ant-modal-close-icon"><svg viewBox="64 64 896 896" focusable="false" class="" data-icon="close" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 0 0 203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"></path></svg></i></span></button><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle0">下载文件</div></div><div class="ant-modal-body"><div class="move-to-container"><ul class="ant-tree ant-tree-directory" role="tree" unselectable="on"></ul></div></div><div class="ant-modal-footer"><div class="move-to-footer "><div class="buttons-wrap"></div></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>';
        $("body").append(html);
        filelist.forEach(function (item, index) {
            var bc = `bc://http/${btoa(unescape(encodeURIComponent(`AA/${encodeURIComponent(item.file_name)}/?url=${encodeURIComponent(item.download_url)}&cookie=${encodeURIComponent(document.cookie)}ZZ`)))}`;
            $(".show-link-list").find(".ant-tree.ant-tree-directory").append('<li class="ant-tree-treenode-switcher-open ant-tree-treenode-selected" role="treeitem"><span class="ant-tree-switcher ant-tree-switcher-noop"></span><a title="' + item.download_url + '" href="' + item.download_url + '">' + item.file_name + '</a><span class="ant-tree-switcher ant-tree-switcher-noop"></span><a title="' + bc + '" href="' + bc + '">比特彗星下载</a></li>');
        });
        $(".show-link-list").find(".ant-modal-close").on("click", function () {
            $(".show-link-list").remove();
        });
        $(".show-link-list .buttons-wrap").prepend('<button type="button" class="ant-btn btn-file"><span>👍点赞不如为爱发电👍</span></button>');
        $(".show-link-list .buttons-wrap").prepend('<button type="button" class="ant-btn btn-file"><span>👍一天不点赞浑身难受👍</span></button>');
        $(".show-link-list .buttons-wrap").prepend('<button type="button" class="ant-btn btn-file"><span>Aria2 推送</span></button>');
        $(".show-link-list .buttons-wrap button:eq(-1)").on("click", function () {
            window.open("https://afdian.net/a/vpannice", "_blank");
        });
        $(".show-link-list .buttons-wrap button:eq(-2)").on("click", function () {
            window.open("https://cdn.jsdelivr.net/gh/tampermonkeyStorage/Self-use@main/appreciation.png", "_blank");
        });
        $(".show-link-list .buttons-wrap button:eq(-3)").on("click", function () {
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
                if (index >= 0) {
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
            if ($this.find("input").get(0)?.checked) {
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

    obj.downloadUrlSharePage = function (filelist) {
        return obj.dir().then(function (data) {
            var pdir_fid = data.pdir_fid;
            return obj.save(filelist, pdir_fid).then(function (data) {
                var task_id = data.task_id;
                return obj.waitTask(task_id).then(function (data) {
                    var fids = data.save_as && data.save_as.save_as_top_fids;
                    return obj.download(fids).finally(function () {
                        obj.delete(fids).then(function (data) {
                            var task_id = data.task_id;
                            obj.task(task_id).catch(function (error) {
                                obj.showTipError(error.message);
                            });
                        });
                    });
                });
            });
        });
    };

    obj.downloadUrlHomePage = function (filelist) {
        return obj.download(filelist);
    };

    obj.dir = function () {
        return fetch("https://drive-pc.quark.cn/1/clouddrive/share/sharepage/dir?pr=ucpro&fr=pc", {
            body: null,
            method: "GET",
            credentials: "include"
        }).then(function (result) {
            return result.ok ? result.json() : Promise.reject();
        }).then(function (result) {
            return result.code == 0 ? result.data : Promise.reject(result);
        });
    };

    obj.save = function (filelist, to_pdir_fid) {
        var fid_list = [], fid_token_list = [];
        (Array.isArray(filelist) ? filelist : [ filelist ]).filter(Boolean).forEach(function (item) {
            fid_list.push(item.fid);
            fid_token_list.push(item.share_fid_token);
        });
        var _share_args = sessionStorage.getItem("_share_args")
        , value = JSON.parse(_share_args).value
        , pwd_id = value.pwd_id
        , stoken = value.stoken;
        return fetch("https://drive-pc.quark.cn/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc", {
            body: JSON.stringify({
                fid_list: fid_list,
                fid_token_list: fid_token_list,
                pdir_fid: "0",
                pwd_id: pwd_id,
                scene: "link",
                stoken: stoken,
                to_pdir_fid: to_pdir_fid || "0",
            }),
            method: "POST",
            credentials: "include"
        }).then(function (result) {
            return result.ok ? result.json() : Promise.reject();
        }).then(function (result) {
            return result.code == 0 ? result.data : Promise.reject(result);
        });
    };

    obj.waitTask = function (task_id, retry_index = 0) {
        return obj.task(task_id, retry_index).then(function (data) {
            if (data.status) {
                return data;
            }
            else {
                if (retry_index < 10) {
                    return obj.delay().then(function () {
                        return obj.waitTask(task_id, ++retry_index);
                    });
                }
                else {
                    return Promise.reject(data);
                }
            }
        });
    };

    obj.task = function (task_id, retry_index = 0) {
        return fetch("https://drive-pc.quark.cn/1/clouddrive/task?pr=ucpro&fr=pc&task_id=" + task_id + "&retry_index=" + retry_index, {
            body: null,
            method: "GET",
            credentials: "include"
        }).then(function (result) {
            return result.ok ? result.json() : Promise.reject();
        }).then(function (result) {
            return result.code == 0 ? result.data : Promise.reject(result);
        });
    };

    obj.download = function (filelist) {
        var fids = filelist.map(function (item) {
            return item.fid || item;
        });
        return fetch("https://drive-pc.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc", {
            headers: {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json;charset=UTF-8"
            },
            body: JSON.stringify({
                fids: fids
            }),
            method: "POST",
            credentials: "include"
        }).then(function (result) {
            return result.ok ? result.json() : Promise.reject(result);
        }).then(function (result) {
            return result.code == 0 ? result.data : Promise.reject(result);
        }).catch(function (erroe) {
            return obj.fetch("https://drive-pc.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc", {
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json;charset=UTF-8"
                },
                body: JSON.stringify({
                    fids: fids
                }),
                method: "POST",
            }).then(function (result) {
                return result.code == 0 ? result.data : Promise.reject(result);
            });
        });
    };

    obj.delete = function (filelist) {
        (Array.isArray(filelist) ? filelist : [ filelist ]).map(function(n) {
            return n?.fid || n;
        }).filter(Boolean);
        return fetch("https://drive-pc.quark.cn/1/clouddrive/file/delete?pr=ucpro&fr=pc", {
            headers: {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json;charset=UTF-8"
            },
            body: JSON.stringify({
                action_type: 2,
                exclude_fids: [],
                filelist: filelist
            }),
            method: "POST",
            credentials: "include"
        }).then(function (result) {
            return result.ok ? result.json() : Promise.reject();
        }).then(function (result) {
            return result.code == 0 ? result.data : Promise.reject(result);
        });
    };

    obj.fetch = function (url, option) {
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: option.method || "POST",
                url: url,
                data: option.body,
                headers: Object.assign({
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json;charset=UTF-8",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/3.0.2 Chrome/100.0.4896.160 Electron/18.3.5.12-a038f7b798 Safari/537.36 Channel/pckk_clouddrive_share_ch"
                }, option.headers),
                responseType: "json",
                onload: function (result) {
                    var response = result.response || result.responseText;
                    if (parseInt(result.status / 100) == 2) {
                        resolve(response);
                    }
                    else {
                        reject(response);
                    }
                },
                onerror: function (result) {
                    reject(result.error);
                }
            });
        });
    };

    obj.delay = function (ms = 500) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
