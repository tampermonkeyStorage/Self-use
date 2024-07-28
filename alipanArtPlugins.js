window.alipanArtPlugins = window.alipanArtPlugins || function(t) {
    var obj = {
        version: '1.0.0'
    };

    obj.init = (options) => {
        return obj.readyHls().then(() => {
            return obj.readyArtplayer().then(() => {
                return obj.initArtplayer(options);
            });
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

    obj.initArtplayer = function (options) {
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

                        hls.on(Hls.Events.ERROR, function (event, data) {
                            if (data.fatal) {
                                art.notice.show = `ERROR: ${data.type}`;
                                switch(data.type) {
                                    case Hls.ErrorTypes.NETWORK_ERROR:
                                        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                                            hls.loadSource(hls.url);
                                        }
                                        else if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                                            hls.loadSource(hls.url);
                                        }
                                        else if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                            location.reload();
                                        }
                                        else {
                                            hls.startLoad();
                                        }
                                        break;
                                    case Hls.ErrorTypes.MEDIA_ERROR:
                                        hls.recoverMediaError();
                                        break;
                                    default:
                                        art.notice.show = '视频无法正常播放，请刷新重试';
                                        hls.destroy();
                                        break;
                                }
                            }
                        });
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

        const { video_info, video_items } = options || {};
        const { file_id, video_preview_play_info } = video_info || {};
        const { live_transcoding_subtitle_task_list, live_transcoding_task_list } = video_preview_play_info || {};
        const quality = obj.getQuality(live_transcoding_task_list);
        if (quality.length > 0) {
            const qualityDefault = quality.find((item) => item.default) || quality[0] || {};
            const playlist = video_items.map((fileInfo) => {
                if (fileInfo.file_id === file_id) {
                    fileInfo.default = !0;
                }
                return fileInfo;
            });
            Object.assign(details, { id: file_id, quality: quality, playlist: playlist, url: qualityDefault.url, type: qualityDefault.type });
        }
        else {
            alert('获取播放信息失败，请刷新网页重试');
            return Promise.reject('获取播放信息失败');
        }

        const subtitle = obj.getSubtitle(live_transcoding_subtitle_task_list);
        if (subtitle.length > 0) {
            const subtitleDefault = subtitle.find((item) => item.default) || subtitle[0] || {};
            Object.assign(details.subtitle, { subtitle: subtitle, url: subtitleDefault.url, type: subtitleDefault.type });
        }

        const Artplayer = window.Artplayer || unsafeWindow.Artplayer;
        Object.assign(Artplayer, {
            PLAYBACK_RATE: [0.5, 0.75, 1, 1.25, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0],
            ASPECT_RATIO: ["default", "4:3", "16:9", "17:9", "18:9", "19:9", "20:9"],
        });

        const art = new Artplayer(details, (art) => {
            t.forEach((k) => {
                art.plugins.add(k());
            });
        });

        art.on('video_changed_end', (playOption) => {
            const { file_id, video_preview_play_info } = playOption || {};
            const { live_transcoding_subtitle_task_list, live_transcoding_task_list } = video_preview_play_info || {};
            const quality = obj.getQuality(live_transcoding_task_list);
            if (quality.length > 0) {
                const qualityDefault = quality.find((item) => item.default) || quality[0] || {};
                Object.assign(art.option, { id: file_id, quality: quality, url: qualityDefault.url, type: qualityDefault.type });

                art.switchUrl(qualityDefault.url).then(() => {
                    document.querySelector("[class^=header-file-name], [class^=header-center] div span").innerText = playOption.name;
                    art.notice.show = `切换视频: ${playOption.name}`;
                }).catch(() => {
                    art.notice.show = `视频地址不可用: ${playOption.name}`;
                });
            }
            else {
                return alert('获取播放信息失败，无法切换视频');
            }

            const subtitle = obj.getSubtitle(live_transcoding_subtitle_task_list);
            if (subtitle.length > 0) {
                const subtitleDefault = subtitle.find((item) => item.default) || subtitle[0] || {};
                Object.assign(art.option.subtitle, { subtitle: subtitle, url: subtitleDefault.url, type: subtitleDefault.type });
                art.emit('subtitle_changed');
            }
        });

        return Promise.resolve(art);
    };

    obj.getQuality = function (task_list) {
        if (Array.isArray(task_list) && task_list.length) {
            task_list = task_list.reverse();
            task_list.find(item => item.url).default = !0;
            task_list = task_list.reverse();

            let templates = {
                UHD: "4K 超清",
                QHD: "2K 超清",
                FHD: "1080 全高清",
                HD: "720 高清",
                SD: "540 标清",
                LD: "360 流畅"
            };
            task_list.forEach(function (item, index) {
                Object.assign(item, {
                    html: templates[item.template_id] + (item.description ? "（三方会员）" : ""),
                    type: "hls"
                });
            });
            return task_list;
        }
        return [];
    };

    obj.getSubtitle = function (task_list) {
        if (Array.isArray(task_list) && task_list.length) {
            task_list = task_list.reverse();
            task_list.find(item => ['cho', 'chi'].includes(item.language)).default = !0;
            task_list = task_list.reverse();

            let templates = {
                jpn: "日文字幕",
                chi: "中文字幕",
                eng: "英文字幕"
            };
            task_list.forEach(function (item, index) {
                Object.assign(item, {
                    html: templates[item.language] || item.language || "未知语言",
                    type: "vtt"
                });
            });
            return task_list;
        }
        return [];
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

    return obj;
}([
    function Sound() {
        return (art) => {
            function init () {
                const Joysound = window.Joysound || unsafeWindow.Joysound;
                if (Joysound && Joysound.isSupport()) {
                    art.joySound = art.joySound || new Joysound();
                    art.joySound.hasSource() || art.joySound.init(art.video);
                    if (art.storage.get('sound-enhancer')) {
                        art.joySound.setEnabled(!0);
                        art.setting.update({
                            name: 'sound-enhancer',
                            html: '音质增强',
                            switch: true,
                        });
                    }
                }
            }

            const soundEnhancer = art.storage.get('sound-enhancer');
            art.setting.add({
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
                            art.notice.show = "音质增强：" + (item.switch ? '关闭' : '开启');
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
                            art.notice.show = "音量增强：" + (100 + range * 100) + "%";
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
    function Quality() {
        return function (art) {
            const { option, notice, i18n } = art;

            art.controls.update({
                name: 'quality',
                onSelect: function (item) {
                    if (!item.url) {
                        notice.show = item.description || '视频地址不可用';
                        return;
                    }
                    art.switchQuality(item.url);
                    notice.show = `${i18n.get('Switch Video')}: ${item.html}`;
                }
            });

            art.on('restart', () => {
                art.controls.update({
                    name: 'quality',
                    selector: option.quality
                });
            });

            return {
                name: 'quality'
            };
        };
    },
    function Playlist() {
        return function (art) {
            if (!(art.option.playlist && art.option.playlist.length > 1)) return;

            const options = {
                playlist: art.option.playlist,
                showtext: true,
                autonext: art.storage.get('auto-next'),
                onchanged: (playOption) => {
                    art.emit('video_changed_start', playOption);
                }
            };

            function changeVideo(index) {
                if (!options.playlist[index]) {
                    if (index >= options.playlist.length) {
                        this.notice.show = '没有下一集了';
                    }
                    return;
                }
                if (typeof options.onchanged === 'function') {
                    options.onchanged(options.playlist[index]);
                }
            };

            var currentEp = options.playlist.findIndex(function (videoInfo) {
                return videoInfo.default || videoInfo.url === art.option.url;
            });
            if (options.autonext && currentEp < options.playlist.length) {
                art.on('video:ended', () => {
                    changeVideo(currentEp + 1);
                });
            }

            const icon = '<i class="art-icon"><svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M810.666667 384H85.333333v85.333333h725.333334V384z m0-170.666667H85.333333v85.333334h725.333334v-85.333334zM85.333333 640h554.666667v-85.333333H85.333333v85.333333z m640-85.333333v256l213.333334-128-213.333334-128z" fill="#ffffff"></path></svg></i>';
            art.controls.add({
                html: options.showtext ? '播放列表' : icon,
                name: 'play-list',
                position: 'right',
                style: {
                    paddingLeft: '10px',
                    paddingRight: '10px',
                },
                selector: options.playlist.map((videoInfo, index) => {
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
                    changeVideo(item.index);
                    return options.showtext ? '播放列表' : icon;
                }
            });

            return {
                name: 'playlist'
            };
        };
    },
    function Subtitle() {
        return (art) => {
            const { subtitle, template, option, notice } = art;

            function update(sublist) {
                if (!(Array.isArray(sublist) && sublist.length)) return;

                if (!option.subtitle.url) {
                    let subtitleOption = sublist.find((element) => element.default) || sublist[0] || {};
                    subtitleOption = Object.assign({}, option.subtitle, subtitleOption);
                    subtitleOption.url && subtitle.init({
                        ...subtitleOption
                    }).then(() => {
                        notice.show = '添加字幕成功';
                    });
                }

                art.controls.update({
                    html: '字幕列表',
                    name: 'subtitle-list',
                    position: 'right',
                    style: {
                        paddingLeft: '10px',
                        paddingRight: '10px',
                    },
                    selector: sublist.map(function (item, index) {
                        return {
                            style: {
                                textAlign: 'left'
                            },
                            ...item
                        };
                    }),
                    onSelect: function (item, $dom) {
                        subtitle.switch(item.url, item);
                        return item.html;
                    }
                });
            }

            function localFile(node) {
                node.click();
                return new Promise(function (resolve, reject) {
                    node.onchange = (event) => {
                        if (event.target.files.length) {
                            const file = event.target.files[0];
                            const subtitleOption = {};
                            subtitleOption.url = URL.createObjectURL(file);
                            subtitleOption.type = file.name.split(".").pop().toLowerCase();
                            subtitleOption.name = file.name;
                            subtitleOption.html = '本地字幕';
                            resolve(subtitleOption);
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

            template.$subtitleLocalFile = append(art.template.$container, '<input class="subtitleLocalFile" type="file" accept="webvtt,.vtt,.srt,.ssa,.ass" style="display: none;">');
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
                                    option.subtitle.subtitle = (option.subtitle.subtitle || []).concat([ subtitleOption ]);
                                    update(option.subtitle.subtitle);
                                });
                            }

                            return false;
                        }
                    },
                ]
            });

            update(option.subtitle.subtitle);
            art.on('restart', (url) => {
                const sublist = option.subtitle.subtitle || [];
                const subtitleDefault = sublist.find((item) => item.default) || sublist[0] || {};
                subtitleDefault.url && subtitle.switch(subtitleDefault.url);
            });

            return {
                name: 'subtitle'
            };
        }
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
                    this.notice.show = "自动连续播放：" + (item.switch ? '关闭' : '开启');
                    return !item.switch;
                }
            });

            return {
                name: 'autonext'
            };
        };
    },
]);
