// ==UserScript==
// @name         我是网盘管家婆
// @namespace    http://tampermonkey.net/
// @version      0.4.6
// @description  支持网盘：【百度.蓝奏.天翼.阿里.迅雷.微云.彩云】 功能概述：【[1]：网盘页面增加资源搜索快捷方式】【[2]：[资源站点]自动识别失效链接，自动跳转，防止手忙脚乱】【[3]：访问过的分享链接和密码自动记忆】【[4]：本地缓存数据库搜索】
// @antifeature  tracking 若密码忘记，从云端查询，有异议请不要安装
// @author       管家婆
// @match        *://*/*
// @icon         https://scpic.chinaz.net/Files/pic/icons128/7231/o4.png
// @connect      baidu.com
// @connect      fryaisjx.lc-cn-n1-shared.com
// @connect      api.kinh.cc
// @require      https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @require      https://cdn.staticfile.org/jquery/3.6.0/jquery.min.js
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';
    var $ = $ || window.$ || unsafeWindow.$;

    /*=====================================================================================================================*/
    var obj = {
        share_pwd: null,
        share_randsk: null
    };

    obj.showTip = function(stx) {
        if (!unsafeWindow.sms) {
            $("body").prepend('<div id="sms"><span id="smsspan"></span></div>');
            var css = [
                "#sms{display:none;z-index:999999;text-align:center;position:fixed;top:40px;left:0px;right:0px;width:auto;height:30px;margin-left:auto;margin-right:auto;line-height:1.2em}",
                "#smsspan{padding:2px 5px;background:rgba(0,0,0,.7);color:#fff;font-size:14px;padding:5px 8px;border-radius:3px}"
            ];
            $("<style></style>").text(css.join("\n")).appendTo(document.head || document.documentElement);

            unsafeWindow.sms = function (stx) {
                document.getElementById("sms").style.display="none";
                $("#smsspan").text(stx);
                document.getElementById("sms").style.display="block";
                setTimeout(function(){ document.getElementById("sms").style.display="none"; }, 3000);
            }
        }

        unsafeWindow.sms(stx);
    };

    obj.showTipSuccess = function(stx) {
        obj.showTip(stx);
        $("#smsspan").css({background: "rgba(0,128,0,.7)"});
    };

    obj.showTipError = function(stx) {
        obj.showTip(stx);
        $("#smsspan").css({background: "rgba(255,0,0,.7)"});
    };

    obj.isInArray = function(arr) {
        for (var i = 0; i < arr.length; i++) {
            if (location.href.indexOf(arr[i]) >= 0) {
                return true;
            }
        }
        return false;
    };

    obj.getShareId = function (shareLink) {
        shareLink = shareLink || location.href;
        if (shareLink.indexOf("pan.baidu.com") > 0 || shareLink.indexOf("yun.baidu.com") > 0) {
            return (/baidu.com\/(?:s\/1|(?:share|wap)\/init\?surl=)([\w-]{5,25})/.exec(shareLink) || [])[1];
        }
        else if (shareLink.indexOf("cloud.189.cn") > 0) {
            return (/cloud\.189\.cn[a-z\d\/\?\.#]*(?:code=|\/t\/)([\w]{12})/.exec(shareLink) || [])[1];
        }
        else if (/[\w-]*\.?lanzou.?\.com/.test(shareLink)) {
            return (/lanzou.?\.com\/[\w]+\/([\w]+)/.exec(shareLink) || /lanzou.?\.com\/([\w]+)/.exec(shareLink) || [])[1];
        }
        else if (shareLink.indexOf("pan.xunlei.com") > 0) {
            return (/pan\.xunlei\.com\/s\/([\w-]+)/.exec(shareLink) || [])[1];
        }
        else if (shareLink.indexOf("aliyundrive.com") > 0) {
            return (/aliyundrive\.com\/s\/([a-zA-Z\d]+)/.exec(shareLink) || [])[1];
        }
        else if (shareLink.indexOf("caiyun.139.com") > 0) {
            return (/caiyun\.139\.com\/w\/[ri]\/([a-zA-Z\d]+)/.exec(shareLink) || [])[1];
        }
        else if (shareLink.indexOf("share.weiyun.com") > 0) {
            return (/share\.weiyun\.com\/([a-zA-Z\d]+)/.exec(shareLink) || [])[1];
        }
        else {
            return "";
        }
    };

    obj.getSharePwdLocal = function(shareId) {
        var shareList = GM_getValue("share_list") || {};
        return shareList[shareId] || obj.getParam("pwd");
    };

    obj.setSharePwdLocal = function(shareData) {
        if (shareData instanceof Object) {
            var shareList = GM_getValue("share_list") || {};
            var shareId = shareData.share_id;
            shareList[shareId] = shareData;
            GM_setValue("share_list", shareList);
        }
    };

    obj.removeSharePwdLocal = function (shareId) {
        var shareList = GM_getValue("share_list") || {};
        if (shareList.hasOwnProperty(shareId)) {
            delete shareList[shareId];
            GM_setValue("share_list", shareList);
        }
    };

    obj.ajax = function(option) {
        var details = {
            method: option.type || "get",
            url: option.url,
            responseType: option.dataType,
            onload: function(result) {
                if (!result.status || parseInt(result.status / 100) == 2) {
                    var response = result.response;
                    try {
                        response = JSON.parse(response);
                    } catch(a) {};
                    option.success && option.success(response);
                } else {
                    console.error("http返回错误", result);
                    option.error && option.error(result);
                }
            },
            onerror: function(result) {
                console.error("http请求失败", result);
                option.error && option.error(result.error);
            }
        };

        if (option.data instanceof Object) {
            details.data = Object.keys(option.data).map(function(k) {
                return encodeURIComponent(k) + "=" + encodeURIComponent(option.data[k]).replace("%20", "+");
            }).join("&");
        } else {
            details.data = option.data
        }

        if (option.type.toUpperCase() == "GET" && details.data) {
            details.url = option.url + "?" + details.data;
            details.data = "";
        }

        if (option.headers) {
            details.headers = option.headers;
        }

        if (option.timeout) {
            details.timeout = option.timeout;
        }

        GM_xmlhttpRequest(details);
    };

    obj.storeSharePwd = function(shareData, callback) {
        obj.ajax({
            type: "post",
            url: "https://fryaisjx.lc-cn-n1-shared.com/1.1/classes/".concat(shareData.share_source),
            data: JSON.stringify(shareData),
            headers: {
                "Content-Type": "application/json;charset=UTF-8",
                "X-LC-Id": "FrYaIsJxDFzqqgeaT6tHjAjo-gzGzoHsz",
                "X-LC-Key": "exPA65fcqUGqfbuRFIJIwNUU"
            },
            success: function (response) {
                callback && callback(response);
            },
            error: function () {
                callback && callback("");
            }
        });
    };

    obj.querySharePwd = function(shareSource, shareId, callback) {
        obj.ajax({
            type: "get",
            url: "https://fryaisjx.lc-cn-n1-shared.com/1.1/classes/".concat(shareSource, "?where=").concat(JSON.stringify({share_id: shareId})),
            headers: {
                "Content-Type": "application/json;charset=UTF-8",
                "X-LC-Id": "FrYaIsJxDFzqqgeaT6tHjAjo-gzGzoHsz",
                "X-LC-Key": "exPA65fcqUGqfbuRFIJIwNUU"
            },
            success: function (response) {
                if (response instanceof Object && Array.isArray(response.results)) {
                    callback && callback(response.results[response.results.length - 1]);
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

    obj.queryShareRandsk = function (shareSource, shareId, callback) {
        obj.ajax({
            type: "get",
            url: "https://api.kinh.cc/BaiDu/Share/Query.php?ShareUrl=1" + shareId + "&type=BaiduCloud",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            success: function (response) {
                if (response instanceof Object && response.status == 0) {
                    response = Object.assign({
                        share_randsk: response.Randsk
                    }, response);
                    callback && callback(response);
                }
                else {
                    callback && callback("");
                }
            },
            error: function (error) {
                callback && callback("");
            }
        });
    };

    obj.setCookie = function (e, o, t, i, c) {
        var s = new Date , a = "" , r = "";
        s.setDate(s.getDate() + t);
        c && (a = ";domain=" + c);
        i && (r = ";path=" + i);
        document.cookie = e + "=" + encodeURIComponent(o) + (null == t ? "" : ";expires=" + s.toGMTString()) + r + a;
    };

    obj.randString = function(length) {
        var possible = "abcdefghijklmnopqrstuvwxyz0123456789";
        var text = "";
        for (var i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    };

    obj.getParam = function(e, t) {
        var n = new RegExp("(?:^|\\?|#|&)" + e + "=([^&#]*)(?:$|&|#)", "i"),
            i = n.exec(t || location.href);
        return i ? i[1] : ""
    };

    obj.initDialog = function () {
        obj.dialogCss();

        obj.dialogNode();

        obj.addWebItems();

        obj.dialogEvent();
    };

    obj.dialogCss = function () {
        var cssArr = [
            ".dialog-dialog{z-index:999999;width:100%;height:100%;position:fixed;top:0;left:0;bottom:0;background-color:rgba(0,0,0,0.5);display:none;justify-content:center;align-items:center;box-shadow:0 0.5rem 1rem rgba(0,0,0,0.15) !important}",
            ".dialog-dialog .dialog-body{width:888px;padding:10px 10px 10px 10px;background-color:#fff;border-radius:5px;margin-top:0px}",
            ".dialog-dialog .dialog-extra{font-size:12px;color:#878c9c;line-height:18px;text-align:center;height:47 px;padding-top:15 px;background-color:#f5f6fa;border-top:1 px solid #f0f0f2}",
            ".dialog-dialog .dialog-header{background-color:#fafdff;user-select:none;font-size:20px;font-weight:bold;border-bottom:1px solid #ddd;padding-bottom:10px}",
            ".dialog-dialog .dialog-close{user-select:none;float:right;font-size:20px;cursor:pointer;padding-right:10px}",
            ".dialog-dialog .dialog-close:hover{color:#e74c3c}",
            ".dialog-dialog .dialog-menus{padding:1px;border-bottom:1px solid #ddd;border-style:ridge}",
            ".dialog-dialog .dialog-menus p{line-height:30px;border-style:ridge}",
            ".dialog-dialog button{width:20%;height:30px;background-color:#fafdff;color:#03081A;}",
            ".dialog-dialog .btn-cache-search{margin:0 35px;}",
            ".dialog-dialog .active{background-color:#06a7ff;color:#fff;}",
            ".dialog-dialog .cache-count{width:18%;height:25px;color:green;font-weight:900;;font-size:20px;;text-align:center;}",
            ".dialog-dialog .cache-clear{color:red;float:right}",
            ".dialog-dialog .find-key{width:78%;height:25px;}",
            ".dialog-dialog .find-share{color:green;float:right}",

            ".dialog-dialog .web-items{width:100%;max-height:400px;overflow-y:auto;box-sizing:border-box;padding:1px;}",
            ".dialog-dialog .web-items:hover::-webkit-scrollbar{width:5px}",
            ".dialog-dialog .web-items::-webkit-scrollbar{width:0;height:0}",
            ".dialog-dialog .web-items::-webkit-scrollbar-thumb{background-color:#95a5a6}",
            ".dialog-dialog .web-items::-webkit-scrollbar-track{box-shadow:inset 0 0 5px rgba(0,0,0,0.2);background:#dddddd}",
            ".dialog-dialog .web-items .item{border-bottom:1px solid #ddd;padding:5px;white-space:wrap;word-break:break-all;font-size:15px}",
            ".dialog-dialog .cache-items span{font-size:15px;font-weight:600}",
            ".dialog-dialog .web-items em{color:green;margin-right:0.2rem;font-style:normal}",

            ".dialog-dialog .cache-items{width:100%;max-height:400px;overflow-y:auto;box-sizing:border-box;padding:1px 10px 1px 10px}",
            ".dialog-dialog .cache-items:hover::-webkit-scrollbar{width:5px}",
            ".dialog-dialog .cache-items::-webkit-scrollbar{width:0;height:0}",
            ".dialog-dialog .cache-items::-webkit-scrollbar-thumb{background-color:#95a5a6}",
            ".dialog-dialog .cache-items::-webkit-scrollbar-track{box-shadow:inset 0 0 5px rgba(0,0,0,0.2);background:#dddddd}",
            ".dialog-dialog .cache-items .item{border-bottom:1px solid #ddd;padding:5px;white-space:wrap;word-break:break-all;font-size:15px}",
            ".dialog-dialog .cache-items .item:last-child{border-bottom:none}",
            ".dialog-dialog .cache-items .item a.cache-link{color:#2980b9;text-decoration:none}",
            ".dialog-dialog .cache-items .item a.cache-link:hover{text-decoration:underline}",
            ".dialog-dialog .cache-items .item .pwd{color:green;margin-left:1rem}",
            ".dialog-dialog .cache-items em{color:green;margin-right:0.2rem;font-style:normal}",
            ".dialog-dialog .cache-items span{font-size:15px;font-weight:600}",
        ];
        $("<style></style>").text(cssArr.join("\n")).appendTo(document.head || document.documentElement);
    };

    obj.dialogNode = function () {
        if ($(".dialog-dialog").length == 0) {
            var html = '<div class="dialog-dialog"><div class="dialog-body"><div class="dialog-header">资源搜索<span class="dialog-close">X</span></div><div class="dialog-menus"><p><button class="btn-web-search active">资源站点搜索</button><button class="btn-cache-search">本地缓存搜索</button>存储数量：<input type="text" readonly="readonly" value="0" class="cache-count"><button class="cache-clear">清空缓存</button></p><p><input type="text" class="find-key" placeholder="请输入搜索关键字（本地搜索支持：链接、提取码、文件名、等）"><button class="find-share">查找分享</button></p></div><div class="web-items"></div><div class="cache-items"></div></div></div>'
            $(document.body).append(html);

            var shareList = GM_getValue("share_list") || {};
            $(".dialog-dialog .cache-count").val(Object.keys(shareList).length);
        }
    };

    obj.dialogEvent = function () {
        $(".dialog-dialog .dialog-close").click(function() {
            $(".dialog-dialog .cache-share").empty();
            $(".dialog-dialog").css({display: "none"});
        });

        $(".btn-web-search, .btn-cache-search").click(function() {
            var innerText = this.innerText, $this = $(this);
            if (innerText == "资源站点搜索") {
                if ($this.hasClass("active") == false) {
                    $this.addClass("active");
                    $this.next().removeClass("active");
                }
                $(".dialog-dialog .cache-items").css({display: "none"});
                $(".dialog-dialog .web-items").css({display: "block"});
            }
            else if (innerText == "本地缓存搜索") {
                $this.toggleClass("active", true);
                $this.prev().removeClass("active");
                $(".dialog-dialog .cache-items").empty();
                $(".dialog-dialog .web-items").css({display: "none"});
                $(".dialog-dialog .cache-items").css({display: "block"});
            }
        });

        $(".dialog-dialog .cache-clear").click(function() {
            var shareList = GM_getValue("share_list") || {};
            if (Object.keys(shareList).length > 0) {
                if (window.confirm("确定清空本地缓存吗？")) {
                    GM_deleteValue("share_list");
                    shareList = GM_getValue("share_list") || {};
                    $(".dialog-dialog .cache-count").val(Object.keys(shareList).length);
                };
            }
        });

        $(".dialog-dialog .find-share").click(function() {
            var innerText = $(".dialog-dialog .dialog-menus .active").text();
            if (innerText == "资源站点搜索") {
                obj.addWebItems();

                var $active = $(".dialog-dialog .web-items .active");
                if ($active.length) {
                    var dataSource = $active.attr("data-source");
                    var dataIndex = $active.attr("data-index");
                    var webValue = $(".dialog-dialog .find-key").val();
                    var searchList = obj.searchList()[dataSource];
                    var searchLink = searchList[dataIndex].link.replace("%s", webValue);
                    if (searchLink) {
                        setTimeout(function() { window.open(searchLink); }, 500);
                    }
                }
                else {
                    alert("请在下方选中一个资源搜索引擎");
                }
            }
            else if (innerText == "本地缓存搜索") {
                var cacheValue = $(".dialog-dialog .find-key").val();
                if (!cacheValue) {
                    alert("支持对任意字段搜索（例如：链接、提取码、文件名、等）");
                    return;
                }
                $(".dialog-dialog .cache-items").empty();

                var index = 0;
                var shareList = GM_getValue("share_list") || {};
                Object.keys(shareList).forEach(function(shareId) {
                    var oneShare = shareList[shareId];
                    var strShare = Object.values(oneShare).join(" ");
                    if (strShare.indexOf(cacheValue) >= 0) {
                        var source = {baidu: "百度", lanzous: "蓝奏", ty189: "天翼", xunlei: "迅雷", aliyundrive: "阿里", caiyun: "彩云", weiyun: "微云"}[oneShare.share_source];
                        var html = '<div><em>['.concat(++index) + ']</em><span>'.concat('<em>[ ' + source + ' ]</em>').concat(oneShare.share_name || (oneShare.origin_title || "").split("-")[0] || "") + '</span></div>';
                        html += '<div class="item">链接：<a class="cache-link" href="'.concat(oneShare.share_url, '" target="_blank">').concat(oneShare.share_url, '</a><span class="pwd">').concat(oneShare.share_pwd ? "提取码：" + oneShare.share_pwd : "", "</span></div>");
                        $(".dialog-dialog .cache-items").append(html);
                    }
                });
            }
        });

        $(".find-key").keydown(function(e) {
            //输入框回车事件
            if (e.keyCode == 13) {
                $(".dialog-dialog .find-share").click();
            }
        });

        $(".dialog-dialog .web-items button").click(function() {
            var $this = $(this);
            if ($this.hasClass("active")) {
                $(".dialog-dialog .find-share").click();
            }
            else {
                $this.siblings().removeClass("active");
                $this.addClass("active");
            }
        });

        $(".dialog-dialog").click(function (event) {
            if ($(event.target).closest(".dialog-body").length == 0) {
                $(".dialog-dialog .dialog-close").click();
            }
        });
    };

    obj.addWebItems = function () {
        if ($(".dialog-dialog .web-items .item").length == 0) {
            var searchList = obj.searchList();
            Object.keys(searchList).forEach(function(shareSource) {
                var sourceName = {baidu: "百度", lanzous: "蓝奏", ty189: "天翼", xunlei: "迅雷", aliyundrive: "阿里", caiyun: "彩云", weiyun: "微云"}[shareSource] + "资源搜索引擎";
                $(".dialog-dialog .web-items").append('<span><em>[ ' + sourceName + ' ]</em></span><br/>');

                searchList[shareSource].forEach(function(item, index) {
                    var html = '<button class="item" data-source="' + shareSource + '" data-index="' + index + '">' + item.name + '</button>';
                    $(".dialog-dialog .web-items").append(html);
                });

                $(".dialog-dialog .web-items").append('<div style="border-bottom-style:double;"></div><br/>');
            });
        }
    };

    obj.searchList = function() {
        //此列表不分先后，不定时更新
        return {
            "baidu": [
                {
                    name: "小猪快盘",
                    link: "https://www.xiaozhukuaipan.com/s/search?q=%s",
                    type: 2,
                },
                {
                    name: "来搜一下",
                    link: "https://www.laisoyixia.com/s/search?q=%s",
                    type: 2,
                },
                {
                    name: "找云盘",
                    link: "http://www.zhaoyunpan.cn/share_search.php?key=%s&type=ALL",
                    type: 2,
                },
                {
                    name: "淘易搜",
                    link: "http://www.taoyisou.com/s?k=%s",
                    type: 3,
                },
                {
                    name: "易搜盘",
                    link: "http://www.yisopan.com/s?key=%s",
                    type: 3,
                },
                {
                    name: "V盘搜",
                    link: "http://www.vpansou.com/query?wd=%s",
                    type: 3,
                },
                {
                    name: "微盘搜索",
                    link: "http://www.vpanso.com/s?wd=%s",
                    type: 3,
                },
                {
                    name: "坑搜网",
                    link: "http://www.kengso.com/s?wd=%s",
                    type: 3,
                },
                {
                    name: "热盘搜",
                    link: "http://www.repanso.com/q?wd=%s",
                    type: 3,
                },
                {
                    name: "西瓜搜搜",
                    link: "http://www.xgsoso.com/s?wd=%s",
                    type: 3,
                },
                {
                    name: "乐乐搜索",
                    link: "http://www.lele360.com/search?word=%s",
                    type: 3,
                },
                /*
                {
                    name: "大漠盘搜",
                    link: "http://www.dmpans.com/search?wd=%s",
                    type: 3,
                },
                {
                    name: "盘么么",
                    link: "http://www.panmeme.com/query?key=%s",
                    type: 3,
                },
                {
                    name: "Pan58",
                    link: "http://www.pan58.com/s?wd=%s",
                    type: 3,
                },
                */
                {
                    name: "58网盘",
                    link: "http://www.58wangpan.com/search/kw%s",
                    type: 4,
                },
                {
                    name: "搜盘8",
                    link: "https://www.soupan8.com/search/kw%s",
                    type: 4,
                },
                {
                    name: "aizhaomu",
                    link: "https://aizhaomu.com/search/kw%s",
                    type: 4,
                },
                {
                    name: "好去网",
                    link: "https://www.haogow.com/search?keyword=%s",
                    type: 5,
                },
                {
                    name: "乌鸦搜",
                    link: "https://www.wuyasou.com/search?keyword=%s",
                    type: 5,
                },
                {
                    name: "小悠家",
                    link: "http://888.xuj.cool/?s=%s",
                    type: 5,
                },
                {
                    name: "知识库",
                    link: "https://book.zhishikoo.com/?s=%s",
                    type: 5,
                },
                {
                    name: "小说搜搜",
                    link: "https://www.xssousou.com/s/%s.html",
                    type: 5,
                },
                {
                    name: "熊猫搜书",
                    link: "https://ebook.huzerui.com/#/",
                    type: 5,
                },
                {
                    name: "小白盘",
                    link: "https://www.xiaobaipan.com/list-%s.html",
                    type: 6,
                },

                {
                    name: "Java分享网",
                    link: "http://yun.java1234.com/search?q=%s",
                    type: 6,
                },
                // 《7》点击直达百度盘
                {
                    name: "学霸盘",
                    link: "https://www.xuebapan.com/s/%s-1.html",
                    type: 1,
                },
                {
                    name: "UPanSo",
                    link: "https://disk.upanso.com/main/leftSearch?time=ALL&kw=%s&diskType=ALL",
                    type: 7,
                },
                {
                    name: "99搜索",
                    link: "http://www.99baiduyun.com/baidu/%s",
                    type: 7,
                },
                {
                    name: "橘子盘搜",
                    link: "https://www.nmme.cc/s/1/%s",
                    type: 7,
                },
                // 《8》不用扫码
                {
                    name: "51网盘搜索",
                    link: "https://m.51caichang.com/so?keyword=%s&page=1&url_path=so",
                    type: 8,
                },
                {
                    name: "云搜大师",
                    link: "https://www.xxhh360.com/search?q=%s",
                    type: 8,
                },
                {
                    name: "熊猫搜盘",
                    link: "http://www.sopandas.com/s/%s",
                    type: 8,
                },
                {
                    name: "网盘007",
                    link: "https://wp7.net/share/kw%s",
                    type: 8,
                },
                {
                    name: "网盘搜索",
                    link: "http://www.kaclub.cn/search?q=%s",
                    type: 8,
                },
                {
                    name: "搜度",
                    link: "http://www.sodu123.com/sodu/so.php?q=%s",
                    type: 8,
                },
                {
                    name: "百度搜吧",
                    link: "https://www.bdsoba.com/search/type_0_1_%s",
                    type: 8,
                },

                //不能直接搜索
                {
                    name: "云盘狗",
                    link: "http://www.yunpangou.com",
                    type: 8,
                },
                // 《9》需要扫码
                {
                    name: "小马盘",
                    link: "http://www.xiaomapan.com/#/main/search?kw=%s",
                    type: 9,
                },
                {
                    name: "大力盘",
                    link: "http://www.dalipan.com/#/main/search?kw=%s",
                    type: 9,
                },
                {
                    name: "大圣盘",
                    link: "http://www.dashengpan.com/#/main/search?kw=%s",
                    type: 9,
                },
                {
                    name: "白马盘",
                    link: "https://www.baimapan.com/#/main/search?keyword=%s",
                    type: 9,
                },
                {
                    name: "玉白盘",
                    link: "https://www.yubaipan.com/#/main/search?keyword=%s",
                    type: 9,
                },
                {
                    name: "飞飞盘",
                    link: "http://www.feifeipan.com/#/main/search?kw=%s",
                    type: 9,
                },
                {
                    name: "飞猪盘",
                    link: "http://www.feizhupan.com/#/main/search?keyword=%s",
                    type: 9,
                },
                {
                    name: "毕方铺",
                    link: "https://www.iizhi.cn/resource/search/%s",
                    type: 9,
                },
                {
                    name: "盘他一下",
                    link: "https://www.panother.com/search?query=%s",
                    type: 9,
                },
                {
                    name: "飞鱼盘搜",
                    link: "http://feiyu100.cn/search",
                    type: 10,
                },
                {
                    name: "Fastsoso",
                    link: "https://www.fastsoso.cn/search?k=%s",
                    type: 10,
                },
                {
                    name: "兄弟盘",
                    link: "https://www.xiongdipan.com/search?k=%s",
                    type: 10,
                },
                {
                    name: "猪猪盘",
                    link: "http://www.zhuzhupan.com/paysuccess?id=%s||_||&_t=" + Date.parse(new Date()),
                    type: 10,
                },
                {
                    name: "凌风云",
                    link: "https://www.lingfengyun.com/",
                    type: 10,
                },
                {
                    name: "微贴网",
                    link: "https://www.weitiewang.com/",
                    type: 10,
                },
                //聚合搜索
                {
                    name: "盘多多",
                    link: "http://www.panduoduo.top/",
                    //http://www.panduoduo.online/
                    type: 10,
                },
                {
                    name: "天天搜索",
                    link: "http://www.daysou.com/s?q=%s&start=0&isget=1&tp=baipan&cl=0&line=2",
                    type: 10,
                },
                {
                    name: "微友搜索",
                    link: "http://www.weiyoou8.com/",
                    type: 10,
                },
                {
                    name: "telegram",
                    link: "http://www.sssoou.com/",
                    type: 10,
                },
                {
                    name: "相逢聚合搜",
                    link: "https://polished-sea-d9de.xfyz.workers.dev/",
                    type: 10,
                },
                {
                    name: "哎呦喂啊",
                    link: "http://www.aiyoweia.com/search/%s",
                    type: 10,
                },
            ],
            "lanzous": [
                {
                    name: "六音软件",
                    link: "https://www.6yit.com/?s=%s",
                    type: 1,
                },
                {
                    name: "异星软件空间",
                    link: "https://www.yxssp.com/?s=%s",
                    type: 1,
                },
                {
                    name: "乐享",
                    link: "https://www.lxapk.com/?s=%s",
                    type: 1,
                },
            ],
            "ty189": [
                {
                    name: "天翼小站",
                    link: "https://yun.hei521.cn/index.php/search/%s/",
                    type: 1,
                },
                {
                    name: "奇它博客",
                    link: "https://www.qitabbs.com/?s=%s",
                    type: 1,
                },
            ],
            "aliyundrive": [
                {
                    name: "UP云搜",
                    link: "https://www.upyunso.com/search.html?keyword=%s",
                    type: 1,
                },
                {
                    name: "阿里盘搜",
                    link: "https://www.alipansou.com/search?k=%s",
                    type: 1,
                },
                {
                    name: "大盘搜",
                    link: "https://aliyunso.cn/search?keyword=%s",
                    type: 1,
                },
                {
                    name: "云盘资源网",
                    link: "https://www.yunpanziyuan.com/fontsearch.htm?fontname=%s",
                    type: 1,
                },
                {
                    name: "奈斯搜索",
                    link: "https://www.niceso.fun/search/?q=%s",
                    type: 1,
                },
                {
                    name: "AliYunPanSo",
                    link: "https://aliyunpanso.cn/?s=%s",
                    type: 1,
                },
                {
                    name: "阿里盘盘",
                    link: "https://www.panpanr.com/",
                    type: 1,
                },
                {
                    name: "阿里资源论坛",
                    link: "https://aliyunpan1.com/",
                    type: 1,
                },
                {
                    name: "阿里资源分享网",
                    link: "https://ypfx.club/",
                    type: 1,
                },
                {
                    name: "盘基地",
                    link: "https://www.panjd.com/",
                    type: 1,
                },
            ]
        };
    };

    var baidu = {};

    baidu.submitPwd = function(pwd) {
        $(".input-area input").val(pwd);
        $(".input-area .g-button-right").click();
    };

    baidu.reloadPage = function(randsk) {
        if (randsk) {
            obj.setCookie("BDCLND", randsk, null, "/", "pan.baidu.com");
            location.reload();
        }
        else {
            if (/(链接不存在|页面不存在|404 Not Found)/.test(document.title)) {
                var shareId = obj.getShareId();
                if (!shareId) {
                    return;
                }
                if (sessionStorage.getItem(shareId)) {
                    obj.showTipSuccess("链接失效，此条存储信息已删除");
                    obj.removeSharePwdLocal(shareId);
                }
                else {
                    sessionStorage.setItem(shareId, "reload");
                    location.reload();
                }
            }
        }
    };

    baidu.storeSharePwd = function() {
        unsafeWindow.require("base:widget/libs/jquerypacket.js")(document).ajaxComplete(function(event, xhr, options) {
            var requestUrl = options.url;
            if (requestUrl.indexOf("/share/verify") >= 0) {
                var response = xhr.responseJSON;
                if (!(response instanceof Object && response.errno == 0)) {
                    return;
                }
                var shareRandsk = decodeURIComponent(response.randsk);
                var sharePwd = (/pwd=([a-z\d]+)/i.exec(options.data) || [])[1];
                if (!sharePwd || sharePwd.length != 4) {
                    return;
                }

                var shareId = obj.getShareId();
                var shareData = obj.getSharePwdLocal(shareId);
                if (typeof shareData == "object" && shareData.share_name) {
                    if (shareData.share_pwd == sharePwd && shareData.share_randsk == shareRandsk) {
                        return;
                    }
                    else {
                        delete shareData.share_name;
                    }
                }
                shareData = Object.assign(shareData || {}, {
                    share_id: shareId,
                    share_pwd: sharePwd,
                    share_randsk: decodeURIComponent(response.randsk)
                });
                shareData.origin_url || !document.referrer || document.referrer.includes(location.host) || (shareData.origin_url = decodeURIComponent(document.referrer));
                obj.setSharePwdLocal(shareData);
            }
        });
    };

    baidu.autoPaddingPwd = function() {
        if (document.title.indexOf("输入提取码") > 0) {
            baidu.storeSharePwd();
            var shareId = obj.getShareId();
            obj.querySharePwd("baidu", shareId, function(response) {
                if (response instanceof Object) {
                    if (response.share_pwd) {
                        obj.showTipSuccess("查询提取码成功");
                        obj.share_pwd = response.share_pwd;
                        baidu.submitPwd(response.share_pwd);
                    }
                    else if (response.share_randsk) {
                        obj.showTipSuccess("解锁成功，强制跳转");
                        obj.share_randsk = response.share_randsk;
                        baidu.reloadPage(response.share_randsk);
                    }
                    obj.setSharePwdLocal(response);
                }
                else {
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (shareData instanceof Object && shareData.share_pwd) {
                        obj.showTipSuccess("本地回填密码成功");
                        baidu.submitPwd(shareData.share_pwd);
                    }
                    obj.queryShareRandsk("baidu", shareId, function(response) {
                        if (response instanceof Object && response.Randsk) {
                            if (document.title.indexOf("输入提取码") > 0) {
                                obj.showTipSuccess("解锁成功，强制跳转");
                                shareData = Object.assign(shareData || {}, {
                                    share_id: shareId,
                                    share_randsk: response.Randsk
                                });
                                delete shareData.share_pwd;
                                shareData.origin_url || !document.referrer || document.referrer.includes(location.host) || (shareData.origin_url = decodeURIComponent(document.referrer));
                                baidu.reloadPage(response.Randsk);
                                obj.setSharePwdLocal(shareData);
                            }
                        }
                        else {
                            obj.showTipError("未找到密码");
                        }
                    });
                }
            });
        }
    };

    baidu.updateShareStorage = function() {
        var shareId = obj.getShareId();
        if (shareId && /(.*)_/.test(document.title)) {
            var shareData = obj.getSharePwdLocal(shareId);
            if (typeof shareData == "object" && shareData.share_name) {
                return;
            }
            shareData = Object.assign(shareData || {}, {
                share_source: "baidu",
                share_id: shareId,
                share_url: location.href.replace(location.hash, ""),
                share_name: (/(.*)_/.exec(document.title) || [])[1]
            });
            obj.setSharePwdLocal(shareData);
            if (shareData.share_pwd || shareData.share_randsk) {
                shareData.share_randsk || (shareData.share_randsk = unsafeWindow.currentSekey);
                obj.storeSharePwd(shareData);
            }
        }
    };

    baidu.shareVerify = function(shareLink, sharePwd) {
        var shareId, surl = obj.getShareId(shareLink),
            shareid = obj.getParam("shareid", shareLink),
            uk = obj.getParam("uk", shareLink),
            logid = window.btoa(obj.randString(32).toUpperCase() + ":FG=1");

        var url = "https://pan.baidu.com/share/verify";
        surl && (url += "?surl=" + surl, shareId = surl);
        shareid && uk && (url += "?shareid=" + shareid + "&uk=" + uk, shareId = "shareid=" + shareid + "&uk=" + uk);
        if (! shareId) {
            obj.showTipError("百度网盘-链接不合规范");
            return;
        }

        obj.ajax({
            type: "post",
            url: url + "&t=" + (new Date).getTime() + "&channel=chunlei&web=1&app_id=250528&bdstoken=null&logid=" + logid + "&clienttype=0",
            data: {
                pwd: sharePwd,
                vcode: "",
                vcode_str: ""
            },
            headers: {
                "Referer": "https://pan.baidu.com/share" + (surl ? "/init?surl=" + surl : "/link?shareid=" + shareid + "&uk=" + uk) + "&pwd=" + sharePwd
            },
            success: function(response) {
                if (response instanceof Object && response.errno == 0) {
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (!(shareData instanceof Object && shareData.origin_title)) {
                        shareData = {
                            share_source: "baidu",
                            share_id: shareId,
                            share_pwd: sharePwd,
                            share_randsk: decodeURIComponent(response.randsk),
                            share_url:shareLink,
                            origin_url: decodeURIComponent(location.href),
                            origin_title: document.title
                        };
                        obj.setSharePwdLocal(shareData);
                    }
                }
                window.location.href = shareLink;
            },
            error: function(err) {
                console.error("百度提取码状态查询 error！", err);
                window.location.href = shareLink;
            }
        });
    };

    baidu.checkHtmlValid = function(htmlText, callback) {
        var strArr = ((/<title>\n?(.*)<\/title>/.exec(htmlText) || [])[1] || "").split("|");
        var title = strArr[1] || strArr[0];
        switch(title) {
            case "百度网盘 请输入提取码":
                obj.showTipSuccess("百度网盘-请输入提取码");
                callback && callback(2);
                break;
            case "百度网盘-分享无限制":
                obj.showTipSuccess("百度网盘-分享无限制");
                callback && callback(1);
                break;
            case "页面不存在":
                obj.showTipError("百度网盘-页面不存在");
                callback && callback(-1);
                break;
            case "百度网盘-链接不存在":
                obj.showTipError("百度网盘-链接不存在");
                callback && callback(-1);
                break;
            default:
                console.error("百度网盘-有效性未知", htmlText);
                obj.showTipError("百度网盘-链接有效性未知");
                callback && callback(0);
        }
    };

    baidu.checkUrlValid = function(shareLink, sharePwd) {
        var surl = obj.getShareId(shareLink),
            shareid = obj.getParam("shareid", shareLink),
            uk = obj.getParam("uk", shareLink);
        if (! (surl || (shareid && uk))) {
            obj.showTipError("百度网盘-链接不合规范");
            return;
        }

        obj.ajax({
            type: "get",
            url: shareLink,
            headers: { Referer: "https://pan.baidu.com/" },
            success: function(response) {
                baidu.checkHtmlValid(response, function(state) {
                    if (state == 2) {
                        if (GM_getValue("shareLinkVerify") == shareLink) {
                            if (sharePwd) {
                                baidu.shareVerify(shareLink, sharePwd);
                            }
                            else {
                                window.location.href = shareLink;
                            }
                        }
                        else {
                            GM_setValue("shareLinkVerify", shareLink);
                            baidu.checkUrlValid(shareLink, sharePwd);
                        }
                    }
                    else if (state == 1 || state == 0) {
                        window.location.href = shareLink;
                    }
                })
            },
            error: function() {
                console.error("百度网盘-链接已失效", shareLink);
                obj.showTipError("百度网盘-链接已失效");
            }
        });
    };

    baidu.jumpLinkToPanLink = function(jumpLink, sharePwd) {
        obj.ajax({
            type: "get",
            url: jumpLink,
            headers: {
                Referer: location.href
            },
            success: function(response) {
                var shareLink, shareId, sharePwd = sharePwd || (/码.*?>([\w]{4})<\//.exec(response) || [])[1];
                var surl = obj.getShareId(response),
                    shareid = obj.getParam("shareid", response),
                    uk = obj.getParam("uk", response);
                if (surl || (shareid && uk)) {
                    shareLink = "https://pan.baidu.com";
                    surl && (shareLink += "/s/1" + surl);
                    shareid && uk && (shareLink += "/share/link?shareid=" + shareid + "&uk=" + uk);
                    baidu.checkUrlValid(shareLink, sharePwd);
                }
                else {
                    baidu.checkHtmlValid(response, function(state) {
                        if (state == 2) {
                            baidu.shareVerify(jumpLink, sharePwd);
                        }
                        else if (state == 1) {
                            window.location.href = jumpLink;
                        }
                        else if (state == 0) {
                            window.location.href = jumpLink;
                        }
                    })
                }
            },
            error: function() {
                console.error("该链接已失效", jumpLink);
                obj.showTipError("该链接已失效，网盘文件不存在");
            }
        })
    };

    baidu.initButtonShare = function () {
        if ($(".x-button-box").length) {
            if ($(".share-search").length == 0) {
                var html = '<span class="g-dropdown-button share-search"><a class="g-button  g-button-blue" href="javascript:;" title="资源搜索"><span class="g-button-right"><em class="icon icon-search" title="资源搜索"></em><span class="text" style="width: 54px;">资源搜索</span></span></a></span>';
                $(".x-button-box").append(html);
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        }
    };

    baidu.initButtonOldHome = function () {
        if ($(".frame-main .g-dropdown-button").length) {
            if ($(".share-search").length == 0) {
                var html = '<span class="g-dropdown-button share-search"><a class="g-button  g-button-blue" href="javascript:;" title="资源搜索"><span class="g-button-right"><em class="icon icon-search" title="资源搜索"></em><span class="text" style="width: 54px;">资源搜索</span></span></a></span>';
                $(".frame-main .g-dropdown-button:first").after(html);
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        }
        else {
            console.warn("wait initButtonOldHome...");
            setTimeout(baidu.initButtonOldHome, 500);
        }
    };

    baidu.initButtonNewHome = function () {
        if ($(".nd-upload-button").length) {
            if ($(".share-search").length == 0) {
                var html = '<a class="nd-upload-button share-search"><button class="u-btn u-btn--small is-round"><i class="iconfont icon-search nd-file-list-toolbar__search-icon"></i><span>资源搜索</span></button></a>';
                $(".nd-upload-button").after(html);
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        }
        else {
            console.warn("wait initButtonNewHome ...");
            setTimeout(baidu.initButtonNewHome, 500);
        }
    };

    baidu.run = function() {
        var hosts = ["pan.baidu.com", "yun.baidu.com"];
        if (obj.isInArray(hosts)) {
            var url = location.href;
            if (url.indexOf(".baidu.com/share/init") > 0) {
                baidu.autoPaddingPwd();
            }
            else if (url.indexOf(".baidu.com/s/") > 0) {
                baidu.reloadPage();
                baidu.updateShareStorage();
                baidu.initButtonShare();
                obj.initDialog();
            }
            else if (url.indexOf(".baidu.com/disk/home") > 0) {
                baidu.initButtonOldHome();
                obj.initDialog();
            }
            else if (url.indexOf(".baidu.com/disk/main") > 0) {
                baidu.initButtonNewHome();
                obj.initDialog();
            }
            else if (url.indexOf(".baidu.com/wap/init") > 0) {
            }
            return true;
        }
        return false;
    };

    var lanzous = {};

    lanzous.submitPwd = function(pwd) {
        $("#pwd").val(pwd);
        $("#sub").click();
        $(".passwddiv-btn").click();
    };

    lanzous.storeSharePwd = function() {
        unsafeWindow.$(document).ajaxComplete(function (event, xhr, options) {
            var requestUrl = options.url;
            if (requestUrl.indexOf("/ajaxm.php") >= 0 || requestUrl.indexOf("/filemoreajax.php") >= 0) {
                var response = JSON.parse(xhr.response);
                if (response && response.zt == 1) {
                    var sharePwd = decodeURIComponent((options.data.match(/&pwd=([^&]+)/) || options.data.match(/&p=([^&]+)/) || [])[1] || "");
                    if (!sharePwd) {
                        return;
                    }
                    var shareId = obj.getShareId();
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (typeof shareData == "object" && shareData.share_name) {
                        return;
                    }
                    shareData = Object.assign(shareData || {}, {
                        share_source: "lanzous",
                        share_id: shareId,
                        share_pwd: sharePwd,
                        share_url: decodeURIComponent(location.href),
                        share_name: document.title
                    });
                    shareData.origin_url || !document.referrer || document.referrer.includes(location.host) || (shareData.origin_url = decodeURIComponent(document.referrer));
                    obj.setSharePwdLocal(shareData);
                    obj.share_pwd == sharePwd || obj.storeSharePwd(shareData);
                }
            }
        });
    };

    lanzous.autoPaddingPwd = function() {
        var shareId = obj.getShareId();
        if ($("#pwd").length) {
            lanzous.storeSharePwd();
            obj.querySharePwd("lanzous", shareId, function (response) {
                if (response instanceof Object) {
                    obj.showTipSuccess("查询密码成功");
                    obj.share_pwd = response.share_pwd;
                    lanzous.submitPwd(response.share_pwd);
                }
                else {
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (typeof shareData == "object") {
                        obj.showTipSuccess("本地回填密码成功");
                        lanzous.submitPwd(shareData.share_pwd);
                    }
                    else {
                        obj.showTipError("未找到密码");
                    }
                }
            });
        }
        else if ($(".off").length) {
            obj.showTipSuccess("链接失效，此条存储信息已删除");
            obj.removeSharePwdLocal(shareId);
        }
    };

    lanzous.initButtonShare = function() {
        if ($(".share-search").length == 0) {
            if ($(".d").length) {
                $(".d").prepend('<a><span class="txt share-search" style="margin: 1px;">资源搜索</span></a>');
            }
            else if ($("body").children("#file").length) {
                $("body").children("#file").find(".n_hd").prepend('<a class="n_login share-search"><span class="user-name">资源搜索</span></a>');
            }
            $(".share-search").click(function () {
                $(".dialog-dialog").css({display: "flex"});
            });
        }
    };

    lanzous.initButtonHome = function() {
        if ($(".mydisk_nav ul").length) {
            if ($(".share-search").length == 0) {
                $(".mydisk_nav ul").append('<li><a class="share-search" href="javascript:;">资源搜索</a></li>');

                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        }
    };

    lanzous.run = function() {
        var url = location.href;
        if (/[\w-]*\.?lanzou.?\.com/.test(url)) {
            lanzous.autoPaddingPwd();
            lanzous.initButtonShare();
            obj.initDialog();
            return true;
        }
        else if (/woozooo\.com/.test(url)) {
            lanzous.initButtonHome();
            obj.initDialog();
            return true;
        }

        return false;
    };

    var ty189 = {};

    ty189.submitPwd = function(pwd) {
        try {
            var $Vue = (document.querySelector(".get-file-container") || document.querySelector(".verify-panel-container")).__vue__;
            $Vue.accessCode = pwd;
            $Vue.checkAccessCode();
        } catch (e) {
            console.error("ty189.submitPwd 错误", e);
        };
    };

    ty189.storeSharePwd = function() {
        var open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("load", function() {
                var responseURL = this.responseURL;
                if (responseURL.indexOf("listShareDir.action") > 0) {
                    var response = this.response;
                    if (response.success == false) {
                        return;
                    }
                    var sharePwd = (responseURL.match(/accessCode=([\w]{4})/) || [])[1];
                    if (!sharePwd) {
                        return;
                    }
                    var shareId = obj.getShareId();
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (typeof shareData == "object" && shareData.share_name) {
                        return;
                    }
                    shareData = Object.assign(shareData || {}, {
                        share_source: "ty189",
                        share_id: shareId,
                        share_pwd: sharePwd,
                        share_url: decodeURIComponent(location.href),
                        share_name: document.title.split("|")[0].replace(" 免费高速下载", "")
                    });
                    shareData.origin_url || !document.referrer || document.referrer.includes(location.host) || (shareData.origin_url = decodeURIComponent(document.referrer));
                    obj.setSharePwdLocal(shareData);
                    obj.share_pwd == sharePwd || obj.storeSharePwd(shareData);
                }
            });
            open.apply(this, arguments);
        };
    };

    ty189.autoPaddingPwd = function() {
        var errNode = document.querySelector(".error-content");
        if (errNode && !errNode.style.display) {
            obj.showTipSuccess("链接失效，此条存储信息已删除");
            obj.removeSharePwdLocal(obj.getShareId());
            return;
        }

        var $node = document.querySelector(".get-file-container") || document.querySelector(".outlink-wrapper");
        if ($node && $node.__vue__) {
            var $Vue = $node.__vue__;
            var shareInfo = $Vue.fileDetail || $Vue.shareFileInfo;
            if (shareInfo.shareMode > 0) {
                if (shareInfo.shareMode == 1) {
                    var getCookie = unsafeWindow._ux21cn.cookie.get;
                    var shareId = obj.getShareId();
                    var shareIdCookie = getCookie("share_" + shareId) || getCookie("shareId_" + shareId);
                    if (!shareIdCookie) {
                        ty189.storeSharePwd();
                        obj.querySharePwd("ty189", shareId, function(response) {
                            if (response instanceof Object) {
                                obj.showTipSuccess("查询提取码成功");
                                obj.share_pwd = response.share_pwd;
                                ty189.submitPwd(response.share_pwd);
                            }
                            else {
                                var shareData = obj.getSharePwdLocal(shareId);
                                if (typeof shareData == "object") {
                                    ty189.submitPwd(shareData.share_pwd);
                                    obj.showTipSuccess("本地回填密码成功");
                                }
                                else {
                                    obj.showTipError("未找到密码");
                                }
                            }
                        });
                    }
                }
            }
            else {
                setTimeout(ty189.autoPaddingPwd, 500);
            }
        }
        else {
            setTimeout(ty189.autoPaddingPwd, 500);
        }
    };

    ty189.initButtonShare = function() {
        $(document).on("DOMNodeInserted", ".outlink-box-s, .file-info", function(event) {
            if ($(".share-search").length == 0) {
                $(".file-operate").prepend('<div data-v-a9c726de="" class="save-box share-search"><a data-v-a9c726de="" href="javascript:;" class="btn btn-save-as">资源搜索</a></div>');
                $(".save-box a").css({"margin-left": 0});
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }

            $(".tips-save-box").css("display", "none"); //消灭那朵乌云
        });
    };

    ty189.initButtonHome = function() {
        $(document).on("DOMNodeInserted", ".p-web", function(event) {
            if ($(".share-search").length == 0) {
                $(".FileHead_file-head-left_3AuQ6").append('<div class="FileHead_file-head-upload_kgWbF share-search"><div>资源搜索</div></div>');
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        });
    };

    ty189.run = function() {
        var hosts = ["cloud.189.cn", "h5.cloud.189.cn"];
        if (obj.isInArray(hosts)) {
            var url = window.location.href;
            if (url.indexOf("/web/share") > 0 || url.indexOf("/share.html") > 0) {
                ty189.autoPaddingPwd();
                ty189.initButtonShare();
                obj.initDialog();
            }
            else if (url.indexOf("/web/main/") > 0) {
                ty189.initButtonHome();
                obj.initDialog();
            }
            return true;
        }

        return false;
    };

    var aliyundrive = {};

    aliyundrive.submitPwd = function(pwd) {
        var input = document.querySelector("#root input");
        var event = new Event("input", {
            bubbles: true,
        });
        var lastValue = input.value;
        input.value = pwd;
        var tracker = input._valueTracker;
        if (tracker) { tracker.setValue(lastValue) };
        input.dispatchEvent(event);

        var $button = document.querySelector("#root button");
        $button && $button.click();
    };

    aliyundrive.storeSharePwd = function () {
        var send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(sendParams) {
            this.addEventListener("load", function(event) {
                if (this.readyState == 4 && this.status == 200) {
                    var response, responseURL = this.responseURL;
                    if (responseURL.indexOf("/share_link/get_share_by_anonymous") > 0) {
                        response = JSON.parse(this.response);
                        if (response.share_name) {
                            aliyundrive.share_name = response.share_name;
                        }
                    }
                    else if (responseURL.indexOf("/share_link/get_share_token") > 0) {
                        sendParams = JSON.parse(sendParams);
                        aliyundrive.share_id = sendParams.share_id;
                        aliyundrive.share_pwd = sendParams.share_pwd;
                    }
                    else if (responseURL.indexOf("/file/list") > 0) {
                        response = JSON.parse(this.response);
                        sendParams = JSON.parse(sendParams);
                        if (aliyundrive.share_id && sendParams.share_id == aliyundrive.share_id) {
                            var shareData = obj.getSharePwdLocal(aliyundrive.share_id) || {};
                            if (!shareData.share_name || shareData.share_pwd != aliyundrive.share_pwd) {
                                shareData = Object.assign(shareData || {}, {
                                    share_source: "aliyundrive",
                                    share_id: aliyundrive.share_id,
                                    share_url: decodeURIComponent(location.href),
                                    share_name: aliyundrive.share_name || response.items[0].name
                                });
                                shareData.origin_url || !document.referrer || document.referrer.includes(location.host) || (shareData.origin_url = decodeURIComponent(document.referrer));

                                if (aliyundrive.share_pwd) {
                                    shareData.share_pwd = aliyundrive.share_pwd;
                                    obj.share_pwd == aliyundrive.share_pwd || obj.storeSharePwd(shareData);
                                }
                                obj.setSharePwdLocal(shareData);
                            }
                            aliyundrive.share_id = null;
                        }
                    }
                }
            });
            send.apply(this, arguments);
        };
    };

    aliyundrive.autoPaddingPwd = function() {
        if ($("#root input[placeholder=请输入提取码]").length) {
            var shareId = obj.getShareId();
            obj.querySharePwd("aliyundrive", shareId, function(response) {
                if (response instanceof Object) {
                    obj.showTipSuccess("查询提取码成功");
                    obj.share_pwd = response.share_pwd;
                    aliyundrive.submitPwd(response.share_pwd);
                }
                else {
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (typeof shareData == "object") {
                        aliyundrive.submitPwd(shareData.share_pwd);
                        obj.showTipSuccess("本地回填密码成功");
                    }
                    else {
                        obj.showTipError("未找到密码");
                    }
                }
            });
        }
        else if ($("#root header").length) {
            if (document.querySelector(".share-error--2N71i") && location.href.indexOf("/folder/") < 0) {
                obj.showTipSuccess("链接失效，此条存储信息已删除");
                obj.removeSharePwdLocal(obj.getShareId());
            }
        }
        else {
            setTimeout(aliyundrive.autoPaddingPwd, 500);
        }
    };

    aliyundrive.initButtonShare = function() {
        if ($("#root [class^=banner] [class^=right]").length) {
            if ($(".share-search").length == 0) {
                var html = '<button class="button--2Aa4u primary--3AJe5 small---B8mi share-search" style="margin-right: 28px;">资源搜索</button>';
                $("#root [class^=banner] [class^=right]").prepend(html);
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        }
        else {
            console.warn("wait initButtonShare ...");
            setTimeout(aliyundrive.initButtonShare, 500)
        }
    };

    aliyundrive.initButtonHome = function() {
        if ($("#root header").length) {
            console.warn($("#root header"));
            if ($(".share-search").length == 0) {
                var html = '<div style="margin:0px 8px;"></div><button class="button--2Aa4u primary--3AJe5 small---B8mi share-search">资源搜索</button>';
                $("#root header:eq(0)").append(html);
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        }
        else {
            console.warn("wait initButtonHome ...");
            setTimeout(aliyundrive.initButtonHome, 1000)
        }
    };

    aliyundrive.run = function() {
        var url = location.href;
        if (url.indexOf(".aliyundrive.com/") > 0) {
            if (url.indexOf(".aliyundrive.com/s/") > 0) {
                aliyundrive.storeSharePwd();
                aliyundrive.autoPaddingPwd();
                aliyundrive.initButtonShare();
                obj.initDialog();
            }
            else if (url.indexOf(".aliyundrive.com/drive") > 0) {
                aliyundrive.initButtonHome();
                obj.initDialog();
            }
            return true;
        }
        return false;
    };

    var xunlei = {};

    xunlei.submitPwd = function(pwd) {
        try {
            var $Vue = document.querySelector(".pan-share-web").__vue__;
            $Vue.passCode = pwd;
            $Vue.getShare();
        } catch (e) {
            console.error("xunlei.submitPwd 错误", e);
        };
    };

    xunlei.storeSharePwd = function () {
        $(document.body).one("DOMNodeInserted", ".share-file-list", function () {
            var shareId = obj.getShareId();
            var sharePwd = localStorage["share_passcode_" + shareId];
            if (!sharePwd) {
                return;
            }

            var shareData = obj.getSharePwdLocal(shareId);
            if (typeof shareData == "object" && shareData.share_name) {
                return;
            }
            shareData = Object.assign(shareData || {}, {
                share_source: "xunlei",
                share_id: shareId,
                share_pwd: sharePwd,
                share_url: location.href.replace(location.search, ""),
                share_name: $(".share-file-list").find("a:first").text()
            });
            shareData.origin_url || !document.referrer || document.referrer.includes(location.host) || (shareData.origin_url = decodeURIComponent(document.referrer));
            obj.setSharePwdLocal(shareData);
            sharePwd == obj.share_pwd || obj.storeSharePwd(shareData);
        })
    };

    xunlei.autoPaddingPwd = function() {
        $(document).one("DOMNodeInserted", ".pass-body", function () {
            xunlei.storeSharePwd();
            var shareId = obj.getShareId();
            obj.querySharePwd("xunlei", shareId, function(response) {
                if (response instanceof Object) {
                    obj.showTipSuccess("查询提取码成功");
                    obj.share_pwd = response.share_pwd;
                    xunlei.submitPwd(response.share_pwd);
                }
                else {
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (typeof shareData == "object") {
                        xunlei.submitPwd(shareData.share_pwd);
                        obj.showTipSuccess("本地回填密码成功");
                    }
                    else {
                        obj.showTipError("未找到密码");
                    }
                }
            });
        });
        $(document).one("DOMNodeInserted", ".share-status-info", function () {
            obj.showTipSuccess("链接失效，此条存储信息已删除");
            obj.removeSharePwdLocal(obj.getShareId());
        });
    };

    xunlei.initButtonShare = function() {
        $(document).on("DOMNodeInserted", ".shared-file-wrap", function(event) {
            if ($(".share-search").length == 0) {
                $(".file-features-btns-wrap").prepend('<button class="td-button share-search"><span class="text">资源搜索</span></button>');
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        });
    };

    xunlei.initButtonHome = function() {
        $(document).on("DOMNodeInserted", ".pan-list-menu__wrapper", function(event) {
            if ($(".share-search").length == 0) {
                $(".pan-list-menu").append('<a class="pan-list-menu-item pan-list-menu-item__active share-search"><span>资源搜索</span></a>');
                $(".share-search").click(function () {
                    $(".dialog-dialog").css({display: "flex"});
                });
            }
        });
    };

    xunlei.run = function() {
        var url = location.href;
        if (url.indexOf("pan.xunlei.com/") > 0) {
            if (url.indexOf("pan.xunlei.com/s/") > 0) {
                xunlei.autoPaddingPwd();
                xunlei.initButtonShare();
                obj.initDialog();
            }
            else if (url.indexOf("pan.xunlei.com/?") > 0) {
                xunlei.initButtonHome();
                obj.initDialog();
            }
            return true;
        }
        return false;
    };

    var caiyun = {};

    caiyun.submitPwd = function(pwd) {
        try {
            var $Vue = document.querySelector(".page").__vue__;
            $Vue.token = pwd;
            $Vue.getFiles();
        } catch (e) {
            console.error("caiyun.submitPwd 错误", e);
        };
    };

    caiyun.storeSharePwd = function () {
        var sharePwd, send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(data) {
            this.addEventListener("load", function() {
                var responseURL = this.responseURL;
                if (responseURL.indexOf("/stapi/outlink/info") > 0) {
                    var response = JSON.parse(this.response);
                    if (response.code != 0) {
                        return;
                    }
                    var sharePwd = (data.match(/pass=([^&]+)/) || [])[1];
                    if (!sharePwd) {
                        return;
                    }

                    var shareId = obj.getShareId();
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (typeof shareData == "object" && shareData.share_name) {
                        return;
                    }
                    shareData = Object.assign(shareData || {}, {
                        share_source: "caiyun",
                        share_id: shareId,
                        share_pwd: sharePwd,
                        share_url: decodeURIComponent(location.href),
                    });
                    if (response.data.caLst.outLinkCaInfo) {
                        shareData.share_name = Array.isArray(response.data.caLst.outLinkCaInfo) ? response.data.caLst.outLinkCaInfo[0].caName + "等" : response.data.caLst.outLinkCaInfo.caName;
                    }
                    else if (response.data.coLst.outLinkCoInfo) {
                        shareData.share_name = Array.isArray(response.data.coLst.outLinkCoInfo) ? response.data.coLst.outLinkCoInfo[0].coName + "等" : response.data.coLst.outLinkCoInfo.coName;
                    }
                    shareData.origin_url || !document.referrer || document.referrer.includes(location.host) || (shareData.origin_url = decodeURIComponent(document.referrer));
                    obj.setSharePwdLocal(shareData);
                    sharePwd == obj.share_pwd || obj.storeSharePwd(shareData);
                }
            });
            send.apply(this, arguments);
        };
    };

    caiyun.autoPaddingPwd = function() {
        if (document.querySelector(".page")) {
            if (document.querySelector(".token")) {
                caiyun.storeSharePwd();
                var shareId = obj.getShareId();
                obj.querySharePwd("caiyun", shareId, function(response) {
                    if (response instanceof Object) {
                        obj.showTipSuccess("查询提取码成功");
                        obj.share_pwd = response.share_pwd;
                        caiyun.submitPwd(response.share_pwd);
                    }
                    else {
                        var shareData = obj.getSharePwdLocal(shareId);
                        if (typeof shareData == "object") {
                            caiyun.submitPwd(shareData.share_pwd);
                            obj.showTipSuccess("本地回填密码成功");
                        }
                        else {
                            obj.showTipError("未找到密码");
                        }
                    }
                });
            }
            else if (document.querySelector(".main")) {
            }
            else if (document.querySelector(".invalid")) {
                obj.showTipSuccess("链接失效，此条存储信息已删除");
                obj.removeSharePwdLocal(obj.getShareId());
            }
            else {
                setTimeout(caiyun.autoPaddingPwd, 500);
            }
        }
        else {
            setTimeout(caiyun.autoPaddingPwd, 500);
        }
    };

    caiyun.run = function() {
        var url = location.href;
        if (url.indexOf("caiyun.139.com/w") > 0 || url.indexOf("caiyun.139.com/m") > 0) {
            caiyun.autoPaddingPwd();
            return true;
        }
        return false;
    };

    var weiyun = {};

    weiyun.submitPwd = function(pwd) {
        try {
            var $Vue = document.querySelector(".mod-media").__vue__;
            $Vue.password = pwd;
            $Vue.submit();
        } catch (e) {
            //console.error("weiyun.submitPwd 错误", e);
        };
    };

    weiyun.storeSharePwd = function () {
        var open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("load", function() {
                var responseURL = this.responseURL;
                if (responseURL.indexOf("/weiyunShareNoLogin/WeiyunShareView") > 0) {
                    var response = JSON.parse(this.response);
                    if (!(response && response.data.rsp_header.retcode == 0)) {
                        return;
                    }
                    var sharePwd = response.data.rsp_body.RspMsg_body.pwd;
                    if (!sharePwd) {
                        return;
                    }
                    var shareId = obj.getShareId();
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (typeof shareData == "object" && shareData.share_name) {
                        return;
                    }
                    shareData = Object.assign(shareData || {}, {
                        share_source: "weiyun",
                        share_id: shareId,
                        share_pwd: sharePwd,
                        share_url: decodeURIComponent(location.href),
                        share_name: response.data.rsp_body.RspMsg_body.share_name
                    });
                    shareData.origin_url || !document.referrer || document.referrer.includes(location.host) || (shareData.origin_url = decodeURIComponent(document.referrer));
                    obj.setSharePwdLocal(shareData);
                    sharePwd == obj.share_pwd || obj.storeSharePwd(shareData);
                }
            }, false);
            open.apply(this, arguments);
        };
    };

    weiyun.autoPaddingPwd = function() {
        if (document.querySelector(".mod-media")) {
            var shareId = obj.getShareId();
            if (document.querySelector(".title")) {
                obj.showTipSuccess("链接失效，此条存储信息已删除");
                obj.removeSharePwdLocal(shareId);
                return;
            }
            weiyun.storeSharePwd();
            obj.querySharePwd("weiyun", shareId, function(response) {
                if (response instanceof Object) {
                    obj.showTipSuccess("查询提取码成功");
                    obj.share_pwd = response.share_pwd;
                    weiyun.submitPwd(response.share_pwd);
                }
                else {
                    var shareData = obj.getSharePwdLocal(shareId);
                    if (typeof shareData == "object") {
                        weiyun.submitPwd(shareData.share_pwd);
                        obj.showTipSuccess("本地回填密码成功");
                    }
                    else {
                        obj.showTipError("未找到密码");
                    }
                }
            });
        }
        else if (document.querySelectorAll(".layout-main-bd").length == 2) {
        }
        else {
            setTimeout(weiyun.autoPaddingPwd, 500);
        }
    };

    weiyun.run = function() {
        var url = location.href;
        if (url.indexOf("share.weiyun.com/") > 0) {
            weiyun.autoPaddingPwd();
            return true;
        }
        return false;
    };

    /*=====================================================================================================================*/
    var target = {};

    target.run = function() {
        var list = {
            "www.51sopan.cn": ".entry-title",
            "www.slimego.cn": ".link",
            "yun.hei521.cn": ".post-box",
            "www.taoyisou.com": ".flist",
        };
        if (obj.isInArray(Object.keys(list))) {
            var originalClass = $(list[location.host] + " a:not([target])");
            if (originalClass.length) {
                originalClass.attr("target", "_blank");
                console.log("修改target 属性", originalClass.length);
            }
        }
    };

    /*=====================================================================================================================*/
    var nuxt = {};

    nuxt.getUrl = function(id, callback) {
        $.ajax({
            type: "get",
            url: location.origin.replace("www", "api") + "/api/v1/pan/url",
            data: {
                t: Date.now(),
                id: id
            },
            headers: {
                "X-Authorization": localStorage.getItem("token") || ""
            },
            success: function(response) {
                callback && callback(response);
            },
            error: function(error) {
                console.error("getUrl获取链接 出错", error);
                callback && callback("");
            }
        })
    };

    nuxt.getDetail = function(id, callback) {
        $.ajax({
            type: "get",
            url: location.origin.replace("www", "api") + "/api/v1/pan/detail",
            data: {
                t: Date.now(),
                id: id,
                size: 15
            },
            headers: {
                "X-Authorization": localStorage.getItem("token") || ""
            },
            success: function(response) {
                callback && callback(response);
            },
            error: function() {
                callback && callback("");
            }
        })
    };

    nuxt.apiJumpLink = function() {
        var id = ((/[a-z\d]{32}/.exec(location.href) || [])[0]) || "";
        if (!id) {
            obj.showTipError("无法获取ID参数");
            return;
        }

        nuxt.getUrl(id, function(response) {
            if (response instanceof Object && response.code == 0 && response.data) {
                var shareLink = response.data;

                nuxt.getDetail(id, function(response) {
                    if (response instanceof Object) {
                        baidu.checkUrlValid(shareLink, response.pwd);
                    }
                    else {
                        window.location.href = shareLink;
                    }
                })
            }
            else {
                obj.showTipError("链接已失效");
            }
        })
    };

    nuxt.run = function() {
        var hosts = [
            "www.dalipan.com",
            "www.dashengpan.com",
            "www.xiaomapan.com",
            "www.baimapan.com",
            "www.yubaipan.com",
            "www.feifeipan.com",
            "www.feizhupan.com",
            /*"www.luomapan.com",
            "www.iizhi.cn",
            "www.jnzy.pro",*/
        ];

        if (obj.isInArray(hosts)) {
            var url = window.location.href;
            if (url.indexOf("#/main/search") > 0) {
                if (!localStorage.getItem("token")) {
                    obj.showTipError("请先登录,否则无法自动跳转");
                }
                return true;
            }
            else if (url.indexOf("#/main/detail") > 0) {
                if (document.readyState === "complete") {
                    nuxt.apiJumpLink();
                    return true;
                }
                else {
                    setTimeout(nuxt.run, 500);
                }
            }
            else { }
        }
        else {
            return false;
        }

    };

    /*=====================================================================================================================*/
    var b64Node = {};

    b64Node.decodeUnicode = function(str) {
        try {
            return decodeURIComponent(atob(str).split("").map(function(c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice( - 2)
            }).join(""));
        } catch(e) {
            console.error(e.name + " :" + e.message);
            return "";
        }
    };

    b64Node.addDirectURL = function() {
        var host = location.host;
        var staticClass = /xiaozhukuaipan/.test(host) ? ".media-heading a" : ".source-title";
        try {
            $(staticClass).each(function(index) {
                var $this = $(this);
                var shorturl = $this.attr("data-shorturl");
                /laisoyixia/.test(host) && (shorturl = b64Node.decodeUnicode(shorturl));
                /^1/.test(shorturl) && $this.append('<div style="margin:10px;"></div><button><a href="https://pan.baidu.com/s/' + shorturl + '" target="_blank"><span style="color:#d418a3;">点我直接打开</span></a></button>');
            })
        } catch(err) {
            console.error("修改节点错误", err);
        }
    }

    b64Node.jumpLink = function() {
        var staticClass = {
            "www.xiaozhukuaipan.com": {
                id: "#downloadHandler",
                href: "data-downloadurl",
            },
            "www.laisoyixia.com": {
                id: "#downloadHandler",
                href: "data-downloadurl",
            },
            "www.aiyoweia.com": {
                id: ".panurl:eq(1) a",
                href: "href",
            },
            "www.zhaoyunpan.cn": {
                id: ".f-ext span:eq(2) a",
                href: "href",
            },
        } [location.host];

        var shareLink, sharePwd, b64Link = (/aHR0c.+/.exec($(staticClass.id).attr(staticClass.href)) || [])[0];
        if (b64Link) {
            shareLink = decodeURIComponent(b64Node.decodeUnicode(b64Link));
            if (shareLink) {
                baidu.checkUrlValid(shareLink, sharePwd);
            }
            else {
                console.error("跳转链接解码失败", );
                obj.showTipError("跳转链接解码失败");
            }
        }
    };

    b64Node.run = function() {
        var hosts = [
            "www.xiaozhukuaipan.com",
            "www.laisoyixia.com",
            "www.aiyoweia.com",
            "www.zhaoyunpan.cn",
        ];

        if (obj.isInArray(hosts)) {
            var url = location.href;
            if (/(xiaozhukuaipan|laisoyixia)/.test(url) && /search/.test(url)) {
                b64Node.addDirectURL();
                return true;
            }
            else if (!/search/.test(url)) {
                b64Node.jumpLink();
                return true;
            }
        }
        return false;
    };

    /*=====================================================================================================================*/
    var funcNode = {};

    funcNode.getUrlmd5 = function(callback) {
        var pathname = location.pathname;
        var [_, f, m] = pathname.replace(".html", "").split("/");
        if (typeof(m) == "string" && m.length == 32) {
            callback && callback(m);
            return;
        }

        $.get(pathname.replace(f, f + "2"), function(result) {
            if (result) {
                callback && callback((/var cur_urlmd5=\"([a-z\d]+)\"\;/.exec(result) || [])[1]);
            }
            else {
                callback && callback("")
            }
        });
    };

    funcNode.getShare = function(urlmd5) {
        $.get("http://share.panmeme.com/share/get", {urlmd5: urlmd5}, function(result) {
            if (result.code == 1) {
                if (result.data.status == 1) {
                    if (result.data.unzippwd != null && result.data.unzippwd != "") {
                        GM_setClipboard(result.data.unzippwd);
                        obj.showTipSuccess("解压密码：" + result.data.unzippwd + "\n已复制到剪贴板");
                    }
                    baidu.checkUrlValid(result.data.url, result.data.password);
                }
                else {
                    obj.showTipError("此资源已经失效！");
                }
            }
            else if (result.code == 12) {
                window.alert("请求失败，请关闭浏览器云加速或本机ip代理!");
            }
            else {
                window.alert("请求异常，请切换本机网络或明天再来试试!");
            }
        }, "json");
    };

    funcNode.jumpLink = function() {
        funcNode.getUrlmd5(function(cur_urlmd5) {
            if (cur_urlmd5) {
                funcNode.getShare(cur_urlmd5);
            }
            else {
                console.error("funcJumpLink 无法获取cur_urlmd5参数！");
                obj.showTipError("无法获取链接！");
            }
        });
    };

    funcNode.run = function() {
        var hosts = [
            "www.taoyisou.com/zy/",
            "www.yisopan.com/vd/",
            "www.vpanso.com/vfile/",
            "www.vpansou.com/sfile/",
            "www.kengso.com/file/",
            "www.repanso.com/f/",
            "www.xgsoso.com/share/",
            "www.lele360.com/vd/",
            "www.dmpans.com/file/",
            "www.panmeme.com/wenjian/",
            "www.pan58.com/f/",
        ]

        if (obj.isInArray(hosts)) {
            funcNode.jumpLink();
            return true;
        }
        return false;
    };

    /*=====================================================================================================================*/
    var dialog_fileId = {};

    dialog_fileId.jumpLink = function() {
        if (unsafeWindow.dialog_fileId) {
            var dialog_url = '/redirect/file?id=' + unsafeWindow.dialog_fileId;
            var jumpLink = location.origin + dialog_url;
            baidu.jumpLinkToPanLink(jumpLink);
        }
    };

    dialog_fileId.run = function() {
        var hosts = [
            "www.58wangpan.com",
            "www.soupan8.com",
            "aizhaomu.com"
        ];

        if (obj.isInArray(hosts)) {
            dialog_fileId.jumpLink();
            return true;
        }

        return false;
    };

    /*=====================================================================================================================*/
    var node = {};

    node.jumpLink = function() {
        var staticClass = {
            "www.xiaobaipan.com": {
                linkId: "#rel-url a",
                passId: "",
            },
            /*
            ↑以上破解扫码后跳转↑↓以下不用扫码直接跳转↓
            */
            "yun.java1234.com": {
                linkId: "#bar a",
                passId: "#bar font:eq(1)",
            },
            "www.pantianxia.com": {
                linkId: ".ui-button.ui-button-primary",
                passId: "",
            },
        } [location.host];

        var href = $(staticClass.linkId).attr("href");
        if (href) {
            var sharePwd = (/[码|：: ]*([\w]{4})/.exec($(staticClass.passId || "").text()) || [])[1];
            var surl = obj.getShareId(href),
                shareid = obj.getParam("shareid", href),
                uk = obj.getParam("uk", href);
            if (surl || (shareid && uk)) {
                var shareLink = "https://pan.baidu.com";
                surl && (shareLink += "/s/1" + surl);
                shareid && uk && (shareLink += "/share/link?shareid=" + shareid + "&uk=" + uk);
                if (shareLink != "https://pan.baidu.com/share") {
                    baidu.checkUrlValid(shareLink, sharePwd);
                }
            }
            else {
                var jumpLink = href.indexOf(location.origin) >= 0 ? href: location.origin + href;
                baidu.jumpLinkToPanLink(jumpLink, sharePwd);
            }
        }
        else{
            obj.showTipError("无法获取链接");
        }
    };

    node.run = function() {
        var hosts = [
            "www.xiaobaipan.com/file-",
            "yun.java1234.com/article/",
            "www.pantianxia.com",
        ];

        if (obj.isInArray(hosts)) {
            node.jumpLink();
            return true;
        }

        return false;
    };

    /*=====================================================================================================================*/

    var checkShare = {};

    checkShare.matchShare = function (text, reg) {
        var resObj, results = [];
        while (resObj = reg.exec(text)) {
            results.push(resObj);
        }
        return results;
    };

    checkShare.checkShareAll = function () {
        var shareRegExp = {
            baidu: /(https?:\/\/(?:pan|yun)\.baidu\.com\/(?:s\/\d|(?:share|wap)\/init\?surl\=)([\w-]{5,25}))([^\w]*(?:提取|访问|查阅|授权|密\s*)码[^\w]*([\w]{4}))?/gim,
            lanzous: /(https?:\/\/[\w-]*\.?lanzou.?\.com\/([\w]{6,13}))([^\w]*(?:提取|访问|查阅|授权|密\s*)码[^\w]*([\w-]{4,12}))?/gim,
            ty189: /(https?:\/\/(?:h5\.)?cloud\.189\.cn\/(?:web\/share\?code|share\.html#\/)?(?:=|t\/)([\w]{12}))([^\w]*(?:提取|访问|查阅|授权|密\s*)码[^\w]*([\w]{4}))?/gim,
            xunlei: /(https?:\/\/pan\.xunlei\.com\/s\/([\w-]{26}))([&\w=]*[^\w]*(?:提取|密)码[^\w]*([\w]{4}))?/gim,
            aliyundrive: /(https?:\/\/www\.aliyundrive\.com\/s\/([a-z\d]{11}))([^\w]*(?:提取|密)码[^\w]*([\w]{4}))?/gim,
            weiyun: /(https?:\/\/share\.weiyun\.com\/([a-z\d]{7,32}))([^\w]*(?:提取|访问|密)码[^\w]*([\w]{1,6}))?/gim,
            caiyun: /(https?:\/\/caiyun\.(?:139|feixin\.10086)\.(?:com|cn)\/(?:m\/i\?|dl\/)([a-z\d]{13,14}))([^\w]*(?:提取|密)码[^\w]*([a-z\d]{4}))?/gim,
        };
        var shareList = {};

        var innerText = document.body.innerText;
        Object.keys(shareRegExp).forEach(function (shareSource) {
            var allShare = checkShare.matchShare(innerText, shareRegExp[shareSource]);
            allShare.forEach(function (item) {
                var shareLink = item[1], shareId = item[2], sharePwd = item[4] || "";
                sharePwd || shareSource == "aliyundrive" && (sharePwd = (/((?:提取码|密码)?[^\w]*([\w]{4}))[^\w]*(https?:\/\/www\.aliyundrive\.com\/s\/([a-z\d]{11}))/gim.exec(innerText) || [])[2]);
                if (sharePwd) {
                    shareList[shareId] = {
                        share_source: shareSource,
                        share_id: shareId,
                        share_pwd: sharePwd,
                        share_url:shareLink,
                        origin_url: decodeURIComponent(location.href),
                        origin_title: document.title
                    };
                    obj.getSharePwdLocal(shareId) || obj.setSharePwdLocal(shareList[shareId]);
                }
            });
        });

        var sharePwdRegExp = /(?:提取|访问|查阅|授权|密\s*)[码碼][\[【(（：: ]?([\w-]{3,6})/g;
        $("a[href^='http']:not([href*='" + location.hostname + "']").each(function () {
            var $this = $(this);
            Object.keys(shareRegExp).forEach(function (shareSource) {
                var shareLinkReg = shareRegExp[shareSource].exec($this.attr("href"));
                if (Array.isArray(shareLinkReg)) {
                    var sharePwd, shareLink = shareLinkReg[1], shareId = shareLinkReg[2];
                    if (!shareList[shareId] || !shareList[shareId].share_pwd) {
                        var $node = $this, $node0 = $node, $node1 = $node;
                        var i = 0, j = 0;
                        while (!sharePwd && $node.get(0) != document.body) {
                            sharePwd = (sharePwdRegExp.exec($node.text()) || [])[1];
                            if (!sharePwd) {
                                if (++i % 2 == 0) {
                                    $node0 = $node0.next();
                                    if ($node0.length) {
                                        $node = $node0;
                                        j = 0;
                                    }
                                }
                                else {
                                    $node1 = $node1.prev();
                                    if ($node1.length) {
                                        $node = $node1;
                                        j = 0;
                                    }
                                }

                                if (++j >= 2) {
                                    $node = $node0 = $node1 = $node.parent();
                                    j = 0;
                                }
                            }
                        };
                        if (sharePwd) {
                            shareList[shareId] = {
                                share_source: shareSource,
                                share_id: shareId,
                                share_pwd: sharePwd,
                                share_url:shareLink,
                                origin_url: decodeURIComponent(location.href),
                                origin_title: document.title
                            };
                            obj.getSharePwdLocal(shareId) || obj.setSharePwdLocal(shareList[shareId]);
                        }
                    }
                }
            });
        });
    };

    checkShare.run = function () {
        checkShare.checkShareAll();
        return true;
    };

    obj.run = function () {
        if ($("meta[name=script]").length) {
            return;
        }
        else {
            $('<meta name="script" content="run">').appendTo(document.head);
        }

        console.log("管家婆 开始运行");
        var funcArr = [
            baidu.run,
            lanzous.run,
            ty189.run,
            aliyundrive.run,
            xunlei.run,
            caiyun.run,
            weiyun.run,
            target.run,
            nuxt.run,
            b64Node.run,
            funcNode.run,
            dialog_fileId.run,
            node.run,
            checkShare.run,
        ];

        (function runAll (funcArr, index) {
            if (typeof funcArr[index] == "function") {
                if (funcArr[index]()) {
                    console.log("管家婆 运行完成", index + 1);
                }
                else {
                    runAll(funcArr, ++index);
                }
            }
            else {
                return;
            }
        })(funcArr, 0);
    }();

    // Your code here...
})();
