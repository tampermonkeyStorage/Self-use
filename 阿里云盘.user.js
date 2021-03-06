// ==UserScript==
// @name         阿里云盘
// @namespace    http://tampermonkey.net/
// @version      2.1.7
// @description  支持生成文件下载链接（多种下载姿势），支持第三方播放器DPlayer（可自由切换，支持自动/手动添加字幕，突破视频2分钟限制，选集，上下集，自动记忆播放，跳过片头片尾, 字幕设置随心所欲...），支持自定义分享密码，支持图片预览，支持原生播放器优化，...
// @author       You
// @match        https://www.aliyundrive.com/s/*
// @match        https://www.aliyundrive.com/drive*
// @icon         https://gw.alicdn.com/imgextra/i3/O1CN01aj9rdD1GS0E8io11t_!!6000000000620-73-tps-16-16.ico
// @require      https://cdn.staticfile.org/jquery/3.6.0/jquery.min.js
// @run-at       document-body
// @connect      aliyundrive.com
// @connect      alicloudccp.com
// @connect      aliyuncs.com
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';
    unsafeWindow = unsafeWindow || window;
    var $ = $ || window.$;
    var obj = {
        file_page: {
            parent_file_id: "root",
            file_info: {},
            order_by: "",
            order_direction: "",
            next_marker_list: [],
            items: []
        },
        video_page: {
            play_info: {},
            subtitle_list: [],
            subtitle_exts: ["webvtt", "vtt", "srt", "ssa", "ass"],
            playerObject: {
                NativePlayer : {
                    name: "原生播放器",
                    container: "video"
                },
                DPlayer : {
                    name: "DPlayer播放器",
                    container: ".dplayer"
                }
            },
            file_id: "",
            elevideo: "",
            dPlayer: null,
            attributes: {},
            media_num: 0
        }
    };

    obj.initVideoPage = function () {
        obj.initButtonVideoPage();

        obj.initEventVideoPage();

        obj.getItem("default_player") == "NativePlayer" && obj.onNativeVideoPageEvent();
    };

    obj.initButtonVideoPage = function () {
        $(document).on("click", ".header-more--a8O0Y, .ant-dropdown-trigger", function() {
            if (document.querySelector("video")) {
                if ($(".ant-switch-lights").length == 0) {
                    $(".ant-dropdown-menu").append('<li class="ant-dropdown-menu-item ant-switch-lights" role="menuitem"><div class="outer-menu--ihDUR"><div>关灯</div></div></li>');
                }

                if ($(".ant-switch-player").length == 0) {
                    var preference = obj.getItem("default_player") || "DPlayer";
                    var players = obj.video_page.playerObject;
                    Object.keys(players).forEach(function(item) {
                        if (item != preference) {
                            $(".ant-dropdown-menu").append('<li class="ant-dropdown-menu-item ant-switch-player" role="menuitem" type=' + item + '><div class="outer-menu--ihDUR"><div>' + players[item].name + '</div></div></li>');
                        }
                    });
                }
            }
            else {
                $(".ant-switch-lights").remove();
                $(".ant-switch-player").remove();
            }
        });
    };

    obj.initEventVideoPage = function () {
        obj.switchLights();

        obj.switchPlayer();
    };

    obj.switchLights = function () {
        $(document).on("click", ".ant-switch-lights", function(event) {
            var thisText = $(this).children().children();
            var videoParents = $("video").closest("[class^=content]").children();
            if (thisText.text() == "关灯") {
                videoParents.css("background", "#000");
                thisText.text("开灯");
                if (obj.isHomePage()) {
                    $("[class^=toolbar-wrapper]").css("opacity", .1);
                }
            }
            else {
                videoParents.css("background", "");
                thisText.text("关灯");
                if (obj.isHomePage()) {
                    $("[class^=toolbar-wrapper]").css("opacity", 1);
                }
            }
        });

        $(document).on("click", "[data-icon-type=PDSClose]", function(event) {
            var thisText = $(".ant-switch-lights").children().children();
            if (thisText.text() == "开灯") {
                $("video").closest("[class^=content]").children().css("background", "");
                thisText.text("关灯");
                if (obj.isHomePage()) {
                    $("[class^=toolbar-wrapper]").css("opacity", 1);
                }
            }
        });
    };

    obj.switchPlayer = function () {
        $(document).on("click", ".ant-switch-player", function(event) {
            var $this = $(this), $thisType = $this.attr("type");
            var players = obj.video_page.playerObject;
            obj.showTipSuccess("正在切换到" + players[$thisType].name);

            var currentPlayer = obj.getItem("default_player");
            var currentPlayerObject = players[currentPlayer];

            $this.attr("type", currentPlayer);
            $this.children().children().text(currentPlayerObject.name);

            var container = currentPlayerObject.container;
            if ($thisType == "NativePlayer") {
                $(container).parent().append(obj.video_page.elevideo);
                $(container).remove();

                obj.video_page.dPlayer = null;
                obj.onNativeVideoPageEvent();

                $(".video-player--29_72").css({display: "block"});
                $(".video-player--29_72 .btn--1cZfA").click();
            }
            else {
                obj.offNativeVideoPageEvent();
            }

            obj.setItem("default_player", $thisType);
            obj.autoPlayer();
        });
    };

    obj.onNativeVideoPageEvent = function () {
        $(document).on("DOMNodeInserted", ".video-player--29_72 .btn--1cZfA", function() {
            var video = document.querySelector("video");
            if (video.paused) {
                $(this).click();
                setTimeout(function () {
                    try {
                        video.paused && video.play();
                        $(".video-player--29_72").css({opacity: 0});
                    } catch (a) {};
                }, 500);
            }
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

    obj.offNativeVideoPageEvent = function () {
        $(document).off("DOMNodeInserted", ".video-player--29_72 .btn--1cZfA");

        $(document).off("click", "video");

        $(document).off("mouseover mouseout mousedown", ".video-player--29_72");
    };

    obj.autoPlayer = function () {
        var preference = obj.getItem("default_player");
        if (!preference) {
            obj.showTipSuccess("脚本提示：打开页面右侧[更多]菜单可【切换播放器】", 10000);
            obj.setItem("default_player", "DPlayer");
            preference = "DPlayer";
        }

        if (preference == "DPlayer") {
            obj.useDPlayer();
        }
        else {
            obj.useNativePlayer();
        }
    };

    obj.useNativePlayer = function () {
        document.querySelector(".video-player--29_72").setAttribute("title", "长按拖动位置");
    };

    obj.useDPlayer = function () {
        obj.dPlayerSupport(function (result) {
            if (result) {
                obj.dPlayerStart();
            }
            else {
                obj.onNativeVideoPageEvent();
            }
        });
    };

    obj.dPlayerSupport = function (callback) {
        var urlArr = [
            [
                "https://cdn.staticfile.org/hls.js/1.1.4/hls.min.js",
                "https://cdn.staticfile.org/dplayer/1.26.0/DPlayer.min.js",
            ],
            [
                "https://cdn.bootcdn.net/ajax/libs/hls.js/1.1.4/hls.min.js",
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
        var dPlayerNode, videoNode = document.querySelector("video");
        if (videoNode) {
            dPlayerNode = document.getElementById("dplayer");
            if (!dPlayerNode) {
                dPlayerNode = document.createElement("div");
                dPlayerNode.setAttribute("id", "dplayer");
                dPlayerNode.setAttribute("style", "width: 100%; height: 100%;");
                var videoParentNode = videoNode.parentNode.parentNode;
                obj.video_page.elevideo = videoParentNode.parentNode.replaceChild(dPlayerNode, videoParentNode);
            }
        }
        else {
            setTimeout(obj.dPlayerStart, 500);
            return;
        }

        var quality = [], defaultQuality, localQuality = localStorage.getItem("dplayer-quality");;
        var play_info = obj.video_page.play_info || {};
        var video_preview_play_info = play_info.video_preview_play_info || {};
        var task_list = video_preview_play_info.live_transcoding_task_list;
        if (Array.isArray(task_list)) {
            var pds = {
                FHD: "1080 全高清",
                HD: "720 高清",
                SD: "540 标清",
                LD: "360 流畅"
            };
            task_list.forEach(function (item, index) {
                var name = pds[item.template_id];
                localQuality ? localQuality == name && (defaultQuality = index) : defaultQuality = index;
                quality.push({
                    name: name,
                    url: item.url || item.preview_url,
                    type: "hls"
                });
            });
            defaultQuality == undefined && (defaultQuality = task_list.length - 1);
        }
        else {
            obj.showTipError("获取播放信息失败：请刷新网页重试");
            return;
        }

        if (obj.video_page.file_id == play_info.file_id) {
            if (obj.video_page.dPlayer && obj.video_page.dPlayer.destroy) {
                var video = obj.video_page.dPlayer.video;
                obj.video_page.attributes = {
                    currentTime: video.currentTime,
                    muted: video.muted
                };

                obj.video_page.dPlayer.destroy();
                obj.video_page.dPlayer = null;
            }
        }
        else {
            obj.offsettime = 0;

            obj.video_page.file_id = play_info.file_id;
            obj.video_page.attributes = {};
        }

        var options = {
            container: dPlayerNode,
            video: {
                quality: quality,
                defaultQuality: defaultQuality
            },
            subtitle: {
                url: "",
                type: "webvtt",
                fontSize: (localStorage.getItem("dplayer-subtitle-fontSize") || 5) + "vh",
                bottom: (localStorage.getItem("dplayer-subtitle-bottom") || 10) + "%",
                color: localStorage.getItem("dplayer-subtitle-color") || "#ffd821",
            },
            autoplay: true,
            screenshot: true,
            hotkey: false,
            airplay: true,
            volume: 1.0,
            playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 2],
            contextmenu: [
                {
                    text: "支持作者",
                    link: "https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png",
                },
            ],
            theme: "#b7daff"
        };

        try {
            var player = obj.video_page.dPlayer = new unsafeWindow.DPlayer(options);

            var attributes = obj.video_page.attributes;
            if (Object.keys(attributes).length) {
                player.seek(attributes.currentTime - 1);
                player.video.muted = attributes.muted;
            }

            player.on("loadstart", function () {
                obj.selectEpisode();
                obj.memoryPlay();
            });
            player.on("loadedmetadata", function () {
                options.hotkey || obj.dPlayerHotkey();
                obj.addCueVideoSubtitle(function (textTrackList) {
                    textTrackList && obj.selectSubtitles(textTrackList);
                });
                obj.playSetting();
                obj.autoPlayNext();
            });
            player.on("quality_end", function () {
                obj.addCueVideoSubtitle(function (textTrackList) {
                    textTrackList && obj.selectSubtitles(textTrackList);
                });
            });

            player.speed(localStorage.getItem("dplayer-speed") || 1);
            player.on("ratechange", function () {
                player.notice("播放速度：" + player.video.playbackRate);
                localStorage.getItem("dplayer-speed") == player.video.playbackRate || localStorage.setItem("dplayer-speed", player.video.playbackRate);
            });
            player.on("quality_end", function () {
                localStorage.setItem("dplayer-quality", player.quality.name);
            });

            //默认全屏，回车切换网页全屏和浏览器全屏
            //player.fullScreen.request("web");
            localStorage.getItem("dplayer-isfullscreen") == "true" && player.fullScreen.request("browser");
            player.on("fullscreen", function () {
                localStorage.setItem("dplayer-isfullscreen", true);
            });
            player.on("fullscreen_cancel", function () {
                localStorage.removeItem("dplayer-isfullscreen");
                player.fullScreen.request("web");
            });
        } catch (error) {
            console.error("播放器创建失败", error);
        }
    };

    obj.dPlayerHotkey = function () {
        if (window.dPlayerHotkey) return;
        window.dPlayerHotkey = true;

        document.addEventListener("keydown", (function(e) {
            var t = obj.video_page.dPlayer;
            if (t && document.getElementById("dplayer")) {
                var a = document.activeElement.tagName.toUpperCase()
                , n = document.activeElement.getAttribute("contenteditable");
                if ("INPUT" !== a && "TEXTAREA" !== a && "" !== n && "true" !== n) {
                    var o, r = e || window.event;
                    switch (r.keyCode) {
                        case 13:
                            r.preventDefault();
                            t.fullScreen.toggle();
                            break;
                        case 32:
                            r.preventDefault();
                            t.toggle();
                            break;
                        case 37:
                            r.preventDefault();
                            t.seek(t.video.currentTime - 5);
                            break;
                        case 39:
                            r.preventDefault();
                            t.seek(t.video.currentTime + 5);
                            break;
                        case 38:
                            r.preventDefault();
                            o = t.volume() + .01;
                            t.volume(o);
                            break;
                        case 40:
                            r.preventDefault();
                            o = t.volume() - .01;
                            t.volume(o);
                            break;
                        case 36:
                            r.preventDefault();
                            t.notice("上一项");
                            o = document.querySelector("[data-icon-type=PDSChevronLeft]") || document.querySelector("[data-icon-type=PDSLeftNormal]");
                            o && o.click();
                            break;
                        case 35:
                            r.preventDefault();
                            t.notice("下一项");
                            o = document.querySelector("[data-icon-type=PDSChevronRight]") || document.querySelector("[data-icon-type=PDSRightNormal]");
                            o && o.click();
                            break;
                    }
                }
            }
        }));
    };

    obj.playSetting = function () {
        //将片头片尾放在设置里 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        if ($(".dplayer-setting-skipstart").length) return;

        var html = '<div class="dplayer-setting-item dplayer-setting-jumpend" style="display:none"><span class="dplayer-label">片尾(秒)</span><input type="text" name="dplayer-toggle" class="dplayer-toggle" style="height: 15px; font-size: 13px;border: 1px solid #fff;border-radius: 15px;"></div><div class="dplayer-setting-item dplayer-setting-jumpstart" style="display:none"><span class="dplayer-label">片头(秒)</span><input type="text" name="dplayer-toggle" class="dplayer-toggle" style="height: 15px; font-size: 13px;border: 1px solid #fff;border-radius: 15px;"></div><div class="dplayer-setting-item dplayer-setting-skipstart"><span class="dplayer-label">跳过片头片尾</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-skipstart" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-autoposition"><span class="dplayer-label">自动记忆播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoposition" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        $(".dplayer-setting-origin-panel").prepend(html);
        html =` <div class="dplayer-setting-item dplayer-setting-subtitle"><span class="dplayer-label">字幕设置</span></div></div>`
        $(".dplayer-setting-origin-panel").append(html);

        $(".dplayer-setting-subtitle").on("click", function() {
            obj.subtitleSetting();
        });
        $(".dplayer-mask").on("click",function() {
            if ($(".subtitle-setting-box").css("display") != "none") {
                $(".subtitle-setting-box").toggle();
                $(this).removeClass("dplayer-mask-show");
            }
        });
        var jumpstart = obj.getPlayMemory("jumpstart") || "60"; // 默认跳过片头
        var jumpend = obj.getPlayMemory("jumpend") || "130"; // 默认跳过片尾
        var skipstart = obj.getPlayMemory("skipstart");
        typeof skipstart == "boolean" || (skipstart = true); //默认开启跳过片头片尾
        if (skipstart) {
            $(".dplayer-toggle-setting-input-skipstart").get(0).checked = true;
            $(".dplayer-setting-jumpstart").show();
            $(".dplayer-setting-jumpend").show();
        }

        var txt = $(".dplayer-setting-jumpstart .dplayer-toggle");
        txt.val(jumpstart);
        txt.change(function() {
            obj.setPlayMemory("jumpstart", txt.val());
            jumpstart = txt.val();
        });
        txt.on('input propertychange', function(e) {
            var text = txt.val().replace(/[^\d]/g, "");
            txt.val(text);
        });

        var txt1 = $(".dplayer-setting-jumpend .dplayer-toggle");
        txt1.val(jumpend);
        txt1.change(function() {
            obj.setPlayMemory("jumpend", txt1.val());
            jumpend = txt1.val();
        });
        txt1.on('input propertychange', function(e) {
            var text = txt.val().replace(/[^\d]/g, "");
            txt.val(text);
        });

        $(".dplayer-setting-skipstart").on("click", function() {
            var check = $(".dplayer-toggle-setting-input-skipstart");
            skipstart = !check.is(":checked");
            $(".dplayer-toggle-setting-input-skipstart").get(0).checked = skipstart;
            obj.setPlayMemory("skipstart", skipstart);
            if (skipstart) {
                $(".dplayer-setting-jumpstart").show()
                $(".dplayer-setting-jumpend").show()
                txt.val(jumpstart);
                txt1.val(jumpend);
                obj.setPlayMemory("jumpstart", jumpstart);
                obj.setPlayMemory("jumpend", jumpend);

                if($(".dplayer-setting-loop .dplayer-toggle-setting-input").is(":checked")) {
                    $(".dplayer-setting-loop .dplayer-toggle-setting-input").click();
                }
            }
            else{
                $(".dplayer-setting-jumpstart").hide()
                $(".dplayer-setting-jumpend").hide()
            }
        });

        obj.getItem("dplayer-position") && ($(".dplayer-toggle-setting-input-autoposition").get(0).checked = true);
        $(".dplayer-setting-autoposition").on("click", function() {
            var check = $(".dplayer-toggle-setting-input-autoposition");
            var autoPosition = !check.is(":checked");
            $(".dplayer-toggle-setting-input-autoposition").get(0).checked = autoPosition;
            obj.setItem("dplayer-position", autoPosition);
        });

        $(".dplayer-setting-loop").on("click", function() {
            if ($(".dplayer-setting-loop .dplayer-toggle-setting-input").is(":checked") && skipstart) {
                $(".dplayer-setting-skipstart").click();
            }
            $(".dplayer-setting-icon").click();
        });
    };

    obj.memoryPlay = function () {
        if (obj.hasMemoryDisplay) return;
        obj.hasMemoryDisplay = true;

        var jumpstart = obj.getPlayMemory("jumpstart") || "60"; // 默认跳过片头
        var jumpend = obj.getPlayMemory("jumpend") || "130"; // 默认跳过片尾
        var skipstart = obj.getPlayMemory("skipstart");
        typeof skipstart == "boolean" || (skipstart = true); //默认开启跳过片头片尾

        var player = obj.video_page.dPlayer;
        var playInfo = obj.video_page.play_info;
        var fileList = obj.file_page.items
        , file = fileList.find(function (item, index) {
            return item.file_id == playInfo.file_id;
        })
        , sign = file ? file.file_id : ""
        , memoryTime = obj.getPlayMemory(sign);
        if (memoryTime && parseInt(memoryTime)) {
            var autoPosition = obj.getItem("dplayer-position");
            if (autoPosition) {
                player.seek(memoryTime - 1);
            }
            else {
                var formatTime = formatVideoTime(memoryTime);
                $(player.container).append('<div class="memory-play-wrap" style="display: block;position: absolute;left: 33px;bottom: 66px;font-size: 15px;padding: 7px;border-radius: 3px;color: #fff;z-index:100;background: rgba(0,0,0,.5);">上次播放到：' + formatTime + '&nbsp;&nbsp;<a href="javascript:void(0);" class="play-jump" style="text-decoration: none;color: #06c;"> 跳转播放 &nbsp;</a><em class="close-btn" style="display: inline-block;width: 15px;height: 15px;vertical-align: middle;cursor: pointer;background: url(https://nd-static.bdstatic.com/m-static/disk-share/widget/pageModule/share-file-main/fileType/video/img/video-flash-closebtn_15f0e97.png) no-repeat;"></em></div>');
                var memoryTimeout = setTimeout(function () {
                    skipstart && jumpstart && jumpstart > player.video.currentTime && player.seek(jumpstart);
                    $(".memory-play-wrap").remove();
                }, 15000);
                $(".memory-play-wrap .close-btn").click(function () {
                    skipstart && jumpstart && jumpstart > player.video.currentTime && player.seek(jumpstart);
                    $(".memory-play-wrap").remove();
                    clearTimeout(memoryTimeout);
                });
                $(".memory-play-wrap .play-jump").click(function () {
                    player.seek(memoryTime - 1);
                    $(".memory-play-wrap").remove();
                    clearTimeout(memoryTimeout);
                });
            }
        }
        else {
            if (typeof skipstart == "boolean") {
                skipstart && jumpstart && player.seek(jumpstart);
            }
        }

        var duration = player.video.duration;
        document.onvisibilitychange = function () {
            if (document.visibilityState === "hidden") {
                var currentTime = player.video.currentTime;
                currentTime && obj.setPlayMemory(sign, currentTime, duration, jumpstart, jumpend);
                obj.setPlayMemory("last_file_id", sign);
            }
        };
        window.onbeforeunload = function () {
            var currentTime = player.video.currentTime;
            currentTime && obj.setPlayMemory(sign, currentTime, duration, jumpstart, jumpend);
            obj.setPlayMemory("last_file_id", sign);
        };
        $("[data-icon-type=PDSClose]").on("click", function () {
            var currentTime = player.video.currentTime;
            currentTime && obj.setPlayMemory(sign, currentTime, duration, jumpstart, jumpend);
            obj.setPlayMemory("last_file_id", sign);
            obj.autoLastBtn();
        });

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

    obj.autoPlayNext = function () {
        var jumpstart = obj.getPlayMemory("jumpstart") || "60"; // 默认跳过片头
        var jumpend = obj.getPlayMemory("jumpend") || "130"; // 默认跳过片尾
        var skipstart = obj.getPlayMemory("skipstart");
        typeof skipstart == "boolean" || (skipstart = true); //默认开启跳过片头片尾

        var playInfo = obj.video_page.play_info;
        var fileList = obj.file_page.items
        , file = fileList.find(function (item, index) {
            return item.file_id == playInfo.file_id;
        })
        , sign = file ? file.file_id : ""

        var player = obj.video_page.dPlayer;
        var video = player.video, duration = video.duration;
        player.on("timeupdate", function () {
            if (!this.autonext && skipstart && jumpend) {
                var currentTime = video.currentTime;
                if (duration - currentTime <= parseInt(jumpend) + 10 * video.playbackRate) {
                    this.autonext = true;
                    obj.setPlayMemory(sign, currentTime + 20 * video.playbackRate, duration, jumpstart, jumpend);
                    $(player.container).append('<div class="memory-play-wrap" style="display: block;position: absolute;left: 33px;bottom: 66px;font-size: 15px;padding: 7px;border-radius: 3px;color: #fff;z-index:100;background: rgba(0,0,0,.5);">10秒后自动下一集&nbsp;&nbsp;<a href="javascript:void(0);" class="play-jump" style="text-decoration: none;color: #06c;"> 取消 &nbsp;</a><em class="close-btn" style="display: inline-block;width: 15px;height: 15px;vertical-align: middle;cursor: pointer;background: url(https://nd-static.bdstatic.com/m-static/disk-share/widget/pageModule/share-file-main/fileType/video/img/video-flash-closebtn_15f0e97.png) no-repeat;"></em></div>');
                    var memoryTimeout = setTimeout(function () {
                        obj.LastNextPlay('next');
                        $(".memory-play-wrap").remove();
                    }, 10000);
                    $(".memory-play-wrap .close-btn").click(function () {
                        clearTimeout(memoryTimeout);
                        $(".memory-play-wrap").remove();
                    });
                    $(".memory-play-wrap .play-jump").click(function () {
                        clearTimeout(memoryTimeout);
                        $(".memory-play-wrap").remove();
                    });
                }
            }
        });
    };

    obj.selectSubtitles = function (textTrackList) {
        //字幕选择 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        if (textTrackList.length <= 1) return;

        var subtitlebtn = $(".dplayer-subtitle-btn")
        subtitlebtn.addClass("dplayer-quality");

        var subList = obj.video_page.subtitle_list;
        var eleSub = '<div class="dplayer-quality-item subtitle-item" data-index="'+ 0 +'" style="opacity: 0.4;">默认字幕</div>';
        for(var i = 1; i < subList.length; i++) {
            eleSub += '<div class="dplayer-quality-item subtitle-item" data-index="'+ i +'">'+ subList[i].label +'</div>';
        }
        var html = '<div class="dplayer-quality-mask"><div class="dplayer-quality-list subtitle-select"> '+ eleSub +'</div> </div>'
        subtitlebtn.append(html);

        $(".subtitle-select .subtitle-item").on("click", function() {
            var subtitlepicbtn = $(".dplayer-subtitle-btn .dplayer-icon-content");
            var $this = $(this), index = $this.attr("data-index");
            if ($this.css("opacity") == "1") {
                subtitlepicbtn.css("opacity", "1");
                $this.css("opacity", "0.4");
                $this.siblings().css("opacity", "");
                for(var i = textTrackList[0].cues.length - 1; i >= 0; i--) {
                    textTrackList[0].removeCue(textTrackList[0].cues[i]);
                }
                var item = subList[index];
                item.subarr.forEach(function (item) {
                    /<b>.*<\/b>/.test(item.text) || (item.text = item.text.split(/\r?\n/).map((item) => `<b>${item}</b>`).join("\n"));
                    var textTrackCue = new VTTCue(item.startTime, item.endTime, item.text);
                    textTrackCue.id = item.index;
                    textTrackList[0] && textTrackList[0].addCue(textTrackCue);
                });
                if (subtitlepicbtn.css("opacity") == "0.4") {
                    subtitlepicbtn.click();
                }
                obj.subListIndex = index;
            }
        });

        var subListIndex = obj.subListIndex;
        subListIndex && $(".subtitle-select .subtitle-item").eq(subListIndex).click();
    };

    obj.selectEpisode = function () {
        //选集 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        if ($(".dplayer-icons-right #btn-video-select").length) return;

        var elevideos = "";
        var thisFileId = obj.video_page.play_info.file_id;
        var thisvideoindex = 0;
        var fileList = obj.file_page.items;
        var videoList = fileList.filter(function (item, index) {
            if (item.category == "video") {
                var iscurrent = item.file_id == thisFileId;
                iscurrent && (thisvideoindex = index);
                var opacitytmp = iscurrent ? 'style="opacity: 0.4;"' : '';
                elevideos += '<li class="drawer-item--2cNtQ " '+ opacitytmp +' data-is-current="'+ iscurrent +'"><div class="meta--3-qtu"><p class="title--2vewu" title="'+ item.name +'"><span class="filename--3hcxw">'+ item.name +'</span></p></div></li>';
                return true;
            }
            return false;
        });

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z"></path></svg>'
        var html = '<button class="dplayer-icon dplayer-play-icon left-icon" style="transform: rotate(-180deg)" title="上一集">'+ svg +'</button>';
        html += '<div class="dplayer-setting"><button id="btn-video-select" class="dplayer-icon dplayer-quality-icon" title="选集">选集</button><div class="drawer-container--1M9Iy" data-open="true" data-is-current="true" style="left:-135px; display:none; width: 315px;height: 345px;bottom: 60px;"><div class="drawer-wrapper--3Yfpw" style="height: 345px;"><header class="header--2Y80e"><p class="title--CbV-V">选集</p><div class="btn-close--TihlS"><span data-role="icon" data-render-as="svg" data-icon-type="PDSChevronDown" class="icon--tTxIr icon--d-ejA " style="transform: rotate(90deg)">'+svg+'</span></div></header><section class="scroll-container--Ho4ra" style="height: 280px;"><div class="scroll-wrapper--zw1q2"><ul class="drawer-list--JYzyI">'+ elevideos +'</ul></div></section></div></div></div>';
        html += '<button class="dplayer-icon dplayer-play-icon right-icon" title="下一集">'+ svg +'</button>';
        $(".dplayer-icons-right").prepend(html);

        var speed = 800;
        $(".dplayer-icons-right #btn-video-select").on("click", function() {
            var ele = $(this).next();
            if(ele.css("display")== "none") {
                ele.fadeToggle(speed);
                $(".dplayer-mask").addClass("dplayer-mask-show");
                var itemheight = $(".dplayer-icons-right .drawer-container--1M9Iy ul li")[0].offsetHeight;
                var allitemheight = $(".scroll-container--Ho4ra").height();
                $(".scroll-container--Ho4ra").scrollTop((thisvideoindex+1) * itemheight - (allitemheight) / 2);
            }
            else {
                ele.fadeToggle(speed)
            }
        });
        $(".dplayer-icons-right .btn-close--TihlS").on("click", function() {
            $(".dplayer-icons-right .drawer-container--1M9Iy").fadeToggle(speed);
            $(".dplayer-mask").removeClass("dplayer-mask-show")
        });
        $(".dplayer-icons-right .drawer-container--1M9Iy ul li").on("click", function() {
            var $this = $(this);
            if ($this.attr("data-is-current") == "false") {
                $this.attr("data-is-current", "true");
                $this.css("opacity", "0.4");
                $this.siblings().attr("data-is-current", "false");
                $this.siblings().css("opacity", "1");
                obj.playByFileId(videoList[$this.index()].file_id);
            }
        });
        $(".dplayer-mask").on("click",function() {
            if ($(".dplayer-icons-right .drawer-container--1M9Iy").css("display") != "none") {
                $(".dplayer-icons-right .drawer-container--1M9Iy").fadeToggle(speed);
                $(this).removeClass("dplayer-mask-show");
            }
        });

        // 上下集
        $(".left-icon").on("click",function(){
            obj.LastNextPlay('last');
        });
        $(".right-icon").on("click",function(){
            obj.LastNextPlay('next');
        });
    };

    obj.LastNextPlay = function(type) {
        // 上下集 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        var playInfo = obj.video_page.play_info;
        var fileList = obj.file_page.items
        , fileIndex, file = fileList.find(function (item, index) {
            fileIndex = index;
            return item.file_id == playInfo.file_id;
        });
        var playfile = fileList.filter(function (item, index) {
            return item.category == "video" && ((fileIndex < index && type == 'next') || (fileIndex > index && type == 'last'));
        });
        var playfiletmp;
        if (type == 'next') {
            playfiletmp = playfile[0];
        }
        else{
            playfiletmp = playfile[playfile.length - 1];
        }
        playfiletmp ? obj.playByFileId(playfiletmp.file_id) : obj.video_page.dPlayer.notice((type == 'last' ? "上" : "下") + "一集已经没有了");
    };

    obj.playByFileId = function(file_id){
        file_id = file_id || obj.getPlayMemory("last_file_id");
        if (file_id) {
            obj.video_page.file_id = file_id;
            obj.getVideoPreviewPlayInfo();
            obj.video_page.dPlayer = null;
            obj.hasMemoryDisplay = false;

            var fileList = obj.file_page.items
            , file = fileList.find(function (item, index) {
                return item.file_id == file_id;
            })
            , name = file ? file.name : "";
            name && $(".header-file-name--CN_fq, .text--2KGvI").text(name);
        }
    };

    obj.playByScroll = function(){
        // 继续上次播放 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        var last_file_id = obj.getPlayMemory("last_file_id");
        var fileList = obj.file_page.items
        , file = fileList.find(function (item, index) {
            return item.file_id == last_file_id;
        })
        , lastplay = file ? file.name : "";

        var soretype=$('.switch-wrapper--1yEfx .icon--d-ejA').attr("data-icon-type");
        var topp = 0;
        var scrollerdiv = $(".scroller--2hMGk,.grid-scroll--3o7hp");
        var he = 0;
        var url = location.href;
        if (url.indexOf(".aliyundrive.com/s/") > 0) {
            he = $(".thead--JwBMm,.top-element-wrapper--1iOwf").next().children().height();
        }
        else if (url.indexOf(".aliyundrive.com/drive") > 0) {
            he = scrollerdiv.children().children().height();
        }
        //通过文件列表定位上次播放文件
        var rownum=1;
        if(soretype=='PDSDrag'){//平铺模式
            var lastbox=$(".grid-card-container.first-row-item--AGVET:last");
            rownum=Number( lastbox.attr('data-index'))+1;
        }

        for(var i = 0; i < fileList.length; i++) {
            var tmptext = fileList[i].name;
            if (tmptext == lastplay) {
                topp = (parseInt(i/rownum) * (he / Math.ceil(fileList.length/rownum)));
            }
        }
        scrollerdiv.scrollTop(topp);
        //移动滚动条后点击上次播放文件
        setTimeout(() => {
            $(".text-primary--3DHOJ,.title--3x5k2").each( function () {
                var tmptext = this.textContent;
                if(tmptext == lastplay){
                    this.click();
                }
            });
        },500)
    };

    obj.autoLastBtn = function () {
        var lastplay = obj.getPlayMemory("last_file_id");
        if (lastplay) {
            $(".button-last--batch").show();
        }
        else{
            $(".button-last--batch").hide();
        }
    };

    obj.subtitleSetting = function () {
        var subSetBox = $(".subtitle-setting-box");
        if (subSetBox.length) {
            if (subSetBox.css("display") == "block") {
                subSetBox.css("display", "none");
            }
            else {
                subSetBox.css("display", "block");
            }
            return;
        }
        else {
            var html = '<div class="dplayer-icons dplayer-comment-box subtitle-setting-box" style="display: block; z-index: 111; position: absolute; bottom: 10px;left:auto; right: 400px !important;"><div class="dplayer-comment-setting-box dplayer-comment-setting-open" >';
            html += '<div class="dplayer-comment-setting-color"><div class="dplayer-comment-setting-title">字幕颜色<input type="text" class="color-value" style="height: 16px;width: 70px;font-size: 14px;border: 1px solid #fff;border-radius: 3px;margin-left: 70px;color: black;text-align: center;"></div><label><input type="radio" name="dplayer-danmaku-color-1" value="#fff" checked=""><span style="background: #fff;"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#e54256"><span style="background: #e54256"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#ffe133"><span style="background: #ffe133"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#64DD17"><span style="background: #64DD17"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#39ccff"><span style="background: #39ccff"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#D500F9"><span style="background: #D500F9"></span></label></div>';
            html += '<div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕位置</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>上移</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0" checked=""><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>下移</span></label></div>';
            html += '<div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕大小</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>加大</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>减小</span></label></div>';
            html += '<div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕偏移<span class="offset-text" style="border: 0px;width: 58px;"></span>偏移量 <input type="number" class="offset-value" style="height: 14px;width: 42px;font-size: 13px;border: 1px solid #fff;border-radius: 3px;color: black;line-height: normal;text-align: center;" step="1" min="1"></div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>前移</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>后移</span></label></div>';
            html += '<div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">更多字幕功能</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>本地字幕</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>待定</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>网络字幕</span></label></div>';
            html += '</div></div>';
            $(".dplayer-controller").append(html);

            subSetBox = $(".subtitle-setting-box");
            var colortxt = $(".color-value");
            colortxt.val(localStorage.getItem("dplayer-subtitle-color")||"#ffe133")
            colortxt.on('input propertychange', function(e) {
                var color = colortxt.val();
                color = color.replace(/[^#0-9a-fA-F]/g, "");//排除#和十六进制字符
                color = color.replace(/^[0-9a-fA-F]/g, "");//排除非#开头
                color = color.replace("#", "$@$").replace(/\#/g, "").replace("$@$", "#");//排除多个#
                color = color.replace(/^#([0-9a-fA-F]{3,6}).*$/, '#$1');//排除十六进制字符长度超过6位

                colortxt.val(color);
                if (localStorage.getItem("dplayer-subtitle-color") != color) {
                    localStorage.setItem("dplayer-subtitle-color", color);
                    $(".dplayer-subtitle").css("color", color);
                }
            });
            var txt = $(".offset-value");
            txt.val("5");
            txt.on('input propertychange', function(e) {
                var text = txt.val().replace(/[^\d]/g, "");
                txt.val(text);
            });
        }

        $(".subtitle-setting-box .dplayer-comment-setting-color input[type='radio']").on("click",function() {
            var color = this.value;
            if (localStorage.getItem("dplayer-subtitle-color") != color) {
                localStorage.setItem("dplayer-subtitle-color", color);
                $(".dplayer-subtitle").css("color", color);
            }
            colortxt.val(color)
        });
        $(".subtitle-setting-box .dplayer-comment-setting-type input[type='radio']").on("click",function() {
            var value = this.value;
            var $this = $(this), $name = $this.parent().parent().children(":first").text();
            if ($name == "字幕位置") {
                var bottom = Number(localStorage.getItem("dplayer-subtitle-bottom") || 10);
                if (value == "0") {
                    localStorage.setItem("dplayer-subtitle-bottom", 10);
                    $(".dplayer-subtitle").css("bottom", "10%");
                }
                else if (value == "1") {
                    bottom += 1;
                    localStorage.setItem("dplayer-subtitle-bottom", bottom);
                    $(".dplayer-subtitle").css("bottom", bottom + "%");
                }
                else if (value == "2") {
                    bottom -= 1;
                    localStorage.setItem("dplayer-subtitle-bottom", bottom);
                    $(".dplayer-subtitle").css("bottom", bottom + "%");
                }
            }
            else if ($name == "字幕大小") {
                var fontSize = Number(localStorage.getItem("dplayer-subtitle-fontSize") || 5);
                if (value == "0") {
                    localStorage.setItem("dplayer-subtitle-fontSize", 5);
                    $(".dplayer-subtitle").css("font-size", "5vh");
                }
                else if (value == "1") {
                    fontSize += .1;
                    localStorage.setItem("dplayer-subtitle-fontSize", fontSize);
                    $(".dplayer-subtitle").css("font-size", fontSize + "vh");
                }
                else if (value == "2") {
                    fontSize -= .1;
                    localStorage.setItem("dplayer-subtitle-fontSize", fontSize);
                    $(".dplayer-subtitle").css("font-size", fontSize + "vh");
                }
            }
            else if ($name.includes("字幕偏移")){
                var video = document.querySelector("video");
                if (video) {
                    var textTracks = video.textTracks;
                    var offsettime = obj.offsettime || 0;
                    var offsetvalue = Number($(".offset-value").val())||5
                    if (value == "0") {
                        obj.offsettime = 0;
                    }
                    else if (value == "1") {
                        obj.offsettime = offsettime - offsetvalue;
                    }
                    else if (value == "2") {
                        obj.offsettime = offsettime + offsetvalue;
                    }
                    if(obj.offsettime==0){
                        $(".offset-text").text("")
                    }
                    else{
                        $(".offset-text").text("["+ obj.offsettime +"s]")
                    }
                    obj.subtitleOffset(textTracks);
                }
            }
            else if ($name == "更多字幕功能") {
                if (value == "0") {
                    $this.next().text("暂无");
                    setTimeout (function () {
                        $this.next().text("待定")
                    }, 5000);
                }
                else if (value == "1") {
                    if ($("#addsubtitle").length == 0) {
                        $("body").append('<input id="addsubtitle" type="file" accept=".srt,.ass,.ssa,.vtt" style="display: none;">');
                    }
                    $("#addsubtitle").click();

                    $this.next().text("请等待...");
                    setTimeout (function () {
                        $this.next().text("本地字幕")
                    }, 5000);
                }
                else if (value == "2") {
                    $this.next().text("暂无");
                    setTimeout (function () {
                        $this.next().text("网络字幕")
                    }, 5000);
                }
            }
        });
    };

    obj.subtitleOffset = function (textTrackList){
        var offsettime = obj.offsettime || 0;
        var subList = obj.video_page.subtitle_list;
        var index = obj.subListIndex || 0;
        var item = subList[index];
        for(var i = textTrackList[0].cues.length - 1; i >= 0; i--) {
            textTrackList[0].removeCue(textTrackList[0].cues[i]);
        }
        item.subarr.forEach(function (item) {
            /<b>.*<\/b>/.test(item.text) || (item.text = item.text.split(/\r?\n/).map((item) => `<b>${item}</b>`).join("\n"));
            var textTrackCue = new VTTCue(item.startTime + offsettime, item.endTime + offsettime, item.text);
            textTrackCue.id = item.index;
            textTrackList[0] && textTrackList[0].addCue(textTrackCue);
        });
    };

    obj.getPlayMemory = function (e) {
        var fileList = obj.file_page.items
        , parent_file_id = fileList[0].parent_file_id
        , videoMemory = obj.getItem("video_memory");
        if (videoMemory && videoMemory[parent_file_id]) {
            return videoMemory[parent_file_id][e];
        }
        return "";
    };

    obj.setPlayMemory = function (e, t, o, start, end) {
        if (e) {
            var fileList = obj.file_page.items
            , parent_file_id = fileList[0].parent_file_id
            , videoMemory = obj.getItem("video_memory") || {};
            if (typeof t == "number" && o) {
                if ((start && (t <= parseInt(start)) || end && (t + parseInt(end) >= o))) {
                    if (videoMemory.hasOwnProperty(parent_file_id) && videoMemory[parent_file_id].hasOwnProperty(e)) {
                        delete videoMemory[parent_file_id][e];
                    }
                }
                else {
                    videoMemory[parent_file_id] || (videoMemory[parent_file_id] = {});
                    videoMemory[parent_file_id][e] = t;
                }
                obj.setItem("video_memory", videoMemory);
            }
            else {
                Object.keys(videoMemory).forEach(function (key) {
                    var time = videoMemory[key].time;
                    if (time && (parseInt(Date.now() / 1000) - time >= 864000)) {
                        delete videoMemory[key];
                    }
                });
                if (!videoMemory[parent_file_id]) {
                    videoMemory[parent_file_id] = {
                        time: parseInt(Date.now() / 1000)
                    };
                }
                videoMemory[parent_file_id][e] = t;
                obj.setItem("video_memory", videoMemory);
            }
        }
    };

    obj.getVideoPreviewPlayInfo = function () {
        if (obj.isHomePage()) {
            obj.get_video_preview_play_info();
        }
        else {
            obj.get_share_link_video_preview_play_info();
        }
    };

    obj.get_share_link_video_preview_play_info = function (callback) {
        var token = obj.getItem("token") || {}, share_id = obj.getShareId(), file_id = obj.video_page.file_id || obj.video_page.play_info.file_id;
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/v2/file/get_share_link_video_preview_play_info",
            data: JSON.stringify({
                category: "live_transcoding",
                file_id: file_id,
                get_preview_url: true,
                share_id: share_id,
                template_id: "",
                get_subtitle_info: !0
            }),
            headers: {
                "authorization": "".concat(token.token_type || "", " ").concat(token.access_token || ""),
                "content-type": "application/json;charset=UTF-8",
                "x-share-token": obj.getItem("shareToken").share_token
            },
            async: true,
            success: function (response) {
                callback && callback(response);
            },
            error: function (error) {
                if (error.responseJSON.code == "AccessTokenInvalid") {
                    obj.refresh_token(function (response) {
                        if (response instanceof Object) {
                            obj.get_share_link_video_preview_play_info(callback);
                        }
                        else {
                            callback && callback("");
                        }
                    });
                }
                else if (error.responseJSON.code == "ShareLinkTokenInvalid") {
                    obj.get_share_token(function (response) {
                        if (response instanceof Object) {
                            obj.get_share_link_video_preview_play_info(callback);
                        }
                        else {
                            callback && callback("");
                        }
                    });
                }
                else {
                    console.error("get_share_link_video_preview_play_info 错误", error);
                    if (error.responseJSON.code == "InvalidParameterNotMatch.ShareId") {
                        obj.showTipError("错误：参数不匹配，此错误可能是打开了另一个分享链接导致，请刷新", 10000);
                    }
                    callback && callback("");
                }
            }
        });
    };

    obj.get_video_preview_play_info = function (callback) {
        var token = obj.getItem("token") || {}, file_id = obj.video_page.file_id || obj.video_page.play_info.file_id;
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/v2/file/get_video_preview_play_info",
            data: JSON.stringify({
                category: "live_transcoding",
                drive_id: token.default_drive_id,
                file_id: file_id,
                template_id: "",
                get_subtitle_info: !0
            }),
            headers: {
                "authorization": "".concat(token.token_type || "", " ").concat(token.access_token || ""),
                "content-type": "application/json;charset=UTF-8",
            },
            async: true,
            success: function (response) {
                callback && callback(response);
            },
            error: function (error) {
                if (error.responseJSON.code == "AccessTokenInvalid") {
                    obj.refresh_token(function (response) {
                        if (response instanceof Object) {
                            obj.get_video_preview_play_info(callback);
                        }
                        else {
                            callback && callback("");
                        }
                    });
                }
                else {
                    console.error("get_video_preview_play_info 错误", error);
                    callback && callback("");
                }
            }
        });
    };

    obj.expires = function (e) {
        var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 6e3
        , n = e.match(/&x-oss-expires=(\d+)&/);
        return !n || n && n[1] && +"".concat(n[1], "000") - t < Date.now();
    };

    obj.addCueVideoSubtitle = function (callback) {
        obj.getSubtitles(function (sublist) {
            if (sublist.length) {
                var video = document.querySelector("video");
                if (video) {
                    var textTrackList = video.textTracks;
                    for (let i = 0; i < textTrackList.length; i++) {
                        textTrackList[i].mode = "hidden" || (textTrackList[i].mode = "hidden");
                    }

                    if (sublist.length > 1 && !["chi", "zho", "zh"].includes(sublist[0].language)) {
                        sublist = obj.sortSubList(sublist);
                        sublist = obj.fuseSubList(sublist);
                        obj.video_page.subtitle_list = sublist;
                    }
                    sublist.forEach(function (item, index) {
                        if (item.subarr) {
                            textTrackList[index] || video.addTextTrack("subtitles", item.label, item.language);

                            item.subarr.forEach(function (item) {
                                /<b>.*<\/b>/.test(item.text) || (item.text = item.text.split(/\r?\n/).map((item) => `<b>${item}</b>`).join("\n"));
                                var textTrackCue = new VTTCue(item.startTime, item.endTime, item.text);
                                textTrackCue.id = item.index;
                                textTrackList[index] && textTrackList[index].addCue(textTrackCue);
                            });
                        }
                    });

                    var textTrack = textTrackList[0];
                    if (textTrack && textTrack.cues && textTrack.cues.length) {
                        textTrack.mode = "showing";
                        obj.showTipSuccess("字幕添加成功");
                        callback && callback(textTrackList);
                    }
                    else {
                        callback && callback("");
                    }
                }
                else {
                    callback && callback("");
                }
            }
            else {
                callback && callback("");
            }
        });
    };

    obj.getSubtitles = function (callback) {
        if (obj.video_page.subtitle_list.length) {
            return callback && callback(obj.video_page.subtitle_list);
        }

        obj.getInternalSubtitles(function (sublist) {
            for (var i = 0; i < sublist.length; i++) {
                if (["chi", "zho", "zh"].includes(sublist[i].language)) {
                    return callback && callback(sublist);
                }
            }
            obj.getDriveSubtitles(function (sublist) {
                if (sublist && sublist.length) {
                    callback && callback(sublist);
                }
                else {
                    callback && callback(obj.video_page.subtitle_list);
                }
            });
        });

        obj.getLocalSubtitles(callback);
    };

    obj.getInternalSubtitles = function (callback) {
        var play_info = obj.video_page.play_info;
        var subtitle_task_list = play_info.video_preview_play_info.live_transcoding_subtitle_task_list;
        if (subtitle_task_list) {
            var listLen = subtitle_task_list.length;
            subtitle_task_list.forEach(function (item, index) {
                item.language || (item.language = "chi");
                item.label || (item.label = obj.labeldetect(item.language));
                if (item.subarr) {
                    obj.video_page.subtitle_list.push(item);
                    if (--listLen == 0) {
                        callback && callback(obj.video_page.subtitle_list);
                    }
                }
                else {
                    obj.getSubtitleText(item.url, function (subtext) {
                        if (subtext) {
                            var subarr = obj.subtitleParser(subtext, "vtt");
                            if (subarr.length) {
                                item.subarr = subarr;
                                obj.video_page.subtitle_list.push(item);
                            }
                        }
                        if (--listLen == 0) {
                            callback && callback(obj.video_page.subtitle_list);
                        }
                    });
                }
            });
        }
        else {
            callback && callback([]);
        }
    };

    obj.getDriveSubtitles = function (callback) {
        obj.findSubtitleFiles(function (subtitleFiles) {
            if (subtitleFiles && subtitleFiles.length) {
                var subFileList = [];
                subtitleFiles.forEach(function (item, index) {
                    obj.toFileInfoSubList(item, function (fileInfo) {
                        if (!fileInfo.language) {
                            fileInfo.language = obj.langdetect(fileInfo.subarr);
                            fileInfo.label = obj.labeldetect(fileInfo.language);
                        }

                        obj.video_page.subtitle_list.push(fileInfo);
                        if (++index == subtitleFiles.length) {
                            callback && callback(obj.video_page.subtitle_list);
                        }
                    });
                });
            }
            else {
                callback && callback([]);
            }
        });
    };

    obj.getLocalSubtitles = function (callback) {
        obj.localFilesSubText(function (fileInfo) {
            if (fileInfo.subtext) {
                fileInfo.subarr = obj.subtitleParser(fileInfo.subtext, fileInfo.file_extension);
                if (fileInfo.subarr.length) {
                    fileInfo.language = obj.langdetect(fileInfo.subarr);
                    fileInfo.label = obj.labeldetect(fileInfo.language);
                    obj.video_page.subtitle_list.push(fileInfo);
                    callback && callback(obj.video_page.subtitle_list);
                }
                else {
                    callback && callback([]);
                }
            }
            else {
                obj.showTipError("本地字幕添加失败");
                callback && callback([]);
            }
        });
    };

    obj.sortSubList = function (sublist) {
        var newSubList = [];
        if (sublist[0] && sublist[0].subarr) {
            if (["chi", "zho", "zh"].includes(sublist[0].language)) {
                return sublist;
            }
            sublist.forEach(function (item, index) {
                if (["chi", "zho", "zh"].includes(item.language)) {
                    newSubList.unshift(item);
                }
                else {
                    newSubList.push(item);
                }
            });
        }
        return newSubList;
    };

    obj.fuseSubList = function (sublist) {
        sublist.forEach(function (item, index) {
            if (item.subarr) {
                var newSubList = [ item.subarr.shift() ];
                item.subarr.forEach(function (item, index) {
                    var prevSub = newSubList.slice(-1)[0];
                    if (item.startTime == prevSub.startTime && item.endTime == prevSub.endTime) {
                        prevSub.text += "\n" + item.text;
                    }
                    else {
                        newSubList.push(item);
                    }
                });
                sublist[index].subarr = newSubList;
            }
        });
        return sublist;
    };

    obj.langdetect = function (subarr) {
        var t = [
            subarr[parseInt(subarr.length / 3)].text,
            subarr[parseInt(subarr.length / 2)].text,
            subarr[parseInt(subarr.length / 3 * 2)].text
        ].join("").replace(/[<bi\/>\r?\n]*/g, "");

        var e = "eng"
        , i = (t.match(/[\u4e00-\u9fa5]/g) || []).length / t.length;
        (t.match(/[\u3020-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\u31F0-\u31FF]/g) || []).length / t.length > .03 ? e = "jpn" : i > .1 && (e = "zho");
        return e;
    };

    obj.labeldetect = function (language) {
        return {
            chi: "中文字幕",
            zho: "中文字幕",
            eng: "英文字幕",
            jpn: "日文字幕",
        }[language] || "未知语言";
    };

    obj.findSubtitleFiles = function (callback) {
        var fileList = obj.file_page.items
        , playInfo = obj.video_page.play_info
        , videoName = ""
        , subExts = obj.video_page.subtitle_exts;
        var videoList = [], subList = fileList.filter(function (item) {
            if (item.file_id == playInfo.file_id) {
                videoName = item.name.replace("." + item.file_extension, "").toLowerCase();
            }
            if (item.category == "video") {
                videoList.push(item);
            }
            return subExts.includes(item.file_extension.toLowerCase());
        });

        if (subList.length) {
            if (videoList.length == 1) {
                callback && callback(subList);
            }
            else {
                (function getSubList() {
                    var _subList = subList.filter(function (item) {
                        var fileName = item.name.replace("." + item.file_extension, "").toLowerCase();
                        return fileName.includes(videoName) || videoName.includes(fileName);
                    });
                    if (_subList.length) {
                        callback && callback(_subList);
                    }
                    else {
                        videoName = videoName.split(".").slice(0, -1).join(".");
                        videoName ? getSubList() : callback && callback([]);
                    }
                })();
            }
        }
        else {
            callback && callback([]);
        }
    };

    obj.toFileInfoSubList = function (fileInfo, callback) {
        if (fileInfo instanceof Object) {
            if (fileInfo.hasOwnProperty("subarr")) {
                return callback && callback(fileInfo);
            }
            else if (fileInfo.hasOwnProperty("subtext")) {
                fileInfo.subarr = obj.subtitleParser(fileInfo.subtext, fileInfo.file_extension) || [];
                return obj.toFileInfoSubList(fileInfo, callback);
            }
            else if (fileInfo.hasOwnProperty("download_url") || fileInfo.hasOwnProperty("url")) {
                obj.getSubtitleText(fileInfo.download_url || fileInfo.url, function (subtext) {
                    fileInfo.subtext = subtext || "";
                    obj.toFileInfoSubList(fileInfo, callback);
                });
                return;
            }

            var shareId = obj.getShareId();
            if (shareId) {
                obj.getShareLinkDownloadUrl(fileInfo.file_id, shareId, function (download_url) {
                    fileInfo.download_url = download_url || "";
                    obj.toFileInfoSubList(fileInfo, callback);
                })
            }
            else {
                obj.getHomeLinkDownloadUrl(fileInfo.file_id, fileInfo.drive_id, function (download_url) {
                    fileInfo.download_url = download_url || "";
                    obj.toFileInfoSubList(fileInfo, callback);
                });
            }
        }
        else {
            callback && callback({});
        }
    };

    obj.localFilesSubText = function (callback) {
        $(document).on("change", "#addsubtitle", function(event) {
            if (this.files.length) {
                var file = this.files[0];
                var file_extension = file.name.split(".").pop().toLowerCase();
                var subtitle_extension = obj.video_page.subtitle_exts;
                if (!(file_extension && subtitle_extension.includes(file_extension))) {
                    obj.showTipError("暂不支持此类型文件");
                    return callback && callback([]);
                }

                var reader = new FileReader();
                reader.readAsText(file, 'UTF-8');
                reader.onload = function(event) {
                    var result = reader.result;
                    if (result.indexOf("�") > -1) {
                        return reader.readAsText(file, "GBK");
                    }
                    callback && callback({file_extension: file_extension, subtext: result});
                };
                reader.onerror = function(e) {
                    callback && callback([]);
                };
            }
            this.value = "";
            event.target.value = "";
        });
    };

    obj.getSubtitleText = function (url, callback) {
        GM_xmlhttpRequest({
            method: "get",
            url : url,
            headers: {
                referer: "https://www.aliyundrive.com/"
            },
            responseType: "blob",
            onload: function(result) {
                if (!result.status || result.status == 200) {
                    var blob = result.response;
                    var reader = new FileReader();
                    reader.readAsText(blob, 'UTF-8');
                    reader.onload = function(e) {
                        var result = reader.result;
                        if (result.indexOf("�") > -1 && !reader.mark) {
                            reader.mark = true;
                            return reader.readAsText(blob, "GBK");
                        }
                        callback && callback(result);
                    };
                    reader.onerror = function(e) {
                        callback && callback("");
                    };
                }
                else {
                    callback && callback("");
                }
            },
            onerror: function (error) {
                callback && callback("");
            }
        });
    };

    obj.subtitleParser = function(stext, sext) {
        sext || (stext.indexOf("->") > 0 ? "srt" : stext.indexOf("Dialogue:") > 0 ? "ass" : "");
        sext = sext.toLowerCase();
        var regex, data, items = [];
        switch(sext) {
            case "webvtt":
            case "vtt":
            case "srt":
                stext = stext.replace(/\r/g, "");
                regex = /(\d+)?\n?(\d{0,2}:?\d{2}:\d{2}.\d{3}) -?-> (\d{0,2}:?\d{2}:\d{2}.\d{3})/g;
                data = stext.split(regex);
                data.shift();

                for (let i = 0; i < data.length; i += 4) {
                    items.push({
                        index: items.length,
                        startTime: obj.parseTimestamp(data[i + 1]),
                        endTime: obj.parseTimestamp(data[i + 2]),
                        text: data[i + 3].trim().replace(/{.*?}/g, "").replace(/[a-z]+\:.*\d+\.\d+\%\s/, "")
                    });
                }
                return items;
            case "ssa":
            case "ass":
                stext = stext.replace(/\r\n/g, "");
                regex = /Dialogue: .*?\d+,(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2}),.*?,\d+,\d+,\d+,.*?,/g;
                data = stext.split(regex);
                data.shift();

                for (let i = 0; i < data.length; i += 3) {
                    items.push({
                        index: items.length,
                        startTime: obj.parseTimestamp(data[i]),
                        endTime: obj.parseTimestamp(data[i + 1]),
                        text: data[i + 2].trim().replace(/\\N/g, "\n").replace(/{.*?}/g, "")
                    });
                }
                return items;
            default:
                console.error("未知字幕格式，无法解析", stext, sext);
                return items;
        }
    };

    obj.parseTimestamp = function (e) {
        var t = e.split(":")
        , n = parseFloat(t.length > 0 ? t.pop().replace(/,/g, ".") : "00.000") || 0
        , r = parseFloat(t.length > 0 ? t.pop() : "00") || 0;
        return 3600 * (parseFloat(t.length > 0 ? t.pop() : "00") || 0) + 60 * r + n;
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

    obj.initDownloadSharePage = function () {
        if ($(".button-download--batch").length) {
            return;
        }
        if ($("#root [class^=banner] [class^=right]").length) {
            var html = '';
            html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi button-last--batch" style="margin-right: 28px;">继续上次播放</button>';
            html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi button-search--batch" style="margin-right: 28px;">网盘资源搜索</button>';
            html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi button-download--batch" style="margin-right: 28px;">显示链接</button>';
            $("#root [class^=banner] [class^=right]").prepend(html);

            $(".button-download--batch").on("click", obj.showDownloadSharePage);
            $(".button-last--batch").on("click", function () {
                obj.playByScroll();
            });
            $(".button-search--batch").on("click", function () {
                window.open("https://www.niceso.fun/", "_blank");
            });
        }
        else {
            setTimeout(obj.initDownloadSharePage, 500)
        }
    };

    obj.initDownloadHomePage = function () {
        if ($(".button-download--batch").length) {
            return;
        }
        if ($("#root header").length) {
            var html = '';
            html += '<div style="margin:0px 8px;"></div><button class="button--2Aa4u primary--3AJe5 small---B8mi button-last--batch">继续上次播放</button>';
            html += '<div style="margin:0px 8px;"></div><button class="button--2Aa4u primary--3AJe5 small---B8mi button-search--batch">网盘资源搜索</button>';
            html += '<div style="margin:0px 8px;"></div><button class="button--2Aa4u primary--3AJe5 small---B8mi button-download--batch">显示链接</button>';
            $("#root header:eq(0)").append(html);
            $(".button-download--batch").on("click", obj.showDownloadHomePage);
            $(".button-search--batch").on("click", function () {
                window.open("https://www.niceso.fun/", "_blank");
            });
            $(".button-last--batch").on("click", function () {
                obj.playByScroll();
            });
        }
        else {
            setTimeout(obj.initDownloadHomePage, 1000)
        }
    };

    obj.showDownloadSharePage = function () {
        if (obj.isLogin()) {
        }
        else {
            document.querySelector("[class^=login]").click();
            return;
        }
        var token = obj.getItem("token");
        if (token && token.access_token) {
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

        obj.getShareLinkDownloadUrlAll(fileList, function(fileList) {
            obj.hideTip();
            obj.showBox(fileList);
        });
    };

    obj.showDownloadHomePage = function () {
        if (obj.getItem("token").access_token) {
            obj.showTipLoading("正在获取链接...");
        }
        else {
            obj.showTipError("缺少必要参数，请刷新此页面重试！");
            return;
        }

        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            console.error("致命错误：获取个人文件列表失败");
            obj.showTipError("致命错误：获取个人文件列表失败");
            return;
        }

        obj.getHomeLinkDownloadUrlAll(fileList, function(fileList) {
            obj.hideTip();
            obj.showBox(fileList);
        });
    };

    obj.showBox = function (fileList) {
        var rowStyle = "margin:10px 0px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;";
        var html = '<div class="ant-modal-root ant-modal-Link"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog"><div role="document" class="ant-modal modal-wrapper--2yJKO" style="width: 666px;"><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle1">文件下载</div></div><div class="ant-modal-body"><div class="icon-wrapper--3dbbo"><span data-role="icon" data-render-as="svg" data-icon-type="PDSClose" class="close-icon--33bP0 icon--d-ejA "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSClose"></use></svg></span></div>';
        html += '<div class="item-list" style="padding: 20px; height: 410px; overflow-y: auto;">';
        fileList.forEach(function (item, index) {
            html += '<p>' + (++index) + '：' + item.name + '</p>';
            if (item.type == "file") {
                html += '<p style="' + rowStyle + '"><a title="' + item.download_url + '" href="' + item.download_url + '" style="color: blue;">' + item.download_url + '</a></p>';
            }
            else if (item.type == "folder") {
                html += '<p style="' + rowStyle + '"><font color="green">&emsp;&emsp;请进入文件夹下载</font></p>';
            }
        });
        html += '</div></div><div class="ant-modal-footer"><div class="footer--1r-ur"><div class="buttons--nBPeo">';
        html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi appreciation">👍 点个赞</button>';
        html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi idm-download">IDM 导出文件</button>';
        html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi m3u-download">M3U 导出文件</button>';
        html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi aria2-download">Aria2 推送</button>';
        html += '</div></div></div></div></div></div></div>';
        $("body").append(html);

        $(".icon-wrapper--3dbbo").one("click", function () {
            $(".ant-modal-Link").remove();
        });
        $(".ant-modal-wrap").on("click", function (event) {
            if ($(event.target).closest(".ant-modal-content").length == 0) {
                $(".ant-modal-Link").remove();
            }
        });
        $(".ant-modal-Link .appreciation").on("click", function () {
            window.open("https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png", "_blank");
        });

        fileList = fileList.filter(function (item) {
            return item.type == "file";
        });
        $(".ant-modal-Link .m3u-download").on("click", function () {
            if (fileList.length) {
                var folder = $(".breadcrumb--1J7mk").children(":first").children(":last").attr('data-label');
                var content = "#EXTM3U\r\n";
                fileList.forEach(function (item, index) {
                    if (item.category == "video") {
                        content += ["#EXTINF:0," + item.name, item.download_url].join("\r\n") + "\r\n";
                    }
                });
                obj.downloadFile(content, (folder||"M3U 导出文件")+".m3u");
            }
        });
        $(".ant-modal-Link .idm-download").on("click", function () {
            if (fileList.length) {
                var content = "", referer = "https://www.aliyundrive.com/", userAgent = navigator.userAgent;
                fileList.forEach(function (item, index) {
                    content += ["<", item.download_url, "referer: " + referer, "User-Agent: " + userAgent, ">"].join("\r\n") + "\r\n";
                });
                obj.downloadFile(content, "IDM 导出文件.ef2");
            }
        });
        $(".ant-modal-Link .aria2-download").on("click", function () {
            if (fileList.length) {
                var $this = $(this), $text = $this.text();
                $this.text("正在推送");
                var folderName, fileInfo = obj.file_page.file_info;
                if (fileInfo.type == "folder") {
                    folderName = fileInfo.name;
                }

                var downData = [];
                fileList.forEach(function (item, index) {
                    downData.push({
                        id: "",
                        jsonrpc: "2.0",
                        method: "aria2.addUri",
                        params:[
                            //"token:你的RPC密钥", // 替换你的RPC密钥
                            [ item.download_url ],
                            {
                                out: item.name,
                                dir: "D:\/aliyundriveDownload" + (folderName ? "\/" + folderName : ""), // 下载路径
                                referer: "https://www.aliyundrive.com/",
                                "user-agent": navigator.userAgent
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
                })
            }
        });
    };

    obj.downloadFile = function (content, filename) {
        var a = document.createElement("a");
        var blob = new Blob([content]);
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
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
                        console.error("Aria2 推送服务 错误：", error, this.url);
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

    obj.getShareLinkDownloadUrlAll = function (fileList, callback) {
        var share_id = obj.getShareId();
        var fileListLen = fileList.length;
        fileList.forEach(function (item, index) {
            if (item.type == "folder") {
                if (-- fileListLen == 0) {
                    callback && callback(fileList);
                }
            }
            else {
                obj.getShareLinkDownloadUrl(item.file_id, share_id, function (download_url) {
                    item.download_url = download_url;
                    if (-- fileListLen == 0) {
                        callback && callback(fileList);
                    }
                });
            }
        });
    };

    obj.getShareLinkDownloadUrl = function (file_id, share_id, callback) {
        var token = obj.getItem("token");
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/v2/file/get_share_link_download_url",
            data: JSON.stringify({
                //expire_sec: 600,
                file_id: file_id,
                share_id: share_id
            }),
            headers: {
                "authorization": "".concat(token.token_type || "", " ").concat(token.access_token || ""),
                "content-type": "application/json;charset=utf-8",
                "x-share-token": obj.getItem("shareToken").share_token
            },
            async: true,
            success: function (response) {
                if (response instanceof Object && response.download_url) {
                    callback && callback(response.download_url);
                }
                else {
                    console.error("getShareLinkDownloadUrl 失败", response);
                    callback && callback("");
                }
            },
            error: function (error) {
                var errorCode = error.responseJSON ? error.responseJSON.code : "";
                if ("AccessTokenInvalid" === errorCode) {
                    obj.refresh_token(function (response) {
                        if (response instanceof Object) {
                            obj.getShareLinkDownloadUrl(file_id, share_id, callback);
                        }
                        else {
                            callback && callback("");
                        }
                    });
                }
                else if ("ShareLinkTokenInvalid" === errorCode || "InvalidParameterNotMatch.ShareId" === errorCode) {
                    obj.get_share_token(function (response) {
                        if (response instanceof Object) {
                            obj.getShareLinkDownloadUrl(file_id, share_id, callback);
                        }
                        else {
                            callback && callback("");
                        }
                    });
                }
                else {
                    console.error("getShareLinkDownloadUrl 错误", error);
                    if ("InvalidParameterNotMatch.ShareId" === errorCode) {
                        obj.showTipError("错误：参数不匹配，此错误可能是打开了另一个分享页面导致，请刷新", 10000);
                    }
                    callback && callback("");
                }
            }
        });
    };

    obj.getHomeLinkDownloadUrlAll = function (fileList, callback) {
        var share_id = obj.getShareId();
        var fileListLen = fileList.length;
        fileList.forEach(function (item, index) {
            if (item.type == "folder" || item.download_url) {
                if (-- fileListLen == 0) {
                    callback && callback(fileList);
                }
            }
            else {
                obj.getHomeLinkDownloadUrl(item.file_id, item.drive_id, function (url) {
                    item.download_url = url;
                    if (-- fileListLen == 0) {
                        callback && callback(fileList);
                    }
                });
            }
        });
    };

    obj.getHomeLinkDownloadUrl = function (file_id, drive_id, callback) {
        var token = obj.getItem("token");
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/v2/file/get_download_url",
            data: JSON.stringify({
                expire_sec: 14400,
                drive_id: drive_id,
                file_id: file_id
            }),
            headers: {
                "authorization": "".concat(token.token_type || "", " ").concat(token.access_token || ""),
                "content-type": "application/json;charset=utf-8"
            },
            async: true,
            success: function (response) {
                if (response instanceof Object && response.url) {
                    callback && callback(response.url);
                }
                else {
                    console.error("getHomeLinkDownloadUrl 失败", response);
                    callback && callback("");
                }
            },
            error: function (error) {
                if (error.responseJSON.code == "AccessTokenInvalid") {
                    obj.refresh_token(function (response) {
                        if (response instanceof Object) {
                            obj.getHomeLinkDownloadUrl(file_id, drive_id, callback);
                        }
                        else {
                            callback && callback("");
                        }
                    });
                }
                else if (error.responseJSON.code == "TooManyRequests") {
                    setTimeout(function () {
                        obj.getHomeLinkDownloadUrl(file_id, drive_id, callback);
                    }, 500);
                }
                else {
                    console.error("getHomeLinkDownloadUrl 错误", error);
                    callback && callback("");
                }
            }
        });
    };

    obj.refresh_token = function (callback) {
        var token = obj.getItem("token");
        if (!(token && token.refresh_token)) {
            obj.showTipError("缺少必要参数，请登陆后刷新此页面重试！", 10000);
            callback && callback("");
            return;
        }
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/token/refresh",
            data: JSON.stringify({
                refresh_token: token.refresh_token
            }),
            headers: {
                "Content-type": "application/json;charset=utf-8",
            },
            success: function (response) {
                if (response instanceof Object && response.access_token) {
                    obj.showTipLoading("更新 token");
                    delete response.user_data;
                    obj.setItem("token", response);
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

    obj.get_share_token = function (callback) {
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/v2/share_link/get_share_token",
            data: JSON.stringify({
                share_id: obj.getShareId(),
                share_pwd: ""
            }),
            headers: {
                "Content-type": "application/json;charset=utf-8",
            },
            success: function (response) {
                if (response instanceof Object && response.share_token) {
                    obj.showTipLoading("更新 share_token");
                    obj.setItem("shareToken", response);
                    callback && callback(response);
                }
                else {
                    callback && callback("");
                }
            },
            error: function (error) {
                if (error.responseJSON.code == "InvalidResource.SharePwd") {
                    obj.showTipError("更新share_token错误，请刷新并重新填写提取码", 10000);
                }
                callback && callback("");
            }
        });
    };

    obj.goldlogSpm = function () {
        unsafeWindow.goldlog = {};
        Object.defineProperty(unsafeWindow.goldlog, "_$",{
            value: {},
            configurable: false
        });
        var key = obj.getItem("APLUS_LS_KEY");
        key && key != "/**/" && obj.setItem(key[0], "/**/");
    };

    obj.newTabOpen = function () {
        var open = unsafeWindow.open;
        unsafeWindow.open = function (url, name, specs, replace) {
            name == "_blank" || (name = "_blank");
            return open(url, name, specs, replace);
        }
    };

    obj.customSharePwd = function () {
        $(document).on("DOMNodeInserted", ".ant-modal-root", function() {
            var text = $(this).find(".ant-modal-title").text();
            if (text == "分享文件") {
                if ($(".input-share-pwd").length == 0) {
                    var sharePwd = localStorage.getItem("share_pwd");
                    var html = '<label class="label--3Ub6A">自定义提取码</label>';
                    html += '<input type="text" class="ant-input input-share-pwd" value="' + (sharePwd ? sharePwd : "") + '" placeholder="" style="margin-left: 12px;width: 100px;height: 25px;line-height: normal;border: 1px solid #D4D7DE;text-align: center;"></div>'
                    if ($(".choose-expiration-wrapper--vo0z9").length) {
                        $(".choose-expiration-wrapper--vo0z9").append(html);
                    }
                    else if ($(".share-by-url--1Gk0N").length) {
                        $(".share-by-url--1Gk0N").append(html);
                    }

                    sendSharePwd();
                }
            }
            else if (text == "重命名") {
            }
        });

        function sendSharePwd () {
            (function(send) {
                XMLHttpRequest.prototype.send = function() {
                    if (arguments.length && typeof arguments[0] == "string" && arguments[0].includes("expiration")) {
                        var sharePwd = localStorage.getItem("share_pwd");
                        if (sharePwd) {
                            var body = JSON.parse(arguments[0]);
                            body.share_pwd = sharePwd;
                            arguments[0] = JSON.stringify(body);

                            this.addEventListener("load", function() {
                                if (this.readyState == 4 && this.status == 200) {
                                    var url = this.responseURL;
                                    if (url.includes("/share_link/create") || url.includes("/share_link/update")) {
                                        if (this.response.share_pwd == sharePwd) {
                                            obj.showTipSuccess("自定义分享密码 成功");
                                        }
                                        else {
                                            localStorage.removeItem("share_pwd");
                                            obj.showTipError("自定义分享密码 失败，请修改分享密码后重试");
                                        }
                                    }
                                }
                            }, false);
                        }
                    }
                    send.apply(this, arguments);
                };
            })(XMLHttpRequest.prototype.send);

            $(document).on("change", ".input-share-pwd", function () {
                var value = this.value;
                localStorage.setItem("share_pwd", value);
            });
        };
    };

    obj.unlockFileLimit = function () {
        (function(open) {
            XMLHttpRequest.prototype.open = function() {
                if (!this._hooked) {
                    this._hooked = true;
                    Object.defineProperty(this, "response", {
                        get: function () {
                            delete this.response;
                            var responseURL = this.responseURL, response = this.response;
                            if (responseURL.includes("/file/list") && response instanceof Object) {
                                try { response = JSON.parse(response) } catch (error) { };
                                response.items && response.items.forEach(function (item) {
                                    if (item.category == "video") {
                                        if (["ts"].includes(item.file_extension)) {
                                            item.file_extension = "mp4";
                                        }
                                    }
                                    else if (item.category == "audio") {
                                        if (["ape"].includes(item.file_extension)) {
                                            item.file_extension = "mp3";
                                        }
                                    }

                                    if (item.punish_flag) {
                                        item.punish_flag = 0;
                                    }
                                });
                            }
                            return response;
                        },
                        configurable: true
                    });
                }
                open.apply(this, arguments);
            }
        })(XMLHttpRequest.prototype.open);
    };

    obj.switchViewArrow = function () {
        var parent_file_id = ((location.href.match(/\/folder\/(\w+)/) || [])[1]) || "root";
        if (window.parent_file_id != parent_file_id) {
            window.parent_file_id = parent_file_id;
            var dragDom = document.querySelector("[data-icon-type=PDSDrag]");
            dragDom && dragDom.click();
            var arrowDown = document.querySelector("[data-icon-type=PDSArrowDown]");
            arrowDown && arrowDown.click();
        }

        var listViewType = obj.getItem("listViewType");
        if (listViewType) {
            var iconDom = listViewType == "PDSDrag" ? document.querySelector("[data-icon-type=PDSDrag]") : document.querySelector("[data-icon-type=PDSSquareGrid]");
            iconDom && iconDom.click();
        }

        $(document).off("click", "[class^=switch-wrapper]").on("click", "[class^=switch-wrapper]", function() {
            var iconType = this.firstChild.getAttribute("data-icon-type");
            if (iconType) {
                obj.setItem("listViewType", iconType);
                obj.showTipSuccess("切换默认视图为：" + {PDSDrag: "列表模式", PDSSquareGrid: "图标模式"}[iconType], 5000);
            }
        });
    };

    obj.picturePreview = function () {
        // 图片预览 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        $("div[data-index] img").unbind('mouseenter').unbind('mouseleave');
        $("div[data-index] img").hover(function () {
            showbigpic($(this))
        },function(){$("#bigimg").parent().parent().hide();});

        $("div[data-index]").eq(0).parent().hover(function(){},function(){
            $("#bigimg").parent().parent().hide();
        })
        $("div[data-index]").eq(0).parent().bind("DOMNodeInserted",function(e){
            $("div[data-index] img").unbind('mouseenter').unbind('mouseleave');
            $("div[data-index] img").hover(function () {
                showbigpic($(this))
            },function(){$("#bigimg").parent().parent().hide();});
        })
        function showbigpic(item){
            while(item.attr("data-index")==null){
                item=item.parent();
            }
            let dataindex=item.attr("data-index");
            var pic=obj.file_page.items[dataindex];
            if(pic.category=="image"){
                if($("#bigimg").length){
                    if(dataindex!=$("#bigimg").attr("data-index")){
                        var imgp= $("#bigimg").parent();
                        if (obj.getShareId()&&pic.download_url==null) {
                            obj.getShareLinkDownloadUrl(pic.file_id, obj.getShareId(), function (download_url) {
                                pic.download_url = download_url;
                                $("#bigimg").remove();
                                imgp.append('<img data-index="'+dataindex+'" id="bigimg" src='+download_url+'>');
                            });
                        }
                        else{
                            let picsrc=pic.url==null?pic.download_url:pic.url;
                            $("#bigimg").remove();
                            imgp.append('<img data-index="'+dataindex+'" id="bigimg" src='+picsrc+'>');
                        }
                    }
                    $("#bigimg").parent().parent().show();
                }
                else{
                    if (obj.getShareId()&&pic.download_url==null) {
                        obj.getShareLinkDownloadUrl(pic.file_id, obj.getShareId(), function (download_url) {
                            pic.download_url = download_url;
                            let html='<div style="top: 10px;width: 620px;height:100%;right: 20px;position: absolute;max-height: calc(100% - 20px);" class="ant-modal modal-wrapper--2yJKO search-modal--3qn-V"><div class="image-previewer--2yS_g container--1x-ed " style="padding: 0px;"><img data-index="'+dataindex+'" id="bigimg" src='+download_url+'></div></div>';

                            $("body").append(html);
                        });
                    }
                    else{
                        let picsrc=pic.url==null?pic.download_url:pic.url;
                        let html='<div style="top: 10px;width: 620px;height:100%;right: 20px;position: absolute;max-height: calc(100% - 20px);" class="ant-modal modal-wrapper--2yJKO search-modal--3qn-V"><div class="image-previewer--2yS_g container--1x-ed " style="padding: 0px;"><img data-index="'+dataindex+'" id="bigimg" src='+picsrc+'></div></div>';

                        $("body").append(html);
                    }
                }

            }
        }

        $(".switch-wrapper--1yEfx").click(function () {
            setTimeout(obj.picturePreview, 1000);
        });
    };

    obj.getShareId = function () {
        var url = location.href;
        var match = url.match(/aliyundrive\.com\/s\/([a-zA-Z\d]+)/);
        return match ? match[1] : null;
    };

    obj.isHomePage = function () {
        return location.href.indexOf("aliyundrive.com/drive") > 0;
    };

    obj.isLogin = function () {
        return !document.querySelector("[class^=login]");
    };

    obj.getItem = function (n) {
        n = window.localStorage.getItem(n);
        if (!n) {
            return null;
        }
        try {
            return JSON.parse(n);
        } catch (e) {
            return n;
        }
    };

    obj.setItem = function (n, t) {
        n && t != undefined && window.localStorage.setItem(n, t instanceof Object ? JSON.stringify(t) : t);
    };

    obj.filterNotice = function () {
        $(document).on("DOMNodeInserted", ".aDrive", function() {
            var $this = $(this), $text = $this.find(".title--Bnudr").text();
            $text.includes("视频仅可试看") && $this.children("div").empty();
        });
    };

    obj.showTipSuccess = function (msg, timeout) {
        obj.hideTip();

        var $element = $(".aDrive div");
        var elementhtml='<div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-success"><span data-role="icon" data-render-as="svg" data-icon-type="PDSCheckmarkCircleFill" class="success-icon--2Zvcy icon--d-ejA "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSCheckmarkCircleFill"></use></svg></span><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 44px; padding-right: 20px;"><div class="title-wrapper--3bQQ2">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div>'
        if ($element.length) {
            $element.append(elementhtml);
        }
        else {
            $(document.body).append('<div><div class="aDrive"><div>'+elementhtml+'</div></div></div>');
        }

        setTimeout(function () {
            obj.hideTip();
        }, timeout || 3000);
    };

    obj.showTipError = function (msg, timeout) {
        obj.hideTip();

        var $element = $(".aDrive div");
        var elementhtml='<div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-error"><span data-role="icon" data-render-as="svg" data-icon-type="PDSCloseCircleFill" class="error-icon--1Ov4I icon--d-ejA "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSCloseCircleFill"></use></svg></span><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 44px; padding-right: 20px;"><div class="title-wrapper--3bQQ2">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div></div>'
        if ($element.length) {
            $element.append(elementhtml);
        }
        else {
            $(document.body).append('<div><div class="aDrive"><div>'+elementhtml+'</div></div></div>');
        }

        setTimeout(function () {
            obj.hideTip()
        }, timeout || 3000);
    };

    obj.showTipLoading = function (msg, timeout) {
        obj.hideTip();

        var $element = $(".aDrive div");
        var elementhtml = '<div class="aDrive-notice"><div class="aDrive-notice-content"><div class="aDrive-custom-content aDrive-loading"><div></div><span><div class="content-wrapper--B7mAG" data-desc="false" style="margin-left: 20px; padding-right: 20px;"><div class="title-wrapper--3bQQ2">' + msg + '<div class="desc-wrapper--218x0"></div></div></div></span></div></div></div>'
        if ($element.length) {
            $element.append(elementhtml);
        }
        else {
            $(document.body).append('<div><div class="aDrive"><div>'+elementhtml+'</div></div></div>');
        }

        setTimeout(function () {
            obj.hideTip()
        }, timeout || 5000);
    };

    obj.hideTip = function() {
        var t = $(".aDrive-notice");
        t.length && "function" == typeof t.remove ? t.remove() : "function" == typeof t.removeNode && t.removeNode(!0);
    };

    obj.addPageFileList = function () {
        var send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(data) {
            this.addEventListener("load", function(event) {
                if (this.readyState == 4 && this.status == 200) {
                    var response = this.response, responseURL = this.responseURL;
                    if (responseURL.endsWith("/file/get")) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object) {
                            obj.file_page.file_info = response;
                        }
                    }
                    else if (responseURL.indexOf("/file/list") > 0 || responseURL.indexOf("/file/search") > 0) {
                        if (document.querySelector(".ant-modal-mask")) {
                            //排除【保存 移动 等行为触发】
                            return;
                        };

                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object && response.items) {
                            try { data = JSON.parse(data) } catch (error) { data = {} };

                            if (obj.file_page.parent_file_id != data.parent_file_id) {
                                //变换页面
                                obj.file_page.parent_file_id = data.parent_file_id;
                                obj.file_page.order_by = data.order_by;
                                obj.file_page.order_direction = data.order_direction;
                                obj.file_page.next_marker_list = [];
                                obj.file_page.items = [];
                            }

                            if (obj.file_page.order_by != data.order_by || obj.file_page.order_direction != data.order_direction) {
                                //排序改变
                                obj.file_page.order_by = data.order_by;
                                obj.file_page.order_direction = data.order_direction;
                                obj.file_page.next_marker_list = [];
                                obj.file_page.items = [];
                            }

                            var next_marker = response.next_marker, next_marker_list = obj.file_page.next_marker_list;
                            if (next_marker_list.includes(next_marker)) {
                                if (next_marker_list.indexOf(next_marker) == 0) {
                                    //重复排序
                                    obj.file_page.next_marker_list = [response.next_marker];
                                    obj.file_page.items = [];
                                }
                            }
                            else {
                                obj.file_page.next_marker_list.push(response.next_marker)
                            }

                            obj.file_page.items = obj.file_page.items.concat(response.items);
                            obj.showTipSuccess("文件列表获取完成 共：" + obj.file_page.items.length + "项");

                            if (obj.file_page.items.length) {
                                if (obj.isHomePage()) {
                                    obj.initDownloadHomePage();
                                }
                                else {
                                    obj.initDownloadSharePage();
                                    obj.switchViewArrow();
                                }

                                obj.autoLastBtn();
                                obj.picturePreview();
                            }
                        }
                    }
                    else if (responseURL.indexOf("/file/get_share_link_video_preview_play_info") > 0) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object) {
                            obj.video_page.play_info.file_id == response.file_id || (obj.video_page.subtitle_list = []);
                            obj.video_page.play_info = response;

                            obj.autoPlayer();
                        }
                    }
                    else if (responseURL.indexOf("/file/get_video_preview_play_info") > 0) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object) {
                            obj.video_page.play_info.file_id == response.file_id || (obj.video_page.subtitle_list = []);
                            obj.video_page.play_info = response;

                            var info = response.video_preview_play_info
                            , list = info.live_transcoding_task_list;
                            if (list[0].hasOwnProperty("preview_url")) {
                                if (obj.getItem("default_player") != "NativePlayer") {
                                    obj.get_share_link_video_preview_play_info(function (response) {
                                        response || obj.showTipError("播放信息获取失败 请刷新重试", 10000);
                                    });
                                    return;
                                }
                            }

                            obj.autoPlayer();
                        }
                    }
                }
                else if (this.readyState == 4 && this.status == 403) {
                    if (obj.expires(this.responseURL) && obj.getItem("default_player") != "NativePlayer") {
                        var media_num = (this.responseURL.match(/media-(\d+)\.ts/) || [])[1] || 0;
                        if (media_num > 0 && obj.video_page.media_num != media_num) {
                            obj.video_page.media_num = media_num;
                            if (obj.getShareId()) {
                                obj.get_share_link_video_preview_play_info();
                            }
                            else {
                                obj.get_video_preview_play_info();
                            }
                        }
                    }
                }
            }, false);
            send.apply(this, arguments);
        };
    };

    obj.run = function() {
        obj.goldlogSpm();

        obj.addPageFileList();

        obj.initVideoPage();

        obj.unlockFileLimit();

        var url = location.href;
        if (url.indexOf(".aliyundrive.com/s/") > 0) {
            obj.newTabOpen();
            obj.filterNotice();
        }
        else if (url.indexOf(".aliyundrive.com/drive") > 0) {
            obj.customSharePwd();
        }
    }();

    console.log("=== 阿里云盘 好棒棒！===");

    // Your code here...
})();
