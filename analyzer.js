class Analyzer {
    static DEFAULT_CONFIG = {
        fftSize: 2048, // 1024、2048、4096、8192、16384 32-32768
        smoothing: 0.8, // 平滑度
        dataScale: 0.65, // 信号源截取宽度
        intensity: 1.0, // 额外信号强度
        lineWidth: 2, // 绘制线条粗细
        mode: 'random', // 'random', 模式
        colors: [], // 颜色组
        randomMode: true,
        randomColors: true,
    }

    static MODES = [
        "lightning", // 闪电效果
        "bars", // 条形图
        "doubleBars", // 双条形图
        "doubleLine", // 双线图
        "vertLines", // 垂直线
        "waves", // 波形图
        "circular", // 圆形
        "terrain", // 地形
        "mirror", // 镜像
        "threeD", // 3D效果
    ]

    constructor(options = {}) {
        this.options = { ...Analyzer.DEFAULT_CONFIG, ...options };
        if (this.options.debug) {
            console.log(this.options, 'Analyzer.options');
        }

        this.canvas = null;
        this.mediaElement = null;
        this.audioCtx = null;

        this._initCanvas();
        this._initMediaElement();
        this._initAudioContext();
        if (this.canvas && this.mediaElement && this.audioCtx) {
            this._createAnalyser();
            this._initVisualization();
            this._setupEventListeners();
        }
    }

    _initCanvas() {
        if (this.options.canvas instanceof HTMLCanvasElement) {
            this.canvas = this.options.canvas;
            this.ctx = this.canvas.getContext('2d');
        } else if (document.querySelector('canvas') instanceof HTMLCanvasElement) {
            this.canvas = document.querySelector('canvas');
            this.ctx = this.canvas.getContext('2d');
        } else {
            // throw new Error('Not HTMLCanvasElement');
            console.error('Not HTMLCanvasElement');
        }
    }

    _initMediaElement() {
        if (this.options.mediaElement instanceof HTMLMediaElement) {
            this.mediaElement = this.options.mediaElement;
        }
        else if (this.options.audio instanceof HTMLAudioElement) {
            this.mediaElement = this.options.audio;
        } else if (this.options.video instanceof HTMLVideoElement) {
            this.mediaElement = this.options.video;
        } else if (document.querySelector('audio, video')) {
            this.mediaElement = document.querySelector('audio, video');
        } else {
            // throw new Error('Not HTMLMediaElement');
            console.error('Not HTMLMediaElement');
        }
    }

    _initAudioContext() {
        if (this.options.audioCtx) {
            this.audioCtx = this.options.audioCtx;
        } else {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) throw new Error('Web Audio API Not Supported');
            this.audioCtx = new AudioCtx();
        }
    }

    _createAnalyser() {
        if (this.analyser) {
            this.source.disconnect();
            this.analyser.disconnect();
        }

        const { fftSize, smoothing } = this.options;
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = fftSize;
        this.analyser.smoothingTimeConstant = smoothing;

        this.bufferLength = this.analyser.frequencyBinCount;
        this.frequencyData = new Uint8Array(this.bufferLength);
        this.timeDomainData = new Uint8Array(this.bufferLength);

        this.source = this.audioCtx.createMediaElementSource(this.mediaElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
    }

    _initVisualization() {
        this.lastRenderTime = 0;
        this.animationId = null;
        this.gradient = null;
        this.cleanup = [];
        this.randomModeAndColors();
        this.start();
    }

    _setupEventListeners() {
        const resizeHandler = () => {
            const { width, height } = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = width;
            this.canvas.height = height;
            this.gradient = null;
        };
        window.addEventListener('resize', resizeHandler);
        this.cleanup.push(() => window.removeEventListener('resize', resizeHandler));

        const playHandler = () => {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            this.start();
        };
        this.mediaElement.addEventListener('play', playHandler);
        this.cleanup.push(() => this.mediaElement.removeEventListener('play', playHandler));

        const pauseHandler = () => this.stop();
        this.mediaElement.addEventListener('pause', pauseHandler);
        this.cleanup.push(() => this.mediaElement.removeEventListener('pause', pauseHandler));

        const listswitchHandler = () => {
            let src = this.mediaElement.src;
            return () => {
                if (src !== this.mediaElement.src) {
                    src = this.mediaElement.src;
                    this.randomModeAndColors();
                }
            };
        }
        this.mediaElement.addEventListener('durationchange', listswitchHandler());
        this.cleanup.push(() => this.mediaElement.removeEventListener('durationchange', listswitchHandler()));
    }

    start() {
        if (this.animationId) return;
        this.lastRenderTime = performance.now();
        this._renderFrame();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.animationId = null;
        }
    }

    destroy() {
        this.stop();
        this.cleanup.forEach(fn => fn());
        this.source.disconnect();
        this.analyser.disconnect();

        if (this.audioCtx.state !== 'closed') {
            this.audioCtx.close();
        }

        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    _renderFrame() {
        this.animationId = requestAnimationFrame(() => this._renderFrame());

        const now = performance.now();
        if (now - this.lastRenderTime < 1000 / 30) return;
        this.lastRenderTime = now;

        // 复制频率数据
        if (this.options.mode === 'lightning') {
            this.analyser.getByteTimeDomainData(this.timeDomainData);
        } else {
            this.analyser.getByteFrequencyData(this.frequencyData);
        }

        this._renderVisualization();
    }

    _renderVisualization() {
        const { canvas, ctx } = this;
        const { width, height } = canvas;

        ctx.clearRect(0, 0, width, height);

        const { mode, colors, dataScale } = this.options;
        this.frequencyData = this.frequencyData.slice(0, this.bufferLength * dataScale);

        if (!this.gradient) {
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            const step = 1 / (colors.length - 1);
            colors.forEach((color, i) => {
                gradient.addColorStop(i * step, color);
            });
            this.gradient = gradient;
        }

        if (typeof this[mode] === 'function') {
            this[mode](ctx, width, height);
        }
    }

    randomModeAndColors() {
        const { mode, randomMode, colors, randomColors, debug } = this.options;
        if (randomMode || !Analyzer.MODES.some(m => m === mode)) {
            this.randomMode();
            if (debug) {
                console.log(`mode %c ${this.options.mode}`, `color: #fff; background: green`);
            }
        }
        if (randomColors || !(Array.isArray(colors) && colors.length)) {
            this.randomColors();

            if (debug) {
                console.group('colors');
                this.options.colors.forEach((color) => {
                    console.log(`%c ${color}`, `color: #fff; background: ${color}`);
                });
                console.groupEnd();
            }
        }
    }

    randomMode() {
        const MODES = Analyzer.MODES;
        const { mode } = this.options;
        const otherModes = MODES.filter(m => m !== mode);
        this.options.mode = otherModes.length ? otherModes[Math.floor(Math.random() * otherModes.length)] : MODES[0];
    }

    randomColors() {
        const randomColors = this._generateColorScheme(this.options.colorScheme || {
            schemeType: 'multiple',
            saturation: 'high',
            brightness: 'high',
            adjustType: 'neon',
        });
        this.options.colors = randomColors;
        this.gradient = null;
    }

    _generateColorScheme(options = {}) {
        // 配置选项与默认值
        const config = {
            schemeType: options.schemeType || ['complementary', 'multiple', 'analogous', 'vibrant'][Math.floor(Math.random() * 4)],
            saturation: options.saturation || ['high', 'medium', 'mixed'][Math.floor(Math.random() * 3)],
            brightness: options.brightness || ['high', 'medium', 'mixed'][Math.floor(Math.random() * 3)],
            adjustType: options.brightness || ['light', 'dark', 'neon'][Math.floor(Math.random() * 3)],
            baseHue: options.baseHue ?? Math.floor(Math.random() * 360),
        };

        // 根据饱和度类型获取具体值
        const getSaturation = (type, isSecondary = false) => {
            switch(type) {
                case 'high': return isSecondary ? 80 : 95;
                case 'medium': return isSecondary ? 60 : 75;
                case 'mixed': return isSecondary ? 40 + Math.random() * 40 : 70 + Math.random() * 25;
                default: return 90;
            }
        };

        // 根据亮度类型获取具体值
        const getBrightness = (type, isSecondary = false) => {
            switch(type) {
                case 'high': return isSecondary ? 70 : 85;
                case 'medium': return isSecondary ? 50 : 65;
                case 'mixed': return isSecondary ? 40 + Math.random() * 40 : 65 + Math.random() * 20;
                default: return 80;
            }
        };

        // HSL转Hex
        const hslToHex = (h, s, l) => {
            h /= 360; s /= 100; l /= 100;

            let r, g, b;
            if (s === 0) {
                r = g = b = l; // 灰度
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };

                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;

                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }

            const toHex = x => {
                const hex = Math.round(x * 255).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };

            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        };

        // RGB转HSL
        const rgbToHsl = (r, g, b) => {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;

            if (max === min) {
                h = s = 0; // 灰度
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

                switch(max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }

                h = (h * 60) % 360;
                if (h < 0) h += 360;
            }

            return [h, s * 100, l * 100];
        };

        const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

        // 颜色方案生成函数
        const schemes = {
            complementary: () => {
                const s = getSaturation(config.saturation);
                const l = getBrightness(config.brightness);
                return [
                    hslToHex(config.baseHue, s, l),
                    hslToHex((config.baseHue + 180) % 360, getSaturation(config.saturation, true), getBrightness(config.brightness, true))
                ];
            },
            multiple: () => {
                const count = 3 + Math.floor(Math.random() * 3);
                const step = 360 / count;
                return Array.from({ length: count }, (_, i) => {
                    const hue = (config.baseHue + i * step) % 360;
                    return hslToHex(hue, getSaturation(config.saturation, i > 0), getBrightness(config.brightness, i > 0));
                });
            },
            analogous: () => {
                const offsets = [-2, -1, 1, 2]; // 跳过基色，生成4个邻近色
                return offsets.map(i => {
                    const hue = (config.baseHue + i * 30 + 360) % 360;
                    return hslToHex(hue, getSaturation(config.saturation, i !== -2), getBrightness(config.brightness, i !== -2));
                });
            },
            vibrant: () => {
                const count = 3 + Math.floor(Math.random() * 3);
                return Array.from({ length: count }, () => {
                    const hue = (config.baseHue + Math.random() * 120 - 60 + 360) % 360;
                    return hslToHex(hue, getSaturation(config.saturation), getBrightness(config.brightness));
                });
            }
        };

        const displayColorScheme = (colors, adjustType) => {
            switch(adjustType) {
                case 'light': return colors.map(color => adjustColor(color, 0, 20)); //浅色变体
                case 'neon': return colors.map(color => adjustColor(color, 30, 0, true)); // 霓虹变体
                case 'dark': return colors.map(color => adjustColor(color, -20, -20)); // 深色变体
                default: return colors;
            }
        }

        const adjustColor = (hex, satDelta = 0, lightDelta = 0, neon = false) => {
            const r = parseInt(hex.substr(1, 2), 16);
            const g = parseInt(hex.substr(3, 2), 16);
            const b = parseInt(hex.substr(5, 2), 16);
            let [h, s, l] = rgbToHsl(r, g, b);

            // 应用调整并限制在有效范围内
            s = clamp(s + satDelta, 0, 100);
            l = clamp(l + lightDelta, 0, 100);

            // 霓虹效果增强饱和度
            if (neon) s = clamp(s + 30, 0, 100);

            return hslToHex(h, s, l);
        }

        const colors = (schemes[config.schemeType] || schemes.complementary)();
        return displayColorScheme(colors, config.schemeType);
    }

    get mode () {
        return this.options.mode;
    }

    set mode(val) {
        if (Analyzer.MODES.includes(val)) {
            this.options.mode = val;
        }
    }

    get colors () {
        return this.options.colors;
    }

    set colors(val) {
        if (Array.isArray(val) && val.length) {
            this.options.colors = val;
            this.gradient = null;
        }
    }

    // 闪电效果
    lightning(ctx, width, height) {
        const { options, bufferLength, timeDomainData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = width / 5;
        const step = width / count;
        const centerY = height / 2;
        const ratio = bufferLength / 3 / count;

        ctx.beginPath();

        for (let i = 0; i < count; i++) {
            const value = timeDomainData[Math.floor(i * ratio)] / 128.0;
            const y = Math.min(value * centerY * intensity, height);
            const x = i * step;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth + Math.round(Math.random() * 3);
        ctx.stroke();
    }

    // 条形图
    bars(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = width / 5;
        const ratio = frequencyData.length / count;
        const step = width / count;
        const barWidth = step * 0.5;

        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * height * intensity, height);
            const x = i * step;

            ctx.fillStyle = gradient;
            ctx.lineWidth = lineWidth;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        }
    }

    // 双条形图
    doubleBars(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = width / 5;
        const ratio = frequencyData.length / count;
        const step = width / count;
        const barWidth = step * 0.5;
        const centerY = height / 2;

        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = value * centerY * intensity;
            const x = i * step;

            // 顶部条形
            ctx.fillStyle = gradient;
            ctx.lineWidth = lineWidth;
            ctx.fillRect(x, 0, barWidth, barHeight);

            // 底部条形
            ctx.fillStyle = gradient;
            ctx.lineWidth = lineWidth;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        }
    }

    // 双线图
    doubleLine(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = width / 2;
        const ratio = frequencyData.length / count;
        const step = width / count;
        const centerY = height / 2;

        ctx.beginPath();

        // 上线
        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * centerY * intensity, centerY);
            const x = i * step;
            const y = centerY - barHeight;

            ctx.lineTo(x, y);
        }

        // 下线
        for (let i = count - 1; i >= 0; i--) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * centerY * intensity, centerY);
            const x = i * step;
            const y = centerY + barHeight;

            ctx.lineTo(x, y);
        }

        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        ctx.closePath();
        ctx.stroke();

        // 两线之间填充
        //ctx.fillStyle = gradient;
        //ctx.globalAlpha = 0.3;
        //ctx.fill();
        //ctx.globalAlpha = 1;
    }

    // 垂直线
    vertLines(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = width / 5;
        const ratio = frequencyData.length / count;
        const step = width / count;

        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * height * intensity, height);
            const x = i * step;
            const startY = height / 2 - barHeight / 2;
            const endY = height / 2 + barHeight / 2;

            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = lineWidth;
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
    }

    // 波形图
    waves(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = width / 2;
        const ratio = frequencyData.length / count;
        const step = width / count;
        const centerY = height / 2;

        // 绘制多个波形层
        for (let layer = 0; layer < 3; layer++) {
            const layerFactor = 1 - layer * 0.2;
            const alpha = 0.6 - layer * 0.2;

            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = lineWidth;

            // 上半部分波形
            for (let i = 0; i < count; i++) {
                const value = frequencyData[Math.floor(i * ratio)] / 255 * layerFactor;
                const barHeight = Math.min(value * centerY * intensity, centerY);
                const x = i * step;
                const y = centerY - barHeight;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            // 下半部分波形
            for (let i = count - 1; i >= 0; i--) {
                const value = frequencyData[Math.floor(i * ratio)] / 255 * layerFactor;
                const barHeight = Math.min(value * centerY * intensity, centerY);
                const x = i * step;
                const y = centerY + barHeight;

                ctx.lineTo(x, y);
            }

            ctx.closePath();
            ctx.stroke();

            // 使用渐变填充
            ctx.fillStyle = gradient;
            ctx.globalAlpha = alpha * 0.3;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // 圆形
    circular(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = width / 10;
        const ratio = frequencyData.length / count;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 3;
        const barRadius = radius / 2;
        const angleIncrement = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const amplitude = value * radius * intensity;
            const angle = i * angleIncrement;

            // 计算3D位置
            const x1 = centerX + Math.cos(angle) * barRadius;
            const y1 = centerY + Math.sin(angle) * barRadius;

            const x2 = centerX + Math.cos(angle) * (barRadius + amplitude);
            const y2 = centerY + Math.sin(angle) * (barRadius + amplitude);

            // 绘制柱子
            const z = Math.sin(angle) * 50;
            const scale = (100 - z) / 100;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = gradient;
            ctx.globalAlpha = scale;
            ctx.lineWidth = lineWidth * scale;
            ctx.stroke();

            // 绘制顶部圆形
            ctx.beginPath();
            ctx.arc(x2, y2, 5 * scale, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.lineWidth = lineWidth;
            ctx.fill();
        }

        // 外圆
        const maxValue = Math.max(...Array.from(frequencyData.slice(0, count)));
        const pulseSize = (maxValue / 255) * 50;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.fill();
        ctx.globalAlpha = 1;

        // 内圆
        ctx.beginPath();
        ctx.arc(centerX, centerY, barRadius, 0, Math.PI * 2);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 中心点
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius / 5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // 地形
    terrain(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth, colors } = options;
        const count = width / 2;
        const ratio = frequencyData.length / count;
        const step = width / count;
        const baseReduce = 0.8;
        const baseLineY = height * 3 / 4; // 底部地形在1/4高度处

        ctx.beginPath();

        // 绘制地形形状（从底部开始）
        ctx.moveTo(0, height);
        ctx.lineTo(0, baseLineY);

        // 创建地形山峰
        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * height * intensity, height) * baseReduce;
            const x = i * step;
            const y = baseLineY - barHeight;
            ctx.lineTo(x, y);
        }

        // 右侧到基准线并闭合路径
        ctx.lineTo(width, baseLineY);
        ctx.lineTo(width, height);
        ctx.closePath();

        // 创建地形渐变（从山顶到底部）
        const terrainGradient = ctx.createLinearGradient(0, 0, 0, height);
        const terrainstep = 1 / (colors.length - 1);
        colors.forEach((color, i) => {
            terrainGradient.addColorStop(i * terrainstep, color);
        });
        ctx.fillStyle = terrainGradient;
        ctx.fill();

        // 绘制地形轮廓线（只绘制山脉部分）
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * height * intensity, height) * baseReduce;

            const x = i * step;
            const y = baseLineY - barHeight;

            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, baseLineY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 创建底部波浪形阴影
        ctx.beginPath();
        ctx.moveTo(0, baseLineY);
        for (let i = 0; i < count; i++) {
            const x = i * step;
            const waveHeight = Math.sin(i * 0.3) * 10;
            ctx.lineTo(x, baseLineY + waveHeight);
        }
        ctx.lineTo(width, baseLineY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();

        // 添加基准线标记
        ctx.beginPath();
        ctx.moveTo(0, baseLineY);
        ctx.lineTo(width, baseLineY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // 镜像
    mirror(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = width / 2;
        const ratio = frequencyData.length / count;
        const step = width / count;
        const centerY = height / 2;

        // 上半部分
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * centerY * intensity, centerY);
            const x = i * step;
            const y = centerY - barHeight;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // 下半部分（镜像）
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * centerY * intensity, centerY);
            const x = i * step;
            const y = centerY + barHeight;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.strokeStyle = gradient;
        ctx.stroke();

        // 连接线
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * centerY * intensity, centerY);
            const x = i * step;

            ctx.moveTo(x, centerY - barHeight);
            ctx.lineTo(x, centerY + barHeight);
        }
        ctx.strokeStyle = gradient;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // 3D
    threeD(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { colors, intensity, lineWidth } = options;
        const count = width / 5;
        const ratio = frequencyData.length / count;
        const step = width / count;
        const barWidth = step * 0.8;
        const color = colors[0];

        // 底部顶部留出空间
        const bottomMargin = 20;
        const baseY = height - bottomMargin;
        const maxHeight = height - bottomMargin - 20;

        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const barHeight = Math.min(value * maxHeight * intensity, maxHeight);
            const x = i * step;
            const topY = baseY - barHeight;

            // 绘制3D柱体（从底部向上）
            ctx.fillStyle = gradient;
            ctx.fillRect(x, topY, barWidth, barHeight);

            // 绘制顶部（高光效果）
            ctx.fillStyle = color + 'dd';
            ctx.fillRect(x, topY, barWidth, 4);

            // 绘制侧面（阴影效果）
            ctx.fillStyle = color + '66';
            ctx.fillRect(x + barWidth - 3, topY, 3, barHeight);

            // 绘制底部（投影效果）
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(x, baseY, barWidth, 3);
        }

        // 添加地面效果
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.lineTo(width, baseY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 添加背景网格增强3D感
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // 水平网格线
        for (let y = baseY; y > 20; y -= 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // 垂直网格线
        for (let x = 0; x < width; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, baseY);
            ctx.stroke();
        }
    }
}
window.Analyzer = Analyzer;
