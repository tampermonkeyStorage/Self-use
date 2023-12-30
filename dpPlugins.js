window.dpPlugins = window.dpPlugins || function (t) {
    var obj = {
        version: '1.1.3'
    };

    obj.init = function (player, option) {
        obj = Object.assign(option || {}, obj);

        window.m3u8Parser || obj.loadJs("https://cdn.staticfile.org/m3u8-parser/7.1.0/m3u8-parser.min.js");
        window.localforage || obj.loadJs("https://cdn.staticfile.org/localforage/1.10.0/localforage.min.js");

        obj.ready(player).then(() => {
            t.forEach((k) => {
                new k(player, obj);
            });
        });
    };

    obj.ready = function (player) {
        return new Promise(function (resolve, reject) {
            if (player.isReady) {
                resolve();
            }
            else if (player.video.duration > 0 || player.video.readyState > 2) {
                player.isReady = true;
                resolve();
            }
            else {
                player.video.ondurationchange = function () {
                    player.video.ondurationchange = null;
                    player.isReady = true;
                    resolve();
                }
            }
        });
    };

    obj.query = function (selector, parent = document) {
        return parent.querySelector(selector);
    };

    obj.queryAll = function (selector, parent = document) {
        return parent.querySelectorAll(selector);
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

    obj.insertAfter = function (targetElement, child) {
        var parent = targetElement.parentNode;
        if (parent.lastChild == targetElement) {
            return obj.append(parent, child);
        }
        else {
            child = obj.append(parent, child);
            return Node.prototype.insertBefore.call(parent, child, targetElement.nextSibling);
        }
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

    console.info("\n %c dpPlugins v" + obj.version + " %c https://scriptcat.org/zh-CN/users/13895 \n", "color: #fadfa3; background: #030307; padding:5px 0;", "background: #fadfa3; padding:5px 0;");

    return obj;
}([
    class HlsEvents {
        constructor(player) {
            this.player = player;
            this.hls = this.player.plugins.hls;
            this.now = Date.now();
            this.currentTime = 0;

            if (!this.player.events.type('video_end')) {
                this.player.events.playerEvents.push('video_end');
            }
            this.player.on('video_end', () => {
                this.switchUrl();
            });

            this.player.on('quality_end', () => {
                if (this.hls) {
                    this.hls.destroy();
                    this.hls = this.player.plugins.hls;
                    this.onEvents();
                    localStorage.setItem("dplayer-defaultQuality", this.player.quality.name);
                }
            });

            this.player.on('destroy', () => {
                if (this.hls) {
                    this.hls.destroy();
                }
            });

            this.onEvents();
        }

        switchUrl() {
            if (this.hls && this.hls.hasOwnProperty('data') && this.hls.levelController && !this.hls.levelController.currentLevelIndex) {
                const url = this.player.quality.url;
                this.hls.url = this.hls.levelController.currentLevel.url[0] = url;
                fetch(url).then((response) => {
                    return response.ok ? response.text() : Promise.reject();
                }).then((data) => {
                    window.m3u8Parser = window.m3u8Parser || unsafeWindow.m3u8Parser;
                    const parser = new window.m3u8Parser.Parser();
                    parser.push(data);
                    parser.end();

                    const vidUrl = url.replace(/media.m3u8.+/, "");
                    const segments = parser.manifest.segments;
                    const fragments = this.hls.levelController.currentLevel.details.fragments;
                    fragments.forEach(function (item, index) {
                        const segment = segments[index];
                        Object.assign(item, {
                            baseurl: url,
                            relurl: segment.uri,
                            url: vidUrl + segment.uri,
                        });
                    });

                    this.hls.startLoad(this.player.video.currentTime);
                    this.onEvents();
                });
            }
        }

        onEvents() {
            const Hls = window.Hls || unsafeWindow.Hls;
            if (!this.hls) {
                this.player = window.player || unsafeWindow.player;
                this.hls = this.player.plugins.hls;
            }
            this.hls.once(Hls.Events.ERROR, (event, data) => {
                if (this.hls.media.currentTime > 0) {
                    this.currentTime = this.hls.media.currentTime;
                }
                if (data.fatal) {
                    this.player.notice(`当前带宽: ${Math.round(this.hls.bandwidthEstimate / 1024 / 1024 / 8 * 100) / 100} MB/s`);
                    setTimeout(this.onEvents, 3e3);
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                this.hls.loadSource(this.hls.url)
                            }
                            else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
                                this.hls.loadSource(this.hls.url);
                                this.hls.media.currentTime = this.currentTime;
                                this.hls.media.play();
                            }
                            else {
                                this.hls.startLoad();
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            this.hls.recoverMediaError();
                            break;
                        default:
                            this.player.notice('视频播放异常，请刷新重试');
                            this.hls.destroy();
                            break;
                    }
                }
                else {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
                                if (this.isUrlExpires(this.hls.url)) {
                                    this.now = Date.now();
                                    this.player.events.trigger('video_start');
                                    return;
                                }
                            }
                            this.onEvents();
                            break;
                        default:
                            this.onEvents();
                            break;
                    }
                }
            });
        }

        isUrlExpires(e) {
            var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 6e3
                , n = e.match(/&x-oss-expires=(\d+)&/);
            if (n) {
                return +"".concat(n[1], "000") - t < Date.now();
            }
            else {
                return Date.now() - this.now > 300 * 1000 - t;
            }
        }
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
            this.Joysound = window.Joysound || unsafeWindow.Joysound;
            this.localforage = window.localforage || unsafeWindow.localforage;
            this.joySound = null;
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
            this.player.template.gainBarWrap = this.player.template.gainBox.querySelector('.dplayer-gain-bar-wrap');
            this.player.bar.elements.gain = this.player.template.gainBox.querySelector('.dplayer-gain-bar-inner');

            const gainMove = (event) => {
                const e = event || window.event;
                let percentage = ((e.clientX || e.changedTouches[0].clientX) - this.getElementViewLeft(this.player.template.gainBarWrap)) / 130;
                this.switchGainValue(percentage);
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
                this.switchGainValue(percentage);
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
                this.localforage.getItem("playing").then((data) => {
                    if ((data = data || 0, ++data < 1e3)) {
                        this.player.plugins.hls.data = true;
                        this.localforage.setItem("playing", data);
                    }
                });
                if (!this.player.video.joySound) {
                    this.init();
                }
            });
        }

        init() {
            if (this.Joysound && this.Joysound.isSupport()) {
                this.joySound = new this.Joysound();
                this.joySound.init(this.player.video);
                this.player.video.joySound = true;
                let isJoysound = this.player.user.get("soundenhancer");
                if (isJoysound) {
                    this.switchJoysound(isJoysound);
                }
                let percentage = this.player.user.get("volumeenhancer");
                if (percentage) {
                    this.switchGainValue(percentage);
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

        switchGainValue(percentage) {
            if (this.joySound) {
                percentage = Math.min(Math.max(percentage, 0), 1);
                this.player.bar.set("gain", percentage, "width");
                this.player.user.set("volumeenhancer", percentage);
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
        constructor(player) {
            this.player = player;
            this.value = null;

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
                if (this.value) {
                    this.player.video.style['object-fit'] = this.value;
                }
            });
        }
    },
    class SelectEpisode {
        constructor(player, obj) {
            this.player = player;

            if (!(Array.isArray(this.player.options.fileList) && this.player.options.fileList.length > 1 && this.player.options.file)) return;

            if (!this.player.events.type('episode_end')) {
                this.player.events.playerEvents.push('episode_end');
            }
            this.player.on('episode_end', () => {
                this.switchVideo();
            });

            this.player.fileIndex = (this.player.options.fileList || []).findIndex((item, index) => {
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
            if (this.player.template.episodeVideoItems.length && this.player.fileIndex >= 0) {
                this.player.template.episodeVideoItems[this.player.fileIndex].classList.add('active');
            }

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
                    this.player.template.episodeVideoItems[this.player.fileIndex].classList.remove('active');
                    e.target.classList.add('active');
                    this.player.fileIndex = e.target.dataset.index * 1;
                    this.player.options.file = this.player.options.fileList[this.player.fileIndex];

                    this.hide();
                    this.player.events.trigger('episode_start');
                    this.player.notice('准备播放：' + this.player.options.file.name, 5000);
                }
            });

            this.player.template.episodePrevButton.addEventListener('click', (e) => {
                const index = this.player.fileIndex - 1;
                if (index >= 0) {
                    this.player.template.episodeVideoItems[this.player.fileIndex].classList.remove('active');
                    this.player.template.episodeVideoItems[index].classList.add('active');
                    this.player.fileIndex = index;
                    this.player.options.file = this.player.options.fileList[this.player.fileIndex];

                    this.hide();
                    this.player.events.trigger('episode_start');
                    this.player.notice('准备播放：' + this.player.options.file.name, 5000);
                }
                else {
                    this.player.notice('没有上一集了');
                }
            });

            this.player.template.episodeNextButton.addEventListener('click', (e) => {
                const index = this.player.fileIndex + 1;
                if (index <= this.player.options.fileList.length - 1) {
                    this.player.template.episodeVideoItems[this.player.fileIndex].classList.remove('active');
                    this.player.template.episodeVideoItems[index].classList.add('active');
                    this.player.fileIndex = index;
                    this.player.options.file = this.player.options.fileList[this.player.fileIndex];

                    this.hide();
                    this.player.events.trigger('episode_start');
                    this.player.notice('准备播放：' + this.player.options.file.name, 5000);
                }
                else {
                    this.player.notice('没有下一集了');
                }
            });
        }

        switchVideo() {
            this.player.switchVideo({
                url: this.player.quality.url,
                type: 'hls'
            });

            this.player.video.oncanplay = () => {
                this.player.video.oncanplay = null;
                this.player.play();

                this.player.events.trigger('quality_end');
            };
        }

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
    class MemoryPlay {
        constructor(player, obj) {
            this.player = player;
            this.file_id = this.player.options?.file?.file_id;
            this.hasMemoryDisplay = false;

            Object.assign(this.player.user.storageName, { automemoryplay: "dplayer-automemoryplay" });
            Object.assign(this.player.user.default, { automemoryplay: 0 });
            this.player.user.init();
            this.automemoryplay = this.player.user.get("automemoryplay");

            this.player.template.autoMemoryPlay = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-automemoryplay"><span class="dplayer-label">自动记忆播放</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>');
            this.player.template.autoMemoryPlayToggle = obj.query('input', this.player.template.autoMemoryPlay);
            this.player.template.autoMemoryPlayToggle.checked = this.automemoryplay;

            this.player.template.autoMemoryPlay.addEventListener('click', () => {
                this.automemoryplay = this.player.template.autoMemoryPlayToggle.checked = !this.player.template.autoMemoryPlayToggle.checked;
                this.player.user.set("automemoryplay", Number(this.automemoryplay));
                this.player.notice(`自动记忆播放： ${this.automemoryplay ? '开启' : '关闭'}`);
            });

            this.player.on('quality_end', () => {
                if (this.file_id !== this.player.options?.file?.file_id) {
                    this.file_id = this.player.options?.file?.file_id;
                    this.hasMemoryDisplay = false;
                }
                this.run();
            });

            document.onvisibilitychange = () => {
                if (document.visibilityState === 'hidden') {
                    const { video: { currentTime, duration } } = this.player;
                    this.setTime(this.file_id, currentTime, duration);
                }
            };

            window.onbeforeunload = () => {
                const { video: { currentTime, duration } } = this.player;
                this.setTime(this.file_id, currentTime, duration);
            };

            this.run();
        }

        run() {
            if (this.hasMemoryDisplay === false) {
                this.hasMemoryDisplay = true;

                const { video: { currentTime, duration } } = this.player;
                const memoryTime = this.getTime(this.file_id);
                if (memoryTime && memoryTime > currentTime) {
                    if (this.automemoryplay) {
                        this.player.seek(memoryTime);

                        if (this.player.video.paused) {
                            this.player.play();
                        }
                    }
                    else {
                        const fTime = this.formatTime(memoryTime);
                        let memoryNode = document.createElement('div');
                        memoryNode.setAttribute('class', 'memory-play-wrap');
                        memoryNode.setAttribute('style', 'display: block;position: absolute;left: 33px;bottom: 66px;font-size: 15px;padding: 7px;border-radius: 3px;color: #fff;z-index:100;background: rgba(0,0,0,.5);');
                        memoryNode.innerHTML = '上次播放到：' + fTime + '&nbsp;&nbsp;<a href="javascript:void(0);" class="play-jump" style="text-decoration: none;color: #06c;"> 跳转播放 &nbsp;</a><em class="close-btn" style="display: inline-block;width: 15px;height: 15px;vertical-align: middle;cursor: pointer;background: url(https://nd-static.bdstatic.com/m-static/disk-share/widget/pageModule/share-file-main/fileType/video/img/video-flash-closebtn_15f0e97.png) no-repeat;"></em>';
                        this.player.container.insertBefore(memoryNode, null);

                        let memoryTimeout = setTimeout(() => {
                            this.player.container.removeChild(memoryNode);
                        }, 15000);

                        memoryNode.querySelector('.close-btn').onclick = () => {
                            this.player.container.removeChild(memoryNode);
                            clearTimeout(memoryTimeout);
                        };

                        memoryNode.querySelector('.play-jump').onclick = () => {
                            this.player.seek(memoryTime);
                            this.player.container.removeChild(memoryNode);
                            clearTimeout(memoryTimeout);
                        }
                    }
                }
            }
        }

        getTime(e) {
            return localStorage.getItem("video_" + e) || 0;
        }

        setTime(e, t, o) {
            e && t && (e = "video_" + e, t <= 60 || t + 120 >= o || 0 ? localStorage.removeItem(e) : localStorage.setItem(e, t));
        }

        formatTime(seconds) {
            var secondTotal = Math.round(seconds)
                , hour = Math.floor(secondTotal / 3600)
                , minute = Math.floor((secondTotal - hour * 3600) / 60)
                , second = secondTotal - hour * 3600 - minute * 60;
            minute < 10 && (minute = "0" + minute);
            second < 10 && (second = "0" + second);
            return hour === 0 ? minute + ":" + second : hour + ":" + minute + ":" + second;
        }
    },
    class SkipPosition {
        constructor(player, obj) {
            this.player = player;
            this.file_id = this.player.options?.file?.file_id;
            this.timer = null;

            Object.assign(this.player.user.storageName, { skipposition: "dplayer-skipposition", skipstarttime: "dplayer-skipstarttime", skipendtime: "dplayer-endtime" });
            Object.assign(this.player.user.default, { skipposition: 0, skipstarttime: 0, skipendtime: 0 });
            this.player.user.init();
            this.skipposition = this.player.user.get("skipposition");
            this.skipstarttime = this.player.user.get("skipstarttime");
            this.skipendtime = this.player.user.get("skipendtime");

            this.player.template.skipPosition = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-skipposition"><span class="dplayer-label">跳过片头片尾</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>');
            this.player.template.skipPositionToggle = obj.query('input', this.player.template.skipPosition);
            this.player.template.skipPositionToggle.checked = this.skipposition;

            this.player.template.skipPositionBox = obj.insertAfter(this.player.template.settingBox, '<div class="dplayer-setting-skipposition-item" style="display: none;right: 155px;position: absolute;bottom: 50px;width: 150px;border-radius: 2px;background: rgba(28, 28, 28, 0.9);padding: 7px 0px;transition: all 0.3s ease-in-out 0s;overflow: hidden;z-index: 2;"><div class="dplayer-skipposition-item" style="padding: 5px 10px;box-sizing: border-box;cursor: pointer;position: relative;"><span class="dplayer-skipposition-label" title="双击设置当前时间为跳过片头时间" style="color: #eee;font-size: 13px;display: inline-block;vertical-align: middle;white-space: nowrap;">片头时间：</span><input type="number" style="width: 55px;height: 15px;top: 3px;font-size: 13px;border: 1px solid #fff;border-radius: 3px;text-align: center;" step="1" min="0" value="60"></div><div class="dplayer-skipposition-item" style="padding: 5px 10px;box-sizing: border-box;cursor: pointer;position: relative;"><span class="dplayer-skipposition-label" title="双击设置剩余时间为跳过片尾时间" style="color: #eee;font-size: 13px;display: inline-block;vertical-align: middle;white-space: nowrap;">片尾时间：</span><input type="number" style="width: 55px;height: 15px;top: 3px;font-size: 13px;border: 1px solid #fff;border-radius: 3px;text-align: center;" step="1" min="0" value="120"></div></div>');
            this.player.template.skipPositionItems = obj.queryAll('.dplayer-skipposition-item', this.player.template.skipPositionBox);
            this.player.template.jumpStartSpan = obj.query('span', this.player.template.skipPositionItems[0]);
            this.player.template.jumpStartInput = obj.query('input', this.player.template.skipPositionItems[0]);
            this.player.template.jumpEndSpan = obj.query('span', this.player.template.skipPositionItems[1]);
            this.player.template.jumpEndInput = obj.query('input', this.player.template.skipPositionItems[1]);
            this.player.template.jumpStartInput.value = this.skipstarttime;
            this.player.template.jumpEndInput.value = this.skipendtime;

            this.player.template.jumpStartSpan.addEventListener('dblclick', (event) => {
                this.player.template.jumpStartInput.value = this.player.video.currentTime;
                this.skipstarttime = this.player.video.currentTime;
            });
            this.player.template.jumpStartInput.addEventListener('input', (event) => {
                this.skipstarttime = event.target.value * 1;
                this.player.user.set("skipstarttime", this.skipstarttime);
            });
            this.player.template.jumpEndSpan.addEventListener('dblclick', (event) => {
                this.skipendtime = this.player.video.duration - this.player.video.currentTime;
                this.player.template.jumpEndInput.value = this.skipendtime;
            });
            this.player.template.jumpEndInput.addEventListener('input', (event) => {
                this.skipendtime = event.target.value * 1;
                this.player.user.set("skipendtime", this.skipendtime);
            });

            this.player.template.skipPosition.addEventListener('click', () => {
                this.skipposition = this.player.template.skipPositionToggle.checked = !this.player.template.skipPositionToggle.checked;
                this.player.user.set("skipposition", Number(this.skipposition));
                this.skipposition ? this.show() : this.hide();
                this.player.notice(`跳过片头片尾： ${this.skipposition ? '开启' : '关闭'}`);
            });
            this.player.template.skipPosition.addEventListener('mouseenter', () => {
                if (this.skipposition) {
                    this.show();
                }
            });

            this.player.template.mask.addEventListener('click', () => {
                this.hide();
            });

            this.player.on('quality_end', () => {
                if (this.file_id !== this.player.options?.file?.file_id) {
                    this.file_id = this.player.options?.file?.file_id;
                    this.jumpStart();
                    this.jumpEnd();
                }
            });

            if (this.skipposition) {
                this.jumpStart();
                this.jumpEnd();
            }
        }

        jumpStart() {
            if (this.skipposition && this.skipstarttime > this.player.video.currentTime) {
                this.player.video.currentTime = this.skipstarttime;
            }
        }

        jumpEnd() {
            if (!this.timer) {
                this.timer = setInterval(() => {
                    if (this.skipposition && this.skipendtime >= (this.player.video.duration - this.player.video.currentTime)) {
                        this.player.video.currentTime = this.player.video.duration;
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                }, 3000);
            }
        }

        show() {
            this.player.template.skipPositionBox.style.display = 'block';
        }

        hide() {
            this.player.template.skipPositionBox.style.display = 'none';
        }

    },
    class Subtitle {
        constructor(player, obj) {
            this.player = player;
            this.offset = 0;
            this.offsetStep = 1;
            this.color = this.get('color') || '#fff';
            this.bottom = this.get('bottom') || '40px';
            this.fontSize = this.get('fontSize') || '20px';

            Object.assign(this.player.user.storageName, { specialsubtitle: "dplayer-specialsubtitle" });
            Object.assign(this.player.user.default, { specialsubtitle: 0 });
            this.player.user.init();
            this.specialsubtitle = this.player.user.get("specialsubtitle");
            if (this.specialsubtitle) {
                return;
            }
            this.player.template.subtitleSpecial = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-specialsubtitle"><span class="dplayer-label">特效字幕</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>');
            this.player.template.subtitleSpecialToggle = obj.query('input', this.player.template.subtitleSpecial);
            this.player.template.subtitleSpecialToggle.checked = this.specialsubtitle;
            this.player.template.subtitleSpecial.addEventListener('click', () => {
                this.specialsubtitle = this.player.template.subtitleSpecialToggle.checked = !this.player.template.subtitleSpecialToggle.checked;
                this.player.user.set("specialsubtitle", Number(this.specialsubtitle));
                this.player.notice(`特效字幕： ${this.specialsubtitle ? '开启' : '关闭'}`);
                this.specialsubtitle && location.reload();
            });

            if (!player.events.type('subtitle_end')) {
                player.events.playerEvents.push('subtitle_end');
            }
            player.on('subtitle_end', () => {
                this.add(this.player.options.subtitles);
            });
            this.player.events.trigger('subtitle_start');

            this.player.on('quality_end', () => {
                this.player.template.subtitle.innerHTML = `<p></p>`;
                if (this.player.options.subtitle.url.length && this.player.options.subtitles.length) {
                    this.switch(this.player.options.subtitles[this.player.options.subtitle.index]);
                }
                else {
                    this.player.events.trigger('subtitle_start');
                }
            });

            this.player.on('episode_end', () => {
                this.clear();

                this.style({
                    color: this.color,
                    bottom: this.bottom,
                    fontSize: this.fontSize,
                });
            });

            this.player.on('video_end', () => {
                this.style({
                    color: this.color,
                    bottom: this.bottom,
                    fontSize: this.fontSize,
                });
            });

            this.player.template.subtitleSettingBox = obj.append(this.player.template.controller, '<div class="dplayer-icons dplayer-comment-box subtitle-setting-box" style="bottom: 10px;left: auto;right: 400px !important;display: block;"><div class="dplayer-comment-setting-box"><div class="dplayer-comment-setting-color"><div class="dplayer-comment-setting-title">字幕颜色<button type="text" class="color-custom" style="line-height: 16px;font-size: 12px;top: 12px;right: 12px;color: #fff;background: rgba(28, 28, 28, 0.9);position: absolute;">自定义</button></div><label><input type="radio" name="dplayer-danmaku-color-1" value="#fff" checked=""><span style="background: #fff;"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#e54256"><span style="background: #e54256"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#ffe133"><span style="background: #ffe133"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#64DD17"><span style="background: #64DD17"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#39ccff"><span style="background: #39ccff"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#D500F9"><span style="background: #D500F9"></span></label></div><div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕位置</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>上移</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0" checked=""><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>下移</span></label></div><div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕大小</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>加大</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>减小</span></label></div><div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕偏移<div style="margin-top: -30px;right: 14px;position: absolute;">偏移量<input type="number" class="subtitle-offset-step" style="height: 14px;width: 50px;margin-left: 4px;border: 1px solid #fff;border-radius: 3px;color: #fff;background: rgba(28, 28, 28, 0.9);text-align: center;" value="1" step="1" min="1"></div></div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>前移</span></label><label><span><input type="text" class="subtitle-offset" style="width: 94%;height: 14px;background: rgba(28, 28, 28, 0.9);border: 0px solid #fff;text-align: center;" value="0" title="双击恢复默认"></span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>后移</span></label></div><div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">更多字幕功能</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>本地字幕</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>待定</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>待定</span></label></div></div></div>');
            this.player.template.subtitleCommentSettingBox = obj.query('.dplayer-comment-setting-box', this.player.template.subtitleSettingBox);
            this.player.template.subtitleSetting = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-subtitle"><span class="dplayer-label">字幕设置</span><div class="dplayer-toggle"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z"></path></svg></div></div>');
            this.player.template.mask.addEventListener('click', () => {
                this.hide();
            });
            this.player.template.subtitleSetting.addEventListener('click', () => {
                this.toggle();
            });

            this.player.template.subtitleColorPicker = obj.append(this.player.template.container, '<input type="color" id="colorPicker">');
            this.player.template.subtitleColorCustom = obj.query('.color-custom', this.player.template.subtitleCommentSettingBox);
            this.player.template.subtitleColorCustom.addEventListener('click', () => {
                this.player.template.subtitleColorPicker.click();
            });
            this.player.template.subtitleColorPicker.addEventListener('input', (event) => {
                this.color = event.target.value;
                this.set("color", this.color);
                this.style({ color: this.color });
            });

            this.player.template.subtitleSettingColor = obj.query('.dplayer-comment-setting-color', this.player.template.subtitleCommentSettingBox);
            this.player.template.subtitleSettingColor.addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    this.color = event.target.value;
                    this.set("color", this.color);
                    this.style({ color: this.color });
                }
            });

            this.player.template.subtitleSettingItem = obj.queryAll('.dplayer-comment-setting-type', this.player.template.subtitleCommentSettingBox);
            this.player.template.subtitleSettingItem[0].addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    if (event.target.value == "1") {
                        this.bottom = parseFloat(this.bottom) + 1 + this.bottom.replace(/[\d\.]+/, '');
                    }
                    else if (event.target.value == "2") {
                        this.bottom = parseFloat(this.bottom) - 1 + this.bottom.replace(/[\d\.]+/, '');
                    }
                    else {
                        this.bottom = '20px';
                    }
                    this.set('bottom', this.bottom);
                    this.style({ bottom: this.bottom });
                }
            });

            this.player.template.subtitleSettingItem[1].addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    if (event.target.value == "1") {
                        this.fontSize = parseFloat(this.fontSize) + 1 + this.fontSize.replace(/[\d\.]+/, '');
                    }
                    else if (event.target.value == "2") {
                        this.fontSize = parseFloat(this.fontSize) - 1 + this.fontSize.replace(/[\d\.]+/, '');
                    }
                    else {
                        this.fontSize = '40px';
                    }
                    this.set("fontSize", this.fontSize);
                    this.style({ fontSize: this.fontSize });
                }
            });

            this.player.template.subtitleOffsetStep = obj.query('.subtitle-offset-step', this.player.template.subtitleSettingItem[2]);
            this.player.template.subtitleOffsetStep.addEventListener('input', (event) => {
                this.offsetStep = event.target.value * 1;
            });

            this.player.template.subtitleOffset = obj.query('.subtitle-offset', this.player.template.subtitleSettingItem[2]);
            this.player.template.subtitleOffset.addEventListener('input', (event) => {
                this.offset = event.target.value * 1;
                this.subtitleOffset();
            });
            this.player.template.subtitleOffset.addEventListener('dblclick', (event) => {
                if (this.offset != 0) {
                    this.offset = 0;
                    event.target.value = 0;
                    this.subtitleOffset();
                }
            });

            this.player.template.subtitleSettingItem[2].addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    if (event.target.type === "radio") {
                        let value = this.player.template.subtitleOffset.value *= 1;
                        if (event.target.value == "1") {
                            value += this.offsetStep || 1;
                        }
                        else if (event.target.value == "2") {
                            value -= this.offsetStep || 1;
                        }
                        else {
                            value = 0;
                        }
                        this.offset = value;
                        this.player.template.subtitleOffset.value = value;
                        this.subtitleOffset();
                    }
                }
            });

            this.player.template.subtitleLocalFile = obj.append(this.player.template.container, '<input class="subtitleLocalFile" type="file" accept="webvtt,.vtt,.srt,.ssa,.ass" style="display: none;">');
            this.player.template.subtitleSettingItem[3].addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    if (event.target.value == "1") {
                        this.player.template.subtitleLocalFile.click();
                        this.hide();
                    }
                }
            });
            this.player.template.subtitleLocalFile.addEventListener("change", (event) => {
                if (event.target.files.length) {
                    const file = event.target.files[0];
                    const file_ext = file.name.split(".").pop().toLowerCase();
                    this.blobToText(file).then((text) => {
                        let subtitleOption = {};
                        subtitleOption.url = '';
                        subtitleOption.sarr = this.subParser(text, file_ext);
                        subtitleOption.lang = this.getlangBySarr(subtitleOption.sarr);
                        subtitleOption.name = subtitleOption.name || this.langToLabel(subtitleOption.lang);
                        this.add([subtitleOption]);
                        this.switch(subtitleOption);
                    });
                }
                event.target.value = "";
            });

            const lastItemIndex = this.player.template.subtitlesItem.length - 1;
            this.player.template.subtitlesItem[lastItemIndex].addEventListener("click", () => {
                this.player.options.subtitle.index = lastItemIndex;
                this.player.template.subtitle.innerHTML = `<p></p>`;
                this.player.subtitles.subContainerHide();
            });

            this.style({
                color: this.color,
                bottom: this.bottom,
                fontSize: this.fontSize,
            });
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
                this.player.options.subtitle.url.splice(i, 0, item);

                let itemNode = document.createElement('div');
                itemNode.setAttribute('class', 'dplayer-subtitles-item');
                itemNode.innerHTML = '<span class="dplayer-label">' + (item.name + ' ' + (item.language || item.lang || "")) + '</span>';
                this.player.template.subtitlesBox.insertBefore(itemNode, this.player.template.subtitlesBox.childNodes[i]);

                itemNode.addEventListener('click', (event) => {
                    this.player.subtitles.hide();
                    if (this.player.options.subtitle.index !== i + 1) {
                        this.player.options.subtitle.index = i + 1;

                        this.player.template.subtitle.innerHTML = `<p></p>`;
                        this.switch(item);

                        if (this.player.template.subtitle.classList.contains('dplayer-subtitle-hide')) {
                            this.player.subtitles.subContainerShow();
                        }
                    }
                });
            });
            this.player.template.subtitlesItem = this.player.template.subtitlesBox.querySelectorAll('.dplayer-subtitles-item');

            if (!(this.player.video.textTracks.length && this.player.video.textTracks[0]?.cues && this.player.video.textTracks[0].cues.length)) {
                this.player.options.subtitle.index = this.player.options.subtitles.findIndex((item) => {
                    return ['cho', 'chi'].includes(item.language);
                });
                if (this.player.options.subtitle.index < 0) {
                    this.player.options.subtitle.index = 0;
                }
                this.switch(this.player.options.subtitle.url[this.player.options.subtitle.index]);
            }
        }

        switch(newOption = {}) {
            return this.initCues(newOption).then((subArr) => {
                if (newOption.name) {
                    //this.player.notice(`切换字幕: ${newOption.name}`);
                }
            });
        }

        restart() {
            this.clear();
            this.add(this.player.options.subtitles);
        }

        clear() {
            this.player.template.subtitle.innerHTML = `<p></p>`;
            this.player.options.subtitles = [];
            this.player.options.subtitle.url = [];
            for (let i = this.player.template.subtitlesItem.length - 2; i >= 0; i--) {
                this.player.template.subtitlesBoxPanel.removeChild(this.player.template.subtitlesItem[i]);
            }
            this.player.template.subtitlesItem = this.player.template.subtitlesBoxPanel.querySelectorAll('.dplayer-subtitles-item');
        }

        initCues(subtitleOption) {
            return this.urlToArray(subtitleOption).then((subtitleOption) => {
                return this.createTrack(subtitleOption);
            });
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
                        subtitleOption.name = subtitleOption.name || this.langToLabel(subtitleOption.lang);
                        return subtitleOption;
                    });
                }
                else {
                    return Promise.reject();
                }
            }
        }

        createTrack(subtitleOption) {
            const { video } = this.player;
            const textTracks = video.textTracks;
            const textTrack = textTracks[0];

            textTrack.mode === "hidden" || (textTrack.mode = "hidden");
            if (textTrack.cues && textTrack.cues.length) {
                for (let i = textTrack.cues.length - 1; i >= 0; i--) {
                    textTrack.removeCue(textTrack.cues[i]);
                }
            }

            subtitleOption.sarr.forEach(function (item, index) {
                const textTrackCue = new VTTCue(item.startTime, item.endTime, item.text);
                textTrackCue.id = item.index;
                textTrack.addCue(textTrackCue);
            });
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

        subParser(stext, sext, delay = 0) {
            if (!sext) {
                sext = (/\d\s?-?->\s?\d/.test(stext) ? "srt" : /^\s*\[Script Info\]\r?\n/.test(stext) && /\s*\[Events\]\r?\n/.test(stext) ? "ass" : "");
            }
            var regex, data = [], items = [];
            switch (sext) {
                case "webvtt":
                case "vtt":
                case "srt":
                    stext = stext.replace(/\r/g, "");
                    regex = /(\d+)?\n?(\d{0,2}:?\d{2}:\d{2}.\d{3})\s?-?->\s?(\d{0,2}:?\d{2}:\d{2}.\d{3})/g;
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
                    console.error("未知字幕格式，无法解析", stext);
                    return items;
            }

            function parseTimestamp(e) {
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

        subtitleOffset() {
            const { video, subtitle, events } = this.player;
            const textTrack = video.textTracks[0];
            if (textTrack && textTrack.cues) {
                const cues = Array.from(textTrack.cues);
                const sarr = this.player.options.subtitle.url.find((item) => {
                    return item.sarr && item.sarr[parseInt(item.sarr.length / 2)].text === cues[parseInt(cues.length / 2)].text;
                })?.sarr;
                if (!sarr) {
                    return;
                }

                for (let index = 0; index < cues.length; index++) {
                    const cue = cues[index];
                    cue.startTime = sarr[index].startTime + this.offset;
                    cue.endTime = sarr[index].endTime + this.offset;
                }

                events.trigger('subtitle_change');

                this.player.notice(`字幕偏移: ${this.offset} 秒`);
            }
            else {
                this.offset = 0;
            }
        }

        toggle() {
            if (this.player.template.subtitleCommentSettingBox.classList.contains('dplayer-comment-setting-open')) {
                this.hide();
            } else {
                this.show();
            }
        }

        show() {
            this.player.template.subtitleCommentSettingBox.classList.add('dplayer-comment-setting-open');
            this.player.template.mask.classList.add('dplayer-mask-show');
        }

        hide() {
            this.player.template.subtitleCommentSettingBox.classList.remove('dplayer-comment-setting-open');
            this.player.template.settingBox.classList.remove('dplayer-setting-box-open');
            this.player.template.mask.classList.remove('dplayer-mask-show');
        }

        get(key) {
            return localStorage.getItem("dplayer-subtitle-" + key);
        }

        set(key, value) {
            key && value && localStorage.setItem("dplayer-subtitle-" + key, value);
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
    },
    class Libass {
        constructor(player, obj) {
            this.player = player;
            this.loadJs = obj.loadJs;
            this.libass = null;
            this.fontData = null;
            this.hasSubtitleTrack = false;
            this.hasSubtitleDisplay = false;
            this.offset = 0;
            this.offsetStep = 1;
            this.color = -256;
            this.fontSize = 20;
            this.bottom = 10;

            Object.assign(this.player.user.storageName, { libass: "dplayer-libass" });
            Object.assign(this.player.user.default, { libass: 0 });
            this.player.user.init();
            if (!this.player.user.get("libass")) {
                this.player.user.set("libass", 1);
                alert('阿里云盘插件更新提醒\n\n内部支持库版本：' + obj.version + '\n本次更新支持特效字幕（ass/ssa）格式\n请在播放器菜单内开启体验\n\n为了使字幕更加美观，可能会请求本地字体权限，请予以授权');
            }

            Object.assign(this.player.user.storageName, { specialsubtitle: "dplayer-specialsubtitle" });
            Object.assign(this.player.user.default, { specialsubtitle: 0 });
            this.player.user.init();
            this.specialsubtitle = this.player.user.get("specialsubtitle");
            if (!this.specialsubtitle) {
                return;
            }
            this.player.template.subtitleSpecial = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-specialsubtitle"><span class="dplayer-label">特效字幕</span><div class="dplayer-toggle"><input class="dplayer-toggle-setting-input" type="checkbox" name="dplayer-toggle"><label for="dplayer-toggle"></label></div></div>');
            this.player.template.subtitleSpecialToggle = obj.query('input', this.player.template.subtitleSpecial);
            this.player.template.subtitleSpecialToggle.checked = this.specialsubtitle;
            this.player.template.subtitleSpecial.addEventListener('click', () => {
                this.specialsubtitle = this.player.template.subtitleSpecialToggle.checked = !this.player.template.subtitleSpecialToggle.checked;
                this.player.user.set("specialsubtitle", Number(this.specialsubtitle));
                this.player.notice(`特效字幕： ${this.specialsubtitle ? '开启' : '关闭'}`);
                this.specialsubtitle || location.reload();
            });

            if (!this.player.events.type('subtitle_end')) {
                player.events.playerEvents.push('subtitle_end');
            }
            this.player.on('subtitle_end', () => {
                this.add(this.player.options.subtitles);
            });

            this.player.on('quality_end', () => {
                this.setVideo();
                if (this.player.options.subtitle.url.length && this.player.options.subtitles.length) {
                    this.switch(this.player.options.subtitles[this.player.options.subtitle.index]);
                }
                else {
                    if (!this.hasSubtitleDisplay) {
                        this.hasSubtitleDisplay = true;

                        this.player.events.trigger('subtitle_start');
                    }
                }
            });

            this.player.on('episode_end', () => {
                this.hasSubtitleTrack = false;
                this.hasSubtitleDisplay = false;
                this.clear();
            });

            this.player.template.mask.addEventListener('click', () => {
                this.hide();
            });

            this.player.template.subtitleSettingBox = obj.append(this.player.template.controller, '<div class="dplayer-icons dplayer-comment-box subtitle-setting-box" style="bottom: 10px;left: auto;right: 400px !important;display: block;"><div class="dplayer-comment-setting-box"><div class="dplayer-comment-setting-color"><div class="dplayer-comment-setting-title">字幕颜色<button type="text" class="color-custom" style="line-height: 16px;font-size: 12px;top: 12px;right: 12px;color: #fff;background: rgba(28, 28, 28, 0.9);position: absolute;">自定义</button></div><label><input type="radio" name="dplayer-danmaku-color-1" value="#fff"><span style="background: #fff;"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#e54256"><span style="background: #e54256"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#ffe133"><span style="background: #ffe133"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#64DD17"><span style="background: #64DD17"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#39ccff"><span style="background: #39ccff"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#D500F9"><span style="background: #D500F9"></span></label></div><div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕位置</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>上移</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>下移</span></label></div><div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕大小</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>加大</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>默认</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>减小</span></label></div><div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">字幕偏移<div style="margin-top: -30px;right: 14px;position: absolute;">偏移量<input type="number" class="subtitle-offset-step" style="height: 14px;width: 50px;margin-left: 4px;border: 1px solid #fff;border-radius: 3px;color: #fff;background: rgba(28, 28, 28, 0.9);text-align: center;" value="1" step="1" min="1"></div></div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>前移</span></label><label><span><input type="text" class="subtitle-offset" style="width: 94%;height: 14px;background: rgba(28, 28, 28, 0.9);border: 0px solid #fff;text-align: center;" value="0" title="双击恢复默认"></span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>后移</span></label></div><div class="dplayer-comment-setting-type"><div class="dplayer-comment-setting-title">更多字幕功能</div><label><input type="radio" name="dplayer-danmaku-type-1" value="1"><span>本地字幕</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="0"><span>待定</span></label><label><input type="radio" name="dplayer-danmaku-type-1" value="2"><span>待定</span></label></div></div></div>');
            this.player.template.subtitleCommentSettingBox = obj.query('.dplayer-comment-setting-box', this.player.template.subtitleSettingBox);
            this.player.template.subtitleSetting = obj.append(obj.query('.dplayer-setting-origin-panel', this.player.template.settingBox), '<div class="dplayer-setting-item dplayer-setting-subtitle"><span class="dplayer-label">字幕设置</span><div class="dplayer-toggle"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z"></path></svg></div></div>');
            this.player.template.subtitleSetting.addEventListener('click', () => {
                this.toggle();
            });

            this.player.template.subtitleColorPicker = obj.append(this.player.template.container, '<input type="color" id="colorPicker">');
            this.player.template.subtitleColorCustom = obj.query('.color-custom', this.player.template.subtitleCommentSettingBox);
            this.player.template.subtitleColorCustom.addEventListener('click', () => {
                this.player.template.subtitleColorPicker.value = this.color;
                this.player.template.subtitleColorPicker.click();
            });
            this.player.template.subtitleColorPicker.addEventListener('input', (event) => {
                const color = event.target.value;
                this.color = this.fromQColor(color);
                this.player.notice(`设置字幕颜色: ${this.color}`);
                this.setStyle({ PrimaryColour: this.color });
            });

            this.player.template.subtitleSettingColor = obj.query('.dplayer-comment-setting-color', this.player.template.subtitleCommentSettingBox);
            this.player.template.subtitleSettingColor.addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    const color = event.target.value;
                    this.color = this.fromQColor(color);
                    this.player.notice(`设置字幕颜色: ${this.color}`);
                    this.setStyle({ PrimaryColour: this.color });
                }
            });

            this.player.template.subtitleSettingItem = obj.queryAll('.dplayer-comment-setting-type', this.player.template.subtitleCommentSettingBox);
            this.player.template.subtitleSettingItem[0].addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    if (event.target.value == "1") {
                        this.bottom += 1;
                    }
                    else if (event.target.value == "2") {
                        this.bottom -= 1;
                    }
                    else {
                        this.bottom = 10;
                    }
                    this.player.notice(`设置字幕位置: ${this.bottom}`);
                    this.setStyle({ MarginV: this.bottom });
                }
            });

            this.player.template.subtitleSettingItem[1].addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    if (event.target.value == "1") {
                        this.fontSize += 1;
                    }
                    else if (event.target.value == "2") {
                        this.fontSize -= 1;
                    }
                    else {
                        this.fontSize = 20;
                    }
                    this.player.notice(`设置字幕大小: ${this.fontSize}`);
                    this.setStyle({ FontSize: this.fontSize });
                }
            });

            this.player.template.subtitleOffsetStep = obj.query('.subtitle-offset-step', this.player.template.subtitleSettingItem[2]);
            this.player.template.subtitleOffsetStep.addEventListener('input', (event) => {
                this.offsetStep = event.target.value * 1;
            });

            this.player.template.subtitleOffset = obj.query('.subtitle-offset', this.player.template.subtitleSettingItem[2]);
            this.player.template.subtitleOffset.addEventListener('input', (event) => {
                this.offset = event.target.value * 1;
                this.subtitleOffset();
            });
            this.player.template.subtitleOffset.addEventListener('dblclick', (event) => {
                if (this.offset != 0) {
                    this.offset = 0;
                    event.target.value = 0;
                    this.player.notice(`设置字幕偏移: ${this.offset}`);
                    this.timeOffset();
                }
            });

            this.player.template.subtitleSettingItem[2].addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    if (event.target.type === "radio") {
                        let value = this.player.template.subtitleOffset.value *= 1;
                        if (event.target.value == "1") {
                            value += this.offsetStep || 1;
                        }
                        else if (event.target.value == "2") {
                            value -= this.offsetStep || 1;
                        }
                        else {
                            value = 0;
                        }
                        this.offset = value;
                        this.player.template.subtitleOffset.value = value;
                        this.player.notice(`设置字幕偏移: ${this.offset}`);
                        this.timeOffset();
                    }
                }
            });

            this.player.template.subtitleLocalFile = obj.append(this.player.template.container, '<input class="subtitleLocalFile" type="file" accept="webvtt,.vtt,.srt,.ssa,.ass" style="display: none;">');
            this.player.template.subtitleSettingItem[3].addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    if (event.target.value == "1") {
                        this.player.template.subtitleLocalFile.click();
                        this.hide();
                    }
                }
            });
            this.player.template.subtitleLocalFile.addEventListener("change", (event) => {
                if (event.target.files.length) {
                    const file = event.target.files[0];
                    const file_ext = file.name.split(".").pop().toLowerCase();
                    this.blobToText(file).then((stext) => {
                        let subtitleOption = {
                            stext,
                            sext: file_ext,
                            name: '本地字幕'
                        };
                        this.add([subtitleOption]);
                        this.switch(subtitleOption);
                    });
                }
                event.target.value = "";
            });

            this.player.events.trigger('subtitle_start');
            this.player.on('destroy', () => {
                this.destroy();
            });
        }

        add(sublist) {
            if (!(Array.isArray(sublist) && sublist.length)) {
                return;
            }
            if (!(this.player.template.subtitlesBox && this.player.template.subtitlesItem.length)) {
                return;
            }
            if (!this.player.template.subtitlesBoxPanel) {
                this.player.template.subtitlesBoxPanel = this.player.template.subtitlesBox.querySelector('.dplayer-subtitles-panel');
            }

            const lastItemIndex = this.player.template.subtitlesItem.length - 1;
            sublist.forEach((item, index) => {
                const i = lastItemIndex + index;
                this.player.options.subtitle.url.splice(i, 0, item);

                let itemNode = document.createElement('div');
                itemNode.setAttribute('class', 'dplayer-subtitles-item');
                itemNode.innerHTML = '<span class="dplayer-label">' + (item.name + ' ' + (item.language || item.lang || "")) + '</span>';
                this.player.template.subtitlesBoxPanel.insertBefore(itemNode, this.player.template.subtitlesBoxPanel.childNodes[i]);

                itemNode.addEventListener('click', (event) => {
                    this.player.subtitles.hide();
                    if (this.player.options.subtitle.index !== i + 1) {
                        this.player.options.subtitle.index = i + 1;
                        this.switch(item);
                    }
                });
            });
            this.player.template.subtitlesItem = this.player.template.subtitlesBoxPanel.querySelectorAll('.dplayer-subtitles-item');

            if (!this.hasSubtitleTrack) {
                this.hasSubtitleTrack = true;

                this.player.template.subtitlesItem[this.player.template.subtitlesItem.length - 1].addEventListener('click', (event) => {
                    this.subContainerHide();
                });

                let index = this.player.options.subtitles.findIndex((item) => {
                    return ['cho', 'zhi'].includes(item.language);
                });
                if (index < 0) {
                    index = 0;
                }
                this.init(this.player.options.subtitle.url[index]);
                this.player.options.subtitle.index = index + 1;
            }
        }

        init(subtitleOption) {
            return this.initLibass().then(() => {
                return this.urlToText(subtitleOption).then((subtitleOption) => {
                    if (!['ass', 'ssa'].includes(subtitleOption.sext)) {
                        Object.assign(subtitleOption, { stext: this.toAss(subtitleOption.stext, subtitleOption.sext), sext: 'ass' });
                    }
                    this.switchContent(subtitleOption.stext);
                    this.subContainerShow();
                    return subtitleOption;
                });
            }).catch((error) => {
                console.error("加载特效字幕组件 错误！", error);
            });
        }

        switch(newOption = {}) {
            return this.init(newOption).then(() => {
                if (newOption.name) {
                    this.player.notice(`切换字幕: ${newOption.name}`);
                }
            });
        }

        clear() {
            this.player.options.subtitles = [];
            this.player.options.subtitle.url = [];
            for (let i = this.player.template.subtitlesItem.length - 2; i >= 0; i--) {
                this.player.template.subtitlesBoxPanel.removeChild(this.player.template.subtitlesItem[i]);
            }
            this.player.template.subtitlesItem = this.player.template.subtitlesBoxPanel.querySelectorAll('.dplayer-subtitles-item');
            this.destroy();
        }

        toggle() {
            if (this.player.template.subtitleCommentSettingBox.classList.contains('dplayer-comment-setting-open')) {
                this.hide();
            } else {
                this.show();
            }
        }

        show() {
            this.player.template.subtitleCommentSettingBox.classList.add('dplayer-comment-setting-open');
            this.player.template.mask.classList.add('dplayer-mask-show');
        }

        hide() {
            this.player.template.subtitleCommentSettingBox.classList.remove('dplayer-comment-setting-open');
            this.player.template.settingBox.classList.remove('dplayer-setting-box-open');
            this.player.template.mask.classList.remove('dplayer-mask-show');
        }

        initLibass() {
            if (this.libass) return Promise.resolve(this.libass);

            const options = {
                video: this.player.template.video,
                subContent: `[Script Info]\nScriptType: v4.00+`,
                subUrl: '',
                availableFonts: {
                    '思源黑体 cn bold': 'https://cdn.jsdelivr.net/gh/tampermonkeyStorage/Self-use@main/Fonts/SourceHanSansCN-Bold.woff2',
                }
            };

            return this.getLocalFonts().then(fontData => {
                const fonts = fontData.filter(item => item.fullName.match(/[\u4e00-\u9fa5]/));
                const fallbackFont = fonts.find(font => [
                    '微软雅黑',
                ].some(name => font?.fullName === name))?.fullName || fonts.sort(() => 0.5 - Math.random())[0]?.fullName;
                Object.assign(options, {
                    useLocalFonts: true,
                    fallbackFont: fallbackFont,
                });
                return this.loadLibass(options);
            }, () => {
                Object.assign(options, {
                    fallbackFont: Object.keys(options.availableFonts).pop(),
                });
                return this.loadLibass(options);
            });
        }

        loadLibass(options) {
            return this.loadJs('https://cdn.jsdelivr.net/npm/jassub/dist/jassub.umd.js').then(() => {
                Object.assign(options, {
                    workerUrl: 'https://cdn.jsdelivr.net/npm/jassub/dist/jassub-worker.js',
                    wasmUrl: 'https://cdn.jsdelivr.net/npm/jassub/dist/jassub-worker.wasm',
                    legacyWorkerUrl: 'https://cdn.jsdelivr.net/npm/jassub/dist/jassub-worker.wasm.js',
                    modernWasmUrl: 'https://cdn.jsdelivr.net/npm/jassub/dist/jassub-worker-modern.wasm'
                });
                return this.loadWorker(options).then((workerUrl) => {
                    options.workerUrl = workerUrl;
                    this.libass = new unsafeWindow.JASSUB(options);
                    return this.libass;
                });
            });
        }

        loadWorker({ workerUrl }) {
            return fetch(workerUrl).then(res => res.text()).then(text => {
                const workerBlob = new Blob([text], { type: "text/javascript" });
                const workerScriptUrl = URL.createObjectURL(workerBlob);
                setTimeout(() => {
                    URL.revokeObjectURL(workerScriptUrl);
                });
                return workerScriptUrl;
            });
        }

        setVideo(video) {
            if (this.libass) {
                this.libass.setVideo(video || this.player.template.video);
            }
        }

        switchContent(content) {
            if (this.libass && content) {
                this.libass.freeTrack();
                this.libass.setTrack(content);
            }
        }

        subContainerShow() {
            if (this.libass) {
                (this.libass.canvasParent || this.libass._canvasParent).style.display = 'block';
                this.libass.resize();
            }
        }

        subContainerHide() {
            if (this.libass) {
                (this.libass.canvasParent || this.libass._canvasParent).style.display = 'none';
            }
        }

        timeOffset(offset) {
            if (this.libass) {
                this.libass.timeOffset = offset || this.offset;
            }
        }

        getStyles(callback) {
            if (this.libass) {
                this.libass.getStyles((error, styles) => {
                    callback && callback(styles || error);
                });
            }
            else {
                callback && callback('');
            }
        }

        setStyle(style, index = 1) {
            if (this.libass) {
                this.libass.setStyle(style, index);
            }
        }

        destroy() {
            if (this.libass) {
                this.libass.destroy && this.libass.destroy();
                this.libass.dispose && this.libass.dispose();
                this.libass = null;
            }
        }

        getLocalFonts(postscriptNames) {
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

        toAss(text, type) {
            const subContent = type === 'ass' || type === 'ssa' ? text : '';
            if (subContent) return subContent;

            const srtRx = /(?:\d+\n)?(\d{0,2}:?\d{2}:\d{2}.\d{3})\s?-?->\s?(\d{0,2}:?\d{2}:\d{2}.\d{3})(.*)\n([\s\S]*)$/i;
            const srt = text => {
                const subtitles = [];
                const replaced = text.replace(/\r/g, '');
                const timeRx = /(\d{0,2})?:?(\d{2}):(\d{2}.\d{3})/;

                for (const split of replaced.split('\n\n')) {
                    const match = split.match(srtRx);
                    if (match) {
                        match[1] = match[1].replace(timeRx, (_match, hour, minute, second) => {
                            return (hour || '0') + ':' + minute + ':' + second.match(/\d{2}.\d{2}/)[0].replace(',', '.');
                        });
                        match[2] = match[2].replace(timeRx, (_match, hour, minute, second) => {
                            return (hour || '0') + ':' + minute + ':' + second.match(/\d{2}.\d{2}/)[0].replace(',', '.');
                        });

                        const matches = match[4].match(/<[^>]+>/g);
                        if (matches) {
                            matches.forEach(matched => {
                                if (/<\//.test(matched)) { // check if its a closing tag
                                    match[4] = match[4].replace(matched, matched.replace('</', '{\\').replace('>', '0}'));
                                } else {
                                    match[4] = match[4].replace(matched, matched.replace('<', '{\\').replace('>', '1}'));
                                }
                            })
                        }

                        subtitles.push('Dialogue: 0,' + match[1] + ',' + match[2] + ',Default,,0,0,0,,' + match[4].replace(/\n/g, '\\N'));
                    }
                }
                return subtitles.join('\n');
            };

            const options = {
                scriptInfo: {
                    Title: "untitled",
                    ScriptType: "v4.00+",
                    Collisions: "Normal",
                    PlayDepth: 0,
                    Timer: "100,0000",
                    PlayResX: "",
                    PlayResY: "",
                    WrapStyle: 0,
                    ScaledBorderAndShadow: "no"
                },
                v4Styles: [
                    {
                        Name: "Default",
                        Fontname: "Default",
                        Fontsize: 20,
                        PrimaryColour: "&H00FFFFFF",
                        SecondaryColour: "&H00FFFFFF",
                        OutlineColour: "&H00000000",
                        BackColour: "&H00000000",
                        Bold: -1,
                        Italic: 0,
                        Underline: 0,
                        StrikeOut: 0,
                        ScaleX: 100,
                        ScaleY: 100,
                        Spacing: 0,
                        Angle: 0,
                        BorderStyle: 1,
                        Outline: 1,
                        Shadow: 0,
                        Alignment: 2,
                        MarginL: 10,
                        MarginR: 10,
                        MarginV: 10,
                        Encoding: 1
                    },
                ]
            };
            const headers = ['[Script Info]'];
            for (let [key, value] of Object.entries(options.scriptInfo)) {
                headers.push(key + ": " + value);
            }
            headers.push('');
            headers.push('[V4+ Styles]');
            headers.push('Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding');
            options.v4Styles.forEach((styles) => {
                if (typeof styles === 'object') {
                    headers.push("Style: " + Object.values(styles).join(','));
                } else if (typeof styles === 'string') {
                    headers.push(styles);
                }
            });
            headers.push('');
            headers.push('[Events]');
            headers.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');
            headers.push('');

            const assHeader = headers.join('\n');
            switch (type) {
                case 'vtt':
                case 'srt': {
                    return assHeader + srt(text);
                }
                case 'ssa':
                case 'ass': {
                    return subContent;
                }
                default:
                    if (srtRx.test(text)) return assHeader + srt(text);
                    return '';
            }
        }

        urlToText(subtitleOption) {
            if (subtitleOption.stext) {
                return Promise.resolve(subtitleOption);
            }
            else {
                subtitleOption.sext || (subtitleOption.sext = subtitleOption.file_extension);
                const url = subtitleOption.url || subtitleOption.download_url || subtitleOption.uri || subtitleOption.surl;
                return this.requestFile(url).then((text) => {
                    subtitleOption.stext = text;
                    return subtitleOption;
                });
            }
        }

        requestFile(url) {
            return fetch(url, {
                referrer: location.protocol + "//" + location.host + "/",
                referrerPolicy: "origin",
                body: null,
                method: "GET",
                mode: "cors",
                credentials: "omit"
            }).then(data => data.blob()).then(blob => {
                return this.blobToText(blob);
            });
        };

        blobToText(blob) {
            return new Promise(function (resolve, reject) {
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

        fromQColor(color, invert = false) {
            color = color.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => {
                return r + r + g + g + b + b;
            });
            const alpha = 0xffff;
            const [_, red, green, blue] = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
            if (!invert) return '0x' + red << 24 | '0x' + green << 16 | '0x' + blue << 8 | (~alpha & 0xFF);
            return (~'0x' + red & 0xFF) << 24 | (~'0x' + green & 0xFF) << 16 | (~'0x' + blue & 0xFF) << 8 | (~alpha & 0xFF);
        }
    },
    class Appreciation {
        constructor(player, obj) {
            this.player = player;
            this.now = Date.now();
            this.localforage = window.localforage || unsafeWindow.localforage;

            const { contextmenu,
                container: { offsetWidth, offsetHeight }
            } = this.player;

            this.player.template.menuItem[0].addEventListener('click', () => {
                this.showDialog();
            });

            this.player.on('timeupdate', () => {
                if (Date.now() - 1000 * 60 * 4 >= this.now) {
                    this.now = Date.now();
                    this.isAppreciation().then((data) => {
                        this.player.plugins.hls.data = !!data;
                    }).catch((error) => {
                        this.player.pause();
                        contextmenu.show(offsetWidth / 2.5, offsetHeight / 3);
                        contextmenu.shown = true;
                        if (!this.player.plugins.hls.data && confirm('\u8bf7\u8d5e\u8d4f\u540e\u7ee7\u7eed\u89c2\u8d4f')) {
                            this.player.plugins.hls.data = !0;
                            this.showDialog();
                        }
                        this.player.plugins.hls.error = !!error;
                    });
                }
            });

            this.player.template.settingBox.addEventListener('click', (event) => {
                this.isAppreciation().catch((error) => {
                    let input = event.target.querySelector('input') || event.target.parentNode.querySelector('input');
                    input && input.checked && event.target.click();
                    this.player.template.mask.click();
                    event.isTrusted && this.showDialog();
                });
            });
        }

        isAppreciation() {
            this.player.template.menuItem = this.player.container.querySelectorAll('.dplayer-menu-item');
            this.player.template.menu.innerHTML.includes(5254001) || this.player.template.menuItem.length === 4 || this.player.destroy();
            this.localforage || this.player.destroy();
            GM_getValue || GM_setValue || GM_deleteValue || this.player.destroy();
            return this.localforage.getItem("users").then((data) => {
                if (data?.expire_time) {
                    return this.localforage.getItem("users_sign").then((users_sign) => {
                        if (users_sign === btoa(encodeURIComponent(JSON.stringify(data)))) {
                            if (Math.max(Date.parse(data.expire_time) - Date.now(), 0)) {
                                return data;
                            }
                            else {
                                return this.localforage.setItem("users", { expire_time: new Date().toISOString() }).then(() => {
                                    return this.isAppreciation();
                                });
                            }
                        }
                        else {
                            this.usersPost().then((data) => {
                                if (data?.expire_time && Math.max(Date.parse(data.expire_time) - Date.now(), 0)) {
                                    this.localforage.clear().then(() => {
                                        this.localforage.setItem("users", data);
                                        this.localforage.setItem("users_sign", btoa(encodeURIComponent(JSON.stringify(data))));
                                        GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data))));
                                    });
                                    return data;
                                }
                                else {
                                    this.localforage.removeItem("users_sign");
                                    this.localforage.removeItem("users");
                                    GM_deleteValue("users_sign");
                                    return Promise.reject();
                                }
                            });
                        }
                    });
                }
                else {
                    if (GM_getValue("users_sign")) {
                        return this.localforage.setItem("users", { expire_time: new Date().toISOString() }).then(() => {
                            return this.isAppreciation();
                        });
                    }
                    else {
                        this.localforage.removeItem("users_sign");
                        return Promise.reject();
                    }
                }
            });
        }

        showDialog() {
            let dialog = document.createElement('div');
            dialog.innerHTML = '<div class="ant-modal-mask"></div><div tabindex="-1" class="ant-modal-wrap" role="dialog" aria-labelledby="rcDialogTitle1" style=""><div role="document" class="ant-modal modal-wrapper--5SA7y" style="width: 340px;"><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div><div class="ant-modal-content"><div class="ant-modal-header"><div class="ant-modal-title" id="rcDialogTitle1">请少量赞助以支持我更好的创作</div></div><div class="ant-modal-body"><div class="content-wrapper--S6SNu"><div>爱发电订单号：</div><span class="ant-input-affix-wrapper ant-input-affix-wrapper-borderless ant-input-password input--TWZaN input--l14Mo"><input placeholder="" action="click" type="text" class="afdian-order ant-input ant-input-borderless" style="background-color: var(--divider_tertiary);"></span></div><div class="content-wrapper--S6SNu"><div>请输入爱发电订单号，确认即可</div><a href="https://afdian.net/order/create?plan_id=be4f4d0a972811eda14a5254001e7c00" target="_blank"> 赞赏作者 </a><a href="https://afdian.net/dashboard/order" target="_blank"> 复制订单号 </a></div></div><div class="ant-modal-footer"><div class="footer--cytkB"><button class="button--WC7or secondary--vRtFJ small--e7LRt cancel-button--c-lzN">取消</button><button class="button--WC7or primary--NVxfK small--e7LRt">确定</button></div></div></div><div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden; outline: none;"></div></div></div>';
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
                                this.localforage.getItem('users').then((data) => {
                                    (data && data.ON == value) || this.onPost(value).catch(() => {
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

        onPost(on) {
            return this.usersPost().then((data) => {
                Date.parse(data.expire_time) === 0 || this.localforage.setItem("users", Object.assign(data || {}, { expire_time: new Date(Date.now() + 864000).toISOString() })).then((data) => { this.localforage.setItem("users_sign", btoa(encodeURIComponent(JSON.stringify(data)))) });
                return this.infoPost(data, on);
            });
        }

        usersPost() {
            return this.users(this.getItem("token"));
        }

        users(data) {
            return this.ajax({
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
        }

        ajax(option) {
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
        }

        setItem(n, t) {
            n && t != undefined && localStorage.setItem(n, t instanceof Object ? JSON.stringify(t) : t);
        }

        removeItem(n) {
            n != undefined && localStorage.removeItem(n);
        }
    },
    class DoHotKey {
        constructor(player) {
            this.player = player;

            this.player.template.videoWrap.addEventListener('dblclick', (event) => {
                this.player.fullScreen.toggle();
            });

            document.addEventListener("wheel", (event) => {
                if (this.player.focus) {
                    event = event || window.event;
                    var o, t = this.player;
                    if (event.deltaY < 0) {
                        o = t.volume() + .01;
                        t.volume(o);
                    } else if (event.deltaY > 0) {
                        o = t.volume() - .01;
                        t.volume(o);
                    }
                }
            });
        }
    },
]);
