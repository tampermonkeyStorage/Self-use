// ==UserScript==
// @name         阿里云盘
// @namespace    http://tampermonkey.net/
// @version      2.2.6
// @description  支持生成文件下载链接（多种下载姿势），支持第三方播放器DPlayer（支持自动/手动添加字幕，突破视频2分钟限制，选集，上下集，自动记忆播放，跳过片头片尾, 字幕设置随心所欲...），支持自定义分享密码，支持图片预览，...
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
            sub_info: {
                index: 0
            },
            file_id: "",
            elevideo: "",
            player: null,
            attributes: {},
            media_num: 0
        }
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
                "https://cdn.staticfile.org/hls.js/1.2.1/hls.min.js",
                "https://cdn.staticfile.org/dplayer/1.26.0/DPlayer.min.js",
            ],
            [
                "https://cdn.bootcdn.net/ajax/libs/hls.js/1.2.1/hls.min.js",
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

                if (obj.video_page.player) {
                    var video = obj.video_page.player.video;
                    obj.video_page.attributes = {
                        currentTime: video.currentTime,
                        muted: video.muted
                    };
                }
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
            if (obj.video_page.player && Object.keys(obj.video_page.attributes).length == 0) {
                return obj.playContinuously(quality);
            }
        }
        else {
            obj.suboffsettime = 0;
            obj.video_page.file_id = play_info.file_id;
            obj.video_page.attributes = {};
            obj.hasMemoryDisplay = false;
            obj.video_page.player = null;
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
                    text: "👍喜欢吗👍赞一个👍",
                    link: "https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png",
                },
            ],
            theme: obj.getRandomColor()
        };

        try {
            var player = obj.video_page.player = new unsafeWindow.DPlayer(options);

            var attributes = obj.video_page.attributes;
            if (Object.keys(attributes).length) {
                player.seek(attributes.currentTime - 1);
                player.video.muted = attributes.muted;
                obj.video_page.attributes = {};
            }

            obj.dPlayerEvents(player);
            obj.appreciation(player);
        } catch (error) {
            console.error("播放器创建失败", error);
        }
    };

    obj.playContinuously = function (quality) {
        var player = obj.video_page.player;
        player.options.video.quality = quality;
        player.quality = player.options.video.quality[player.qualityIndex];

        const paused = player.video.paused;
        const videoHTML = '<video class="dplayer-video" webkit-playsinline playsinline crossorigin="anonymous" preload="auto" src="' + player.quality.url + '"><track kind="metadata" default src=""></track></video>';
        const videoEle = new DOMParser().parseFromString(videoHTML, 'text/html').body.firstChild;
        player.template.videoWrap.insertBefore(videoEle, player.template.videoWrap.getElementsByTagName('div')[0]);
        player.prevVideo = player.video;
        player.video = videoEle;
        player.initVideo(player.video, player.quality.type || player.options.video.type);
        player.video.currentTime = player.prevVideo.currentTime + 1;

        player.on('canplaythrough', () => {
            if (player.prevVideo) {
                if (player.video.currentTime !== player.prevVideo.currentTime) {
                    player.video.currentTime = player.prevVideo.currentTime;
                }
                player.prevVideo.muted && (player.video.muted = player.prevVideo.muted);
                player.prevVideo.pause();
                player.template.videoWrap.removeChild(player.prevVideo);
                player.video.classList.add('dplayer-video-current');
                if (!paused) {
                    const bezelswitch = player.bezel.switch;
                    player.bezel.switch = () => {};
                    player.video.play();
                    player.controller.hide();
                    setTimeout(() => { player.bezel.switch = bezelswitch; }, 1000);
                }
                player.prevVideo = null;
                obj.dPlayerEvents(player);
            }
        });
    };

    obj.dPlayerEvents = function (player) {
        player = player || obj.video_page.player;
        if (!(player && player.video && player.video.duration > 0)) {
            return setTimeout(() => { obj.dPlayerEvents(player) }, 500);
        }

        player.options.hotkey || obj.dPlayerHotkey();

        obj.videoFit();
        obj.playSetting();
        obj.selectEpisode();

        obj.memoryPlay();
        obj.autoPlayNext();

        obj.addCueVideoSubtitle(function (textTracks) {
            textTracks && obj.selectSubtitles(textTracks);
            obj.suboffsettime && obj.subtitleOffset();
            player.subtitle.container.style.bottom = (localStorage.getItem("dplayer-subtitle-bottom") || 10) + "%";
            player.subtitle.container.style.color = localStorage.getItem("dplayer-subtitle-color") || "#ffd821";
            player.subtitle.container.style.fontSize = (localStorage.getItem("dplayer-subtitle-fontSize") || 5) + "vh";
        });

        player.on("quality_end", function () {
            localStorage.setItem("dplayer-quality", player.quality.name);
            obj.addCueVideoSubtitle();
        });

        player.speed(localStorage.getItem("dplayer-speed") || 1);
        player.on("ratechange", function () {
            player.notice("播放速度：" + player.video.playbackRate);
            localStorage.getItem("dplayer-speed") == player.video.playbackRate || localStorage.setItem("dplayer-speed", player.video.playbackRate);
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
    };

    obj.appreciation = function (player) {
        if (this.contextmenu_show) return;
        this.contextmenu_show = true;
        localStorage.getItem("appreciation_show") || localStorage.setItem("appreciation_show", Date.now());
        if (Date.now() - localStorage.getItem("appreciation_show") > 86400000 * 10) {
            setTimeout(() => {
                player.contextmenu.show(player.container.offsetWidth / 2.5, player.container.offsetHeight / 3);
            }, 60 * 1000);
        }
        document.querySelector("#dplayer .dplayer-menu-item").addEventListener('click', () => {
            player.contextmenu.hide();
            localStorage.setItem("appreciation_show", Date.now());
        });
    };

    obj.dPlayerHotkey = function () {
        if (window.dPlayerHotkey) return;
        window.dPlayerHotkey = true;

        document.addEventListener("keydown", (function(e) {
            var t = obj.video_page.player;
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

        document.addEventListener("wheel", function (event) {
            event = event || window.event;
            if ($(event.target).closest(".playlist-content").length) return;
            var o, t = obj.video_page.player;
            if (event.deltaY < 0) {
                o = t.volume() + .01;
                t.volume(o);
            } else if (event.deltaY > 0) {
                o = t.volume() - .01;
                t.volume(o);
            }
        })
    };

    obj.videoFit = function () {
        var file_id = obj.video_page.play_info.file_id;
        if ($(".dplayer-icons-right .btn-select-fit").length) {
            var vfit = sessionStorage.getItem("object-fit-" + file_id);
            if (vfit) {
                document.querySelector("video").style["object-fit"] = vfit;
                $(".btn-select-fit .dplayer-icon").text({
                    none: "原始大小",
                    cover: "自动裁剪",
                    fill: "拉伸填充",
                }[vfit]);
            }
            return
        };

        var html = '<div class="dplayer-quality btn-select-fit"><button class="dplayer-icon dplayer-quality-icon">画面模式</button><div class="dplayer-quality-mask"><div class="dplayer-quality-list"><div class="dplayer-quality-item" data-index="0">原始大小</div><div class="dplayer-quality-item" data-index="1">自动裁剪</div><div class="dplayer-quality-item" data-index="2">拉伸填充</div><div class="dplayer-quality-item" data-index="3">系统默认</div></div></div></div>';
        $(".dplayer-icons-right").prepend(html);

        $(".btn-select-fit .dplayer-quality-item").on("click", function() {
            var vfit = ["none", "cover", "fill", ""][$(this).attr("data-index")];
            document.querySelector("video").style["object-fit"] = vfit;
            $(".btn-select-fit .dplayer-icon").text($(this).text());
            sessionStorage.setItem("object-fit-" + file_id, vfit);
        });
    };

    obj.playSetting = function () {
        //将片头片尾放在设置里 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        if ($(".dplayer-setting-skipstart").length) return;

        var html = '<div class="dplayer-setting-item dplayer-setting-jumpend" style="display:none"><span class="dplayer-label" title="双击设置剩余时间为跳过片尾秒数">片尾(秒)</span><input type="text" name="dplayer-toggle" class="dplayer-toggle" style="height: 15px; font-size: 13px;border: 1px solid #fff;border-radius: 15px;"></div><div class="dplayer-setting-item dplayer-setting-jumpstart" style="display:none"><span class="dplayer-label" title="双击设置当前时间为跳过片头秒数">片头(秒)</span><input type="text" name="dplayer-toggle" class="dplayer-toggle" style="height: 15px; font-size: 13px;border: 1px solid #fff;border-radius: 15px;"></div><div class="dplayer-setting-item dplayer-setting-skipstart"><span class="dplayer-label">跳过片头片尾</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-skipstart" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        html += '<div class="dplayer-setting-item dplayer-setting-autoposition"><span class="dplayer-label">自动记忆播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input-autoposition" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>';
        $(".dplayer-setting-origin-panel").prepend(html);
        html = '<div class="dplayer-setting-item dplayer-setting-subtitle"><span class="dplayer-label">字幕设置</span></div></div>';
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
        var jumpstart = obj.getPlayMemory("jumpstart") || 60; // 默认跳过片头
        var jumpend = obj.getPlayMemory("jumpend") || 120; // 默认跳过片尾
        var skipstart = obj.getPlayMemory("skipstart");
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
            var skipstart = !check.is(":checked");
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

        $(".dplayer-setting-jumpstart, .dplayer-setting-jumpend").on("dblclick", function() {
            let currtime = 0, video = obj.video_page.player.video, duration = parseInt(video.duration), currentTime = parseInt(video.currentTime);
            if($(this).hasClass("dplayer-setting-jumpstart")){
                currtime = currentTime;
                obj.setPlayMemory("jumpstart", currtime);
            }
            else{
                currtime = duration - currentTime;
                obj.setPlayMemory("jumpend", currtime);
            }
            $(this).children("input").val(currtime)
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

    obj.selectEpisode = function () {
        //选集 代码贡献：https://greasyfork.org/zh-CN/users/795227-星峰
        if ($(".dplayer-icons-right #btn-select-episode").length) return;

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
            obj.video_page.play_info.file_id = file.file_id;
            obj.getVideoPreviewPlayInfo(function () {
                $(".header-file-name--CN_fq, .text--2KGvI").text(file.name);
            });
        });

        // 上下集
        $(".prev-icon").on("click", function () {
            var file = videoList[fileIndex - 1];
            file ? obj.playByFile(file) : obj.showTipError("没有上一集了");
        });
        $(".next-icon").on("click",function(){
            var file = videoList[fileIndex + 1];
            file ? obj.playByFile(file) : obj.showTipError("没有下一集了");
        });
    };

    obj.memoryPlay = function () {
        if (obj.hasMemoryDisplay) return;
        obj.hasMemoryDisplay = true;

        var jumpstart = obj.getPlayMemory("jumpstart") || 60; // 默认跳过片头
        var jumpend = obj.getPlayMemory("jumpend") || 120; // 默认跳过片尾
        var skipstart = obj.getPlayMemory("skipstart");

        var player = obj.video_page.player;
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
        var jumpstart = obj.getPlayMemory("jumpstart") || 60; // 默认跳过片头
        var jumpend = obj.getPlayMemory("jumpend") || 120; // 默认跳过片尾

        var playInfo = obj.video_page.play_info;
        var fileList = obj.file_page.items
        , videoList = fileList.filter(function (item, index) {
            return item.category == "video";
        })
        , fileIndex, file = videoList.find(function (item, index) {
            fileIndex = index;
            return item.file_id == playInfo.file_id;
        })
        , sign = file ? file.file_id : ""

        var player = obj.video_page.player, video = player.video, currentTime = video.currentTime, duration = video.duration;
        player.on("timeupdate", function () {
            var skipstart = obj.getPlayMemory("skipstart");
            if (!this.autonext && skipstart && jumpend > 0) {
                currentTime = video.currentTime;
                if (duration - currentTime <= parseInt(jumpend) + 10 * video.playbackRate) {
                    this.autonext = true;
                    obj.setPlayMemory(sign, currentTime + 20 * video.playbackRate, duration, jumpstart, jumpend);

                    var fileNext = videoList[fileIndex + 1];
                    if (fileNext) {
                        $(player.container).append('<div class="memory-play-wrap" style="display: block;position: absolute;left: 33px;bottom: 66px;font-size: 15px;padding: 7px;border-radius: 3px;color: #fff;z-index:100;background: rgba(0,0,0,.5);">10秒后自动下一集&nbsp;&nbsp;<a href="javascript:void(0);" class="play-jump" style="text-decoration: none;color: #06c;"> 取消 &nbsp;</a><em class="close-btn" style="display: inline-block;width: 15px;height: 15px;vertical-align: middle;cursor: pointer;background: url(https://nd-static.bdstatic.com/m-static/disk-share/widget/pageModule/share-file-main/fileType/video/img/video-flash-closebtn_15f0e97.png) no-repeat;"></em></div>');
                        var memoryTimeout = setTimeout(function () {
                            obj.playByFile(fileNext);
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
                    else {
                        obj.showTipError("没有下一集了");
                    }
                }
            }
        });
    };

    obj.selectSubtitles = function (textTracks) {
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

    obj.playByFile = function(file) {
        obj.video_page.play_info.file_id = file.file_id;
        obj.getVideoPreviewPlayInfo(function () {
            obj.video_page.player = null;
            obj.hasMemoryDisplay = false;
            $(".header-file-name--CN_fq, .text--2KGvI").text(file.name);
        });
    };

    obj.playByScroll = function() {
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
                var offsettime = obj.suboffsettime || 0;
                var offsetvalue = Number($(".offset-value").val()) || 5;
                if (value == "0") {
                    offsettime = 0;
                }
                else if (value == "1") {
                    offsettime -= offsetvalue;
                }
                else if (value == "2") {
                    offsettime += offsetvalue;
                }
                if(obj.offsettime == 0){
                    $(".offset-text").text("")
                }
                else{
                    $(".offset-text").text("["+ offsettime +"s]")
                }
                obj.suboffsettime = offsettime;
                obj.subtitleOffset();
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

    obj.subtitleOffset = function () {
        var video = document.querySelector("video");
        if (video) {
            var textTracks = video.textTracks;
            if (!(textTracks[0].cues && textTracks[0].cues.length)) return;

            var offsettime = obj.subOffsettime || 0;
            if (!offsettime) return;
            var fileId = obj.video_page.play_info.file_id
            , sub_info = obj.video_page.sub_info
            , subList = sub_info[fileId];
            if (!(subList && subList.length)) return;
            var index = sub_info.index || 0;
            var subitem = subList[index];
            if (subitem && subitem.sarr) {
                for(var i = textTracks[0].cues.length - 1; i >= 0; i--) {
                    textTracks[0].removeCue(textTracks[0].cues[i]);
                }
                subitem.sarr.forEach(function (item) {
                    /<b>.*<\/b>/.test(item.text) || (item.text = item.text.split(/\r?\n/).map((item) => `<b>${item}</b>`).join("\n"));
                    var textTrackCue = new VTTCue(item.startTime + offsettime, item.endTime + offsettime, item.text);
                    textTrackCue.id = item.index;
                    textTracks[0] && textTracks[0].addCue(textTrackCue);
                });
            }
        }
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

    obj.getVideoPreviewPlayInfo = function (callback) {
        obj.refresh_token(function (result) {
            if (result) {
                if (obj.isHomePage()) {
                    obj.get_video_preview_play_info(callback);
                }
                else {
                    obj.get_share_token(function (result) {
                        if (result) {
                            obj.get_share_link_video_preview_play_info(callback);
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
        var token = obj.getItem("token") || {}, share_id = obj.getShareId(), file_id = obj.video_page.play_info.file_id;
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
                console.error("get_share_link_video_preview_play_info error", error);
                callback && callback("");
            }
        });
    };

    obj.get_video_preview_play_info = function (callback) {
        var token = obj.getItem("token") || {}, file_id = obj.video_page.play_info.file_id;
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
                console.error("get_video_preview_play_info error", error);
                callback && callback("");
            }
        });
    };

    obj.isUrlExpires = function (e) {
        var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 6e3
        , n = e.match(/&x-oss-expires=(\d+)&/);
        return !n || n && n[1] && +"".concat(n[1], "000") - t < Date.now();
    };

    obj.addCueVideoSubtitle = function (callback) {
        obj.getSubList(function (sublist) {
            if (sublist && sublist.length) {
                var video = document.querySelector("video");
                if (video) {
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
                    if (textTrack && textTrack.cues && textTrack.cues.length) {
                        textTrack.mode = "showing";
                        obj.showTipSuccess("字幕添加成功");
                        callback && callback(textTracks);
                    }
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
                    if (Array.isArray(sarr)) {
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
    };

    obj.surlRequest = function (url, callback) {
        GM_xmlhttpRequest({
            method: "get",
            url : url,
            headers: {
                referer: "https://www.aliyundrive.com/"
            },
            responseType: "blob",
            onload: function(result) {
                if (result.status && parseInt(result.status / 100) == 2) {
                    var blob = result.response;
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
            if (["chi", "zho"].includes(item.language)) {
                chlist.push(item);
            }
            else {
                otherlist.push(item);
            }
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
        return window.instances[src];
    };

    obj.initDownloadSharePage = function () {
        if ($(".button-download--batch").length) {
            return;
        }
        if ($("#root [class^=banner] [class^=right]").length) {
            var html = '';
            html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi button-last--batch" style="margin-right: 28px;">继续上次播放</button>';
            html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi button-search--batch" style="margin-right: 28px;background: '+ obj.getRandomColor() +';">网盘资源搜索</button>';
            html += '<button class="button--2Aa4u primary--3AJe5 small---B8mi button-download--batch" style="margin-right: 28px;">显示链接</button>';
            $("#root [class^=banner] [class^=right]").prepend(html);

            $(".button-download--batch").on("click", obj.showDownloadSharePage);
            $(".button-last--batch").on("click", function () {
                obj.playByScroll();
            });
            $(".button-search--batch").on("click", function () {
                $(this).css("background", obj.getRandomColor());
                var folderName = "", fileInfo = obj.file_page.file_info;
                if (fileInfo.type == "folder") {
                    folderName = fileInfo.name;
                }
                window.open("https://www.niceso.fun/search/?q=" + folderName, "_blank");
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
            html += '<div style="margin:0px 8px;"></div><button class="button--2Aa4u primary--3AJe5 small---B8mi button-search--batch" style="background: '+ obj.getRandomColor() +';">网盘资源搜索</button>';
            html += '<div style="margin:0px 8px;"></div><button class="button--2Aa4u primary--3AJe5 small---B8mi button-download--batch">显示链接</button>';
            $("#root header:eq(0)").append(html);
            $(".button-download--batch").on("click", obj.showDownloadHomePage);
            $(".button-search--batch").on("click", function () {
                $(this).css("background", obj.getRandomColor());
                var folderName = "", fileInfo = obj.file_page.file_info;
                if (fileInfo.type == "folder") {
                    folderName = fileInfo.name;
                }
                window.open("https://www.niceso.fun/search/?q=" + folderName, "_blank");
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
            obj.hideTip();
            obj.showBox(fileList);
        });
    };

    obj.showDownloadHomePage = function () {
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
                var folderName = $(".breadcrumb-wrap--2iqqe,.breadcrumb--1J7mk").children(":first").children(":last").attr('data-label');
                var content = "#EXTM3U\r\n";
                content += "#EXTVLCOPT:http-referrer=https://www.aliyundrive.com/\r\n";
                fileList.forEach(function (item, index) {
                    if (item.category == "video") {
                        content += [ "#EXTINF:0," + item.name, item.download_url ].join("\r\n") + "\r\n";
                    }
                });
                obj.downloadFile(content, (folderName || "M3U 导出文件") + ".m3u");
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

    obj.newTabOpen = function () {
        var open = unsafeWindow.open;
        unsafeWindow.open = function (url, name, specs, replace) {
            name == "_blank" || (name = "_blank");
            return open(url, name, specs, replace);
        }
    };

    obj.tidyPageFileList = function () {
        (function(open) {
            XMLHttpRequest.prototype.open = function() {
                if (!this._hooked) {
                    this._hooked = true;
                    setupHook(this);
                }
                open.apply(this, arguments);
            }
        })(XMLHttpRequest.prototype.open);

        function setupHook(xhr) {
            (function setup() {
                Object.defineProperty(xhr, "response", {
                    get: function () {
                        delete xhr.response;
                        var responseURL = xhr.responseURL, response = xhr.response;
                        if (responseURL.includes("/file/list") || responseURL.includes("/file/search")) {
                            if (response && response.items && response.items.length > 1 && window.parent_file_id != response.items[0].parent_file_id) {
                                response.items.sort(obj.sortByName);
                                document.querySelector("#root") && (document.querySelector("#root").onclick = function () {
                                    document.querySelector("#root").onclick = null;
                                    window.parent_file_id = response.items[0].parent_file_id;
                                });
                            }

                            response && response.items && response.items.forEach(function (item) {
                                if (item.category == "video") {
                                    if (["ts", "f4v", "asf"].includes(item.file_extension)) {
                                        item.file_extension = "mp4";
                                    }
                                }
                                else if (item.category == "audio") {
                                    if (["ape"].includes(item.file_extension)) {
                                        item.file_extension = "mp3";
                                    }
                                }
                            });
                        }
                        else if (responseURL.includes("/file/get")) {
                            if (response && response.category == "video") {
                                if (["ts", "f4v", "asf"].includes(response.file_extension)) {
                                    response.file_extension = "mp4";
                                }
                            }
                        }
                        setup();
                        return response;
                    },
                    set: function () { },
                    configurable: true
                });
            })();
        }
    };

    obj.sortByName = function (n, i) {
        const a = n.name.split(".").slice(0, -1).join(".").match(/(\d+)/g);
        const b = i.name.split(".").slice(0, -1).join(".").match(/(\d+)/g);
        if (a && b) {
            return +a[0] > +b[0] ? 1 : +b[0] > +a[0] ? -1 : +a[1] > +b[1] ? 1 : +b[1] > +a[1] ? -1 : +a[2] > +b[2] ? 1 : +b[2] > +a[2] ? -1 : 0;
        }
        return n > i ? 1 : i > n ? -1 : 0;
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
        var match = url.match(/aliyundrive\.com\/s\/([a-zA-Z\d]+)/);
        return match ? match[1] : null;
    };

    obj.getRandomColor = function() {
        return "#" + ("00000" + (Math.random() * 0x1000000 << 0).toString(16)).substr(- 6);
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

                                obj.autoLastBtn();
                                obj.picturePreview();
                            }
                        }
                    }
                    else if (responseURL.indexOf("/file/get_share_link_video_preview_play_info") > 0) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object) {
                            obj.video_page.play_info = response;

                            obj.useDPlayer();
                        }
                    }
                    else if (responseURL.indexOf("/file/get_video_preview_play_info") > 0) {
                        try { response = JSON.parse(response) } catch (error) { };
                        if (response instanceof Object) {
                            obj.video_page.play_info = response;

                            var info = response.video_preview_play_info
                            , list = info.live_transcoding_task_list;
                            if (list[0].hasOwnProperty("preview_url")) {
                                obj.get_share_link_video_preview_play_info(function (response) {
                                    response || obj.showTipError("播放信息获取失败 请刷新重试", 10000);
                                });
                                return;
                            }

                            obj.useDPlayer();
                        }
                    }
                }
                else if (this.readyState == 4 && this.status == 403) {
                    if (obj.isUrlExpires(this.responseURL)) {
                        var media_num = (this.responseURL.match(/media-(\d+)\.ts/) || [])[1] || 0;
                        if (media_num > 0 && obj.video_page.media_num != media_num) {
                            obj.video_page.media_num = media_num;
                            obj.getVideoPreviewPlayInfo();
                        }
                    }
                }
            }, false);
            send.apply(this, arguments);
        };
    };

    obj.run = function() {
        obj.tidyPageFileList();
        obj.addPageFileList();

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
