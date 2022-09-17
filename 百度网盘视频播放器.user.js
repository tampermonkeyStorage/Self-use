// ==UserScript==
// @name         百度网盘视频播放器
// @namespace    http://tampermonkey.net/
// @version      0.2.6
// @description  播放器替换为DPlayer
// @author       You
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/mbox/streampage*
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    var obj = {
        video_page: {
            info: [],
            quality: [],
            adToken: ""
        }
    };

    obj.storageFileListSharePage = function () {
        try {
            var currentList = obj.require('system-core:context/context.js').instanceForSystem.list.getCurrentList();
            if (currentList.length) {
                window.sessionStorage.setItem("sharePageFileList", JSON.stringify(currentList));
            }
            else {
                setTimeout(obj.storageFileListSharePage, 500);
            }
        }
        catch (error) { };

        window.onhashchange = function (e) {
            setTimeout(obj.storageFileListSharePage, 500);
        };
        document.querySelector(".fufHyA") && (document.querySelector(".fufHyA").onclick = function () {
            setTimeout(obj.storageFileListSharePage, 500);
        });
    };

    obj.fetchVideoInfoHomePage = function (callback) {
        var instanceForSystem = obj.require("system-core:context/context.js").instanceForSystem
        , router = instanceForSystem.router
        , uk = instanceForSystem.locals.get("uk")
        , path = router.query.get("path");

        var jQuery = obj.getJquery()
        , target = jQuery.stringify([path]);
        jQuery.ajax({
            url: "/api/filemetas",
            data: {
                target: target,
                dlink: 1
            },
            success: function(i) {
                if (i && 0 === i.errno && i.info && i.info[0]) {
                    obj.video_page.info = i.info;
                    callback && callback(i.info[0]);
                }
                else {
                    obj.msg("视频加载失败，请刷新页面后重试", "failure");
                    callback && callback("");
                }
            },
            error: function(i) {
                obj.msg("视频加载失败，请刷新页面后重试", "failure");
                callback && callback("");
            }
        })
    };

    obj.playVideoHomePage = function () {
        var instanceForSystem = obj.require("system-core:context/context.js").instanceForSystem
        , router = instanceForSystem.router
        , uk = instanceForSystem.locals.get("uk")
        , path = router.query.get("path")
        , vip = obj.getVip();

        function getUrl (i) {
            return location.protocol + "//" + location.host + "/api/streaming?path=" + encodeURIComponent(path) + "&app_id=250528&clienttype=0&type=" + i + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
        }

        var file = obj.video_page.info[0], resolution = file.resolution;
        obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
            obj.addQuality(getUrl, resolution);
            obj.useDPlayer();
        });
    };

    obj.playVideoSharePage = function () {
        unsafeWindow.locals.get("file_list", "sign", "timestamp", "share_uk", "shareid", function(file_list, sign, timestamp, share_uk, shareid) {
            if (file_list.length > 1 || file_list[0].mediaType != "video") {
                obj.storageFileListSharePage();
                return;
            }
            obj.video_page.info = file_list;

            var file = file_list[0], resolution = file.resolution, fid = file.fs_id, vip = obj.getVip();
            function getUrl(i) {
                return location.protocol + "//" + location.host + "/share/streaming?channel=chunlei&uk=" + share_uk + "&fid=" + fid + "&sign=" + sign + "&timestamp=" + timestamp + "&shareid=" + shareid + "&type=" + i + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
            }

            obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
                obj.addQuality(getUrl, resolution);
                obj.useDPlayer();
            });
        });
    };

    obj.playVideoStreamPage = function () {
        var getParam = obj.require("base:widget/tools/service/tools.url.js").getParam;
        var file = {
            from_uk: getParam("from_uk"),
            to: getParam("to"),
            fs_id: getParam("fs_id"),
            name: getParam("name") || "",
            type: getParam("type"),
            md5: getParam("md5"),
            msg_id: getParam("msg_id"),
            path: decodeURIComponent(decodeURIComponent(getParam("path")))
        };
        obj.video_page.info = [ file ];

        function getUrl (i) {
            return location.protocol + "//" + location.host + "/mbox/msg/streaming?from_uk=" + file.from_uk + "&to=" + file.to + "&msg_id=" + file.msg_id + "&fs_id=" + file.fs_id + "&type=" + file.type + "&stream_type=" + i;
        }

        obj.getAdToken(getUrl("M3U8_AUTO_480"), function () {
            obj.addQuality(getUrl, "width:1920,height:1080");
            obj.useDPlayer();
        });
    };

    obj.getAdToken = function (url, callback) {
        var jQuery = obj.getJquery();
        jQuery.ajax({
            url: url,
        }).done(function(n) {
            if (133 === n.errno && 0 !== n.adTime) {
                obj.video_page.adToken = n.adToken;
            }
            callback && callback();
        }).fail(function(n) {
            var t = jQuery.parseJSON(n.responseText);
            if (t && 133 === t.errno && 0 !== t.adTime) {
                obj.video_page.adToken = t.adToken;
            }
            callback && callback();
        });
    };

    obj.addQuality = function (getUrl, resolution) {
        var r = {
            1080: "超清 1080P",
            720: "高清 720P",
            480: "流畅 480P",
            360: "省流 360P"
        };
        var freeList = obj.freeList(resolution);
        freeList.forEach(function (a, index) {
            obj.video_page.quality.push({
                name: r[a],
                url: getUrl("M3U8_AUTO_" + a) + "&isplayer=1&check_blue=1&adToken=" + encodeURIComponent(obj.video_page.adToken ? obj.video_page.adToken : ""),
                type: "hls"
            });
        });
    };

    obj.freeList = function (e) {
        e = e || "";
        var t = [480, 360]
        , a = e.match(/width:(\d+),height:(\d+)/) || ["", "", ""]
        , i = +a[1] * +a[2];
        return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t
    };

    obj.useDPlayer = function () {
        obj.dPlayerSupport(function (result) {
            if (result) {
                obj.dPlayerStart();
            }
        });
    };

    obj.dPlayerSupport = function (callback) {
        var urlArr = [
            [
                "https://cdn.staticfile.org/hls.js/1.1.5/hls.min.js",
                "https://cdn.staticfile.org/dplayer/1.26.0/DPlayer.min.js",
            ],
            [
                "https://cdn.bootcdn.net/ajax/libs/hls.js/1.1.5/hls.min.js",
                "https://cdn.bootcdn.net/ajax/libs/dplayer/1.26.0/DPlayer.min.js",
            ],
            [
                "https://cdn.jsdelivr.net/npm/hls.js/dist/hls.min.js",
                "https://cdn.jsdelivr.net/npm/dplayer/dist/DPlayer.min.js",
            ],
        ];
        (function laodcdn(urlArr, index = 0) {
            var arr = urlArr[index];
            if (arr) {
                var promises = [];
                arr.forEach(function (url, index) {
                    promises.push(obj.loadScript(url));
                });
                Promise.all(promises).then(function(results) {
                    setTimeout(function () {
                        callback && callback(unsafeWindow.DPlayer);
                    }, 0);
                }).catch(function(error) {
                    console.error("laodcdn 发生错误！", index, error);
                    laodcdn(urlArr, ++index);
                });
            }
            else {
                callback && callback(unsafeWindow.DPlayer);
            }
        })(urlArr);
    };

    obj.dPlayerStart = function () {
        var dPlayerNode, videoNode = document.getElementById("video-wrap");
        if (videoNode) {
            dPlayerNode = document.getElementById("dplayer");
            if (!dPlayerNode) {
                dPlayerNode = document.createElement("div");
                dPlayerNode.setAttribute("id", "dplayer");
                dPlayerNode.setAttribute("style", "width: 100%; height: 100%;");
                videoNode.parentNode.replaceChild(dPlayerNode, videoNode);
            }
        }
        else {
            console.warn("尝试再次获取播放器容器");
            return setTimeout(obj.dPlayerStart, 500);
        }

        var quality = obj.video_page.quality, defaultQuality = function () {
            var name = localStorage.getItem("dplayer-quality");
            if (name) {
                for (let i = 0; i < quality.length; i++) {
                    if (quality[i].name == name) {
                        return i;
                    }
                }
            }
            return 0;
        }();
        var options = {
            container: dPlayerNode,
            video: {
                quality: quality,
                defaultQuality: defaultQuality
            },
            autoplay: true,
            screenshot: true,
            hotkey: true,
            airplay: true,
            volume: 1.0,
            playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4],
            contextmenu: [
                {
                    text: "喜欢吗 👍 一个吧",
                    link: "https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png",
                },
            ],
            theme: "#b7daff"
        };

        try {
            var $ = obj.getJquery();
            $(dPlayerNode).nextAll().remove();
            location.pathname == "/mbox/streampage" && $(dPlayerNode).css("height", "480px");
            $("#layoutMain").attr("style", "z-index: 42;");
            $(".header-box").remove();

            var dPlayer = new unsafeWindow.DPlayer(options);
            dPlayer.on("loadstart", function () {
                setTimeout(function () {
                    if (isNaN(dPlayer.video.duration)) {
                        var file = obj.video_page.info[0];
                        var errnum = +sessionStorage.getItem("error_" + file.fs_id);
                        if (++errnum <= 3) {
                            location.reload();
                        }
                        sessionStorage.setItem("error_" + file.fs_id, errnum);
                    }
                }, 5000);
            });
            dPlayer.on("durationchange", function () {
                obj.memoryPlay(dPlayer);
                obj.playSetting();
                obj.autoPlayEpisode();
                obj.appreciation(dPlayer);
            });

            dPlayer.speed(localStorage.getItem("dplayer-speed") || 1);
            dPlayer.on("ratechange", function () {
                dPlayer.notice("播放速度：" + dPlayer.video.playbackRate);
                localStorage.setItem("dplayer-speed", dPlayer.video.playbackRate);
            });
            dPlayer.on("quality_end", function () {
                localStorage.setItem("dplayer-quality", dPlayer.quality.name);
            });

            if (localStorage.getItem("dplayer-isfullscreen") == "true") {
                dPlayer.fullScreen.request("web");
            }
            dPlayer.on("fullscreen", function () {
                localStorage.setItem("dplayer-isfullscreen", true);
            });
            dPlayer.on("fullscreen_cancel", function () {
                dPlayer.fullScreen.isFullScreen("web") || localStorage.removeItem("dplayer-isfullscreen");
            });
            $(document).on("click", ".dplayer .dplayer-full", function(event) {
                var isFullScreen = dPlayer.fullScreen.isFullScreen("web") || dPlayer.fullScreen.isFullScreen("browser");
                localStorage.setItem("dplayer-isfullscreen", isFullScreen);
            });

            dPlayer.on("ended", function () {
                obj.autoPlayNext();
            });

            obj.resetPlayer();
            obj.msg("DPlayer 播放器创建成功");
        } catch (error) {
            obj.msg("播放器创建失败", "failure");
        }
    };

    obj.memoryPlay = function (player) {
        if (this.hasMemoryDisplay) return;
        this.hasMemoryDisplay = true;

        var duration = player.video.duration
        , file = obj.video_page.info[0] || {}
        , sign = file.md5 || file.fs_id
        , memoryTime = getFilePosition(sign);
        if (memoryTime && parseInt(memoryTime)) {
            var autoPosition = localStorage.getItem("dplayer-autoposition") == "true";
            if (autoPosition) {
                player.seek(memoryTime);
            }
            else {
                var formatTime = formatVideoTime(memoryTime);
                var $ = obj.getJquery();
                $(player.container).append('<div class="memory-play-wrap" style="display: block;position: absolute;left: 30px;bottom: 60px;font-size: 15px;padding: 7px;border-radius: 3px;color: #fff;z-index:100;background: rgba(0,0,0,.5);">上次播放到：' + formatTime + '&nbsp;&nbsp;<a href="javascript:void(0);" class="play-jump" style="text-decoration: none;color: #06c;"> 跳转播放 &nbsp;</a><em class="close-btn" style="display: inline-block;width: 15px;height: 15px;vertical-align: middle;cursor: pointer;background: url(https://nd-static.bdstatic.com/m-static/disk-share/widget/pageModule/share-file-main/fileType/video/img/video-flash-closebtn_15f0e97.png) no-repeat;"></em></div>');
                var memoryTimeout = setTimeout(function () {
                    $(".memory-play-wrap").remove();
                }, 15000);
                $(".memory-play-wrap .close-btn").click(function () {
                    $(".memory-play-wrap").remove();
                    clearTimeout(memoryTimeout);
                });
                $(".memory-play-wrap .play-jump").click(function () {
                    player.seek(memoryTime);
                    player.play();
                    $(".memory-play-wrap").remove();
                    clearTimeout(memoryTimeout);
                });
            }
        }

        document.onvisibilitychange = function () {
            if (document.visibilityState === "hidden") {
                var currentTime = player.video.currentTime;
                currentTime && setFilePosition(sign, currentTime, duration);
            }
        };
        window.onbeforeunload = function () {
            var currentTime = player.video.currentTime;
            currentTime && setFilePosition(sign, currentTime, duration);
        };

        function getFilePosition (e) {
            return localStorage.getItem("video_" + e) || 0;
        }
        function setFilePosition (e, t, o) {
            e && t && (e = "video_" + e, t <= 60 || t + 60 >= o || 0 ? localStorage.removeItem(e) : localStorage.setItem(e, t));
        }
        function formatVideoTime (seconds) {
            var secondTotal = Math.round(seconds)
            , hour = Math.floor(secondTotal / 3600)
            , minute = Math.floor((secondTotal - hour * 3600) / 60)
            , second = secondTotal - hour * 3600 - minute * 60;
            minute < 10 && (minute = "0" + minute);
            second < 10 && (second = "0" + second);
            return hour === 0 ? minute + ":" + second : hour + ":" + minute + ":" + second;
        }
    };

    obj.playSetting = function () {
        var $ = obj.getJquery();
        if ($(".dplayer-setting-autoposition").length) return;

        var html = '<div class="dplayer-setting-item dplayer-setting-autoposition"><span class="dplayer-label">自动记忆播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoposition" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-autoplaynext"><span class="dplayer-label">自动连续播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoplaynext" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        $(".dplayer-setting-origin-panel").append(html);

        localStorage.getItem("dplayer-autoposition") == "true" && ($(".dplayer-toggle-setting-input-autoposition").get(0).checked = true);
        localStorage.getItem("dplayer-autoplaynext") || localStorage.setItem("dplayer-autoplaynext", true);
        localStorage.getItem("dplayer-autoplaynext") == "true" && ($(".dplayer-toggle-setting-input-autoplaynext").get(0).checked = true);

        $(".dplayer-setting-autoposition").on("click", function() {
            var autoposition = !$(".dplayer-toggle-setting-input-autoposition").is(":checked");
            $(".dplayer-toggle-setting-input-autoposition").get(0).checked = autoposition;
            localStorage.setItem("dplayer-autoposition", autoposition);
        });
        $(".dplayer-setting-autoplaynext").on("click", function() {
            var autoplaynext = !$(".dplayer-toggle-setting-input-autoplaynext").is(":checked");
            $(".dplayer-toggle-setting-input-autoplaynext").get(0).checked = autoplaynext;
            localStorage.setItem("dplayer-autoplaynext", autoplaynext);
        });
    };

    obj.autoPlayEpisode = function () {
        var path = location.pathname.split("/")[1];
        if (path == "s") {
            obj.selectEpisodeSharePage();
        }
        else if (path == "play") {
            obj.selectEpisodeHomePage();
        }
        else if (path == "mbox") {
        }
    };

    obj.selectEpisodeSharePage = function () {
        var $ = obj.getJquery();
        if ($(".dplayer-icons-right #btn-select-episode").length) return;

        var fileList = JSON.parse(sessionStorage.getItem("sharePageFileList") || "[]")
        , videoList = fileList.filter(function (item, index) {
            return item.category == 1;
        })
        , file = obj.video_page.info[0]
        , fileIndex = videoList.findIndex(function (item, index) {
            return item.fs_id == file.fs_id;
        });
        if (!(fileIndex > -1 && videoList.length > 1)) return;

        var eleitem = "";
        videoList.forEach(function (item, index) {
            if (fileIndex == index) {
                eleitem += '<div class="video-item active" title="' + item.server_filename + '" style="background-color: rgba(0,0,0,.3);color: #0df;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;">' + item.server_filename + '</div>';
            }
            else {
                eleitem += '<div class="video-item" title="' + item.server_filename + '" style="color: #fff;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;">' + item.server_filename + '</div>';
            }
        });

        var html = '<button class="dplayer-icon dplayer-play-icon prev-icon" title="上一集"><svg t="1658231494866" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="22734" width="128" height="128" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><style type="text/css"></style></defs><path d="M757.527273 190.138182L382.510545 490.123636a28.020364 28.020364 0 0 0 0 43.752728l375.016728 299.985454a28.020364 28.020364 0 0 0 45.474909-21.876363V212.014545a28.020364 28.020364 0 0 0-45.474909-21.876363zM249.949091 221.509818a28.020364 28.020364 0 0 0-27.973818 27.973818v525.032728a28.020364 28.020364 0 1 0 55.994182 0V249.483636a28.020364 28.020364 0 0 0-28.020364-27.973818zM747.054545 270.242909v483.514182L444.834909 512l302.173091-241.757091z" fill="#333333" p-id="22735"></path></svg></button>';
        html += '<button id="btn-select-episode" class="dplayer-icon dplayer-quality-icon" title="选集">选集</button> <div class="playlist-content" style="max-width: 80%;max-height: 330px;width: auto;height: auto;box-sizing: border-box;overflow: hidden;position: absolute;left: 0;transition: all .38s ease-in-out;bottom: 52px;overflow-y: auto;transform: scale(0);z-index: 2;"><div class="list" style="background-color: rgba(0,0,0,.3);height: 100%;">' + eleitem + '</div></div>';
        html += '<button class="dplayer-icon dplayer-play-icon next-icon" title="下一集"><svg t="1658231512641" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="23796" xmlns:xlink="http://www.w3.org/1999/xlink" width="128" height="128"><defs><style type="text/css"></style></defs><path d="M248.506182 190.138182l374.970182 299.985454a28.020364 28.020364 0 0 1 0 43.752728L248.552727 833.861818a28.020364 28.020364 0 0 1-45.521454-21.876363V212.014545c0-23.505455 27.182545-36.538182 45.521454-21.876363z m507.485091 31.371636c15.453091 0 28.020364 12.567273 28.020363 27.973818v525.032728a28.020364 28.020364 0 1 1-55.994181 0V249.483636c0-15.453091 12.520727-27.973818 27.973818-27.973818zM258.978909 270.242909v483.514182L561.198545 512 258.978909 270.242909z" fill="#333333" p-id="23797"></path></svg></button>';
        $(".dplayer-icons-right").prepend(html);

        $("#btn-select-episode").on("click", function() {
            var eleEpisode = $(".playlist-content");
            if (eleEpisode.css("transform").match(/\d+/) > 0) {
                eleEpisode.css("transform", "scale(0)");
            }
            else {
                eleEpisode.css("transform", "scale(1)");
                $(".dplayer-mask").addClass("dplayer-mask-show");

                var singleheight = $(".dplayer-icons-right .video-item")[0].offsetHeight;
                var totalheight = $(".dplayer-icons-right .playlist-content").height();
                $(".dplayer-icons-right .playlist-content").scrollTop((fileIndex + 1) * singleheight - totalheight / 2);
            }
        });
        $(".dplayer-mask").on("click",function() {
            var eleEpisode = $(".playlist-content");
            if (eleEpisode.css("transform").match(/\d+/) > 0) {
                eleEpisode.css("transform", "scale(0)");
                $(this).removeClass("dplayer-mask-show");
            }
        });

        $(".playlist-content .video-item").on("click", function() {
            var $this = $(this);
            if ($this.hasClass("active")) return;
            $(".dplayer-mask").removeClass("dplayer-mask-show");

            var oldele = $(".video-item.active");
            oldele.removeClass("active");
            oldele.css({"background-color": "", "color": "#fff"});

            $this.addClass("active");
            $this.css({"background-color": "rgba(0,0,0,.3)", "color": "#0df"});

            location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + videoList[$this.index()].fs_id;
        });
        // 上下集
        $(".prev-icon").on("click",function () {
            var prevvideo = videoList[fileIndex - 1];
            if (prevvideo) {
                location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + prevvideo.fs_id;
            }
            else {
                obj.showTipError("没有上一集了");
            }
        });
        $(".next-icon").on("click",function () {
            var nextvideo = videoList[fileIndex + 1];
            if (nextvideo) {
                location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + nextvideo.fs_id;
            }
            else {
                obj.showTipError("没有下一集了");
            }
        });
    };

    obj.selectEpisodeHomePage = function () {
        var $ = obj.getJquery();
        if ($(".dplayer-icons-right #btn-select-episode").length) return;

        var videoList = [];
        $("#videoListView").find(".video-item").each(function () {
            videoList.push({
                server_filename: this.title
            })
        });

        var currpath = obj.require("system-core:context/context.js").instanceForSystem.router.query.get("path");
        var server_filename = currpath.split("/").pop()
        , fileIndex = videoList.findIndex(function (item, index) {
            return item.server_filename == server_filename;
        });
        if (!(fileIndex > -1 && videoList.length > 1)) return;

        var eleitem = "";
        videoList.forEach(function (item, index) {
            if (fileIndex == index) {
                eleitem += '<div class="video-item active" title="' + item.server_filename + '" style="background-color: rgba(0,0,0,.3);color: #0df;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;">' + item.server_filename + '</div>';
            }
            else {
                eleitem += '<div class="video-item" title="' + item.server_filename + '" style="color: #fff;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;">' + item.server_filename + '</div>';
            }
        });

        var html = '<button class="dplayer-icon dplayer-play-icon prev-icon" title="上一集"><svg t="1658231494866" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="22734" width="128" height="128" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><style type="text/css"></style></defs><path d="M757.527273 190.138182L382.510545 490.123636a28.020364 28.020364 0 0 0 0 43.752728l375.016728 299.985454a28.020364 28.020364 0 0 0 45.474909-21.876363V212.014545a28.020364 28.020364 0 0 0-45.474909-21.876363zM249.949091 221.509818a28.020364 28.020364 0 0 0-27.973818 27.973818v525.032728a28.020364 28.020364 0 1 0 55.994182 0V249.483636a28.020364 28.020364 0 0 0-28.020364-27.973818zM747.054545 270.242909v483.514182L444.834909 512l302.173091-241.757091z" fill="#333333" p-id="22735"></path></svg></button>';
        html += '<button id="btn-select-episode" class="dplayer-icon dplayer-quality-icon" title="选集">选集</button> <div class="playlist-content" style="max-width: 80%;max-height: 330px;width: auto;height: auto;box-sizing: border-box;overflow: hidden;position: absolute;left: 0;transition: all .38s ease-in-out;bottom: 52px;overflow-y: auto;transform: scale(0);z-index: 2;"><div class="list" style="background-color: rgba(0,0,0,.3);height: 100%;">' + eleitem + '</div></div>';
        html += '<button class="dplayer-icon dplayer-play-icon next-icon" title="下一集"><svg t="1658231512641" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="23796" xmlns:xlink="http://www.w3.org/1999/xlink" width="128" height="128"><defs><style type="text/css"></style></defs><path d="M248.506182 190.138182l374.970182 299.985454a28.020364 28.020364 0 0 1 0 43.752728L248.552727 833.861818a28.020364 28.020364 0 0 1-45.521454-21.876363V212.014545c0-23.505455 27.182545-36.538182 45.521454-21.876363z m507.485091 31.371636c15.453091 0 28.020364 12.567273 28.020363 27.973818v525.032728a28.020364 28.020364 0 1 1-55.994181 0V249.483636c0-15.453091 12.520727-27.973818 27.973818-27.973818zM258.978909 270.242909v483.514182L561.198545 512 258.978909 270.242909z" fill="#333333" p-id="23797"></path></svg></button>';
        $(".dplayer-icons-right").prepend(html);

        $("#btn-select-episode").on("click", function() {
            var eleEpisode = $(".playlist-content");
            if (eleEpisode.css("transform").match(/\d+/) > 0) {
                eleEpisode.css("transform", "scale(0)");
            }
            else {
                eleEpisode.css("transform", "scale(1)");
                $(".dplayer-mask").addClass("dplayer-mask-show");

                var singleheight = $(".dplayer-icons-right .video-item")[0].offsetHeight;
                var totalheight = $(".dplayer-icons-right .playlist-content").height();
                $(".dplayer-icons-right .playlist-content").scrollTop((fileIndex + 1) * singleheight - totalheight / 2);
            }
        });
        $(".dplayer-mask").on("click",function() {
            var eleEpisode = $(".playlist-content");
            if (eleEpisode.css("transform").match(/\d+/) > 0) {
                eleEpisode.css("transform", "scale(0)");
                $(this).removeClass("dplayer-mask-show");
            }
        });

        $(".playlist-content .video-item").on("click", function() {
            var $this = $(this);
            if ($this.hasClass("active")) return;
            $(".dplayer-mask").removeClass("dplayer-mask-show");

            var oldele = $(".video-item.active");
            oldele.removeClass("active");
            oldele.css({"background-color": "", "color": "#fff"});

            $this.addClass("active");
            $this.css({"background-color": "rgba(0,0,0,.3)", "color": "#0df"});

            var t = $this.index();
            var path = currpath.split("/").slice(0, -1).concat(videoList[t].server_filename).join("/");
            location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + t;
        });
        // 上下集
        $(".prev-icon").on("click",function () {
            var prevvideo = videoList[fileIndex - 1];
            if (prevvideo) {
                var t = fileIndex - 1;
                var path = currpath.split("/").slice(0, -1).concat(videoList[t].server_filename).join("/");
                location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + t;
            }
            else {
                obj.showTipError("没有上一集了");
            }
        });
        $(".next-icon").on("click",function () {
            var nextvideo = videoList[fileIndex + 1];
            if (nextvideo) {
                var t = fileIndex + 1;
                var path = currpath.split("/").slice(0, -1).concat(videoList[t].server_filename).join("/");
                location.hash = "#/video?path=" + encodeURIComponent(path) + "&t=" + t;
            }
            else {
                obj.showTipError("没有下一集了");
            }
        });
    };

    obj.autoPlayNext = function () {
        var path = location.pathname.split("/")[1];
        if (path == "s") {
            obj.playNextSharePage();
        }
        else if (path == "play") {
            obj.playNextHomePage();
        }
        else if (path == "mbox") {
        }
    };

    obj.playNextSharePage = function () {
        var fileList = JSON.parse(sessionStorage.getItem("sharePageFileList") || "[]")
        , videoList = fileList.filter(function (item, index) {
            return item.category == 1;
        })
        , file = obj.video_page.info[0]
        , fileIndex = videoList.findIndex(function (item, index) {
            return item.fs_id == file.fs_id;
        });
        if (!(fileIndex > -1 && videoList.length)) return;

        var nextvideo = videoList[fileIndex + 1];
        if (nextvideo) {
            location.search = "?fid=" + nextvideo.fs_id;
        }
        else {
            obj.msg("没有下一集了", "failure");
        }
    };

    obj.playNextHomePage = function () {
        var autoPlayNext = localStorage.getItem("dplayer-autoplaynext") == "true";
        if (!autoPlayNext) return;

        var listContainer = obj.getJquery()("#videoListView")
        , currentplay = listContainer.find(".currentplay")
        , nextSibling = currentplay.next();
        if (nextSibling.length) {
            var instanceForSystem = obj.require("system-core:context/context.js").instanceForSystem
            , router = instanceForSystem.router
            , path = router.query.get("path")
            , t = router.query.get("t");

            var title = nextSibling.attr("title")
            , nextpath = path.split("/").slice(1, -1).concat(title).join("/");
            location.hash = "#/video?path=" + encodeURIComponent("/" + nextpath);
        }
    };

    obj.resetPlayer = function () {
        obj.async("file-widget-1:videoPlay/context.js", function(c) {
            var count, id = count = setInterval(function() {
                var context = c.getContext() || {}, playerInstance = context.playerInstance;
                if (playerInstance && playerInstance.player) {
                    clearInterval(id);
                    playerInstance.player.dispose();
                    playerInstance.player = !1;
                }
                else if (++count - id > 60) {
                    clearInterval(id);
                }
            }, 500);
        });
    };

    obj.loadScript = function (src) {
        if (!window.instances) {
            window.instances = {};
        }
        if (!window.instances[src]) {
            window.instances[src] = new Promise((resolve, reject) => {
                const script = document.createElement("script")
                script.src = src;
                script.type = "text/javascript";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        return window.instances[src];
    };

    obj.appreciation = function (dPlayer) {
        if (this.contextmenu_show) return;
        this.contextmenu_show = true;
        localStorage.getItem("appreciation_show") || localStorage.setItem("appreciation_show", Date.now());
        if (Date.now() - localStorage.getItem("appreciation_show") > 86400000 * 7) {
            setTimeout(() => {
                dPlayer.contextmenu.show(dPlayer.container.offsetWidth / 2.5, dPlayer.container.offsetHeight / 3);
            }, dPlayer.video.duration / 10 * 1000);
        }
        document.querySelector("#dplayer .dplayer-menu-item").addEventListener('click', () => {
            dPlayer.contextmenu.hide();
            localStorage.setItem("appreciation_show", Date.now());
        });
    };

    obj.require = function (name) {
        return unsafeWindow.require(name);
    };

    obj.async = function (name, callback) {
        unsafeWindow.require.async(name, callback);
    };

    obj.getJquery = function () {
        return unsafeWindow.$ || unsafeWindow.jQuery || obj.require("base:widget/libs/jquerypacket.js");
    };

    obj.getVip = function () {
        return obj.require("base:widget/vip/vip.js").getVipValue();
    };

    obj.msg = function (msg, mode) {
        obj.require("system-core:system/uiService/tip/tip.js").show({ vipType: "svip", mode: mode || "success", msg: msg});
    };

    obj.run = function () {
        var url = location.href;
        if (url.indexOf(".baidu.com/s/") > 0) {
            obj.playVideoSharePage();
        }
        else if (url.indexOf(".baidu.com/play/video#/video") > 0) {
            obj.fetchVideoInfoHomePage(function (info) {
                if (info) {
                    obj.playVideoHomePage();
                }
            });
            window.onhashchange = function (e) {
                location.reload();
            };
        }
        else if (url.indexOf(".baidu.com/mbox/streampage") > 0) {
            obj.playVideoStreamPage();
        }
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
