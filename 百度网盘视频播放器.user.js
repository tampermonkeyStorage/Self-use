// ==UserScript==
// @name         百度网盘视频播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      0.9.1
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
            obj.artPlugins().init(options).then(() => {
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
        return window.artPlugins||function(t){var e={version:"1.1.1",init:t=>Promise.all([e.readyHls(),e.readyArtplayer(),e.readySupported()]).then(()=>e.initArtplayer(t)),readyHls:()=>window.Hls||unsafeWindow.Hls?Promise.resolve():e.loadJs("https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.18/hls.min.js"),readyArtplayer:()=>window.Artplayer||unsafeWindow.Artplayer?Promise.resolve():e.loadJs("https://cdnjs.cloudflare.com/ajax/libs/artplayer/5.2.1/artplayer.min.js"),readySupported:()=>Promise.resolve(GM_info).then(t=>{if(t){const{scriptMetaStr:e=""}=t;if(Math.min(e.indexOf(1348),0))return Promise.reject()}}),initArtplayer:e=>{const o=window.Artplayer||unsafeWindow.Artplayer,{isMobile:n}=o.utils;return Object.assign(o,{ASPECT_RATIO:["default","自动","4:3","16:9"],AUTO_PLAYBACK_TIMEOUT:1e4,NOTICE_TIME:5e3}),new o(e=Object.assign({container:"#artplayer",url:"",quality:[],type:"hls",autoplay:!0,autoPlayback:!0,aspectRatio:!0,contextmenu:[],customType:{hls:(t,e,o)=>{const n=window.Hls||unsafeWindow.Hls;if(n.isSupported()){o.hls&&o.hls.destroy();const a=new n({maxBufferLength:10*n.DefaultConfig.maxBufferLength,xhrSetup:(t,e)=>{const n=(e.match(/^http(?:s)?:\/\/(.*?)\//)||[])[1];if(n!==location.host){if(/backhost=/.test(e)){var a,s=(decodeURIComponent(e||"").match(/backhost=(\[.*\])/)||[])[1];if(s){try{a=JSON.parse(s)}catch(t){}if(a&&a.length){const t=(a=[].concat(a,[n])).findIndex(t=>t===o.realHost);o.realHost=a[t+1>=a.length?0:t+1]}}}o.realHost&&(e=e.replace(n,o.realHost),t.open("GET",e,!0))}}});a.loadSource(e),a.attachMedia(t),a.fragLoadError=0,a.on(n.Events.ERROR,(t,e)=>{if(e.fatal)switch(e.type){case n.ErrorTypes.NETWORK_ERROR:e.details===n.ErrorDetails.MANIFEST_LOAD_ERROR?31341==JSON.parse(e.networkDetails.response).errno?(o.notice.show="正在转码，重试中 ...",setTimeout(()=>{a.loadSource(a.url)},1e3)):(o.notice.show="无法播放，请稍后再试",a.destroy()):e.details===n.ErrorDetails.MANIFEST_LOAD_TIMEOUT||e.details===n.ErrorDetails.MANIFEST_PARSING_ERROR?a.loadSource(a.url):e.details===n.ErrorDetails.FRAG_LOAD_ERROR?(a.fragLoadError+=1,a.fragLoadError<10?setTimeout(()=>{a.loadSource(a.url),a.media.currentTime=o.currentTime,a.media.play()},1e3):(a.destroy(),a.fragLoadError=0,o.notice.show="视频播放错误次数过多，请刷新重试")):a.startLoad();break;case n.ErrorTypes.MEDIA_ERROR:a.recoverMediaError();break;default:a.destroy(),o.notice.show="视频播放异常，请刷新重试"}}),o.hls=a,o.on("destroy",()=>a.destroy())}else t.canPlayType("application/vnd.apple.mpegurl")?t.src=e:o.notice.show="Unsupported playback format: m3u8"}},flip:!1,icons:{loading:'<img src="https://artplayer.org/assets/img/ploading.gif">',state:'<img width="150" heigth="150" src="https://artplayer.org/assets/img/state.svg">',indicator:'<img width="16" heigth="16" src="https://artplayer.org/assets/img/indicator.svg">'},id:"",pip:!n,poster:"",playbackRate:!1,screenshot:!0,setting:!0,subtitle:{url:"",type:"auto",style:{color:"#fe9200",bottom:"5%",fontSize:"25px",fontWeight:400,fontFamily:"",textShadow:""},encoding:"utf-8",escape:!1},subtitleOffset:!1,hotkey:!0,fullscreen:!0,fullscreenWeb:!n},e),e=>{t.forEach(t=>{e.plugins.add(t())})})},loadJs:t=>(window.instances||(window.instances={}),window.instances[t]||(window.instances[t]=new Promise((e,o)=>{const n=document.createElement("script");n.src=t,n.type="text/javascript",n.onload=e,n.onerror=o,Node.prototype.appendChild.call(document.head,n)})),window.instances[t])};return console.info(`%c artPlugins %c ${e.version} %c https://scriptcat.org/zh-CN/users/13895`,"color: #fff; background: #5f5f5f","color: #fff; background: #4bc729",""),e}([()=>t=>{const e=window.Hls||unsafeWindow.Hls,{hls:o,layers:n,notice:a,storage:s,constructor:{CONTEXTMENU:r,utils:{query:i,append:l,setStyle:c,clamp:p,debounce:u,throttle:d}}}=t,h={show:!1};function m(){return f().then(t=>{const e=t.User.current();if(e){const{ON:o,authData:n,check:a,expire_time:r,updatedAt:i}=e.toJSON();if(3===[Math.max(Date.parse(i)+864e5-Date.now(),0),JSON.stringify(n)===JSON.stringify({baidu:{uid:""+("function"==typeof unsafeWindow.locals.get?unsafeWindow.locals.get("uk"):unsafeWindow.locals.uk)}}),s.get(t._getAVPath(t.User._CURRENT_USER_KEY))===btoa(encodeURIComponent(JSON.stringify(r)))].filter(Boolean).length)return o?Math.max(a,0)?Math.max(Date.parse(i)+432e3-Date.now(),0)?e:g().then(t=>Math.max(Date.parse(t.toJSON().expire_time)-Date.now(),0)?t:(Object.assign(t.attributes,{ON:o,expire_time:r,check:a-1}),t._handleSaveResult(!0).then(()=>t))):g():e}return g()})}function g(){return f().then(t=>fetch("https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo").then(t=>t.ok?t.json():Promise.reject()).then(t=>t&&0===t.errno?t:Promise.reject()).then(e=>{const o=new t.User;return o.set("uinfo",e),o.set("gminfo",GM_info),o.set("pnum",s.get("pnum")),o.loginWithAuthData({uid:""+e.uk},"baidu").then(e=>{const{createdAt:o,updatedAt:n}=e.toJSON();o===n&&(Object.assign(e.attributes,{expire_time:new Date(Date.now()+864e5).toISOString()}),e._handleSaveResult(!0));const{expire_time:a}=e.toJSON();return s.set(t._getAVPath(t.User._CURRENT_USER_KEY),btoa(encodeURIComponent(JSON.stringify(a)))),e})}))}function f(){const e=window.AV||unsafeWindow.AV;return e?(e.applicationId||e.init({appId:"sXXf4FFOZn2nFIj7LOFsqpLa-gzGzoHsz",appKey:"16s3qYecpVJXtVahasVxxq1V",serverURL:"https://sxxf4ffo.lc-cn-n1-shared.com"}),Promise.resolve(e)):Promise.reject(t.destroy())}function b(){h.show||n.update({name:"sponsor",html:'\n                                   <div style="padding: 5px;"><div>喜欢这个脚本吗</div><div>赞助后可使用所有增强功能</div></div>\n                                   <div style="padding: 5px;min-width: 280px;display: flex;flex-wrap: nowrap;">\n                                       <button id="open-afdian" style="padding: 5px; margin: 0 5px;border: none; border-radius: 3px; background: #09aaff; color: white; cursor: pointer;flex: 1 1 0;">打开爱发电</button>\n                                       <button id="copy-order" style="padding: 5px; margin: 0 5px;border: none; border-radius: 3px; background: #09aaff; color: white; cursor: pointer;flex: 1 1 0;">复制订单号</button>\n                                       <button id="update-script" style="padding: 5px; margin: 0 5px;border: none; border-radius: 3px; background: #09aaff; color: white; cursor: pointer;flex: 1 1 0;">检查更新</button>\n                                   </div>\n                                   <div style="padding: 5px"><input type="text" id="order-input" placeholder="输入爱发电订单号，体验更多功能" style="min-width: 250px;padding: 5px; border: none; border-radius: 3px;" autocomplete="off"></div>\n                                   <div style="border-top: 1px solid #c6c6c6;display: flex;flex-wrap: nowrap;">\n                                       <button id="cancel-order" style="padding: 5px; border: none; border-radius: 3px; background: #ff5555; color: white; cursor: pointer;flex: 1 1 0;">取消</button>\n                                       <button id="submit-order" style="padding: 5px; border: none; border-radius: 3px; background: #ffad00; color: white; cursor: pointer;flex: 1 1 0;">提交</button>\n                                   </div>\n                            ',tooltip:"感谢支持，赞助后不再提示",style:{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%, -50%)",background:"rgba(0, 0, 0, 0.7)",border:"1px solid #c6c6c6",borderRadius:"8px",textAlign:"center"},click:(e,o)=>{o.isTrusted||t.destroy(),t.mask.show=!1,t.loading.show=!1},mounted:e=>{t.pause(),o.stopLoad(),h.show=!0,setTimeout(()=>{t.mask.show=!1,t.loading.show=!1,t.controls.show=!1,t.setting.show=!1,t.constructor.CONTEXTMENU=!1},500);const n=i("#open-afdian",e),r=i("#copy-order",e),l=i("#update-script",e);t.proxy(n,"click",()=>{window.open("https://afdian.com/order/create?plan_id=dc4bcdfa5c0a11ed8ee452540025c377","_blank")}),t.proxy(r,"click",()=>{window.open("https://afdian.com/dashboard/order","_blank")}),t.proxy(l,"click",()=>{window.open("https://scriptcat.org/scripts/code/340/BD%E7%BD%91%E7%9B%98%E8%A7%86%E9%A2%91%E6%92%AD%E6%94%BE%E5%99%A8.user.js","_blank")});const c=i("#order-input",e),p=i("#cancel-order",e),u=i("#submit-order",e);t.proxy(p,"click",()=>{x()}),t.proxy(u,"click",()=>{if(c.value){const t=c.value.trim();if(t.match(/^202[\d]{22,25}$/)){if(t.match(/(\d)\1{7,}/g))return;!function(t){const e=s.get(t)||0;s.set(t,e+1),f().then(e=>m().then(o=>{const{authData:n,expire_time:a,shortId:r,username:i}=o.toJSON(),l=new(e.Object.extend("baidu"));l.set("ON",t),l.set("pnum",s.get(t));for(let[t,e]of Object.entries({authData:n,expire_time:a,shortId:r,username:i}))l.set(t,e);return l.save().then(n=>{Object.assign(o.attributes,{ON:t,check:3,expire_time:new Date(Date.now()+864e3).toISOString()});const{expire_time:a}=o.toJSON();return s.set(e._getAVPath(e.User._CURRENT_USER_KEY),btoa(encodeURIComponent(JSON.stringify(a)))),o._handleSaveResult(!0)})}))}(t),x()}else a.show="此订单号不合规范，请重试"}else a.show="请输入订单号"})}})}function x(){n.hasOwnProperty("sponsor")&&(o.startLoad(),h.show=!1,n.remove("sponsor"),t.constructor.CONTEXTMENU=r)}function y(){t.contextmenu.update({index:51,html:"更多功能",click:()=>{b(),t.contextmenu.show=!1}}),t.contextmenu.update({index:52,html:"鼓励一下",click:()=>{window.open("https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png","_blank"),t.contextmenu.show=!1}}),t.setting.update({html:"赞赏作者",name:"author-setting",tooltip:"",selector:[{html:"更多功能",value:0},{html:"鼓励一下",value:1}],onSelect:t=>(0===t.value?b():1===t.value&&window.open("https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png","_blank"),"")});let n=Number(s.get("pnum")||0);s.set("pnum",++n),t.on("video:ended",()=>{m().then(e=>{const{expire_time:o}=e.toJSON();Math.max(Date.parse(o)-Date.now(),0)||t.layers.update({name:"potser",html:'<img style="width: 300px" src="https://pc-index-skin.cdn.bcebos.com/6cb0bccb31e49dc0dba6336167be0a18.png">',tooltip:"",style:{position:"absolute",top:"50px",right:"50px"},click:(t,e)=>{window.open(e.target.src,"_blank")}})})}),o.on(e.Events.FRAG_LOADED,d((e,o)=>{m().then(e=>{t.emit("user",e.toJSON()),t.once("user",({expire_time:t})=>{Math.max(Date.parse(t)-Date.now(),0)?x():b()})})},1e3*p(420,t.duration/100,t.duration/3)))}return t.isReady?y():t.once("ready",y),{name:"user",userJSON:function(){return m().then(t=>t.toJSON())},show:b}},()=>t=>{const{i18n:e,option:o,notice:n,storage:a,controls:s,constructor:{utils:{isMobile:r,setStyle:i}}}=t;function l(t){return r?t.split(/\s/).shift():t}function c(){const a=o.quality,r=a.find(t=>t.default)||a[0];s.update({name:"quality",html:r?l(r.html):"",selector:a.map((t,e)=>({...t})),onSelect:o=>(t.switchQuality(o.url),n.show=`${e.get("Switch Video")}: ${o.html}`,l(o.html))})}function p(){c(),o.qualityid=o.id,t.on("restart",()=>{if(o.qualityid===o.id){const e=t.layers["auto-playback"];e&&i(e,"display","none")}else o.qualityid=o.id,c()})}return t.isReady?p():t.once("ready",p),{name:"quality"}},()=>t=>{const{i18n:e,option:o,controls:n,constructor:{utils:{isMobile:a}}}=t,s={showtext:!a,icon:'<i class="art-icon"><svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M810.666667 384H85.333333v85.333333h725.333334V384z m0-170.666667H85.333333v85.333334h725.333334v-85.333334zM85.333333 640h554.666667v-85.333333H85.333333v85.333333z m640-85.333333v256l213.333334-128-213.333334-128z" fill="#ffffff"></path></svg></i>'};function r(){t.once("user",({expire_time:t})=>{Math.max(Date.parse(t)-Date.now(),0)&&function(t=[]){t.length<=1?n.hasOwnProperty("playlist")&&n.remove("playlist"):n.update({html:s.showtext?e.get("PlayList"):s.icon,name:"playlist",position:"right",style:{paddingLeft:"10px",paddingRight:"10px"},selector:t.map((t,e)=>({...t,html:t.name,style:{textAlign:"left"}})),onSelect:t=>(o.file=t,"function"==typeof t.open&&t.open(),s.showtext?e.get("PlayList"):s.icon)})}(o.filelist)})}return e.update({"zh-cn":{PlayList:"播放列表"}}),t.isReady?r():t.once("ready",r),{name:"playlist"}},()=>t=>{const{i18n:e,icons:o,option:n,layers:a,storage:s,plugins:r,setting:i,contextmenu:l,constructor:{PLAYBACK_RATE:c,SETTING_ITEM_WIDTH:p,utils:{query:u,append:d,setStyle:h,inverseClass:m}}}=t;function g(){return a["auto-playbackrate"]||a.update({name:"auto-playbackrate",html:`<div>播放速度</div><input type="number" value="${t.playbackRate}" style="min-height: 20px;border: none; border-radius: 3px;text-align: center;" step=".01" max="16" min=".1"><div class="art-auto-playback-close"><i class="art-icon art-icon-close"><svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="22" height="22" style="fill: var(--art-theme);width: 15px;height: 15px;"><path d="m571.733 512 268.8-268.8c17.067-17.067 17.067-42.667 0-59.733-17.066-17.067-42.666-17.067-59.733 0L512 452.267l-268.8-268.8c-17.067-17.067-42.667-17.067-59.733 0-17.067 17.066-17.067 42.666 0 59.733l268.8 268.8-268.8 268.8c-17.067 17.067-17.067 42.667 0 59.733 8.533 8.534 19.2 12.8 29.866 12.8s21.334-4.266 29.867-12.8l268.8-268.8 268.8 268.8c8.533 8.534 19.2 12.8 29.867 12.8s21.333-4.266 29.866-12.8c17.067-17.066 17.067-42.666 0-59.733L571.733 512z"></path></svg></i></div>`,tooltip:"",style:{"border-radius":"var(--art-border-radius)",left:"var(--art-padding)",bottom:"calc(var(--art-control-height) + var(--art-bottom-gap) + 10px)","background-color":"var(--art-widget-background)","align-items":"center",gap:"10px",padding:"10px","line-height":1,display:"none",position:"absolute"},mounted:e=>{const o=u("input",e),n=u(".art-auto-playback-close",e);t.proxy(o,"change",()=>{const e=o.value;t.playbackRate=e}),t.proxy(n,"click",()=>{h(e,"display","none")})}})}function f(t){return 1===t?e.get("Normal"):t?t.toFixed(2):e.get("Custom")}function b(){return c.includes(t.playbackRate)?t.playbackRate:0}function x(){const t=i.find(`playback-rate-${b()}`);t&&i.check(t)}function y(){t.once("user",({expire_time:e})=>{if(Math.max(Date.parse(e)-Date.now(),0)){t.on("video:ratechange",()=>s.set("playbackRate",t.playbackRate));const e=s.get("playbackRate");e&&(t.playbackRate=Number(e))}else t.on("video:ratechange",()=>{b()||(t.playbackRate=1)})})}return e.update({"zh-cn":{Custom:"自定义"}}),c.unshift(0),i.update({width:p,name:"playback-rate",html:e.get("Play Speed"),tooltip:f(t.playbackRate),icon:o.playbackRate,selector:c.map(t=>({value:t,name:`playback-rate-${t}`,default:t===b(),html:f(t)})),onSelect(e){if(e.value)t.playbackRate=e.value,h(g(),"display","none");else{const{userJSON:e,show:o}=r.user;e().then(({expire_time:e})=>{Math.max(Date.parse(e)-Date.now(),0)?(u("input",g()).value=t.playbackRate,h(g(),"display","flex")):o()})}return e.html},mounted:()=>{x(),t.on("video:ratechange",()=>x())}}),l.update({index:10,name:"playbackRate",html:`${e.get("Play Speed")}: ${c.map(t=>`<span data-value="${t}">${f(t)}</span>`).join("")}`,click:(e,o)=>{e.show=!1;const{value:n}=o.target.dataset;if(Number(n))t.playbackRate=Number(n),h(g(),"display","none");else{const{userJSON:e,show:o}=r.user;e().then(({expire_time:e})=>{Math.max(Date.parse(e)-Date.now(),0)?(u("input",g()).value=t.playbackRate,h(g(),"display","flex")):o()})}},mounted:e=>{const o=u(`[data-value='${b()}']`,e);o&&m(o,"art-current"),t.on("video:ratechange",()=>{const t=u(`[data-value='${b()}']`,e);t&&m(t,"art-current")})}}),t.isReady?y():t.once("ready",y),{name:"playbackRate"}},()=>t=>{const{i18n:e,option:o,notice:n,storage:a,plugins:s,setting:r,controls:i,template:l,subtitle:c,contextmenu:p,constructor:{utils:{isMobile:u,append:d,query:h,inverseClass:m}}}=t,g={showtext:!u,icon:'<i class="art-icon"><svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 48 48"><path d="M0 0h48v48H0z" fill="none"/><path fill="#ffffff" d="M40 8H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zM8 24h8v4H8v-4zm20 12H8v-4h20v4zm12 0h-8v-4h8v4zm0-8H20v-4h20v4z"/></svg></i>',tooltip:'<label style="font-size: 0;padding: 4px;display: inline-block;"><span style="width: 20px;height: 20px;display: inline-block;border-radius: 50%;box-sizing: border-box;cursor: pointer;background: #FE9200;"></span></label>'};function f(t=[]){if(t.length<1)return;const e=t.find(t=>t.default)||t[0],a=Object.assign({},o.subtitle,{style:o.subtitle.style},e),{url:s,type:r}=a;Object.assign(o.subtitle,{url:s,type:r,escape:!1}),c.init({...a}).then(()=>{a.name&&(n.show=`加载字幕: ${a.name}`)}),i.update({html:g.showtext?"字幕列表":g.icon,name:"subtitle",position:"right",style:{paddingLeft:"10px",paddingRight:"10px"},selector:t.map((t,e)=>({...t})),onSelect:function(t,e){const{url:s,type:r}=t;return Object.assign(o.subtitle,{url:s,type:r}),c.switch(s,a).then(()=>{n.show=`切换字幕: ${t.name}`}),t.html}})}function b(){t.once("user",({expire_time:e})=>{if(Math.max(Date.parse(e)-Date.now(),0)){Object.assign(o.subtitle.style,{color:a.get("subtitle-color"),bottom:a.get("subtitle-bottom"),fontSize:a.get("subtitle-fontSize"),fontWeight:a.get("subtitle-fontWeight"),fontFamily:a.get("subtitle-fontFamily"),textShadow:a.get("subtitle-textShadow")}),t.on("subtitle",t=>a.set("subtitle",t));const e=a.get("subtitle");"boolean"==typeof e&&(c.show=e),(o.sublist||[]).length&&f(o.sublist),"function"==typeof o.getUrl&&function(){const{getUrl:t,adToken:e}=o,n=t("M3U8_SUBTITLE_SRT")+"&adToken="+encodeURIComponent(e);return fetch(n).then(function(t){return t.ok?t.text():Promise.reject()}).then(t=>(function(){var e=(t||"").split("\n"),o=[];try{for(var n=2;n<e.length;n+=2){var a=e[n]||"";if(-1!==a.indexOf("#EXT-X-MEDIA:")){for(var s=a.replace("#EXT-X-MEDIA:","").split(","),r={},i=0;i<s.length;i++){var l=s[i].split("=");r[(l[0]||"").toLowerCase().replace("-","_")]=String(l[1]).replace(/"/g,"")}r.url=e[n+1],o.push(r)}}}catch(t){}return o})().map(function(t){return{...t,type:"srt",html:t.name,default:"YES"===t.default}}))}().then(t=>{o.sublist=(o.sublist||[]).concat(t),f(o.sublist)}),o.subid=o.id,t.on("restart",()=>{if(o.subid===o.id){const t=i.cache.get("subtitle").option.selector;(t||[]).length&&f(t)}else if(o.subid=o.id,(o.sublist||[]).length)f(o.sublist);else{const{$subtitle:t}=l;t.innerHTML="",o.subtitle.url="",c.createTrack("metadata",""),i.hasOwnProperty("subtitle")&&i.remove("subtitle")}})}})}return r.add({html:"字幕设置",name:"subtitle-setting",tooltip:"",icon:'<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 48 48"><path d="M0 0h48v48H0z" fill="none"/><path fill="#ffffff" d="M40 8H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V12c0-2.21-1.79-4-4-4zM8 24h8v4H8v-4zm20 12H8v-4h20v4zm12 0h-8v-4h8v4zm0-8H20v-4h20v4z"/></svg>',selector:[{html:"显示",name:"subtitle",tooltip:"显示",switch:!0,onSwitch:t=>(t.tooltip=t.switch?"隐藏":"显示",c.show=!t.switch,!t.switch),mounted:(e,o)=>{const n=c.show;o.switch=n,o.tooltip=n?"显示":"隐藏",t.on("subtitle",t=>{setTimeout(()=>{o.switch!==t&&(o.switch=t,o.tooltip=t?"显示":"隐藏")})})}},{html:"字幕偏移",name:"subtitle-offset",tooltip:"0s",range:[0,-10,10,.1],onChange(e){const o=e.range[0];return t.subtitleOffset=o,o+"s"},mounted:(e,o)=>{t.on("subtitleOffset",t=>{setTimeout(()=>{o.$range.value=t,o.tooltip=t+"s"})})}},{html:"字幕位置",name:"subtitle-bottom",tooltip:"5%",range:[5,1,90,1],onChange(t){const e=t.range[0]+"%";return c.style({bottom:e}),a.set("subtitle-bottom",e),e},mounted:(t,e)=>{const o=a.get("subtitle-bottom");o&&(e.tooltip=o,e.$range.value=parseFloat(o))}},{html:"字体大小",name:"subtitle-fontSize",tooltip:"25px",range:[25,10,60,1],onChange(t){const e=t.range[0]+"px";return c.style({fontSize:e}),a.set("subtitle-fontSize",e),e},mounted:(t,e)=>{const o=a.get("subtitle-fontSize");o&&(e.tooltip=o,e.$range.value=parseFloat(o))}},{html:"字体粗细",name:"subtitle-fontWeight",tooltip:400,range:[400,100,900,100],onChange(t){const e=t.range[0];return a.set("subtitle-fontWeight",e),c.style({fontWeight:e}),e},mounted:(t,e)=>{const o=a.get("subtitle-fontWeight");o&&(e.tooltip=o,e.$range.value=o)}},{html:"字体颜色",name:"subtitle-color",tooltip:g.tooltip,selector:[{html:"预设",name:"color-presets",tooltip:'<style>.panel-setting-color label{font-size: 0;padding: 4px;display: inline-block;}.panel-setting-color input{display: none;}.panel-setting-color span{width: 22px;height: 22px;display: inline-block;border-radius: 50%;box-sizing: border-box;cursor: pointer;}</style><div class="panel-setting-color"><label><input type="radio" value="#fff"><span style="background: #fff;"></span></label><label><input type="radio" value="#e54256"><span style="background: #e54256"></span></label><label><input type="radio" value="#ffe133"><span style="background: #ffe133"></span></label><label><input type="radio" name="dplayer-danmaku-color-1" value="#64DD17"><span style="background: #64DD17"></span></label><label><input type="radio" value="#39ccff"><span style="background: #39ccff"></span></label><label><input type="radio" value="#D500F9"><span style="background: #D500F9"></span></label></div>'},{html:"默认颜色",name:"color-default",tooltip:g.tooltip},{html:"颜色选择器",name:"color-picker",tooltip:g.tooltip.replace("#FE9200","#000")}],onSelect:function(t,e,o){switch(t.name){case"color-presets":if("INPUT"===o.target.nodeName){const t=o.target.value;c.style({color:t}),a.set("subtitle-color",t)}break;case"color-default":c.style({color:"#FE9200"}),a.set("subtitle-color","#FE9200");break;case"color-picker":l.$colorPicker||(l.$colorPicker=d(l.$player,'<input hidden type="color">'),l.$colorPicker.oninput=(e=>{const o=e.target.value;c.style({color:o}),a.set("subtitle-color",o),t.tooltip=t.$parent.tooltip=g.tooltip.replace("#FE9200",o)})),l.$colorPicker.click()}return g.tooltip.replace("#FE9200",l.$subtitle.style.color)},mounted:(t,e)=>{const o=a.get("subtitle-color");o&&(e.tooltip=g.tooltip.replace("#FE9200",o))}},{html:"字体类型",name:"subtitle-fontFamily",tooltip:e.get("Default"),selector:[{html:"默认",text:""},{html:"等宽 衬线",value:'"Courier New", Courier, "Nimbus Mono L", "Cutive Mono", monospace'},{html:"比例 衬线",value:'"Times New Roman", Times, Georgia, Cambria, "PT Serif Caption", serif'},{html:"等宽 无衬线",value:'"Deja Vu Sans Mono", "Lucida Console", Monaco, Consolas, "PT Mono", monospace'},{html:"比例 无衬线",value:'"YouTube Noto", Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif'},{html:"Casual",value:'"Comic Sans MS", Impact, Handlee, fantasy'},{html:"Cursive",value:'"Monotype Corsiva", "URW Chancery L", "Apple Chancery", "Dancing Script", cursive'},{html:"Small Capitals",value:'"Arial Unicode Ms", Arial, Helvetica, Verdana, "Marcellus SC", sans-serif'}],onSelect:function(t,e,o){return a.set("subtitle-fontFamily",t.html),c.style({fontFamily:t.value}),t.html},mounted:(t,e)=>{const o=a.get("subtitle-fontFamily");o&&(e.tooltip=o)}},{html:"描边样式",name:"subtitle-textShadow",tooltip:e.get("Default"),selector:[{html:"默认",value:"rgb(0 0 0) 1px 0 1px, rgb(0 0 0) 0 1px 1px, rgb(0 0 0) -1px 0 1px, rgb(0 0 0) 0 -1px 1px, rgb(0 0 0) 1px 1px 1px, rgb(0 0 0) -1px -1px 1px, rgb(0 0 0) 1px -1px 1px, rgb(0 0 0) -1px 1px 1px"},{html:"重墨",value:"rgb(0, 0, 0) 1px 0px 1px, rgb(0, 0, 0) 0px 1px 1px, rgb(0, 0, 0) 0px -1px 1px, rgb(0, 0, 0) -1px 0px 1px"},{html:"描边",value:"rgb(0, 0, 0) 0px 0px 1px, rgb(0, 0, 0) 0px 0px 1px, rgb(0, 0, 0) 0px 0px 1px"},{html:"45°投影",value:"rgb(0, 0, 0) 1px 1px 2px, rgb(0, 0, 0) 0px 0px 1px"},{html:"阴影",value:"rgb(34, 34, 34) 1px 1px 1.4875px, rgb(34, 34, 34) 1px 1px 1.98333px, rgb(34, 34, 34) 1px 1px 2.47917px"},{html:"凸起",value:"rgb(34, 34, 34) 1px 1px"},{html:"下沉",value:"rgb(204, 204, 204) 1px 1px, rgb(34, 34, 34) -1px -1px"},{html:"边框",value:"rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px, rgb(34, 34, 34) 0px 0px 1px"}],onSelect:function(t,e,o){return a.set("subtitle-textShadow",t.html),c.style({textShadow:t.value}),t.html},mounted:(t,e)=>{const o=a.get("subtitle-textShadow");o&&(e.tooltip=o)}},{name:"subtitle-load",html:"加载字幕",selector:[{html:"本地文件",name:"file"}],onSelect:function(t,e,n){const{userJSON:a,show:r}=s.user;return a().then(({expire_time:e})=>{Math.max(Date.parse(e)-Date.now(),0)?"file"===t.name&&(l.$subtitleLocalFile||(l.$subtitleLocalFile=d(l.$container,'<input class="subtitleLocalFile" type="file" accept="webvtt,.vtt,.srt,.ssa,.ass" style="display: none;">')),function(t){return t.click(),new Promise(function(e,o){t.onchange=(t=>{if(t.target.files.length){const o=t.target.files[0],n=o.name.split(".").pop().toLowerCase();(function(t){return function(t){return new Promise((e,o)=>{var n=new FileReader;n.readAsText(t,"UTF-8"),n.onload=function(o){var a=n.result;return a.indexOf("�")>-1&&!n.markGBK?(n.markGBK=!0,n.readAsText(t,"GBK")):a.indexOf("")>-1&&!n.markBIG5?(n.markBIG5=!0,n.readAsText(t,"BIG5")):void e(a)},n.onerror=function(t){o(t)}})}(t).then(t=>(function(t){const e=new Blob([t],{type:"text/plain"});return URL.createObjectURL(e)})(t))})(o).then(t=>{const a={url:t,type:n,name:o.name,html:`本地字幕「${n}」`};e(a)})}t.target.value=""})})}(l.$subtitleLocalFile).then(t=>{o.sublist=(o.sublist||[]).concat([t]),f(o.sublist)})):r()}),""}}]}),p.update({name:"subtitle",index:31,html:`字幕显示: ${[1,0].map(t=>`<span data-value="${t}">${t?"显示":"隐藏"}</span>`).join("")}`,click:(t,e)=>{m(e.target,"art-current");const{value:o}=e.target.dataset;c.show=Boolean(Number(o)),t.show=!1},mounted:e=>{const o=h(`[data-value='${Number(c.show)}']`,e);o&&m(o,"art-current"),t.on("subtitle",t=>{const o=h(`[data-value='${Number(t)}']`,e);o&&m(o,"art-current")})}}),t.isReady?b():t.once("ready",b),{name:"subtitle"}},()=>t=>{const{notice:e,storage:o,plugins:n,setting:a}=t;function s(){t.once("user",({expire_time:e})=>{Math.max(Date.parse(e)-Date.now(),0)&&function(){const e=window.Joysound||unsafeWindow.Joysound;e&&e.isSupport()&&(t.joySound=t.joySound||new e,t.joySound.hasSource()||t.joySound.init(t.template.$video),o.get("joysound")&&t.joySound.setEnabled(!0))}()})}return a.add({html:"声音设置",name:"joysound",tooltip:"",selector:[{html:"音质增强",name:"high",tooltip:"关闭",switch:!1,onSwitch:a=>{const s=a.switch;a.tooltip=s?"关闭":"开启";const{userJSON:r,show:i}=n.user;return r().then(({expire_time:n})=>{Math.max(Date.parse(n)-Date.now(),0)?(o.set("joysound",!s),t.joySound&&t.joySound.setEnabled(!s),e.show=`音质增强: ${s?"关闭":"开启"}`):i()}),!s},mounted:(t,e)=>{o.get("joysound")&&(e.tooltip="增强",e.switch=!0)}},{html:"音量增强",name:"volume",tooltip:"0x",range:[0,0,10,.1],onRange:o=>{const a=o.range[0]/10,{userJSON:s,show:r}=n.user;return s().then(({expire_time:o})=>{Math.max(Date.parse(o)-Date.now(),0)?(t.joySound&&t.joySound.setVolume(a),e.show=`音量增强: ${100+100*a}%`):r()}),`${Math.round(100*o.range[0])/100}x`}}]}),t.playing?s():t.once("video:playing",s),{name:"sound"}},()=>t=>{const{notice:e,storage:o,plugins:n,setting:a,template:{$video:{style:s}}}=t;function r(){t.once("user",({expire_time:t})=>{if(Math.max(Date.parse(t)-Date.now(),0)){const{saturate:t=1,brightness:e=1,contrast:n=1}=o.get("filter")||{};s.filter=`saturate(${t}) brightness(${e}) contrast(${n})`}})}return a.update({html:"色彩滤镜",name:"filter",tooltip:"",selector:[{html:"饱和度",name:"saturate",tooltip:100,range:[100,0,255,1],onRange:t=>{const a=t.range[0],{userJSON:r,show:i}=n.user;return r().then(({expire_time:t})=>{if(Math.max(Date.parse(t)-Date.now(),0)){e.show=`饱和度: ${a}`,o.set("filter",{...o.get("filter"),saturate:a/100});const{saturate:t=1,brightness:n=1,contrast:r=1}=o.get("filter")||{};s.filter=`saturate(${t}) brightness(${n}) contrast(${r})`}else i()}),a},mounted:(t,e)=>{const{saturate:n=1}=o.get("filter")||{};e.$range.value=100*n,e.tooltip=100*n}},{html:"亮度",name:"brightness",tooltip:100,range:[100,0,255,1],onRange:t=>{const a=t.range[0],{userJSON:r,show:i}=n.user;return r().then(({expire_time:t})=>{if(Math.max(Date.parse(t)-Date.now(),0)){e.show=`亮度: ${a}`,o.set("filter",{...o.get("filter"),brightness:a/100});const{saturate:t=1,brightness:n=1,contrast:r=1}=o.get("filter")||{};s.filter=`saturate(${t}) brightness(${n}) contrast(${r})`}else i()}),a},mounted:(t,e)=>{const{brightness:n=1}=o.get("filter")||{};e.$range.value=100*n,e.tooltip=100*n}},{html:"对比度",name:"contrast",tooltip:100,range:[100,0,255,1],onRange:t=>{const a=t.range[0],{userJSON:r,show:i}=n.user;return r().then(({expire_time:t})=>{if(Math.max(Date.parse(t)-Date.now(),0)){e.show=`对比度: ${a}`,o.set("filter",{...o.get("filter"),contrast:a/100});const{saturate:t=1,brightness:n=1,contrast:r=1}=o.get("filter")||{};s.filter=`saturate(${t}) brightness(${n}) contrast(${r})`}else i()}),a},mounted:(t,e)=>{const{contrast:n=1}=o.get("filter")||{};e.$range.value=100*n,e.tooltip=100*n}},{html:"预设「1」",name:"filter-presets",tooltip:""},{html:"默认",name:"filter-default",tooltip:""}],onSelect:(t,e,r)=>{const{userJSON:i,show:l}=n.user;return i().then(({expire_time:e})=>{if(Math.max(Date.parse(e)-Date.now(),0)){const e=a.find("saturate"),n=a.find("brightness"),r=a.find("contrast");"filter-presets"===t.name?(e.tooltip=110,e.$range.value=110,n.tooltip=105,n.$range.value=105,r.tooltip=101,r.$range.value=101,o.set("filter",{saturate:1.1,brightness:1.05,contrast:1.01}),s.filter="saturate(1.1) brightness(1.05) contrast(1.01)"):"filter-default"===t.name&&(e.tooltip=100,e.$range.value=100,n.tooltip=100,n.$range.value=100,r.tooltip=100,r.$range.value=100,o.set("filter",{saturate:1,brightness:1,contrast:1}),s.filter="")}else l()}),t.html}}),t.isReady?r():t.once("ready",r),{name:"imagefilter"}},()=>t=>{const{i18n:e,notice:o,storage:n,plugins:a,setting:s,controls:r,constructor:{utils:{throttle:i}}}=t;function l(){t.once("user",({expire_time:e})=>{Math.max(Date.parse(e)-Date.now(),0)&&(n.get("auto-fullscreen")&&(t.fullscreenWeb=!0),t.startTime=n.get("startTime"),t.endTime=n.get("endTime"),t.on("video:timeupdate",i(()=>{const{currentTime:e,duration:o,startTime:n,endTime:a}=t;if(n||a){const s=[[0,n||0],[a?o-a:0,a?o:0]];for(const[o,n]of s)if(e>=o&&e<n){t.seek=n;break}}},1e3)),t.on("video:ended",()=>{if(n.get("auto-next")&&r.hasOwnProperty("playlist")){const t=r.cache.get("playlist").option.selector,e=t[t.findIndex(t=>t.default)+1];e?e.$control_item.click():o.show="没有下一集了"}}))})}return s.update({html:"播放设置",name:"play-setting",tooltip:"",selector:[{html:"自动下一集",name:"auto-next",icon:"",tooltip:"关闭",switch:!1,onSwitch:t=>{const e=t.switch;t.tooltip=e?"关闭":"开启";const{userJSON:s,show:r}=a.user;return s().then(({expire_time:t})=>{Math.max(Date.parse(t)-Date.now(),0)?(n.set("auto-next",!e),o.show=`自动下一集: ${e?"关闭":"开启"}`):r()}),!e},mounted:(t,e)=>{n.get("auto-next")&&(e.tooltip="开启",e.switch=!0)}},{html:"自动全屏",name:"auto-fullscreen",icon:"",tooltip:"关闭",switch:!1,onSwitch:e=>{const s=e.switch;e.tooltip=s?"关闭":"开启";const{userJSON:r,show:i}=a.user;return r().then(({expire_time:e})=>{Math.max(Date.parse(e)-Date.now(),0)?(t.fullscreenWeb=!s,n.set("auto-fullscreen",!s),o.show=`自动全屏: ${s?"关闭":"开启"}`):i()}),!s},mounted:(t,e)=>{n.get("auto-fullscreen")&&(e.tooltip="开启",e.switch=!0)}},{html:"跳过片头",tooltip:"0s",range:[0,0,120,1],onChange(e){const s=e.range[0],{userJSON:r,show:i}=a.user;return r().then(({expire_time:e})=>{Math.max(Date.parse(e)-Date.now(),0)?(t.startTime=s,n.set("startTime",s),o.show=`跳过片头: ${s} 秒`):i()}),s+"s"},mounted:(t,e)=>{const o=n.get("startTime");o&&(e.range=[o,0,120,1],e.tooltip=o+"s")}},{html:"跳过片尾",tooltip:"0s",range:[0,0,120,1],onChange(e){const s=e.range[0],{userJSON:r,show:i}=a.user;return r().then(({expire_time:e})=>{Math.max(Date.parse(e)-Date.now(),0)?(t.endTime=s,n.set("endTime",s),o.show=`跳过片尾: ${s} 秒`):i()}),s+"s"},mounted:(t,e)=>{const o=n.get("endTime");o&&(e.range=[o,0,120,1],e.tooltip=o+"s")}}]}),t.isReady?l():t.once("ready",l),{name:"play"}}]);
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
