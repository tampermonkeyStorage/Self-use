// ==UserScript==
// @name         百度网盘音频播放器
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.3.0
// @description  无视文件大小，无视文件格式，告别卡顿即点即播，自动加载歌词，画中画歌词
// @author       You
// @match        https://pan.baidu.com/disk/main*
// @connect      kugou.com
// @icon         https://nd-static.bdstatic.com/business-static/pan-center/images/vipIcon/user-level2-middle_4fd9480.png
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://scriptcat.org/lib/1359/^1.1.0/PipLyric.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.18/hls.min.js
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
        const targetNode = document.querySelector(".nd-main-layout");
        if (!targetNode) {
            unsafeWindow.globalVue.$Message({
                type: "error",
                message: " 目标节点未加载 "
            });
            return;
        }
        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.addedNodes.length < 1) continue;

                const addedNode = mutation.addedNodes[0];
                if (addedNode.className?.includes("nd-audio")) {
                    const { bpAudio, fileList, fileMetaList } = addedNode.__vue__;
                    obj.audio_page.fileList = (document.querySelector(".nd-new-main-list")?.__vue__?.fileList || fileMetaList || []).filter(function(item, index) {
                        return item.category === 2 || item.category === 6 && !item.isdir && ["flac", "ape"].includes(item.server_filename.split(".").pop().toLowerCase());
                    });
                    obj.audio_page.fileIndex = obj.audio_page.fileList.findIndex(function (item, index) {
                        return item.fs_id == fileList[0].fs_id;
                    });
                    if (addedNode.classList.contains("normal")) {
                        bpAudio.destroy();
                        addedNode.parentNode.removeChild(addedNode);

                        if (window.player) {
                            const { list, list: { index } } = window.player;
                            if (index !== obj.audio_page.fileIndex) {
                                list.switch(obj.audio_page.fileIndex);
                            }
                        }
                        else {
                            obj.initAudioPlayer();
                        }
                    }
                }
            }
        });
        observer.observe(targetNode, { childList: true });
    };

    obj.insertPrettyPlayer = function () {
        const targetNode = document.querySelector(".nd-new-main-list");
        if (!targetNode) {
            unsafeWindow.globalVue.$Message({
                type: "error",
                message: " 目标节点未加载 "
            });
            return;
        }
        Object.defineProperty(targetNode, "__vue__", {
            set(__vue__) {
                if (__vue__ && Array.isArray(__vue__.fileList)) {
                    var prevClass = document.querySelector(".wp-s-header__right");
                    if (!prevClass) {
                        return obj.showTipError("插入音频播放按钮失败，父节点未找到");
                    }

                    obj.audio_page.fileList = __vue__.fileList.filter(function(item, index) {
                        return item.category === 2 || item.category === 6 && !item.isdir && ["flac", "ape"].includes(item.server_filename.split(".").pop().toLowerCase());
                    });

                    if (obj.audio_page.fileList.length) {
                        $(prevClass).find(".audio-play-btn").length || $('<button class="u-button u-button--primary audio-play-btn" style="font-weight: 700;padding: 8px 16px;height: 32px;font-size: 14px;border-radius: 16px;order: 1;margin-left: 12px;background-image: linear-gradient(45deg,#5e00ff,#ff0010);"><i class="u-icon-play"></i><span>音乐播放</span></button>').appendTo(prevClass).on("click", function () {
                            obj.initAudioPlayer();
                        });
                    }
                    else {
                        $(prevClass).find(".audio-play-btn").remove();
                    }
                }
            }
        });
    };

    obj.initAudioPlayer = function () {
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
        if (audio.length < 1) {
            console.error("未找到音频文件", audio);
            return ;
        }

        aplayerNode = document.getElementById("aplayer");
        if (aplayerNode) {
            if (window.player) {
                window.player.destroy();
            }
        }
        else {
            aplayerNode = document.createElement("div");
            aplayerNode.setAttribute("id", "aplayer");
            aplayerNode.setAttribute("style", "background-color: #fafdff;position: fixed;z-index: 9999;width: 440px;bottom: 0;left: 80px;box-shadow: 0 0 10px #ccc;border-top-left-radius: 4px;border-top-right-radius: 4px;border: 1px solid #dedede;");
            document.body.appendChild(aplayerNode);
        }

        try{
            const player = window.player = new window.APlayer({
                container: aplayerNode,
                audio: audio,
                customAudioType: {
                    customHls: function (audioElement, audio, player) {
                        const Hls = window.Hls;
                        if (Hls.isSupported()) {
                            if (player.hls) player.hls.destroy();
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
            obj.onEvents(player);

            const { list, template: { time, body } } = player;
            const fileIndex = obj.audio_page.fileIndex;
            if (fileIndex > -1 && list.audios.length > 1 && list.index !== fileIndex) {
                list.switch(fileIndex);
            }

            $(time).children().css("display", "inline-block");
            $(body).prepend('<button class="u-dialog__headerbtn" title="关闭播放器" style="top: 0;right: 7px;"><i class="u-dialog__close u-icon u-icon-close"></i></button><a href="https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png" target="_blank" title="爱我你就点点我" style="position: absolute;right: 52px;font-size: 12px;top: 1px;">👍</a>').children(".u-dialog__headerbtn").one("click", function () {
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

    obj.onEvents = function (player) {
        obj.initPipLyric(player);
        obj.loadLyric(player);
        obj.backgroundImage(player);

        player.on("listswitch", ({ index }) => {
            if (this.index != index) {
                this.index = index;
                obj.loadLyric(player, index);
                obj.backgroundImage(player);
            }
        });

        player.on("destroy", () => {
            if (player.hls) player.hls.destroy();
            if (player.pipLyric) player.pipLyric.leave();
            window.player = null;
        });
    };

    obj.loadLyric = function (player, index) {
        const { list, template: { pic, author }, lrc } = player;
        var file = list.audios[index == null ? list.index : index] || {};
        (file.name && file.hash) || Object.assign(file, {
            name: file.server_filename,
            hash: file.md5,
            size: file.size
        });
        obj.querySongInfo(file).then((result) => {
            const { author_name, imgUrl, lyric } = result;
            author_name && (author.innerText = "- " + author_name);
            imgUrl && (pic.style.cssText += "background-image: url(" + imgUrl + ")");
            if (lyric) {
                lrc.parsed[list.index] = lrc.current = lrc.parse(lyric);
                lrc.container.innerHTML = lrc.parsed[list.index].map((item) => `<p>${item[1]}</p>`).join("\n");
                lrc.container.getElementsByTagName("p").length && lrc.container.getElementsByTagName("p")[0].classList.add("aplayer-lrc-current");
            }
            if (obj.initPipLyric(player)) {
                const pipinfo = {
                    id: result.id || result.audio_id || 1234567890,
                    name: result.audio_name || result.songname,
                    artists: (Array.isArray(result.authors) ? result.authors : []).map(function(n) {
                        return n && {
                            name: n.author_name
                        };
                    }).filter(Boolean),
                    album: {
                        picUrl: result.imgUrl,
                    },
                    lrc: {
                        lyric: result.lyric || result.lyrics
                    }
                };
                player.pipLyric.setData(pipinfo);
            }
        }).catch((error) => {
            if (obj.initPipLyric(player)) {
                player.pipLyric.setData({
                    id: 1234567890,
                    name: file.name.split(".").slice(0, -1).join("."),
                    lrc: {
                        lyric: "[00:00.00]是从容处 自有歌词\r\n[00:01.00]你逆光而来，胜过世间所有的美好。\r\n[10:00.00]ScriptCat @脚本体验师001"
                    },
                });
            }
        });
    };

    obj.initPipLyric = function (player) {
        if (player.pipLyric) return true;
        const PipLyric = window.PipLyric || unsafeWindow.PipLyric
        if (PipLyric && PipLyric.support) {
            player.template.time.insertAdjacentHTML("beforeend", '<button type="button" class="aplayer-icon aplayer-icon-pip" style="display: inline-block;"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M2.667 2.667h18.667v18.667h-18.667v-18.667M29.333 10.667v18.667h-18.667v-5.333h2.667v2.667h13.333v-13.333h-2.667v-2.667h5.333z"></path></svg></button>');
            player.template.pipButton = player.template.time.lastElementChild || player.template.time.lastChild;
            player.pipLyric = new PipLyric({
                audio: player.audio,
                pip: player.template.pipButton,
                prev: player.template.skipBackButton,
                next: player.template.skipForwardButton,
            });
            return true;
        }
        return false;
    };

    obj.backgroundImage = function (player) {
        const images = [
            "https://img.soogif.com/qtqfUYC4Nm2lFSqDCxbs3pE40C1JhgBP.gif",
            "https://img.soogif.com/oyTwiGxYKBRDyAGQGA2T6zyGHkqxpVVe.gif",
            "https://c-ssl.duitang.com/uploads/item/201806/30/20180630210743_igwje.gif",
            "https://hbimg.b0.upaiyun.com/18cdc3f95d89d58e10df150663630589c44e3a4da1f42-88Y91f_fw658",
            "https://attachment.mcbbs.net/data/myattachment/forum/202009/12/222259myynn4oznyolposu.gif",
            "https://5b0988e595225.cdn.sohucs.com/images/20200309/1bac24692d4c43c5821ecba841f0e471.gif",
        ], image = images[Math.floor(Math.random() * images.length)];

        player.template.list.style.cssText += "background: url(" + image + ") center center / contain no-repeat;";
    };

    obj.querySongInfo = function (file) {
        const { songInfo, name, hash, size } = file;
        if (songInfo) {
            return Promise.resolve(songInfo);
        }
        return obj.songinfoKugou(name, hash, size).then(function (result) {
            file.songInfo = result;
            return result;
        });
    };

    obj.songinfoKugou = function (name, hash, size) {
        return obj.songinfoKugouByHash(hash).catch(function (error) {
            return obj.songinfoKugouByName(name, hash, size);
        });
    };

    obj.songinfoKugouByName = function (name, hash, size) {
        return obj.searchKugouByName(name, hash, size).then(function (result) {
            var info = result.info;
            let infoFilter = info.filter(function (item, index) {
                return item.hash == hash || item["320filesize"] == size || item.filesize == size || item.sqfilesize == size;
            });
            if (infoFilter.length) {
                info = infoFilter;
            }
            else {
                info.forEach(function (item, index) {
                    item.nameSimilar = obj.textSimilarity(name.toLowerCase(), (item.audio_name || item.filename || item.songname).toLowerCase());
                });
                info = info.sort(function (a, b) {
                    return +b.nameSimilar - +a.nameSimilar;
                }).slice(0, 3);
            }

            var promises = info.map(function (item, index) {
                return obj.songinfoKugouByHash(item.hash);
            });
            return Promise.allSettled(promises).then(function (results) {
                results.forEach(function (item, index) {
                    Object.assign(info[index], item.value || item.reason);
                });
                return info.find(function (item, index) {
                    return (item.lyric || item.lyrics) && item;
                }) || info.find(function (item, index) {
                    return info.imgUrl && item;
                }) || info[0];
            });
        });
    };

    obj.searchKugouByName = function (name, hash, size) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "http://mobilecdn.kugou.com/api/v3/search/song?pagesize=20&keyword=" + name,
                headers: {
                    origin: "http://www.kugou.com",
                    referer: "http://www.kugou.com/"
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

    obj.songinfoKugouByHash = function (hash) {
        if (!hash) return Promise.reject();
        return obj.getSongInfoKugou(hash).then(function (data) {
            return obj.krcKugou(hash).then(function (lyric) {
                return Object.assign(data, { lyric });
            }, function (error) {
                return data;
            });
        });
    };

    obj.getSongInfoKugou = function (hash) {
        return new Promise(function (resolve, reject) {
            obj.ajax({
                url: "https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=" + hash,
                headers: {
                    origin: "https://m.kugou.com",
                    referer: "https://m.kugou.com/"
                },
                success: function (result) {
                    if (result && result.hash) {
                        result.imgUrl = result.imgUrl?.replace("{size}", 720)?.replace(/^https?:/, "");
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

    obj.krcKugou = function (hash) {
        return obj.surlRequest("https://m.kugou.com/app/i/krc.php?cmd=100&timelength=999999&hash=" + hash);
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
            if ((option.type || "get").toUpperCase() == "GET") {
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

    obj.textSimilarity = function (textA, textB) {
        if (!textA || !textB) return 0;
        var segment = function(text) {
            return ("" + text).split("");
        }
        var segmentWordsA = segment(textA);
        var segmentWordsB = segment(textB);
        var distributionWordsArray = {};

        segmentWordsA.forEach(element => {
            if (!distributionWordsArray.hasOwnProperty(element)) {
                distributionWordsArray[element] = [1, 0];
            } else {
                distributionWordsArray[element][0] += 1;
            }
        });
        segmentWordsB.forEach(element => {
            if (!distributionWordsArray.hasOwnProperty(element)) {
                distributionWordsArray[element] = [0, 1];
            } else {
                distributionWordsArray[element][1] += 1;
            }
        });

        let [sum, sumWordsA, sumWordsB] = [0, 0, 0];
        for (const element in distributionWordsArray) {
            const wordsA = distributionWordsArray[element][0];
            const wordsB = distributionWordsArray[element][1];
            sum += (wordsA * wordsB);
            sumWordsA += Math.pow(wordsA, 2);
            sumWordsB += Math.pow(wordsB, 2);
        }
        return sum / Math.sqrt(sumWordsA * sumWordsB);
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

    /**
    歌词来源：酷狗音乐 https://www.kugou.com/
    画中画：网易云音乐 https://music.163.com/
    */
    // Your code here...
})();
