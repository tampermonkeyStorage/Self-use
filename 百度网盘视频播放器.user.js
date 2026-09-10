// ==UserScript==
// @name         百度网盘视频播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      1.2.4
// @description  功能更全，播放更流畅，界面更好看！特色功能主要有: 倍速调整，分辨率切换，剧集列表，字幕列表，本地字幕，精细设置字幕样式，音质增强音量增大，画面比例调整，画面色彩调整，快捷操作: 长按倍速、快进快退、片头片尾 ...，所有设置持久化记忆，支持移动端网页播放（网盘主页），想你所想，极致观影体验 ...
// @author       You
// @match        http*://yun.baidu.com/s/*
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/wap/home*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/pfile/video*
// @match        https://pan.baidu.com/pfile/mboxvideo*
// @require      https://scriptcat.org/lib/950/^1.0.3/joysound.js
// @require      https://scriptcat.org/lib/1348/^2.2.4/artPlugins.js
// @require      https://unpkg.com/hls.js@1.7.2/dist/hls.min.js
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
            unsafeWindow.locals = unsafeWindow.locals || {};
            let shareId = obj.getShareId()
            , file_list = unsafeWindow.locals.file_list;
            Object.defineProperty(unsafeWindow.locals, 'file_list', {
                enumerable: true,
                set(value) {
                    file_list = value;
                    if (file_list && file_list.length) {
                        sessionStorage.setItem('file_list_' + shareId, JSON.stringify(file_list));
                    }
                }
            });
        }
        else if (unsafeWindow.SHAREPAGETYPE === 'single_file_page') {
            unsafeWindow.locals.get('file_list', 'share_uk', 'shareid', 'sign', 'timestamp', (file_list, share_uk, shareid, sign, timestamp) => {
                const [ file ] = file_list
                , { category, fs_id, resolution, thumbs } = file
                , id = '' + fs_id;
                if (category !== 1) return;
                obj.startObj().then((obj) => {
                    obj.video_page.flag = 'sharevideo';
                    const vip = obj.getVip()
                    , getUrl = (type) => {
                        return '/share/streaming?'.concat(Object.entries({
                            type,
                            uk: share_uk,
                            shareid,
                            sign,
                            timestamp,
                            fid: fs_id,
                            vip,
                            jsToken: unsafeWindow.jsToken
                        }).map(([ key, value ]) => `${key}=${value}`).join('&'));
                    };
                    obj.getAdToken(getUrl).then((adToken) => {
                        obj.initVideoPlayer({
                            adToken,
                            file,
                            filelist: JSON.parse(sessionStorage.getItem('file_list_' + obj.getShareId()) || '[]').map((item) => {
                                const { fs_id, path, server_filename: name } = item;
                                return item.category == 1 && {
                                    id: '' + fs_id,
                                    name,
                                    default: id == fs_id,
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
        window.onhashchange = function () {
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
                if ((response || {}).errno !== 0) return;
                const [ file ] = response.info
                , { fs_id, path, resolution, thumbs } = file
                , id = '' + fs_id;
                obj.startObj().then((obj) => {
                    obj.video_page.flag = 'playvideo';
                    const vip = obj.getVip()
                    , getUrl = (type) => {
                        if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                        return '/api/streaming?'.concat(Object.entries({
                            type,
                            path: encodeURIComponent(path),
                            vip,
                            jsToken: unsafeWindow.jsToken
                        }).map(([ key, value ]) => `${key}=${value}`).join('&'));
                    };
                    obj.getAdToken(getUrl).then((adToken) => {
                        obj.initVideoPlayer({
                            adToken,
                            file,
                            filelist: videoList.map(function (item, index) {
                                const { fs_id, path, server_filename: name } = item;
                                return {
                                    id: '' + fs_id,
                                    name,
                                    default: id == fs_id,
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
                , { fs_id, path, resolution, thumbs } = file
                , id = '' + fs_id;
                obj.startObj().then((obj) => {
                    obj.video_page.flag = 'video';
                    const vip = obj.getVip()
                    , getUrl = (type) => {
                        if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                        return '/api/streaming?'.concat(Object.entries({
                            type,
                            path: encodeURIComponent(path),
                            vip,
                            jsToken: unsafeWindow.jsToken
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
                                    default: id == fs_id,
                                    change: () => {
                                        location.href = location.protocol + '//' + location.host + location.pathname + '?path=' + encodeURIComponent(path);
                                    }
                                };
                            }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
                            id,
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
                , { adToken = '', resolution, path, thumbs, from_uk, to, msg_id, fs_id, type } = file
                , id = '' + fs_id;
                obj.startObj().then(async (obj) => {
                    obj.video_page.flag = 'mboxvideo';
                    const vip = obj.getVip()
                    , getUrl = (stream_type) => {
                        return '/mbox/msg/streaming?'.concat(Object.entries({
                            stream_type, from_uk, to, msg_id, fs_id, type, vip
                        }).map(([ key, value ]) => `${key}=${value}`).join('&'));
                    };
                    const params = new URLSearchParams(location.search);
                    const cursor = params.get('selection_cursor');
                    window.localforage.config({
                        name        : 'wpMboxVideoDB',
                        storeName   : 'selectionList',
                    });
                    let videoList = [];
                    await window.localforage.iterate((value, key, iterationNumber) => {
                        const { list, time } = value;
                        if (time === cursor || list.some(item => item.fs_id == fs_id)) {
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
                                default: id == fs_id,
                                change: () => {
                                    const params = new URLSearchParams(location.search);
                                    Object.entries({
                                        from_uk, fs_id, group_id, md5, msg_id, name, path
                                    }).forEach(([ key, value ]) => params.set(key, value));
                                    location.href = location.protocol + '//' + location.host + location.pathname + '?' + params.toString();
                                }
                            };
                        }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
                        id,
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
                , { fs_id, path, resolution, thumbs } = file
                , id = '' + fs_id;
                obj.startObj().then((obj) => {
                    obj.video_page.flag = 'videoView';
                    const vip = obj.getVip()
                    , getUrl = (type) => {
                        if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                        return '/rest/2.0/xpan/file?'.concat(Object.entries({
                            type,
                            method: 'streaming',
                            path: encodeURIComponent(path),
                            vip
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

    obj.getAdToken = function (getUrl) {
        const { adToken = '' } = obj.video_page;
        if (adToken || obj.getVip() > 1) {
            return Promise.resolve(adToken);
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
        var freeList = function (e) {
            e = e || '';
            var t = [480, 360]
            , a = e.match(/width:(\d+),height:(\d+)/) || ['', '', '']
            , i = +a[1] * +a[2];
            return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t;
        }(resolution)
        , templates = {
            1080: '超清 1080P',
            720: '高清 720P',
            480: '流畅 480P',
            360: '省流 360P'
        };
        return freeList.map(function (template) {
            return {
                html: templates[template],
                url: getUrl('M3U8_AUTO_' + template) + '&adToken=' + encodeURIComponent(adToken),
                type: 'hls'
            };
        });
    };

    obj.initVideoPlayer = function (options) {
        obj.replaceVideoPlayer().then(() => {
            window.artPlugins.init(options).then(() => {
                obj.destroyPlayer();
            });
        });
    };

    obj.replaceVideoPlayer = function () {
        var container, videoWrap = document.querySelector('#video-wrap, .vp-video__player, #app .video-content');
        if (!videoWrap) {
            return Promise.reject();
        }
        while (videoWrap.nextSibling) {
            videoWrap.parentNode.removeChild(videoWrap.nextSibling);
        }
        container = document.getElementById('artplayer');
        if (!container) {
            container = document.createElement('div');
            container.setAttribute('id', 'artplayer');
            const { flag } = obj.video_page;
            if ([ 'videoView' ].includes(flag)) {
                container.setAttribute('style', 'width: 100%; height: 3.75rem;');
            }
            else {
                container.setAttribute('style', 'width: 100%; height: 100%;');
            }
            obj.video_page.videoWrap = videoWrap.parentNode.replaceChild(container, videoWrap);
            container.parentNode.style.cssText += 'z-index: auto;'
            return Promise.resolve();
        }
    };

    obj.destroyPlayer = function () {
        let count, id;
        if (unsafeWindow.require && unsafeWindow.require.async) {
            unsafeWindow.require.async('file-widget-1:videoPlay/context.js', (context) => {
                id = count = setInterval(() => {
                    const playerInstance = context && context.getContext()?.playerInstance;
                    if (playerInstance && playerInstance.player) {
                        clearInterval(id);
                        playerInstance.player.dispose();
                        playerInstance.player = !1;
                    }
                    else if (++count - id > 60) {
                        clearInterval(id);
                    }
                }, 500);
            });
        }
        else if (obj.video_page.videoWrap) {
            const { videoWrap } = obj.video_page;
            id = count = setInterval(() => {
                const playerInstance = videoWrap.firstChild;
                if (playerInstance && playerInstance.player) {
                    clearInterval(id);
                    playerInstance.player.dispose();
                    playerInstance.player = !1;
                    obj.video_page.videoWrap = null;
                }
                else if (++count - id > 60) {
                    clearInterval(id);
                    obj.video_page.videoWrap = null;
                }
            }, 500);
        }
    };

    obj.startObj = function () {
        return Promise.resolve(GM_info).then((info) => {
            if (info) {
                const { script: { version } } = info;
                const lobjls = GM_getValue(version, 0);
                const length = Object.values(obj).reduce((prev, cur) => {
                    return (prev += cur?cur.toString().length:0);
                }, 0);
                return lobjls ? lobjls === length ? obj : {} : (GM_setValue(version, length), obj);
            }
        });
    };

    obj.getShareId = function () {
        return (/baidu.com\/(?:s\/1|(?:share|wap)\/init\?surl=)([\w-]{5,25})/.exec(location.href) || [])[1] || '';
    };

    obj.ready = function (state = 3) {
        return new Promise(function (resolve) {
            const states = ['uninitialized', 'loading', 'loaded', 'interactive', 'complete'];
            state = Math.min(state, states.length - 1);
            if (states.indexOf(document.readyState) >= state) {
                window.setTimeout(resolve);
            }
            else {
                document.onreadystatechange = function () {
                    if (states.indexOf(document.readyState) >= state) {
                        document.onreadystatechange = null;
                        window.setTimeout(resolve);
                    }
                };
            }
        });
    };

    obj.run = function () {
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
