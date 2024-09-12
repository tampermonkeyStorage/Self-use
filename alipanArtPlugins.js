window.alipanArtPlugins = window.alipanArtPlugins || function(t) {
    var obj = {
        version: '1.0.2'
    };

    obj.init = (options) => {
        return Promise.all([
            obj.readyHls(),
            obj.readyArtplayer(),
            obj.readyM3u8Parser(),
        ]).then(() => {
            return obj.initArtplayer(options);
        });
    };

    obj.readyHls = function () {
        const Hls = window.Hls || unsafeWindow.Hls;
        if (Hls) {
            return Promise.resolve();
        }
        else {
            return obj.loadJs("https://unpkg.com/hls.js/dist/hls.min.js");
        }
    };

    obj.readyArtplayer = function () {
        const Artplayer = window.Artplayer || unsafeWindow.Artplayer;
        if (Artplayer) {
            return Promise.resolve();
        }
        else {
            return obj.loadJs("https://unpkg.com/artplayer/dist/artplayer.js");
        }
    };

    obj.readyM3u8Parser = function () {
        const m3u8Parser = window.m3u8Parser || unsafeWindow.m3u8Parser;
        if (m3u8Parser) {
            return Promise.resolve();
        }
        else {
            return obj.loadJs("https://unpkg.com/m3u8-parser/dist/m3u8-parser.min.js");
        }
    };

    obj.initArtplayer = function (options) {
        options = obj.initOption(options);
        if (!(Array.isArray(options.quality) && options.quality.find(item => item?.url))) {
            alert('获取播放信息失败，请刷新网页重试');
            return Promise.reject('No available playUrl');
        }

        const Artplayer = window.Artplayer || unsafeWindow.Artplayer;
        Object.assign(Artplayer, {
            PLAYBACK_RATE: [0.5, 0.75, 1, 1.25, 1.5, 2.0, 3.0, 4.0, 5.0],
            ASPECT_RATIO: ['default', '4:3', '16:9', '自动拉伸'],
        });
        const art = new Artplayer(options, (art) => {
            if (t.length % 8 !== t.length) {
                t.forEach((k) => {
                    art.plugins.add(k());
                });
            }
        });
        return Promise.resolve(art);
    };

    obj.initOption = function (options) {
        const details = {
            container: '#artplayer',
            url: '',
            quality: [],
            type: 'hls',
            autoplay: true,
            autoPlayback: true,
            aspectRatio: true,
            contextmenu: [
                {
                    html: '检查更新',
                    click: function (contextmenu, event) {
                        window.open('https://scriptcat.org/zh-CN/script-show-page/162', '_blank');
                        contextmenu.show = false;
                    },
                },
                {
                    html: '加油作者',
                    click: function (contextmenu, event) {
                        this?.plugins?.aifadian.show();
                        contextmenu.show = false;
                    },
                },
            ],
            customType: {
                hls: function (video, url, art) {
                    const Hls = window.Hls || unsafeWindow.Hls;
                    if (Hls.isSupported()) {
                        if (art.hls) art.hls.destroy();
                        const hls = new Hls({
                            maxBufferLength: 30 * 2,
                        });
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        art.hls = hls;
                        art.on('destroy', () => hls.destroy());
                    }
                    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                    }
                    else {
                        art.notice.show = 'Unsupported playback format: m3u8';
                    }
                },
            },
            flip: true,
            icons: {
                loading: '<img src="https://artplayer.org/assets/img/ploading.gif">',
                state: '<img width="150" heigth="150" src="https://artplayer.org/assets/img/state.svg">',
                indicator: '<img width="16" heigth="16" src="https://artplayer.org/assets/img/indicator.svg">',
            },
            id: "",
            pip: true,
            playbackRate: true,
            screenshot: true,
            setting: true,
            subtitle: {
                url: '',
                type: 'vtt',
                style: {
                    color: '#fe9200',
                    fontSize: '25px',
                },
                encoding: 'utf-8',
            },
            subtitleOffset: false,
            hotkey: true,
            fullscreen: true,
            fullscreenWeb: true,
        };

        const { video_info, video_file, video_items } = options || {};
        const file = video_file || {}, id = file.file_id;
        if (id) {
            Object.assign(details, { file, id });
        }

        const {
            live_transcoding_subtitle_task_list,
            live_transcoding_task_list,
            meta,
            quick_video_list,
            quick_video_subtitle_list,
        } = video_info?.video_preview_play_info || {};

        const quality = quick_video_list || live_transcoding_task_list;
        if (Array.isArray(quality) && quality.length) {
            const templates = {
                QHD: "2K 超清",
                QHD: '1440 超清',
                FHD: '1080 全高清',
                HD: '720 高清',
                SD: '540 标清',
                LD: '360 流畅'
            };
            quality.forEach((item, index) => {
                Object.assign(item, {
                    html: templates[item.template_id] + (item.description ? '（三方VIP）' : !item.url ? '（VIP）' : ''),
                    type: 'hls'
                });
            });
            quality.sort((a, b) => a.template_height - b.template_height);
            quality.findLast(item => item.url).default = !0;
            Object.assign(details, { quality });
        }
        else {
            return details;
        }

        const { url, type } = quality.find((item) => item.default) || quality[0] || {};
        if (url && type) {
            Object.assign(details, { url, type });
        }
        else {
            return details;
        }

        const subtitlelist = quick_video_subtitle_list || live_transcoding_subtitle_task_list;
        if (Array.isArray(subtitlelist) && subtitlelist.length) {
            const templates = {
                chi: '中文字幕',
                eng: '英文字幕',
                jpn: '日文字幕'
            };
            subtitlelist.forEach(function (item, index) {
                Object.assign(item, {
                    html: (templates[item.language] || item.language || '未知语言') + '（vtt）',
                    name: '内置字幕',
                    type: "vtt"
                });
            });
            (subtitlelist.find(item => ['chi'].includes(item.language)) || subtitlelist.find(item => item.url) || {}).default = !0;
            Object.assign(details, { subtitlelist });
        }

        const playlist = video_items || [];
        if (Array.isArray(playlist) && playlist.length) {
            (playlist.find(item => item.file_id === id) || {}).default = !0;
            Object.assign(details, { playlist });
        }

        return details;
    };

    obj.loadJs = function (src) {
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

    console.info(`%c alipanArtPlugins %c ${obj.version} %c https://scriptcat.org/zh-CN/users/13895`, "color: #fff; background: #5f5f5f", "color: #fff; background: #4bc729", "")

    return obj;
}([
    function HlsEvents() {
        return (art) => {
            const Hls = window.Hls || unsafeWindow.Hls;
            const { hls, option, notice } = art;
            var now = Date.now()
            , fragLoadError = 0;

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    notice.show = `当前带宽: ${Math.round(hls.bandwidthEstimate / 1024 / 1024 / 8 * 100) / 100} MB/s`;

                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                hls.loadSource(hls.url);
                            }
                            else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
                                if (++fragLoadError < 10) {
                                    hls.loadSource(hls.url);
                                    hls.media.currentTime = art.currentTime;
                                    hls.media.play();
                                }
                            }
                            else {
                                hls.startLoad();
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            notice.show = '视频播放异常，请刷新重试';
                            hls.destroy();
                            break;
                    }
                }
                else {
                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
                                if (isUrlExpires(hls.url)) {
                                    fragLoadError = 0;
                                    now = Date.now();
                                    hls.stopLoad();
                                    art.emit('reload-start', option.quality);
                                }
                            }
                            break;
                        default:
                            break;
                    }
                }
            });

            function isUrlExpires(e) {
                var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 6e3
                , n = e.match(/&x-oss-expires=(\d+)&/);
                if (n) {
                    return +"".concat(n[1], "000") - t < Date.now();
                }
                else {
                    return Date.now() - now > 300 * 1000 - t;
                }
            }

            function loadStreaming(quality) {
                option.quality = quality;

                const url = hls.url = (quality.find((item) => {
                    return item.default;
                }) || quality.findLast(item => item.url) || {}).url;

                fetch(url).then((response) => {
                    return response.ok ? response.text() : Promise.reject();
                }).then((data) => {
                    const m3u8Parser = window.m3u8Parser || unsafeWindow.m3u8Parser;
                    const parser = new m3u8Parser.Parser();
                    parser.push(data);
                    parser.end();

                    const refurl = url.replace(/media.m3u8.+/, "");
                    const segments = parser.manifest.segments;
                    const fragments = hls.bufferController.details.fragments;
                    fragments.forEach(function (item, index) {
                        const segment = segments[index];
                        Object.assign(item, {
                            baseurl: url,
                            relurl: segment.uri,
                            url: refurl + segment.uri,
                        });
                    });

                    hls.startLoad(art.currentTime);
                }).catch((err) => {
                    notice.show = err;
                    throw err;
                });
            }

            art.on('reload-can', (quality) => {
                loadStreaming(quality);
            });

            return {
                name: 'hlsevents'
            };
        }
    },
    function Quality() {
        return function (art) {
            const { controls, option, notice, i18n } = art;

            function update() {
                const qualityDefault = option.quality.find((item) => item.default) || option.quality.findLast(item => item.url);
                controls.update({
                    name: 'quality',
                    html: qualityDefault ? qualityDefault.html : '',
                    selector: option.quality,
                    onSelect: function (item) {
                        if (item.url) {
                            art.switchQuality(item.url);
                            notice.show = `${i18n.get('Switch Video')}: ${item.html}`;
                        }
                        else {
                            notice.show = item.description || '视频地址不可用';
                        }
                    }
                });
            }

            update();
            art.on('playlist-switch-can', () => {
                setTimeout(update, 1e3);
            });
            art.on('reload-can', () => {
                setTimeout(update, 1e3);
            });

            return {
                name: 'quality'
            };
        };
    },
    function Playlist() {
        return function (art) {
            const { option, notice } = art;
            if (!(option.playlist && option.playlist.length > 1)) return;

            const options = {
                showtext: true,
                icon: '<i class="art-icon"><svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M810.666667 384H85.333333v85.333333h725.333334V384z m0-170.666667H85.333333v85.333334h725.333334v-85.333334zM85.333333 640h554.666667v-85.333333H85.333333v85.333333z m640-85.333333v256l213.333334-128-213.333334-128z" fill="#ffffff"></path></svg></i>',
                onchanged: (fileOption) => {
                    option.file = fileOption;
                    art.emit('playlist-switch-start', fileOption);
                }
            };

            var currentEp = option.playlist.findIndex((playinfo) => playinfo.default);

            art.controls.add({
                html: options.showtext ? '播放列表' : options.icon,
                name: 'play-list',
                position: 'right',
                style: {
                    paddingLeft: '10px',
                    paddingRight: '10px',
                },
                selector: option.playlist.map((videoInfo, index) => {
                    return {
                        html: videoInfo.name,
                        style: {
                            textAlign: 'left'
                        },
                        index: index,
                        default: currentEp === index
                    };
                }),
                onSelect: (item) => {
                    changeVideo(currentEp = item.index);
                    return options.showtext ? '播放列表' : options.icon;
                }
            });

            function changeVideo(index) {
                if (!option.playlist[index]) {
                    if (index >= option.playlist.length) {
                        art.notice.show = '没有下一集了';
                    }
                    return;
                }
                if (typeof options.onchanged === 'function') {
                    options.onchanged(option.playlist[index]);
                }
            }

            function getQuality(task_list) {
                if (Array.isArray(task_list) && task_list.length) {
                    let templates = {
                        QHD: "2K 超清",
                        FHD: "1080 全高清",
                        HD: "720 高清",
                        SD: "540 标清",
                        LD: "360 流畅"
                    };
                    task_list.forEach((item, index) => {
                        Object.assign(item, {
                            html: templates[item.template_id] + (item.description ? '（三方VIP）' : !item.url ? '（VIP）' : ''),
                            type: 'hls'
                        });
                    });
                    task_list.sort((a, b) => a.template_height - b.template_height);
                    task_list.findLast(item => item.url).default = !0;
                    return task_list;
                }
                return [];
            };

            function getSubtitle(task_list) {
                if (Array.isArray(task_list) && task_list.length) {
                    const templates = {
                        chi: '中文字幕',
                        eng: '英文字幕',
                        jpn: '日文字幕'
                    };
                    task_list.forEach(function (item, index) {
                        Object.assign(item, {
                            html: (templates[item.language] || item.language || '未知语言') + '（vtt）',
                            name: '内置字幕',
                            type: "vtt"
                        });
                    });
                    (task_list.find(item => ['chi'].includes(item.language)) || task_list[0] || {}).default = !0;
                    return task_list;
                }
                return [];
            };

            art.on('playlist-switch-can', (playOption) => {
                const { file_id: id, name } = option.file || {};
                const {
                    live_transcoding_subtitle_task_list,
                    live_transcoding_task_list,
                    meta,
                    quick_video_list,
                    quick_video_subtitle_list,
                } = playOption?.video_preview_play_info || {};

                const quality = getQuality(quick_video_list || live_transcoding_task_list);
                if (quality.length) {
                    const { url, type } = quality.find((item) => item.default) || quality[0] || {};
                    Object.assign(option, { id, quality, url, type });

                    art.switchUrl(url).then(() => {
                        (document.querySelector("[class^=header-file-name], [class^=header-center] div span") || {}).innerText = name;
                        notice.show = `切换视频: ${name}`;
                    }).catch(() => {
                        notice.show = `视频地址不可用: ${name}`;
                    });
                }
                else {
                    return alert('获取播放信息失败，无法切换视频');
                }

                option.subtitlelist = getSubtitle(live_transcoding_subtitle_task_list);
            });

            art.on('video:ended', () => {
                if (art.storage.get('auto-next') && currentEp < options.playlist.length) {
                    changeVideo(currentEp += 1);
                }
            });

            return {
                name: 'playlist'
            };
        };
    },
    function AutoNext() {
        return function (art) {
            const autoNext = art.storage.get('auto-next');

            art.setting.add({
                html: '自动连播',
                name: 'auto-next',
                icon: '<img width="22" heigth="22" src="https://artplayer.org/assets/img/state.svg">',
                tooltip: !autoNext ? '关闭' : '开启',
                switch: !!autoNext,
                onSwitch: function (item) {
                    item.tooltip = item.switch ? '关闭' : '开启';
                    art.storage.set('auto-next', !item.switch);
                    art.notice.show = "自动连续播放：" + (item.switch ? '关闭' : '开启');
                    return !item.switch;
                }
            });

            return {
                name: 'autonext'
            };
        };
    },
    function Subtitle() {
        return (art) => {
            const { controls, subtitle, template, option, notice } = art;

            const options = {
                showtext: true,
                icon: '<i class="art-icon"><svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 48 48"><path d="M0 0h48v48H0z" fill="none"/><path fill="#ffffff" d="M40 8H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zM8 24h8v4H8v-4zm20 12H8v-4h20v4zm12 0h-8v-4h8v4zm0-8H20v-4h20v4z"/></svg></i>'
            };

            function update(sublist = []) {
                const subtitleOption = Object.assign({}, option.subtitle, sublist.find((element) => element.default) || sublist[0] || {});
                const { url, type } = subtitleOption;
                Object.assign(option.subtitle, { url, type });
                subtitle.init({
                    ...subtitleOption
                }).then(() => {
                    notice.show = '加载字幕成功';
                });

                controls.update({
                    html: options.showtext ? '字幕列表' : options.icon,
                    name: 'subtitle-list',
                    position: 'right',
                    style: {
                        paddingLeft: '10px',
                        paddingRight: '10px',
                    },
                    selector: sublist.map((item, index) => {
                        return {
                            ...item
                        };
                    }),
                    onSelect: function (item, $dom) {
                        const { url, type } = item;
                        Object.assign(option.subtitle, { url, type });
                        subtitle.switch(item.url, item);
                        return item.html;
                    }
                });
            }

            function toObjectURL(url) {
                if (url instanceof File || url instanceof Blob) {
                    return blobToUrl(url);
                }
                else {
                    return fetch(url, {
                        referrer: location.protocol + "//" + location.host + "/",
                        referrerPolicy: "origin",
                        body: null,
                        method: "GET",
                        mode: "cors",
                        credentials: "omit"
                    }).then(data => data.blob()).then(blob => {
                        return blobToUrl(blob);
                    });
                }
            }

            function blobToUrl(blob) {
                return blobToText(blob).then(text => {
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    return url;
                });
            }

            function blobToText(blob) {
                return new Promise((resolve, reject) => {
                    var reader = new FileReader();
                    reader.readAsText(blob, "UTF-8");
                    reader.onload = function (e) {
                        var result = reader.result;
                        if (result.indexOf("�") > -1 && !reader.markGBK) {
                            reader.markGBK = true;
                            return reader.readAsText(blob, "GBK");
                        }
                        else if (result.indexOf("") > -1 && !reader.markBIG5) {
                            reader.markBIG5 = true;
                            return reader.readAsText(blob, "BIG5");
                        }
                        resolve(result);
                    };
                    reader.onerror = function (error) {
                        reject(error);
                    };
                });
            }

            function ajax(url, options = {}) {
                Object.assign(options, {
                    responseType: options.responseType || 'json',
                    data: options.data instanceof Object ? Object.keys(options.data).map((k) => {
                        return encodeURIComponent(k) + "=" + encodeURIComponent(options.data[k]).replace("%20", "+");
                    }).join("&") : options.data
                });
                return new Promise(function (resolve, reject) {
                    GM_xmlhttpRequest({
                        url,
                        ...options,
                        onload: function (result) {
                            if (parseInt(result.status / 100) === 2) {
                                resolve(result.response);
                            }
                            else {
                                reject(result.response);
                            }
                        },
                        onerror: function (result) {
                            reject(result.error);
                        }
                    });
                });
            }

            function localFile(node) {
                node.click();
                return new Promise(function (resolve, reject) {
                    node.onchange = (event) => {
                        if (event.target.files.length) {
                            const file = event.target.files[0];
                            const type = file.name.split(".").pop().toLowerCase();
                            blobToUrl(file).then(url => {
                                const subtitleOption = {
                                    url,
                                    type,
                                    name: file.name,
                                    html: '本地字幕（' + type + '）',
                                };
                                resolve(subtitleOption);
                            });
                        }
                        event.target.value = "";
                    }
                });
            }

            function append(parent, child) {
                if (child instanceof Element) {
                    Node.prototype.appendChild.call(parent, child);
                }
                else {
                    parent.insertAdjacentHTML("beforeend", String(child));
                }
                return parent.lastElementChild || parent.lastChild;
            }

            template.$subtitleLocalFile = append(template.$container, '<input class="subtitleLocalFile" type="file" accept="webvtt,.vtt,.srt,.ssa,.ass" style="display: none;">');
            art.setting.add({
                width: 220,
                html: '字幕设置',
                name: 'subtitle-setting',
                tooltip: '显示',
                icon: '<img width="22" heigth="22" src="https://artplayer.org/assets/img/subtitle.svg">',
                selector: [
                    {
                        html: '显示',
                        tooltip: '显示',
                        switch: true,
                        onSwitch: function (item) {
                            item.tooltip = item.switch ? '隐藏' : '显示';
                            art.subtitle.show = !item.switch;
                            return !item.switch;
                        },
                    },
                    {
                        html: '字幕偏移',
                        name: 'subtitle-offset',
                        tooltip: '0s',
                        range: [0, -5, 5, 0.1],
                        onChange(item) {
                            art.subtitleOffset = item.range;
                            return item.range + 's';
                        },
                    },
                    {
                        html: '字幕位置',
                        name: 'subtitle-bottom',
                        tooltip: '5%',
                        range: [5, 1, 90, 1],
                        onChange(item) {
                            art.subtitle.style({ bottom: item.range + '%' });
                            return item.range + '%';
                        },
                    },
                    {
                        html: '字体大小',
                        name: 'subtitle-fontSize',
                        tooltip: '25px',
                        range: [25, 10, 60, 1],
                        onChange(item) {
                            art.subtitle.style({fontSize: item.range + 'px'});
                            return item.range + 'px';
                        },
                    },
                    {
                        html: '字体粗细',
                        name: 'subtitle-fontWeight',
                        tooltip: '400',
                        range: [4, 1, 9, 1],
                        onChange(item) {
                            const range = item.range * 100;
                            art.subtitle.style({fontWeight: range});
                            return range;
                        },
                    },
                    {
                        html: '字体颜色',
                        name: 'subtitle-color',
                        tooltip: '',
                        selector: [
                            {
                                name: 'color-presets',
                                html: '<style>.panel-setting-color label{font-size: 0;padding: 6px;display: inline-block;}.panel-setting-color input{display: none;}.panel-setting-color span{width: 22px;height: 22px;display: inline-block;border-radius: 50%;box-sizing: border-box;cursor: pointer;}</style><div class="panel-setting-color"><label><input type="radio" value="#fff"><span style="background: #fff;"></span></label><label><input type="radio" value="#e54256"><span style="background: #e54256"></span></label><label><input type="radio" value="#ffe133"><span style="background: #ffe133"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#64DD17"><span style="background: #64DD17"></span></label><label><input type="radio" value="#39ccff"><span style="background: #39ccff"></span></label><label><input type="radio" value="#D500F9"><span style="background: #D500F9"></span></label></div>',
                            },
                            {
                                name: 'color-default',
                                html: '默认颜色',
                            },
                            {
                                name: 'color-picker',
                                html: '颜色选择器',
                            },
                        ],
                        onSelect: function (item, $dom, event) {
                            switch(item.name) {
                                case "color-presets":
                                    if (event.target.nodeName === 'INPUT') {
                                        subtitle.style({ color: event.target.value });
                                    }
                                    break;
                                case "color-default":
                                    subtitle.style({ color: '#FE9200' });
                                    break;
                                case "color-picker":
                                    if (!template.$colorPicker) {
                                        template.$colorPicker = append(template.$player, '<input hidden type="color">');
                                        template.$colorPicker.oninput = (event) => {
                                            subtitle.style({ color: event.target.value });
                                        };
                                    }
                                    template.$colorPicker.click();
                                    break;
                                default:
                                    break;
                            }
                            return '<label style="display: flex;"><span style="width: 18px;height: 18px;display: inline-block;border-radius: 50%;box-sizing: border-box;cursor: pointer;background: ' + template.$subtitle.style.color + ';"></span></label>'
                            //return false;
                        }
                    },
                    {
                        html: '字体类型',
                        name: 'subtitle-fontFamily',
                        selector: [
                            {
                                html: '默认',
                                text: ''
                            },
                            {
                                html: '等宽 衬线',
                                text: '"Courier New", Courier, "Nimbus Mono L", "Cutive Mono", monospace'
                            },
                            {
                                html: '比例 衬线',
                                text: '"Times New Roman", Times, Georgia, Cambria, "PT Serif Caption", serif'
                            },
                            {
                                html: '等宽 无衬线',
                                text: '"Deja Vu Sans Mono", "Lucida Console", Monaco, Consolas, "PT Mono", monospace'
                            },
                            {
                                html: '比例 无衬线',
                                text: '"YouTube Noto", Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif'
                            },
                            {
                                html: 'Casual',
                                text: '"Comic Sans MS", Impact, Handlee, fantasy'
                            },
                            {
                                html: 'Cursive',
                                text: '"Monotype Corsiva", "URW Chancery L", "Apple Chancery", "Dancing Script", cursive'
                            },
                            {
                                html: 'Small Capitals',
                                text: '"Arial Unicode Ms", Arial, Helvetica, Verdana, "Marcellus SC", sans-serif'
                            }
                        ],
                        onSelect: function (item, $dom, event) {
                            art.subtitle.style({fontFamily: item.text});
                            return item.html;
                        }
                    },
                    {
                        html: '描边样式',
                        name: 'subtitle-textShadow',
                        selector: [
                            {
                                html: '默认',
                                text: 'rgb(0 0 0) 1px 0 1px, rgb(0 0 0) 0 1px 1px, rgb(0 0 0) -1px 0 1px, rgb(0 0 0) 0 -1px 1px, rgb(0 0 0) 1px 1px 1px, rgb(0 0 0) -1px -1px 1px, rgb(0 0 0) 1px -1px 1px, rgb(0 0 0) -1px 1px 1px'
                            },
                            {
                                html: '重墨',
                                text: 'rgb(0, 0, 0) 1px 0px 1px, rgb(0, 0, 0) 0px 1px 1px, rgb(0, 0, 0) 0px -1px 1px, rgb(0, 0, 0) -1px 0px 1px'
                            },
                            {
                                html: '描边',
                                text: 'rgb(0, 0, 0) 0px 0px 1px, rgb(0, 0, 0) 0px 0px 1px, rgb(0, 0, 0) 0px 0px 1px'
                            },
                            {
                                html: '45°投影',
                                text: 'rgb(0, 0, 0) 1px 1px 2px, rgb(0, 0, 0) 0px 0px 1px'
                            },
                            {
                                html: '阴影',
                                text: 'rgb(34, 34, 34) 1px 1px 1.4875px, rgb(34, 34, 34) 1px 1px 1.98333px, rgb(34, 34, 34) 1px 1px 2.47917px'
                            },
                            {
                                html: '凸起',
                                text: 'rgb(34, 34, 34) 1px 1px'
                            },
                            {
                                html: '下沉',
                                text: 'rgb(204, 204, 204) 1px 1px, rgb(34, 34, 34) -1px -1px'
                            },
                            {
                                html: '边框',
                                text: 'rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px'
                            }
                        ],
                        onSelect: function (item, $dom, event) {
                            art.subtitle.style({textShadow: item.text});
                            return item.html;
                        }
                    },
                    {
                        name: 'subtitle-localfile',
                        html: '加载本地字幕',
                        selector: [
                            {
                                html: '文件',
                                name: 'file',
                            },
                        ],
                        onSelect: function (item, $dom, event) {
                            if (item.name === 'file') {
                                localFile(template.$subtitleLocalFile).then((subtitleOption) => {
                                    option.subtitlelist = (option.subtitlelist || []).concat([ subtitleOption ]);
                                    update(option.subtitlelist);
                                });
                            }

                            return false;
                        }
                    },
                ]
            });

            if ((option.subtitlelist || []).length) {
                update(option.subtitlelist);
            }
            art.on('restart', () => {
                if ((option.subtitlelist || []).length) {
                    update(option.subtitlelist);
                }
                else {
                    controls['subtitle-list'] && controls.remove('subtitle-list');
                }
            });
            art.on('subtitlelist-add', (sublist) => {
                option.subtitlelist = (option.subtitlelist || []).concat(sublist);
                if ((option.subtitlelist || []).length) {
                    update(option.subtitlelist);
                }
            });

            return {
                name: 'subtitle'
            };
        }
    },
    function Libass() {
        return (art) => {
            function switchTrack() {
                return initLibass().then(() => {
                    const { url, type } = art?.option?.subtitle || {};
                    if (url && (type === 'ass' || type === 'ssa')) {
                        setTrackByUrl(url);
                        show();
                    }
                    else {
                        hide();
                        art.libass.freeTrack();
                    }
                }).catch((error) => {
                    console.error("加载特效字幕组件 错误！", error);
                });
            }

            function setTrackByUrl(url) {
                if (art.libass && url) {
                    art.libass.freeTrack();
                    art.libass.setTrackByUrl(url);
                }
            }

            function setTrack(content) {
                if (art.libass && content) {
                    art.libass.freeTrack();
                    art.libass.setTrack(content);
                }
            }

            function setOffset(timeOffset) {
                if (art.libass) {
                    art.libass.timeOffset = timeOffset;
                }
            }

            function show() {
                if (art.libass && art.subtitle.show) {
                    art.template.$subtitle.style.display = 'none';
                    (art.libass.canvasParent || art.libass._canvasParent).style.display = 'block';
                    art.libass.resize();
                }
            }

            function hide() {
                if (art.libass) {
                    art.template.$subtitle.style.display = art.subtitle.show ? 'block' : 'none';
                    (art.libass.canvasParent || art.libass._canvasParent).style.display = 'none';
                }
            }

            function destroy() {
                if (art.libass) {
                    art.libass.destroy && art.libass.destroy();
                    art.libass.dispose && art.libass.dispose();
                    art.libass = null;
                }
            }

            function initLibass() {
                if (art.libass) return Promise.resolve(art.libass);

                const options = {
                    video: art.template.$video,
                    subContent: `[Script Info]\nScriptType: v4.00+`,
                    subUrl: '',
                    availableFonts: {
                        '思源黑体': 'https://artplayer.org/assets/misc/SourceHanSansCN-Bold.woff2',
                    }
                };

                return getLocalFonts().then(fontData => {
                    const fonts = fontData.filter(item => item.fullName.match(/[\u4e00-\u9fa5]/));
                    const fallbackFont = fonts.find(font => [
                        '微软雅黑',
                    ].some(name => font?.fullName === name))?.fullName || fonts.sort(() => 0.5 - Math.random())[0]?.fullName;
                    Object.assign(options, {
                        useLocalFonts: true,
                        fallbackFont: fallbackFont,
                    });
                    return loadLibass(options);
                }, () => {
                    Object.assign(options, {
                        fallbackFont: Object.keys(options.availableFonts)[0]
                    });
                    return loadLibass(options);
                });
            }

            function loadLibass(options) {
                let jassubUrl = 'https://unpkg.com/jassub@1.7.17/dist/jassub.umd.js';
                return loadJs(jassubUrl).then(() => {
                    Object.assign(options, {
                        workerUrl: new URL('jassub-worker.js', jassubUrl).href,
                        wasmUrl: new URL('jassub-worker.wasm', jassubUrl).href,
                        legacyWorkerUrl: new URL('jassub-worker.wasm.js', jassubUrl).href,
                        modernWasmUrl: new URL('jassub-worker-modern.wasm', jassubUrl).href
                    });

                    return loadWorker(options).then((workerUrl) => {
                        options.workerUrl = workerUrl;
                        art.libass = new unsafeWindow.JASSUB(options);
                        const canvasParent = art.libass.canvasParent || art.libass._canvasParent;
                        canvasParent.style.cssText = `position: absolute;top: 0;left: 0;width: 100%;height: 100%;user-select: none;pointer-events: none;z-index: 20;`;
                        return art.libass;
                    });
                });
            }

            function loadWorker({ workerUrl }) {
                return fetch(workerUrl).then(res => res.text()).then(text => {
                    const workerBlob = new Blob([text], { type: 'text/javascript' });
                    const workerScriptUrl = URL.createObjectURL(workerBlob);
                    setTimeout(() => {
                        URL.revokeObjectURL(workerScriptUrl);
                    });
                    return workerScriptUrl;
                });
            }

            function getLocalFonts(postscriptNames) {
                if (unsafeWindow.queryLocalFonts) {
                    const options = {};
                    if (postscriptNames) {
                        options.postscriptNames = Array.isArray(postscriptNames) ? postscriptNames : [postscriptNames]
                    }
                    return unsafeWindow.queryLocalFonts(options).then(fontData => {
                        return fontData && fontData.length ? fontData : Promise.reject();
                    });
                }
                console.warn('Not Local fonts API');
                return Promise.reject();
            }

            function loadJs(src) {
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

            art.on('subtitle', (state) => {
                state ? show() : hide();
            });
            art.on('subtitleLoad', switchTrack);
            art.on('subtitleOffset', (timeOffset) => {
                setOffset(timeOffset);
            });
            art.on('restart', () => {
                art.libass && art.libass.freeTrack();
            });

            art.once('destroy', destroy);

            return {
                name: 'libass'
            };
        }
    },
    function Sound() {
        return (art) => {
            const { template, setting, storage, notice } = art;

            function init() {
                const Joysound = window.Joysound || unsafeWindow.Joysound;
                if (Joysound && Joysound.isSupport()) {
                    art.joySound = art.joySound || new Joysound();
                    art.joySound.hasSource() || art.joySound.init(template.$video);
                    if (art.storage.get('sound-enhancer')) {
                        art.joySound.setEnabled(!0);
                        setting.update({
                            name: 'sound-enhancer',
                            html: '音质增强',
                            switch: true,
                        });
                    }
                }
            }

            const soundEnhancer = art.storage.get('sound-enhancer');
            setting.add({
                width: 220,
                html: '声音设置',
                name: 'sound-setting',
                tooltip: '正常',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" height="22" width="22" data-spm-anchor-id="0.0.0.i11.83206c7554HZzm"><path d="M10.188 4.65 6 8H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1l4.188 3.35a.5.5 0 0 0 .812-.39V5.04a.498.498 0 0 0-.812-.39zm4.258-.872a1 1 0 0 0-.862 1.804 6.002 6.002 0 0 1-.007 10.838 1 1 0 0 0 .86 1.806A8.001 8.001 0 0 0 19 11a8.001 8.001 0 0 0-4.554-7.222z"></path><path d="M15 11a3.998 3.998 0 0 0-2-3.465v6.93A3.998 3.998 0 0 0 15 11z"></path></svg>',
                selector: [
                    {
                        html: '音质增强',
                        name: 'sound-enhancer',
                        tooltip: !soundEnhancer ? '关闭' : '开启',
                        switch: !!soundEnhancer,
                        onSwitch: function (item) {
                            item.tooltip = item.switch ? '关闭' : '开启';
                            art.storage.set('sound-enhancer', !item.switch);
                            art.joySound && art.joySound.setEnabled(!item.switch);
                            notice.show = "音质增强：" + (item.switch ? '关闭' : '开启');
                            return !item.switch;
                        }
                    },
                    {
                        html: '音量增强',
                        name: 'volume-enhancer',
                        tooltip: '0x',
                        range: [0, 0, 10, .1],
                        onRange: function (item) {
                            const range = item.range / 10;
                            art.joySound && art.joySound.setVolume(range);
                            notice.show = "音量增强：" + (100 + range * 100) + "%";
                            return item.range + 'x';
                        },
                    },
                ]
            });

            art.once('video:playing', init);

            return {
                name: 'sound'
            };
        }
    },
    function Aifadian() {
        return (art) => {
            const localforage = window.localforage || unsafeWindow.localforage;
            let timer;

            function init() {
                const startTime = new Date();
                timer = setInterval(() => {
                    const currentTime = new Date();
                    const timeDiff = currentTime - startTime;
                    const elapsedMinutes = Math.floor((timeDiff / 1000 / 60) % 60);
                    if (!(elapsedMinutes % 9) && art.playing) {
                        sponsor().catch((error) => {
                            art.pause();
                            show();
                        });
                    }
                }, 6e3);
            }

            function destroy() {
                clearInterval(timer);
            }

            function show() {
                let dialog = document.createElement('div');
                dialog.innerHTML = '<div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle1" style=""><div role="document" class="ant-modal modal-wrapper--5SA7y" style="width: 340px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle1">请少量赞助以支持我更好的创作</div></div><div class="ant-modal-body"><div class="content-wrapper--S6SNu"><div>爱发电订单号：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="" action="click" type="text" class="ifdian-order ant-input ant-input-borderless" style="background-color: var(--divider_tertiary);"></span></div><div class="content-wrapper--S6SNu"><div>请输入爱发电订单号，确认即可</div><a href="https://ifdian.net/order/create?plan_id=be4f4d0a972811eda14a5254001e7c00" target="_blank"> 前往爱发电 </a><a href="https://ifdian.net/dashboard/order" target="_blank"> 复制订单号 </a></div></div><div class="ant-modal-footer"><div class="footer--cytkB"><button class="button--WC7or secondary--vRtFJ small--e7LRt cancel-button--c-lzN">取消</button><button class="button--WC7or primary--NVxfK small--e7LRt">确定</button></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div>';
                document.body.insertBefore(dialog, null);
                dialog.querySelectorAll('button').forEach((element, index) => {
                    element.addEventListener('click', () => {
                        if (index == 0) {
                            document.body.removeChild(dialog);
                        }
                        else {
                            let value = dialog.querySelector('input').value;
                            if (value) {
                                if (value.match(/^202[\d]{22,25}$/)) {
                                    if (value.match(/(\d)\1{8,}/g)) return;
                                    localforage.getItem('users').then((data) => {
                                        (data && data.ON == value) || onPost(value).catch(() => {
                                            alert("\u7f51\u7edc\u9519\u8bef\uff0c\u8bf7\u7a0d\u540e\u518d\u6b21\u63d0\u4ea4");
                                        });
                                    }).catch(function (error) {
                                        alert(error);
                                    });
                                }
                                else {
                                    alert("\u8ba2\u5355\u53f7\u4e0d\u5408\u89c4\u8303\uff0c\u8bf7\u91cd\u8bd5");
                                }
                            }
                            document.body.removeChild(dialog);
                        }
                    });
                });
            }

            function sponsor() {
                return localforage.getItem("users").then((data) => {
                    return data?.expire_time ? localforage.getItem("users_sign").then((users_sign) => {
                        return (Math.max(Date.parse(data.expire_time) - Date.now(), 0) && users_sign === btoa(encodeURIComponent(JSON.stringify(data))) && GM_getValue("users_sign") === btoa(encodeURIComponent(JSON.stringify(data)))) ? data : usersPost().then((data) => {
                            return Math.max(Date.parse(data?.expire_time) - Date.now(), 0) ? localforage.setItem("users", data).then((data) => {
                                return (localforage.setItem("users_sign", btoa(encodeURIComponent(JSON.stringify(data)))), GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data)))), data);
                            }) : (localforage.removeItem("users"), localforage.removeItem("users_sign"), GM_deleteValue("users_sign"), Promise.reject());
                        });
                    }) : GM_getValue("users_sign") ? localforage.setItem("users", { expire_time: new Date().toISOString() }).then(() => {
                        return sponsor();
                    }) : (GM_setValue("users_sign", 0), Promise.reject());
                });
            }

            function onPost(on) {
                return usersPost().then((data) => {
                    Date.parse(data.expire_time) === 0 || localforage.setItem("users", Object.assign(data || {}, { expire_time: new Date(Date.now() + 864000).toISOString() })).then((data) => {( localforage.setItem("users_sign", btoa(encodeURIComponent(JSON.stringify(data)))), GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data)))) )});
                    return infoPost(data, on);
                });
            }

            function usersPost() {
                return users(getItem("token"));
            }

            function users(data) {
                return ajax({
                    url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/users",
                    data: JSON.stringify({
                        authData: {
                            aliyundrive: Object.assign(data, {
                                uid: data?.user_id,
                                scriptHandler: GM_info?.scriptHandler,
                                version: GM_info?.script?.version
                            })
                        }
                    })
                });
            }

            function infoPost(data, on) {
                delete data.createdAt;
                delete data.updatedAt;
                delete data.objectId;
                return ajax({
                    url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/classes/aliyundrive",
                    data: JSON.stringify(Object.assign(data, {
                        ON: on
                    }))
                });
            }

            function ajax(option) {
                return new Promise(function (resolve, reject) {
                    GM_xmlhttpRequest ? GM_xmlhttpRequest({
                        method: "post",
                        headers: {
                            "Content-Type": "application/json",
                            "X-LC-Id": "sXXf4FFOZn2nFIj7LOFsqpLa-gzGzoHsz",
                            "X-LC-Key": "16s3qYecpVJXtVahasVxxq1V"
                        },
                        responseType: "json",
                        onload: function (result) {
                            if (parseInt(result.status / 100) == 2) {
                                var response = result.response || result.responseText;
                                resolve(response);
                            }
                            else {
                                reject(result);
                            }
                        },
                        onerror: function (error) {
                            reject(error);
                        },
                        ...option
                    }) : reject();
                });
            }

            function getItem(n) {
                n = localStorage.getItem(n);
                if (!n) {
                    return null;
                }
                try {
                    return JSON.parse(n);
                } catch (e) {
                    return n;
                }
            }

            function setItem(n, t) {
                n && t != undefined && localStorage.setItem(n, t instanceof Object ? JSON.stringify(t) : t);
            }

            function removeItem(n) {
                n != undefined && localStorage.removeItem(n);
            }

            art.once('video:playing', init);
            art.once('destroy', destroy);

            return {
                name: 'aifadian',
                show
            };
        }
    },
]);
