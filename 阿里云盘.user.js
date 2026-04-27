// ==UserScript==
// @name         阿里云盘
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      5.2.0
// @description  更多功能的视频播放器，支持分享页直接观看。
// @author       You
// @match        https://www.alipan.com/*
// @match        https://www.aliyundrive.com/*
// @connect      alipan.com
// @connect      aliyundrive.com
// @require      https://scriptcat.org/lib/950/^1.0.3/joysound.js
// @require      https://scriptcat.org/lib/2163/^1.1.0/alipanThirdParty.js
// @require      https://scriptcat.org/lib/2164/^1.1.0/alipanArtPlugins.js
// @require      https://unpkg.com/hls.js@1.6.16/dist/hls.min.js
// @require      https://unpkg.com/artplayer@5.4.0/dist/artplayer.js
// @require      https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js
// @icon         https://gw.alicdn.com/imgextra/i3/O1CN01aj9rdD1GS0E8io11t_!!6000000000620-73-tps-16-16.ico
// @antifeature  ads
// @antifeature  membership
// @antifeature  payment
// @antifeature  referral-link
// @antifeature  tracking
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    var obj = {
        settings: {},
        file_page: {
            sendParams: {},
            items: []
        },
        video_page: {
            info: {},
            file: {},
            filelist: [],
            sublist: []
        }
    };

    obj.httpListener = function () {
        (function(send) {
            XMLHttpRequest.prototype.send = function (sendParams) {
                this.addEventListener('load', function(event) {
                    if (this.readyState == 4 && this.status == 200) {
                        var response = this.response || this.responseText || "", responseURL = this.responseURL;
                        if (responseURL.indexOf('/file/list') > 0 || responseURL.indexOf('/file/search') > 0) {
                            obj.initFilesInfo(sendParams, response);
                        }
                        else if (responseURL.indexOf('/file/get_video_preview_play_info') > 0) {
                            obj.initVideoPlayInfo(response);
                            obj.initVideoPlayer();
                        }
                    }
                }, false);
                send.apply(this, arguments);
            };
        })(XMLHttpRequest.prototype.send);
    };

    obj.initFilesInfo = function (sendParams, response) {
        const lastSendParams = obj.file_page.sendParams;
        try { sendParams = JSON.parse(sendParams) } catch (error) { };
        try { response = JSON.parse(response) } catch (error) { };
        if (sendParams instanceof Object && response instanceof Object) {
            const { order_by, order_direction, parent_file_id } = sendParams;
            if (!(order_by === lastSendParams.order_by && order_direction === lastSendParams.order_direction && parent_file_id === lastSendParams.parent_file_id)) {
                obj.file_page.items = [];
            }
            obj.file_page.sendParams = sendParams;
            if (response.items.length) {
                const { file_id } = response.items[0];
                obj.file_page.items.some(item => item.file_id === file_id) || (obj.file_page.items = obj.file_page.items.concat(response.items));
            }
            obj.showTipSuccess('文件列表获取完成 共：' + obj.file_page.items.length + '项');

            if (obj.file_page.items.length) {
                // obj.isHomePage() ? obj.initDownloadHomePage() : obj.initDownloadSharePage;
            }
        }
    };

    obj.initVideoPlayInfo = function (response) {
        try { response = JSON.parse(response) } catch (error) { };
        if (response instanceof Object) {
            obj.video_page.filelist = [];
            obj.video_page.sublist = [];
            obj.file_page.items.forEach(item => {
                const { type, category, file_extension } = item;
                if (type === 'file') {
                    const ext = file_extension.toLowerCase();
                    if (item.category === 'video') {
                        obj.video_page.filelist.push(item);
                    }
                    else if (category === 'others' && ['webvtt', 'vtt', 'srt', 'ass', 'ssa'].includes(ext)) {
                        obj.video_page.sublist.push(item);
                    }
                }
            });
            obj.video_page.file = obj.video_page.filelist.find(item => {
                return item.file_id === response.file_id;
            }) || response;
        }
    };

    obj.initVideoPlayer = function () {
        const { file, filelist = [] } = obj.video_page;
        const getOption = (file) => {
            return obj.getVideoPreviewPlayInfo(file).then(info => {
                const { file_id: id = '', thumbnail: poster = '' } = file;
                const {
                    live_transcoding_task_list = [],
                    live_transcoding_subtitle_task_list = [],
                    quick_video_list = [],
                    quick_video_subtitle_list = [],
                } = info.video_preview_play_info;
                const qualityTemplate = {
                    UHD: '4K 2160P',
                    QHD: '2K 1440P',
                    FHD: '超清 1080P',
                    HD: '高清 720P',
                    SD: '标清 480P',
                    LD: '省流 360P'
                };
                const quality = live_transcoding_task_list.map(item => {
                    const { url, template_id } = item || {};
                    return {
                        ...item,
                        html: qualityTemplate[template_id],
                        url: url || (quick_video_list.find(item => item.template_id === template_id) || {}).url,
                        type: 'hls'
                    };
                }).filter(({ url }) => url);
                if (quality.length) {
                    quality.sort((a, b) => b.template_height - a.template_height);
                    quality[0].default = !0;
                }
                const { url, type } = quality[0] || {};
                const sublistTemplate = {
                    chi: '中文字幕',
                    zho: '中文字幕',
                    eng: '英文字幕',
                    jpn: '日文字幕'
                };
                const sublist = live_transcoding_subtitle_task_list.map(item => {
                    const { url, language } = item || {};
                    const lang = sublistTemplate[language] || language || '未知语言';
                    return {
                        ...item,
                        html: lang,
                        name: `内挂: ${ lang }`,
                        type: 'vtt'
                    };
                }).filter(({ url }) => url);
                return {
                    quality,
                    url,
                    type,
                    id,
                    poster,
                    sublist
                };
            });
        };
        if (filelist && filelist.length) {
            filelist.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            const defaultFile = filelist.find(({ file_id }) => file_id === file.file_id);
            defaultFile.default = !0;
        }
        getOption(file).then(options => {
            if (!obj.replaceVideoPlayer()) return;
            options = {
                ...options,
                file,
                filelist,
                getOption
            };
            window.alipanArtPlugins.init(options).then(art => {
                art.once('ready', () => {
                    const appendSublist = (file) => {
                        obj.getSublistByPage(file).then(sublist => {
                            sublist.length && art.emit('sublist', sublist);
                        });
                    };
                    const { file } = art.option;
                    if (file) {
                        appendSublist(file);
                    }
                    art.on('switchPlaylist', file => {
                        appendSublist(file);

                        const { name } = file;
                        const filenameNode = document.querySelector('[class^=header-file-name], [class^=filename] span, [class^=header-center] div span');
                        if (filenameNode) {
                            filenameNode.innerText = name;
                        }
                    });
                });

                const closeNode = document.querySelector('[class^="header-"] [data-icon-type="PDSClose"], [class^="header-"] [data-icon-type="PDSChevronLeft"]');
                closeNode && closeNode.addEventListener('click', () => art.destroy(), { once: true });
            });
        });
    };

    obj.replaceVideoPlayer = function () {
        const videoNode = document.querySelector('video');
        if (videoNode) {
            let container = document.getElementById('artplayer');
            if (!container) {
                container = document.createElement('div');
                container.setAttribute('id', 'artplayer');
                container.setAttribute('style', 'width: 100%; height: 100%;');
                const ancestorNode = videoNode.parentNode.parentNode;
                ancestorNode.parentNode.replaceChild(container, ancestorNode);
            }
            return true;
        }
        obj.showTipError('无法加载视频播放器，视频容器未找到！');
        return false;
    };

    obj.getVideoPreviewPlayInfo = function (file) {
        return window.alipanThirdParty.getVipInfo().then(info => {
            const { thirdPartyVip, thirdPartyVipExpire } = info;
            if (thirdPartyVip) {
                return obj.getVideoPreviewPlayInfoThirdParty(file);
            }
            return Promise.reject();
        }).catch((error) => {
            return obj.getVideoPreviewPlayInfoWeb(file);
        });
    };

    obj.getVideoPreviewPlayInfoThirdParty = function ({ drive_id, file_id, share_id }) {
        if (share_id) {
            return obj.refresh_token().then (() => {
                return obj.saveFile(file_id, share_id).then(response => {
                    const { responses: [{ body, status }] } = response;
                    if (status === 201) {
                        const { drive_id, file_id } = body;
                        return window.alipanThirdParty.getVideoPreviewPlayInfo(drive_id, file_id).finally(() => {
                            window.alipanThirdParty.delete(drive_id, file_id);
                        });
                    }
                    else {
                        obj.showTipError('文件缓存失败，可能网盘存储空间已满 ...', 5e3);
                        return Promise.reject();
                    }
                });
            });
        }
        return window.alipanThirdParty.getVideoPreviewPlayInfo(drive_id, file_id);
    };

    obj.getVideoPreviewPlayInfoWeb = function ({ drive_id, file_id, share_id }) {
        return obj.refresh_token().then (() => {
            if (share_id) {
                return obj.get_share_token().then(() => {
                    return obj.saveFile(file_id, share_id).then((response) => {
                        const { responses: [{ body, status }] } = response;
                        if (status === 201) {
                            const { drive_id, file_id } = body;
                            return obj.get_video_preview_play_info(drive_id, file_id).finally(() => {
                                obj.deleteFile(drive_id, file_id);
                            });
                        }
                        if (status === 400) {
                            obj.showTipError('文件缓存失败，云盘可用空间不足 ...', 5e3);
                        }
                        return Promise.reject(response);
                    });
                });
            }
            return obj.get_video_preview_play_info(drive_id, file_id);
        });
    };

    obj.get_video_preview_play_info = function (drive_id, file_id, category = 'quick_video') {
        const { token_type, access_token } = obj.getItem('token');
        return fetch('https://api.aliyundrive.com/v2/file/get_video_preview_play_info', {
            body: JSON.stringify({
                category,
                drive_id,
                file_id,
                get_subtitle_info: !0,
                mode: 'high_res',
                template_id: '',
                url_expire_sec: 14400
            }),
            headers: {
                authorization: ''.concat(token_type || '', ' ').concat(access_token || ''),
                'content-type': 'application/json;charset=UTF-8'
            },
            method: 'POST'
        }).then(res => res.json()).then(result => {
            if (result.video_preview_play_info.live_transcoding_task_list) {
                return result;
            }
            if (category === 'quick_video') {
                category = 'live_transcoding';
                return obj.get_video_preview_play_info(drive_id, file_id, category);
            }
            return result;
        });
    };

    obj.getSublistByPage = function () {
        const filelist = obj.filterSubFiles();
        if (filelist.length) {
            return obj.getDownloadUrlBatch(filelist).then(filelist => {
                const sublist = filelist.map(item => {
                    const { file_extension, name, url } = item
                    return {
                        html: `外挂字幕「${file_extension}」`,
                        name,
                        url,
                        type: file_extension,
                        origin: '外挂字幕「网盘」'
                    };
                });
                return sublist;
            });
        }
        return Promise.reject();
    };

    obj.filterSubFiles = function () {
        const { file, sublist, filelist } = obj.video_page;
        if (!sublist.length) return [];
        if (filelist.length === 1) return sublist;
        const getBaseName = (fileName) => fileName.split('.').slice(0, -1).join('.').toLowerCase();
        const subItems = sublist.map(item => ({
            item,
            base: getBaseName(item.name)
        }));
        const videoBase = getBaseName(file.name);
        const videoVariants = [];
        let currentVariant = videoBase;
        while (currentVariant) {
            videoVariants.push(currentVariant);
            currentVariant = currentVariant.split('.').slice(0, -1).join('.');
        }
        for (const variant of videoVariants) {
            const matched = subItems.filter(({ base }) => base.includes(variant) || variant.includes(base));
            if (matched.length) return matched.map(({ item }) => item);
        }
        return [];
    };

    obj.getDownloadUrlBatch = function (fileList) {
        if (!Array.isArray(fileList)) {
            fileList = [fileList];
        }
        const promises = fileList.map(item => {
            return item.type === 'file' && obj.getDownloadUrl(item).then(response => {
                item.url = response.url;
                return item;
            });
        }).filter(Boolean);
        return Promise.allSettled(promises).then(results => {
            return fileList;
        });
    };

    obj.getDownloadUrl = function (file) {
        return obj.refresh_token().then (() => {
            const { drive_id, file_id, share_id } = file;
            if (share_id) {
                return obj.saveFile(file_id, share_id).then((response) => {
                    const { responses: [{ body, status }] } = response;
                    if (status === 201) {
                        const { drive_id, file_id } = body;
                        return obj.get_download_url(drive_id, file_id).finally(() => {
                            obj.deleteFile(drive_id, file_id);
                        });
                    }
                    else {
                        obj.showTipError('文件缓存失败，请自行清理网盘文件后重试。。。', 10e3);
                        return Promise.reject();
                    }
                });
            }
            return obj.get_download_url(drive_id, file_id);
        });
    };

    obj.get_download_url = function (drive_id, file_id) {
        const { token_type, access_token } = obj.getItem('token');
        return fetch('https://api.aliyundrive.com/v2/file/get_download_url', {
            body: JSON.stringify({
                expire_sec: 14400,
                drive_id: drive_id,
                file_id: file_id
            }),
            headers: {
                'authorization': ''.concat(token_type || '', ' ').concat(access_token || ''),
                'content-type': 'application/json;charset=UTF-8'
            },
            method: 'POST'
        }).then(res => res.json());
    };

    obj.saveFile = function (file_id, share_id) {
        const { token_type, access_token, default_drive_id } = obj.getItem('token');
        const { share_token } = obj.getItem('shareToken');
        return fetch('https://api.aliyundrive.com/adrive/v4/batch', {
            body: JSON.stringify({
                requests: [
                    {
                        body: {
                            auto_rename: true,
                            file_id: file_id,
                            share_id: share_id,
                            to_parent_file_id: "root",
                            to_drive_id: default_drive_id
                        },
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        id: '0',
                        method: 'POST',
                        url: '/file/copy'
                    }
                ],
                resource: 'file'
            }),
            headers: {
                'authorization': ''.concat(token_type || '', ' ').concat(access_token || ''),
                'content-type': 'application/json;charset=UTF-8',
                'x-share-token': share_token
            },
            method: 'POST'
        }).then(res => res.json());
    };

    obj.deleteFile = function (drive_id, file_id) {
        const { token_type, access_token } = obj.getItem('token');
        return fetch('https://api.aliyundrive.com/v3/file/delete', {
            body: JSON.stringify({
                drive_id: drive_id,
                file_id: file_id
            }),
            headers: {
                'authorization': ''.concat(token_type || '', ' ').concat(access_token || ''),
                'content-type': 'application/json;charset=UTF-8'
            },
            method: 'POST'
        });
    };

    obj.refresh_token = function () {
        const token = obj.getItem('token');
        if (!(token && token.refresh_token)) {
            return Promise.reject();
        }
        if (obj.tokenExpires(token)) {
            return Promise.resolve();
        }
        return fetch('https://api.aliyundrive.com/token/refresh', {
            body: JSON.stringify({
                refresh_token: token.refresh_token
            }),
            headers: {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json',
            },
            method: 'POST'
        }).then(res => res.json()).then(response => {
            localStorage.setItem('token', response);
            return response;
        });
    };

    obj.get_share_token = function () {
        const shareToken = obj.getItem('shareToken');
        if (obj.tokenExpires(shareToken)) {
            return Promise.resolve();
        }
        return fetch('https://api.aliyundrive.com/v2/share_link/get_share_token', {
            body: JSON.stringify({
                share_id: obj.getShareId(),
                share_pwd: ''
            }),
            headers: {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json',
            },
            method: 'POST'
        }).then(res => res.json()).then(response => {
            localStorage.setItem('shareToken', response);
            return response;
        });
    };

    obj.tokenExpires = function (token) {
        const t = token.expire_time, i = Number(token.expires_in), e = Date.parse(t) - Date.now();
        if (0 < e && e < 1e3 * i) return !0;
        return !1;
    };

    obj.getItem = function (key) {
        try {
            return JSON.parse(window.localStorage.getItem(key));
        } catch (error) {
            return obj.settings[key];
        }
    };

    obj.setItem = function (key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            obj.settings[key] = value;
        }
    };

    obj.removeItem = function (key) {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            delete this.settings[key];
        }
    };

    obj.isSharePage = function () {
        return location.href.indexOf("aliyundrive.com/s/") > 0 || location.href.indexOf("alipan.com/s/") > 0;
    };

    obj.getShareId = function () {
        const match = location.href.match(/[aliyundrive|alipan]\.com\/s\/([a-zA-Z\d]+)/);
        return match ? match[1] : null;
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

            var style = document.createElement('style');
            style.textContent = css.join(" ");
            (document.head || document.documentElement).appendChild(style);

            var notifyDiv = document.createElement('div');
            notifyDiv.id = 'J_Notify';
            notifyDiv.className = 'notify';
            notifyDiv.style.cssText = 'width: 650px; margin: 10px auto; display: none;';
            document.body.appendChild(notifyDiv);

            unsafeWindow.application = {
                notifySets: {
                    type_class_obj: {success: "alert-success", fail: "alert-fail", loading: "alert-loading"},
                    count: 0,
                    delay: 3e3
                },
                showNotify: function(opts) {
                    var that = this,
                        class_obj = that.notifySets.type_class_obj,
                        count = that.notifySets.count,
                        notifyEl = document.getElementById('J_Notify'),
                        alertEl;

                    if (opts.type == "loading") {
                        that.notifySets.delay *= 5;
                    }

                    if (!notifyEl.querySelector('.alert')) {
                        notifyEl.innerHTML = '<div class="alert in fade"></div>';
                        notifyEl.style.display = 'block';
                    } else {
                        Object.keys(class_obj).forEach(function(key) {
                            notifyEl.classList.remove(class_obj[key]);
                        });
                    }

                    alertEl = notifyEl.querySelector('.alert');
                    alertEl.textContent = opts.message;
                    alertEl.classList.add(class_obj[opts.type]);
                    that.notifySets.count += 1;

                    var delay = opts.time || that.notifySets.delay;
                    setTimeout(function() {
                        if (++count == that.notifySets.count) {
                            that.hideNotify();
                        }
                    }, delay);
                },
                hideNotify: function() {
                    var notifyEl = document.getElementById('J_Notify');
                    notifyEl.innerHTML = '';
                    notifyEl.style.display = 'none';
                }
            };
            obj.showNotify(opts);
        }
    };

    obj.hideNotify = function () {
        if (unsafeWindow.application) {
            unsafeWindow.application.hideNotify();
        }
    };

    obj.run = function () {
        obj.httpListener();
    }();

    console.info("=== 阿里云盘 好棒棒！===");

    // Your code here...
})();
