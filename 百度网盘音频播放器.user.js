// ==UserScript==
// @name         百度网盘音频播放器
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.1
// @description  无视文件大小，无视文件格式，在线即点即播
// @author       You
// @match        https://pan.baidu.com/disk/main*
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// @grant        unsafeWindow
// @antifeature  还在优化中你急个屌
// ==/UserScript==

(function() {
    'use strict';

    var $ = $ || window.$;
    var obj = {
        audio_page: {
            fileList: [],
            fileIndex: 1
        }
    };

    obj.useAPlayer = function () {
        obj.aplayerSupport(function (result) {
            result && obj.aplayerStart();
        });
    };

    obj.aplayerSupport = function (callback) {
        var urlArr = [
            [
                "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.0/hls.min.js",
                "https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.js",
                "https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.css",
            ],
            [
                "https://unpkg.com/hls.js/dist/hls.min.js",
                "https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.js",
                "https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.css",
            ],
            [
                "https://cdn.jsdelivr.net/npm/hls.js/dist/hls.min.js",
                "https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.js",
                "https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.css",
            ]
        ];

        (function laodcdn(urlArr, index = 0) {
            var arr = urlArr[index];
            if (arr) {
                var promises = [];
                arr.forEach(function (url, index) {
                    var ext = url.split(".").pop();
                    if (ext === "js") {
                        promises.push(obj.loadScript(url));
                    }
                    else if (ext === "css") {
                        promises.push(obj.loadStyle(url));
                    }
                });

                Promise.all(promises).then(function(results) {
                    setTimeout(function () {
                        callback && callback(unsafeWindow.APlayer);
                    });
                }).catch(function(error) {
                    console.error(index, error);
                    laodcdn(urlArr, ++index);
                });
            }
            else {
                callback && callback(unsafeWindow.APlayer);
            }
        })(urlArr);
    };

    obj.aplayerStart = function () {
        var aplayerNode, audioNode = document.querySelector(".nd-audio").firstElementChild;
        if (audioNode) {
            aplayerNode = document.getElementById("aplayer");
            if (!aplayerNode) {
                aplayerNode = document.createElement("div");
                aplayerNode.setAttribute("id", "aplayer");
                audioNode.parentNode.replaceChild(aplayerNode, audioNode);
            }
        }
        else {
            return setTimeout(obj.aplayerStart, 500);
        }

        var audio = [];
        obj.audio_page.fileList.forEach(function (item) {
            audio.push({
                name: item.server_filename,
                artist: "",
                url: "/rest/2.0/xpan/file?method=streaming&path=" + encodeURIComponent(item.path) + "&type=M3U8_HLS_MP3_128",
                cover: item.categoryImage,
                theme: obj.getRandomColor(),
                type: "customHls"
            });
        });

        try{
            const player = new unsafeWindow.APlayer({
                container: aplayerNode,
                audio: audio,
                customAudioType: {
                    customHls: function (audioElement, audio, player) {
                        const Hls = unsafeWindow.Hls;
                        if (Hls.isSupported()) {
                            const hls = new Hls();
                            hls.loadSource(audio.url);
                            hls.attachMedia(audioElement);
                            hls.on(Hls.Events.ERROR, function (event, data) {
                                if (data.fatal) {
                                    switch(data.type) {
                                        case Hls.ErrorTypes.NETWORK_ERROR:
                                            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                                hls.loadSource(hls.url);
                                            }
                                            else {
                                                hls.startLoad();
                                            }
                                            break;
                                        case Hls.ErrorTypes.MEDIA_ERROR:
                                            hls.recoverMediaError();
                                            break;
                                        default:
                                            hls.destroy();
                                            break;
                                    }
                                }
                            });
                            player.on("destroy", function () {
                                hls.destroy();
                            });
                            player.on("listswitch", function () {
                                hls.destroy();
                                const { events } = player.events;
                                while (events.listswitch.length > 1) {
                                    events.listswitch.pop();
                                }
                            });
                        }
                        else if (audioElement.canPlayType("application/x-mpegURL") || audioElement.canPlayType("application/vnd.apple.mpegURL")) {
                            audioElement.src = audio.url;
                        }
                        else {
                            player.notice("Error: HLS is not supported.");
                        }
                    }
                },
                autoplay: true,
                mutex: true
            });
            const { list, template: { time, body } } = player;
            list.switch(obj.audio_page.fileIndex);
            $(time).children().css("display", "inline-block");
            $(body).prepend('<i data-v-33739aac="" class="iconfont icon-close" style="position: absolute;right: 9px;font-size: 12px;top: 5px;"></i><a href="https://afdian.net/a/vpannice" target="_blank" title="爱我你就点点我" style="position: absolute;right: 8px;font-size: 12px;top: 22px;"><img src="https://static.afdiancdn.com/favicon.ico" style="width: 14px;"></a>').children(".icon-close").one("click", function () {
                player.destroy();
            });
        } catch (error) {
            console.error("播放器创建失败", error);
        }
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

    obj.loadStyle = function (href) {
        if (!window.instances) {
            window.instances = {};
        }
        if (!window.instances[href]) {
            window.instances[href] = new Promise((resolve, reject) => {
                const style = document.createElement("link");
                style.type = "text/css";
                style.rel = "stylesheet";
                style.href = href;
                style.onload = resolve;
                style.onerror = reject;
                document.head.appendChild(style);
            });
        }
        return window.instances[href];
    };

    obj.getRandomColor = function() {
        return "#" + ("00000" + (Math.random() * 0x1000000 << 0).toString(16)).substr(- 6);
    };

    $(document.body).on("DOMNodeInserted", ".nd-audio", function () {
        if (!this.only) {
            this.only = true;
            $(this).css("text-align", "left");
            const { bpAudio, fileList, fileMetaList } = this.__vue__;
            bpAudio.destroy();
            obj.audio_page.fileList = fileMetaList.filter(function(item, index) {
                return item.category === 2;
            });
            obj.audio_page.fileIndex = obj.audio_page.fileList.findIndex(function (item, index) {
                return item.fs_id == fileList[0].fs_id;
            });
            obj.useAPlayer();
        }
    });

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();