window.alipanThirdParty = window.alipanThirdParty || (function () {
    (function(pushState) {
        history.pushState = function (state, unused, url) {
            if (url.indexOf("/membership") > 0) {
                location.href = location.protocol + "//" + location.host + "/cpx/member?userCode=MjAxOTcy&disableNav=YES&skuCode=thirdParty&customExtra=byScript001"
            }
            pushState.apply(this, arguments);
        };
    })(history.pushState);

    var domain_name = 'https://openapi.alipan.com';
    var client_id = '10bb67a9549846038fcbdc348477f59d';
    var code_challenge = function (arr) {
        var text = "";
        for (var i = 0; i < arr.length; i++) {
            text += arr[i].toString(32);
        }
        return text;
    }(window.crypto.getRandomValues(new Uint8Array(32)));
    var obj = {
        version: '1.0.2',
        vipInfo: {},
    };

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

    function getItem(n) {
        n = localStorage.getItem(n);
        if (!n) return null;
        try {
            return JSON.parse(n);
        } catch (e) {
            return n;
        }
    }

    function setItem(n, t) {
        n && t != undefined && localStorage.setItem(n, t instanceof Object ? JSON.stringify(t) : t);
    }

    function tokenExpires(token) {
        token = token || {};
        var t = token.expire_time, i = Number(token.expires_in), e = Date.parse(t) - Date.now();
        if (0 < e && e < 1e3 * i) return !0;
        return !1;
    }

    function authorize() {
        const { token_type, access_token } = getItem("token");
        return ajax("https://open.aliyundrive.com/oauth/users/authorize?client_id=" + client_id + "&redirect_uri=oob&scope=user:base,file:all:read,file:all:write&code_challenge=" + code_challenge + "&code_challenge_method=plain", {
            data: JSON.stringify({
                authorize: 1,
                drives: ["backup", "resource"],
                scope: "user:base,file:all:read,file:all:write"
            }),
            headers: {
                "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                "content-type": "application/json;charset=UTF-8"
            },
            method: "POST"
        }).then((response) => {
            if (response && response.redirectUri) {
                const code = response.redirectUri.split("=")[1];
                setItem("openToken", { code, code_verifier: code_challenge });
                return code;
            }
            return Promise.reject();
        });
    }

    function access_token() {
        const { code, code_verifier } = getItem("openToken") || {};
        return ajax(domain_name + "/oauth/access_token", {
            body: JSON.stringify({
                client_id: client_id,
                code: code,
                code_verifier: code_verifier,
                grant_type: "authorization_code"
            }),
            headers: {
                "content-type": "application/json;charset=UTF-8"
            },
            method: "POST"
        }).then((response) => {
            setItem("openToken", Object.assign(response, { expire_time: new Date(Date.now() + 1e3 * response.expires_in - 6e5).toISOString() }));
            return response;
        });
    }

    obj.init = function () {
        const openToken = getItem("openToken");
        if (tokenExpires(openToken)) {
            return Promise.resolve();
        }
        return authorize().then(() => {
            return access_token();
        });
    };

    obj.getUsersInfo = function () {
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/oauth/users/info", {
                data: null,
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "GET"
            });
        });
    };

    obj.getDriveInfo = function () {
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/adrive/v1.0/user/getDriveInfo", {
                data: null,
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "POST"
            });
        });
    };

    obj.getSpaceInfo = function () {
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/adrive/v1.0/user/getSpaceInfo", {
                data: null,
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "POST"
            });
        });
    };

    obj.getVipInfo = function () {
        if (Object.keys(obj.vipInfo).length) {
            return Promise.resolve(obj.vipInfo);
        }
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/business/v1.0/user/getVipInfo", {
                data: null,
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "POST"
            }).then((response) => {
                Object.assign(obj.vipInfo, response);
                return response;
            });
        });
    };

    obj.getUsersScopes = function () {
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/oauth/users/scopes", {
                data: null,
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "GET"
            });
        });
    };

    obj.featureList = function () {
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/business/v1.0/vip/feature/list", {
                data: null,
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "GET"
            });
        });
    };

    obj.featureTrial = function (featureCode) {
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/business/v1.0/vip/feature/trial", {
                data: JSON.stringify({
                    featureCode: featureCode || "hd.1080p|hd.1080p.plus"
                }),
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "POST"
            });
        });
    };

    obj.getVideoPreviewPlayInfo = function (drive_id, file_id) {
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/adrive/v1.0/openFile/getVideoPreviewPlayInfo", {
                data: JSON.stringify({
                    drive_id: drive_id,
                    file_id: file_id,
                    category: "live_transcoding",
                    template_id: "",
                    get_subtitle_info: !0,
                    url_expire_sec: 14400,
                    with_play_cursor: !0
                }),
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "POST"
            });
        });
    };

    obj.delete = function (drive_id, file_id) {
        return obj.init().then(() => {
            const { token_type, access_token } = getItem("openToken") || {};
            return ajax(domain_name + "/adrive/v1.0/openFile/delete", {
                data: JSON.stringify({
                    drive_id: drive_id,
                    file_id: file_id
                }),
                headers: {
                    "authorization": "".concat(token_type || "", " ").concat(access_token || ""),
                    "content-type": "application/json;charset=UTF-8"
                },
                method: "POST"
            });
        });
    };

    obj.delay = function (ms = 500) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    return (obj.getVipInfo(), obj);
})();
