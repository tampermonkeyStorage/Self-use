window.dpPlugins = window.dpPlugins || function(t) {
    var obj = {};

    obj.init = function (player, option) {
        obj = Object.assign(option || {}, obj);

        obj.ready(player, obj).then((obj) => {
            t.forEach((k) => {
                new k(player, obj);
            });
        });
    };

    obj.ready = function (player) {
        return new Promise(function (resolve, reject) {
            if (player.isReady) {
                resolve(obj);
            }
            else if (player.video.duration > 0 || player.video.readyState > 2) {
                player.isReady = true;
                resolve(obj);
            }
            else {
                player.video.ondurationchange = function () {
                    player.video.ondurationchange = null;
                    player.isReady = true;
                    resolve(obj);
                }
            }
        });
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
            Node.prototype.insertBefore.call(parent, child, parent.firstElementChild || parent.firstChild);
        }
        else {
            parent.insertAdjacentHTML("afterbegin", String(child));
        }
        return parent.firstElementChild || parent.firstChild;
    };

    obj.remove = function (child) {
        return Node.prototype.removeChild.call(child?.parentNode || document, child);
    };

    obj.setStyle = function (element, key, value) {
        if (typeof key === 'object') {
            for (const k in key) {
                element.style[k] = key[k];
            }
            return element;
        }
        element.style[key] = value;
        return element;
    };

    return obj;
}([
    class HlsEvents {
        constructor(player, obj) {
            this.player = player;
            this.hls = this.player.plugins.hls;

            if (!this.player.events.type('switch_video')) {
                this.player.events.playerEvents.push('switch_video');
            }
            this.player.on('switch_video', () => {
                if (this.hls) {
                    this.hls.destroy();
                    this.hls = this.player.plugins.hls;
                    this.onEvents();
                }
            });

            this.player.on('quality_end', () => {
                if (this.hls) {
                    this.hls.destroy();
                    this.hls = this.player.plugins.hls;
                    this.onEvents();
                }
            });

            this.onEvents();
        }

        onEvents() {
            const Hls = window.Hls;
            this.hls.once(Hls.Events.ERROR, (event, data) => {
                if (this.isUrlExpires(this.hls.url)) {
                    obj.getPlayInfo((response) => {
                        if (response instanceof Object) {
                            obj.initPlayInfo(response);
                            const quality = obj.getQuality();
                            this.switchVideo(quality);
                        }
                        else {
                            this.onEvents();
                        }
                    });
                }
                else {
                    this.onEvents();
                }
            });
        };

        switchVideo(quality) {
            this.player.options.video.quality = quality;
            this.player.quality = this.player.options.video.quality[ this.player.qualityIndex ];

            const now = Date.now();
            const { currentTime, playbackRate, muted } = this.player.video;

            const paused = this.player.video.paused;
            const videoHTML = '<video class="dplayer-video" webkit-playsinline playsinline crossorigin="anonymous" preload="auto" src="' + this.player.quality.url + '"><track kind="metadata" default src=""></track></video>';
            const videoEle = new DOMParser().parseFromString(videoHTML, 'text/html').body.firstChild;
            this.player.template.videoWrap.insertBefore(videoEle, this.player.template.videoWrap.getElementsByTagName('div')[0]);
            this.player.prevVideo = this.player.video;
            this.player.video = videoEle;
            this.player.initVideo(this.player.video, this.player.quality.type || this.player.options.video.type);
            this.player.video.currentTime = currentTime;
            this.player.controller.hide();

            this.player.video.oncanplaythrough = () => {
                this.player.video.oncanplaythrough = null;
                this.player.video.currentTime = currentTime;
                this.player.events.trigger('switch_video');

                if (!paused) {
                    this.player.play();
                    this.player.controller.hide();
                }

                this.player.video.onplaying = () => {
                    this.player.video.onplaying = null;
                    this.player.video.currentTime = Math.min((Date.now() - now) / 1000, this.player.video.currentTime - currentTime + 5) + currentTime;
                    this.player.video.muted = muted;
                    this.player.speed(playbackRate);

                    this.player.prevVideo.pause();
                    this.player.template.videoWrap.removeChild(this.player.prevVideo);
                    this.player.template.video = this.player.video;
                    this.player.video.classList.add('dplayer-video-current');
                    this.player.prevVideo = null;

                    while (this.player.template.videoWrap.querySelectorAll('video').length > 1) {
                        this.player.template.videoWrap.removeChild(this.player.template.videoWrap.getElementsByTagName('video')[1]);
                    }
                };
            };
        };

        isUrlExpires(e) {
            var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 6e3
            , n = e.match(/&x-oss-expires=(\d+)&/);
            return !n || n && n[1] && +"".concat(n[1], "000") - t < Date.now();
        };
    },
    class Subtitle {
        constructor(player, obj) {
            this.player = player;

            this.player.events.type('switch_video') || this.player.events.playerEvents.push('switch_video');

            this.player.on('switch_video', () => {
                this.restart();
            });

            this.player.on('quality_end', () => {
                if (Array.isArray(this.player.options.subtitles) && this.player.options.subtitles.length) {
                    this.switch(this.player.options.subtitles[this.player.options.subtitle.index]);
                }
            });

            if (Array.isArray(this.player.options.subtitles) && this.player.options.subtitles.length) {
                this.add(this.player.options.subtitles);
            }
        }

        add(sublist) {
            if (!(Array.isArray(sublist) && sublist.length)) {
                return;
            }
            if (!(this.player.template.subtitlesBox && this.player.template.subtitlesItem.length)) {
                return;
            }

            const lastItemIndex = this.player.template.subtitlesItem.length - 1;
            sublist.forEach((item, index) => {
                const i = lastItemIndex + index;
                this.player.options.subtitle.url.splice(i, 0, item); // 占个位quality_end不会报错

                const element = obj.prepend(this.player.template.subtitlesBox, '<div class="dplayer-subtitles-item" data-subtitle=""><span class="dplayer-label">' + (item.name + ' ' + (item.lang || "")) + '</span></div>');
                element.addEventListener('click', (event) => {
                    this.player.subtitles.hide();
                    if (this.player.options.subtitle.index !== i) {
                        this.player.options.subtitle.index = i;

                        this.player.template.subtitle.innerHTML = `<p></p>`;
                        this.switch(item);

                        if (this.player.template.subtitle.classList.contains('dplayer-subtitle-hide')) {
                            this.player.subtitles.subContainerShow();
                        }
                    }
                });

                this.player.template.subtitlesBox.insertBefore(element, this.player.template.subtitlesBox.lastElementChild);
                this.player.template.subtitlesItem = this.player.template.subtitlesBox.querySelectorAll('.dplayer-subtitles-item');
            });

            if (!(this.player.video.textTracks.length && this.player.video.textTracks[0])?.cues) {
                this.player.options.subtitle.index = this.player.options.subtitles.findIndex((item) => {
                    return ['cho', 'chi'].includes(item.language);
                });
                if (this.player.options.subtitle.index < 0) {
                    this.player.options.subtitle.index = 0;
                }
                this.switch(sublist[this.player.options.subtitle.index]);
            }
        }

        switch(newOption = {}) {
            return this.init(newOption).then((subArr) => {
                if (newOption.name) {
                    this.player.notice(`切换字幕: ${newOption.name}`);
                }
            });
        }

        init(subtitleOption) {
            return this.urlToArray(subtitleOption).then((subtitleOption) => {
                return this.createTrack(subtitleOption);
            });
        }

        restart() {
            this.clear();
            this.player.options.subtitles = obj.getVideoInfoSubtitle().concat(obj.getFolderSubtitle());
            this.add(this.player.options.subtitles);
        }

        clear() {
            this.player.template.subtitle.innerHTML = `<p></p>`;
            this.player.options.subtitles = [];
            if (this.player.template.subtitlesItem.length > 1) {
                for (let i = 0; i < this.player.template.subtitlesItem.length - 1; i++) {
                    obj.remove(this.player.template.subtitlesItem[i]);
                }
            }
        }

        urlToArray(subtitleOption) {
            if (Array.isArray(subtitleOption?.sarr) && subtitleOption.sarr.length) {
                return Promise.resolve(subtitleOption);
            }
            else {
                const url = subtitleOption?.url || subtitleOption?.download_url || subtitleOption?.uri || subtitleOption?.surl;
                const extension = subtitleOption.sext || subtitleOption.file_extension;
                if (url) {
                    return this.requestFile(url).then((text) => {
                        subtitleOption.sarr = this.subParser(text, extension, subtitleOption.delay || 0);
                        subtitleOption.lang = subtitleOption.lang || this.getlangBySarr(subtitleOption.sarr);
                        subtitleOption.label = this.langToLabel(subtitleOption.lang);
                        return subtitleOption;
                    });
                }
                else {
                    return obj.getDownloadUrl(subtitleOption).then(([subtitleOption]) => {
                        return this.urlToArray(subtitleOption);
                    });
                }
            }
        }

        createTrack(subtitleOption) {
            const { video } = this.player;
            const textTracks = video.textTracks;
            const textTrack = textTracks[0];

            textTrack.mode === "hidden" || (textTrack.mode = "hidden");
            if (textTrack.cues && textTrack.cues.length) {
                for(let i = textTrack.cues.length - 1; i >= 0; i--) {
                    textTrack.removeCue(textTrack.cues[i]);
                }
            }

            subtitleOption.sarr.forEach(function (item, index) {
                const textTrackCue = new VTTCue(item.startTime, item.endTime, item.text);
                textTrackCue.id = item.index;
                textTrack.addCue(textTrackCue);
            });
        }

        style(key, value) {
            const { subtitle } = this.player.template;
            if (typeof key === 'object') {
                for (const k in key) {
                    subtitle.style[k] = key[k];
                }
                return subtitle;
            }
            subtitle.style[key] = value;
            return subtitle;
        }

        requestFile(url) {
            return fetch(url, {
                referrer: "https://www.aliyundrive.com/",
                referrerPolicy: "origin",
                body: null,
                method: "GET",
                mode: "cors",
                credentials: "omit"
            }).then(data => data.blob()).then(blob => {
                return this.blobToText(blob)
            });
        };

        blobToText(blob) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.readAsText(blob, "UTF-8");
                reader.onload = function(e) {
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
                reader.onerror = function(error) {
                    reject(error);
                };
            });
        }

        subParser(stext, sext, delay = 0) {
            if (!sext) {
                sext = (stext.indexOf("->") > 0 ? "srt" : stext.indexOf("Dialogue:") > 0 ? "ass" : "").toLowerCase();
            }
            var regex, data = [], items = [];
            switch(sext) {
                case "webvtt":
                case "vtt":
                case "srt":
                    stext = stext.replace(/\r/g, "");
                    regex = /(\d+)?\n?(\d{0,2}:?\d{2}:\d{2}.\d{3}) -?-> (\d{0,2}:?\d{2}:\d{2}.\d{3})/g;
                    data = stext.split(regex);
                    data.shift();
                    for (let i = 0; i < data.length; i += 4) {
                        items.push({
                            index: items.length,
                            startTime: parseTimestamp(data[i + 1]) + +delay,
                            endTime: parseTimestamp(data[i + 2]) + +delay,
                            text: data[i + 3].trim().replace(/(\\N|\\n)/g, "\n").replace(/{.*?}/g, "").replace(/[a-z]+\:.*\d+\.\d+\%\s/, "")
                        });
                    }
                    return items;
                case "ssa":
                case "ass":
                    stext = stext.replace(/\r\n/g, "");
                    regex = /Dialogue: .*?\d+,(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2}),.*?,\d+,\d+,\d+,.*?,/g;
                    data = stext.split(regex);
                    data.shift();
                    for (let i = 0; i < data.length; i += 3) {
                        items.push({
                            index: items.length,
                            startTime: parseTimestamp(data[i]) + +delay,
                            endTime: parseTimestamp(data[i + 1]) + +delay,
                            text: data[i + 2].trim().replace(/(\\N|\\n)/g, "\n").replace(/{.*?}/g, "")
                        });
                    }
                    return items;
                default:
                    console.error("未知字幕格式，无法解析");
                    console.info(sext, stext);
                    return items;
            }

            function parseTimestamp (e) {
                var t = e.split(":")
                , n = parseFloat(t.length > 0 ? t.pop().replace(/,/g, ".") : "00.000") || 0
                , r = parseFloat(t.length > 0 ? t.pop() : "00") || 0;
                return 3600 * (parseFloat(t.length > 0 ? t.pop() : "00") || 0) + 60 * r + n;
            }
        };

        getlangBySarr(sarr) {
            var t = [
                sarr[parseInt(sarr.length / 3)].text,
                sarr[parseInt(sarr.length / 2)].text,
                sarr[parseInt(sarr.length / 3 * 2)].text
            ].join("").replace(/[<bi\/>\r?\n]*/g, "");

            var e = "eng"
            , i = (t.match(/[\u4e00-\u9fa5]/g) || []).length / t.length;
            (t.match(/[\u3020-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\u31F0-\u31FF]/g) || []).length / t.length > .03 ? e = "jpn" : i > .1 && (e = "zho");
            return e;
        };

        langToLabel(lang) {
            return {
                chi: "中文字幕",
                zho: "中文字幕",
                eng: "英文字幕",
                en: "英文字幕",
                jpn: "日文字幕",
                "zh-CN": "简体中文",
                "zh-TW": "繁体中文"
            }[lang] || "未知语言";
        };
    },
    class ImageEnhancer {
        constructor(player, obj) {
            this.player = player;

            Object.assign(this.player.user.storageName, { imageenhancer: "dplayer-imageenhancer" });
            Object.assign(this.player.user.default, { imageenhancer: 0 });
            this.player.user.init();

            this.imageenhancer = this.player.user.get("imageenhancer");
            if (this.imageenhancer) {
                this.player.video.style.filter = 'contrast(1.01) brightness(1.05) saturate(1.1)';
            }

            this.player.template.imageEnhancer = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-imageenhancer"><span class="dplayer-label">画质增强</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>');
            this.player.template.imageEnhancerToggle = obj.query('input', this.player.template.imageEnhancer);
            this.player.template.imageEnhancerToggle.checked = this.imageenhancer;

            this.player.template.imageEnhancer.addEventListener('click', () => {
                this.imageenhancer = this.player.template.imageEnhancerToggle.checked = !this.player.template.imageEnhancerToggle.checked;
                this.player.user.set("imageenhancer", Number(this.imageenhancer));
                this.player.video.style.filter = this.imageenhancer ? 'contrast(1.01) brightness(1.05) saturate(1.1)' : '';
                this.player.notice(`画质增强： ${this.imageenhancer ? '开启' : '关闭'}`);
            });

            this.player.on("playing", () => {
                if (this.imageenhancer) {
                    this.player.video.style.filter = 'contrast(1.01) brightness(1.05) saturate(1.1)';
                }
            });
        }
    },
    class SoundEnhancer {
        constructor(player, obj) {
            this.player = player;
            this.Joysound = window.Joysound;
            this.offset = null;

            Object.assign(this.player.user.storageName, { soundenhancer: "dplayer-soundenhancer", volumeenhancer: "dplayer-volumeenhancer" });
            Object.assign(this.player.user.default, { soundenhancer: 0, volumeenhancer: 0 });
            this.player.user.init();

            /*** SoundEnhancer ***/
            this.player.template.soundEnhancer = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-soundenhancer"><span class="dplayer-label">音质增强</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>');
            this.player.template.soundEnhancerToggle = obj.query('input', this.player.template.soundEnhancer);
            this.player.template.soundEnhancerToggle.checked = !!this.player.user.get("soundenhancer");

            this.player.template.soundEnhancer.addEventListener('click', () => {
                let checked = this.player.template.soundEnhancerToggle.checked = !this.player.template.soundEnhancerToggle.checked;
                this.player.user.set("soundenhancer", Number(checked));
                this.switchJoysound(checked);
            });

            /*** VolumeEnhancer ***/
            this.player.template.gainBox = obj.prepend(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-danmaku dplayer-setting-gain" style="display: block;"><span class="dplayer-label">音量增强</span><div class="dplayer-danmaku-bar-wrap dplayer-gain-bar-wrap"><div class="dplayer-danmaku-bar dplayer-gain-bar"><div class="dplayer-danmaku-bar-inner dplayer-gain-bar-inner" style="width: 0%;"><span class="dplayer-thumb"></span></div></div></div></div>');
            this.player.template.gainBarWrap = obj.query('.dplayer-gain-bar-wrap', this.player.template.gainBox);
            this.player.bar.elements.gain = obj.query('.dplayer-gain-bar-inner', this.player.template.gainBox);

            this.player.events.playerEvents.push("gain_value");
            this.player.on("gain_value", (percentage) => {
                percentage = Math.min(Math.max(percentage, 0), 1);
                this.player.bar.set("gain", percentage, "width");
                this.player.user.set("volumeenhancer", percentage);
                this.setVolume(percentage);
            });

            const gainMove = (event) => {
                const e = event || window.event;
                let percentage = ((e.clientX || e.changedTouches[0].clientX) - this.getElementViewLeft(this.player.template.gainBarWrap)) / 130;
                this.player.events.trigger("gain_value", percentage);
            };
            const gainUp = () => {
                document.removeEventListener("touchend", gainUp);
                document.removeEventListener("touchmove", gainMove);
                document.removeEventListener("mouseup", gainUp);
                document.removeEventListener("mousemove", gainMove);
                this.player.template.gainBox.classList.remove('dplayer-setting-danmaku-active');
            };

            this.player.template.gainBarWrap.addEventListener('click', (event) => {
                const e = event || window.event;
                let percentage = ((e.clientX || e.changedTouches[0].clientX) - this.getElementViewLeft(this.player.template.gainBarWrap)) / 130;
                this.player.events.trigger("gain_value", percentage);
            });
            this.player.template.gainBarWrap.addEventListener("touchstart", () => {
                document.addEventListener("touchmove", gainMove);
                document.addEventListener("touchend", gainUp);
                this.player.template.gainBox.classList.add('dplayer-setting-danmaku-active');
            });
            this.player.template.gainBarWrap.addEventListener("mousedown", () => {
                document.addEventListener("mousemove", gainMove);
                document.addEventListener("mouseup", gainUp);
                this.player.template.gainBox.classList.add('dplayer-setting-danmaku-active');
            });

            this.player.on("playing", () => {
                if (!this.player.video.joySound) {
                    this.init();
                }
            });
        }

        init() {
            if (window.Joysound && window.Joysound.isSupport()) {
                this.joySound = new window.Joysound();
                this.joySound.init(this.player.video);
                this.player.video.joySound = true;
                let isJoysound = this.player.user.get("soundenhancer");
                if (isJoysound) {
                    this.switchJoysound(isJoysound);
                }
                let percentage = this.player.user.get("volumeenhancer");
                if (percentage) {
                    this.player.events.trigger("gain_value", percentage);
                }
            }
        }

        switchJoysound(o) {
            if (this.joySound) {
                this.joySound.setEnabled(o);
                this.player.notice(`音质增强： ${o ? '开启' : '关闭'}`);
            } else {
                this.player.notice('Joysound 未完成初始化');
            }
        }

        setVolume(percentage) {
            if (this.joySound) {
                this.joySound.setVolume(percentage);
                this.player.notice(`音量增强： ${100 + Math.floor(percentage * 100)}%`);
            } else {
                this.player.notice('Joysound 未完成初始化');
            }
        }

        getElementViewLeft(element) {
            const scrollTop = window.scrollY || window.pageYOffset || document.body.scrollTop + ((document.documentElement && document.documentElement.scrollTop) || 0);
            if (element.getBoundingClientRect) {
                if (typeof this.offset !== 'number') {
                    let temp = document.createElement('div');
                    temp.style.cssText = 'position:absolute;top:0;left:0;';
                    document.body.appendChild(temp);
                    this.offset = -temp.getBoundingClientRect().top - scrollTop;
                    document.body.removeChild(temp);
                    temp = null;
                }
                const rect = element.getBoundingClientRect();
                return rect.left + this.offset;
            } else {
                let actualLeft = element.offsetLeft;
                let current = element.offsetParent;
                const elementScrollLeft = document.body.scrollLeft + document.documentElement.scrollLeft;
                if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement) {
                    while (current !== null) {
                        actualLeft += current.offsetLeft;
                        current = current.offsetParent;
                    }
                } else {
                    while (current !== null && current !== element) {
                        actualLeft += current.offsetLeft;
                        current = current.offsetParent;
                    }
                }
                return actualLeft - elementScrollLeft;
            }
        }
    },
    class AspectRatio {
        constructor(player, obj) {
            this.player = player;
            this.value = '';

            this.player.template.controller.querySelector('.dplayer-icons-right').insertAdjacentHTML("afterbegin", '<div class="dplayer-quality dplayer-aspectRatio"><button class="dplayer-icon dplayer-quality-icon">画面比例</button><div class="dplayer-quality-mask"><div class="dplayer-quality-list dplayer-aspectRatio-list"><div class="dplayer-quality-item" data-value="none">原始比例</div><div class="dplayer-quality-item" data-value="cover">自动裁剪</div><div class="dplayer-quality-item" data-value="fill">拉伸填充</div><div class="dplayer-quality-item" data-value="">系统默认</div></div></div></div>');
            this.player.template.aspectRatioButton = this.player.template.controller.querySelector('.dplayer-aspectRatio button');
            this.player.template.aspectRatioList = this.player.template.controller.querySelector('.dplayer-aspectRatio-list');

            this.player.template.aspectRatioList.addEventListener('click', (e) => {
                if (e.target.classList.contains('dplayer-quality-item')) {
                    this.value = e.target.dataset.value;
                    this.player.video.style['object-fit'] = e.target.dataset.value;
                    this.player.template.aspectRatioButton.innerText = e.target.innerText;
                }
            });

            this.player.on("playing", () => {
                this.player.video.style['object-fit'] = this.value;
            });
        }
    },
    class Appreciation {
        constructor(player, obj) {
            this.player = player;
            this.now = Date.now();
            this.localforage = window.localforage;

            const { contextmenu,
                   container: { offsetWidth, offsetHeight }
                  } = this.player;

            this.player.template.menuItem[0].addEventListener('click', () => {
                this.showDialog();
            });
            this.player.on('timeupdate', () => {
                if (Date.now() - 1000*60*8 >= this.now) {
                    this.now = Date.now();
                    this.isAppreciation().then((data) => {
                    }).catch((error) => {
                        this.player.pause();
                        contextmenu.show(offsetWidth / 2.5, offsetHeight / 3);
                    });
                }
            });
        }

        isAppreciation() {
            this.localforage || this.player.template.menu.innerHTML.includes(5254001) || this.player.template.menuItem.length === 4 || this.player.destroy();
            return this.localforage.getItem("users").then((data) => {
                if (data?.expire_time) {
                    return this.localforage.getItem("users_sign").then((users_sign) => {
                        if (users_sign === btoa(encodeURIComponent(JSON.stringify(data)))) {
                            if (Math.max(Date.parse(data.expire_time) - Date.now(), 0)) {
                                return data;
                            }
                            else {
                                return this.localforage.setItem("users", { expire_time: new Date().toISOString()}).then(() => {
                                    return this.isAppreciation();
                                });
                            }
                        }
                        else {
                            this.usersPost().then((data) => {
                                if (data?.expire_time && Math.max(Date.parse(data.expire_time) - Date.now(), 0)) {
                                    localforage.setItem("users", data);
                                    GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data))));
                                    return data;
                                }
                                else {
                                    localforage.removeItem("users");
                                    localforage.removeItem("users_sign");
                                    GM_deleteValue("users_sign");
                                    return Promise.reject();;
                                }
                            });
                        }
                    });
                }
                else {
                    if (GM_getValue("users_sign")) {
                        return this.localforage.setItem("users", { expire_time: new Date().toISOString()}).then(() => {
                            return this.isAppreciation();
                        });
                    }
                    else {
                        this.localforage.removeItem("users_sign");
                        return Promise.reject();
                    }
                }
            });
        };

        showDialog() {
            let dialog = obj.append(document.body, '<div class="ant-modal-root"><div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle1" style=""><div role="document" class="ant-modal modal-wrapper--5SA7y" style="width: 340px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle1">提示</div></div><div class="ant-modal-body"><div class="content-wrapper--S6SNu"><div>爱发电订单号：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="" action="click" type="text" class="afdian-order ant-input ant-input-borderless" style="background-color: var(--divider_tertiary);"></span></div><div class="content-wrapper--S6SNu"><div>请输入爱发电订单号，确认即可</div><a href="https://afdian.net/order/create?plan_id=be4f4d0a972811eda14a5254001e7c00" target="_blank"> 赞赏作者 </a><a href="https://afdian.net/dashboard/order" target="_blank"> 复制订单号 </a></div></div><div class="ant-modal-footer"><div class="footer--cytkB"><button class="button--WC7or secondary--vRtFJ small--e7LRt cancel-button--c-lzN">取消</button><button class="button--WC7or primary--NVxfK small--e7LRt">确定</button></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div></div>');
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
                                this.localforage.getItem('users').then((data) => {
                                    (data && data.ON == value) || this.onPost(value).catch(() => {
                                        obj.showTipError("\u7f51\u7edc\u9519\u8bef\uff0c\u8bf7\u7a0d\u540e\u518d\u6b21\u63d0\u4ea4");
                                    });
                                }).catch(function(error) {
                                    console.error(error);
                                    obj.showTipError(error);
                                });
                            }
                            else {
                                obj.showTipError("\u8ba2\u5355\u53f7\u4e0d\u5408\u89c4\u8303\uff0c\u8bf7\u91cd\u8bd5");
                            }
                        }
                        document.body.removeChild(dialog);
                    }
                });
            });
        };

        onPost(on) {
            return this.usersPost().then((data) => {
                Date.parse(data.expire_time) === 0 || this.localforage.setItem("users", Object.assign(data || {}, { expire_time: new Date(Date.now() + 864000).toISOString() })).then((data) => {GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data))))});
                return this.infoPost(data, on);
            });
        };

        usersPost() {
            return this.users(this.getItem("token"));
        };

        users(data) {
            return this.ajax({
                url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/users",
                data: JSON.stringify({authData: {aliyundrive: Object.assign(data, {
                    uid: data?.user_id,
                    scriptHandler: GM_info?.scriptHandler,
                    version: GM_info?.script?.version
                })}})
            });
        };

        infoPost(data, on) {
            delete data.createdAt;
            delete data.updatedAt;
            delete data.objectId;
            return this.ajax({
                url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/classes/aliyundrive",
                data: JSON.stringify(Object.assign(data, {
                    ON: on
                }))
            });
        };

        ajax(option) {
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
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
                });
            });
        };

        getItem(n) {
            n = localStorage.getItem(n);
            if (!n) {
                return null;
            }
            try {
                return JSON.parse(n);
            } catch (e) {
                return n;
            }
        };

        setItem(n, t) {
            n && t != undefined && localStorage.setItem(n, t instanceof Object ? JSON.stringify(t) : t);
        };

        removeItem(n) {
            n != undefined && localStorage.removeItem(n);
        };

    },
    class SelectEpisode {
        constructor(player, obj) {
            this.player = player;
            this.fileIndex = 0;

            if (Array.isArray(this.player.options.fileList) && this.player.options.fileList.length && this.player.options.file) {
                this.fileIndex = (this.player.options.fileList || []).findIndex((item, index) => {
                    return item.file_id === this.player.options.file.file_id;
                });

                obj.prepend(this.player.template.controller.querySelector('.dplayer-icons-right'), '<style>.episode .content{max-width: 360px;max-height: 330px;width: auto;height: auto;box-sizing: border-box;overflow: hidden auto;position: absolute;left: 0px;transition: all 0.38s ease-in-out 0s;bottom: 52px;transform: scale(0);z-index: 2;}.episode .content .list{background-color: rgba(0,0,0,.3);height: 100%;}.episode .content .video-item{color: #fff;cursor: pointer;font-size: 14px;line-height: 35px;overflow: hidden;padding: 0 10px;text-overflow: ellipsis;text-align: center;white-space: nowrap;}.episode .content .active{background-color: rgba(0,0,0,.3);color: #0df;}</style><div class="dplayer-quality episode"><button class="dplayer-icon prev-icon" title="上一集"><svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M757.527273 190.138182L382.510545 490.123636a28.020364 28.020364 0 0 0 0 43.752728l375.016728 299.985454a28.020364 28.020364 0 0 0 45.474909-21.876363V212.014545a28.020364 28.020364 0 0 0-45.474909-21.876363zM249.949091 221.509818a28.020364 28.020364 0 0 0-27.973818 27.973818v525.032728a28.020364 28.020364 0 1 0 55.994182 0V249.483636a28.020364 28.020364 0 0 0-28.020364-27.973818zM747.054545 270.242909v483.514182L444.834909 512l302.173091-241.757091z"></path></svg></button><button class="dplayer-icon dplayer-quality-icon episode-icon">选集</button><button class="dplayer-icon next-icon" title="下一集"><svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M248.506182 190.138182l374.970182 299.985454a28.020364 28.020364 0 0 1 0 43.752728L248.552727 833.861818a28.020364 28.020364 0 0 1-45.521454-21.876363V212.014545c0-23.505455 27.182545-36.538182 45.521454-21.876363z m507.485091 31.371636c15.453091 0 28.020364 12.567273 28.020363 27.973818v525.032728a28.020364 28.020364 0 1 1-55.994181 0V249.483636c0-15.453091 12.520727-27.973818 27.973818-27.973818zM258.978909 270.242909v483.514182L561.198545 512 258.978909 270.242909z"></path></svg></button><div class="content"><div class="list"></div></div></div>')
                this.player.template.episodeButton = this.player.template.controller.querySelector('.episode .episode-icon');
                this.player.template.episodePrevButton = this.player.template.controller.querySelector('.episode .prev-icon');
                this.player.template.episodeNextButton = this.player.template.controller.querySelector('.episode .next-icon');
                this.player.template.episodeContent = this.player.template.controller.querySelector('.episode .content');
                this.player.template.episodeList = this.player.template.controller.querySelector('.episode .list');
                this.player.options.fileList.forEach((item, index) => {
                    obj.append(this.player.template.episodeList, '<div class="video-item" data-index="' + index + '" title="' + item.name + '">' + item.name + '</div>');
                });
                this.player.template.episodeVideoItems = this.player.template.controller.querySelectorAll('.episode .video-item');
                this.player.template.episodeVideoItems[this.fileIndex].classList.add('active');

                this.player.template.mask.addEventListener('click', () => {
                    this.hide();
                });
                this.player.template.episodeButton.addEventListener('click', (e) => {
                    if (this.player.template.episodeContent.style.transform === 'scale(1)') {
                        this.hide();
                    }
                    else {
                        this.show();
                    }
                });

                this.player.template.episodeList.addEventListener('click', (e) => {
                    if (e.target.classList.contains('video-item') && !e.target.classList.contains('active')) {
                        this.player.template.episodeVideoItems[this.fileIndex].classList.remove('active');
                        e.target.classList.add('active');
                        this.fileIndex = e.target.dataset.index * 1;
                        this.switchEpisodes(this.player.options.fileList[this.fileIndex]);
                        this.player.notice('准备播放：' + this.player.options.fileList[this.fileIndex].name, 5000);
                        this.hide();
                        this.player.controller.hide();
                    }
                });

                this.player.template.episodePrevButton.addEventListener('click', (e) => {
                    const index = this.fileIndex - 1;
                    if (index >= 0) {
                        this.player.template.episodeVideoItems[this.fileIndex].classList.remove('active');
                        this.player.template.episodeVideoItems[index].classList.add('active');
                        this.fileIndex = index;
                        this.switchEpisodes(this.player.options.fileList[this.fileIndex], this.player, false);
                        this.player.notice('准备播放：' + this.player.options.fileList[this.fileIndex].name, 5000);
                    }
                    else {
                        this.player.notice('没有上一集了');
                    }
                });

                this.player.template.episodeNextButton.addEventListener('click', (e) => {
                    const index = this.fileIndex + 1;
                    if (index <= player.options.fileList.length - 1) {
                        this.player.template.episodeVideoItems[this.fileIndex].classList.remove('active');
                        this.player.template.episodeVideoItems[index].classList.add('active');
                        this.fileIndex = index;
                        this.switchEpisodes(this.player.options.fileList[this.fileIndex], this.player, false);
                        this.player.notice('准备播放：' + this.player.options.fileList[this.fileIndex].name, 5000);
                    }
                    else {
                        this.player.notice('没有下一集了');
                    }
                });
            }
        }

        switchEpisodes(file) {
            if (typeof file === 'number') {
                file = this.player.options.fileList[file];
            }
            Object.assign(obj.play_info.video_info, file);
            obj.getPlayInfo((response) => {
                if (response instanceof Object) {
                    obj.initPlayInfo(response);
                    const quality = obj.getQuality();
                    this.switchVideo(quality);
                    document.querySelector("[class^=header-file-name], [class^=header-center] div span").innerText = file.name;
                }
            });
        };

        switchVideo(quality) {
            this.player.options.video.quality = quality;
            this.player.quality = this.player.options.video.quality[ this.player.qualityIndex ];

            const videoHTML = '<video class="dplayer-video" webkit-playsinline playsinline crossorigin="anonymous" preload="auto" src="' + this.player.quality.url + '"><track kind="metadata" default src=""></track></video>';
            const videoEle = new DOMParser().parseFromString(videoHTML, 'text/html').body.firstChild;
            this.player.template.videoWrap.insertBefore(videoEle, this.player.template.videoWrap.getElementsByTagName('div')[0]);
            this.player.prevVideo = this.player.video;
            this.player.video = videoEle;
            this.player.initVideo(this.player.video, this.player.quality.type || this.player.options.video.type);
            this.player.controller.hide();

            this.player.video.oncanplaythrough = () => {
                this.player.video.oncanplaythrough = null;
                this.player.events.trigger('switch_video');
                this.player.prevVideo.pause();

                this.player.video.play();
                this.player.controller.hide();

                this.player.video.onplaying = () => {
                    this.player.video.onplaying = null;

                    this.player.template.videoWrap.removeChild(this.player.prevVideo);
                    this.player.template.video = this.player.video;
                    this.player.video.classList.add('dplayer-video-current');
                    this.player.prevVideo = null;

                    while (this.player.template.videoWrap.querySelectorAll('video').length > 1) {
                        this.player.template.videoWrap.removeChild(this.player.template.videoWrap.getElementsByTagName('video')[1]);
                    }
                };
            };
        };

        show() {
            this.player.template.episodeContent.style.transform = 'scale(1)';
            this.player.template.mask.classList.add('dplayer-mask-show');
        }

        hide() {
            this.player.template.episodeContent.style.transform = 'scale(0)';
            this.player.template.mask.classList.remove('dplayer-mask-show');
        }

    },
    class AutoNextEpisode {
        constructor(player, obj) {
            this.player = player;

            Object.assign(this.player.user.storageName, { autonextepisode: "dplayer-autonextepisode" });
            Object.assign(this.player.user.default, { autonextepisode: 0 });
            this.player.user.init();

            this.autonextepisode = this.player.user.get("autonextepisode");

            this.player.template.autoNextEpisode = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-autonextepisode"><span class="dplayer-label">自动下一集</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>');
            this.player.template.autoNextEpisodeToggle = obj.query('input', this.player.template.autoNextEpisode);
            this.player.template.autoNextEpisodeToggle.checked = this.autonextepisode;

            this.player.template.autoNextEpisode.addEventListener('click', () => {
                this.autonextepisode = this.player.template.autoNextEpisodeToggle.checked = !this.player.template.autoNextEpisodeToggle.checked;
                this.player.user.set("autonextepisode", Number(this.autonextepisode));
                this.player.notice(`自动播放下集： ${this.autonextepisode ? '开启' : '关闭'}`);
            });

            this.player.on("ended", () => {
                if (this.autonextepisode) {
                    this.player.template.episodeNextButton && this.player.template.episodeNextButton.click();
                }
            });
        }
    },
]);
