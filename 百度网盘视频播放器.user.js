// ==UserScript==
// @name         百度网盘视频播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      0.9.0
// @description  功能更全，播放更流畅，界面更好看！特色功能主要有: 倍速任意调整，分辨率任意切换，自动加载播放列表，自动加载字幕可加载本地字幕可精细设置字幕样式，声音音质增强音量增大，画面比例调整，色彩饱和度、亮度、对比度调整，......，对常用设置自动记忆，支持移动端网页播放（网盘主页），想你所想，极致播放体验 ...
// @author       You
// @match        http*://yun.baidu.com/s/*
// @match        https://pan.baidu.com/s/*
// @match        https://pan.baidu.com/wap/home*
// @match        https://pan.baidu.com/play/video*
// @match        https://pan.baidu.com/pfile/video*
// @match        https://pan.baidu.com/pfile/mboxvideo*
// @match        https://pan.baidu.com/mbox/streampage*
// @require      https://scriptcat.org/lib/950/^1.0.0/Joysound.js
// @require      https://scriptcat.org/lib/1348/^1.1.0/artPlugins.js
// @require      https://unpkg.com/hls.js@1.5.20/dist/hls.min.js
// @require      https://unpkg.com/artplayer@5.2.2/dist/artplayer.js
// @require      https://unpkg.com/leancloud-storage@4.15.2/dist/av-min.js
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
        video_page: {
            flag: "",
            file: {},
            filelist: [],
            quality: [],
            adToken: "",
        }
    };

    obj.currentList = function () {
        try {
            var currentList = unsafeWindow.require('system-core:context/context.js').instanceForSystem.list.getCurrentList();
            if (currentList.length) {
                sessionStorage.setItem("currentList", JSON.stringify(currentList));
            }
            else {
                setTimeout(obj.currentList, 500);
            }
        } catch (e) { }

        window.onhashchange = function (e) {
            setTimeout(obj.currentList, 500);
        };
        document.querySelector(".fufHyA") && [ ...document.querySelectorAll(".fufHyA") ].forEach(function (element) {
            element.onclick = function () {
                setTimeout(obj.currentList, 500);
            };
        });
    };

    obj.forcePreview = function () {
        unsafeWindow.jQuery(document).on("click", "#shareqr dd", function () {
            try {
                var selectedFile = unsafeWindow.require('system-core:context/context.js').instanceForSystem.list.getSelected()
                , file = selectedFile[0];
                if (file.category == 1) {
                    var ext = file.server_filename.split(".").pop().toLowerCase();
                    if (["ts", '3gp2','3g2','3gpp','amv','divx','dpg','f4v','m2t','m2ts','m2v','mpe','mpeg','mts','vob','webm','wxp','wxv','vob'].includes(ext)) {
                        window.open("https://pan.baidu.com" + location.pathname + "?fid=" + file.fs_id, "_blank");
                    }
                }
            } catch (error) { }
        });
    };

    obj.sharevideo = function () {
        if (unsafeWindow.require) {
            unsafeWindow.locals.get("file_list", "share_uk", "shareid", "sign", "timestamp", function (file_list, share_uk, shareid, sign, timestamp) {
                if (file_list.length == 1 && file_list[0].category == 1) {
                    obj.startObj().then(function (obj) {
                        obj.video_page.flag = "sharevideo";
                        const { fs_id } = obj.video_page.file = file_list[0]
                        , vip = obj.getVip();
                        obj.video_page.getUrl = function (type) {
                            return "/share/streaming?channel=chunlei&uk=" + share_uk + "&fid=" + fs_id + "&sign=" + sign + "&timestamp=" + timestamp + "&shareid=" + shareid + "&type=" + type + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken;
                        }
                        obj.getAdToken().then(function () {
                            obj.addQuality();
                            obj.addFilelist();
                            obj.initVideoPlayer();
                        });
                    });
                }
                else {
                    obj.currentList();
                    obj.forcePreview();
                }
            });
        }
        else {
        }
    };

    obj.playvideo = function () {
        unsafeWindow.jQuery(document).ajaxComplete(function (event, xhr, options) {
            var response, requestUrl = options.url;
            if (requestUrl.indexOf("/api/categorylist") >= 0) {
                response = xhr.responseJSON;
                obj.video_page.filelist = response.info || [];
            }
            else if (requestUrl.indexOf("/api/filemetas") >= 0) {
                response = xhr.responseJSON;
                if (response && response.info) {
                    obj.startObj().then(function (obj) {
                        obj.video_page.flag = "playvideo";
                        const { path } = obj.video_page.file = response.info[0]
                        , vip = obj.getVip();
                        obj.video_page.getUrl = function (type) {
                            if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                            return "/api/streaming?path=" + encodeURIComponent(path) + "&app_id=250528&clienttype=0&type=" + type + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken;
                        }
                        obj.getAdToken().then(function () {
                            obj.addQuality();
                            obj.addFilelist();
                            obj.initVideoPlayer();
                        });
                    });
                }
            }
        });
    };

    obj.video = function () {
        const { $pinia, $router } = document.querySelector("#app")?.__vue_app__?.config?.globalProperties || {};
        if ($pinia && $router && Object.keys($pinia.state._rawValue.videoinfo?.videoinfo || {}).length) {
            obj.startObj().then(function (obj) {
                obj.video_page.flag = "video";
                const { recommendListInfo, videoinfo: { videoinfo } } = $pinia.state._rawValue;
                const { selectionVideoList } = recommendListInfo;
                if (Array.isArray(selectionVideoList) && selectionVideoList.length) {
                    obj.video_page.filelist = selectionVideoList;
                }
                else {
                    Object.defineProperty(recommendListInfo, "selectionVideoList", {
                        enumerable: true,
                        set(selectionVideoList) {
                            obj.video_page.filelist = selectionVideoList;
                        }
                    });
                }
                const { path } = obj.video_page.file = videoinfo
                , vip = obj.getVip();
                obj.video_page.getUrl = function (type) {
                    if (type.includes(1080)) vip > 1 || (type = type.replace(1080, 720));
                    return "/api/streaming?path=" + encodeURIComponent(path) + "&app_id=250528&clienttype=0&type=" + type + "&vip=" + vip + "&jsToken=" + unsafeWindow.jsToken
                }
                obj.getAdToken().then(function () {
                    obj.addQuality();
                    obj.addFilelist();
                    obj.initVideoPlayer();
                });
            });
            $router.isReady().then(function () {
                $router.afterEach(function (to, from) {
                    from.fullPath === "/" || from.fullPath === to.fullPath || location.reload();
                });
            });
        }
        else {
            obj.delay().then(obj.video);
        }
    };

    obj.mboxvideo = function () {
        const { $pinia, $router } = document.querySelector("#app")?.__vue_app__?.config?.globalProperties || {};
        if ($pinia && $router && Object.keys($pinia.state._rawValue.videoinfo?.videoinfo || {}).length) {
            obj.startObj().then(function (obj) {
                obj.video_page.flag = "mboxvideo";
                const { to, from_uk, msg_id, fs_id, type, trans, ltime, adToken } = obj.video_page.file = $pinia.state._rawValue.videoinfo.videoinfo;
                obj.video_page.getUrl = function (stream_type) {
                    return "/mbox/msg/streaming?to=" + to + "&from_uk=" + from_uk + "&msg_id=" + msg_id + "&fs_id=" + fs_id + "&type=" + type + "&stream_type=" + stream_type + "&trans=" + (trans || "") + "&ltime=" + ltime;
                }
                obj.video_page.adToken = adToken || "";
                obj.getAdToken().then(function () {
                    obj.addQuality();
                    obj.addFilelist();
                    obj.initVideoPlayer();
                });
            });

            $router.isReady().then(function () {
                $router.afterEach(function (to, from) {
                    from.fullPath === "/" || from.fullPath === to.fullPath || location.reload();
                });
            });
        }
        else {
            obj.delay().then(obj.mboxvideo);
        }
    };

    obj.videoView = function () {
        const { videoFile } = document.querySelector(".preview-video")?.__vue__ || {};
        if (videoFile) {
            obj.startObj().then(function (obj) {
                obj.video_page.flag = "videoView";
                const { path } = obj.video_page.file = videoFile;
                obj.video_page.getUrl = function (type) {
                    if (type.includes(1080)) +unsafeWindow.locals?.isVip > 1 || (type = type.replace(1080, 720));
                    return "/rest/2.0/xpan/file?method=streaming&path=" + encodeURIComponent(path) + "&type=" + type;
                }
                obj.getAdToken().then(function () {
                    obj.addQuality();
                    obj.addFilelist();
                    obj.initVideoPlayer();
                });
            });
        }
        else {
            obj.delay().then(obj.videoView);
        }
    };

    obj.initVideoPlayer = function () {
        obj.replaceVideoPlayer().then(function () {
            const { file, filelist, quality, getUrl, adToken } = obj.video_page;
            const { url, type } = quality.find((item) => item.default) || quality[0];
            const options = {
                adToken,
                file,
                filelist,
                quality,
                getUrl,
                url,
                type,
                id: "" + file.fs_id,
                poster: (Object.values(file.thumbs || []).slice(-1)[0] || "").replace(/size=c\d+_u\d+/, "size=c850_u580")
            };
            obj.artPlugins().init(options).then((art) => {
                obj.showTip("视频播放器已就绪 ...", "success");
                obj.destroyPlayer();
            });
        });
    };

    obj.replaceVideoPlayer = function () {
        const { flag } = obj.video_page;
        var container, videoNode = document.querySelector("#video-wrap, .vp-video__player, #app .video-content");
        if (videoNode) {
            while (videoNode.nextSibling) {
                videoNode.parentNode.removeChild(videoNode.nextSibling);
            }

            container = document.getElementById("artplayer");
            if (!container) {
                container = document.createElement("div");
                container.setAttribute("id", "artplayer");
                if ([ "videoView" ].includes(flag)) {
                    container.setAttribute("style", "width: 100%; height: 3.75rem;");
                }
                else {
                    container.setAttribute("style", "width: 100%; height: 100%;");
                }
                obj.videoNode = videoNode.parentNode.replaceChild(container, videoNode);
                container.parentNode.style.cssText += 'z-index: auto;'
                return Promise.resolve();
            }
        }
        else {
            return obj.delay().then(function () {
                return obj.replaceVideoPlayer();
            });
        }
    };

    obj.artPlugins = function () {
        return window.artPlugins||function(t){var e={version:"1.1.0",init:t=>Promise.all([e.readyHls(),e.readyArtplayer(),e.readySupported()]).then(()=>e.initArtplayer(t)),readyHls:()=>{return window.Hls||unsafeWindow.Hls?Promise.resolve():e.loadJs("https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.18/hls.min.js")},readyArtplayer:()=>{return window.Artplayer||unsafeWindow.Artplayer?Promise.resolve():e.loadJs("https://cdnjs.cloudflare.com/ajax/libs/artplayer/5.2.1/artplayer.min.js")},readySupported:()=>Promise.resolve(GM_info).then(t=>{if(t){const{scriptMetaStr:e=""}=t;if(Math.min(e.indexOf(1348),0))return Promise.reject()}}),initArtplayer:o=>{const n=window.Artplayer||unsafeWindow.Artplayer,{isMobile:s}=n.utils;return Object.assign(n,{ASPECT_RATIO:["default","自动","4:3","16:9"],AUTO_PLAYBACK_TIMEOUT:1e4,NOTICE_TIME:5e3}),new n(o=Object.assign({container:"#artplayer",url:"",quality:[],type:"hls",autoplay:!0,autoPlayback:!0,aspectRatio:!0,contextmenu:[],customType:{hls:(t,e,o)=>{const n=window.Hls||unsafeWindow.Hls;if(n.isSupported()){o.hls&&o.hls.destroy();const s=new n({maxBufferLength:10*n.DefaultConfig.maxBufferLength,xhrSetup:(t,e)=>{const n=(e.match(/^http(?:s)?:\/\/(.*?)\//)||[])[1];if(n!==location.host){if(/backhost=/.test(e)){var s,a=(decodeURIComponent(e||"").match(/backhost=(\[.*\])/)||[])[1];if(a){try{s=JSON.parse(a)}catch(t){}if(s&&s.length){const t=(s=[].concat(s,[n])).findIndex(t=>t===o.realHost);o.realHost=s[t+1>=s.length?0:t+1]}}}o.realHost&&(e=e.replace(n,o.realHost),t.open("GET",e,!0))}}});s.loadSource(e),s.attachMedia(t),s.fragLoadError=0,s.on(n.Events.ERROR,(t,e)=>{if(e.fatal)switch(e.type){case n.ErrorTypes.NETWORK_ERROR:if(e.details===n.ErrorDetails.MANIFEST_LOAD_ERROR){31341==JSON.parse(e.networkDetails.response).errno?(o.notice.show="正在转码，重试中 ...",setTimeout(()=>{s.loadSource(s.url)},1e3)):(o.notice.show="无法播放，请稍后再试",s.destroy())}else e.details===n.ErrorDetails.MANIFEST_LOAD_TIMEOUT||e.details===n.ErrorDetails.MANIFEST_PARSING_ERROR?s.loadSource(s.url):e.details===n.ErrorDetails.FRAG_LOAD_ERROR?(s.fragLoadError+=1,s.fragLoadError<10?setTimeout(()=>{s.loadSource(s.url),s.media.currentTime=o.currentTime,s.media.play()},1e3):(s.destroy(),s.fragLoadError=0,o.notice.show="视频播放错误次数过多，请刷新重试")):s.startLoad();break;case n.ErrorTypes.MEDIA_ERROR:s.recoverMediaError();break;default:s.destroy(),o.notice.show="视频播放异常，请刷新重试"}}),o.hls=s,o.on("destroy",()=>s.destroy())}else t.canPlayType("application/vnd.apple.mpegurl")?t.src=e:o.notice.show="Unsupported playback format: m3u8"}},flip:!1,icons:{loading:'<img src="https://artplayer.org/assets/img/ploading.gif">',state:'<img width="150" heigth="150" src="https://artplayer.org/assets/img/state.svg">',indicator:'<img width="16" heigth="16" src="https://artplayer.org/assets/img/indicator.svg">'},id:"",pip:!s,poster:"",playbackRate:!0,screenshot:!0,setting:!0,subtitle:{url:"",type:"auto",style:{color:"#fe9200",fontSize:"25px"},encoding:"utf-8",escape:!1},subtitleOffset:!1,hotkey:!0,fullscreen:!0,fullscreenWeb:!s},o),o=>{const n=Object.keys(e).map(t=>e[t]).concat(t).reduce((t,e)=>t+e.toString().length,0),s=`plen-${e.version.replace(/\./g,"-")}`,a=o.storage.get(s);a?a===n?t.forEach(t=>{o.plugins.add(t())}):o.plugins.add(t.shift()):(o.storage.set(s,n),o.plugins.add(t.shift()))})},loadJs:t=>(window.instances||(window.instances={}),window.instances[t]||(window.instances[t]=new Promise((e,o)=>{const n=document.createElement("script");n.src=t,n.type="text/javascript",n.onload=e,n.onerror=o,Node.prototype.appendChild.call(document.head,n)})),window.instances[t])};return console.info(`%c artPlugins %c ${e.version} %c https://scriptcat.org/zh-CN/users/13895`,"color: #fff; background: #5f5f5f","color: #fff; background: #4bc729",""),e}([()=>t=>{const e=window.Hls||unsafeWindow.Hls,{hls:o,layers:n,notice:s,storage:a,constructor:{CONTEXTMENU:i,utils:{query:r,append:l,setStyle:c,clamp:p,debounce:u,throttle:d}}}=t;function h(){return m().then(t=>{const e=t.User.current();if(e){const{ON:o,authData:n,check:s,expire_time:i,updatedAt:r}=e.toJSON();if(3===[i&&Math.max(Date.parse(r)+864e5-Date.now(),0),JSON.stringify(n)===JSON.stringify({baidu:{uid:""+("function"==typeof unsafeWindow.locals.get?unsafeWindow.locals.get("uk"):unsafeWindow.locals.uk)}}),a.get(t._getAVPath(t.User._CURRENT_USER_KEY))===btoa(encodeURIComponent(JSON.stringify(i)))].filter(Boolean).length)return o?Math.max(s,0)?Math.max(Date.parse(r)+432e3-Date.now(),0)?e:g().then(t=>Math.max(Date.parse(t.toJSON().expire_time)-Date.now(),0)?t:(Object.assign(t.attributes,{ON:o,expire_time:i,check:s-1}),t._handleSaveResult(!0).then(()=>t))):g():e}return g()})}function g(){return m().then(t=>fetch("https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo").then(t=>t.ok?t.json():Promise.reject()).then(t=>t&&0===t.errno?t:Promise.reject()).then(e=>{const o=new t.User;return o.set("uinfo",e),o.set("gminfo",GM_info),o.set("pnum",a.get("pnum")),o.loginWithAuthData({uid:""+e.uk},"baidu").then(e=>{const{createdAt:o,updatedAt:n}=e.toJSON();o===n&&(Object.assign(e.attributes,{expire_time:new Date(Date.now()+864e5).toISOString()}),e._handleSaveResult(!0));const{expire_time:s}=e.toJSON();return a.set(t._getAVPath(t.User._CURRENT_USER_KEY),btoa(encodeURIComponent(JSON.stringify(s)))),e})}))}function m(){const e=window.AV||unsafeWindow.AV;return e?(e.applicationId||e.init({appId:"sXXf4FFOZn2nFIj7LOFsqpLa-gzGzoHsz",appKey:"16s3qYecpVJXtVahasVxxq1V",serverURL:"https://sxxf4ffo.lc-cn-n1-shared.com"}),Promise.resolve(e)):Promise.reject(t.destroy())}function f(){n.update({name:"sponsor",html:'\n                                   <div style="padding: 5px;"><div>喜欢这个脚本吗</div><div>请少量赞助以支持继续创作</div></div>\n                                   <div style="padding: 5px;min-width: 280px;display: flex;flex-wrap: nowrap;">\n                                       <button id="open-afdian" style="padding: 5px; margin: 0 5px;border: none; border-radius: 3px; background: #09aaff; color: white; cursor: pointer;flex: 1 1 0;">打开爱发电</button>\n                                       <button id="copy-order" style="padding: 5px; margin: 0 5px;border: none; border-radius: 3px; background: #09aaff; color: white; cursor: pointer;flex: 1 1 0;">复制订单号</button>\n                                       <button id="update-script" style="padding: 5px; margin: 0 5px;border: none; border-radius: 3px; background: #09aaff; color: white; cursor: pointer;flex: 1 1 0;">检查更新</button>\n                                   </div>\n                                   <div style="padding: 5px"><input type="text" id="order-input" placeholder="输入爱发电订单号，体验更多功能" style="min-width: 250px;padding: 5px; border: none; border-radius: 3px;" autocomplete="off"></div>\n                                   <div style="border-top: 1px solid #c6c6c6;display: flex;flex-wrap: nowrap;">\n                                       <button id="cancel-order" style="padding: 5px; border: none; border-radius: 3px; background: #ff5555; color: white; cursor: pointer;flex: 1 1 0;">取消</button>\n                                       <button id="submit-order" style="padding: 5px; border: none; border-radius: 3px; background: #ffad00; color: white; cursor: pointer;flex: 1 1 0;">提交</button>\n                                   </div>\n                            ',tooltip:"感谢支持，赞助后不再提示",style:{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%, -50%)",background:"rgba(0, 0, 0, 0.7)",border:"1px solid #c6c6c6",borderRadius:"8px",textAlign:"center"},click:(e,o)=>{o.isTrusted||t.destroy(),t.mask.show=!1,t.loading.show=!1},mounted:e=>{t.pause(),o.stopLoad(),setTimeout(()=>{t.mask.show=!1,t.loading.show=!1,t.controls.show=!1,t.constructor.CONTEXTMENU=!1},500);const n=r("#open-afdian",e),i=r("#copy-order",e),l=r("#update-script",e);t.proxy(n,"click",()=>{window.open("https://afdian.com/order/create?plan_id=dc4bcdfa5c0a11ed8ee452540025c377","_blank")}),t.proxy(i,"click",()=>{window.open("https://afdian.com/dashboard/order","_blank")}),t.proxy(l,"click",()=>{window.open("https://scriptcat.org/scripts/code/340/BD%E7%BD%91%E7%9B%98%E8%A7%86%E9%A2%91%E6%92%AD%E6%94%BE%E5%99%A8.user.js","_blank")});const c=r("#order-input",e),p=r("#cancel-order",e),u=r("#submit-order",e);t.proxy(p,"click",()=>{b()}),t.proxy(u,"click",()=>{if(c.value){const t=c.value.trim();if(t.match(/^202[\d]{22,25}$/)){if(t.match(/(\d)\1{7,}/g))return;!function(t){const e=a.get(t)||0;a.set(t,e+1),m().then(e=>h().then(o=>{const{authData:n,expire_time:s,shortId:i,username:r}=o.toJSON(),l=new(e.Object.extend("baidu"));l.set("ON",t),l.set("pnum",a.get(t));for(let[t,e]of Object.entries({authData:n,expire_time:s,shortId:i,username:r}))l.set(t,e);return l.save().then(n=>{Object.assign(o.attributes,{ON:t,check:3,expire_time:new Date(Date.now()+864e3).toISOString()});const{expire_time:s}=o.toJSON();return a.set(e._getAVPath(e.User._CURRENT_USER_KEY),btoa(encodeURIComponent(JSON.stringify(s)))),o._handleSaveResult(!0)})}))}(t),b()}else s.show="此订单号不合规范，请重试"}else s.show="请输入订单号"})}})}function b(){n.hasOwnProperty("sponsor")&&(n.remove("sponsor"),t.constructor.CONTEXTMENU=i,o.startLoad())}function x(){t.contextmenu.update({index:51,html:"更多功能",click:()=>{f(),t.contextmenu.show=!1}}),t.contextmenu.update({index:52,html:"鼓励一下",click:()=>{window.open("https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png","_blank"),t.contextmenu.show=!1}}),t.setting.update({html:"赞赏作者",name:"author-setting",tooltip:"",selector:[{html:"更多功能",value:0},{html:"鼓励一下",value:1}],onSelect:e=>(0===e.value?(f(),t.setting.show=!1):1===e.value&&window.open("https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png","_blank"),"")});let n=Number(a.get("pnum")||0);a.set("pnum",++n),t.on("video:ended",()=>{h().then(e=>{const{expire_time:o}=e.toJSON();Math.max(Date.parse(o)-Date.now(),0)||t.layers.update({name:"potser",html:'<img style="width: 300px" src="https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png">',tooltip:"",style:{position:"absolute",top:"50px",right:"50px"},click:(t,e)=>{window.open(e.target.src,"_blank")}})})}),o.on(e.Events.FRAG_LOADED,d((e,o)=>{h().then(e=>{t.emit("user",e.toJSON()),t.once("user",({expire_time:t})=>{Math.max(Date.parse(t)-Date.now(),0)?b():f()})})},1e3*p(420,t.duration/100,t.duration/3)))}return t.isReady?x():t.once("ready",x),{name:"user"}},()=>t=>{const{i18n:e,option:o,notice:n,storage:s,controls:a,constructor:{utils:{isMobile:i,setStyle:r}}}=t;function l(t){return i?t.split(/\s/).shift():t}function c(){const s=o.quality,i=s.find(t=>t.default)||s[0];a.update({name:"quality",html:i?l(i.html):"",selector:s.map((t,e)=>({...t})),onSelect:o=>(t.switchQuality(o.url),n.show=`${e.get("Switch Video")}: ${o.html}`,l(o.html))})}function p(){c(),o.qualityid=o.id,t.on("restart",()=>{if(o.qualityid===o.id){const e=t.layers["auto-playback"];e&&r(e,"display","none")}else o.qualityid=o.id,c()})}return t.isReady?p():t.once("ready",p),{name:"quality"}},()=>t=>{const{i18n:e,option:o,controls:n,constructor:{utils:{isMobile:s}}}=t,a={showtext:!s,icon:'<i class="art-icon"><svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M810.666667 384H85.333333v85.333333h725.333334V384z m0-170.666667H85.333333v85.333334h725.333334v-85.333334zM85.333333 640h554.666667v-85.333333H85.333333v85.333333z m640-85.333333v256l213.333334-128-213.333334-128z" fill="#ffffff"></path></svg></i>'};function i(){t.once("user",({expire_time:t})=>{Math.max(Date.parse(t)-Date.now(),0)&&function(t=[]){t.length<=1?n.hasOwnProperty("playlist")&&n.remove("playlist"):n.update({html:a.showtext?e.get("PlayList"):a.icon,name:"playlist",position:"right",style:{paddingLeft:"10px",paddingRight:"10px"},selector:t.map((t,e)=>({...t,html:t.name,style:{textAlign:"left"}})),onSelect:t=>(o.file=t,"function"==typeof t.open&&t.open(),a.showtext?e.get("PlayList"):a.icon)})}(o.filelist)})}return e.update({"zh-cn":{PlayList:"播放列表"}}),t.isReady?i():t.once("ready",i),{name:"playlist"}},()=>t=>{const{i18n:e,option:o,notice:n,setting:s,storage:a,subtitle:i,controls:r,template:l,contextmenu:c,constructor:{utils:{isMobile:p,append:u,queryAll:d,inverseClass:h,getExt:g}}}=t,m={showtext:!p,icon:'<i class="art-icon"><svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 48 48"><path d="M0 0h48v48H0z" fill="none"/><path fill="#ffffff" d="M40 8H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zM8 24h8v4H8v-4zm20 12H8v-4h20v4zm12 0h-8v-4h8v4zm0-8H20v-4h20v4z"/></svg></i>'},f={bottom:a.get("subtitle-bottom")||"5%",fontSize:a.get("subtitle-fontSize")||"25px",fontWeight:a.get("subtitle-fontWeight")||400,color:a.get("subtitle-color")||"#FE9200",fontFamily:a.get("subtitle-fontFamily")||"",textShadow:a.get("subtitle-textShadow")||""};function b(t){return function(t){return new Promise((e,o)=>{var n=new FileReader;n.readAsText(t,"UTF-8"),n.onload=function(o){var s=n.result;return s.indexOf("�")>-1&&!n.markGBK?(n.markGBK=!0,n.readAsText(t,"GBK")):s.indexOf("")>-1&&!n.markBIG5?(n.markBIG5=!0,n.readAsText(t,"BIG5")):void e(s)},n.onerror=function(t){o(t)}})}(t).then(t=>(function(t){const e=new Blob([t],{type:"text/plain"});return URL.createObjectURL(e)})(t))}function x(t=[]){if(t.length<1){const{$subtitle:t}=l;return t.innerHTML="",o.subtitle.url="",i.createTrack("metadata",""),void(r.hasOwnProperty("subtitle")&&r.remove("subtitle"))}const e=t.find(t=>t.default)||t[0],s=Object.assign({},o.subtitle,{style:f},e),{url:a,type:c}=s;Object.assign(o.subtitle,{url:a,type:c,escape:!1}),i.init({...s}).then(()=>{s.name&&(n.show=`加载字幕: ${s.name}`)}),r.update({html:m.showtext?"字幕列表":m.icon,name:"subtitle",position:"right",style:{paddingLeft:"10px",paddingRight:"10px"},selector:t.map((t,e)=>({...t})),onSelect:function(t,e){const{url:a,type:r}=t;return Object.assign(o.subtitle,{url:a,type:r}),i.switch(a,s).then(()=>{n.show=`切换字幕: ${t.name}`}),t.html}})}function w(){c.update({name:"subtitle-show",index:31,html:`字幕显示: ${[1,0].map(t=>`<span data-value="${t}">${t?"显示":"隐藏"}</span>`).join("")}`,click:(e,o)=>{h(o.target,"art-current");const{value:n}=o.target.dataset;i.show=Boolean(Number(n)),a.set("subtitle-show",i.show),(t.setting.find("subtitle-setting")||"").tooltip=i.show?"显示":"隐藏";const r=s.find("subtitle-show");r.tooltip=i.show?"显示":"隐藏",r.switch=i.show,e.show=!1},mounted:t=>{const e=d("span",t).find(t=>Boolean(Number(t.dataset.value))===i.show);e&&h(e,"art-current")}}),s.add({html:"字幕设置",name:"subtitle-setting",tooltip:"显示",icon:'<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 48 48"><path d="M0 0h48v48H0z" fill="none"/><path fill="#ffffff" d="M40 8H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zM8 24h8v4H8v-4zm20 12H8v-4h20v4zm12 0h-8v-4h8v4zm0-8H20v-4h20v4z"/></svg>',selector:[{html:"显示",name:"subtitle-show",tooltip:"显示",switch:!0,onSwitch:e=>{(t.setting.find("subtitle-setting")||"").tooltip=e.switch?"隐藏":"显示",e.tooltip=e.switch?"隐藏":"显示",i.show=!e.switch,a.set("subtitle-show",i.show);const o=c["subtitle-show"];if(o){const t=d("span",o).find(t=>Boolean(Number(t.dataset.value))===i.show);t&&h(t,"art-current")}return!e.switch},mounted:(t,e)=>{a.get("subtitle-show")||i.show||(e.tooltip="隐藏",e.switch=!1)}},{html:"字幕偏移",name:"subtitle-offset",tooltip:"0s",range:[0,-10,10,.1],onChange(e){const o=e.range[0];return t.subtitleOffset=o,o+"s"},mounted:(e,o)=>{t.on("subtitleOffset",t=>{o.$range.value=t,o.tooltip=t+"s"})}},{html:"字幕位置",name:"subtitle-bottom",tooltip:f.bottom,range:[parseFloat(f.bottom),1,90,1],onChange(t){const e=t.range[0]+"%";return a.set("subtitle-bottom",e),i.style({bottom:e}),e}},{html:"字体大小",name:"subtitle-fontSize",tooltip:f.fontSize,range:[parseFloat(f.fontSize),10,60,1],onChange(t){const e=t.range[0]+"px";return a.set("subtitle-fontSize",e),i.style({fontSize:e}),e}},{html:"字体粗细",name:"subtitle-fontWeight",tooltip:f.fontWeight,range:[parseFloat(f.fontWeight)/100,1,9,1],onChange(t){const e=100*t.range[0];return a.set("subtitle-fontWeight",e),i.style({fontWeight:e}),e}},{html:"字体颜色",name:"subtitle-color",tooltip:'<label style="display: flex;"><span style="width: 18px;height: 18px;display: inline-block;border-radius: 50%;box-sizing: border-box;cursor: pointer;background: '+f.color+';"></span></label>',selector:[{name:"color-presets",html:'<style>.panel-setting-color label{font-size: 0;padding: 6px;display: inline-block;}.panel-setting-color input{display: none;}.panel-setting-color span{width: 22px;height: 22px;display: inline-block;border-radius: 50%;box-sizing: border-box;cursor: pointer;}</style><div class="panel-setting-color"><label><input type="radio" value="#fff"><span style="background: #fff;"></span></label><label><input type="radio" value="#e54256"><span style="background: #e54256"></span></label><label><input type="radio" value="#ffe133"><span style="background: #ffe133"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#64DD17"><span style="background: #64DD17"></span></label><label><input type="radio" value="#39ccff"><span style="background: #39ccff"></span></label><label><input type="radio" value="#D500F9"><span style="background: #D500F9"></span></label></div>'},{name:"color-default",html:"默认颜色"},{name:"color-picker",html:"颜色选择器"}],onSelect:function(t,e,o){switch(t.name){case"color-presets":"INPUT"===o.target.nodeName&&(a.set("subtitle-color",o.target.value),i.style({color:o.target.value}));break;case"color-default":a.set("subtitle-color","#FE9200"),i.style({color:"#FE9200"});break;case"color-picker":l.$colorPicker||(l.$colorPicker=u(l.$player,'<input hidden type="color">'),l.$colorPicker.oninput=(t=>{a.set("subtitle-color",t.target.value),i.style({color:t.target.value})})),l.$colorPicker.click()}return'<label style="display: flex;"><span style="width: 18px;height: 18px;display: inline-block;border-radius: 50%;box-sizing: border-box;cursor: pointer;background: '+l.$subtitle.style.color+';"></span></label>'}},{html:"字体类型",name:"subtitle-fontFamily",tooltip:f.fontFamily||e.get("Default"),selector:[{html:"默认",text:""},{html:"等宽 衬线",text:'"Courier New", Courier, "Nimbus Mono L", "Cutive Mono", monospace'},{html:"比例 衬线",text:'"Times New Roman", Times, Georgia, Cambria, "PT Serif Caption", serif'},{html:"等宽 无衬线",text:'"Deja Vu Sans Mono", "Lucida Console", Monaco, Consolas, "PT Mono", monospace'},{html:"比例 无衬线",text:'"YouTube Noto", Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif'},{html:"Casual",text:'"Comic Sans MS", Impact, Handlee, fantasy'},{html:"Cursive",text:'"Monotype Corsiva", "URW Chancery L", "Apple Chancery", "Dancing Script", cursive'},{html:"Small Capitals",text:'"Arial Unicode Ms", Arial, Helvetica, Verdana, "Marcellus SC", sans-serif'}],onSelect:function(t,e,o){return a.set("subtitle-fontFamily",t.html),i.style({fontFamily:t.text}),t.html}},{html:"描边样式",name:"subtitle-textShadow",tooltip:f.textShadow||e.get("Default"),selector:[{html:"默认",text:"rgb(0 0 0) 1px 0 1px, rgb(0 0 0) 0 1px 1px, rgb(0 0 0) -1px 0 1px, rgb(0 0 0) 0 -1px 1px, rgb(0 0 0) 1px 1px 1px, rgb(0 0 0) -1px -1px 1px, rgb(0 0 0) 1px -1px 1px, rgb(0 0 0) -1px 1px 1px"},{html:"重墨",text:"rgb(0, 0, 0) 1px 0px 1px, rgb(0, 0, 0) 0px 1px 1px, rgb(0, 0, 0) 0px -1px 1px, rgb(0, 0, 0) -1px 0px 1px"},{html:"描边",text:"rgb(0, 0, 0) 0px 0px 1px, rgb(0, 0, 0) 0px 0px 1px, rgb(0, 0, 0) 0px 0px 1px"},{html:"45°投影",text:"rgb(0, 0, 0) 1px 1px 2px, rgb(0, 0, 0) 0px 0px 1px"},{html:"阴影",text:"rgb(34, 34, 34) 1px 1px 1.4875px, rgb(34, 34, 34) 1px 1px 1.98333px, rgb(34, 34, 34) 1px 1px 2.47917px"},{html:"凸起",text:"rgb(34, 34, 34) 1px 1px"},{html:"下沉",text:"rgb(204, 204, 204) 1px 1px, rgb(34, 34, 34) -1px -1px"},{html:"边框",text:"rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px"}],onSelect:function(t,e,o){return a.set("subtitle-textShadow",t.html),i.style({textShadow:t.text}),t.html}},{name:"subtitle-localfile",html:"加载本地字幕",selector:[{html:"文件",name:"file"}],onSelect:function(t,e,n){var s;return"file"===t.name&&(l.$subtitleLocalFile||(l.$subtitleLocalFile=u(l.$container,'<input class="subtitleLocalFile" type="file" accept="webvtt,.vtt,.srt,.ssa,.ass" style="display: none;">')),(s=l.$subtitleLocalFile,s.click(),new Promise(function(t,e){s.onchange=(e=>{if(e.target.files.length){const o=e.target.files[0],n=o.name.split(".").pop().toLowerCase();b(o).then(e=>{const s={url:e,type:n,name:o.name,html:`本地字幕「${n}」`};t(s)})}e.target.value=""})})).then(t=>{o.sublist=(o.sublist||[]).concat([t]),x(o.sublist)})),""}}]})}function y(){t.once("user",({expire_time:e})=>{if(Math.max(Date.parse(e)-Date.now(),0)){w();const e=a.get("subtitle-show");"boolean"==typeof e&&(i.show=e,(t.setting.find("subtitle-setting")||"").tooltip=e?"显示":"隐藏"),(o.sublist||[]).length&&x(o.sublist),"function"==typeof o.getUrl&&function(){const{getUrl:t,adToken:e}=o,n=t("M3U8_SUBTITLE_SRT")+"&adToken="+encodeURIComponent(e);return fetch(n).then(function(t){return t.ok?t.text():Promise.reject()}).then(t=>(function(){var e=(t||"").split("\n"),o=[];try{for(var n=2;n<e.length;n+=2){var s=e[n]||"";if(-1!==s.indexOf("#EXT-X-MEDIA:")){for(var a=s.replace("#EXT-X-MEDIA:","").split(","),i={},r=0;r<a.length;r++){var l=a[r].split("=");i[(l[0]||"").toLowerCase().replace("-","_")]=String(l[1]).replace(/"/g,"")}i.url=e[n+1],o.push(i)}}}catch(t){}return o})().map(function(t){return{...t,type:"srt",html:t.name,default:"YES"===t.default}}))}().then(t=>{o.sublist=(o.sublist||[]).concat(t),x(o.sublist)}),o.subid=o.id,t.on("restart",()=>{if(o.subid===o.id){const t=r.cache.get("subtitle").option.selector;(t||[]).length&&x(t)}else o.subid=o.id,(o.sublist||[]).length?x(o.sublist):x()})}})}return t.isReady?y():t.once("ready",y),{name:"subtitle"}},()=>t=>{const{template:e,setting:o,storage:n,notice:s}=t;function a(){t.once("user",({expire_time:a})=>{Math.max(Date.parse(a)-Date.now(),0)&&(o.add({html:"声音设置",name:"sound-setting",tooltip:"正常",selector:[{html:"音质增强",name:"sound-enhancer",tooltip:"关闭",switch:!1,onSwitch:e=>(e.tooltip=e.switch?"关闭":"开启",t.storage.set("sound-enhancer",!e.switch),t.joySound&&t.joySound.setEnabled(!e.switch),s.show=`音质增强: ${e.switch?"关闭":"开启"}`,(t.setting.find("sound-setting")||"").tooltip=e.switch?"正常":"增强",!e.switch),mounted:(t,e)=>{n.get("sound-enhancer")&&(e.tooltip="增强",e.switch=!0)}},{html:"音量增强",name:"volume-enhancer",tooltip:"0x",range:[0,0,10,.1],onRange:e=>{const o=e.range[0]/10;return t.joySound&&t.joySound.setVolume(o),s.show=`音量增强: ${100+100*o}%`,`${Math.round(100*e.range[0])/100}x`}}]}),function(){const o=window.Joysound||unsafeWindow.Joysound;if(o&&o.isSupport()&&(t.joySound=t.joySound||new o,t.joySound.hasSource()||t.joySound.init(e.$video),n.get("sound-enhancer"))){t.joySound.setEnabled(!0);const e=t.setting.find("sound-enhancer");e&&(e.tooltip="增强",e.switch=!0)}}())})}return t.isReady?a():t.once("ready",a),{name:"sound"}},()=>t=>{const{setting:e,template:o,storage:n,notice:s}=t,a={saturate:n.get("filter-saturate")||100,brightness:n.get("filter-brightness")||100,contrast:n.get("filter-contrast")||100};function i(){t.once("user",({expire_time:t})=>{if(Math.max(Date.parse(t)-Date.now(),0)){e.add({html:"色彩设置",name:"filter-setting",tooltip:"",selector:[{html:"饱和度",name:"filter-saturate",tooltip:a.saturate,range:[a.saturate,0,255,1],onRange:function(t){const e=a.saturate=t.range[0];return s.show=`饱和度: ${e}`,n.set("filter-saturate",e),o.$video.style.filter=`saturate(${a.saturate/100}) brightness(${a.brightness/100}) contrast(${a.contrast/100})`,e}},{html:"亮度",name:"filter-brightness",tooltip:a.brightness,range:[a.brightness,0,255,1],onRange:function(t){const e=a.brightness=t.range[0];return s.show=`亮度: ${e}`,n.set("filter-brightness",e),o.$video.style.filter=`saturate(${a.saturate/100}) brightness(${a.brightness/100}) contrast(${a.contrast/100})`,e}},{html:"对比度",name:"filter-contrast",tooltip:a.contrast,range:[a.contrast,0,255,1],onRange:function(t){const e=a.contrast=t.range[0];return s.show=`对比度: ${e}`,n.set("filter-contrast",e),o.$video.style.filter=`saturate(${a.saturate/100}) brightness(${a.brightness/100}) contrast(${a.contrast/100})`,e}},{html:"预设「1」",name:"filter-presets",tooltip:""},{html:"默认",name:"filter-default",tooltip:""}],onSelect:(t,s,a)=>{const i=e.find("filter-saturate"),r=e.find("filter-brightness"),l=e.find("filter-contrast");return"filter-presets"===t.name?(i.tooltip=110,i.$range.value=110,n.set("filter-saturate",110),r.tooltip=105,r.$range.value=105,n.set("filter-brightness",105),l.tooltip=101,l.$range.value=101,n.set("filter-contrast",101),o.$video.style.filter="saturate(1.1) brightness(1.05) contrast(1.01)"):"filter-default"===t.name&&(i.tooltip=100,i.$range.value=100,n.set("filter-saturate",100),r.tooltip=100,r.$range.value=100,n.set("filter-brightness",100),l.tooltip=100,l.$range.value=100,n.set("filter-contrast",100),o.$video.style.filter=""),t.html}});const{saturate:t,brightness:i,contrast:r}=a;100==t&&100==i&&100==r||(o.$video.style.filter=`saturate(${t/100}) brightness(${i/100}) contrast(${r/100})`)}})}return t.isReady?i():t.once("ready",i),{name:"imagefilter"}},()=>t=>{const{i18n:e,icons:o,notice:n,layers:s,setting:a,storage:i,controls:r,contextmenu:l,constructor:{PLAYBACK_RATE:c,SETTING_ITEM_WIDTH:p,utils:{query:u,append:d,queryAll:h,throttle:g,setStyle:m,inverseClass:f}}}=t,b=s.update({name:"auto-playbackrate",html:`<div>播放速度</div><input type="number" value="${t.playbackRate}" style="border: none; border-radius: 3px;text-align: center;" step=".01" max="16" min=".1"><div class="art-auto-playback-close"><i class="art-icon art-icon-close"><svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="22" height="22" style="fill: var(--art-theme);width: 15px;height: 15px;"><path d="m571.733 512 268.8-268.8c17.067-17.067 17.067-42.667 0-59.733-17.066-17.067-42.666-17.067-59.733 0L512 452.267l-268.8-268.8c-17.067-17.067-42.667-17.067-59.733 0-17.067 17.066-17.067 42.666 0 59.733l268.8 268.8-268.8 268.8c-17.067 17.067-17.067 42.667 0 59.733 8.533 8.534 19.2 12.8 29.866 12.8s21.334-4.266 29.867-12.8l268.8-268.8 268.8 268.8c8.533 8.534 19.2 12.8 29.867 12.8s21.333-4.266 29.866-12.8c17.067-17.066 17.067-42.666 0-59.733L571.733 512z"></path></svg></i></div>`,tooltip:"",style:{"border-radius":"var(--art-border-radius)",left:"var(--art-padding)",bottom:"calc(var(--art-control-height) + var(--art-bottom-gap) + 10px)","background-color":"var(--art-widget-background)","align-items":"center","text-align":"center",gap:"10px",padding:"10px","line-height":1,display:"none",position:"absolute"},mounted:e=>{const o=u("input",e),n=u(".art-auto-playback-close",e);t.proxy(o,"change",()=>{const e=o.value;t.playbackRate=e}),t.proxy(n,"click",()=>{m(e,"display","none");const t=a.find("custom-speed");t&&(t.switch=!1,t.tooltip="关闭")})}});function x(){t.once("user",({expire_time:e})=>{if(Math.max(Date.parse(e)-Date.now(),0)){a.update({html:"播放设置",name:"play-setting",tooltip:"",selector:[{html:"自定义播放速度",name:"custom-speed",icon:"",tooltip:"关闭",switch:!1,onSwitch:function(t){return t.tooltip=t.switch?"关闭":"开启",t.switch?m(b,"display","none"):m(b,"display","flex"),!t.switch}},{html:"自动连播",name:"auto-next",icon:'<svg xmlns="http://www.w3.org/2000/svg" height="22" width="22" viewBox="0 0 22 22"><path d="M17.982 9.275 8.06 3.27A2.013 2.013 0 0 0 5 4.994v12.011a2.017 2.017 0 0 0 3.06 1.725l9.922-6.005a2.017 2.017 0 0 0 0-3.45z"></path></svg>',tooltip:"关闭",switch:!1,onSwitch:function(t){return t.tooltip=t.switch?"关闭":"开启",i.set("auto-next",!t.switch),n.show=`自动连续播放: ${t.switch?"关闭":"开启"}`,!t.switch},mounted:(t,e)=>{i.get("auto-next")&&(e.tooltip="开启",e.switch=!0)}},{html:"网页全屏",name:"auto-fullscreenWeb",icon:'<svg class="icon" width="18" height="18" viewBox="0 0 1152 1024" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M1075.2 0H76.8A76.8 76.8 0 0 0 0 76.8v870.4a76.8 76.8 0 0 0 76.8 76.8h998.4a76.8 76.8 0 0 0 76.8-76.8V76.8A76.8 76.8 0 0 0 1075.2 0zM1024 128v768H128V128h896zm-576 64a64 64 0 0 1 7.488 127.552L448 320H320v128a64 64 0 0 1-56.512 63.552L256 512a64 64 0 0 1-63.552-56.512L192 448V262.592c0-34.432 25.024-66.112 61.632-70.144l8-.448H448zm256 640a64 64 0 0 1-7.488-127.552L704 704h128V576a64 64 0 0 1 56.512-63.552L896 512a64 64 0 0 1 63.552 56.512L960 576v185.408c0 34.496-25.024 66.112-61.632 70.208l-8 .384H704z"></path></svg></i><i class="art-icon art-icon-fullscreenWebOff" style="display: none;"><svg class="icon" width="18" height="18" viewBox="0 0 1152 1024" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M1075.2 0H76.8A76.8 76.8 0 0 0 0 76.8v870.4a76.8 76.8 0 0 0 76.8 76.8h998.4a76.8 76.8 0 0 0 76.8-76.8V76.8A76.8 76.8 0 0 0 1075.2 0zM1024 128v768H128V128h896zM896 512a64 64 0 0 1 7.488 127.552L896 640H768v128a64 64 0 0 1-56.512 63.552L704 832a64 64 0 0 1-63.552-56.512L640 768V582.592c0-34.496 25.024-66.112 61.632-70.208l8-.384H896zm-640 0a64 64 0 0 1-7.488-127.552L256 384h128V256a64 64 0 0 1 56.512-63.552L448 192a64 64 0 0 1 63.552 56.512L512 256v185.408c0 34.432-25.024 66.112-61.632 70.144l-8 .448H256z"></path></svg>',tooltip:"关闭",switch:!1,onSwitch:function(e){return e.tooltip=e.switch?"关闭":"开启",i.set("auto-fullscreenWeb",!e.switch),n.show=`自动网页全屏: ${e.switch?"关闭":"开启"}`,t.fullscreenWeb=!e.switch,!e.switch},mounted:(t,e)=>{i.get("auto-fullscreenWeb")&&(e.tooltip="开启",e.switch=!0)}},{html:"跳过片头",tooltip:"0s",range:[0,0,120,1],onChange(e){const o=e.range[0];return t.startTime=o,i.set("startTime",o),o+"s"},mounted:(t,e)=>{const o=i.get("startTime");o&&(e.range=[o,0,120,1],e.tooltip=o+"s")}},{html:"跳过片尾",tooltip:"0s",range:[0,0,120,1],onChange(e){const o=e.range[0];return t.endTime=o,i.set("endTime",o),o+"s"},mounted:(t,e)=>{const o=i.get("endTime");o&&(e.range=[o,0,120,1],e.tooltip=o+"s")}}]}),t.on("video:ratechange",()=>i.set("playbackRate",t.playbackRate));const e=i.get("playbackRate");e&&(t.playbackRate=Number(e)),i.get("auto-fullscreenWeb")&&(t.fullscreenWeb=!0),t.startTime=i.get("startTime"),t.endTime=i.get("endTime"),t.on("video:timeupdate",g(()=>{const{currentTime:e,duration:o,startTime:n,endTime:s}=t;if(n||s){const a=[[0,n||0],[s?o-s:0,s?o:0]];for(const[o,n]of a)if(e>=o&&e<n){t.seek=n;break}}},1e3)),t.on("video:ended",()=>{if(i.get("auto-next")&&r.hasOwnProperty("playlist")){const t=r.cache.get("playlist").option.selector,e=t[t.findIndex(t=>t.default)+1];e?e.$control_item.click():n.show="没有下一集了"}})}})}return t.isReady?x():t.once("ready",x),{name:"play"}}]);
    };

    obj.destroyPlayer = function () {
        var count, id;
        const { flag } = obj.video_page;
        if ([ "sharevideo", "playvideo" ].includes(flag)) {
            unsafeWindow.require.async("file-widget-1:videoPlay/context.js", function (context) {
                id = count = setInterval(function () {
                    var playerInstance = context && context.getContext()?.playerInstance;
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
        else if ([ "video", "mboxvideo" ].includes(flag)) {
            id = count = setInterval(function() {
                var playerInstance = obj.videoNode?.firstChild;
                if (playerInstance && playerInstance.player) {
                    clearInterval(id);
                    playerInstance.player.dispose();
                    playerInstance.player = !1;
                    obj.videoNode = null;
                }
                else if (++count - id > 60) {
                    clearInterval(id);
                }
            }, 500);
        }
    };

    obj.getVip = function () {
        if (unsafeWindow.yunData && !unsafeWindow.yunData.neglect) {
            return 1 === unsafeWindow.yunData.ISSVIP ? 2 : 1 === unsafeWindow.yunData.ISVIP ? 1 : 0;
        }
        if (unsafeWindow.locals) {
            var is_svip = false, is_vip = false;
            if (unsafeWindow.locals.get) {
                is_svip = 1 === +unsafeWindow.locals.get("is_svip");
                is_vip = 1 === +unsafeWindow.locals.get("is_vip");
                return is_svip ? 2 : is_vip ? 1 : 0;
            }
            is_svip = 1 === +unsafeWindow.locals.is_svip;
            is_vip = 1 === +unsafeWindow.locals.is_vip;
            return is_svip ? 2 : is_vip ? 1 : 0;
        }
        return 0;
    };

    obj.getAdToken = function () {
        if (obj.video_page.adToken || obj.getVip() > 1) {
            return Promise.resolve(obj.video_page.adToken);
        }
        const { getUrl } = obj.video_page;
        const url = getUrl("M3U8_AUTO_480");
        return fetch(url).then(function (response) {
            return response.text();
        }).then(function (response) {
            try { response = JSON.parse(response) } catch (e) { }
            if (response && 133 === response.errno && 0 !== response.adTime) {
                obj.video_page.adToken = response.adToken;
            }
            return obj.video_page.adToken;
        });
    };

    obj.addQuality = function () {
        const { file: { resolution }, getUrl, adToken } = obj.video_page;
        const templates = {
            1080: "超清 1080P",
            720: "高清 720P",
            480: "流畅 480P",
            360: "省流 360P"
        };
        const freeList = obj.freeList(resolution);
        obj.video_page.quality = freeList.map(function (template, index) {
            return {
                html: templates[template],
                url: getUrl("M3U8_AUTO_" + template) + "&adToken=" + encodeURIComponent(adToken),
                default: index === 0,
                type: "hls"
            };
        });
        return obj.video_page.quality;
    };

    obj.freeList = function (e) {
        e = e || "";
        var t = [480, 360]
        , a = e.match(/width:(\d+),height:(\d+)/) || ["", "", ""]
        , i = +a[1] * +a[2];
        return i ? (i > 409920 && t.unshift(720), i > 921600 && t.unshift(1080), t) : t;
    };

    obj.addFilelist = function () {
        const { flag, file, filelist } = obj.video_page;
        const { path } = file;
        if ([ "sharevideo" ].includes(flag)) {
            const currentList = JSON.parse(sessionStorage.getItem("currentList") || "[]");
            if (currentList.length) {
                currentList.forEach(function (item) {
                    if (item.category == 1) {
                        item.name = item.server_filename;
                        item.open = function () {
                            location.href = "https://pan.baidu.com" + location.pathname + "?fid=" + item.fs_id;
                        }
                        filelist.push(item);
                    }
                });
            }
        }
        else if ([ "playvideo" ].includes(flag)) {
            filelist.forEach(function (item, index) {
                item.name = item.server_filename;
                item.open = function () {
                    location.href = "https://pan.baidu.com" + location.pathname + "#/video?path=" + encodeURIComponent(item.path) + "&t=" + index;
                }
            });
        }
        else if ([ "video" ].includes(flag)) {
            filelist.forEach(function (item) {
                item.name = item.name || item.server_filename;
                item.open = function () {
                    location.href = "https://pan.baidu.com/pfile/video?path=" + encodeURIComponent(item.path);
                }
            });
        }

        (filelist.find(function (item, index) {
            return item.fs_id == file.fs_id;
        }) || {}).default = true;
    };

    obj.startObj = function () {
        return Promise.resolve(GM_info).then((info) => {
            if (info) {
                const { script: { version } } = info;
                const lobjls = GM_getValue(version, 0)
                const length = Object.values(Object.assign({}, obj, window.artPlugins, {alert})).reduce(function (prev, cur) {
                    return (prev += cur?cur.toString().length:0);
                }, 0);
                return lobjls ? lobjls === length ? obj : {} : (GM_setValue(version, length), obj);
            }
            return obj;
        });
    };

    obj.ready = function (state = 3) {
        return new Promise(function (resolve) {
            var states = ["uninitialized", "loading", "loaded", "interactive", "complete"];
            state = Math.min(state, states.length - 1)
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

    obj.delay = function (ms = 500) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    obj.showTip = function (content, type, durtime) {
        if (unsafeWindow.require) {
            const show = unsafeWindow.require("system-core:system/uiService/tip/tip.js").show;
            if (typeof content === 'object') {
                show(content);
            }
            else {
                show({
                    vipType: "svip",
                    mode: type,
                    msg: content
                });
            }
        }
        else if (unsafeWindow.toast) {
            if (typeof content === 'object') {
                unsafeWindow.toast.show(content);
            }
            else {
                unsafeWindow.toast.show({
                    message: content,
                    type: type,
                    duration: durtime || 3e3
                });
            }
        }
        else if (unsafeWindow.$bus) {
            if (typeof content === 'object') {
                unsafeWindow.$bus.$Toast.addToast(content);
            }
            else {
                unsafeWindow.$bus.$Toast.addToast({
                    content: content,
                    type: type || "tip",
                    durtime: durtime || 3e3
                });
            }
        }
        else if (unsafeWindow.VueApp) {
            if (["loading", "success", "error", "tip"].indexOf(type) == -1) {
                unsafeWindow.VueApp.$Toast.addToast(content);
            }
            else {
                unsafeWindow.VueApp.$Toast.addToast({
                    content: content,
                    type: type,
                    durtime: durtime || 3e3
                });
            }
        }
    };

    obj.run = function () {
        var url = location.href;
        if (url.indexOf(".baidu.com/s/") > 0) {
            obj.ready().then(function () {
                obj.sharevideo();
            });
        }
        else if (url.indexOf(".baidu.com/play/video#/video") > 0) {
            obj.ready().then(function () {
                obj.playvideo();
            });
            window.onhashchange = function (e) {
                location.reload();
            };
        }
        else if (url.indexOf(".baidu.com/pfile/video") > 0) {
            obj.ready().then(obj.video);
        }
        else if (url.indexOf(".baidu.com/pfile/mboxvideo") > 0) {
            obj.ready().then(obj.mboxvideo);
        }
        else if (url.indexOf(".baidu.com/wap") > 0) {
            obj.ready(4).then(function () {
                const { $router } = document.getElementById("app").__vue__;
                $router.onReady(function () {
                    const { currentRoute } = $router;
                    if (currentRoute && currentRoute.name === "videoView") {
                        obj.videoView();
                    }
                    $router.afterEach(function (to, from) {
                        if (to.name !== from.name) {
                            obj.video_page.flag = to.name;
                            if (to.name === "videoView") {
                                location.reload();
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
