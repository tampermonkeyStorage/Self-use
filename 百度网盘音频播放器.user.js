// ==UserScript==
// @name         百度网盘音频播放器
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.7
// @description  无视文件大小，无视文件格式，告别卡顿即点即播，连歌词都帮你找好了
// @author       You
// @match        https://pan.baidu.com/disk/main*
// @connect      kugou.com
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// @require      https://cdn.staticfile.org/crypto-js/4.1.1/crypto-js.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.0/hls.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.js
// @resource     aplayerCSS https://cdnjs.cloudflare.com/ajax/libs/aplayer/1.10.1/APlayer.min.css
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @license      我本将心向明月，奈何明月照沟渠
// @antifeature  明月几时有
// ==/UserScript==

(function() {
    'use strict';

    var $ = $ || window.$;
    var obj = {
        audio_page: {
            fileList: [],
            fileIndex: -1
        }
    };

    obj.replaceNativePlayer = function () {
        $(document.body).on("DOMNodeInserted", ".nd-audio", function () {
            if (!this.only) {
                this.only = true;
                const { bpAudio, fileList, fileMetaList } = this.__vue__;
                obj.audio_page.fileList = (document.querySelector(".nd-new-main-list")?.__vue__?.fileList || fileMetaList).filter(function(item, index) {
                    return item.category === 2 || item.category === 6 && !item.isdir && ["flac", "ape"].includes(item.server_filename.split(".").pop().toLowerCase());
                });
                obj.audio_page.fileIndex = obj.audio_page.fileList.findIndex(function (item, index) {
                    return item.fs_id == fileList[0].fs_id;
                });
                if (this.classList.contains("normal")) {
                    bpAudio.destroy();
                    this.parentNode.removeChild(this);
                    obj.aplayerStart();
                }
            }
        });
    };

    obj.insertPrettyPlayer = function () {
        var element = document.querySelector(".nd-new-main-list");
        if (element) {
            Object.defineProperty(element, "__vue__", {
                set(__vue__) {
                    if (__vue__ && Array.isArray(__vue__.fileList)) {
                        var playbtn = $(".wp-s-header__center .play-btn");
                        (obj.audio_page.fileList = __vue__.fileList.filter(function(item, index) {
                            return item.category === 2 || item.category === 6 && !item.isdir && ["flac", "ape"].includes(item.real_category.toLowerCase());
                        })).length ? playbtn.length || $('<div class="wp-s-agile-tool-bar__h-action is-need-left-sep is-list play-btn" style="border-top-right-radius: 16px;border-bottom-right-radius: 16px;"><button type="button" class="u-button wp-s-agile-tool-bar__h-action-button u-button--text u-button--small" title="音乐播放" style="height: 32px;"><i class="u-icon-play"></i><span>音乐播放</span></button></div>').appendTo(".wp-s-header__center").on("click", function () {
                            obj.aplayerStart();
                        }) : playbtn.length && playbtn.remove();
                        if (__vue__.selectLength && obj.audio_page.fileList.length) {
                            var audiofile = __vue__.selectedList.find(function (item) {
                                return item.category === 2 || item.category === 6 && !item.isdir && ["flac", "ape"].includes(item.real_category.toLowerCase());
                            });
                            audiofile && (obj.audio_page.fileIndex = obj.audio_page.fileList.findIndex(function(item, index) {
                                return item.fs_id == audiofile.fs_id;
                            }));
                        }
                    }
                }
            });
        }
    };

    obj.aplayerStart = function () {
        var aplayerNode, audio = obj.audio_page.fileList;
        audio.forEach(function (item) {
            Object.assign(item, {
                name: item.server_filename,
                url: "/rest/2.0/xpan/file?method=streaming&path=" + encodeURIComponent(item.path) + "&type=M3U8_HLS_MP3_128",
                cover: item.categoryImageGrid || item.categoryImage,
                theme: obj.getRandomColor(),
                type: "customHls"
            });
        });
        if (audio.length) {
            aplayerNode = document.getElementById("aplayer");
            if (aplayerNode) {
                if (window.player) {
                    window.player.destroy();
                    window.player = null;
                }
            }
            else {
                aplayerNode = document.createElement("div");
                aplayerNode.setAttribute("id", "aplayer");
                aplayerNode.setAttribute("style", "background-color: #fafdff;position: fixed;z-index: 9999;width: 440px;bottom: 0;left: 80px;box-shadow: 0 0 10px #ccc;border-top-left-radius: 4px;border-top-right-radius: 4px;border: 1px solid #dedede;");
                document.body.appendChild(aplayerNode);
            }
        }
        else {
            console.error("未找到音频文件", audio);
            return ;
        }
        try{
            const player = window.player = new window.APlayer({
                container: aplayerNode,
                audio: audio,
                customAudioType: {
                    customHls: function (audioElement, audio, player) {
                        const Hls = window.Hls;
                        if (Hls.isSupported()) {
                            const hls = player.hls = new Hls();
                            hls.loadSource(audio.url);
                            hls.attachMedia(audioElement);
                            hls.on(Hls.Events.ERROR, function (event, data) {
                                if (data.fatal) {
                                    switch(data.type) {
                                        case Hls.ErrorTypes.NETWORK_ERROR:
                                            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                                                var errno = JSON.parse(data.networkDetails.response).errno;
                                                if (errno == 31341) {
                                                    hls.loadSource(hls.url);
                                                }
                                                else {
                                                    const { list } = player;
                                                    list.remove(list.index);
                                                }
                                            }
                                            else if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                                hls.loadSource(hls.url);
                                            }
                                            else {
                                                hls.startLoad();
                                            }
                                            break;
                                        case Hls.ErrorTypes.MEDIA_ERROR:
                                            hls.recoverMediaError();
                                            break;
                                        default:
                                            hls.destroy();
                                            break;
                                    }
                                }
                            });
                        }
                        else if (audioElement.canPlayType("application/x-mpegURL") || audioElement.canPlayType("application/vnd.apple.mpegURL")) {
                            audioElement.src = audio.url;
                        }
                        else {
                            player.notice("Error: HLS is not supported.");
                        }
                    }
                },
                autoplay: true,
                lrcType: 1,
                mutex: true
            });
            const imgs = [
                "https://img.soogif.com/qtqfUYC4Nm2lFSqDCxbs3pE40C1JhgBP.gif",
                "https://img.soogif.com/oyTwiGxYKBRDyAGQGA2T6zyGHkqxpVVe.gif",
                "https://c-ssl.duitang.com/uploads/item/201806/30/20180630210743_igwje.gif",
                "https://hbimg.b0.upaiyun.com/18cdc3f95d89d58e10df150663630589c44e3a4da1f42-88Y91f_fw658",
                "https://attachment.mcbbs.net/data/myattachment/forum/202009/12/222259myynn4oznyolposu.gif",
                "https://5b0988e595225.cdn.sohucs.com/images/20200309/1bac24692d4c43c5821ecba841f0e471.gif",
            ];
            player.on("listswitch", function ({index}) {
                player.hls && player.hls.destroy();
                player.audio.oncanplay = function () {
                    obj.querySongInfo(player, index);
                };
                player.template.list.style.cssText += "background: url(" + imgs[Math.floor(Math.random() * imgs.length)] + ") center center / contain no-repeat;";
            });
            player.on("destroy", function () {
                player.hls && player.hls.destroy();
            });
            const { list, template: { time, body } } = player;
            const fileIndex = obj.audio_page.fileIndex;
            if (fileIndex > -1 && list.audios.length > 1 && list.index !== fileIndex) {
                list.switch(fileIndex);
            }
            else {
                player.audio.oncanplay = function () {
                    obj.querySongInfo(player);
                };
                player.template.list.style.cssText += "background: url(" + imgs[Math.floor(Math.random() * imgs.length)] + ") center center / contain no-repeat;";
            }
            $(time).children().css("display", "inline-block");
            $(body).prepend('<button class="u-dialog__headerbtn" title="关闭播放器" style="top: 0;right: 7px;"><i class="u-dialog__close u-icon u-icon-close"></i></button><a href="https://afdian.net/a/vpannice" target="_blank" title="爱我你就点点我" style="position: absolute;right: 8px;font-size: 12px;top: 22px;"><img src="https://static.afdiancdn.com/favicon.ico" style="width: 14px;"></a>').children(".u-dialog__headerbtn").one("click", function () {
                player.destroy();
            });
            $('<a href="javascript:;" title="菜单" style="position: absolute;right: 26px;font-size: 12px;top: 0;"><img src="https://nd-static.bdstatic.com/m-static/v20-main/home/img/icon-util-active.d799bb4e.png" style="width: 22px;"></a>').prependTo(body).on("mouseenter mouseleave", function (event) {
                var $menu = $(body).find(".u-popover");
                switch(event.type) {
                    case "mouseenter":
                    case "mouseover":
                        $menu.show(500);
                        break;
                    case "mouseleave":
                    case "mouseout":
                        obj.audio_page.menuHideTimer = setTimeout(function () {
                            $menu.hide(500);
                        }, 1e3);
                        break;
                    default:
                }
            });
            $('<div class="u-popover u-popper wp-s-header-user__moreVertical-popover" style="top: 22px;right: 8px;width: 160px;display: none;"> <div class="moreVerticalContent" style="width: 160px;"><div class="moreVerticalContentLine"> <a href="javascript:;">删除当前音乐(列表)</a></div><div class="moreVerticalContentLine"> <a href="javascript:;">删除当前音乐(网盘)</a></div> </div></div>').prependTo(body).on("mouseenter mouseleave", function (event) {
                var $this = $(this);
                switch(event.type) {
                    case "mouseenter":
                    case "mouseover":
                        clearTimeout(obj.audio_page.menuHideTimer);
                        break;
                    case "mouseleave":
                    case "mouseout":
                        $this.hide(500);
                        break;
                    default:
                }
            }).find(".moreVerticalContentLine").on("mouseenter mouseleave click", function (event) {
                var $this = $(this);
                switch(event.type) {
                    case "mouseenter":
                    case "mouseover":
                        $this.addClass("hoverBg");
                        break;
                    case "mouseleave":
                    case "mouseout":
                        $this.removeClass("hoverBg");
                        break;
                    case "click":
                        var { list } = player;
                        var { path, server_filename } = list.audios[list.index];
                        var index = $this.index();
                        switch(index) {
                            case 0:
                                list.remove(list.index);
                                break;
                            case 1:
                                obj.deleteFile(path).then(function (result) {
                                    if (result) {
                                        unsafeWindow.globalVue.$svipMessage({
                                            type: "success",
                                            message: server_filename + " 已从网盘删除，请自行刷新页面查看",
                                            duration: 5e3
                                        });
                                    }
                                });
                                list.remove(list.index);
                                break;
                            default:
                        }
                        break;
                    default:
                }
            });
        } catch (error) {
            console.error("创建播放器错误", error);
        }
    };

    obj.querySongInfo = function (player, index) {
        const { list, lrc, template: { pic, author } } = player;
        index || index === 0 || (index = list.index);
        if (lrc.parsed[index] && lrc.parsed[index].length > 1) return;
        const { server_filename, md5, size } = list.audios[index] || {};
        obj.songinfoKugou(server_filename, md5, size).then(function (result) { // 酷狗好棒棒，听歌来帮忙 https://www.kugou.com/
            const { candidates, info, author_name, img } = result;
            const candidate = Array.isArray(candidates) ? candidates.find(function (item) {
                return item.lyrics;
            }) : Array.isArray(info) ? info.find(function (item) {
                return item.lyrics;
            }) : "";
            if (candidate && candidate.lyrics) {
                lrc.parsed[index] = lrc.current = lrc.parse(candidate.lyrics);
                lrc.container.innerHTML = lrc.parsed[index].map((item) => `<p>${item[1]}</p>`).join("\n");
                lrc.container.getElementsByTagName("p").length && lrc.container.getElementsByTagName("p")[0].classList.add("aplayer-lrc-current");
            }
            obj.getdataKugou(candidate.hash || md5).then(function (data) {
                const { author_name, img } = data;
                if (author_name) {
                    author.innerText = "- " + (list.audios[index].artist = author_name);
                }
                if (img) {
                    pic.style.cssText += "background-image: url(" + (list.audios[index].cover = img) + ")";
                }
            }).catch(function () { });
        }).catch(function (error) { });
    };

    obj.songinfoKugou = function (name, hash, size) {
        return obj.songinfohashKugou(name, hash, size).then(function (result) {
            return result;
        }, function () {
            return obj.songinfonameKugou(name, hash, size);
        });
    };

    obj.songinfohashKugou = function (name, hash, size) {
        return obj.searchhashKugou(name, hash, size).then(function (result) {
            var promises = [];
            result.candidates.slice(0, 3).forEach(function (item, index) {
                promises.push(obj.downloadhashKugou(item.id, item.accesskey));
            });
            return Promise.allSettled(promises).then(function (results) {
                results.forEach(function (item, index) {
                    if (item.status == "fulfilled") {
                        var words = window.CryptoJS.enc.Base64.parse(item.value.content);
                        result.candidates[index].lyrics = window.CryptoJS.enc.Utf8.stringify(words);
                    }
                });
                return result;
            });
        });
    };

    obj.searchhashKugou = function (name, hash, size) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=&duration=&hash=" + hash,
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    if (result && result.status == 200 && result.proposal !== "0") {
                        resolve(result);
                    }
                    else {
                        reject(result);
                    }
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    };

    obj.downloadhashKugou = function (id, accesskey) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "https://lyrics.kugou.com/download?ver=1&client=pc&id=" + id + "&accesskey=" + accesskey + "&fmt=lrc&charset=utf8",
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    resolve(result);
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    };

    obj.songinfonameKugou = function (name, hash, size) {
        return obj.searchnameKugou(name, hash, size).then(function (result) {
            var promises = [];
            result.info.slice(0, 3).forEach(function (item, index) {
                promises.push(obj.krcKugou(item.hash));
            });
            return Promise.allSettled(promises).then(function (results) {
                results.forEach(function (item, index) {
                    if (item.status == "fulfilled") {
                        result.info[index].lyrics = item.value;
                    }
                });
                return result;
            });
        });
    };

    obj.searchnameKugou = function (name, hash, size) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "https://mobilecdn.kugou.com/api/v3/search/song?pagesize=20&keyword=" + name,
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    if (result && result.status == 1 && result.data.total) {
                        resolve(result.data);
                    }
                    else {
                        reject(result);
                    }
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    };

    obj.krcKugou = function (hash) {
        return obj.surlRequest("https://m.kugou.com/app/i/krc.php?cmd=100&timelength=999999&hash=" + hash);
    };

    obj.getdataKugou = function (hash) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "https://www.kugou.com/yy/index.php?r=play/getdata&hash=" + hash,
                headers: {
                    origin: "https://www.kugou.com",
                    referer: "https://www.kugou.com/"
                },
                success: function (result) {
                    if (result && result.status == 1) {
                        resolve(result.data);
                    }
                    else {
                        reject(result);
                    }
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    };

    obj.surlRequest = function (url) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url : url,
                dataType: "blob",
                success: function(blob) {
                    var reader = new FileReader();
                    reader.readAsText(blob, "UTF-8");
                    reader.onload = function(e) {
                        resolve(reader.result);
                    };
                    reader.onerror = function(e) {
                        reject(e);
                    };
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    };

    obj.ajax = function (option) {
        var details = {
            method: option.type || "get",
            url: option.url,
            responseType: option.dataType || "json",
            onload: function (result) {
                var response = result.response || result.responseText;
                if (parseInt(result.status / 100) == 2) {
                    option.success && option.success(response);
                }
                else {
                    option.error && option.error(response);
                }
            },
            onerror: function (result) {
                option.error && option.error(result.error);
            }
        };
        if (option.data) {
            if (option.data instanceof Object) {
                details.data = Object.keys(option.data).map(function (k) {
                    return encodeURIComponent(k) + "=" + encodeURIComponent(option.data[k]).replace("%20", "+");
                }).join("&");
            }
            else {
                details.data = option.data;
            }
            if (option.type.toUpperCase() == "GET") {
                details.url = option.url + (option.url.includes("?") ? "&" : "?") + details.data;
                delete details.data;
            }
        }
        if (option.headers) {
            details.headers = option.headers;
        }
        GM_xmlhttpRequest(details);
    };

    obj.getRandomColor = function () {
        return "#" + ("00000" + (Math.random() * 0x1000000 << 0).toString(16)).substr(-6);
    };

    obj.deleteFile = function (filelist) {
        typeof filelist === "string" && (filelist = [filelist]);
        Array.isArray(filelist) && (filelist = JSON.stringify(filelist));
        return unsafeWindow.globalVue.$http.request.post("/api/filemanager?async=2&onnest=fail&opera=delete&newVerify=1&clienttype=0&app_id=250528&web=1".concat("&bdstoken=", unsafeWindow.locals.userInfo.bdstoken), {
            filelist: filelist
        }).then(function (t) {
            return t && 0 == t.errno ? t : "";
        });
    };

    obj.run = function () {
        GM_addStyle(GM_getResourceText("aplayerCSS"));
        obj.replaceNativePlayer();
        obj.insertPrettyPlayer();
        unsafeWindow.globalVue.$router.afterHooks.push(function () {
            setTimeout(obj.insertPrettyPlayer, 500);
        });
    }();

    console.log("=== 百度 网 网 网盘 好 好 好棒棒！===");

    // Your code here...
})();
