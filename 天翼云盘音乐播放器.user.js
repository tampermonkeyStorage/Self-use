// ==UserScript==
// @name         天翼云盘音乐播放器
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.0
// @description  一曲肝肠断，天涯何处觅知音
// @author       You
// @match        https://cloud.189.cn/web/*
// @connect      kugou.com
// @icon         https://cloud.189.cn/web/logo.ico
// @require      https://scriptcat.org/lib/513/2.0.0/ElementGetter.js
// @run-at       document-body
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    var obj = {
        audio_page: {
            fileList: [],
            fileIndex: -1,
            format: [
                ".mp3", ".wma", ".wav", ".midi", ".flac",
                ".ram", ".ra", ".mid", ".aac", ".m4a",
                /*".ape",*/ ".au", ".ogg", ".aif", ".aiff",
                ".snd", ".voc", ".mpa", ".lrc", ".cda",
                ".vqf", ".wvx", ".wmx", ".ttbl", ".ttpl", ".tta", ".tak", ".mpc"
            ]
        }
    };

    obj.playAudioSharePage = function () {
        obj.insertPrettyPlayerSharePage();
        obj.selectedFilePlayerSharePage();
    };

    obj.playAudioHomePage = function () {
        obj.insertPrettyPlayerHomePage();
        obj.replaceNativePlayerHomePage();
    };

    obj.insertPrettyPlayerSharePage = function () {
        obj.addedNodeReady(".file", function (elm) {
            Object.defineProperty(elm, "__vue__", {
                set(vue) {
                    vue && Array.isArray(vue.fileList) && obj.togglePlayBtn(vue.fileList);
                }
            });
        });
    };

    obj.selectedFilePlayerSharePage = function () {
        obj.addedNodeReady(".file ul", function (elm) {
            elm.addEventListener("click", function (event) {
                if (event.target.className.includes("file-item-name-fileName-span")) {
                    var fileItem = event.target.offsetParent?.__vue__?.fileItem || {};
                    if (fileItem.mediaType == 2 && obj.audio_page.format.includes("." + fileItem.fileType)) {
                        obj.audio_page.fileIndex = obj.audio_page.fileList.findIndex(function (item, index) {
                            return item.fileId == fileItem.fileId;
                        });
                        if (window.player) {
                            const { list, list: { audios, index } } = window.player;
                            if (audios[index].fileId != fileItem.fileId) {
                                list.switch(obj.audio_page.fileIndex);
                            }
                        }
                        else {
                            obj.useAPlayer();
                        }
                    }
                }
            }, true);
        });
    };

    obj.insertPrettyPlayerHomePage = function () {
        obj.addedNodeReady(".p-web section", function (elm) {
            Object.defineProperty(elm, "__vue__", {
                set(vue) {
                    vue && Array.isArray(vue.fileList) && obj.togglePlayBtn(vue.fileList);
                }
            });
        });
    };

    obj.replaceNativePlayerHomePage = function () {
        obj.addedNodeReady(".p-web-audioplayer", function (elm) {
            Object.defineProperty(elm, "__vue__", {
                set(vue) {
                    if (vue && vue.isShowPlayer) {
                        const { closeAudio, currentPlayItem, player: { node } } = vue;
                        node.setSrc("");
                        closeAudio();
                        obj.audio_page.fileIndex = (obj.audio_page.fileList || []).findIndex(function (item, index) {
                            return item.fileId == currentPlayItem.fileId;
                        });
                        obj.useAPlayer();
                    }
                }
            });
        });
    };

    obj.togglePlayBtn = function (fileList) {
        var playbtn = obj.query(".advertising .audio-play-btn");
        (obj.audio_page.fileList = fileList.filter(function (item, index) {
            return item.mediaType == 2 && obj.audio_page.format.includes("." + item.fileType);
        })).length ? playbtn || (obj.append(obj.query(".advertising"), '<a data-v-183098eb="" href="javascript:;" class="audio-play-btn" title="音乐播放" style="font-size: 15px;font-weight: bold;"> 音乐播放 </a>').onclick = obj.useAPlayer) : playbtn && obj.remove(playbtn);
    };

    obj.useAPlayer = function () {
        obj.aplayerSupport(function (result) {
            result && obj.aplayerStart();
        });
    };

    obj.aplayerSupport = function (callback) {
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
                Promise.all(promises).then(function (results) {
                    setTimeout(function () {
                        callback && callback(unsafeWindow.APlayer);
                    });
                }).catch(function (error) {
                    laodcdn(urlArr, ++index);
                });
            }
            else {
                callback && callback(unsafeWindow.APlayer);
            }
        })([
            [
                "https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.js",
                "https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.css"
            ],
            [
                "https://unpkg.com/aplayer/dist/APlayer.min.js",
                "https://unpkg.com/aplayer/dist/APlayer.min.css"
            ],
            [
                "https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.js",
                "https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.css"
            ]
        ]);
    };

    obj.aplayerStart = function () {
        var aplayerNode, audio = obj.audio_page.fileList;
        audio.forEach(function (item) {
            Object.assign(item, {
                name: item.fileName,
                url: item.downloadUrl || item.url,
                cover: item.icon.smallUrl,
                theme: obj.getRandomColor(),
                type: "custom"
            });
        });
        if (audio.length) {
            aplayerNode = document.getElementById("aplayer");
            if (aplayerNode) {
                window.player && window.player.destroy();
            }
            else {
                aplayerNode = document.createElement("div");
                aplayerNode.setAttribute("id", "aplayer");
                aplayerNode.setAttribute("style", "background-color: #fafdff;position: fixed;z-index: 9999;width: 440px;bottom: 0;left: 0px;box-shadow: 0 0 10px #ccc;border-top-left-radius: 4px;border-top-right-radius: 4px;border: 1px solid #dedede;");
                document.body.appendChild(aplayerNode);
            }
        }
        else {
            return ;
        }
        try{
            var player = window.player = new unsafeWindow.APlayer({
                container: aplayerNode,
                audio: audio,
                customAudioType: {
                    custom: function (audioElement, audio, player) {
                        if (audioElement instanceof Element) {
                            if (audio.url) {
                                audioElement.src = audio.url;
                            }
                            else {
                                obj.getMusicUrl(audio.fileId, audio.shareId).then(function (url) {
                                    try{
                                        audioElement.src = audio.url = url;
                                    } catch (error) { }
                                });
                            }
                            audioElement.oncanplay = function () {
                                player.play();
                            };
                            audioElement.onerror = function () {
                                if (player.prevErrorAudio && player.prevErrorAudio.fileId == audio.fileId) {
                                    player.notice(audio.fileName + " == 无法播放");
                                    const { list } = player;
                                    list.remove(list.index);
                                    obj.audio_page.fileList.splice(list.index, 1);
                                }
                                else {
                                    obj.getMusicUrl(audio.fileId, audio.shareId).then(function (url) {
                                        audioElement.src = audio.url = url;
                                        const { list } = player;
                                        list.switch(list.index);
                                        player.prevErrorAudio = audio;
                                    });
                                }
                            };
                        }
                    }
                },
                autoplay: true,
                order: "random",
                lrcType: 1,
                mutex: true
            });
            let image = [
                "https://wimg.588ku.com/gif620/21/08/19/98bc65b53f8b7f91e3fb091bd413ee87.gif",
                "https://wimg.588ku.com/gif620/19/08/22/e385a29ad529368de8cf650a18a195c6.gif",
                "https://wimg.588ku.com/gif620/21/03/05/d97bb525bf33390227171ad8fa374002.gif",
                "https://wimg.588ku.com/gif620/21/08/19/c42708c1bd3f26ddb7466dddf9492f77.gif",
                "https://wimg.588ku.com/gif620/20/07/22/a6b3fb60fff01b6fe3d6dd44aba08765.gif"
            ];
            player.on("listswitch", function ({ index }) {
                if (player.audio.oncanplay) {
                    obj.querySongInfo(player, index);
                    player.template.list.style.cssText += "background: url(" + image[Math.floor(Math.random() * image.length)] + ") center center / contain no-repeat;";
                }
            });
            player.on("destroy", function () {
                player.audio.oncanplay = null;
                player.audio.onerror = null;
                window.player.list.clear();
                window.player = null;
            });
            const { list, template: { time, body } } = player;
            const fileIndex = obj.audio_page.fileIndex;
            if (fileIndex > -1 && list.audios.length > 1 && list.index !== fileIndex) {
                setTimeout(() => { list.switch(fileIndex); }, 500);
            }
            else {
                obj.querySongInfo(player);
                player.template.list.style.cssText += "background: url(" + image[Math.floor(Math.random() * image.length)] + ") center center / contain no-repeat;";
            }
            [...time.children].forEach(element => {
                element.style.cssText += "display: inline-block;";
            });
            obj.append(body, '<button class="icon-close" style="position: absolute;top: 4px;right: 9px;padding: 0;background: 0 0;border: none;outline: 0;cursor: pointer;font-size: 16px;"><i class="close" style="font-size: 16px;color: #979797;font-weight: 700;">✖</i></button>').onclick = () => player.destroy();
            obj.append(body, '<a href="https://afdian.net/a/vpannice" target="_blank" title="爱我你就点点我" style="position: absolute;right: 8px;font-size: 12px;top: 24px;"><img src="https://static.afdiancdn.com/favicon.ico" style="width: 14px;"></a>');
        } catch (error) {
            console.error("播放器创建失败", error);
        }
    };

    obj.getMusicUrl = function (fileId, shareId) {
        return obj.getFileDownloadUrl(fileId, shareId).then(function (fileDownloadUrl) {
            return fileDownloadUrl;
        }, function () {
            return obj.getNewMusicUrl(fileId, shareId);
        });
    };

    obj.getFileDownloadUrl = function (fileId, shareId) {
        return unsafeWindow.axios({
            url: "https://cloud.189.cn/api/open/file/getFileDownloadUrl.action?fileId=" + fileId + (shareId ? "&dt=1&shareId=" + shareId : ""),
            headers: {
                Accept: "application/json;charset=UTF-8"
            }
        }).then(function ({ data }) {
            return data.fileDownloadUrl;
        });
    };

    obj.getNewMusicUrl = function (fileId) {
        return unsafeWindow.axios({
            url: "https://cloud.189.cn/api/open/file/getNewMusicUrl.action?noCache=" + Math.random() + "&fileId=" + fileId + "&short=true&forcedGet=0",
            headers: {
                Accept: "application/json;charset=UTF-8"
            }
        }).then(function ({ data }) {
            return data.fileDownloadUrl;
        });
    };

    obj.querySongInfo = function (player, index) {
        const { list, lrc, template: { pic, author } } = player;
        index || index === 0 || (index = list.index);
        if (lrc.parsed[index] && lrc.parsed[index].length > 1) return;
        const { fileName, md5, size } = list.audios[index] || {};
        obj.songinfoKugou(fileName, md5, size).then(function (result) { // 酷狗好棒棒，听歌来帮忙
            const { candidates, info, author_name, img } = result;
            const candidate = Array.isArray(candidates) ? candidates.find(function (item) {
                return item.lyrics;
            }) : Array.isArray(info) ? info.find(function (item) {
                return item.lyrics;
            }) : "";
            if (candidate && candidate.lyrics) {
                lrc.parsed[index] = lrc.current = lrc.parse(candidate.lyrics);
                lrc.container.innerHTML = lrc.parsed[index].map((item) => `<p>${item[1]}</p>`).join("\n");
                lrc.container.getElementsByTagName("p").length && lrc.container.getElementsByTagName("p")[0].classList.add("aplayer-lrc-current");
            }
            obj.getdataKugou(candidate.hash || md5).then(function (data) {
                const { author_name, img } = data;
                if (author_name) {
                    author.innerText = "- " + (list.audios[index].artist = author_name);
                }
                if (img) {
                    pic.style.cssText += "background-image: url(" + (list.audios[index].cover = img) + ")";
                }
            }).catch(function () { });
        }).catch(function (error) { });
    };

    obj.songinfoKugou = function (name, hash, size) {
        return obj.songinfohashKugou(name, hash, size).then(function (result) {
            return result;
        }, function () {
            return obj.songinfonameKugou(name, hash, size);
        });
    };

    obj.songinfohashKugou = function (name, hash, size) {
        return obj.searchhashKugou(name, hash, size).then(function (result) {
            var promises = [];
            result.candidates.slice(0, 3).forEach(function (item, index) {
                promises.push(obj.downloadhashKugou(item.id, item.accesskey));
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

    obj.searchhashKugou = function (name, hash, size) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=&duration=&hash=" + hash,
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    if (result && result.status == 200 && result.proposal !== "0") {
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

    obj.downloadhashKugou = function (id, accesskey) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
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

    obj.songinfonameKugou = function (name, hash, size) {
        return obj.searchnameKugou(name, hash, size).then(function (result) {
            var promises = [];
            result.info.slice(0, 3).forEach(function (item, index) {
                promises.push(obj.krcKugou(item.hash));
            });
            return Promise.allSettled(promises).then(function (results) {
                results.forEach(function (item, index) {
                    if (item.status == "fulfilled") {
                        result.info[index].lyrics = item.value;
                    }
                });
                return result;
            });
        });
    };

    obj.searchnameKugou = function (name, hash, size) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "https://mobilecdn.kugou.com/api/v3/search/song?pagesize=20&keyword=" + name,
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    if (result && result.status == 1 && result.data.total) {
                        resolve(result.data);
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

    obj.krcKugou = function (hash) {
        return obj.surlRequest("https://m.kugou.com/app/i/krc.php?cmd=100&timelength=999999&hash=" + hash);
    };

    obj.getdataKugou = function (hash) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "https://www.kugou.com/yy/index.php?r=play/getdata&hash=" + hash,
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    if (result && result.status == 1) {
                        resolve(result.data);
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

    obj.surlRequest = function (url) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url : url,
                dataType: "blob",
                success: function (blob) {
                    var reader = new FileReader();
                    reader.readAsText(blob, "UTF-8");
                    reader.onload = function (e) {
                        resolve(reader.result);
                    };
                    reader.onerror = function (e) {
                        reject(e);
                    };
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
                Node.prototype.appendChild.call(document.head, script);
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
                Node.prototype.appendChild.call(document.head, style);
            });
        }
        return window.instances[href];
    };

    obj.getRandomColor = function () {
        return "#" + ("00000" + (Math.random() * 0x1000000 << 0).toString(16)).substr(-6);
    };

    obj.addedNodeReady = function (selector, callback) {
        const element = obj.query(selector);
        if (element) {
            callback && callback(element);
        }
        else {
            const observer = new MutationObserver(function (mutationsList, observer) {
                for (const mutation of mutationsList) {
                    if (mutation.addedNodes.length) {
                        for (const node of mutation.addedNodes) {
                            if (node instanceof Element) {
                                const targetNode = obj.query(selector, node.parentElement || node.parentNode || document);
                                if (targetNode) {
                                    observer.disconnect();
                                    callback(targetNode);
                                    break;
                                }
                                continue;
                            }
                        }
                    }
                    else {
                        continue;
                    }
                }
            });
            observer.observe(document, { childList: true, subtree: true });
        }
    };

    obj.query = function (selector, parent = document) {
        return parent.querySelector(selector);
    };

    obj.append = function (parent, child) {
        if (child instanceof Element) {
            Node.prototype.appendChild.call(parent, child);
        }
        else {
            parent.insertAdjacentHTML("beforeend", String(child));
        }
        return parent.lastElementChild || parent.lastChild;
    };

    obj.prepend = function (parent, child) {
        if (child instanceof Element) {
            Node.prototype.appendChild.call(parent, child);
        }
        else {
            parent.insertAdjacentHTML("afterbegin", String(child));
        }
        return parent.firstElementChild || parent.firstChild;
    };

    obj.remove = function (child) {
        return Node.prototype.removeChild.call(child?.parentNode || document, child);
    };

    obj.run = function () {
        var url = location.href;
        if (url.indexOf("cloud.189.cn/web/share") > 0) {
            obj.playAudioSharePage();
        }
        else if (url.indexOf("cloud.189.cn/web/main/file") > 0) {
            obj.playAudioHomePage();
        }
    }();

    console.log("=== 天翼云盘 好棒棒 ===");

    // Your code here...
})();
