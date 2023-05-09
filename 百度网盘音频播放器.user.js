// ==UserScript==
// @name         百度网盘音频播放器
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.2
// @description  无视文件大小，无视文件格式，告别卡顿即点即播, 连歌词都帮你找好了
// @author       You
// @match        https://pan.baidu.com/disk/main*
// @connect      kugou.com
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// @require      https://cdn.staticfile.org/crypto-js/4.1.1/crypto-js.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.0/hls.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.js
// @resource     aplayerCSS https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.css
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @license      我本将心向明月，奈何明月照沟渠
// @antifeature  还在优化中你急个屌
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(GM_getResourceText("aplayerCSS"));
    var $ = $ || window.$;
    var obj = {
        audio_page: {
            fileList: [],
            fileIndex: 0
        }
    };

    obj.aplayerStart = function () {
        var aplayerNode, audioNode = document.querySelector(".nd-audio.normal").firstElementChild;
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

        var audio = [], fileList = obj.audio_page.fileList;
        fileList.forEach(function (item) {
            audio.push({
                name: item.server_filename,
                url: "/rest/2.0/xpan/file?method=streaming&path=" + encodeURIComponent(item.path) + "&type=M3U8_HLS_MP3_128",
                cover: item.categoryImageGrid || item.categoryImage,
                theme: obj.getRandomColor(),
                type: "customHls"
            });
        });

        try{
            const player = new window.APlayer({
                container: aplayerNode,
                audio: audio,
                customAudioType: {
                    customHls: function (audioElement, audio, player) {
                        const Hls = window.Hls;
                        if (Hls.isSupported()) {
                            const hls = player.hls = new Hls();
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
                lrcType: 1,
                mutex: true
            });
            player.on("listswitch", function ({index}) {
                player.hls && player.hls.destroy();
                obj.reprocessing(player, fileList, index);
            });
            player.on("destroy", function () {
                player.hls && player.hls.destroy();
            });
            const { list, template: { time, body } } = player;
            list.audios.length > 1 && list.index !== obj.audio_page.fileIndex ? list.switch(obj.audio_page.fileIndex) : setTimeout(() => { obj.reprocessing(player, fileList, 0) }, 100);
            $(time).children().css("display", "inline-block");
            $(body).prepend('<i data-v-33739aac="" class="iconfont icon-close" style="position: absolute;right: 9px;font-size: 12px;top: 5px;"></i><a href="https://afdian.net/a/vpannice" target="_blank" title="爱我你就点点我" style="position: absolute;right: 8px;font-size: 12px;top: 22px;"><img src="https://static.afdiancdn.com/favicon.ico" style="width: 14px;"></a>').children(".icon-close").one("click", function () {
                player.destroy();
            });
        } catch (error) {
            console.error("创建播放器错误", error);
        }
    };

    obj.reprocessing = function(player, fileList, index) {
        const { list, lrc, template: { author, pic } } = player;
        if (!(lrc.parsed[index] && lrc.parsed[index][0][1] !== "Not available")) {
            const { server_filename, size, md5 } = fileList[index];
            obj.queryLyrics(server_filename, size, md5).then(function (result) {
                const { proposal, candidates } = result;
                const candidate = candidates.filter(function (item) {
                    return proposal === item.id && item.lyrics || item.lyrics;
                })[0];
                if (candidate instanceof Object) {
                    lrc.parsed[index] = lrc.current = lrc.parse(candidate.lyrics);
                    lrc.container.innerHTML = lrc.parsed[index].map((item) => `<p>${item[1]}</p>`).join("\n");
                    lrc.container.getElementsByTagName("p").length && lrc.container.getElementsByTagName("p")[0].classList.add("aplayer-lrc-current");
                }
            }).catch(function () { });
            obj.songInfoKugou(md5).then(function (result) {
                const { data: { author_name, img } } = result;
                if (author_name) {
                    list.audios[index].artist = author_name;
                    author.innerText = "- " + author_name;
                }
                if (img) {
                    list.audios[index].cover = img;
                    pic.style.cssText = "background-image: url(" + img + ")";
                }
            }).catch(function () { });
        }
    };

    obj.queryLyrics = function (name, size, hash) {
        return obj.searchKugou(name, size, hash).then(function (result) {
            var promises = [];
            result.candidates.forEach(function (item, index) {
                promises.push(obj.downloadKugou(item.id, item.accesskey));
            });
            return Promise.allSettled(promises).then(function (results) {
                results.forEach(function (item, index) {
                    if (item.status == "fulfilled") {
                        var words = window.CryptoJS.enc.Base64.parse(item.value.content);
                        result.candidates[index].lyrics = window.CryptoJS.enc.Utf8.stringify(words);
                    }
                });
                return result;
            });
        });
    };

    obj.searchKugou = function (name, size, hash) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                type: "get",
                url: "https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=" + name + "&duration=" + size + "&hash=" + hash,
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    if (result && result.status == 200) {
                        resolve(result);
                    }
                    else {
                        reject(result);
                    }
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    };

    obj.downloadKugou = function (id, accesskey) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                type: "get",
                url: "https://lyrics.kugou.com/download?ver=1&client=pc&id=" + id + "&accesskey=" + accesskey + "&fmt=lrc&charset=utf8",
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    resolve(result);
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    };

    obj.songInfoKugou = function (hash) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                type: "get",
                url: "https://www.kugou.com/yy/index.php?r=play/getdata&hash=" + hash,
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    if (result && result.status == 1) {
                        resolve(result);
                    }
                    else {
                        reject(result);
                    }
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    };

    obj.ajax = function (option) {
        var details = {
            method: option.type || "get",
            url: option.url,
            responseType: option.dataType || "json",
            onload: function (result) {
                var response = result.response || result.responseText;
                if (parseInt(result.status / 100) == 2) {
                    option.success && option.success(response);
                }
                else {
                    option.error && option.error(response);
                }
            },
            onerror: function (result) {
                option.error && option.error(result.error);
            }
        };
        if (option.data) {
            if (option.data instanceof Object) {
                details.data = Object.keys(option.data).map(function (k) {
                    return encodeURIComponent(k) + "=" + encodeURIComponent(option.data[k]).replace("%20", "+");
                }).join("&");
            }
            else {
                details.data = option.data;
            }
            if (option.type.toUpperCase() == "GET") {
                details.url = option.url + (option.url.includes("?") ? "&" : "?") + details.data;
                delete details.data;
            }
        }
        if (option.headers) {
            details.headers = option.headers;
        }
        GM_xmlhttpRequest(details);
    };

    obj.getRandomColor = function() {
        return "#" + ("00000" + (Math.random() * 0x1000000 << 0).toString(16)).substr(- 6);
    };

    $(document.body).on("DOMNodeInserted", ".nd-audio.normal", function () {
        if (!this.only) {
            this.only = true;
            $(this).css("text-align", "left");
            const { bpAudio, fileList, fileMetaList } = this.__vue__;
            bpAudio.destroy();
            obj.audio_page.fileList = (document.querySelector(".nd-new-main-list")?.__vue__?.fileList || fileMetaList).filter(function(item, index) {
                return item.category === 2 || item.category === 6 && ["flac", "ape"].includes(item.server_filename.split(".").pop().toLowerCase());
            });
            obj.audio_page.fileIndex = obj.audio_page.fileList.findIndex(function (item, index) {
                return item.fs_id == fileList[0].fs_id;
            });
            obj.aplayerStart();
        }
    });

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
