// ==UserScript==
// @name         阿里云盘
// @namespace    http://tampermonkey.net/
// @version      3.2.3
// @description  支持生成文件下载链接（多种下载姿势），支持第三方播放器DPlayer（支持自动/手动添加字幕，突破视频2分钟限制，选集，上下集，自动记忆播放，跳过片头片尾, 字幕设置随心所欲...），支持自定义分享密码，支持图片预览，支持移动端播放，...
// @author       You
// @match        https://www.aliyundrive.com/*
// @connect      lc-cn-n1-shared.com
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
// @icon         https://gw.alicdn.com/imgextra/i3/O1CN01aj9rdD1GS0E8io11t_!!6000000000620-73-tps-16-16.ico
// @require      https://scriptcat.org/lib/950/^1.0.1/Joysound.js
// @require      https://cdn.staticfile.org/hls.js/1.3.5/hls.min.js
// @require      https://cdn.staticfile.org/jquery/3.6.0/jquery.min.js
// @require      https://cdn.staticfile.org/dplayer/1.27.1/DPlayer.min.js
// @require      https://cdn.staticfile.org/localforage/1.10.0/localforage.min.js
// @antifeature  ads
// @antifeature  membership
// @antifeature  payment
// @antifeature  referral-link
// @antifeature  tracking
// @run-at       document-body
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    var localforage = window.localforage;
    var $ = $ || window.$;
    var obj = {
        file_page: {
            headers: {},
            parent_file_id: "root",
            file_info: {},
            order_by: "",
            order_direction: "",
            next_marker_list: [],
            items: []
        },
        video_page: {
            file_info: {},
            play_info: {},
            sub_info: {
                index: 0
            },
            elevideo: "",
            player: null,
            media_num: 0
        }
    };

    obj.dPlayerStart = function () {
        var prevPlayer = obj.video_page.player;
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
            return setTimeout(obj.dPlayerStart, 500);
        }
        var quality = [], defaultQuality, localQuality = localStorage.getItem("dplayer-quality");;
        var play_info = obj.video_page.play_info || {};
        var video_preview_play_info = play_info.video_preview_play_info || {};
        var task_list = video_preview_play_info.live_transcoding_task_list;
        if (Array.isArray(task_list)) {
            var pds = {
                UHD: "4K 超清",
                QHD: "2K 超清",
                FHD: "1080 全高清",
                HD: "720 高清",
                SD: "540 标清",
                LD: "360 流畅"
            };
            task_list.forEach(function (item, index) {
                if (item.url || item.preview_url) {
                    var name = pds[item.template_id];
                    localQuality ? localQuality == name ? defaultQuality = index : defaultQuality = index : defaultQuality = index;
                    GM_getValue(GM_info.script.version) && quality.push({
                        name: name,
                        url: item.url || item.preview_url,
                        type: "hls"
                    });
                }
            });
        }
        else {
            obj.showTipError("获取播放信息失败：请刷新网页重试");
            return;
        }
        if (obj.video_page.file_id === play_info.file_id) {
            if (prevPlayer && document.querySelector("video")) {
                return obj.dPlayerThrough(quality);
            }
        }
        else {
            obj.video_page.file_id = play_info.file_id;
            if (prevPlayer) {
                prevPlayer.destroy();
                prevPlayer = null;
            }
        }
        var options = {
            container: dPlayerNode,
            video: {
                quality: quality,
                defaultQuality: defaultQuality,
                customType: {
                    hls: function (video, player) {
                        if (player.plugins.hls) {
                            player.plugins.prevHls = player.plugins.hls;
                            delete player.plugins.hls;
                        }
                        const hls = new window.Hls();
                        player.plugins.hls = hls;
                        hls.loadSource(video.src);
                        hls.attachMedia(video);
                    }
                }
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
            hotkey: true,
            airplay: true,
            volume: 1.0,
            playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4],
            contextmenu: [
                {
                    text: "👍 爱发电 不再弹出 👍",
                    link: "https://afdian.net/order/create?plan_id=be4f4d0a972811eda14a5254001e7c00",
                    click: obj.showDialog
                }
            ],
            theme: obj.getRandomColor()
        };
        try {
            var player = obj.video_page.player = new window.DPlayer(options);
            if (prevPlayer) {
                const { video } = prevPlayer;
                player.seek(video.currentTime - 1);
                player.speed(video.playbackRate);
                player.video.muted = video.muted;
                prevPlayer.destroy();
                prevPlayer = null;
            }
            obj.dPlayerReady(player, function(player) {
                obj.dPlayerSetting(player);
                obj.dPlayerMemoryPlay(player);
                obj.dPlayerAutoPlaynext(player);
                obj.dPlayerSoundEnhancement(player);
                obj.dPlayerImageEnhancement(player);
                obj.dPlayerSelectEpisode();
                obj.dPlayerInitAspectRatio();
                unsafeWindow.requestAnimationFrame(function menushow () {
                    const { video: { currentTime, duration, playbackRate }, contextmenu, container: { offsetWidth, offsetHeight } } = player;
                    const t = Math.min(1000, duration) * 1000 / 2 / playbackRate;
                    (t / 1000 > duration - currentTime) || setTimeout(() => {
                        obj.isAppreciation(function (data) {
                            data || contextmenu.show(offsetWidth / 2.5, offsetHeight / 3);
                            unsafeWindow.requestAnimationFrame(menushow);
                        });
                    }, t);
                });
                obj.addCueVideoSubtitle(player, function (textTracks) {
                    if (textTracks) {
                        obj.dPlayerSelectSubtitles(textTracks);
                        obj.dPlayerSubtitleStyle();
                    }
                });
                player.on("quality_end", function () {
                    localStorage.setItem("dplayer-quality", player.quality.name);
                    obj.addCueVideoSubtitle(player);
                });
                player.speed(localStorage.getItem("dplayer-speed") || 1);
                player.on("ratechange", function () {
                    player.notice("播放速度：" + player.video.playbackRate);
                    localStorage.getItem("dplayer-speed") == player.video.playbackRate || localStorage.setItem("dplayer-speed", player.video.playbackRate);
                });
                player.on("contextmenu_show", function () {
                    $(".dplayer-menu").length || $(".dplayer-menu-item").length || player.destroy();
                    obj.isAppreciation((data) => {!data && player.pause()});
                });
                localStorage.getItem("dplayer-isfullscreen") == "true" && player.fullScreen.request("browser");
                player.on("fullscreen", function () {
                    localStorage.setItem("dplayer-isfullscreen", true);
                    try {
                        screen.orientation.lock("landscape");
                    } catch (error) { };
                });
                player.on("fullscreen_cancel", function () {
                    localStorage.removeItem("dplayer-isfullscreen");
                    try {
                        screen.orientation.unlock();
                    } catch (error) { };
                });
                $("[data-icon-type=PDSClose]").one("click", function () {
                    player.destroy();
                });
            });
        } catch (error) {
            console.error("播放器创建失败", error);
        }
    };

    obj.dPlayerThrough = function (quality) {
        var player = obj.video_page.player;
        player.options.video.quality = quality;
        player.quality = player.options.video.quality[ player.qualityIndex ];
        const paused = player.video.paused;
        const videoHTML = '<video class="dplayer-video" webkit-playsinline playsinline crossorigin="anonymous" preload="auto" src="' + player.quality.url + '"><track kind="metadata" default src=""></track></video>';
        const videoEle = new DOMParser().parseFromString(videoHTML, 'text/html').body.firstChild;
        player.template.videoWrap.insertBefore(videoEle, player.template.videoWrap.getElementsByTagName('div')[0]);
        player.prevVideo = player.video;
        player.video = videoEle;
        player.initVideo(player.video, player.quality.type || player.options.video.type);
        player.video.currentTime = player.prevVideo.currentTime + 1;
        obj.dPlayerSubtitleStyle();
        player.on('canplaythrough', () => {
            if (player.prevVideo) {
                if (player.video.currentTime !== player.prevVideo.currentTime) {
                    player.video.currentTime = player.prevVideo.currentTime;
                    (obj.onPost.length && obj.onPost.toString().length == 460) || player.destroy();
                }
                player.speed(player.prevVideo.playbackRate);
                player.prevVideo.muted && (player.video.muted = player.prevVideo.muted);
                player.prevVideo.pause();
                player.template.videoWrap.removeChild(player.prevVideo);
                player.video.classList.add('dplayer-video-current');
                player.template.video = player.video;
                if (!paused) {
                    const bezelswitch = player.bezel.switch;
                    player.bezel.switch = () => {};
                    setTimeout(() => { player.bezel.switch = bezelswitch; }, 1000);
                    player.video.play();
                    player.controller.hide();
                    setTimeout(() => {
                        document.querySelectorAll("video").length > 1 && [ ... document.querySelectorAll("video") ].forEach(element => {
                            element.paused && player.template.videoWrap.removeChild(element);
                        });
                    });
                }
                setTimeout(() => {
                    player.controller.hide();
                    if (player.plugins.prevHls) {
                        player.plugins.prevHls.destroy();
                        delete player.plugins.prevHls;
                    }
                });
                player.prevVideo = null;
                obj.dPlayerEvents(player);
            }
        });
    };

    obj.dPlayerEvents = function (player) {
        obj.dPlayerReady(player, function(player) {
            const { options: { contextmenu } } = player;
            JSON.stringify(contextmenu).includes(5254001) || player.destroy();
            obj.dPlayerAspectRatio();
            obj.dPlayerMemoryPlay(player);
            obj.dPlayerSoundEnhancement(player);
            obj.dPlayerImageEnhancement(player);
            obj.addCueVideoSubtitle(player, function (textTracks) {
                if (textTracks) {
                    obj.dPlayerSelectSubtitles(textTracks);
                    obj.offsetCache && obj.dPlayerSubtitleOffset();
                }
            });
        });
    };

    obj.dPlayerReady = function (player, callback) {
        if (player.isReady) {
            callback && callback(player);
        }
        else if (player.video.duration > 0 || player.video.readyState > 2) {
            player.isReady = true;
            callback && callback(player);
        }
        else {
            player.video.ondurationchange = function () {
                player.video.ondurationchange = null;
                player.isReady = true;
                callback && callback(player);
            }
        }
    };

    obj.dPlayerSetting = function (player) {
        if ($(".dplayer-setting-autoposition").length) return;
        var html = '<div class="dplayer-setting-item dplayer-setting-autoposition"><span class="dplayer-label">自动记忆播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoposition" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-autoplaynext"><span class="dplayer-label">自动连续播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoplaynext" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-soundenhancement"><span class="dplayer-label">音质增强</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-soundenhancement" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-imageenhancement"><span class="dplayer-label">画质增强</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-imageenhancement" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-skipposition"><span class="dplayer-label">跳过片头片尾</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-skipposition" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-subtitle"><span class="dplayer-label">字幕设置</span><div class="dplayer-toggle"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z"></path></svg></div></div></div>';
        $(".dplayer-setting-origin-panel").append(html);
        const { user, template: { video } } = player;
        Object.assign(user.storageName, { autoposition: "dplayer-autoposition", autoplaynext: "dplayer-autoplaynext", soundenhancement: "dplayer-soundenhancement", imageenhancement: "dplayer-imageenhancement", skipposition: "dplayer-skipposition", jumpstart: "dplayer-jumpstart", jumpend: "dplayer-jumpend" });
        Object.assign(user.default, { autoposition: 0, autoplaynext: 0, soundenhancement: 0, imageenhancement: 0, skipposition: 0, jumpstart: 60, jumpend: 120 });
        user.init();
        obj.isAppreciation(function (data) {
            data || (user.set("autoposition", 0), user.set("autoplaynext", 0), user.set("soundenhancement", 0), user.set("imageenhancement", 0), user.set("skipposition", 0));
        });
        user.get("autoposition") && ($(".dplayer-toggle-setting-input-autoposition").get(0).checked = true);
        user.get("autoplaynext") && ($(".dplayer-toggle-setting-input-autoplaynext").get(0).checked = true);
        user.get("soundenhancement") && ($(".dplayer-toggle-setting-input-soundenhancement").get(0).checked = true);
        user.get("imageenhancement") && ($(".dplayer-toggle-setting-input-imageenhancement").get(0).checked = true);
        user.get("skipposition") && ($(".dplayer-toggle-setting-input-skipposition").get(0).checked = true, obj.dPlayerSkippositionStart(player), obj.dPlayerSkippositionEnd(player));
        $(".dplayer-setting-item").on("click", function(e) {
            const { contextmenu, container: { offsetWidth, offsetHeight } } = player;
            obj.isAppreciation(function (data) {
                data || contextmenu.show(offsetWidth / 2.5, offsetHeight / 3);
            });
        });
        $(".dplayer-setting-autoposition").on("click", function() {
            var toggle = $(".dplayer-toggle-setting-input-autoposition"), checked = !toggle.is(":checked");
            toggle.get(0).checked = checked;
            player.notice("自动记忆播放：" + (checked ? "开启" : "关闭"));
            user.set("autoposition", Number(checked));
        });
        $(".dplayer-setting-autoplaynext").on("click", function() {
            var toggle = $(".dplayer-toggle-setting-input-autoplaynext"), checked = !toggle.is(":checked");
            toggle.get(0).checked = checked;
            player.notice("自动连续播放：" + (checked ? "开启" : "关闭"));
            user.set("autoplaynext", Number(checked));
        });
        $(".dplayer-setting-soundenhancement").on("click", function() {
            var toggle = $(".dplayer-toggle-setting-input-soundenhancement"), checked = !toggle.is(":checked");
            toggle.get(0).checked = checked;
            player.notice("音质增强：" + (checked ? "开启" : "关闭"));
            user.set("soundenhancement", Number(checked));
            obj.dPlayerSoundEnhancement(player);
        });
        $(".dplayer-setting-imageenhancement").on("click", function() {
            var toggle = $(".dplayer-toggle-setting-input-imageenhancement"), checked = !toggle.is(":checked");
            toggle.get(0).checked = checked;
            player.notice("画质增强：" + (checked ? "开启" : "关闭"));
            user.set("imageenhancement", Number(checked));
            obj.dPlayerImageEnhancement(player);
        });
        $(".dplayer-setting-skipposition").on("click", function() {
            var toggle = $(".dplayer-toggle-setting-input-skipposition"), checked = !toggle.is(":checked");
            toggle.get(0).checked = checked;
            player.notice("跳过片头片尾：" + (checked ? "开启" : "关闭"));
            user.set("skipposition", Number(checked));
            obj.dPlayerSkipposition(player);
        }).on("mouseenter mouseleave", function (event) {
            obj.dPlayerSkipposition(player);
        });
        $(".dplayer-setting-subtitle").on("click", function() {
            obj.dPlayerSubtitleSetting(player);
        });
    };

    obj.dPlayerMemoryPlay = function (player) {
        if (this.hasMemoryDisplay) return;
        this.hasMemoryDisplay = true;
        const { user, video, video: { duration } } = player;
        const file_id = obj.video_page.play_info?.file_id || ""
        , play_cursor = getFilePosition(file_id);
        if (play_cursor && parseInt(play_cursor)) {
            var autoPosition = user.get("imageenhancement");
            if (autoPosition) {
                player.seek(play_cursor);
            }
            else {
                var formatTime = formatVideoTime(play_cursor);
                $(player.container).append('<div class="memory-play-wrap" style="display: block;position: absolute;left: 33px;bottom: 66px;font-size: 15px;padding: 7px;border-radius: 3px;color: #fff;z-index:100;background: rgba(0,0,0,.5);">上次播放到：' + formatTime + '&nbsp;&nbsp;<a href="javascript:void(0);" class="play-jump" style="text-decoration: none;color: #06c;"> 跳转播放 &nbsp;</a><em class="close-btn" style="display: inline-block;width: 15px;height: 15px;vertical-align: middle;cursor: pointer;background: url(https://nd-static.bdstatic.com/m-static/disk-share/widget/pageModule/share-file-main/fileType/video/img/video-flash-closebtn_15f0e97.png) no-repeat;"></em></div>');

                var memoryTimeout = setTimeout(function () {
                    $(".memory-play-wrap").remove();
                }, 15000);
                $(".memory-play-wrap .close-btn").click(function () {
                    $(".memory-play-wrap").remove();
                    clearTimeout(memoryTimeout);
                });
                $(".memory-play-wrap .play-jump").click(function () {
                    player.seek(play_cursor);
                    $(".memory-play-wrap").remove();
                    clearTimeout(memoryTimeout);
                });
            }
        }
        document.onvisibilitychange = function () {
            if (document.visibilityState === "hidden") {
                const currentTime = player?.video?.currentTime
                , file_id = obj.video_page.play_info?.file_id || "";
                currentTime && file_id && setFilePosition(file_id, currentTime, duration);
            }
        };
        window.onbeforeunload = function () {
            const currentTime = player?.video?.currentTime
            , file_id = obj.video_page.play_info?.file_id || "";
            currentTime && file_id && setFilePosition(file_id, currentTime, duration);
        };
        $("[data-icon-type=PDSClose]").on("click", function () {
            const currentTime = player?.video?.currentTime
            , file_id = obj.video_page.play_info?.file_id || "";
            currentTime && file_id && setFilePosition(file_id, currentTime, duration);
        });

        function getFilePosition (e) {
            return localStorage.getItem("video_" + e) || 0;
        }
        function setFilePosition (e, t, o) {
            e && t && (e = "video_" + e, t <= 60 || t + 120 >= o || 0 ? localStorage.removeItem(e) : localStorage.setItem(e, t));
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

    obj.dPlayerAutoPlaynext = function (player) {
        player.on("ended", function () {
            const { user } = player;
            user.get("autoplaynext") && $(".next-icon").click();
        });
    };

    obj.dPlayerSoundEnhancement = function (player) {
        const { user, video } = player;
        if (window.Joysound && window.Joysound.isSupport()) {
            if (user.get("soundenhancement")) {
                var joySound = player.joySound;
                joySound || (joySound = player.joySound = new window.Joysound());
                joySound._mediaElement || joySound.init(video);
                joySound.setEnabled(!0);
            }
            else {
                player.joySound && player.joySound._mediaElement && player.joySound.setEnabled(!1);
            }
        }
    };

    obj.dPlayerImageEnhancement = function (player) {
        const { user, video } = player;
        user.get("imageenhancement") ? $(video).css("filter", "contrast(1.01) brightness(1.05) saturate(1.1)") : $(video).css("filter", "");
    };

    obj.dPlayerSkipposition = function (player) {
        //将片头片尾放在设置里 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        var $skip, $setting = $(".dplayer .dplayer-setting");
        const { user, video } = player;
        if (user.get("skipposition")) {
            if (($skip = $setting.find(".dplayer-setting-skipposition-item")).length == 0) {
                $skip = $('<div class="dplayer-setting-skipposition-item" style="display: block;right: 155px;position: absolute;bottom: 50px;width: 150px;border-radius: 2px;background: rgba(28, 28, 28, 0.9);padding: 7px 0px;transition: all 0.3s ease-in-out 0s;overflow: hidden;z-index: 2;"><div class="dplayer-skipposition-item" style="padding: 5px 10px;box-sizing: border-box;cursor: pointer;position: relative;"><span class="dplayer-skipposition-label" title="双击设置当前时间为跳过片头时间" style="color: #eee;font-size: 13px;display: inline-block;vertical-align: middle;white-space: nowrap;">片头时间：</span><input type="number" style="width: 55px;height: 15px;top: 3px;font-size: 13px;border: 1px solid #fff;border-radius: 3px;text-align: center;" step="1" min="0"></div><div class="dplayer-skipposition-item" style="padding: 5px 10px;box-sizing: border-box;cursor: pointer;position: relative;"><span class="dplayer-skipposition-label" title="双击设置剩余时间为跳过片尾时间" style="color: #eee;font-size: 13px;display: inline-block;vertical-align: middle;white-space: nowrap;">片尾时间：</span><input type="number" style="width: 55px;height: 15px;top: 3px;font-size: 13px;border: 1px solid #fff;border-radius: 3px;text-align: center;" step="1" min="0"></div></div>').appendTo($setting);
            }
            $skip.find("input").each(function (index) {
                $(this).val(user.get(["jumpstart", "jumpend"][index]));
            }).change(function () {
                user.set(["jumpstart", "jumpend"][$(this).parent().index()], $(this).val());
            });
            $skip.find("span").on("dblclick", function() {
                var index = $(this).parent().index(), value = parseInt(index ? video.duration - video.currentTime : video.currentTime);
                user.set(["jumpstart", "jumpend"][index], $(this).next().val(value).val());
            });
            $(".dplayer .dplayer-mask").on("click", function () {
                $skip.remove();
            });
        }
        else {
            if (($skip = $setting.find(".dplayer-setting-skipposition-item")).length) {
                $skip.remove();
            }
        }
    };

    obj.dPlayerSkippositionStart = function (player) {
        const { user } = player;
        if (user.get("skipposition")) {
            var jumpstart = user.get("jumpstart");
            if (jumpstart) {
                player.seek(jumpstart);
            }
        }
    };

    obj.dPlayerSkippositionEnd = function (player) {
        const { events, user } = player;
        var raf = unsafeWindow.requestAnimationFrame(function rafrun () {
            const { video: { currentTime, duration, playbackRate } } = player;
            setTimeout(function () {
                if (user.get("skipposition") && (duration - currentTime > 1)) {
                    if (user.get("jumpend") * playbackRate > duration - currentTime) {
                        player.seek(duration);
                        events.trigger("ended");
                    }
                }
                unsafeWindow.requestAnimationFrame(rafrun);
            }, 5e3);
        });
        player.on("destroy", function () {
            unsafeWindow.cancelAnimationFrame(raf);
        });
    };

    obj.dPlayerSubtitleSetting = function (player) {
        var subSetBox = $(".subtitle-setting-box");
        if (subSetBox.length) {
            return subSetBox.toggle();
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
            colortxt.val(localStorage.getItem("dplayer-subtitle-color") || "#ffe133")
            colortxt.on('input propertychange', function(e) {
                var color = colortxt.val();
                color = color.replace(/[^#0-9a-fA-F]/g, ""); //排除#和十六进制字符
                color = color.replace(/^[0-9a-fA-F]/g, ""); //排除非#开头
                color = color.replace("#", "$@$").replace(/\#/g, "").replace("$@$", "#"); //排除多个#
                color = color.replace(/^#([0-9a-fA-F]{3,6}).*$/, '#$1'); //排除十六进制字符长度超过6位

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
            $(".dplayer .dplayer-mask").on("click", function () {
                subSetBox.hide();
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
                value == "1" ? bottom += 1 : value == "2" ? bottom -= 1 : bottom = 10;
                localStorage.setItem("dplayer-subtitle-bottom", bottom);
                $(".dplayer-subtitle").css("bottom", bottom + "%");
            }
            else if ($name == "字幕大小") {
                var fontSize = Number(localStorage.getItem("dplayer-subtitle-fontSize") || 5);
                value == "1" ? fontSize += .1 : value == "2" ? fontSize -= .1 : fontSize = 5;
                localStorage.setItem("dplayer-subtitle-fontSize", fontSize);
                $(".dplayer-subtitle").css("font-size", fontSize + "vh");
            }
            else if ($name.includes("字幕偏移")){
                var offsettime = obj.offsetCache || 0;
                var offsetvalue = Number($(".offset-value").val()) || 5;
                value == "1" ? offsettime -= offsetvalue : value == "2" ? offsettime += offsetvalue : offsettime = 0;
                offsettime == 0 ? $(".offset-text").text("") : $(".offset-text").text("["+ offsettime +"s]");
                obj.offsetCache = offsettime;
                obj.dPlayerSubtitleOffset(player);
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

    obj.dPlayerSubtitleOffset = function (player) {
        const { video, subtitle } = player;
        if (video.textTracks && video.textTracks[0]) {
            const track = video.textTracks[0];
            const cues = Array.from(track.cues);
            let fileId = obj.video_page.play_info.file_id
            , sub_info = obj.video_page.sub_info
            , subList = sub_info[fileId]
            , index = sub_info.index || 0
            , sarr = subList[index].sarr;
            let offsetCache = obj.offsetCache || 0;
            for (let index = 0; index < cues.length; index++) {
                const cue = cues[index];
                cue.startTime = clamp(sarr[index].startTime + offsetCache, 0, video.duration);
                cue.endTime = clamp(sarr[index].endTime + offsetCache, 0, video.duration);
            }
            subtitle.init();
            player.notice(`字幕偏移: ${offsetCache} 秒`);
        }
        else {
            obj.offsetCache = 0;
        }
        function clamp(num, a, b) {
            return Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));
        }
    };

    obj.dPlayerSelectSubtitles = function (textTracks) {
        if (textTracks.length <= 1) return;
        if ($(".dplayer-subtitle-btn .dplayer-quality-mask").length) {
            $(".dplayer-subtitle-btn .dplayer-quality-mask").remove();
        }
        var subbtn = $(".dplayer-subtitle-btn")
        subbtn.addClass("dplayer-quality");
        var fileId = obj.video_page.play_info.file_id
        , sub_info = obj.video_page.sub_info;
        var subList = sub_info[fileId];
        var eleSub = '<div class="dplayer-quality-item subtitle-item" data-index="'+ 0 +'" style="opacity: 0.4;">默认字幕</div>';
        for(var i = 1; i < subList.length; i++) {
            eleSub += '<div class="dplayer-quality-item subtitle-item" data-index="'+ i +'">'+ subList[i].label +'</div>';
        }
        var html = '<div class="dplayer-quality-mask"><div class="dplayer-quality-list subtitle-select"> '+ eleSub +'</div></div>'
        subbtn.append(html);
        $(".subtitle-select .subtitle-item").off("click").on("click", function() {
            var $this = $(this), index = $this.attr("data-index");
            if ($this.css("opacity") != .4) {
                $this.css("opacity", .4);
                $this.siblings().css("opacity", "");
                var subPicBtn = $(".dplayer-subtitle-btn .dplayer-icon");
                subPicBtn.attr("data-balloon") == "显示字幕" && subPicBtn.click();
                var subitem = subList[index];
                if (subitem && subitem.sarr && subitem.sarr.length) {
                    for(var i = textTracks[0].cues.length - 1; i >= 0; i--) {
                        textTracks[0].removeCue(textTracks[0].cues[i]);
                    }
                    subitem.sarr.forEach(function (item) {
                        /<b>.*<\/b>/.test(item.text) || (item.text = item.text.split(/\r?\n/).map((item) => `<b>${item}</b>`).join("\n"));
                        var textTrackCue = new VTTCue(item.startTime, item.endTime, item.text);
                        textTrackCue.id = item.index;
                        textTracks[0] && textTracks[0].addCue(textTrackCue);
                    });
                    sub_info.index = index;
                }
            }
        });
        var index = sub_info.index;
        index && $(".subtitle-select .subtitle-item").eq(index).click();
    };

    obj.dPlayerSubtitleStyle = function () {
        const player = obj.video_page.player;
        const { subtitle: { container: { style } } } = player;
        const bottom = localStorage.getItem("dplayer-subtitle-bottom")
        , color = localStorage.getItem("dplayer-subtitle-color")
        , fontSize = localStorage.getItem("dplayer-subtitle-fontSize");
        style.fontSize == fontSize + "vh" || (style.fontSize = fontSize + "vh");
        style.bottom == bottom + "%" || (style.bottom = bottom + "%");
        style.color == color || (style.color = color);
        style.textShadow || (style.textShadow = "1px 0 1px #000, 0 1px 1px #000, -1px 0 1px #000, 0 -1px 1px #000, 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000");
        if (!style.fontFamily) {
            const fontFamilys = ["黑体", "楷体", "宋体", "微软雅黑", "Trajan", "serif"]
            , rand_font = Math.floor(Math.random() * fontFamilys.length);
            style.fontFamily = fontFamilys[rand_font];
        }
    };

    obj.dPlayerSelectEpisode = function () {
        //选集 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        if ($(".dplayer-icons-right #btn-select-episode").length) return;
        if (document.querySelectorAll(".dplayer-menu-item").length < 4) return;
        var fileList = obj.file_page.items
        , videoList = fileList.filter(function (item, index) {
            return item.category == "video";
        })
        , play_info = obj.video_page.play_info
        , fileIndex = videoList.findIndex(function (item, index) {
            return item.file_id == play_info.file_id;
        });
        if (!(fileIndex > -1 && videoList.length > 1)) return;
        var elevideo = "";
        videoList.forEach(function (item, index) {
            if (fileIndex == index) {
                elevideo += '<div class="video-item active" title="' + item.name + '" style="background-color: rgba(0,0,0,.3);color: #0df;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;">' + item.name + '</div>';
            }
            else {
                elevideo += '<div class="video-item" title="' + item.name + '" style="color: #fff;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;">' + item.name + '</div>';
            }
        });
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z"></path></svg>'
        var html = '<button class="dplayer-icon dplayer-play-icon prev-icon" style="transform: rotate(-180deg)" title="上一集">'+ svg +'</button>';
        html += '<button id="btn-select-episode" class="dplayer-icon dplayer-quality-icon" title="选集">选集</button> <div class="playlist-content" style="max-width: 80%;max-height: 330px;width: auto;height: auto;box-sizing: border-box;overflow: hidden;position: absolute;left: 0;transition: all .38s ease-in-out;bottom: 52px;overflow-y: auto;transform: scale(0);z-index: 2;"><div class="list" style="background-color: rgba(0,0,0,.3);height: 100%;">' + elevideo + '</div></div>';
        html += '<button class="dplayer-icon dplayer-play-icon next-icon" title="下一集">'+ svg +'</button>';
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
            var file = videoList[$this.index()];
            obj.dPlayerPlayByFile(file);
        });
        $(".prev-icon").on("click", function () {
            var file = videoList[fileIndex - 1];
            file ? obj.dPlayerPlayByFile(file) : obj.showTipError("没有上一集了");
        });
        $(".next-icon").on("click",function(){
            var file = videoList[fileIndex + 1];
            file ? obj.dPlayerPlayByFile(file) : obj.showTipError("没有下一集了");
        });
    };

    obj.dPlayerPlayByFile = function(file) {
        var player = obj.video_page.player;
        if (player) {
            try {
                player.pause();
                player.docClickFun && document.removeEventListener('click', player.docClickFun, true);
                player.containerClickFun && player.container.removeEventListener('click', player.containerClickFun, true);
                player.fullScreen && player.fullScreen.destroy && player.fullScreen.destroy();
                player.hotkey && player.hotkey.destroy && player.hotkey.destroy();
                player.contextmenu && player.contextmenu.destroy && player.contextmenu.destroy();
                player.controller && player.controller.destroy && player.controller.destroy();
                player.timer && player.timer.destroy && player.timer.destroy();
                obj.video_page.player = null;
                obj.offsetCache = 0;
            } catch (error) { };
        }
        obj.video_page.play_info.file_id = file.file_id;
        obj.getVideoPreviewPlayInfo(function () {
            $("[class^=header-file-name], [class^=header-center] div span").text(file.name);
        });
    };

    obj.dPlayerInitAspectRatio = function () {
        if ($(".dplayer-icons-right .btn-select-aspectRatio").length) return;
        var html = '<div class="dplayer-quality btn-select-aspectRatio"><button class="dplayer-icon dplayer-quality-icon">画面比例</button><div class="dplayer-quality-mask"><div class="dplayer-quality-list">';
        html += '<div class="dplayer-quality-item" data-value="4:3">4:3</div><div class="dplayer-quality-item" data-value="16:9">16:9</div><div class="dplayer-quality-item" data-value="none">原始比例</div><div class="dplayer-quality-item" data-value="cover">自动裁剪</div><div class="dplayer-quality-item" data-value="fill">拉伸填充</div><div class="dplayer-quality-item" data-value="default">系统默认</div>';
        html += '</div></div></div>';
        $(".dplayer-icons-right").prepend(html);
        $(".btn-select-aspectRatio .dplayer-quality-item").on("click", function() {
            var ratio = $(this).attr("data-value");
            obj.dPlayerAspectRatio(ratio);
        });
    };

    obj.dPlayerAspectRatio = function (ratio) {
        const player = obj.video_page.player;
        const { template: { videoWrap, video } } = player;
        const ratios = { "default": "系统默认", "4:3": "4:3", "16:9": "16:9", "fill": "拉伸填充", "cover": "自动裁剪", "none": "原始比例" };
        !ratio ? (ratio = videoWrap.dataset.aspectRatio || "default") : player.notice(`画面比例: ${ratios[ratio]}`);
        if (ratio === "default") {
            setStyle(video, 'width', null);
            setStyle(video, 'height', null);
            setStyle(video, 'padding', null);
            setStyle(video, 'object-fit', null);
            delete videoWrap.dataset.aspectRatio;
        }
        else if (["4:3", "16:9"].includes(ratio)) {
            const ratioArray = ratio.split(':').map(Number);
            const { videoWidth, videoHeight } = video;
            const { clientWidth, clientHeight } = videoWrap;
            const videoRatio = videoWidth / videoHeight;
            const setupRatio = ratioArray[0] / ratioArray[1];
            if (videoRatio > setupRatio) {
                const percentage = (setupRatio * videoHeight) / videoWidth;
                setStyle(video, 'width', `${percentage * 100}%`);
                setStyle(video, 'height', '100%');
                setStyle(video, 'padding', `0 ${(clientWidth - clientWidth * percentage) / 2}px`);
            } else {
                const percentage = videoWidth / setupRatio / videoHeight;
                setStyle(video, 'width', '100%');
                setStyle(video, 'height', `${percentage * 100}%`);
                setStyle(video, 'padding', `${(clientHeight - clientHeight * percentage) / 2}px 0`);
            }
            setStyle(video, 'object-fit', 'fill');
            videoWrap.dataset.aspectRatio = ratio;
        }
        else if (["fill", "cover", "none"].includes(ratio)) {
            setStyle(video, 'width', null);
            setStyle(video, 'height', null);
            setStyle(video, 'padding', null);
            setStyle(video, 'object-fit', ratio);
            videoWrap.dataset.aspectRatio = ratio;
        }
        function setStyle (element, key, value) {
            element.style[key] = value;
            return element;
        }
    };

    obj.getVideoPreviewPlayInfo = function (callback) {
        obj.refresh_token(function (result) {
            if (result) {
                if (obj.isHomePage()) {
                    obj.get_video_preview_play_info(callback);
                }
                else {
                    obj.get_share_token(function (result) {
                        if (result) {
                            "x-signature" in obj.file_page.headers ? obj.get_share_link_video_preview_play_info(callback) : obj.create_session(function (result) {
                                setTimeout(() => { obj.get_share_link_video_preview_play_info(callback) }, 500);
                            });
                        }
                        else {
                            callback && callback("");
                        }
                    });
                }
            }
            else {
                callback && callback("");
            }
        });
    };

    obj.get_share_link_video_preview_play_info = function (callback) {
        var token = obj.getItem("token") || {}, share_id = obj.getShareId(), file_id = obj.video_page.play_info.file_id, _headers = obj.file_page.headers;
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
                "x-share-token": obj.getItem("shareToken").share_token,
                "x-device-id": _headers.hasOwnProperty("x-device-id") ? _headers["x-device-id"] : obj.uuid(),
                "x-signature": _headers["x-signature"]
            },
            async: true,
            success: function (response) {
                callback && callback(response);
            },
            error: function (error) {
                console.error("get_share_link_video_preview_play_info error", error);
                var code = error && error.responseJSON && error.responseJSON.code;
                if (code == "DeviceSessionSignatureInvalid" || code == "UserDeviceIllegality") {
                    obj.create_session(function (result) {
                        result ? setTimeout(() => { obj.get_share_link_video_preview_play_info(callback) }, 500) : callback && callback("");
                    });
                }
                else {
                    callback && callback("");
                }
            }
        });
    };

    obj.get_video_preview_play_info = function (callback) {
        var token = obj.getItem("token"), file_id = obj.video_page.play_info.file_id, _headers = obj.file_page.headers;
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
                "x-device-id": _headers.hasOwnProperty("x-device-id") ? _headers["x-device-id"] : obj.uuid(),
                "x-signature": _headers["x-signature"]
            },
            async: true,
            success: function (response) {
                callback && callback(response);
            },
            error: function (error) {
                console.error("get_video_preview_play_info error", error);
                var code = error && error.responseJSON && error.responseJSON.code;
                if (code == "DeviceSessionSignatureInvalid" || code == "UserDeviceIllegality") {
                    obj.create_session(function (result) {
                        result ? setTimeout(() => { obj.get_video_preview_play_info(callback) }, 500) : callback && callback("");
                    });
                }
                else {
                    callback && callback("");
                }
            }
        });
    };

    obj.isUrlExpires = function (e) {
        var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 6e3
        , n = obj.dPlayerStart.toString().length == 7436 && e.match(/&x-oss-expires=(\d+)&/);
        return !n || n && n[1] && +"".concat(n[1], "000") - t < Date.now();
    };

    obj.addCueVideoSubtitle = function (player, callback) {
        obj.getSubList(function (sublist) {
            if (sublist && sublist.length && sublist[0]) {
                const { video } = player;
                var textTracks = video.textTracks;
                for (let i = 0; i < textTracks.length; i++) {
                    textTracks[i].mode = "hidden" || (textTracks[i].mode = "hidden");
                    if (textTracks[i].cues && textTracks[i].cues.length) {
                        for(let ii = textTracks[i].cues.length - 1; ii >= 0; ii--) {
                            textTracks[i].removeCue(textTracks[i].cues[ii]);
                        }
                    }
                }
                sublist.forEach(function (item, index) {
                    if (item.sarr) {
                        textTracks[index] || video.addTextTrack("subtitles", item.label, item.language);
                        item.sarr.forEach(function (item) {
                            /<b>.*<\/b>/.test(item.text) || (item.text = item.text.split(/\r?\n/).map((item) => `<b>${item}</b>`).join("\n"));
                            var textTrackCue = new VTTCue(item.startTime, item.endTime, item.text);
                            textTrackCue.id = item.index;
                            textTracks[index] && textTracks[index].addCue(textTrackCue);
                        });
                    }
                });
                var textTrack = textTracks[0];
                if (textTrack && textTrack.cues && textTrack.cues.length && obj.isAppreciation.toString().length == 1367) {
                    textTrack.mode = "showing";
                    video.currentTime > 300 || obj.showTipSuccess("字幕添加成功");
                    callback && callback(textTracks);
                }
            }
        });
    };

    obj.getSubList = function (callback) {
        var fileId = obj.video_page.play_info.file_id
        , sub_info = obj.video_page.sub_info;
        if (sub_info.hasOwnProperty(fileId)) {
            return callback && callback(sub_info[fileId]);
        }
        sub_info.index = 0;
        var currSubList = sub_info[fileId] = [];
        obj.subtitleTaskList(function (sublist) {
            if (Array.isArray(sublist) && sublist[0]) {
                currSubList = currSubList.concat(sublist);
                currSubList = obj.sortSubList(currSubList);
                sub_info[fileId] = currSubList;
                callback && callback(currSubList);
            }
        });
        obj.subtitleFolderList(function (sublist) {
            if (Array.isArray(sublist) && sublist[0]) {
                currSubList = currSubList.concat(sublist);
                currSubList = obj.sortSubList(currSubList);
                sub_info[fileId] = currSubList;
                callback && callback(currSubList);
            }
        });
        obj.subtitleLocalFile(function (sublist) {
            if (Array.isArray(sublist) && sublist[0]) {
                currSubList = currSubList.concat(sublist);
                currSubList = obj.sortSubList(currSubList);
                sub_info[fileId] = currSubList;
                callback && callback(currSubList);
            }
        });
    };

    obj.subtitleTaskList = function (callback) {
        var sublist = obj.video_page.play_info.video_preview_play_info.live_transcoding_subtitle_task_list;
        if (sublist && sublist.length) {
            var sublistLen = sublist.length;
            sublist.forEach(function (item, index) {
                item.language || (item.language = "chi");
                item.label || (item.label = obj.langCodeTransform(item.language));
                obj.surlRequest(item.url, function (text) {
                    var sarr = obj.subtitleParser(text, "vtt");
                    if (Array.isArray(sarr) && sarr.length) {
                        sarr = obj.fuseSubArr(sarr);
                        item.sarr = sarr;
                    }
                    if (--sublistLen == 0) {
                        callback && callback(sublist.filter(function (item, index) {
                            return item.sarr;
                        }));
                    }
                });
            });
        }
        else {
            callback && callback("");
        }
    };

    obj.subtitleFolderList = function (callback) {
        var subFileList = obj.searchFolderSubList();
        if (subFileList && subFileList.length) {
            obj.subFileListDownloadUrl(subFileList, function(fileList) {
                var subFileListLen = subFileList.length;
                fileList.forEach(function (item, index) {
                    item.language || (item.language = "chi");
                    item.label || (item.label = obj.langCodeTransform(item.language));
                    item.sext = item.file_extension.toLowerCase();
                    obj.surlRequest(item.download_url || item.url, function (stext) {
                        var sarr = obj.subtitleParser(stext, item.sext);
                        if (Array.isArray(sarr)) {
                            sarr = obj.fuseSubArr(sarr);
                            item.sarr = sarr;
                        }
                        if (--subFileListLen == 0) {
                            callback && callback(subFileList.filter(function (item, index) {
                                return item.sarr;
                            }));
                        }
                    });
                });
            });
        }
        else {
            callback && callback("");
        }
    };

    obj.searchFolderSubList = function () {
        var fileList = obj.file_page.items
        , playInfo = obj.video_page.play_info
        , subExts = ["webvtt", "vtt", "srt", "ssa", "ass"]
        , vname = "";
        var videoList = [], subList = fileList.filter(function (item) {
            if (item.type == "file") {
                if (item.file_id == playInfo.file_id) {
                    vname = item.name.replace("." + item.file_extension, "").toLowerCase();
                }
                if (item.category == "video") {
                    videoList.push(item);
                }
                return subExts.includes(item.file_extension.toLowerCase());
            }
            else {
                return false;
            }
        });
        if (subList.length) {
            if (videoList.length == 1) {
                return subList;
            }
            else {
                var getSubList = function () {
                    var _subList = subList.filter(function (item) {
                        var fileName = item.name.replace("." + item.file_extension, "").toLowerCase();
                        return fileName.includes(vname) || vname.includes(fileName);
                    });
                    if (_subList.length) {
                        return _subList ;
                    }
                    else {
                        vname = vname.split(".").slice(0, -1).join(".");
                        if (vname) {
                            return getSubList();
                        }
                        else {
                            return "";
                        }
                    }
                };
                return getSubList();
            }
        }
        else {
            return "";
        }
    };

    obj.subFileListDownloadUrl = function (fileList, callback) {
        var shareId = obj.getShareId();
        if (shareId) {
            obj.getShareLinkDownloadUrlAll(fileList, callback);
        }
        else {
            obj.getHomeLinkDownloadUrlAll(fileList, callback);
        }
    };

    obj.subtitleLocalFile = function (callback) {
        obj.localFileForText(function (fileInfo) {
            if (fileInfo.stext) {
                fileInfo.sarr = obj.subtitleParser(fileInfo.stext, fileInfo.sext);
                if (fileInfo.sarr.length) {
                    fileInfo.language = obj.langDetectSarr(fileInfo.sarr);
                    fileInfo.label = obj.langCodeTransform(fileInfo.language);
                    callback && callback([ fileInfo ]);
                }
                else {
                    callback && callback("");
                }
            }
            else {
                obj.showTipError("本地字幕添加失败");
                callback && callback("");
            }
        });
    };

    obj.localFileForText = function (callback) {
        $(document).on("change", "#addsubtitle", function(event) {
            if (this.files.length) {
                var file = this.files[0];
                var file_ext = file.name.split(".").pop().toLowerCase();
                var sexts = ["webvtt", "vtt", "srt", "ssa", "ass"];
                if (!(file_ext && sexts.includes(file_ext))) {
                    obj.showTipError("暂不支持此类型文件");
                    return callback && callback("");
                }
                var reader = new FileReader();
                reader.readAsText(file, 'UTF-8');
                reader.onload = function(event) {
                    var result = reader.result;
                    if (result.indexOf("�") > -1) {
                        return reader.readAsText(file, "GBK");
                    }
                    else if (result.indexOf("") > -1) {
                        return reader.readAsText(file, "BIG5");
                    }
                    callback && callback({sext: file_ext, stext: result});
                };
                reader.onerror = function(e) {
                    callback && callback("");
                };
            }
            this.value = "";
            event.target.value = "";
        });
        $(document).on("change", ".afdian-order", function () {
            if (this.value) {
                if (this.value.match(/^202[\d]{22,25}$/)) {
                    if (this.value.match(/(\d)\1{7,}/g)) return;
                    localforage.getItem("users", (error, data) => {
                        (data && data.ON == this.value) || obj.onPost(this.value);
                    });
                }
                else {
                    obj.showTipError("\u6b64\u8ba2\u5355\u53f7\u4e0d\u5408\u89c4\u8303\uff0c\u8bf7\u91cd\u8bd5");
                }
            }
        });
    };

    obj.surlRequest = function (url, callback) {
        fetch(url, {
            referrer: "https://www.aliyundrive.com/",
            referrerPolicy: "origin",
            body: null,
            method: "GET",
            mode: "cors",
            credentials: "omit"
        }).then(data => data.blob()).then(blob => {
            var reader = new FileReader();
            reader.readAsText(blob, "UTF-8");
            reader.onload = function(e) {
                var result = reader.result;
                if (result.indexOf("�") > -1 && !reader.markGBK) {
                    reader.markGBK = true;
                    return reader.readAsText(blob, "GBK");
                }
                else if (result.indexOf("") > -1 && !reader.markBIG5) {
                    reader.markBIG5 = true;
                    return reader.readAsText(blob, "BIG5");
                }
                callback && callback(result);
            };
            reader.onerror = function(e) {
                callback && callback("");
            };
        }).catch(function(error) {
            callback && callback("");
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

    obj.parseTimestamp = function(e) {
        var t = e.split(":")
        , n = parseFloat(t.length > 0 ? t.pop().replace(/,/g, ".") : "00.000") || 0
        , r = parseFloat(t.length > 0 ? t.pop() : "00") || 0;
        return 3600 * (parseFloat(t.length > 0 ? t.pop() : "00") || 0) + 60 * r + n;
    };

    obj.langDetectSarr = function (sarr) {
        var t = [
            sarr[parseInt(sarr.length / 3)].text,
            sarr[parseInt(sarr.length / 2)].text,
            sarr[parseInt(sarr.length / 3 * 2)].text
        ].join("").replace(/[<bi\/>\r?\n]*/g, "");
        var e = "eng"
        , i = (t.match(/[\u4e00-\u9fa5]/g) || []).length / t.length;
        (t.match(/[\u3020-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\u31F0-\u31FF]/g) || []).length / t.length > .03 ? e = "jpn" : i > .1 && (e = "zho");
        return e;
    };

    obj.langCodeTransform = function (language) {
        return {
            chi: "中文字幕",
            zho: "中文字幕",
            eng: "英文字幕",
            jpn: "日文字幕"
        }[language] || "未知语言";
    };

    obj.sortSubList = function (sublist) {
        var chlist = [], otherlist = [];
        sublist.forEach(function (item, index) {
            ["chi", "zho"].includes(item.language) ? chlist.push(item) : otherlist.push(item);
        });
        return chlist.concat(otherlist);
    };

    obj.fuseSubArr = function (sarr) {
        var newsarr = [ sarr.shift() ];
        sarr.forEach(function (item, index) {
            var prevsub = newsarr.slice(-1);
            if (item.startTime == prevsub.startTime && item.endTime == prevsub.endTime) {
                prevsub.text += "\n" + item.text;
            }
            else {
                newsarr.push(item);
            }
        });
        return newsarr;
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
        return obj.isAppreciation.toString().length == 1367 && window.instances[src];
    };

    obj.initDownloadSharePage = function () {
        if ($(".button-download--batch").length) {
            return;
        }
        if ($("#root [class^=banner] [class^=right]").length) {
            var html = '<button class="button--2Aa4u primary--3AJe5 small---B8mi button-download--batch" style="margin-right: 28px;">显示链接</button>';
            $("#root [class^=banner] [class^=right]").prepend(html);
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
        if ($("#root header").length) {
            var html = '<div style="margin:0px 8px;"></div><button class="button--WC7or primary--NVxfK small--e7LRt modal-footer-button--9CQLU button-download--batch">显示链接</button>';
            $("#root header:eq(0)").append(html);
            $(".button-download--batch").on("click", obj.showDownloadHomePage);
        }
        else {
            setTimeout(obj.initDownloadHomePage, 1000)
        }
    };

    obj.showDownloadSharePage = function () {
        if (!obj.isLogin()) {
            document.querySelector("[class^=login]").click();
            return;
        }
        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            console.error("致命错误：获取分享文件列表失败");
            obj.showTipError("致命错误：获取分享文件列表失败");
            return;
        }
        obj.getShareLinkDownloadUrlAll(fileList, function(fileList) {
            obj.showBox(fileList);
        });
    };

    obj.showDownloadHomePage = function () {
        var fileList = obj.getSelectedFileList();
        if (fileList.length == 0) {
            return obj.showTipError("致命错误：获取个人文件列表失败");
        }
        obj.getHomeLinkDownloadUrlAll(fileList, function(fileList) {
            obj.showBox(fileList);
        });
    };

    obj.showBox = function (fileList) {
        $('<div class="ant-modal-root"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle0"><div role="document" class="ant-modal modal-wrapper--2yJKO modal-wrapper--5SA7y" style="width: 60%;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle0">文件下载</div></div><div class="ant-modal-body"><div class="icon-wrapper--3dbbo icon-wrapper--TbIdu"><span data-role="icon" data-render-as="svg" data-icon-type="PDSClose" class="close-icon--33bP0 icon--d-ejA close-icon--KF5OX icon--D3kMk "><svg viewBox="0 0 1024 1024"><use xlink:href="#PDSClose"></use></svg></span></div><div class="container--1RqbN container--yXiG-"><div class="list--13IBL list--ypYX0"></div></div></div><div class="ant-modal-footer"><div class="footer--1r-ur footer--zErav"><div class="buttons--nBPeo buttons--u5Y-e"></div></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>').appendTo(document.body).find(".list--13IBL,.list--ypYX0").append(
            fileList.map((item, index) => {
                var isfile = item.type == "file", bc = isfile ? `bc://http/${btoa(unescape(encodeURIComponent(`AA/${encodeURIComponent(item.name)}/?url=${encodeURIComponent(item.download_url)}&refer=${encodeURIComponent('https://www.aliyundrive.com/')}ZZ`)))}` : ``;
                return `<div class="item--18Z6t item--v0KyS" title="${ isfile ? `文件大小：${ obj.bytesToSize(item.size) }` : `请进入文件夹下载` }"><span style="width: 100%;">${++index}：${item.name}</span>${ isfile ? `<a title="${bc}" href="${bc}">BitComet</a>` : ``}</div>`
                         + (isfile ? `<div class="item--18Z6t item--v0KyS"><span style="width: 100%;"><a title=${item.download_url} href=${item.download_url}>${item.download_url}</a></span></div>` : ``);
            }).join("\n")
        ).closest(".ant-modal-root").find(".buttons--nBPeo,.buttons--u5Y-e").append(
            '<button class="button--2Aa4u primary--3AJe5 small---B8mi button--WC7or primary--NVxfK small--e7LRt">IDM 导出文件</button>' +
            '<button class="button--2Aa4u primary--3AJe5 small---B8mi button--WC7or primary--NVxfK small--e7LRt">M3U 导出文件</button>' +
            '<button class="button--2Aa4u primary--3AJe5 small---B8mi button--WC7or primary--NVxfK small--e7LRt">Aria2 推送</button>' +
            '<button class="button--2Aa4u primary--3AJe5 button--WC7or primary--NVxfK" style="margin-left: 0;width: auto;border: 0 solid transparent;">⚙️</button>'
        ).children().on("click", function () {
            var singleList = fileList.filter(function (item) {
                return item.type == "file" && (item.download_url || item.url);
            });
            if (singleList.length) {
                obj.isAppreciation((data) => {data || obj.showDialog()});
                var folderName, fileInfo = obj.file_page.file_info;
                folderName = fileInfo.type === "folder" ? fileInfo.name : "";
                var $this = $(this), $text = $this.text(), index = $this.index();
                switch(index) {
                    case 0:
                        obj.downloadFile(singleList.map((item, index) => [`<`, item.download_url, `referer: https://www.aliyundrive.com/`, `User-Agent: ${navigator.userAgent}`, `>`].join(`\r\n`)).join(`\r\n`) + `\r\n`, (folderName || "IDM 导出文件") + ".ef2");
                        break;
                    case 1:
                        var videoList = singleList.filter(function (item) {
                            return item.category == "video";
                        });
                        if (videoList.length) {
                            obj.downloadFile(`#EXTM3U\r\n#EXTVLCOPT:http-referrer=https://www.aliyundrive.com/\r\n` + singleList.map((item, index) => [ `#EXTINF:-1, ${item.name}`, item.download_url ].join(`\r\n`)).join(`\r\n`), (folderName || "M3U 导出文件") + ".m3u");
                        }
                        else {
                            obj.showTipError("未找到有效视频文件");
                        }
                        break;
                    case 2:
                        $this.text("正在推送");
                        var downData = singleList.map(function (item, index) {
                            return {
                                id: "",
                                jsonrpc: "2.0",
                                method: "aria2.addUri",
                                params:[
                                    "token:" + (obj.getItem("aria-token") || ""),
                                    [ item.download_url ],
                                    {
                                        out: item.name,
                                        dir: (obj.getItem("aria-dir") || "D:\/aliyundriveDownloads") + (folderName ? "\/" + folderName : ""),
                                        referer: "https://www.aliyundrive.com/",
                                        "user-agent": navigator.userAgent
                                    }
                                ]
                            }
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
                        break;
                    case 3:
                        $('<div class="ant-modal-root"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle1" style=""><div role="document" class="ant-modal modal-wrapper--5SA7y" style="width: 340px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle1">Aria2 设置</div></div><div class="ant-modal-body"><div class="content-wrapper--S6SNu"><div>推送链接：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="http://127.0.0.1:6800/jsonrpc" action="click" type="text" class="ant-input ant-input-borderless"></span></div><div class="content-wrapper--S6SNu"><div>推送路径：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="D:\/aliyundriveDownloads" action="click" type="text" class="ant-input ant-input-borderless"></span></div><div class="content-wrapper--S6SNu"><div>RPC密钥：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="" action="click" type="text" class="ant-input ant-input-borderless"></span></div></div><div class="ant-modal-footer"><div class="footer--cytkB"><button class="button--WC7or secondary--vRtFJ small--e7LRt cancel-button--c-lzN">取消</button><button class="button--WC7or primary--NVxfK small--e7LRt">确定</button></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>').appendTo(document.body).find("button").on("click", function () {
                            var index = $(this).index();
                            if (index) {
                                $(this).closest(".ant-modal-content").find("input").each(function (index) {
                                    obj.setItem([ "aria-url", "aria-dir", "aria-token" ][index], $(this).val() || "");
                                });
                            }
                            $(this).closest(".ant-modal-root").remove();
                        }).closest(".ant-modal-content").find("input").each(function (index) {
                            $(this).val(obj.getItem([ "aria-url", "aria-dir", "aria-token" ][index]) || "");
                        });
                        break;
                    default:
                        break;
                }
            }
            else {
                obj.showTipError("未找到有效文件");
            }
        }).closest(".ant-modal-root").find(".icon-wrapper--3dbbo,.icon-wrapper--TbIdu").one("click", function () {
            $(this).closest(".ant-modal-root").remove();
        }).closest(".ant-modal-root").find(".list--13IBL.list--ypYX0 a").on("mousedown mouseup", function (event) {
            this.href = this.title;
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
        var url = obj.getItem("aria-url");
        obj.ajax({
            type: "post",
            url: url || urls[0],
            data: JSON.stringify(downData),
            success: function (response) {
                url || obj.setItem("aria-url", this.url);
                callback && callback(response);
            },
            error: function (error) {
                var index = urls.indexOf(this.url);
                if (index >= 0) {
                    if (index < urls.length - 1) {
                        obj.setItem("aria-url", urls[index + 1]);
                        setTimeout(function() { obj.aria2RPC(downData, callback) }, 500);
                    }
                    else {
                        console.error("Aria2 推送服务 错误：", this.url, error);
                        obj.removeItem("aria-url");
                        callback && callback("");
                    }
                }
                else {
                    obj.setItem("aria-url", urls[index + 1]);
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
        var $node = obj.isSharePage() ? $(".tbody--3Y4Fn  .tr--5N-1q.tr--3Ypim,.outer-wrapper--25yYA") : $(".tbody--Na444 .tr--Ogi-3.tr--97U9T,.outer-wrapper--JCodp");
        if ($node.length) {
            $node.each(function (index) {
                var $this = $(this);
                if ($this.attr("data-is-selected") == "true") {
                    var data_index = $this.closest("[data-index]").attr("data-index");
                    data_index && selectedFileList.push(fileList[data_index]);
                }
            });
            return selectedFileList.length ? selectedFileList : fileList;
        }
        else {
            obj.showTipError("寻找选中文件出错，未找到节点");
            return fileList;
        }
    };

    obj.getShareLinkDownloadUrlAll = function (fileList, callback) {
        var fileListLen = fileList.length;
        fileList.forEach(function (item, index) {
            !item.download_url || (obj.isExpires(item) || (item.download_url = ""));
            if (item.download_url || item.type == "folder") {
                if (-- fileListLen == 0) {
                    callback && callback(fileList);
                }
            }
            else {
                obj.getShareLinkDownloadUrl(item.file_id, item.share_id, function (download_url) {
                    download_url && (obj.setExpires(item, 600), item.download_url = download_url);
                    if (-- fileListLen == 0) {
                        callback && callback(fileList);
                    }
                });
            }
        });
    };

    obj.getHomeLinkDownloadUrlAll = function (fileList, callback) {
        var fileListLen = fileList.length;
        fileList.forEach(function (item, index) {
            !item.download_url || (obj.isExpires(item) || (item.download_url = ""));
            if (item.download_url || item.type == "folder") {
                if (-- fileListLen == 0) {
                    callback && callback(fileList);
                }
            }
            else {
                obj.getHomeLinkDownloadUrl(item.file_id, item.drive_id, function (download_url) {
                    download_url && (obj.setExpires(item, 1600), item.download_url = download_url);
                    if (-- fileListLen == 0) {
                        callback && callback(fileList);
                    }
                });
            }
        });
    };

    obj.getShareLinkDownloadUrl = function (file_id, share_id, callback) {
        obj.refresh_token(function (result) {
            if (result) {
                obj.get_share_token(function (result) {
                    if (result) {
                        obj.get_share_link_download_url(file_id, share_id, callback);
                    }
                    else {
                        callback && callback("");
                    }
                });
            }
            else {
                callback && callback("");
            }
        });
    };

    obj.getHomeLinkDownloadUrl = function (file_id, drive_id, callback) {
        obj.refresh_token(function (result) {
            if (result) {
                obj.get_download_url(file_id, drive_id, callback);
            }
            else {
                callback && callback("");
            }
        });
    };

    obj.get_share_link_download_url = function (file_id, share_id, callback) {
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
                    console.error("get_share_link_download_url 失败", response);
                    callback && callback("");
                }
            },
            error: function (error) {
                console.error("get_share_link_download_url 错误", error);
                var errorCode = error.responseJSON ? error.responseJSON.code : "";
                if ("InvalidParameterNotMatch.ShareId" === errorCode) {
                    obj.showTipError("错误：参数不匹配，此错误可能是打开了另一个分享页面导致，请刷新", 10000);
                }
                callback && callback("");
            }
        });
    };

    obj.get_download_url = function (file_id, drive_id, callback) {
        var token = obj.getItem("token") || {}, _headers = obj.file_page.headers;
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
                "content-type": "application/json;charset=utf-8",
                "x-device-id": _headers["x-device-id"] || obj.uuid(),
                "x-signature": _headers["x-signature"]
            },
            async: true,
            success: function (response) {
                if (response instanceof Object && response.url) {
                    callback && callback(response.url);
                }
                else {
                    console.error("get_download_url 失败", response);
                    callback && callback("");
                }
            },
            error: function (error) {
                var errorCode = error.responseJSON ? error.responseJSON.code : "";
                if (errorCode == "TooManyRequests") {
                    setTimeout(function () { obj.get_download_url(file_id, drive_id, callback); }, 500);
                }
                else {
                    console.error("get_download_url 错误", error);
                    callback && callback("");
                }
            }
        });
    };

    obj.refresh_token = function (callback) {
        var token = obj.getItem("token");
        if (!(token && token.refresh_token)) {
            obj.showTipError("缺少必要参数，请登陆后刷新此页面重试！", 10000);
            return callback && callback("");
        }
        if (obj.isExpires(token)) {
            return callback && callback(token);
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
        var shareToken = obj.getItem("shareToken");
        if (!shareToken) {
            obj.showTipError("缺少必要参数，请登陆后刷新此页面重试！", 10000);
            return callback && callback("");
        }
        if (obj.isExpires(shareToken)) {
            return callback && callback(shareToken);
        }
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

    obj.onPost = function (on, callback) {
        obj.usersPost(function(data) {
            Date.parse(data.expire_time) === 0 || localforage.setItem("users", Object.assign(data || {}, { expire_time: new Date(Date.now() + 864000).toISOString() })).then((data) => {GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data))))});
            obj.infoPost(data, on, function (result) {
                callback && callback(result);
            });
        });
    };

    obj.usersPost = function (callback) {
        obj.users(obj.getItem("token"), function(users) {
            callback && callback(users);
        });
    };

    obj.users = function(data, callback) {
        obj.ajax({
            type: "post",
            url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/users",
            data: JSON.stringify({authData: {aliyundrive: Object.assign(data, {
                uid: data.user_id,
                scriptHandler: GM_info.scriptHandler,
                version: GM_info.script.version
            })}}),
            headers: {
                "Content-Type": "application/json",
                "X-LC-Id": "sXXf4FFOZn2nFIj7LOFsqpLa-gzGzoHsz",
                "X-LC-Key": "16s3qYecpVJXtVahasVxxq1V"
            },
            success: function (response) {
                callback && callback(response);
            },
            error: function (error) {
                callback && callback("");
            }
        });
    };

    obj.infoPost = function(data, on, callback) {
        delete data.createdAt;
        delete data.updatedAt;
        delete data.objectId;
        obj.ajax({
            type: "post",
            url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/classes/aliyundrive",
            data: JSON.stringify(Object.assign(data, {
                ON: on
            })),
            headers: {
                "Content-Type": "application/json",
                "X-LC-Id": "sXXf4FFOZn2nFIj7LOFsqpLa-gzGzoHsz",
                "X-LC-Key": "16s3qYecpVJXtVahasVxxq1V"
            },
            success: function (response) {
                callback && callback(response);
            },
            error: function (error) {
                callback && callback("");
            }
        });
    };

    obj.ajax = function(option) {
        var details = {
            method: option.type,
            url: option.url,
            headers: option.headers,
            headers: option.headers,
            responseType: option.dataType,
            onload: function(result) {
                if (parseInt(result.status / 100) == 2) {
                    var response = result.response;
                    try { response = JSON.parse(response); } catch(a) {};
                    option.success && option.success(response);
                } else {
                    option.error && option.error(result);
                }
            },
            onerror: function(result) {
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
            delete details.data;
        }
        GM_xmlhttpRequest(details);
    };

    obj.isAppreciation = function (callback) {
        localforage.getItem("users", function(error, data) {
            if (data && data.expire_time) {
                if (btoa(encodeURIComponent(JSON.stringify(data))) === GM_getValue("users_sign")) {
                    var t = data.expire_time, e = Date.parse(t) - Date.now();
                    if (0 < e) {
                        callback && callback(data);
                    }
                    else {
                        localforage.setItem("users", { expire_time: new Date().toISOString()}).then(() => {obj.isAppreciation(callback)});
                    }
                }
                else {
                    obj.usersPost(function (data) {
                        if (data && data.expire_time && 0 < Date.parse(data.expire_time) - Date.now()) {
                            localforage.setItem("users", data);
                            GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data))));
                            callback && callback(data);
                        }
                        else {
                            localforage.removeItem("users");
                            callback && callback("");
                        }
                    });
                }
            }
            else {
                callback && callback("");
            }
        });
    };

    obj.showDialog = function () {
        $('<div class="ant-modal-root"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle1" style=""><div role="document" class="ant-modal modal-wrapper--5SA7y" style="width: 340px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle1">提示</div></div><div class="ant-modal-body"><div class="content-wrapper--S6SNu"><div>爱发电订单号：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="" action="click" type="text" class="afdian-order ant-input ant-input-borderless" style="background-color: var(--divider_tertiary);"></span></div><div class="content-wrapper--S6SNu"><div>请输入爱发电订单号，确认即可</div><a href="https://afdian.net/order/create?plan_id=be4f4d0a972811eda14a5254001e7c00" target="_blank"> 赞赏作者 </a><a href="https://afdian.net/dashboard/order" target="_blank"> 复制订单号 </a></div></div><div class="ant-modal-footer"><div class="footer--cytkB"><button class="button--WC7or secondary--vRtFJ small--e7LRt cancel-button--c-lzN">取消</button><button class="button--WC7or primary--NVxfK small--e7LRt">确定</button></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>').appendTo(document.body).find("button").on("click", function () {
            var $this = $(this), index = $this.index(), value = $this.closest(".ant-modal-content").find("input").val();
            if (index && value) {
                if (value.match(/^202[\d]{22,25}$/)) {
                    if (value.match(/(\d)\1{7,}/g)) return;
                    localforage.getItem("users", (error, data) => {
                        (data && data.ON == value) || obj.onPost(value);
                    });
                }
                else {
                    obj.showTipError("\u6b64\u8ba2\u5355\u53f7\u4e0d\u5408\u89c4\u8303\uff0c\u8bf7\u91cd\u8bd5");
                }
            }
            $(this).closest(".ant-modal-root").remove();
        });
    };

    obj.isExpires = function(file) {
        var t = file.expire_time, i = Number(file.expires_in), e = Date.parse(t) - Date.now();
        if (0 < e && e < 1e3 * i) return !0;
        return !1;
    };

    obj.setExpires = function(file, time) {
        time = void 0 === time ? 600 : time;
        file.expire_time = new Date(Date.now() + time).toISOString();
        file.expires_in = time;
        return file;
    };

    obj.customSharePwd = function () {
        $(document).on("DOMNodeInserted", ".ant-modal-root", function() {
            var text = $(this).find(".ant-modal-title").text();
            if (text == "分享文件") {
                if ($(".input-share-pwd").length == 0) {
                    var sharePwd = localStorage.getItem("share_pwd");
                    var html = '<label class="label--y1jrs">自定义提取码</label>';
                    html += '<input type="text" class="ant-input input-share-pwd" value="' + (sharePwd ? sharePwd : "") + '" placeholder="" style="margin-left: 12px;width: 100px;height: 25px;line-height: normal;border: 1px solid #D4D7DE;text-align: center;"></div>'
                    if ($("[class^=choose-expiration-wrapper]").length) {
                        $("[class^=choose-expiration-wrapper]").append(html);
                    }
                    else if ($("[class^=share-by-url]").length) {
                        $("[class^=share-by-url]").append(html);
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
                                        var response = this.response;
                                        try { response = JSON.parse(this.response) } catch (error) { };
                                        if (response.share_pwd == sharePwd) {
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

    obj.filterNotice = function () {
        $(document).on("DOMNodeInserted", ".aDrive", function() {
            var $this = $(this), $text = $this.find(".title--Bnudr").text();
            $text.includes("视频仅可试看") && $this.children("div").empty();
        });
    };

    obj.getShareId = function () {
        var url = location.href;
        var match = obj.dPlayerStart.toString().length == 7436 && url.match(/aliyundrive\.com\/s\/([a-zA-Z\d]+)/);
        return match ? match[1] : null;
    };

    obj.getRandomColor = function() {
        return "#" + ("00000" + (Math.random() * 0x1000000 << 0).toString(16)).substr(- 6);
    };

    obj.bytesToSize = function (e) {
        return (function () {
            var t = 1024;
            return e <= 0 ? "0 B" : e >= Math.pow(t, 4) ? "".concat(
                r(e / Math.pow(t, 4), 2), " TB") : e >= Math.pow(t, 3) ? "".concat(
                r(e / Math.pow(t, 3), 2), " GB") : e >= Math.pow(t, 2) ? "".concat(
                r(e / Math.pow(t, 2), 2), " MB") : e >= t ? "".concat(
                r(e / t, 2), " KB") : "".concat(
                r(e, 2), " B");
        })();
        function r(e) {
            var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 2
            , n = !(arguments.length > 2 && void 0 !== arguments[2]) || arguments[2];
            if (0 === e) {
                return "0";
            }
            var r = n ? e.toFixed(t) : i(e, t);
            return t ? r.replace(/0+$/, "").replace(/\.$/, "") : r;
        }
        function i(e, t) {
            return (Math.floor(e * Math.pow(10, t)) / Math.pow(10, t)).toFixed(t);
        }
    };

    obj.isSharePage = function () {
        return location.href.indexOf("aliyundrive.com/s/") > 0;
    };

    obj.isHomePage = function () {
        return location.href.indexOf("aliyundrive.com/drive") > 0;
    };

    obj.isLogin = function () {
        return !document.querySelector("[class^=login]");
    };

    obj.getItem = function (n) {
        n = localStorage.getItem(n);
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
        n && t != undefined && localStorage.setItem(n, t instanceof Object ? JSON.stringify(t) : t);
    };

    obj.removeItem = function (n) {
        n && localStorage.removeItem(n);
    };

    obj.startObj = function(callback) {
        var objs = Object.values(obj), lobjls = GM_getValue(GM_info.script.version, ""), length = objs.reduce(function (prev, cur) {
            return (prev += cur?cur.toString().length:0);
        }, 0);
        (lobjls ? lobjls === length ? obj : obj = {}: GM_setValue(GM_info.script.version, length), callback && callback(obj));
    };

    obj.showTipSuccess = function (message, time) {
        obj.showNotify({
            type: "success",
            message: message,
            time: time
        });
    };

    obj.showTipError = function (message, time) {
        obj.showNotify({
            type: "fail",
            message: message,
            time: time
        });
    };

    obj.showTipLoading = function (message, time) {
        obj.showNotify({
            type: "loading",
            message: message,
            time: time
        });
    };

    obj.showNotify = function (opts) {
        if (unsafeWindow.application) {
            unsafeWindow.application.showNotify(opts);
        }
        else {
            var css = [
                ".notify{display:none;position:absolute;top:0;left:25%;width:50%;text-align:center;overflow:hidden;z-index:1010}",
                ".notify .alert{display:inline-block;*display:inline;*zoom:1;min-width:110px;white-space:nowrap}",
                ".alert-success,.alert-fail,.alert-loading{padding:0 20px;line-height:34px;font-size:14px;color:#ffffff}",
                ".alert-success,.alert-loading{background:#36be63}",
                ".alert-fail{background:#ff794a}",
                ".fade{opacity:0;-webkit-transition:opacity .15s linear;-o-transition:opacity .15s linear;transition:opacity .15s linear}",
                ".fade.in{opacity:1}"
            ];
            $("<style></style>").text(css.join(" ")).appendTo(document.head || document.documentElement);
            $("body").append('<div id="J_Notify" class="notify" style="width: 650px; margin: 10px auto; display: none;"></div>');
            unsafeWindow.application = {
                notifySets: {
                    type_class_obj: {success: "alert-success", fail: "alert-fail", loading: "alert-loading"},
                    count: 0,
                    delay: 3e3
                },
                showNotify: function(opts) {
                    var that = this, class_obj = that.notifySets.type_class_obj, count = that.notifySets.count;
                    opts.type == "loading" && (delay *= 5);
                    if ($(".alert").length == 0) {
                        $("#J_Notify").empty().append('<div class="alert in fade"></div>').show();
                    }
                    else {
                        Object.keys(class_obj).forEach(function(key) {
                            $("#J_Notify").toggleClass(class_obj[key], false);
                        });
                    }
                    $(".alert").text(opts.message).addClass(class_obj[opts.type]);
                    that.notifySets.count += 1;

                    var delay = opts.time || that.notifySets.delay;
                    setTimeout(function() {
                        if (++count == that.notifySets.count) {
                            that.hideNotify();
                        }
                    }, delay);
                },
                hideNotify: function() {
                    $("#J_Notify").empty();
                }
            };
            obj.showNotify(opts);
        }
    };

    obj.hideNotify = function() {
        if (unsafeWindow.application) {
            unsafeWindow.application.hideNotify();
        }
    };

    obj.addPageFileList = function () {
        var send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(data) {
            this.addEventListener("load", function(event) {
                if (this.readyState == 4 && this.status == 200) {
                    var response = this.response, responseURL = this.responseURL;
                    if (responseURL.endsWith("/users/device/create_session") || responseURL.endsWith("/users/device/renew_session")) {
                        obj.file_page.headers = this._header_;
                    }
                    else if (responseURL.endsWith("/file/get")) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object) {
                            if (response.category == "video") {
                                obj.video_page.file_info = response;
                            }
                            else {
                                obj.file_page.file_info = response;
                            }
                        }
                    }
                    else if (responseURL.indexOf("/file/list") > 0 || responseURL.indexOf("/file/search") > 0) {
                        if (document.querySelector(".ant-modal-mask")) {
                            //排除【保存 移动 等行为触发】
                            return;
                        };
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response && response.items) {
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
                                }
                                obj.picturePreview();
                            }
                        }
                    }
                    else if (responseURL.indexOf("/file/get_share_link_video_preview_play_info") > 0) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object) {
                            obj.video_page.play_info = response;
                            obj.dPlayerStart();
                        }
                    }
                    else if (responseURL.indexOf("/file/get_video_preview_play_info") > 0) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object) {
                            obj.video_page.play_info = response;
                            if (obj.isSharePage()) {
                                obj.get_share_link_video_preview_play_info(function (response) {
                                    response || obj.showTipError("播放信息获取失败 请刷新重试", 10000);
                                });
                                return;
                            }
                            obj.dPlayerStart();
                        }
                    }
                }
                else if (this.readyState == 4 && this.status == 403) {
                    if (obj.isUrlExpires(this.responseURL)) {
                        var media_num = (this.responseURL.match(/media-(\d+)\.ts/) || [])[1] || 0;
                        if (Math.abs((media_num || 0) - (obj.video_page.media_num || 0)) > 2) {
                            obj.video_page.media_num = media_num;
                            obj.getVideoPreviewPlayInfo(function(result) {
                                result || (obj.video_page.media_num = 0);
                            });
                        }
                    }
                }
            }, false);
            send.apply(this, arguments);
        };
    };

    obj.create_session = function (callback) {
        obj.secp256k1Support(function (secp256k1) {
            const { device_id, user_id, token_type, access_token } = obj.getItem("token");
            const { crypto, Secp256k1, Global: { app_id } } = unsafeWindow;
            const privateKeyBuf = crypto.getRandomValues(new Uint8Array(32));
            const privateKey = Secp256k1.uint256(privateKeyBuf, 16);
            const publicKey = Secp256k1.generatePublicKeyFromPrivateKeyData(privateKey);
            const pubKey = "04" + publicKey.x + publicKey.y;
            const nonce = 0;
            const encoder = new TextEncoder();
            const data = encoder.encode(`${app_id}:${device_id}:${user_id}:${nonce}`);
            crypto.subtle.digest("SHA-256", data).then(function (hashBuffer) {
                const hashUint8 = new Uint8Array(hashBuffer);
                const digest = Secp256k1.uint256(hashUint8, 16);
                const sig = Secp256k1.ecsign(privateKey, digest);
                const signature = sig.r + sig.s + "01";
                obj.showBox.toString().includes("showDialog") && $.ajax({
                    type: "post",
                    url: "https://api.aliyundrive.com/users/v1/users/device/create_session",
                    data: JSON.stringify({
                        deviceName: obj.getBrowser().browser.name + "浏览器",
                        modelName: obj.getBrowser().os.name + "网页版",
                        pubKey: pubKey
                    }),
                    headers: {
                        "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                        "content-type": "application/json;charset=utf-8",
                        "x-device-id": obj.uuid(),
                        "x-signature": signature
                    },
                    success: function (response) {
                        callback && callback(response.result);
                    },
                    error: function (error) {
                        callback && callback("");
                    }
                });
            });
        });
    };

    obj.renew_session = function (callback) {
        var token = obj.getItem("token") || {}, _headers = obj.file_page.headers;
        $.ajax({
            type: "post",
            url: "https://api.aliyundrive.com/users/v1/users/device/renew_session",
            data: JSON.stringify({ }),
            headers: {
                "authorization": "".concat(token.token_type || "", " ").concat(token.access_token || ""),
                "content-type": "application/json;charset=utf-8",
                "x-device-id": _headers["x-device-id"] || obj.uuid(),
                "x-signature": _headers["x-signature"]
            },
            success: function (response) {
                callback && callback(response);
            },
            error: function () {
                callback && callback('')
            }
        });
    };

    obj.secp256k1Support = function (callback) {
        /* 参考 https://github.com/Souls-R/AliyunPlayScript */
        obj.loadScript("https://unpkg.com/bn.js@4.11.8/lib/bn.js").then(function() {
            obj.loadScript("https://unpkg.com/@lionello/secp256k1-js@1.1.0/src/secp256k1.js").then(function() {
                callback && callback(unsafeWindow.Secp256k1);
            }, function() {
                callback && callback("");
            });
        }, function() {
            callback && callback("");
        });
    };

    obj.getBrowser = function () {
        return obj.browser || function(i, o) {
            var n = i.navigator && i.navigator.userAgent ? i.navigator.userAgent : ""
            , l = "object"
            , a = "function"
            , c = "string"
            , p = "version"
            , d = "name"
            , F = "Facebook"
            , k = "BlackBerry"
            , U = {
                ME: "4.90",
                "NT 3.11": "NT3.51",
                "NT 4.0": "NT4.0",
                2e3: "NT 5.0",
                XP: ["NT 5.1", "NT 5.2"],
                Vista: "NT 6.0",
                7: "NT 6.1",
                8: "NT 6.2",
                8.1: "NT 6.3",
                10: ["NT 6.4", "NT 10.0"],
                RT: "ARM"
            }
            , z = function(e, t) {
                for (var n in t) {
                    if (typeof t[n] === l && t[n].length > 0) {
                        for (var r = 0; r < t[n].length; r++) {
                            if (R(t[n][r], e)) {
                                return "?" === n ? o : n;
                            }
                        }
                    } else if (R(t[n], e)) {
                        return "?" === n ? o : n;
                    }
                }
                return e;
            }
            , R = function(e, t) {
                return typeof e === c && -1 !== L(t).indexOf(L(e));
            }
            , L = function(e) {
                return e.toLowerCase();
            }
            , Z = function(e, t) {
                for (var n, r, i, s, c, u, d = 0; d < t.length && !c; ) {
                    var f = t[d], h = t[d + 1];
                    for (n = r = 0; n < f.length && !c; ) {
                        if (c = f[n++].exec(e)) {
                            for (i = 0; i < h.length; i++) {
                                u = c[++r];
                                typeof (s = h[i]) === l && s.length > 0 ? 2 === s.length ? typeof s[1] == a ? this[s[0]] = s[1].call(this, u) : this[s[0]] = s[1] : 3 === s.length ? typeof s[1] !== a || s[1].exec && s[1].test ? this[s[0]] = u ? u.replace(s[1], s[2]) : o : this[s[0]] = u ? s[1].call(this, u, s[2]) : o : 4 === s.length && (this[s[0]] = u ? s[3].call(this, u.replace(s[1], s[2])) : o) : this[s] = u || o;
                            }
                        }
                    }
                    d += 2;
                }
            }
            , r = {
                browser: [
                    [/\b(?:crmo|crios)\/([\w\.]+)/i],
                    [p, [d, "Chrome"]],
                    [/edg(?:e|ios|a)?\/([\w\.]+)/i],
                    [p, [d, "Edge"]],
                    [/(opera mini)\/([-\w\.]+)/i, /(opera [mobiletab]{3,6})\b.+version\/([-\w\.]+)/i, /(opera)(?:.+version\/|[\/ ]+)([\w\.]+)/i],
                    [d, p],
                    [/opios[\/ ]+([\w\.]+)/i],
                    [p, [d, "Opera Mini"]],
                    [/\bopr\/([\w\.]+)/i],
                    [p, [d, "Opera"]],
                    [/(kindle)\/([\w\.]+)/i, /(lunascape|maxthon|netfront|jasmine|blazer)[\/ ]?([\w\.]*)/i, /(avant |iemobile|slim)(?:browser)?[\/ ]?([\w\.]*)/i, /(ba?idubrowser)[\/ ]?([\w\.]+)/i, /(?:ms|\()(ie) ([\w\.]+)/i, /(flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon|rekonq|puffin|brave|whale|qqbrowserlite|qq)\/([-\w\.]+)/i, /(weibo)__([\d\.]+)/i],
                    [d, p],
                    [/(?:\buc? ?browser|(?:juc.+)ucweb)[\/ ]?([\w\.]+)/i],
                    [p, [d, "UCBrowser"]],
                    [/\bqbcore\/([\w\.]+)/i],
                    [p, [d, "WeChat(Win) Desktop"]],
                    [/micromessenger\/([\w\.]+)/i],
                    [p, [d, "WeChat"]],
                    [/konqueror\/([\w\.]+)/i],
                    [p, [d, "Konqueror"]],
                    [/trident.+rv[: ]([\w\.]{1,9})\b.+like gecko/i],
                    [p, [d, "IE"]],
                    [/yabrowser\/([\w\.]+)/i],
                    [p, [d, "Yandex"]],
                    [/(avast|avg)\/([\w\.]+)/i],
                    [[d, /(.+)/, "$1 Secure Browser"], p],
                    [/\bfocus\/([\w\.]+)/i],
                    [p, [d, "Firefox Focus"]],
                    [/\bopt\/([\w\.]+)/i],
                    [p, [d, "Opera Touch"]],
                    [/coc_coc\w+\/([\w\.]+)/i],
                    [p, [d, "Coc Coc"]],
                    [/dolfin\/([\w\.]+)/i],
                    [p, [d, "Dolphin"]],
                    [/coast\/([\w\.]+)/i],
                    [p, [d, "Opera Coast"]],
                    [/miuibrowser\/([\w\.]+)/i],
                    [p, [d, "MIUI Browser"]],
                    [/fxios\/([-\w\.]+)/i],
                    [p, [d, "Firefox"]],
                    [/\bqihu|(qi?ho?o?|360)browser/i],
                    [[d, "360 Browser"]],
                    [/(oculus|samsung|sailfish)browser\/([\w\.]+)/i],
                    [[d, /(.+)/, "$1 Browser"], p],
                    [/(comodo_dragon)\/([\w\.]+)/i],
                    [[d, /_/g, " "], p],
                    [/(electron)\/([\w\.]+) safari/i, /(tesla)(?: qtcarbrowser|\/(20\d\d\.[-\w\.]+))/i, /m?(qqbrowser|baiduboxapp|2345Explorer)[\/ ]?([\w\.]+)/i],
                    [d, p],
                    [/(metasr)[\/ ]?([\w\.]+)/i, /(lbbrowser)/i],
                    [d],
                    [/((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w\.]+);)/i],
                    [[d, F], p],
                    [/safari (line)\/([\w\.]+)/i, /\b(line)\/([\w\.]+)\/iab/i, /(chromium|instagram)[\/ ]([-\w\.]+)/i],
                    [d, p],
                    [/\bgsa\/([\w\.]+) .*safari\//i],
                    [p, [d, "GSA"]],
                    [/headlesschrome(?:\/([\w\.]+)| )/i],
                    [p, [d, "Chrome Headless"]],
                    [/ wv\).+(chrome)\/([\w\.]+)/i],
                    [[d, "Chrome WebView"], p],
                    [/droid.+ version\/([\w\.]+)\b.+(?:mobile safari|safari)/i],
                    [p, [d, "Android Browser"]],
                    [/(chrome|omniweb|arora|[tizenoka]{5} ?browser)\/v?([\w\.]+)/i],
                    [d, p],
                    [/version\/([\w\.]+) .*mobile\/\w+ (safari)/i],
                    [p, [d, "Mobile Safari"]],
                    [/version\/([\w\.]+) .*(mobile ?safari|safari)/i],
                    [p, d],
                    [/webkit.+?(mobile ?safari|safari)(\/[\w\.]+)/i],
                    [d, [p, z, { "1.0": "/8", 1.2: "/1", 1.3: "/3", "2.0": "/412", "2.0.2": "/416", "2.0.3": "/417", "2.0.4": "/419", "?": "/" }]],
                    [/(webkit|khtml)\/([\w\.]+)/i],
                    [d, p],
                    [/(navigator|netscape\d?)\/([-\w\.]+)/i],
                    [[d, "Netscape"], p],
                    [/mobile vr; rv:([\w\.]+)\).+firefox/i],
                    [p, [d, "Firefox Reality"]],
                    [/ekiohf.+(flow)\/([\w\.]+)/i, /(swiftfox)/i, /(icedragon|iceweasel|camino|chimera|fennec|maemo browser|minimo|conkeror|klar)[\/ ]?([\w\.\+]+)/i, /(seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([-\w\.]+)$/i, /(firefox)\/([\w\.]+)/i, /(mozilla)\/([\w\.]+) .+rv\:.+gecko\/\d+/i, /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir|obigo|mosaic|(?:go|ice|up)[\. ]?browser)[-\/ ]?v?([\w\.]+)/i, /(links) \(([\w\.]+)/i],
                    [d, p]
                ],
                os: [
                    [/microsoft (windows) (vista|xp)/i],
                    [d, p],
                    [/(windows) nt 6\.2; (arm)/i, /(windows (?:phone(?: os)?|mobile))[\/ ]?([\d\.\w ]*)/i, /(windows)[\/ ]?([ntce\d\. ]+\w)(?!.+xbox)/i],
                    [d, [p, z, U]],
                    [/(win(?=3|9|n)|win 9x )([nt\d\.]+)/i],
                    [[d, "Windows"], [p, z, U]],
                    [/ip[honead]{2,4}\b(?:.*os ([\w]+) like mac|; opera)/i, /cfnetwork\/.+darwin/i],
                    [[p, /_/g, "."], [d, "iOS"]],
                    [/(mac os x) ?([\w\. ]*)/i, /(macintosh|mac_powerpc\b)(?!.+haiku)/i],
                    [[d, "Mac OS"], [p, /_/g, "."]],
                    [/droid ([\w\.]+)\b.+(android[- ]x86)/i],
                    [p, d],
                    [/(android|webos|qnx|bada|rim tablet os|maemo|meego|sailfish)[-\/ ]?([\w\.]*)/i, /(blackberry)\w*\/([\w\.]*)/i, /(tizen|kaios)[\/ ]([\w\.]+)/i, /\((series40);/i],
                    [d, p],
                    [/\(bb(10);/i],
                    [p, [d, k]],
                    [/(?:symbian ?os|symbos|s60(?=;)|series60)[-\/ ]?([\w\.]*)/i],
                    [p, [d, "Symbian"]],
                    [/mozilla\/[\d\.]+ \((?:mobile|tablet|tv|mobile; [\w ]+); rv:.+ gecko\/([\w\.]+)/i],
                    [p, [d, "Firefox OS"]],
                    [/web0s;.+rt(tv)/i, /\b(?:hp)?wos(?:browser)?\/([\w\.]+)/i],
                    [p, [d, "webOS"]],
                    [/crkey\/([\d\.]+)/i],
                    [p, [d, "Chromecast"]],
                    [/(cros) [\w]+ ([\w\.]+\w)/i],
                    [[d, "Chromium OS"], p],
                    [/(nintendo|playstation) ([wids345portablevuch]+)/i, /(xbox); +xbox ([^\);]+)/i, /\b(joli|palm)\b ?(?:os)?\/?([\w\.]*)/i, /(mint)[\/\(\) ]?(\w*)/i, /(mageia|vectorlinux)[; ]/i, /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-\/ ]?(?!chrom|package)([-\w\.]*)/i, /(hurd|linux) ?([\w\.]*)/i, /(gnu) ?([\w\.]*)/i, /\b([-frentopcghs]{0,5}bsd|dragonfly)[\/ ]?(?!amd|[ix346]{1,2}86)([\w\.]*)/i, /(haiku) (\w+)/i],
                    [d, p],
                    [/(sunos) ?([\w\.\d]*)/i],
                    [[d, "Solaris"], p],
                    [/((?:open)?solaris)[-\/ ]?([\w\.]*)/i, /(aix) ((\d)(?=\.|\)| )[\w\.])*/i, /\b(beos|os\/2|amigaos|morphos|openvms|fuchsia|hp-ux)/i, /(unix) ?([\w\.]*)/i],
                    [d, p]
                ]
            }
            , getBrowser = function() {
                var e, t = {};
                t.name = o;
                t.version = o;
                Z.call(t, n, r.browser);
                t.major = typeof (e = t.version) === c ? e.replace(/[^\d\.]/g, "").split(".")[0] : o;
                return t;
            }
            , getOS = function() {
                var e = {};
                e.name = o;
                e.version = o;
                Z.call(e, n, r.os);
                return e;
            }
            , getUA = function() {
                return n;
            };

            obj.browser = {
                ua: getUA(),
                browser: getBrowser(),
                os: getOS()
            };
            return obj.browser;
        }("object" == typeof window ? window : unsafeWindow);
    };

    obj.uuid = function () {
        var cna = localStorage.getItem("cna");
        if (cna) return cna;
        for (var i = function(e) {
            return "string" == typeof e && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i.test(e);
        }, s = [], l = 0; l < 256; ++l) s.push((l + 256).toString(16).substr(1));
        return function(e) {
            e[6] = 15 & e[6] | 64;
            e[8] = 63 & e[8] | 128;
            var t = (s[e[(t = 0) + 0]] + s[e[t + 1]] + s[e[t + 2]] + s[e[t + 3]] + "-" + s[e[t + 4]] + s[e[t + 5]] + "-" + s[e[t + 6]] + s[e[t + 7]] + "-" + s[e[t + 8]] + s[e[t + 9]] + "-" + s[e[t + 10]] + s[e[t + 11]] + s[e[t + 12]] + s[e[t + 13]] + s[e[t + 14]] + s[e[t + 15]]).toLowerCase();
            if (!i(t)) return null;
            localStorage.setItem("cna", t);
            return t;
        }(window.crypto.getRandomValues(new Uint8Array(16)));
    };

    obj.run = function() {
        obj.startObj((obj) => {obj.addPageFileList && obj.addPageFileList()});
        try {
            var url = location.href;
            if (url.indexOf(".aliyundrive.com/s/") > 0) {
                obj.filterNotice();
            }
            else if (url.indexOf(".aliyundrive.com/drive") > 0) {
                obj.customSharePwd();
            }
        } catch (e) { };
    }();

    console.log("=== 阿里云盘 好棒棒！===");

    // Your code here...
})();
