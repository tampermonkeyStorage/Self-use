!function(n, t) {
    console.log("\n %c PipLyric v0.0.1 %c https://scriptcat.org/zh-CN/users/13895 \n", "color: #fadfa3; background: #030307; padding:5px 0;", "background: #fadfa3; padding:5px 0;");
    "object" == typeof window ? (n = window).PipLyric = t() : (n = "undefined" != typeof globalThis ? globalThis : n || self).PipLyric = t()
}(this, (function() {
    "use strict";

    function n(n, t) {
        return function(n) {
            if (Array.isArray(n))
                return n
        }(n) || function(n, t) {
            var e = null == n ? null : "undefined" != typeof Symbol && n[Symbol.iterator] || n["@@iterator"];
            if (null != e) {
                var r, a, i, o, l = [],
                    c = !0,
                    u = !1;
                try {
                    if (i = (e = e.call(n)).next,
                        0 === t) {
                        if (Object(e) !== e)
                            return;
                        c = !1
                    } else
                        for (; !(c = (r = i.call(e)).done) && (l.push(r.value),
                                                               l.length !== t); c = !0)
                            ;
                } catch (n) {
                    u = !0,
                        a = n
                } finally {
                    try {
                        if (!c && null != e.return && (o = e.return(),
                                                       Object(o) !== o))
                            return
                    } finally {
                        if (u)
                            throw a
                    }
                }
                return l
            }
        }(n, t) || e(n, t) || function() {
            throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
        }()
    }

    function t(n) {
        return function(n) {
            if (Array.isArray(n))
                return r(n)
        }(n) || function(n) {
            if ("undefined" != typeof Symbol && null != n[Symbol.iterator] || null != n["@@iterator"])
                return Array.from(n)
        }(n) || e(n) || function() {
            throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
        }()
    }

    function e(n, t) {
        if (n) {
            if ("string" == typeof n)
                return r(n, t);
            var e = Object.prototype.toString.call(n).slice(8, -1);
            return "Object" === e && n.constructor && (e = n.constructor.name),
                "Map" === e || "Set" === e ? Array.from(n) : "Arguments" === e || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(e) ? r(n, t) : void 0
        }
    }

    function r(n, t) {
        (null == t || t > n.length) && (t = n.length);
        for (var e = 0, r = new Array(t); e < t; e++)
            r[e] = n[e];
        return r
    }

    function a(n, t, e) {
        var r = void 0 === t ? null : t,
            a = function(n, t) {
                var e = atob(n);
                if (t) {
                    for (var r = new Uint8Array(e.length), a = 0, i = e.length; a < i; ++a)
                        r[a] = e.charCodeAt(a);
                    return String.fromCharCode.apply(null, new Uint16Array(r.buffer))
                }
                return e
            }(n, void 0 !== e && e),
            i = a.indexOf("\n", 10) + 1,
            o = a.substring(i) + (r ? "//# sourceMappingURL=" + r : ""),
            l = new Blob([o], {
                type: "application/javascript"
            });
        return URL.createObjectURL(l)
    }
    var i, o, l, c, u = (i = "Lyogcm9sbHVwLXBsdWdpbi13ZWItd29ya2VyLWxvYWRlciAqLwohZnVuY3Rpb24oKXsidXNlIHN0cmljdCI7ZnVuY3Rpb24gdCh0LGUpe3JldHVybiBmdW5jdGlvbih0KXtpZihBcnJheS5pc0FycmF5KHQpKXJldHVybiB0fSh0KXx8ZnVuY3Rpb24odCxuKXt2YXIgZT1udWxsPT10P251bGw6InVuZGVmaW5lZCIhPXR5cGVvZiBTeW1ib2wmJnRbU3ltYm9sLml0ZXJhdG9yXXx8dFsiQEBpdGVyYXRvciJdO2lmKG51bGwhPWUpe3ZhciByLGEsbyxpLHU9W10sZj0hMCxjPSExO3RyeXtpZihvPShlPWUuY2FsbCh0KSkubmV4dCwwPT09bil7aWYoT2JqZWN0KGUpIT09ZSlyZXR1cm47Zj0hMX1lbHNlIGZvcig7IShmPShyPW8uY2FsbChlKSkuZG9uZSkmJih1LnB1c2goci52YWx1ZSksdS5sZW5ndGghPT1uKTtmPSEwKTt9Y2F0Y2godCl7Yz0hMCxhPXR9ZmluYWxseXt0cnl7aWYoIWYmJm51bGwhPWUucmV0dXJuJiYoaT1lLnJldHVybigpLE9iamVjdChpKSE9PWkpKXJldHVybn1maW5hbGx5e2lmKGMpdGhyb3cgYX19cmV0dXJuIHV9fSh0LGUpfHxmdW5jdGlvbih0LGUpe2lmKCF0KXJldHVybjtpZigic3RyaW5nIj09dHlwZW9mIHQpcmV0dXJuIG4odCxlKTt2YXIgcj1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodCkuc2xpY2UoOCwtMSk7Ik9iamVjdCI9PT1yJiZ0LmNvbnN0cnVjdG9yJiYocj10LmNvbnN0cnVjdG9yLm5hbWUpO2lmKCJNYXAiPT09cnx8IlNldCI9PT1yKXJldHVybiBBcnJheS5mcm9tKHQpO2lmKCJBcmd1bWVudHMiPT09cnx8L14oPzpVaXxJKW50KD86OHwxNnwzMikoPzpDbGFtcGVkKT9BcnJheSQvLnRlc3QocikpcmV0dXJuIG4odCxlKX0odCxlKXx8ZnVuY3Rpb24oKXt0aHJvdyBuZXcgVHlwZUVycm9yKCJJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlLlxuSW4gb3JkZXIgdG8gYmUgaXRlcmFibGUsIG5vbi1hcnJheSBvYmplY3RzIG11c3QgaGF2ZSBhIFtTeW1ib2wuaXRlcmF0b3JdKCkgbWV0aG9kLiIpfSgpfWZ1bmN0aW9uIG4odCxuKXsobnVsbD09bnx8bj50Lmxlbmd0aCkmJihuPXQubGVuZ3RoKTtmb3IodmFyIGU9MCxyPW5ldyBBcnJheShuKTtlPG47ZSsrKXJbZV09dFtlXTtyZXR1cm4gcn12YXIgZT0oc2VsZi5uYXZpZ2F0b3J8fHt9KS51c2VyQWdlbnQscj1mdW5jdGlvbih0KXtyZXR1cm4gcGFyc2VJbnQoKG5ldyBSZWdFeHAodCsiLyhbMC05XSspLiIpLmV4ZWMoZSl8fFtdKVsxXSwxMCl9LGE9IShyKCJDaHJvbWUiKXx8cigiQ2hyb21pdW0iKSkmJnIoIlNhZmFyaSIpJiZyKCJWZXJzaW9uIiksbz1mdW5jdGlvbigpe2lmKCJ1bmRlZmluZWQiPT10eXBlb2Ygd2luZG93KXJldHVybigoc2VsZi5uYW1lfHwiIikubWF0Y2goL1s/Jl1yYXRpbz0oW14mJF0rKS8pfHxbXSlbMV07dmFyIHQ9KHdpbmRvdy5zY3JlZW58fHt9KS5oZWlnaHR8fDEwODAsbj0od2luZG93LnNjcmVlbnx8e30pLmF2YWlsSGVpZ2h0fHwxMDQwLGU9d2luZG93LmRldmljZVBpeGVsUmF0aW98fDE7cmV0dXJuIE1hdGgucm91bmQoKGE/dDpuKS8yKSsiLzQ4MCoiK2V9KCksaT0xLHU9ZXZhbDt0cnl7aT11KG8pfWNhdGNoKHQpe312YXIgZj1mdW5jdGlvbih0LG4pe3ZhciBlPXQqaSxyPU1hdGgucm91bmQoZSk7aWYoIW4pcmV0dXJuIHI7dmFyIGE9TWF0aC5mbG9vcihlKSxvPWE9PT1lP2UrMTpNYXRoLmNlaWwoZSk7cmV0dXJuIGElMj9vOmF9LGM9ZigzNzUsITApLGw9ZigyNiwhMCkscz1sLzIsaD0xMipsK3MsZD0oYy1jKS8yLHY9NSpsLGc9di9oLG09LjQscD1mdW5jdGlvbih0KXt2YXIgbjtpZih0fHwidW5kZWZpbmVkIj09dHlwZW9mIGRvY3VtZW50KXRyeXtuPW5ldyBPZmZzY3JlZW5DYW52YXMoMCwwKS5nZXRDb250ZXh0KCIyZCIpfWNhdGNoKHQpe31pZihuKXJldHVybiBuO3RyeXtuPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoImNhbnZhcyIpLmdldENvbnRleHQoIjJkIil9Y2F0Y2godCl7fWlmKG4pcmV0dXJuIG47dGhyb3cgbmV3IEVycm9yKCJDcmVhdGVDb250ZXh0RXJyb3IiKX0sdz1mdW5jdGlvbih0KXtyZXR1cm4gQXJyYXkuaXNBcnJheSh0KT90OltdfTsidW5kZWZpbmVkIiE9dHlwZW9mIHdpbmRvdyYmZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5mb250RmFtaWx5O3ZhciB5LGI9TWF0aC5zaW4sTT1NYXRoLmNvcyxBPU1hdGguUEksQz1mdW5jdGlvbih0KXtyZXR1cm4gMS1NKHQqQS8yKX0seD1mdW5jdGlvbih0KXtyZXR1cm4gYih0KkEvMil9LFM9ZnVuY3Rpb24odCl7cmV0dXJuLShNKEEqdCktMSkvMn0sST1mdW5jdGlvbih0KXt2YXIgbj10fHx7fSxlPW4ub2Zmc2V0LHI9bi5mb2N1cztyZXR1cm4gSlNPTi5zdHJpbmdpZnkoe29mZnNldDplLGZvY3VzOnJ9KX0sRT1mdW5jdGlvbih0LG4sZSl7dmFyIHI9dyh0KVtuXTtpZighcilyZXR1cm4gTmFOO3ZhciBhPXJ8fHt9LG89YS5vZmZzZXRUb3AsaT1hLm9mZnNldEhlaWdodDtyZXR1cm4gZT9vKzA6bytpfSxGPWZ1bmN0aW9uKG4sZSxyKXt2YXIgYT1ufHx7fSxvPWEuaW1hZ2UsaT1hLmRyYXdpbmc7aWYoaSl7dmFyIHU9dygoKG98fHt9KS5seXJpY3x8e30pLmxheW91dCk7aWYoTnVtYmVyLmlzTmFOKGUpKXJldHVybiBjb25zb2xlLndhcm4oInRhcmdldCBOYU4iLGUpOyhlPC0xfHxlPnUubGVuZ3RoLTEpJiZjb25zb2xlLndhcm4oIndyb25nIHRhcmdldCIsZSk7dmFyIGY9TWF0aC5tYXgoMCxNYXRoLm1pbih1Lmxlbmd0aC0xLGUpKSxjPS0xPT09ZT9tOi44LGQ9dVtmXXx8e30sZz1kLm9mZnNldFRvcCxwPWQub2Zmc2V0SGVpZ2h0LHk9W2YsY10sYj1NYXRoLmZsb29yKGcrcC8yKSxNPXtmb2N1czp5LG9mZnNldDpifSxBPWZ1bmN0aW9uKG4sZSxyKXtuPXcobik7dmFyIGE9dCh3KGUpLDIpLG89YVswXSxpPWFbMV07aT1pfHxtO3ZhciB1PShyPXJ8fDApLXYsZj11LGM9dStoLGQ9e30sZz1mdW5jdGlvbih0KXtyZXR1cm4gZjx0JiZ0PGN9LHA9ZnVuY3Rpb24odCxuKXtyZXR1cm4gZyhuKSYmKGRbdF09bil9OzA9PT0obz1vfHwwKSYmcCgidG9wIixFKG4sbywhMCkrcyksbz09PW4ubGVuZ3RoLTEmJnAoImJvdHRvbSIsRShuLG8sITEpLXMpLEFycmF5KGk9PT1tPzE6MikuZmlsbCgwKS5mb3JFYWNoKChmdW5jdGlvbih0LGUscil7dmFyIGE9ci5sZW5ndGgtZTtpZihudWxsPT1kLnRvcCl7dmFyIGk9RShuLG8tYSwhMSktcztnKGkpJiZwKCJ0b3AiLGkrMipzKX1pZihudWxsPT1kLmJvdHRvbSl7dmFyIHU9RShuLG8rYSwhMCkrcztnKHUpJiZwKCJib3R0b20iLHUtMipzKX19KSk7dmFyIHk9ZC50b3AsYj1kLmJvdHRvbTtyZXR1cm5bbnVsbD09eT8obCtzKS9oOih5LXUpL2gsbnVsbD09Yj8xLShsK3MpL2g6KGItdSkvaF19KHUseSxiKSxGPWl8fHt9LE49Ri5mb2N1cyxPPUYub2Zmc2V0LGo9Ri5zcHJlYWQsUj1udWxsPT1OfHxudWxsPT1PfHxJKGkpPT09SShNKXx8IXIsVD1bXSxIPVtdLGs9W107Uj8oVC5wdXNoKHkpLEgucHVzaChiKSxrLnB1c2goQSkpOkFycmF5KDI0KS5maWxsKG51bGwpLmZvckVhY2goKGZ1bmN0aW9uKHQsbixlKXt2YXIgcj0obisxKS9lLmxlbmd0aDtULnB1c2goZnVuY3Rpb24odCxuLGUpe3ZhciByPXgsYT1DO2lmKHRbMF09PT1uWzBdKXt2YXIgbz1uWzFdLXRbMV0saT10WzFdK28qcihlKTtyZXR1cm5bdFswXSxpXX1pZihlPD0uNSl7dmFyIHU9bS10WzFdLGY9dFsxXSt1KmEoMiplKTtyZXR1cm5bdFswXSxmXX12YXIgYz1uWzFdLW0sbD1tK2MqcigyKihlLS41KSk7cmV0dXJuW25bMF0sbF19KE4seSxyKSksSC5wdXNoKGZ1bmN0aW9uKHQsbixlKXtyZXR1cm4gdCsobi10KSpTKGUpfShPLGIscikpLGsucHVzaChmdW5jdGlvbih0LG4sZSl7dmFyIHI9W25bMF0tdFswXSxuWzFdLXRbMV1dLGE9UyhlKTtyZXR1cm5bdFswXStyWzBdKmEsdFsxXStyWzFdKmFdfShqLEEscikpfSkpLGkuZm9jdXNGcmFtZT1ULGkub2Zmc2V0RnJhbWU9SCxpLnNwcmVhZEZyYW1lPWssaS5zdGVwPTAsaS5pZCs9MX19LE49ZnVuY3Rpb24obixlLHIsYSxvKXt2YXIgaT1uLmNhbnZhcyx1PWkud2lkdGgsZj1pLmhlaWdodCxjPWUuY2FudmFzLGw9ZS5sYXlvdXQscz10KHcoYSksMiksaD1zWzBdLGQ9c1sxXTtpZihyLT12LG4uc2F2ZSgpLG4uY2xlYXJSZWN0KDAsMCx1LGYpLChsfHxbXSkubGVuZ3RoKXt2YXIgZz1sW2hdfHx7fSxwPWcub2Zmc2V0VG9wLHk9Zy5vZmZzZXRIZWlnaHQ7IWZ1bmN0aW9uKG4sZSxyLGEpe2lmKGUud2lkdGgmJmUuaGVpZ2h0KXt2YXIgbz1uLmNhbnZhcyxpPW8ud2lkdGgsdT1vLmhlaWdodCxmPTA7YS5mb3JFYWNoKChmdW5jdGlvbihhKXt2YXIgbz10KGEsMiksYz1vWzBdLGw9b1sxXTtjPW51bGw9PWM/dS1mOmMsbi5nbG9iYWxBbHBoYT1NYXRoLm1heCgwLE1hdGgubWluKGwsMSkpLG4uZHJhd0ltYWdlKGUsMCxyK2YsaSxjLDAsZixpLGMpLGYrPWN9KSksbi5nbG9iYWxBbHBoYT0xfX0obixjLHIsW1twLXIsbV0sW3ksZF0sW251bGwsbV1dKX1lbHNlIG4uZHJhd0ltYWdlKGMsMCwwKTtuLmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbj0iZGVzdGluYXRpb24taW4iLG4uZmlsbFN0eWxlPW8sbi5maWxsUmVjdCgwLDAsdSxmKSxuLnJlc3RvcmUoKX0sTz1mdW5jdGlvbih0LG4sZSxyKXt2YXIgYT10fHx7fSxvPWEuY29udGV4dCxpPWEuZHJhZnQsdT1hLmRyYXdpbmcsYz1hLmltYWdlO2lmKG8pe3ZhciBsLHMsdixtLHk9Y3x8e30sYj15LmJhY2tncm91bmQsTT15Lmx5cmljLEE9eS5tZXRhLEM9eS5ob2xkZXIseD1vLmNhbnZhcyxTPXgud2lkdGgsST14LmhlaWdodDtpZihvLmNsZWFyUmVjdCgwLDAsUyxJKSxiJiZvLmRyYXdJbWFnZShiLmNhbnZhcywwLDApLEEmJm8uZHJhd0ltYWdlKEEuY2FudmFzLDAsZigzMCkpLEMmJihsPW8scz1DLHY9TWF0aC5yb3VuZCgobC5jYW52YXMuaGVpZ2h0LXMuY2FudmFzLmhlaWdodCkvMiksbT1NYXRoLnJvdW5kKChsLmNhbnZhcy53aWR0aC1zLmNhbnZhcy53aWR0aCkvMiksbC5kcmF3SW1hZ2Uocy5jYW52YXMsbSx2KSksaSYmTSl7dmFyIEU9ZnVuY3Rpb24odCxuKXt2YXIgZT0odD10fHxwKCEwKSkuY3JlYXRlTGluZWFyR3JhZGllbnQoMCwwLDAsaCk7cmV0dXJuIGUuYWRkQ29sb3JTdG9wKGcsIndoaXRlIiksdyhuKS5mb3JFYWNoKChmdW5jdGlvbih0LG4pe3ZhciByPW4/MTowO2UuYWRkQ29sb3JTdG9wKHQsIndoaXRlIiksZS5hZGRDb2xvclN0b3AociwidHJhbnNwYXJlbnQiKX0pKSxlfShpLHIpO04oaSxNLG4sZSxFKSxvLmRyYXdJbWFnZShpLmNhbnZhcyxkLGYoOTcpKSx1Lm9mZnNldD1uLHUuZm9jdXM9ZSx1LnNwcmVhZD1yfX19LGo9ZnVuY3Rpb24gdChuKXt2YXIgZT0obnx8e30pLmRyYXdpbmcscj1lfHx7fSxvPXIuaWQsaT1yLnN0ZXAsdT1yLm9mZnNldEZyYW1lLGY9ci5mb2N1c0ZyYW1lLGM9ci5zcHJlYWRGcmFtZTtpZih1JiZmJiYhKGk+PXUubGVuZ3RoKSl7dS5sZW5ndGghPT1mLmxlbmd0aCYmY29uc29sZS53YXJuKCJsZW5ndGggbWlzbWF0Y2giLHUsZik7dmFyIGw9dVtpXSxzPWZbaV0saD1jW2ldO2UuaGFuZGxlcj1mdW5jdGlvbih0KXtyZXR1cm4gYSYmKHNlbGYuZG9jdW1lbnR8fHt9KS5oaWRkZW4/c2V0VGltZW91dCh0LDApOnNlbGYucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHQpfSgoZnVuY3Rpb24oKXtvPT09KGV8fHt9KS5pZCYmKE8obixsLHMsaCksZS5zdGVwPWkrMSx0KG4pKX0pKX19LFI9e2RyYXdpbmc6e2lkOjAsb2Zmc2V0Om51bGwsZm9jdXM6bnVsbH0sZHJhZnQ6KHk9cCghMCkseS5jYW52YXMud2lkdGg9Yyx5LmNhbnZhcy5oZWlnaHQ9aCx5KSxjb250ZXh0Om51bGwsaW1hZ2U6e319LFQ9ZnVuY3Rpb24odCxuLGUpe3ZhciByPVIuZHJhd2luZztjYW5jZWxBbmltYXRpb25GcmFtZShyLmhhbmRsZXIpLCJhbmltYXRlIj09PXQmJkYoUixuLGUpLCJwYXVzZSIhPT10P2ooUik6cG9zdE1lc3NhZ2Uoe3R5cGU6InBhdXNlIn0pfSxIPXtjb250cm9sOmZ1bmN0aW9uKHQpe2lmKHQpe3ZhciBuPXQuZ2V0Q29udGV4dCgiMmQiKSxlPW4uY2FudmFzLHI9ZS53aWR0aCxhPWUuaGVpZ2h0O24uY2xlYXJSZWN0KDAsMCxyLGEpLFIuY29udGV4dD1uLHBvc3RNZXNzYWdlKHt0eXBlOiJ0YWtlIn0pfX0sbG9hZDpmdW5jdGlvbih0KXt2YXIgbj0odHx8e30pLmtlZXA7T2JqZWN0LmFzc2lnbihSLmltYWdlLHQpLG58fChSLmRyYXdpbmc9e2lkOjAsb2Zmc2V0Om51bGwsZm9jdXM6bnVsbH0pfSxhbmltYXRlOmZ1bmN0aW9uKG4pe3ZhciBlPXQobnx8W10sMikscj1lWzBdLGE9ZVsxXTtudWxsIT1yJiZUKCJhbmltYXRlIixyLGEpfSxwYXVzZTpmdW5jdGlvbigpe3JldHVybiBUKCJwYXVzZSIpfSxwbGF5OmZ1bmN0aW9uKCl7cmV0dXJuIFQoInBsYXkiKX19O3NlbGYub25tZXNzYWdlPWZ1bmN0aW9uKHQpe3ZhciBuPXQuZGF0YXx8e30sZT1uLnR5cGUscj1uLnBheWxvYWQ7ZSBpbiBIJiZIW2VdKHIpfX0oKTsKCg==",
                         o = null,
                         l = !1,
                         function(n) {
        return c = c || a(i, o, l),
            new Worker(c, n)
    }
                        ),
        d = (self.navigator || {}).userAgent,
        s = function(n) {
            return parseInt((new RegExp(n + "/([0-9]+).").exec(d) || [])[1], 10)
        },
        m = s("Chrome") || s("Chromium"),
        h = !m && s("Safari") && s("Version"),
        p = function() {
            if ("undefined" == typeof window)
                return ((self.name || "").match(/[?&]ratio=([^&$]+)/) || [])[1];
            var n = (window.screen || {}).height || 1080,
                t = (window.screen || {}).availHeight || 1040,
                e = window.devicePixelRatio || 1;
            return Math.round((h ? n : t) / 2) + "/480*" + e
        }(),
        f = 1,
        b = eval;
    try {
        f = b(p)
    } catch (n) {}
    var v = function(n, t) {
        var e = n * f,
            r = Math.round(e);
        if (!t)
            return r;
        var a = Math.floor(e),
            i = a === e ? e + 1 : Math.ceil(e);
        return a % 2 ? i : a
    },
        y = v(375, !0),
        g = v(480),
        Z = v(26, !0),
        x = Z / 2,
        X = y,
        G = 12 * Z + x,
        W = (y - X) / 2,
        L = 5 * Z,
        w = L / G,
        S = .4,
        K = "//s4.music.126.net/style/web2/img/default_album.jpg",
        C = function(n, t) {
            var e = document.createElement(n);
            return t && (e.className = t),
                e
        },
        Y = function(n) {
            var t;
            if (n || "undefined" == typeof document)
                try {
                    t = new OffscreenCanvas(0, 0).getContext("2d")
                } catch (n) {}
            if (t)
                return t;
            try {
                t = document.createElement("canvas").getContext("2d")
            } catch (n) {}
            if (t)
                return t;
            throw new Error("CreateContextError")
        },
        F = function() {
            return new Promise((function(n) {
                return window.requestIdleCallback ? window.requestIdleCallback(n) : setTimeout(n, 1)
            }))
        },
        I = function(n) {
            try {
                return n.transferToImageBitmap ? n.transferToImageBitmap() : n
            } catch (t) {
                return n
            }
        },
        V = function(n, t) {
            return new Promise((function(e, r) {
                var a = t || {},
                    i = a.width,
                    o = a.height,
                    l = a.crossOrigin,
                    c = new Image(i, o);
                c.onload = function() {
                    return e(c)
                },
                    c.onerror = r,
                    c.crossOrigin = l,
                    c.src = n
            }))
        },
        H = function(n) {
            return Array.isArray(n) ? n : []
        },
        R = {
            IDEOGRAM: /(?:[\u3400-\u4DBF\u4E00-\u9FFF\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879\uD880-\uD883\uD885-\uD887][\uDC00-\uDFFF]|\uD869[\uDC00-\uDEDF\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF39\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD884[\uDC00-\uDF4A\uDF50-\uDFFF]|\uD888[\uDC00-\uDFAF])/,
            TAG: /^\s*\[[^\]]*\]\s*/
        },
        P = function(n) {
            if (!(n = String(n || "").trim()))
                return n;
            n = n.replace(/：/g, ":").replace(/，/g, ",");
            var t = R.IDEOGRAM.test(n);
            return n.replace(/\s*:\s*/g, t ? "：" : ": ").replace(/\s*,\s*/g, t ? "，" : ", ")
        },
        T = function(n, t) {
            var e = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "lrc";
            return n = n || {},
                String(t || "").trim().split("\n").forEach((function(t) {
                var r = function(n) {
                    var t = [],
                        e = String(n || "").trim(),
                        r = e;
                    if (!n)
                        return {
                            tags: t,
                            text: e
                        };
                    for (var a = function(n) {
                        return t.push(n.trim()),
                            ""
                    };
                         (e = e.replace(R.TAG, a)) !== r;)
                        r = e;
                    return {
                        tags: t,
                        text: P(e)
                    }
                }(t) || {},
                    a = r.tags,
                    i = r.text;
                i && a && a.forEach((function(t) {
                    var r = function(n) {
                        if (!n)
                            return null;
                        if (3 === (n = String(n || "").split(":")).length) {
                            var t = n.pop();
                            n[1] += ".".concat(t)
                        }
                        var e = n.reduce((function(n, t) {
                            return 60 * n + parseFloat(t || 0)
                        }), 0);
                        return Number.isNaN(e) ? null : e.toFixed(2)
                    }((t || "").slice(1, -1));
                    null != r && (n[r] || (n[r] = {}),
                                  n[r][e] || (n[r][e] = []),
                                  n[r][e].push(i))
                }))
            })),
                n
        },
        k = function(n) {
            return (Array.isArray(n) ? n : []).filter(Boolean).join(" ").trim()
        },
        J = function(n) {
            var t = n || {},
                e = t.lrc,
                r = t.tlrc;
            return e = k(e),
                r = k(r),
                e ? r ? {
                lrc: e,
                tlrc: r
            } : {
                lrc: e
            } : null
        };

    function z(n) {
        return z = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(n) {
            return typeof n
        } :
        function(n) {
            return n && "function" == typeof Symbol && n.constructor === Symbol && n !== Symbol.prototype ? "symbol" : typeof n
        },
            z(n)
    }
    /**
	 * StackBlur - a fast almost Gaussian Blur For Canvas
	 *
	 * In case you find this class useful - especially in commercial projects -
	 * I am not totally unhappy for a small donation to my PayPal account
	 * mario@quasimondo.de
	 *
	 * Or support me on flattr:
	 * {@link https://flattr.com/thing/72791/StackBlur-a-fast-almost-Gaussian-Blur-Effect-for-CanvasJavascript}.
	 *
	 * @module StackBlur
	 * @author Mario Klingemann
	 * Contact: mario@quasimondo.com
	 * Website: {@link http://www.quasimondo.com/StackBlurForCanvas/StackBlurDemo.html}
	 * Twitter: @quasimondo
	 *
	 * @copyright (c) 2010 Mario Klingemann
	 *
	 * Permission is hereby granted, free of charge, to any person
	 * obtaining a copy of this software and associated documentation
	 * files (the "Software"), to deal in the Software without
	 * restriction, including without limitation the rights to use,
	 * copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the
	 * Software is furnished to do so, subject to the following
	 * conditions:
	 *
	 * The above copyright notice and this permission notice shall be
	 * included in all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
	 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
	 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
	 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
	 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
	 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
	 * OTHER DEALINGS IN THE SOFTWARE.
	 */
    var N = [512, 512, 456, 512, 328, 456, 335, 512, 405, 328, 271, 456, 388, 335, 292, 512, 454, 405, 364, 328, 298, 271, 496, 456, 420, 388, 360, 335, 312, 292, 273, 512, 482, 454, 428, 405, 383, 364, 345, 328, 312, 298, 284, 271, 259, 496, 475, 456, 437, 420, 404, 388, 374, 360, 347, 335, 323, 312, 302, 292, 282, 273, 265, 512, 497, 482, 468, 454, 441, 428, 417, 405, 394, 383, 373, 364, 354, 345, 337, 328, 320, 312, 305, 298, 291, 284, 278, 271, 265, 259, 507, 496, 485, 475, 465, 456, 446, 437, 428, 420, 412, 404, 396, 388, 381, 374, 367, 360, 354, 347, 341, 335, 329, 323, 318, 312, 307, 302, 297, 292, 287, 282, 278, 273, 269, 265, 261, 512, 505, 497, 489, 482, 475, 468, 461, 454, 447, 441, 435, 428, 422, 417, 411, 405, 399, 394, 389, 383, 378, 373, 368, 364, 359, 354, 350, 345, 341, 337, 332, 328, 324, 320, 316, 312, 309, 305, 301, 298, 294, 291, 287, 284, 281, 278, 274, 271, 268, 265, 262, 259, 257, 507, 501, 496, 491, 485, 480, 475, 470, 465, 460, 456, 451, 446, 442, 437, 433, 428, 424, 420, 416, 412, 408, 404, 400, 396, 392, 388, 385, 381, 377, 374, 370, 367, 363, 360, 357, 354, 350, 347, 344, 341, 338, 335, 332, 329, 326, 323, 320, 318, 315, 312, 310, 307, 304, 302, 299, 297, 294, 292, 289, 287, 285, 282, 280, 278, 275, 273, 271, 269, 267, 265, 263, 261, 259],
        D = [9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24];

    function E(n, t, e, r, a, i) {
        if (!(isNaN(i) || i < 1)) {
            i |= 0;
            var o = function(n, t, e, r, a) {
                if ("string" == typeof n && (n = document.getElementById(n)),
                    !n || "object" !== z(n) || !("getContext" in n))
                    throw new TypeError("Expecting canvas with `getContext` method in processCanvasRGB(A) calls!");
                var i = n.getContext("2d");
                try {
                    return i.getImageData(t, e, r, a)
                } catch (n) {
                    throw new Error("unable to access image data: " + n)
                }
            }(n, t, e, r, a);
            o = function(n, t, e, r, a, i) {
                for (var o, l = n.data, c = 2 * i + 1, u = r - 1, d = a - 1, s = i + 1, m = s * (s + 1) / 2, h = new M, p = h, f = 1; f < c; f++)
                    p = p.next = new M,
                        f === s && (o = p);
                p.next = h;
                for (var b, v, y = null, g = null, Z = N[i], x = D[i], X = 0, G = 0, W = 0; W < a; W++) {
                    var L = l[G],
                        w = l[G + 1],
                        S = l[G + 2],
                        K = s * L,
                        C = s * w,
                        Y = s * S,
                        F = m * L,
                        I = m * w,
                        V = m * S;
                    p = h;
                    for (var H = 0; H < s; H++)
                        p.r = L,
                            p.g = w,
                            p.b = S,
                            p = p.next;
                    for (var R = 0, P = 0, T = 0, k = 1; k < s; k++)
                        b = G + ((u < k ? u : k) << 2),
                            F += (p.r = L = l[b]) * (v = s - k),
                            I += (p.g = w = l[b + 1]) * v,
                            V += (p.b = S = l[b + 2]) * v,
                            R += L,
                            P += w,
                            T += S,
                            p = p.next;
                    y = h,
                        g = o;
                    for (var J = 0; J < r; J++)
                        l[G] = F * Z >> x,
                            l[G + 1] = I * Z >> x,
                            l[G + 2] = V * Z >> x,
                            F -= K,
                            I -= C,
                            V -= Y,
                            K -= y.r,
                            C -= y.g,
                            Y -= y.b,
                            b = X + ((b = J + i + 1) < u ? b : u) << 2,
                            F += R += y.r = l[b],
                            I += P += y.g = l[b + 1],
                            V += T += y.b = l[b + 2],
                            y = y.next,
                            K += L = g.r,
                            C += w = g.g,
                            Y += S = g.b,
                            R -= L,
                            P -= w,
                            T -= S,
                            g = g.next,
                            G += 4;
                    X += r
                }
                for (var z = 0; z < r; z++) {
                    var E = l[G = z << 2],
                        j = l[G + 1],
                        U = l[G + 2],
                        A = s * E,
                        B = s * j,
                        O = s * U,
                        Q = m * E,
                        q = m * j,
                        _ = m * U;
                    p = h;
                    for (var $ = 0; $ < s; $++)
                        p.r = E,
                            p.g = j,
                            p.b = U,
                            p = p.next;
                    for (var nn = 0, tn = 0, en = 0, rn = 1, an = r; rn <= i; rn++)
                        G = an + z << 2,
                            Q += (p.r = E = l[G]) * (v = s - rn),
                            q += (p.g = j = l[G + 1]) * v,
                            _ += (p.b = U = l[G + 2]) * v,
                            nn += E,
                            tn += j,
                            en += U,
                            p = p.next,
                            rn < d && (an += r);
                    G = z,
                        y = h,
                        g = o;
                    for (var on = 0; on < a; on++)
                        l[b = G << 2] = Q * Z >> x,
                            l[b + 1] = q * Z >> x,
                            l[b + 2] = _ * Z >> x,
                            Q -= A,
                            q -= B,
                            _ -= O,
                            A -= y.r,
                            B -= y.g,
                            O -= y.b,
                            b = z + ((b = on + s) < d ? b : d) * r << 2,
                            Q += nn += y.r = l[b],
                            q += tn += y.g = l[b + 1],
                            _ += en += y.b = l[b + 2],
                            y = y.next,
                            A += E = g.r,
                            B += j = g.g,
                            O += U = g.b,
                            nn -= E,
                            tn -= j,
                            en -= U,
                            g = g.next,
                            G += r
                }
                return n
            }(o, 0, 0, r, a, i),
                n.getContext("2d").putImageData(o, t, e)
        }
    }
    var M = function n() {
        !function(n, t) {
            if (!(n instanceof t))
                throw new TypeError("Cannot call a class as a function")
        }(this, n),
            this.r = 0,
            this.g = 0,
            this.b = 0,
            this.a = 0,
            this.next = null
    },
        j = function(n) {
            return String(n || "").trim()
        },
        U = "";
    "undefined" != typeof window && (U = getComputedStyle(document.body).fontFamily);
    var A, B, O, Q, q = function(n) {
        return "data:image/svg+xml,".concat(encodeURIComponent(n))
    },
        _ = function(n) {
            var t = Y(!(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1]),
                e = t.canvas,
                r = n || {},
                a = r.naturalWidth,
                i = r.naturalHeight;
            return e.width = a || 1,
                e.height = i || 1,
                t.drawImage(n, 0, 0),
                I(e)
        },
        $ = function(n, t) {
            var e = (new XMLSerializer).serializeToString(n),
                r = document.createElement("div");
            r.appendChild(n),
                r.style.width = "".concat(t, "px"),
                r.style.position = "absolute",
                r.style.visibility = "hidden",
                r.appendChild(n),
                document.body.appendChild(r);
            var a = r.scrollHeight;
            return r.parentNode.removeChild(r),
                [t, a, e]
        },
        nn = function(n, t, e) {
            return '\n    <svg width="'.concat(n, '" height="').concat(t, '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ').concat(n, " ").concat(t, '">\n      <style>\n        body {\n          margin: 0;\n          width: 100%;\n          height: 100%;\n        }\n      </style>\n      <foreignObject width="').concat(n, '" height="').concat(t, '">\n        <body xmlns="http://www.w3.org/1999/xhtml">\n          ').concat(e, "\n        </body>\n      </foreignObject>\n    </svg>\n  ")
        },
        tn = function(n) {
            if (!(n || []).length)
                return null;
            var t = X,
                e = function(n) {
                    var t = "pip-lyric-element",
                        e = document.createDocumentFragment();
                    e.appendChild(document.createElement("style")).innerHTML = "\n    .".concat(t, " {\n      font-family: ").concat(U, ";\n      font-weight: 400;\n      padding: 0 ").concat(v(16), "px;\n      box-sizing: border-box;\n      color: white;\n      width: 100%;\n      height: 100%;\n      overflow: hidden;\n    }\n    .").concat(t, " section {\n      text-align: center;\n      padding: ").concat(x, "px 0;\n      white-space: pre-wrap;\n      word-break: break-word;\n      line-height: ").concat(Z, "px;\n    }\n    .").concat(t, " section p {\n      margin: 0;\n      font-size: ").concat(v(20), "px;\n    }\n  ");
                    var r = C("div", t);
                    return e.appendChild(r),
                        n.forEach((function(n) {
                        var t = n || {},
                            e = t.lrc,
                            a = t.tlrc,
                            i = C("section"),
                            o = C("p");
                        o.textContent = e;
                        var l = C("p");
                        l.textContent = a,
                            i.appendChild(o),
                            i.appendChild(l),
                            r.appendChild(i)
                    })),
                        e
                }(n.map((function(n) {
                    return n[1]
                }))),
                r = (new XMLSerializer).serializeToString(e),
                a = document.createElement("div");
            a.style.width = "".concat(t, "px"),
                a.style.position = "absolute",
                a.style.visibility = "hidden",
                a.appendChild(e),
                document.body.appendChild(a);
            var i = a.children[1] || {},
                o = i.scrollHeight || 1,
                l = Array.from(i.children || []).map((function(n) {
                    var t = n || {};
                    return {
                        offsetTop: t.offsetTop,
                        offsetHeight: t.offsetHeight
                    }
                }));
            return a.parentNode.removeChild(a),
                V(q(nn(t, o, r))).then((function(n) {
                return F().then((function() {
                    return {
                        canvas: _(n),
                        layout: l
                    }
                }))
            }))
        },
        en = function(n) {
            var e = function(n) {
                var t = j((n = n || {}).name),
                    e = j(n.program ? (n.program.radio || {}).name : H(n.ar || n.artists).map((function(n) {
                        return (n || {}).name
                    })).filter(Boolean).join(" / "));
                if (!t && !e)
                    return null;
                var r = "pip-meta-element",
                    a = document.createDocumentFragment();
                a.appendChild(document.createElement("style")).innerHTML = "\n    .".concat(r, " {\n      font-family: ").concat(U, ";\n      padding: 0 ").concat(v(16), "px;\n      box-sizing: border-box;\n      color: white;\n      width: 100%;\n      display: flex;\n      flex-direction: column;\n    }\n    .").concat(r, " h1,\n    .").concat(r, " h2 {\n      margin: 0;\n      font-weight: 400;\n      text-align: center;\n      width: 100%;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n    .").concat(r, " h1 {\n      font-size: ").concat(v(17), "px;\n      opacity: 0.8;\n    }\n    .").concat(r, " h2 {\n      margin-top: ").concat(v(4), "px;\n      font-size: ").concat(v(13), "px;\n      opacity: 0.4;\n    }\n  ");
                var i = C("div", r);
                a.appendChild(i);
                var o = C("h1");
                o.textContent = t;
                var l = C("h2");
                return l.textContent = e,
                    i.appendChild(o),
                    i.appendChild(l),
                    a
            }(n);
            return e ? V(q(nn.apply(void 0, t($(e, y))))).then((function(n) {
                return F().then((function() {
                    return {
                        canvas: _(n)
                    }
                }))
            })) : null
        },
        rn = function(n, e, r) {
            return Promise.resolve((n || {}).program ? function(n) {
                var t = (n || {}).program;
                if (!t)
                    return null;
                var e = (t.coverUrl || (t.radio || {}).picUrl || K).replace(/^https?:/, ""),
                    r = y - 2 * v(70),
                    a = [, "y", , ].join(100 * Math.ceil(r / 100)),
                    i = "pip-radio-holder",
                    o = document.createDocumentFragment();
                return o.appendChild(document.createElement("style")).innerHTML = "\n    .".concat(i, " {\n      font-family: ").concat(U, ";\n      font-weight: 400;\n      box-sizing: border-box;\n      color: white;\n      width: 100%;\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n    }\n    .").concat(i, " img {\n      object-fit: cover;\n      width: ").concat(r, "px;\n      height: ").concat(r, "px;\n      border-radius: ").concat(v(12), "px\n    }\n    .").concat(i, " p {\n      margin: 0;\n      margin-top: ").concat(v(16), "px;\n      font-size: ").concat(v(16), "px;\n      opacity: 0.4;\n    }\n  "),
                    V("".concat(e, "?param=").concat(a), {
                    crossOrigin: "anonymous"
                }).then((function(n) {
                    return F().then((function() {
                        return _(n, !1)
                    }))
                })).then((function(n) {
                    var t = C("div", i);
                    return t.appendChild(C("img")).src = n.toDataURL(),
                        t.appendChild(C("p")).textContent = "正在播放播客节目",
                        o.appendChild(t),
                        o
                }))
            }(n) : function(n, t, e) {
                n = n || {};
                var r = "pip-song-holder",
                    a = document.createDocumentFragment();
                a.appendChild(document.createElement("style")).innerHTML = "\n    .".concat(r, " {\n      font-family: ").concat(U, ";\n      font-weight: 400;\n      box-sizing: border-box;\n      color: white;\n      width: 100%;\n    }\n    .").concat(r, " p {\n      margin: 0;\n      text-align: center;\n      line-height: 2;\n      font-size: ").concat(v(20), "px;\n      opacity: 0.4;\n    }\n  ");
                var i = C("p");
                if (n.id) {
                    if (!t)
                        return null;
                    if (t.no)
                        i.textContent = "纯音乐，请欣赏";
                    else if (t.lrc) {
                        if ((e || []).length)
                            return null;
                        i.textContent = "* 当前歌词不支持滚动 *",
                            i.style.fontSize = v(16),
                            i.style.opacity = .6
                    } else
                        i.textContent = "暂无歌词"
                } else
                    i.textContent = "请添加播放列表";
                var o = C("div", r);
                return a.appendChild(o),
                    o.appendChild(i),
                    a
            }(n, e, r)).then((function(n) {
                return n && V(q(nn.apply(void 0, t($(n, y))))).then((function(n) {
                    return F().then((function() {
                        return {
                            canvas: _(n)
                        }
                    }))
                }))
            }))
        },
        an = (A = function(t) {
            var e = Y(!0),
                r = e.canvas,
                a = Math.max(y, g),
                i = [(y - a) / 2, (g - a) / 2, a, a];
            // d="M8.25 0a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm22.88 2.751c.26 0 .475.187.52.433l.008.095v8.236a1.782 1.782 0 0 1-1.626 1.727l-.151.007h-1.276a.091.091 0 0 1-.09-.106l.017-.038.599-.824a.212.212 0 0 1 .121-.082l.05-.006h.58a.722.722 0 0 0 .714-.624l.007-.098V3.807h-8.498v9.32a.121.121 0 0 1-.082.115l-.039.007h-.813a.121.121 0 0 1-.115-.083l-.006-.038V3.279c0-.259.187-.474.433-.52l.095-.008h9.553zm51.185-.176a.1.1 0 0 1 .1.05l.013.037.046.325a.58.58 0 0 1-.5.655c-1.196.154-4.058.495-6.937.648l-.36.019-.353 2.655h3.516V5.262c0-.301.22-.55.507-.597l.098-.008h.33a.12.12 0 0 1 .114.082l.006.038v2.187h4.265c.045 0 .083.027.1.066l.008.042v.298c0 .302-.22.552-.51.6l-.098.007h-3.765v3.476c0 .932-.718 1.697-1.631 1.771l-.146.006h-.822a.125.125 0 0 1-.12-.154l.02-.043.55-.762a.232.232 0 0 1 .133-.09l.054-.006h.185a.722.722 0 0 0 .716-.624l.006-.098V7.977h-4.086a.507.507 0 0 1-.506-.48l.003-.086.47-3.649a.507.507 0 0 1 .483-.446l.64-.03.64-.036a94.356 94.356 0 0 0 4.396-.38l.476-.053a93.896 93.896 0 0 0 1.96-.242zm-38.29 5.402c.207 0 .38.15.415.347l.007.076v3.052c0 .932-.718 1.697-1.631 1.771l-.146.006h-1.52a.113.113 0 0 1-.109-.14l.019-.038.572-.788a.216.216 0 0 1 .124-.083l.05-.006h.864a.722.722 0 0 0 .715-.624l.007-.098V8.885l-.513-.001h-.568l-3.093 4.256a.215.215 0 0 1-.124.083l-.05.006h-.935a.106.106 0 0 1-.103-.132l.017-.036 3.036-4.177h-1.734l-3.089 4.247a.238.238 0 0 1-.136.092l-.056.006h-.916a.11.11 0 0 1-.107-.136l.018-.038 3.033-4.171h-1.698l-1.209 1.653a.231.231 0 0 1-.133.089l-.054.006h-.927a.107.107 0 0 1-.104-.133l.018-.037.837-1.146.841-1.175a.423.423 0 0 1 .257-.156l.077-.008h8.048zm24.91 0c.249 0 .456.18.499.416l.008.091v4.238c0 .25-.18.456-.416.499l-.09.008h-7.353a.507.507 0 0 1-.498-.416l-.008-.09V8.483c0-.249.179-.456.415-.498l.091-.009h7.352zM57.751 6.644c.051 0 .094.033.11.08l.005.035v.327c0 .284-.207.52-.479.564l-.092.008h-5.807l-2.405 4.558h6.904l-1.2-2.252a.148.148 0 0 1 .085-.2l.05-.008h.813c.044 0 .085.02.113.052l.023.036 1.385 2.669a.5.5 0 0 1-.387.696l-.088.007h-8.528a.501.501 0 0 1-.481-.365.505.505 0 0 1 .015-.312l.033-.073 2.537-4.808h-2.779a.622.622 0 0 1-.615-.53l-.007-.092V6.76c0-.05.034-.094.08-.11l.036-.006h10.68zM9.618 2.894c-.864.285-1.279 1.09-1.03 2.005l.088.337c-.185.04-.368.094-.549.163-.844.325-1.514 1.047-1.748 1.884a2.562 2.562 0 0 0-.085.918 2.3 2.3 0 0 0 .96 1.675c.51.355 1.121.46 1.72.294.424-.117.801-.37 1.062-.71.412-.538.535-1.245.346-1.992a28.863 28.863 0 0 0-.24-.864l-.09-.317c.359.092.69.267.958.518.933.871 1.113 2.372.418 3.492-.61.983-1.798 1.619-3.028 1.619a3.763 3.763 0 0 1-3.716-4.313 3.715 3.715 0 0 1 2.175-2.838l.117-.05a.528.528 0 1 0-.391-.98A4.75 4.75 0 0 0 4.49 5.371a4.757 4.757 0 0 0-.906 2.785A4.821 4.821 0 0 0 8.4 12.972c1.587 0 3.128-.831 3.926-2.118.972-1.565.721-3.593-.595-4.822a3.318 3.318 0 0 0-1.98-.864c-.039-.148-.098-.376-.144-.546a.743.743 0 0 1-.014-.397.53.53 0 0 1 .844-.257c.064.049.114.11.172.165a.529.529 0 0 0 .82-.646c0-.004-.004-.008-.006-.012-.059-.1-.144-.186-.233-.262a1.683 1.683 0 0 0-.889-.39 1.602 1.602 0 0 0-.683.071zm66.448 6.02c.083 0 .131.09.089.161-.425.717-1.17 2.097-1.963 3.363a.586.586 0 0 1-.402.263l-.1.009h-.673a.143.143 0 0 1-.12-.222c.704-1.118 1.417-2.52 1.926-3.301a.599.599 0 0 1 .403-.264l.1-.009h.74zm5.082 0a.6.6 0 0 1 .503.273c.509.78 1.223 2.183 1.926 3.301a.144.144 0 0 1-.074.214l-.046.008h-.672a.592.592 0 0 1-.502-.272c-.794-1.266-1.539-2.646-1.963-3.363a.106.106 0 0 1 .05-.154l.038-.007h.74zm-12.762 2.158h-6.25v1.22h6.25v-1.22zM26.46 5.053c.024 0 .048.01.066.025l.023.027 1.07 1.87 1.068-1.87a.104.104 0 0 1 .055-.045l.035-.007h.93c.064 0 .109.055.104.113l-.014.042L28.202 8l1.595 2.792a.104.104 0 0 1-.046.145l-.044.01h-.93a.104.104 0 0 1-.066-.025l-.024-.027-1.069-1.87-1.069 1.87a.103.103 0 0 1-.054.045l-.035.007h-.93a.104.104 0 0 1-.104-.113l.013-.042L27.035 8l-1.596-2.792a.104.104 0 0 1 .047-.145l.043-.01h.93zm-2.51 0c.026 0 .05.01.068.025l.023.027 1.62 2.832a.1.1 0 0 1 .011.073l-.013.033-.002.008-1.625 2.844a.103.103 0 0 1-.054.045l-.036.007h-.941a.104.104 0 0 1-.103-.113l.013-.042 1.6-2.802-1.591-2.782a.104.104 0 0 1 .046-.145l.044-.01h.94zm44.437 3.861h-6.25v1.22h6.25v-1.22zM8.947 6.26c.057.207.118.422.18.636.083.289.165.574.23.833.076.302.11.736-.16 1.09a.956.956 0 0 1-.504.333.975.975 0 0 1-.836-.143 1.232 1.232 0 0 1-.51-.899 1.51 1.51 0 0 1 .05-.54c.146-.523.571-.976 1.11-1.183.145-.056.292-.098.44-.127zM43.66 2.623c.207 0 .38.15.415.346l.007.076V6.73c0 .207-.15.38-.347.415l-.075.007h-7.777a.422.422 0 0 1-.415-.346l-.007-.076V3.045c0-.207.15-.38.346-.415l.076-.007h7.777zm21.53-.445c.066 0 .128.027.174.072l.04.052.474.827h3.907c.052 0 .097.034.113.081l.006.038v.286c0 .302-.221.553-.51.6l-.099.008h-.634l-1.137 1.996h3.057c.059 0 .11.038.127.092l.007.042v.29a.589.589 0 0 1-.493.581l-.096.008h-9.718a.603.603 0 0 1-.595-.505l-.008-.098v-.276c0-.06.039-.11.092-.128l.042-.006h3.057l-1.137-1.996h-.634a.609.609 0 0 1-.6-.51l-.008-.098v-.28c0-.055.036-.102.086-.119l.04-.006h3.967l-.452-.788a.11.11 0 0 1 .056-.156l.039-.007h.836zM43.024 5.309h-6.5v.998h6.5v-.998zm24.47-1.167h-4.471l1.137 1.996h2.196l1.137-1.996zm-24.47-.675h-6.5v.998h6.5v-.998zM56.83 3.13c.056 0 .104.036.12.086l.007.04v.299a.588.588 0 0 1-.493.58l-.095.008h-7.897a.606.606 0 0 1-.598-.507l-.008-.099v-.27c0-.061.04-.112.094-.13l.043-.007h8.827z"
            return Promise.all([V(q('<svg width="84" height="16" viewBox="0 0 84 16" xmlns="http://www.w3.org/2000/svg"><path d="" fill="#FFF"/></svg>'), {
                crossOrigin: "anonymous"
            }), V(t, {
                crossOrigin: "anonymous"
            })]).then((function(t) {
                var a = n(t, 2),
                    o = a[0],
                    l = a[1];
                return F().then((function() {
                    var n = function(n, t) {
                        var e = _(n, !1),
                            r = e || {};
                        return E(e, 0, 0, r.width, r.height, t),
                            e
                    }(l, l.naturalWidth / 10);
                    return r.width = y,
                        r.height = g,
                        e.clearRect(0, 0, r.width, r.height),
                        e.drawImage.apply(e, [n].concat(i)),
                        e.fillStyle = "rgba(15, 22, 30, 0.6)",
                        e.fillRect(0, 0, y, g),
                        e.globalAlpha = .2,
                        e.drawImage(o, (y - v(o.naturalWidth)) / 2, g - v(o.naturalHeight + 24), v(o.naturalWidth), v(o.naturalHeight)),
                        e.restore(), {
                        canvas: I(r)
                    }
                }))
            }))
        },
              Q = !0,
              function(n) {
            return (Q || B !== n) && (O = A(n)),
                Q && (Q = !1),
                B = n,
                O
        }),
        on = function(t, e, r, a, i) {
            var o = t.canvas,
                l = o.width,
                c = o.height,
                u = e.canvas,
                d = e.layout,
                s = n(H(a), 2),
                m = s[0],
                h = s[1];
            if (r -= L,
                t.save(),
                t.clearRect(0, 0, l, c),
                (d || []).length) {
                var p = d[m] || {},
                    f = p.offsetTop,
                    b = p.offsetHeight;
                !function(t, e, r, a) {
                    if (e.width && e.height) {
                        var i = t.canvas,
                            o = i.width,
                            l = i.height,
                            c = 0;
                        a.forEach((function(a) {
                            var i = n(a, 2),
                                u = i[0],
                                d = i[1];
                            u = null == u ? l - c : u,
                                t.globalAlpha = Math.max(0, Math.min(d, 1)),
                                t.drawImage(e, 0, r + c, o, u, 0, c, o, u),
                                c += u
                        })),
                            t.globalAlpha = 1
                    }
                }(t, u, r, [
                    [f - r, S],
                    [b, h],
                    [null, S]
                ])
            } else
                t.drawImage(u, 0, 0);
            t.globalCompositeOperation = "destination-in",
                t.fillStyle = i,
                t.fillRect(0, 0, l, c),
                t.restore()
        },
        ln = function(n, t, e, r) {
            var a = n || {},
                i = a.context,
                o = a.draft,
                l = a.drawing,
                c = a.image;
            if (i) {
                var u, d, s, m, h = c || {},
                    p = h.background,
                    f = h.lyric,
                    b = h.meta,
                    y = h.holder,
                    g = i.canvas,
                    Z = g.width,
                    x = g.height;
                if (i.clearRect(0, 0, Z, x),
                    p && i.drawImage(p.canvas, 0, 0),
                    b && i.drawImage(b.canvas, 0, v(30)),
                    y && (u = i,
                          d = y,
                          s = Math.round((u.canvas.height - d.canvas.height) / 2),
                          m = Math.round((u.canvas.width - d.canvas.width) / 2),
                          u.drawImage(d.canvas, m, s)),
                    o && f) {
                    var X = function(n, t) {
                        var e = (n = n || Y(!0)).createLinearGradient(0, 0, 0, G);
                        return e.addColorStop(w, "white"),
                            H(t).forEach((function(n, t) {
                            var r = t ? 1 : 0;
                            e.addColorStop(n, "white"),
                                e.addColorStop(r, "transparent")
                        })),
                            e
                    }(o, r);
                    on(o, f, t, e, X),
                        i.drawImage(o.canvas, W, v(97)),
                        l.offset = t,
                        l.focus = e,
                        l.spread = r
                }
            }
        },
        cn = function n(t) {
            var e = (t || {}).drawing,
                r = e || {},
                a = r.id,
                i = r.step,
                o = r.offsetFrame,
                l = r.focusFrame,
                c = r.spreadFrame;
            if (o && l && !(i >= o.length)) {
                o.length !== l.length && console.warn("length mismatch", o, l);
                var u, d = o[i],
                    s = l[i],
                    m = c[i];
                e.handler = (u = function() {
                    a === (e || {}).id && (ln(t, d, s, m),
                                           e.step = i + 1,
                                           n(t))
                },
                             h && (self.document || {}).hidden ? setTimeout(u, 0) : self.requestAnimationFrame(u))
            }
        },
        un = Math.sin,
        dn = Math.cos,
        sn = Math.PI,
        mn = function(n) {
            return 1 - dn(n * sn / 2)
        },
        hn = function(n) {
            return un(n * sn / 2)
        },
        pn = function(n) {
            return -(dn(sn * n) - 1) / 2
        },
        fn = function(n) {
            var t = n || {},
                e = t.offset,
                r = t.focus;
            return JSON.stringify({
                offset: e,
                focus: r
            })
        },
        bn = function(n, t, e) {
            var r = H(n)[t];
            if (!r)
                return NaN;
            var a = r || {},
                i = a.offsetTop,
                o = a.offsetHeight;
            return e ? i + 0 : i + o
        },
        vn = function(t, e, r) {
            var a = t || {},
                i = a.image,
                o = a.drawing;
            if (o) {
                var l = H(((i || {}).lyric || {}).layout);
                if (Number.isNaN(e))
                    return console.warn("target NaN", e);
                (e < -1 || e > l.length - 1) && console.warn("wrong target", e);
                var c = Math.max(0, Math.min(l.length - 1, e)),
                    u = -1 === e ? S : .8,
                    d = l[c] || {},
                    s = d.offsetTop,
                    m = d.offsetHeight,
                    h = [c, u],
                    p = Math.floor(s + m / 2),
                    f = {
                        focus: h,
                        offset: p
                    },
                    b = function(t, e, r) {
                        t = H(t);
                        var a = n(H(e), 2),
                            i = a[0],
                            o = a[1];
                        o = o || S;
                        var l = (r = r || 0) - L,
                            c = l,
                            u = l + G,
                            d = {},
                            s = function(n) {
                                return c < n && n < u
                            },
                            m = function(n, t) {
                                return s(t) && (d[n] = t)
                            };
                        0 === (i = i || 0) && m("top", bn(t, i, !0) + x),
                            i === t.length - 1 && m("bottom", bn(t, i, !1) - x),
                            Array(o === S ? 1 : 2).fill(0).forEach((function(n, e, r) {
                            var a = r.length - e;
                            if (null == d.top) {
                                var o = bn(t, i - a, !1) - x;
                                s(o) && m("top", o + 2 * x)
                            }
                            if (null == d.bottom) {
                                var l = bn(t, i + a, !0) + x;
                                s(l) && m("bottom", l - 2 * x)
                            }
                        }));
                        var h = d.top,
                            p = d.bottom;
                        return [null == h ? (Z + x) / G : (h - l) / G, null == p ? 1 - (Z + x) / G : (p - l) / G]
                    }(l, h, p),
                    v = o || {},
                    y = v.focus,
                    g = v.offset,
                    X = v.spread,
                    W = null == y || null == g || fn(o) === fn(f) || !r,
                    w = [],
                    K = [],
                    C = [];
                W ? (w.push(h),
                     K.push(p),
                     C.push(b)) : Array(24).fill(null).forEach((function(n, t, e) {
                    var r = (t + 1) / e.length;
                    w.push(function(n, t, e) {
                        var r = hn,
                            a = mn;
                        if (n[0] === t[0]) {
                            var i = t[1] - n[1],
                                o = n[1] + i * r(e);
                            return [n[0], o]
                        }
                        if (e <= .5) {
                            var l = S - n[1],
                                c = n[1] + l * a(2 * e);
                            return [n[0], c]
                        }
                        var u = t[1] - S,
                            d = S + u * r(2 * (e - .5));
                        return [t[0], d]
                    }(y, h, r)),
                        K.push(function(n, t, e) {
                        return n + (t - n) * pn(e)
                    }(g, p, r)),
                        C.push(function(n, t, e) {
                        var r = [t[0] - n[0], t[1] - n[1]],
                            a = pn(e);
                        return [n[0] + r[0] * a, n[1] + r[1] * a]
                    }(X, b, r))
                })),
                    o.focusFrame = w,
                    o.offsetFrame = K,
                    o.spreadFrame = C,
                    o.step = 0,
                    o.id += 1
            }
        },
        yn = function() {
            var n = C("canvas");
            return n.width = y,
                n.height = g,
                n
        },
        gn = function() {
            var t, e, r, a, i = function() {
                var n = C("video");
                return n.width = y,
                    n.height = g,
                    n.controls = !1,
                    n.muted = !0,
                    n
            }(),
                o = {
                    drawing: {
                        id: 0,
                        offset: null,
                        focus: null
                    },
                    draft: (a = Y(!0),
                            a.canvas.width = y,
                            a.canvas.height = G,
                            a),
                    context: null,
                    image: {}
                },
                l = function() {
                    return function(n) {
                        var t = (n || {}).drawing || {},
                            e = t.offset,
                            r = t.focus,
                            a = t.spread;
                        ln(n, e, r, a)
                    }(o)
                },
                c = function() {
                    return i === document.pictureInPictureElement
                },
                d = {},
                s = {},
                f = function(n, t) {
                    if (d[n])
                        return delete d[n];
                    var e = s[n];
                    "function" == typeof e && e(t)
                };
            i.addEventListener("play", f.bind(null, "play")),
                i.addEventListener("pause", f.bind(null, "pause"));
            var b, v = function(n) {
                if (!(i.paused ^ n)) {
                    var t = n ? "play" : "pause";
                    d[t] = !0,
                        i[t]()
                }
            },
                Z = {
                    play: v.bind(null, !0),
                    pause: v.bind(null, !1)
                };
            i.addEventListener("enterpictureinpicture", (function(n) {
                b = (n || {}).pictureInPictureWindow,
                    s.enter && s.enter(),
                    h && l(),
                    b && h && b.addEventListener("resize", l)
            })),
                i.addEventListener("leavepictureinpicture", (function() {
                s.leave && s.leave(),
                    b && h && b.removeEventListener("resize", l),
                    b = void 0
            }));
            var x = function() {
                e = yn(),
                    o.context = e.getContext("2d"),
                    o.context.clearRect(0, 0, e.width, e.height),
                    i.srcObject = e.captureStream(),
                    t = void 0,
                    console.log("PiP", "page render")
            };
            try {
                if ((106 === m || 107 === m) && !/_worker=1/.test(window.location.href))
                    throw console.warn("Chrome 106/107 offscreencanvas mediastream bugly"),
                        new Error("ForceDowngradeError");
                !function() {
                    var n = "pipWorker?ratio=".concat(p);
                    (t = new u({
                        name: n
                    })).onerror = function(n) {
                        x()
                    };
                    var r = (e = yn()).transferControlToOffscreen();
                    t.onmessage = function(n) {
                        var t = (n.data || {}).type;
                        "take" === t ? i.srcObject = e.captureStream() : "pause" === t && Z.pause()
                    },
                        t.postMessage({
                        type: "control",
                        payload: r
                    }, [r]),
                        o.context = null,
                        console.log("PiP", "worker render")
                }()
            } catch (n) {
                console.warn("OffScreenRenderError", n),
                    x()
            }
            var X = function(n, e) {
                var r = o.drawing;
                if (cancelAnimationFrame(r.handler),
                    "animate" === n && vn(o, e, !(h && !m) && !t && c()),
                    t) {
                    if (t.postMessage({
                        type: n,
                        payload: [e, c()]
                    }),
                        "animate" !== n)
                        return;
                    var a = r || {},
                        i = a.offsetFrame,
                        l = a.focusFrame,
                        u = a.spreadFrame,
                        d = (i || []).length - 1,
                        s = {
                            offset: (i || [])[d],
                            focus: (l || [])[d],
                            spread: (u || [])[d],
                            step: d + 1
                        };
                    Object.assign(r, s)
                } else
                    "pause" !== n ? cn(o) : Z.pause()
            },
                W = function() {
                    var n = !(arguments.length > 0 && void 0 !== arguments[0]) || arguments[0];
                    if (i.autoPause || i.paused) {
                        if (clearTimeout(i.autoPause),
                            delete i.autoPause,
                            i.paused && (Z.play(),
                                         l()),
                            !n)
                            return;
                        i.autoPause = setTimeout((function() {
                            X("pause"),
                                delete i.autoPause
                        }), 500)
                    }
                },
                L = {
                    id: 0
                },
                w = {
                    setData: function(e, a) {
                        e = e || {};
                        var i, l, c, u, d, s = L.id += 1,
                            m = ((e.program ? e.program.coverUrl || (e.program.radio || {}).picUrl : (e.al || e.album || {}).picUrl) || K).replace(/^https?:/, "");
                        c = (l = (i = a || e.lrc ? e : undefined) || {}).lrc,
                            u = l.tlyric,
                            d = l.nolyric,
                            c = c && c.lyric,
                            u = u && u.lyric,
                            d = !!d,
                            a = i ? {
                            lrc: c,
                            tlrc: u,
                            no: d
                        } : i;
                        var h = {
                            lyric: JSON.stringify(a) === JSON.stringify(L.lyrics) && !!(r || {}).timeline && o.image.lyric,
                            background: m === L.picUrl && o.image.background
                        };
                        h.lyric || (r = null);
                        var p = h.lyric ? r.timeline.slice() : function(n) {
                            if ((n = n || {}).no)
                                return [];
                            var t = {};
                            for (var e in n)
                                if (n.hasOwnProperty(e)) {
                                    var r = n[e];
                                    r && T(t, r, e)
                                }
                            var a = [];
                            for (var i in t)
                                if (t.hasOwnProperty(i)) {
                                    var o = J(t[i]);
                                    o && a.push([parseFloat(i), o])
                                }
                            return a.sort((function(n, t) {
                                return n[0] - t[0]
                            }))
                        }(a),
                            f = "".concat(m, "?param=").concat([, "y", , ].join(130));
                        return Promise.all([h.lyric || tn(p), h.background || an(f), en(e), rn(e, a, p)]).then((function(e) {
                            if (s === L.id) {
                                var i = n(e, 4),
                                    l = i[0],
                                    c = i[1],
                                    u = i[2],
                                    d = i[3];
                                Object.assign(o.image, {
                                    lyric: l,
                                    background: c,
                                    meta: u,
                                    holder: d
                                }),
                                    h.lyric || (o.drawing = {
                                    id: 0,
                                    offset: null,
                                    focus: null
                                },
                                                r = function(t) {
                                    var e = -1,
                                        r = 0;
                                    return {
                                        timeline: t = t || [],
                                        empty: !t.length,
                                        getLyric: function(a) {
                                            var i = t.length;
                                            if (!i)
                                                return null;
                                            var o = t[e + 1];
                                            if (a < r || o && o[0] <= a) {
                                                var l = t.findIndex((function(n) {
                                                    return n[0] > a
                                                })); -
                                                    1 === l && (l = i),
                                                    e = l - 1
                                            }
                                            if (r = a,
                                                e > i - 1)
                                                return null;
                                            var c = n(t[e] || [], 1)[0];
                                            if ("number" == typeof c && a < c)
                                                return null;
                                            var u = e;
                                            return e += 1,
                                                u
                                        }
                                    }
                                }(p));
                                var f = Object.assign({
                                    keep: !!h.lyric
                                }, o.image);
                                t && t.postMessage({
                                    type: "load",
                                    payload: f
                                }),
                                    W(),
                                    X("animate", -1),
                                    L.lyrics = a,
                                    L.picUrl = m
                            }
                        }))
                    },
                    updateTime: function(n) {
                        if (null != n && r && !r.empty && !i.paused && (o.image || {}).lyric) {
                            var t = r.getLyric(n);
                            null != t && X("animate", t)
                        }
                    },
                    play: function() {
                        W(!1),
                            X("play")
                    },
                    pause: function() {
                        X("pause")
                    },
                    set onPlay(n) {
                        s.play = n
                    },
                    set onPause(n) {
                        s.pause = n
                    },
                    get canvas() {
                        return e
                    },
                    get reader() {
                        return r
                    },
                    get video() {
                        return i
                    },
                    set onEnter(n) {
                        s.enter = n
                    },
                    set onLeave(n) {
                        s.leave = n
                    },
                    get entered() {
                        return c()
                    },
                    enter: function() {
                        return Promise.resolve().then((function() {
                            if (!c())
                                return W(),
                                    i.requestPictureInPicture()
                        }))
                    },
                    leave: function() {
                        return Promise.resolve().then((function() {
                            if (c())
                                return document.exitPictureInPicture()
                        }))
                    }
                };
            return w.setData(),
                w
        };
    try {
        gn.support = document.pictureInPictureEnabled && m > 74
    } catch (n) {
        gn.support = !1
    }
    var Zn = function(n) {
        var t = gn(),
            e = (window.navigator || {}).userAgent,
            r = {},
            a = function(t) {
                try {
                    Object.assign(r, t instanceof Object ? t : {
                        "meta._ver": 2,
                        "meta._dataName": "pip_lyric_monitor",
                        action: t,
                        userAgent: e,
                        chromeVersion: m,
                        resourceId: r.id,
                        resourceType: r.type
                    })
                } catch (n) {}
            },
            de = function(n, d = document) {
                if (n && typeof n === "string") {
                    ("." === n.charAt(0) || "#" === n.charAt(0)) && (n = n.slice(1))
                    return (d.getElementsByClassName(n) || [])[0] || d.getElementById(n)
                } else return n
            },
            audio = (a(n), r.audio instanceof HTMLAudioElement) && r.audio;
        var u = window.navigator.mediaSession,
            d = de(r.parent) || document.body,
            s = function(n) {
                if (d) {
                    var t = de(n);
                    t && t.click()
                }
            },
            h = function() {
                return r.play ? s(r.play) : audio && audio.play()
            },
            p = function() {
                return r.pause ? s(r.pause) : audio && audio.pause()
            },
            prev = function() {
                return s(r.prev)
            },
            next = function() {
                return s(r.next)
            },
            i = de(r.pip) || function(l) {
                let i = document.createElement("a");
                i.href = "javascript:;",
                    i.setAttribute("hidefocus", "true"),
                    i.className = "icn icn-pip",
                    i.title = "画中画歌词",
                    i.textContent = "." || "画中画歌词";
                if (l) {
                    l.insertBefore(i, l.firstChild);
                    a("impress")
                }
                return i
            }(d),
            o = i && i.classList;
        if (i && o) {
            /Chrom(e|ium)/.test(e) || i.appendChild(t.video);
            i.onclick = function() {
                t[t.entered ? "leave" : "enter"]()
            }
        } else throw console.error("PiP", "Not Element"),
            new Error("newPipLyricError");
        u && d && (u.setActionHandler("play", h),
                   u.setActionHandler("pause", p),
                   r.prev && u.setActionHandler("previoustrack", prev),
                   r.next && u.setActionHandler("nexttrack", next));
        audio && (audio.addEventListener("play", t.play),
                  audio.addEventListener("pause", t.pause),
                  audio.addEventListener("timeupdate", function () {
            try {
                audio.currentTime > .1 && t.updateTime(audio.currentTime);
            } catch (e) {}
        }));
        var f = {};
        t.onEnter = function() {
            o.contains("active") || o.add("active"),
                f.enter && f.enter(),
                a("enter")
        },
            t.onLeave = function() {
            o.contains("active") && o.remove("active"),
                f.leave && f.leave(),
                a("leave")
        },
            t.onPlay = function() {
            return h()
        },
            t.onPause = function() {
            return p()
        },
            Object.defineProperty(t, "onEnter", {
            set: function(n) {
                f.enter = n
            }
        }),
            Object.defineProperty(t, "onLeave", {
            set: function(n) {
                f.leave = n
            }
        });
        var b = t.setData;
        return t.setData = function(n, t) {
            var e = n || {},
                i = e.id,
                o = e.program;
            r.id = i,
                r.type = o ? "program" : "song",
                b(n, t),
                a("render")
        },
            t
    };
    return Object.defineProperty(Zn, "support", {
        get: function() {
            return gn.support
        }
    }),
        Zn
}));
