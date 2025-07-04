// ==UserScript==
// @name         天翼云盘音乐播放器
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.1
// @description  一曲肝肠断，天涯何处觅知音
// @author       You
// @match        https://cloud.189.cn/web/*
// @connect      kugou.com
// @require      https://scriptcat.org/lib/1359/^1.1.0/PipLyric.js
// @require      https://scriptcat.org/lib/3746/^1.0.0/audioPlayer.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.js
// @resource     aplayerCSS https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.css
// @icon         https://cloud.189.cn/web/logo.ico
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    var obj = {
        audio_page: {
            currentPlayItem: {},
            format: [
                ".mp3", ".wma", ".wav", ".midi", ".flac",
                ".ram", ".ra", ".mid", ".aac", ".m4a",
                /*".ape",*/ ".au", ".ogg", ".aif", ".aiff",
                ".snd", ".voc", ".mpa", ".lrc", ".cda",
                ".vqf", ".wvx", ".wmx", ".ttbl", ".ttpl", ".tta", ".tak", ".mpc"
            ]
        }
    };

    obj.readyNodeInserted = function (selectors, parent = document) {
        const result = parent.querySelector(selectors);
        if (result) return Promise.resolve(result);

        return new Promise((resolve, reject) => {
            const observer = new MutationObserver((mutations, observer) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node instanceof HTMLElement) {
                            const result = node.matches(selectors) ? node : parent.querySelector(selectors);
                            if (result) {
                                observer.disconnect();
                                return resolve(result);
                            }
                        }
                    }
                }
            });
            observer.observe(parent, { childList: true, subtree: true });
        });
    };

    obj.audioPlayerPage = function () {
        obj.insertAudioPlayer();
        obj.replaceNativeAudioPlayer();

        if (document.querySelector(".p-web")) {
            document.querySelector(".p-web").__vue__.$router.afterHooks.push(() => {
                setTimeout(obj.audioPlayerPage, 500);
            });
        }
    };

    obj.insertAudioPlayer = function () {
        const addPlaybtn = ({ fileList }) => {
            if (Array.isArray(fileList)) {
                const playbtn = document.querySelector(".p-micro-nav .advertising .audio-play-btn");
                const length = fileList.filter(item => {
                    return item.mediaType == 2 && obj.audio_page.format.includes('.' + item.fileType);
                }).length;

                if (length) {
                    if (playbtn) return;

                    const newBtn = document.createElement("a");
                    newBtn.href = "javascript:;";
                    newBtn.className = "audio-play-btn";
                    newBtn.title = "音乐播放";
                    newBtn.style.cssText = "width: 72px;height: 28px;font-size: 12px;line-height: 28px;text-align: center;border-radius: 15px;background-image: linear-gradient(45deg,#0073e3,#f80000);cursor: pointer;color: #fff;display: block;";
                    newBtn.textContent = "音乐播放";

                    const container = document.querySelector(".p-micro-nav .advertising");
                    if (container) {
                        container.appendChild(newBtn);
                        newBtn.addEventListener("click", () => {
                            if (document.getElementById('aplayer')) {
                                return
                            }

                            obj.initAudioPlayer();
                        });
                    }
                } else if (playbtn) {
                    playbtn.parentNode.removeChild(playbtn);
                }
            }
        };

        const file = document.querySelector(".file, .p-web section");
        if (file) {
            let vueInstance = file.__vue__;
            if (vueInstance) {
                addPlaybtn(vueInstance);
            }

            Object.defineProperty(file, "__vue__", {
                configurable: true,
                enumerable: true,
                get() {
                    return vueInstance;
                },
                set(value) {
                    vueInstance = value;
                    if (value) {
                        addPlaybtn(value);
                    }
                }
            });
        }
    };

    obj.replaceNativeAudioPlayer = function () {
        const node = document.querySelector(".content, .p-web");
        if (node) {
            const vueInstance = node.__vue__;
            vueInstance.BUS.$on("playAudio", currentPlayItem => {
                obj.audio_page.currentPlayItem = {...currentPlayItem};

                const audioPlayer = vueInstance.$refs.audioPlayer;
                audioPlayer.player.setSrc('');
                audioPlayer.closeAudio();

                if (document.getElementById('aplayer')) {
                    return
                }
                obj.initAudioPlayer();
            });
        }
    };

    obj.initAudioPlayer = function () {
        let container = document.getElementById('aplayer');
        if (!container) {
            container = document.createElement('div');
            container.setAttribute('id', 'aplayer');
            container.setAttribute('style', 'background-color: #fafdff;position: fixed;z-index: 9999;width: 440px;bottom: 0;left: 0px;box-shadow: 0 0 10px #ccc;border-top-left-radius: 4px;border-top-right-radius: 4px;border: 1px solid #dedede;');
            Node.prototype.appendChild.call(document.body, container);
        }

        const audio = [];
        try {
            document.querySelector('.file, .c-file-list').__vue__.fileList.forEach(item => {
                if (item.mediaType === 2) {
                    audio.push({
                        ...item,
                        hash: item.md5,
                        id: item.fileId,
                        name: item.fileName,
                        url: item.downloadUrl || item.url,
                        cover: item.icon.smallUrl,
                        type: 'normal'
                    });
                }
            });
        } catch (error) {
        }

        const options = {
            container,
            audio,
            getUrl: ({ fileId, shareId }) => obj.getFileDownloadUrl(fileId, shareId),
            type: 'normal'
        };

        window.audioPlayer(options).then(ap => {
            const { list } = ap;
            const findIndex = ({ fileId }) => fileId ? audio.findIndex(item => item.id === fileId) : -1;
            const { currentPlayItem } = obj.audio_page;
            const index = findIndex(currentPlayItem);
            if (index > -1) {
                setTimeout(() => list.switch(index), 1e3);
            }

            Object.defineProperty(obj.audio_page, 'currentPlayItem', {
                set(value) {
                    if (value) {
                        const index = findIndex(value);
                        if (index > -1) {
                            list.switch(index);
                        }
                    }
                }
            });
        });
    };

    obj.getFileDownloadUrl = function (fileId, shareId) {
        let url = 'https://cloud.189.cn/api/open/file/getFileDownloadUrl.action?noCache='.concat(Math.random(), '&fileId=', fileId);
        if (shareId) {
            url += '&dt=1&shareId=' + shareId
        }
        return fetch(url, {
            headers: {
                accept: 'application/json;charset=UTF-8'
            }
        }).then(res => res.json()).then(t => {
            if (0 === t.res_code) {
                return t.fileDownloadUrl;
            }
            return Promise.reject();
        });
    };

    obj.run = function () {
        GM_addStyle(GM_getResourceText("aplayerCSS"));

        var url = location.href;
        if (url.indexOf("cloud.189.cn/web/share") > 0) {
            obj.readyNodeInserted('.content', document.body).then(node => {
                setTimeout(obj.audioPlayerPage, 1e3);
            });
        }
        else if (url.indexOf("cloud.189.cn/web/main") > 0) {
            obj.readyNodeInserted('.p-web', document.body).then(node => {
                setTimeout(obj.audioPlayerPage, 1e3);
            });
        }
    }();

    console.info("=== 天翼云盘 好棒棒 ===");

    // Your code here...
})();
