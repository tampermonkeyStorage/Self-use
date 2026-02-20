// ==UserScript==
// @name         百度网盘音频播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      0.4.1
// @description  无视文件大小，无视文件格式，告别卡顿即点即播，自动加载歌词，画中画歌词
// @author       You
// @match        http*://yun.baidu.com/s/*
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/disk/main*
// @connect      kugou.com
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @require      https://scriptcat.org/lib/1359/^1.1.3/piplyric.js
// @require      https://scriptcat.org/lib/3608/^1.0.0/audioAnalyzer.js
// @require      https://scriptcat.org/lib/3746/^1.1.0/audioPlayer.js
// @require      https://unpkg.com/hls.js@1.6.15/dist/hls.min.js
// @require      https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.js
// @resource     aplayerCSS https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.css
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
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
            currentFileMeta: {}
        }
    };

    obj.readyState = function () {
        return new Promise((resolve, reject) => {
            if (document.readyState === 'complete') {
                setTimeout(resolve);
                return;
            }
            document.onreadystatechange = () => {
                if (document.readyState === 'complete') {
                    document.onreadystatechange = null;
                    setTimeout(resolve);
                }
            };
        });
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

    obj.initAudioSharePage = function () {
        if (/(链接|页面)不存在/.test(document.title)) return;
        if (unsafeWindow.SHAREPAGETYPE === 'single_file_page') {
            const audioSome = unsafeWindow.locals.get('file_list').some(item => item && item.category === 2);
            if (audioSome) {
                obj.initAudioPlayerSharePage();
                return;
            }
        }
        if (unsafeWindow.SHAREPAGETYPE === 'multi_file') {
            const currentList = unsafeWindow.require('system-core:context/context.js').instanceForSystem.list.getCurrentList();
            if (!(currentList && currentList.length)) {
                setTimeout(obj.initAudioSharePage, 500);
                return;
            }
            const audioNode = document.querySelector('.audio-play-btn');
            const audioSome = currentList.some(item => item.category === 2 || item.category === 6 && ['ape'].includes(item.server_filename.split('.').pop().toLowerCase()));
            if (!audioSome) {
                audioNode && audioNode.remove();
                return;
            }
            if (audioNode) return;
            const parentNode = document.querySelector('.vyQHNyb');
            if (parentNode) {
                const newBtn = document.createElement('span');
                newBtn.className = 'cMEMEF audio-play-btn';
                newBtn.innerHTML = '<a href="javascript:;" title="音乐播放" node-type="audio-play" style="color:#fff;">音乐播放</a>';
                newBtn.style.cssText = 'font-weight: 700;padding: 0 16px;height: 32px;line-height: 32px;font-size: 14px;border-radius: 16px;margin: 0;background-image: linear-gradient(45deg,#5e00ff,#ff0010);';
                parentNode.prepend(newBtn);
                newBtn.addEventListener('click', () => {
                    if (document.getElementById('aplayer')) {
                        alert('已存在一个音频播放器！');
                        return;
                    }
                    obj.initAudioPlayerSharePage();
                });
            }
        }
    };

    obj.initAudioPlayerSharePage = function () {
        if (!obj.audio_page.addStyle) {
            obj.audio_page.addStyle = true;
            GM_addStyle(GM_getResourceText('aplayerCSS'));
        }
        let container = document.getElementById('aplayer');
        if (!container) {
            container = document.createElement('div');
            container.setAttribute('id', 'aplayer');
            const audioNode = document.querySelector('.share-file-viewer');
            if (audioNode) {
                while (audioNode.nextSibling) {
                    audioNode.parentNode.removeChild(audioNode.nextSibling);
                }
                container.setAttribute('style', 'background-color: #fafdff;box-shadow: 0 0 10px #ccc;border-top-left-radius: 4px;border-top-right-radius: 4px;border: 1px solid #dedede;');
                audioNode.parentNode.replaceChild(container, audioNode);
            }
            else {
                container.setAttribute('style', 'background-color: #fafdff;position: fixed;z-index: 999;width: 440px;bottom: 0;left: 24px;box-shadow: 0 0 10px #ccc;border-top-left-radius: 4px;border-top-right-radius: 4px;border: 1px solid #dedede;');
                Node.prototype.appendChild.call(document.body, container);
            }
        }

        unsafeWindow.locals.get('sign', 'timestamp', 'share_uk', 'shareid', (sign, stamp, shareUK, shareid) => {
            const vip = obj.getVip();
            const getUrl = (fs_id, type = 'M3U8_MP3_128') => {
                return '/share/streaming?channel=chunlei&uk=' + shareUK + '&fid=' + fs_id + '&sign=' + sign + '&timestamp=' + stamp + '&shareid=' + shareid + '&type=' + type + '&vip=' + vip + '&jsToken=' + unsafeWindow.jsToken;
            };
            const filelist = (() => {
                if (unsafeWindow.SHAREPAGETYPE === 'single_file_page') {
                    return unsafeWindow.locals.get('file_list');
                }
                if (unsafeWindow.SHAREPAGETYPE === 'multi_file') {
                    const { getSelected, getCurrentList } = unsafeWindow.require('system-core:context/context.js').instanceForSystem.list;
                    const filelist = getSelected();
                    if (filelist.length) {
                        return filelist;
                    }
                    return getCurrentList();
                }
                return [];
            })();
            const audiolist = filelist.filter(item => item.category === 2 || item.category === 6 && ['ape'].includes(item.server_filename.split('.').pop().toLowerCase()));
            const audio = audiolist.map(file => {
                const { duration, fs_id, md5, server_filename, meta_info = '{}', size } = file;
                const { artistName, trackTitle = server_filename } = JSON.parse(meta_info);
                return {
                    artist: artistName,
                    cover: 'https://staticwx.cdn.bcebos.com/mini-program/images/ic_audio_v2.png',
                    duration,
                    hash: md5,
                    id: fs_id,
                    name: trackTitle,
                    type: 'hls',
                    url: getUrl(fs_id),
                    size
                };
            });
            const options = {
                container,
                audio
            };
            window.audioPlayer(options);
        });
    };

    obj.initAudioMainPage = function () {
        obj.insertAudioPlayerMainPage();
        obj.replaceAudioPlayerMainPage();
        unsafeWindow.globalVue.$router.afterHooks.push(() => {
            setTimeout(obj.initAudioMainPage, 500);
        });
    };

    obj.insertAudioPlayerMainPage = function () {
        const addPlayer = ({ fileList }) => {
            if (!(Array.isArray(fileList) && fileList.length)) return;
            const audioNode = document.querySelector('.audio-play-btn');
            const audioSome = fileList.some(item => item.category === 2 || item.category === 6 && ['ape'].includes(item.server_filename.split('.').pop().toLowerCase()));
            if (!audioSome) {
                audioNode && audioNode.remove();
                return;
            }
            if (audioNode) return;
            const parentNode = document.querySelector('.wp-s-header__right');
            if (parentNode) {
                const newBtn = document.createElement('button');
                newBtn.className = 'u-button u-button--primary audio-play-btn';
                newBtn.title = '音乐播放';
                newBtn.innerHTML = '<i class="u-icon-play"></i><span>音乐播放</span>';
                newBtn.style.cssText = 'font-weight: 700;padding: 8px 16px;height: 32px;font-size: 14px;border-radius: 16px;order: 1;margin-left: 12px;background-image: linear-gradient(45deg,#5e00ff,#ff0010);';
                parentNode.append(newBtn);
                newBtn.addEventListener('click', () => {
                    if (document.getElementById('aplayer')) {
                        alert('已存在一个音频播放器！');
                        return;
                    }
                    obj.initAudioPlayerMainPage();
                });
            }
        };

        const element = document.querySelector('.nd-new-main-list');
        if (element) {
            let vueInstance = element.__vue__;
            if (vueInstance) {
                addPlayer(vueInstance);
            }
            Object.defineProperty(element, '__vue__', {
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

    obj.replaceAudioPlayerMainPage = function () {
        const targetNode = document.querySelector('.nd-main-layout');
        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement) {
                        if (node.matches('.nd-audio')) {
                            const { bpAudio, currentFileMeta } = node.__vue__ || {};
                            if (bpAudio) {
                                bpAudio.destroy();
                                if (document.getElementById('aplayer')) {
                                    if (currentFileMeta) {
                                        obj.audio_page.currentFileMeta = { ...currentFileMeta };
                                    }
                                    return;
                                }
                                else {
                                    if (currentFileMeta) {
                                        delete obj.audio_page.currentFileMeta;
                                        obj.audio_page.currentFileMeta = { ...currentFileMeta };
                                    }
                                }
                                obj.initAudioPlayerMainPage();
                            }
                            return;
                        }
                    }
                }
            }
        }).observe(targetNode, { childList: true });
    };

    obj.initAudioPlayerMainPage = function () {
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
        const filelist = document.querySelector('.nd-new-main-list').__vue__.fileList;
        const audiolist = filelist.filter(item => item.category === 2 || item.category === 6 && ['ape'].includes(item.server_filename.split('.').pop().toLowerCase()));
        const audio = audiolist.map(file => {
            const { categoryImageGrid, fs_id, md5, path, server_filename, size } = file;
            return {
                artist: '',
                cover: categoryImageGrid,
                hash: md5,
                id: fs_id,
                name: server_filename,
                type: 'hls',
                url: '/rest/2.0/xpan/file?method=streaming&path='.concat(encodeURIComponent(path), '&type=M3U8_MP3_128'),
                size
            };
        });
        const options = {
            audio,
            container
        };
        window.audioPlayer(options).then(player => {
            const { list } = player;
            if (!list) return;

            const findIndex = ({ fs_id }) => fs_id ? audio.findIndex(item => item.id === fs_id) : -1;
            const { currentFileMeta } = obj.audio_page;
            const index = findIndex(currentFileMeta);
            if (index > -1) {
                list.switch(index);
            }
            Object.defineProperty(obj.audio_page, 'currentFileMeta', {
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

    obj.getVip = function () {
        if (unsafeWindow.yunData && !unsafeWindow.yunData.neglect) {
            return 1 === unsafeWindow.yunData.ISSVIP ? 2 : 1 === unsafeWindow.yunData.ISVIP ? 1 : 0;
        }
        if (unsafeWindow.locals) {
            var is_svip = false, is_vip = false;
            if (unsafeWindow.locals.get) {
                is_svip = 1 === +unsafeWindow.locals.get('is_svip');
                is_vip = 1 === +unsafeWindow.locals.get('is_vip');
                return is_svip ? 2 : is_vip ? 1 : 0;
            }
            is_svip = 1 === +unsafeWindow.locals.is_svip;
            is_vip = 1 === +unsafeWindow.locals.is_vip;
            return is_svip ? 2 : is_vip ? 1 : 0;
        }
        return 0;
    };

    obj.run = function () {
        const url = location.href;
        if (url.indexOf('.baidu.com/s/') > 0) {
            obj.readyState().then(obj.initAudioSharePage);
            window.onhashchange = () => obj.readyState().then(obj.initAudioSharePage);
        }
        else if (url.indexOf('.baidu.com/disk/main') > 0) {
            obj.readyNodeInserted('.nd-new-main-list', document.body).then(obj.initAudioMainPage);
        }
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
