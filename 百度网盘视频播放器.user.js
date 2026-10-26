// ==UserScript==
// @name         百度网盘视频播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      1.2.6
// @description  功能更全，播放更流畅，界面更好看！特色功能主要有: 倍速调整，分辨率切换，剧集列表，字幕列表，本地字幕，精细设置字幕样式，音质增强音量增大，画面比例调整，画面色彩调整，快捷操作: 长按倍速、快进快退、片头片尾 ...，所有设置持久化记忆，支持移动端网页播放（网盘主页），想你所想，极致观影体验 ...
// @author       You
// @match        http*://yun.baidu.com/s/*
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/wap/home*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/pfile/video*
// @match        https://pan.baidu.com/pfile/mboxvideo*
// @require      https://scriptcat.org/lib/950/^1.0.3/joysound.js
// @require      https://scriptcat.org/lib/1348/^2.2.5/artPlugins.js
// @require      https://unpkg.com/hls.js@1.7.3/dist/hls.min.js
// @require      https://unpkg.com/artplayer@5.4.0/dist/artplayer.js
// @require      https://unpkg.com/localforage@1.10.0/dist/localforage.min.js
// @require      https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @run-at       document-start
// @antifeature  ads
// @antifeature  membership
// @antifeature  payment
// @antifeature  referral-link
// @antifeature  tracking
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    var obj = {
        video_page: {}
    };

    obj.sharevideo = function () {
        if (/(链接|页面)不存在/.test(document.title)) return;
        if (unsafeWindow.SHAREPAGETYPE === 'multi_file') {
            const getCurrentList = () => {
                try {
                    return unsafeWindow.require('system-core:context/context.js').instanceForSystem.list.getCurrentList();
                } catch (error) {
                    return unsafeWindow.locals.get('file_list');
                }
            };
            unsafeWindow.$ && unsafeWindow.$(document).on('click', '#shareqr .file-name .filename', function () {
                const index = unsafeWindow.$(this).parent().parent().parent().index();
                const file_list = getCurrentList();
                const file = file_list[index];
                if (file && file.category == 1) {
                    const ext = file.server_filename.split('.').pop().toLowerCase();
                    if (['ts', '3gp2','3g2','3gpp','amv','divx','dpg','f4v','m2t','m2ts','m2v','mpe','mpeg','mts','vob','webm','wxp','wxv','vob'].includes(ext)) {
                        window.open(location.protocol + '//' + location.host + location.pathname + '?fid=' + file.fs_id, '_blank');
                    }
                }
            });
        }
        else if (unsafeWindow.SHAREPAGETYPE === 'single_file_page') {
            unsafeWindow.locals.get('file_list', 'share_uk', 'shareid', 'sign', 'timestamp', (file_list, share_uk, shareid, sign, timestamp) => {
                const [ file ] = file_list
                , { category, fs_id, resolution, thumbs } = file;
                if (category !== 1) return;
                obj.startObj().then((obj) => {
                    obj.video_page.flag = 'sharevideo';
                    const videoList = (() => {
                        if (!unsafeWindow.opener) return [];
                        try {
                            return unsafeWindow.opener.require('system-core:context/context.js').instanceForSystem.list.getCurrentList();
                        } catch (error) {
                            return unsafeWindow.opener.locals.get('file_list');
                        }
                    })()
                    ,vip = obj.getVip()
                    , getUrl = (type) => {
                        return '/share/streaming?'.concat(Object.entries({
                            type, uk: share_uk, shareid, sign, timestamp, fid: fs_id, vip, jsToken: unsafeWindow.jsToken
                        }).map(([ key, value ]) => `${key}=${value}`).join('&'));
                    };
                    obj.getAdToken(getUrl).then((adToken) => {
                        obj.initVideoPlayer({
                            adToken,
                            file,
                            filelist: videoList.map((item) => {
                                const { fs_id, server_filename } = item;
                                return item.category == 1 && {
                                    id: '' + fs_id,
                                    name: server_filename,
                                    default: fs_id == file.fs_id,
                                    change: () => {
                                        location.href = location.protocol + '//' + location.host + location.pathname + '?fid=' + fs_id;
                                    }
                                };
                            }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
                            id: '' + fs_id,
                            getUrl,
                            poster: (Object.values(thumbs).slice(-1)[0] || '').replace(/size=c\d+_u\d+/, 'size=c850_u580'),
                            quality: obj.buildQuality(getUrl, resolution, adToken)
                        });
                    });
                });
            });
        }
    };

    obj.playvideo = function () {
        window.onhashchange = () => {
            location.reload();
        };
        let videoList = [];
        unsafeWindow.jQuery(document).ajaxComplete((event, xhr, options) => {
            let response, requestUrl = options.url;
            if (requestUrl.indexOf('/api/categorylist') >= 0) {
                response = xhr.responseJSON;
                videoList = response.info || [];
            }
            else if (requestUrl.indexOf('/api/filemetas') >= 0) {
                response = xhr.responseJSON;
                if (!(response && response.info)) return;
                const [ file ] = response.info
                , { fs_id, path, resolution, thumbs } = file;
                obj.startObj().then((obj) => {
                    obj.video_page.flag = 'playvideo';
                    const vip = obj.getVip()
                    , getUrl = (type) => {
                        if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                        return '/api/streaming?'.concat(Object.entries({
                            type, path: encodeURIComponent(path), vip, jsToken: unsafeWindow.jsToken
                        }).map(([ key, value ]) => `${key}=${value}`).join('&'));
                    };
                    obj.getAdToken(getUrl).then((adToken) => {
                        obj.initVideoPlayer({
                            adToken,
                            file,
                            filelist: videoList.map((item) => {
                                const { fs_id, path, server_filename } = item;
                                return {
                                    id: '' + fs_id,
                                    name: server_filename,
                                    default: fs_id == file.fs_id,
                                    change: () => {
                                        location.href = location.protocol + '//' + location.host + location.pathname + '#/video?path=' + encodeURIComponent(path);
                                    }
                                };
                            }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
                            id: '' + fs_id,
                            getUrl,
                            poster: (Object.values(thumbs).slice(-1)[0] || '').replace(/size=c\d+_u\d+/, 'size=c850_u580'),
                            quality: obj.buildQuality(getUrl, resolution, adToken)
                        });
                    });
                });
            }
        });
    };

    obj.video = function () {
        try {
            const { $pinia, $router } = document.querySelector('#app').__vue_app__.config.globalProperties;
            const { videoinfo, recommendListInfo } = $pinia.state.value;
            if (videoinfo.videoinfo) {
                const file = { ...videoinfo.videoinfo }
                , { fs_id, path, resolution, thumbs } = file;
                obj.startObj().then((obj) => {
                    obj.video_page.flag = 'video';
                    const vip = obj.getVip()
                    , getUrl = (type) => {
                        if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                        return '/api/streaming?'.concat(Object.entries({
                            type, path: encodeURIComponent(path), vip, jsToken: unsafeWindow.jsToken
                        }).map(([ key, value ]) => `${key}=${value}`).join('&'));
                    };
                    obj.getAdToken(getUrl).then((adToken) => {
                        obj.initVideoPlayer({
                            adToken,
                            file,
                            filelist: [...recommendListInfo.selectionVideoList].map((item) => {
                                const { fs_id, path, server_filename: name } = item;
                                return {
                                    id: '' + fs_id,
                                    name,
                                    default: fs_id == file.fs_id,
                                    change: () => {
                                        location.href = location.protocol + '//' + location.host + location.pathname + '?path=' + encodeURIComponent(path);
                                    }
                                };
                            }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
                            id: '' + fs_id,
                            getUrl,
                            poster: (Object.values(thumbs).slice(-1)[0] || '').replace(/size=c\d+_u\d+/, 'size=c850_u580'),
                            quality: obj.buildQuality(getUrl, resolution, adToken)
                        });
                    });
                });
            }
            else {
                setTimeout(obj.video, 1e3);
                return;
            }
            $router.isReady().then(() => {
                $router.afterEach((to, from) => {
                    from.fullPath === '/' || from.fullPath === to.fullPath || location.reload();
                });
            });
        }
        catch (error) {
            setTimeout(obj.video, 1e3);
        }
    };

    obj.mboxvideo = function () {
        try {
            const { $pinia, $router } = document.querySelector('#app').__vue_app__.config.globalProperties;
            const { videoinfo, recommendListInfo } = $pinia.state.value;
            if (videoinfo.videoinfo) {
                const file = { ...videoinfo.videoinfo }
                , { adToken = '', resolution, thumbs, from_uk, to, msg_id, fs_id, type } = file;
                obj.startObj().then(async (obj) => {
                    obj.video_page.flag = 'mboxvideo';
                    const vip = obj.getVip()
                    , getUrl = (stream_type) => {
                        return '/mbox/msg/streaming?'.concat(Object.entries({
                            stream_type, from_uk, to, msg_id, fs_id, type, vip
                        }).map(([ key, value ]) => `${key}=${value}`).join('&'));
                    };
                    window.localforage.config({
                        name        : 'wpMboxVideoDB',
                        storeName   : 'selectionList',
                    });
                    let videoList = [];
                    await window.localforage.iterate((value) => {
                        const { list } = value;
                        if (list.some(item => item.fs_id == fs_id)) {
                            return list;
                        }
                    }).then((list) => {
                        if (list) {
                            videoList = list;
                        }
                    });
                    obj.initVideoPlayer({
                        adToken,
                        file,
                        filelist: videoList.map((item) => {
                            const { from_uk, fs_id, group_id, md5, msg_id, name, path } = item;
                            return {
                                ...item,
                                id: '' + fs_id,
                                default: fs_id == file.fs_id,
                                change: () => {
                                    const params = new URLSearchParams(location.search);
                                    Object.entries({
                                        from_uk, fs_id, group_id, md5, msg_id, name, path
                                    }).forEach(([ key, value ]) => params.set(key, value));
                                    location.href = location.protocol + '//' + location.host + location.pathname + '?' + params.toString();
                                }
                            };
                        }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
                        id: '' + fs_id,
                        getUrl,
                        poster: (Object.values(thumbs).slice(-1)[0] || '').replace(/size=c\d+_u\d+/, 'size=c850_u580'),
                        quality: obj.buildQuality(getUrl, resolution, adToken)
                    });
                });
            }
            else {
                setTimeout(obj.mboxvideo, 1e3);
                return;
            }
            $router.isReady().then(() => {
                $router.afterEach((to, from) => {
                    from.fullPath === '/' || from.fullPath === to.fullPath || location.reload();
                });
            });
        }
        catch (error) {
            setTimeout(obj.mboxvideo, 1e3);
        }
    };

    obj.videoView = function () {
        try {
            const { videoFile } = document.querySelector('.preview-video').__vue__;
            if (videoFile) {
                const file = videoFile
                , { fs_id, path, resolution, thumbs } = file;
                obj.startObj().then((obj) => {
                    obj.video_page.flag = 'videoView';
                    const vip = obj.getVip()
                    , getUrl = (type) => {
                        if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                        return '/rest/2.0/xpan/file?'.concat(Object.entries({
                            type, method: 'streaming', path: encodeURIComponent(path), vip
                        }).map(([ key, value ]) => `${key}=${value}`).join('&')
                                                            );
                    };
                    obj.getAdToken(getUrl).then((adToken) => {
                        obj.initVideoPlayer({
                            adToken,
                            file,
                            id: '' + fs_id,
                            getUrl,
                            poster: (Object.values(thumbs).slice(-1)[0] || '').replace(/size=c\d+_u\d+/, 'size=c850_u580'),
                            quality: obj.buildQuality(getUrl, resolution, adToken)
                        });
                    });
                });
            }
            else {
                setTimeout(obj.videoView, 1e3);
            }
        }
        catch (error) {
            setTimeout(obj.videoView, 1e3);
        }
    };

    obj.getVip = function () {
        if (unsafeWindow.yunData && !unsafeWindow.yunData.neglect) {
            return 1 === unsafeWindow.yunData.ISSVIP ? 2 : 1 === unsafeWindow.yunData.ISVIP ? 1 : 0;
        }
        if (unsafeWindow.locals) {
            let is_svip = false, is_vip = false;
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

    obj.getAdToken = function (getUrl) {
        if (obj.getVip() > 1) {
            return Promise.resolve('');
        }
        return fetch(getUrl('M3U8_AUTO_480')).then((result) => result.text()).then((result) => {
            try {
                result = JSON.parse(result);
            } catch (e) { }
            if (result && 133 === result.errno && 0 !== result.adTime) {
                return result.adToken;
            }
            return '';
        });
    };

    obj.buildQuality = function (getUrl, resolution, adToken) {
        const freeList = ((e) => {
            e = e || '';
            const t = [480, 360]
            , a = e.match(/width:(\d+),height:(\d+)/) || ['', '', '']
            , i = +a[1] * +a[2];
            return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t;
        })(resolution)
        , templates = {
            1080: '超清 1080P',
            720: '高清 720P',
            480: '流畅 480P',
            360: '省流 360P'
        };
        return freeList.map((template) => {
            return {
                html: templates[template],
                url: getUrl('M3U8_AUTO_' + template) + '&adToken=' + encodeURIComponent(adToken),
                type: 'hls'
            };
        });
    };

    obj.initVideoPlayer = function (options) {
        if (!obj.replaceVideoPlayer()) return;
        window.artPlugins.init(options);
    };

    obj.replaceVideoPlayer = function () {
        const videoWrap = document.getElementById('video-wrap') || document.querySelector('.vp-video__player, .video-content');
        if (!videoWrap) return false;
        while (videoWrap.nextSibling) {
            videoWrap.parentNode.removeChild(videoWrap.nextSibling);
        }
        const artplayer = document.getElementById('artplayer');
        if (artplayer) return true;
        const container = document.createElement('div');
        container.setAttribute('id', 'artplayer');
        const newWrap = videoWrap.parentNode.replaceChild(container, videoWrap);
        container.parentNode.style.cssText += 'z-index: auto;';
        const { flag } = obj.video_page;
        if ([ 'videoView' ].includes(flag)) {
            container.setAttribute('style', 'width: 100%; height: 3.75rem;');
            return true;
        }
        container.setAttribute('style', 'width: 100%; height: 100%;');
        if (unsafeWindow.require && unsafeWindow.require.async) {
            unsafeWindow.require.async('file-widget-1:videoPlay/context.js', (data) => {
                let waitCount, waitId = waitCount = setInterval(() => {
                    const { playerInstance } = data.getContext() || {};
                    if (playerInstance && playerInstance.player) {
                        clearInterval(waitId);
                        playerInstance.player.dispose();
                        playerInstance.player = !1;
                    }
                    else if (++waitCount - waitId > 60) {
                        clearInterval(waitId);
                    }
                }, 500);
            });
        }
        else {
            let waitCount, waitId = waitCount = setInterval(() => {
                const { firstChild: playerInstance } = newWrap;
                if (playerInstance && playerInstance.player) {
                    clearInterval(waitId);
                    playerInstance.player.dispose();
                    playerInstance.player = !1;
                }
                else if (++waitCount - waitId > 60) {
                    clearInterval(waitId);
                }
            }, 500);
        }
        return true;
    };

    obj.startObj = function () {
        return Promise.resolve(GM_info).then((info) => {
            if (info) {
                const { script: { version } } = info;
                const lobjls = GM_getValue(version, 0);
                const length = Object.values(obj).reduce((prev, cur) => (prev += cur ? cur.toString().length : 0), 0);
                return lobjls ? lobjls === length ? obj : {} : (GM_setValue(version, length), obj);
            }
        });
    };

    obj.ready = function (lowest = 3) {
        const states = ['uninitialized', 'loading', 'loaded', 'interactive', 'complete'];
        lowest = Math.max(0, Math.min(states.length - 1, lowest));
        const isReady = () => states.indexOf(document.readyState) >= lowest;
        if (isReady()) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            const onStateChange = () => {
                if (!isReady()) return;
                document.removeEventListener('readystatechange', onStateChange);
                resolve();
            };
            document.addEventListener('readystatechange', onStateChange);
        });
    };

    obj.run = function () {
        if (window.top !== window.self) return;
        const url = location.href;
        if (url.indexOf('.baidu.com/s/') > 0) {
            obj.ready().then(obj.sharevideo);
        }
        else if (url.indexOf('.baidu.com/play/video#/video') > 0) {
            obj.ready().then(obj.playvideo);
        }
        else if (url.indexOf('.baidu.com/pfile/video') > 0) {
            obj.ready().then(obj.video);
        }
        else if (url.indexOf('.baidu.com/pfile/mboxvideo') > 0) {
            obj.ready().then(obj.mboxvideo);
        }
        else if (url.indexOf('.baidu.com/wap') > 0) {
            obj.ready(4).then(() => {
                const { $router } = document.getElementById('app').__vue__;
                $router.onReady(() => {
                    const { currentRoute } = $router;
                    if (currentRoute && currentRoute.name === 'videoView') {
                        obj.videoView();
                    }
                    $router.afterEach((to, from) => {
                        if (to.name !== from.name) {
                            obj.video_page.adToken = '';
                            if (to.name === 'videoView') {
                                obj.videoView();
                            }
                        }
                    });
                });
            });
        }
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
