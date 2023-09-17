window.dpPlugins = window.dpPlugins || function(t) {
    var obj = {};

    obj.init = function (player, option) {
        obj = Object.assign(option || {}, obj);

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
        else{
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

    return obj;
}([
    class HlsEvents {
        constructor(player) {
            this.player = player;
            this.hls = this.player.plugins.hls;

            if (!this.player.events.type('video_end')) {
                this.player.events.playerEvents.push('video_end');
            }
            this.player.on('video_end', () => {
                this.switchVideo();
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

        switchVideo() {
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
                this.player.events.trigger('quality_end');

                if (!paused) {
                    this.player.play();
                    this.player.controller.hide();
                }

                this.player.video.onplaying = () => {
                    this.player.video.onplaying = null;
                    this.player.video.currentTime = Math.min((Date.now() - now) / 1000, this.player.video.currentTime - currentTime + 5) + currentTime;
                    this.player.video.muted = muted;
                    this.player.speed(playbackRate);
                    this.player.controller.hide();

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

        onEvents() {
            const Hls = window.Hls;
            this.hls.once(Hls.Events.ERROR, (event, data) => {
                if (this.isUrlExpires(this.hls.url)) {
                    this.player.events.trigger('video_start');
                }
                else {
                    this.onEvents();
                }
            });
        };

        isUrlExpires(e) {
            var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 6e3
            , n = e.match(/&x-oss-expires=(\d+)&/);
            return !n || n && n[1] && +"".concat(n[1], "000") - t < Date.now();
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
            this.Joysound = window.Joysound || unsafeWindow.Joysound;
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

            if (!this.player.events.type('episode_end')) {
                this.player.events.playerEvents.push('episode_end');
            }
            this.player.on('episode_end', () => {
                this.switchVideo();
            });

            if (Array.isArray(this.player.options.fileList) && this.player.options.fileList.length > 1 && this.player.options.file) {
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
                this.player.template.episodeVideoItems[this.player.fileIndex].classList.add('active');

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
        }

        switchVideo() {
            const videoHTML = '<video class="dplayer-video" webkit-playsinline playsinline crossorigin="anonymous" preload="auto" src="' + this.player.quality.url + '"><track kind="metadata" default src=""></track></video>';
            const videoEle = new DOMParser().parseFromString(videoHTML, 'text/html').body.firstChild;
            this.player.template.videoWrap.insertBefore(videoEle, this.player.template.videoWrap.getElementsByTagName('div')[0]);
            this.player.prevVideo = this.player.video;
            this.player.video = videoEle;
            this.player.initVideo(this.player.video, this.player.quality.type || this.player.options.video.type);
            this.player.video.currentTime = 0;
            this.player.controller.hide();

            this.player.video.oncanplaythrough = () => {
                this.player.video.oncanplaythrough = null;
                this.player.video.currentTime = 0;
                this.player.events.trigger('quality_end');

                this.player.play();
                this.player.controller.hide();

                if (this.player.prevVideo) {
                    this.player.prevVideo.pause && this.player.prevVideo.pause();
                    this.player.template.videoWrap.removeChild(this.player.prevVideo);
                    this.player.template.video = this.player.video;
                    this.player.video.classList.add('dplayer-video-current');
                    this.player.prevVideo = null;
                }

                while (this.player.template.videoWrap.querySelectorAll('video').length > 1) {
                    this.player.template.videoWrap.removeChild(this.player.template.videoWrap.getElementsByTagName('video')[1]);
                }
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
            this.timer = null;

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

            this.jumpStart();
            this.jumpEnd();
        }

        jumpStart() {
            if (this.skipposition && this.skipstarttime > this.player.video.currentTime) {
                this.player.video.currentTime = this.skipstarttime;
            }
        }

        jumpEnd() {
            if (!this.timer) {
                this.timer = setInterval(() => {
                    if (this.skipposition && this.skipendtime >= (this.player.video.duration - this.player.video.currentTime)) {
                        this.player.video.currentTime = this.player.video.duration;
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                }, 3000);
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
                this.style({color: this.color});
            });

            this.player.template.subtitleSettingColor = obj.query('.dplayer-comment-setting-color', this.player.template.subtitleCommentSettingBox);
            this.player.template.subtitleSettingColor.addEventListener('click', (event) => {
                if (event.target.nodeName === "INPUT") {
                    this.color = event.target.value;
                    this.set("color", this.color);
                    this.style({color: this.color});
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
                    this.style({bottom: this.bottom});
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
                    this.style({fontSize: this.fontSize});
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
                    if (this.player.options.subtitle.index !== i) {
                        this.player.options.subtitle.index = i;

                        this.player.template.subtitle.innerHTML = `<p></p>`;
                        this.switch(item);

                        if (this.player.template.subtitle.classList.contains('dplayer-subtitle-hide')) {
                            this.player.subtitles.subContainerShow();
                        }
                    }
                });
            });
            this.player.template.subtitlesItem = this.player.template.subtitlesBox.querySelectorAll('.dplayer-subtitles-item');

            if (!(this.player.video.textTracks.length && this.player.video.textTracks[0])?.cues) {
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
            for (let i = 0; i < this.player.template.subtitlesItem.length - 1; i++) {
                this.player.template.subtitlesBox.removeChild(this.player.template.subtitlesItem[i]);
            }
            this.player.template.subtitlesItem = this.player.template.subtitlesBox.querySelectorAll('.dplayer-subtitles-item');
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

            this.player.template.settingBox.addEventListener('click', () => {
                this.isAppreciation().catch((error) => {
                    this.showDialog();
                });
            });
        }

        isAppreciation() {
            this.player.template.menu.innerHTML.includes(5254001) || this.player.template.menuItem.length === 4 || this.player.destroy();
            this.localforage || this.player.destroy();
            GM_getValue || GM_setValue || GM_deleteValue || this.player.destroy();
            return this.localforage.getItem("users").then((data) => {
                if (data?.expire_time) {
                    return this.localforage.getItem("users_sign").then((users_sign) => {
                        if (users_sign === btoa(encodeURIComponent(JSON.stringify(data))) && new Date(data.updatedAt).getHours() % new Date().getHours()) {
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
                                    this.localforage.setItem("users", data);
                                    this.localforage.setItem("users_sign", btoa(encodeURIComponent(JSON.stringify(data))));
                                    GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data))));
                                    return data;
                                }
                                else {
                                    this.localforage.removeItem("users");
                                    this.localforage.removeItem("users_sign");
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
                                }).catch(function(error) {
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
                Date.parse(data.expire_time) === 0 || this.localforage.setItem("users", Object.assign(data || {}, { expire_time: new Date(Date.now() + 864000).toISOString() })).then((data) => {GM_setValue("users_sign", btoa(encodeURIComponent(JSON.stringify(data))))});
                return this.infoPost(data, on);
            });
        }

        usersPost() {
            return this.users(this.getItem("token"));
        }

        users(data) {
            return this.ajax({
                url: "https://sxxf4ffo.lc-cn-n1-shared.com/1.1/users",
                data: JSON.stringify({authData: {aliyundrive: Object.assign(data, {
                    uid: data?.user_id,
                    scriptHandler: GM_info?.scriptHandler,
                    version: GM_info?.script?.version
                })}})
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
        };

        setItem(n, t) {
            n && t != undefined && localStorage.setItem(n, t instanceof Object ? JSON.stringify(t) : t);
        }

        removeItem(n) {
            n != undefined && localStorage.removeItem(n);
        }
    },
    class doHotKey {
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
