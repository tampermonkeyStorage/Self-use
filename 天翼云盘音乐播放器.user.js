// ==UserScript==
// @name         天翼云盘音乐播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      0.2.0
// @description  一曲肝肠断，天涯何处觅知音
// @author       You
// @match        https://cloud.189.cn/web/*
// @connect      kugou.com
// @require      https://scriptcat.org/lib/1359/^1.1.3/piplyric.js
// @require      https://scriptcat.org/lib/3746/^1.1.0/audioPlayer.js
// @require      https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.js
// @resource     aplayerCSS https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.css
// @icon         https://cloud.189.cn/web/logo.ico
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    /**
    歌词来源：酷狗音乐 https://www.kugou.com/
    画中画：网易云音乐 https://music.163.com/
    */

    var obj = {
        audio_page: {
            addStyle: false,
            currentPlayItem: {}
        }
    };

    obj.readyNodeInserted = function (selectors, parent = document) {
        const result = parent.querySelector(selectors);
        if (result) return Promise.resolve(result);

        return new Promise((resolve, reject) => {
            new MutationObserver((mutations, observer) => {
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
            }).observe(parent, { childList: true, subtree: true });
        });
    };

    obj.audioPlayerPage = function () {
        obj.insertAudioPlayer();
        obj.replaceNativeAudioPlayer();

        if (document.querySelector('.p-web')) {
            document.querySelector('.p-web').__vue__.$router.afterHooks.push(() => setTimeout(obj.audioPlayerPage, 500));
        }
    };

    obj.insertAudioPlayer = function () {
        const addPlayer = ({ fileList }) => {
            if (!(Array.isArray(fileList) && fileList.length)) return;

            const playbtn = document.querySelector('.p-micro-nav .advertising .audio-play-btn');
            const audioSome = fileList.some(item => item && item.mediaType == 2);
            if (audioSome) {
                if (playbtn) return;

                const newBtn = document.createElement('a');
                newBtn.href = 'javascript:;';
                newBtn.className = 'audio-play-btn';
                newBtn.title = '音乐播放';
                newBtn.style.cssText = 'width: 72px;height: 28px;font-size: 12px;line-height: 28px;text-align: center;border-radius: 15px;background-image: linear-gradient(45deg,#0073e3,#f80000);cursor: pointer;color: #fff;display: block;';
                newBtn.textContent = '音乐播放';

                const container = document.querySelector('.p-micro-nav .advertising');
                if (container) {
                    container.appendChild(newBtn);
                    newBtn.addEventListener('click', () => {
                        if (document.getElementById('aplayer')) {
                            return
                        }

                        obj.initAudioPlayer();
                    });
                }
            } else {
                playbtn && playbtn.parentNode.removeChild(playbtn);
            }
        };

        const file = document.querySelector('.file, .p-web section');
        if (file) {
            let vueInstance = file.__vue__;
            if (vueInstance) {
                addPlayer(vueInstance);
            }

            Object.defineProperty(file, '__vue__', {
                configurable: true,
                enumerable: true,
                get() {
                    return vueInstance;
                },
                set(value) {
                    vueInstance = value;
                    if (value) {
                        addPlayer(value);
                    }
                }
            });
        }
    };

    obj.replaceNativeAudioPlayer = function () {
        const node = document.querySelector('.content, .p-web');
        if (node) {
            const vueInstance = node.__vue__;
            vueInstance.BUS.$on('playAudio', currentPlayItem => {
                obj.audio_page.currentPlayItem = { ...currentPlayItem };

                const audioPlayer = vueInstance.$refs.audioPlayer;
                audioPlayer.player.setSrc('');
                audioPlayer.closeAudio();

                if (document.getElementById('aplayer')) {
                    return;
                }
                obj.initAudioPlayer();
            });
        }
    };

    obj.initAudioPlayer = function () {
        if (!obj.audio_page.addStyle) {
            obj.audio_page.addStyle = true;
            GM_addStyle(GM_getResourceText('aplayerCSS'));
        }

        let container = document.getElementById('aplayer');
        if (!container) {
            container = document.createElement('div');
            container.setAttribute('id', 'aplayer');
            container.setAttribute('style', 'background-color: #fafdff;position: fixed;z-index: 9999;width: 440px;bottom: 0;left: 0px;box-shadow: 0 0 10px #ccc;border-top-left-radius: 4px;border-top-right-radius: 4px;border: 1px solid #dedede;');
            Node.prototype.appendChild.call(document.body, container);
        }

        const filelist = document.querySelector('.file, .c-file-list').__vue__.fileList;
        const audiolist = filelist.filter(item => item.mediaType === 2);
        const audio = audiolist.map(file => {
            const { downloadUrl, fileId, fileName, icon = {}, md5, shareId, size } = file;
            return {
                artist: '',
                cover: icon.largeUrl,
                hash: md5,
                id: fileId,
                name: fileName,
                type: 'normal',
                url: downloadUrl,
                fileId,
                shareId,
                size
            };
        });
        const options = {
            audio,
            container,
            getUrl: (file) => {
                const { url, fileId, shareId } = file;
                if (url && !obj.isExpired(url)) return Promise.resolve(url);
                return obj.getFileDownloadUrl(fileId, shareId).then(url => {
                    file.url = url;
                    return url;
                });
            }
        };

        window.audioPlayer(options).then(player => {
            const { list } = player;
            if (!list) return;

            const findIndex = ({ fileId }) => fileId ? audio.findIndex(item => item.id === fileId) : -1;
            const { currentPlayItem } = obj.audio_page;
            const index = findIndex(currentPlayItem);
            if (index > -1) {
                list.switch(index);
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
        const url = 'https://cloud.189.cn/api/open/file/getFileDownloadUrl.action?noCache='.concat(Math.random(), '&fileId=', fileId, shareId ? '&dt=1&shareId=' + shareId : '');
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

    obj.isExpired = function (url) {
        const params = new URLSearchParams(url);
        const expired = params.get('expired');
        return expired < Date.now();
    };

    obj.run = function () {
        const url = location.href;
        if (url.indexOf('cloud.189.cn/web/share') > 0) {
            obj.readyNodeInserted('.content', document.body).then(node => {
                const timer = setInterval(() => {
                    const vueInstance = node.__vue__;
                    const { errorType, fileDetail = {} } = vueInstance;
                    if (errorType || fileDetail.success) {
                        clearInterval(timer);
                        if (errorType) return;
                        setTimeout(obj.audioPlayerPage);
                    }
                }, 500);
            });
        }
        else if (url.indexOf('cloud.189.cn/web/main') > 0) {
            obj.readyNodeInserted('.p-web', document.body).then(node => {
                setTimeout(obj.audioPlayerPage, 1e3);
            });
        }
    }();

    console.info("=== 天翼云盘 好棒棒 ===");

    // Your code here...
})();
