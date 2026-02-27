// ==UserScript==
// @name         夸克网盘-抠逼嗖子播放器
// @namespace    https://scriptcat.org/zh-CN/users/13895
// @version      0.1.0
// @description  抠逼嗖子，连音频都不给听
// @author       You
// @match        https://pan.quark.cn/list*
// @icon         https://pan.quark.cn/favicon.ico
// @connect      kugou.com
// @require      https://scriptcat.org/lib/1359/^1.1.3/piplyric.js
// @require      https://scriptcat.org/lib/3746/^1.1.1/audioPlayer.js
// @require      https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.js
// @resource     aplayerCSS https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.css
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// ==/UserScript==

(function() {
    'use strict';

    var obj = {
        audio_page: {
            addStyle: false
        }
    };

    obj.initAudioPage = function () {
        const { file } = unsafeWindow.store.getState();
        const { listType } = file;
        const { loading, list } = file[listType];
        if (loading) {
            setTimeout(obj.initAudioPage, 500);
            return;
        }

        if (!(Array.isArray(list) && list.length)) return;

        const audioNode = document.querySelector('.audio-play-btn');
        const audioSome = list.some(({ category }) => category === 2);
        if (!audioSome) {
            audioNode && audioNode.remove();
            return;
        }

        if (audioNode) return;

        if (!obj.audio_page.addStyle) {
            obj.audio_page.addStyle = true;
            GM_addStyle(GM_getResourceText('aplayerCSS'));
        }

        const parentNode = document.querySelector('.btn-main');
        if (parentNode) {
            const newBtn = document.createElement('button');
            newBtn.type = 'button';
            newBtn.className = 'ant-btn btn-file btn-create-folder audio-play-btn';
            newBtn.title = '播放音频';
            newBtn.innerHTML = `
                    <i class="anticon" style="font-size: 16px;">
                        <svg width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
                            <use xlink:href="#qkdrive-music"></use>
                        </svg>
                    </i>
                    <span>播放音频</span>
                `;

            parentNode.append(newBtn);
            newBtn.addEventListener('click', () => {
                if (document.getElementById('aplayer')) {
                    return;
                }
                obj.initAudioPlayer();
            });
        }
    };

    obj.initAudioPlayer = function () {
        let container = document.getElementById('aplayer');
        if (!container) {
            container = document.createElement('div');
            container.setAttribute('id', 'aplayer');
            container.setAttribute('style', 'background-color: #fafdff;position: fixed;z-index: 9999;width: 440px;bottom: 0;left: 0px;box-shadow: 0 0 10px #ccc;border-top-left-radius: 4px;border-top-right-radius: 4px;border: 1px solid #dedede;');
            Node.prototype.appendChild.call(document.body, container);
        }

        const { file } = unsafeWindow.store.getState();
        const { listType } = file;
        const { list } = file[listType];
        const audiolist = list.filter(({ category }) => category === 2);
        const audio = audiolist.map(file => {
            const { duration, fid, file_name, share_fid_token, size } = file;
            return {
                artist: '',
                cover: '//image.quark.cn/s/uae/g/3o/broccoli/resource/202501/835e41f0-c8f5-11ef-98f3-674d066e29a6.png',
                duration,
                id: fid,
                name: file_name,
                type: 'normal',
                url: '',
                fid,
                share_fid_token,
                size
            };
        });
        const options = {
            audio,
            container,
            getUrl: (file) => obj.getDownloadInfo([ file ]).then(([{ download_url }]) => download_url),
        };

        window.audioPlayer(options);
    };

    obj.getDownloadInfo = function (filelist) {
        const fids = filelist.map(({ fid }) => fid);
        const { getDownloadInfo } = unsafeWindow.store.dispatch.file;
        return getDownloadInfo(fids).then(({ code, data }) => code === 0 ? data : Promise.reject({ code, data }));
    };

    obj.run = function () {
        const url = location.href;
        if (url.indexOf('pan.quark.cn/s/') > 0) {
        }
        else if (url.indexOf('pan.quark.cn/list') > 0) {
            obj.initAudioPage();
            window.onhashchange = () => setTimeout(obj.initAudioPage, 500);
        }
    }();

    console.log("=== 夸克网盘 好棒棒！===");

    // Your code here...
})();
