class AudioAnalyzer {
    static VERSION = '1.0.1'

    static DEFAULT_CONFIG = {
        fftSize: 2048, // 32-32768范围内的2的非零幂
        smoothing: 0.8, // 平滑度
        dataScale: 0.65, // 信号源截取宽度
        intensity: 1.0, // 信号强度
        lineWidth: 2, // 绘制线条粗细
        mode: '', // 可视化模板
        colors: [], // 颜色组
        colorScheme: {},
        randomMode: true,
        randomColors: true,
        backgroundGrid: false
    }

    static MODES = [
        "bars",
        "doubleBars",
        "doubleLine",
        "vertLines",
        "waves",
        "circular",
        "terrain",
        "mirror",
        "threeD",
        'plasma',
        "lightning",
        'waveform',
    ]

    constructor(options = {}) {
        this.options = { ...AudioAnalyzer.DEFAULT_CONFIG, ...options };

        this.debug = this.options.debug;
        this.mediaElement = null;
        this.canvas = null;
        this.audioCtx = null;

        this._initMediaElement();
        this._initCanvas();
        this.init();

        if (this.debug) {
            console.log(
                `%c AudioAnalyzer v${AudioAnalyzer.VERSION} %c             `,
                `color: #fadfa3; background: #030307; padding:5px 0;`,
                `background: #fadfa3; padding:5px 0;`,
            );
        }
    }

    init() {
        if (this.mediaElement) {
            this._initAudioContext();
            this._createAnalyser();

            if (this.canvas) {
                this.initVisualization();
            }
        }
    }

    initVisualization() {
        this.lastRenderTime = 0;
        this.animationId = null;
        this.gradient = null;
        this.randomModeAndColors();
        this.startVisualization();
        if (this.cleanup && this.cleanup.length) {
            this.cleanup.forEach(fn => fn());
        }
        this.cleanup = [];
        this._setupEventListeners();
    }

    startVisualization() {
        if (this.animationId) return;
        this.lastRenderTime = performance.now();
        this._renderFrame();
    }

    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.animationId = null;
        }
    }

    destroy() {
        this.stopVisualization();

        if (this.cleanup && this.cleanup.length) {
            this.cleanup.forEach(fn => fn());
            this.cleanup = [];
        }

        if (this.audioCtx && this.audioCtx.state !== 'closed') {
            this.audioCtx.close();
        }

        if (this.analyser) {
            this.source.disconnect();
            this.analyser.disconnect();
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    _initAudioContext() {
        if (this.audioCtx) return;
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

        switch(this.sourceType) {
            case 'mediaElement': return this._createMediaElementSource();
            case 'binaryFile': return this._createBufferSource();
            default: break;
        }
    }

    _createMediaElementSource() {
        this.source = this.audioCtx.createMediaElementSource(this.mediaElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
    }

    _createBufferSource() {
        const arrayData = this.mediaElement;
        const decodeAudioData = (arrayBuffer) => {
            this.audioCtx.decodeAudioData(arrayBuffer, (audioBuffer) => {
                this.source = this.audioCtx.createBufferSource();
                this.source.buffer = audioBuffer;
                this.source.connect(this.analyser);
                this.analyser.connect(this.audioCtx.destination);
            });
        };

        if (arrayData instanceof ArrayBuffer) {
            decodeAudioData(arrayData);
        } else if (arrayData instanceof Blob || arrayData instanceof File) {
            const reader = new FileReader();
            reader.onload = (event) => {
                decodeAudioData(event.target.result);
            };
            reader.onerror = (error) => {
                throw new Error(error);
            };
            reader.readAsArrayBuffer(arrayData);
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
            console.warn('Not HTMLMediaElement');
        }
    }

    _initCanvas() {
        if (this.options.canvas instanceof HTMLCanvasElement) {
            this.canvas = this.options.canvas;
        } else if (document.querySelector('canvas') instanceof HTMLCanvasElement) {
            this.canvas = document.querySelector('canvas');
        } else {
            console.warn('Not HTMLCanvasElement');
        }
    }

    _setupEventListeners() {
        const { cleanup, canvas, audioCtx, mediaElement } = this;
        if (mediaElement instanceof HTMLMediaElement === false) return;

        const resizeHandler = () => {
            const { width, height } = canvas.parentElement.getBoundingClientRect();
            canvas.width = width;
            canvas.height = height;
            this.gradient = null;
        };
        window.addEventListener('resize', resizeHandler);
        cleanup.push(() => window.removeEventListener('resize', resizeHandler));

        const playHandler = () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            this.startVisualization();
        };
        mediaElement.addEventListener('play', playHandler);
        cleanup.push(() => mediaElement.removeEventListener('play', playHandler));

        const pauseHandler = () => this.stopVisualization();
        mediaElement.addEventListener('pause', pauseHandler);
        cleanup.push(() => mediaElement.removeEventListener('pause', pauseHandler));

        const listswitchHandler = () => {
            let src = mediaElement.src;
            return () => {
                if (src !== mediaElement.src) {
                    src = mediaElement.src;
                    this.randomModeAndColors();
                }
            };
        }
        mediaElement.addEventListener('loadedmetadata', listswitchHandler());
        cleanup.push(() => mediaElement.removeEventListener('durationchange', listswitchHandler()));

        const errorHandler = () => {
            console.error(
                `Error ${mediaElement.error.code}; details: ${mediaElement.error.message}`
            );
        };
        mediaElement.addEventListener('error', errorHandler);
        cleanup.push(() => mediaElement.removeEventListener('error', errorHandler));
    }

    _renderFrame() {
        if (!this.analyser || !this.canvas) return;
        this.animationId = requestAnimationFrame(() => this._renderFrame());

        const now = performance.now();
        if (now - this.lastRenderTime < 1000 / 30) return;
        this.lastRenderTime = now;

        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeDomainData);

        this._renderVisualization();
    }

    _renderVisualization() {
        const { canvas, ctx } = this;
        const { width, height } = canvas;

        ctx.clearRect(0, 0, width, height);

        const { mode, colors, dataScale, backgroundGrid } = this.options;
        this.frequencyData = this.frequencyData.slice(0, this.bufferLength * dataScale);

        if (!this.gradient) {
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            const step = 1 / (colors.length - 1);
            colors.forEach((color, i) => {
                gradient.addColorStop(i * step, color);
            });
            this.gradient = gradient;
        }

        const renderMethod = this[mode] || this.bars;
        renderMethod.call(this, ctx, width, height);

        if (backgroundGrid) {
            this.backgroundGrid(ctx, width, height);
        }
    }

    randomModeAndColors() {
        const { mode, randomMode, colors, randomColors } = this.options;
        if (randomMode || !AudioAnalyzer.MODES.includes(mode)) {
            this.randomMode();

            if (this.debug) {
                console.log(`Curr Mode %c ${this.options.mode}`, `color: #fff; background: green`);
            }
        }
        if (randomColors || !(Array.isArray(colors) && colors.length)) {
            this.randomColors();

            if (this.debug) {
                console.group('Curr Colors');
                this.options.colors.forEach((color) => {
                    console.log(`%c ${color}`, `color: #fff; background: ${color}`);
                });
                console.groupEnd();
            }
        }
    }

    randomMode() {
        const MODES = AudioAnalyzer.MODES;
        const { mode } = this.options;
        const otherModes = MODES.filter(m => m !== mode);
        this.options.mode = otherModes.length ? otherModes[Math.floor(Math.random() * otherModes.length)] : MODES[0];
    }

    randomColors() {
        const randomColors = this._generateColorScheme({} || this.options.colorScheme || {});
        this.options.colors = randomColors;
        this.gradient = null;
    }

    _generateColorScheme(options = {}) {
        const config = {
            schemeType: options.schemeType || 'random',
            baseHue: options.baseHue ?? Math.floor(Math.random() * 360),
            ...options
        };

        const schemes = {
            monochrome: () => [hslToHex(config.baseHue, 90, 60)],
            complementary: () => [
                hslToHex(config.baseHue, 90, 60),
                hslToHex((config.baseHue + 180) % 360, 90, 60)
            ],
            triadic: () => [
                hslToHex(config.baseHue, 90, 60),
                hslToHex((config.baseHue + 120) % 360, 90, 60),
                hslToHex((config.baseHue + 240) % 360, 90, 60)
            ],
            tetradic: () => [
                hslToHex(config.baseHue, 90, 60),
                hslToHex((config.baseHue + 90) % 360, 90, 60),
                hslToHex((config.baseHue + 180) % 360, 90, 60),
                hslToHex((config.baseHue + 270) % 360, 90, 60)
            ],
            analogous: () => [
                hslToHex((config.baseHue - 30 + 360) % 360, 90, 60),
                hslToHex(config.baseHue, 90, 60),
                hslToHex((config.baseHue + 30) % 360, 90, 60)
            ],
            rainbow: () => Array.from({ length: 6 }, (_, i) =>hslToHex((config.baseHue + i * 60) % 360, 90, 60)),
            random: () => Array.from({ length: 5 }, () =>hslToHex(Math.random() * 360, 80 + Math.random() * 20, 60 + Math.random() * 30))
        };

        const hslToHex = (h, s, l) => {
            h /= 360; s /= 100; l /= 100;
            let r, g, b;

            if (s === 0) {
                r = g = b = l;
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

            return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
        }

        return (schemes[config.schemeType] || schemes.random)();
    }

    get canvas () {
        return this.options.canvas;
    }

    set canvas(val) {
        if (val instanceof HTMLCanvasElement) {
            this.options.canvas = val;
            this.ctx = val.getContext('2d');
        }
    }

    get mediaElement () {
        return this.options.mediaElement;
    }

    set mediaElement(val) {
        if (val instanceof HTMLMediaElement) {
            this.options.mediaElement = val;
            this.options.sourceType = 'mediaElement';
        } else if (val instanceof ArrayBuffer || val instanceof Blob || val instanceof File) {
            this.options.mediaElement = val;
            this.options.sourceType = 'binaryFile';
        }
    }

    get mode () {
        return this.options.mode;
    }

    set mode(val) {
        if (AudioAnalyzer.MODES.includes(val) || typeof this[val] === 'function') {
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

    get sourceType () {
        return this.options.sourceType;
    }

    // 条形图
    bars(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = Math.min(width / 5, frequencyData.length);
        const step = width / count;
        const ratio = frequencyData.length / count;
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
        const count = Math.min(width / 5, frequencyData.length);
        const step = width / count;
        const ratio = frequencyData.length / count;
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
        const count = Math.min(width / 2, frequencyData.length);
        const step = width / count;
        const ratio = frequencyData.length / count;
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
        const count = Math.min(width / 5, frequencyData.length);
        const step = width / count;
        const ratio = frequencyData.length / count;

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
        const count = Math.min(width / 2, frequencyData.length);
        const step = width / count;
        const ratio = frequencyData.length / count;
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
            ctx.globalAlpha = alpha * 0.5;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // 圆形
    circular(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = Math.min(width / 10, frequencyData.length);
        const ratio = frequencyData.length / count;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2.5;
        const barRadius = radius / 2;
        const angleIncrement = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const amplitude = value * radius * intensity;
            const angle = i * angleIncrement;

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
            ctx.arc(x2, y2, 5 - scale, 0, Math.PI * 2);
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
        ctx.arc(centerX, centerY, pulseSize / 5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // 地形
    terrain(ctx, width, height) {
        const { options, frequencyData, gradient } = this;
        const { intensity, lineWidth, colors } = options;
        const count = Math.min(width / 2, frequencyData.length);
        const step = width / count;
        const ratio = frequencyData.length / count;
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
        const count = Math.min(width / 2, frequencyData.length);
        const step = width / count;
        const ratio = frequencyData.length / count;
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
        const count = Math.min(width / 5, frequencyData.length);
        const step = width / count;
        const ratio = frequencyData.length / count;
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
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    // 等离子效果
    plasma(ctx, width, height) {
        const { frequencyData, gradient, options } = this;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2;
        const segmentCount = Math.min(36, frequencyData.length);
        const ratio = frequencyData.length / segmentCount;
        const angleStep = Math.PI * 2 / segmentCount;

        ctx.beginPath();

        for (let i = 0; i < segmentCount; i++) {
            const value = frequencyData[Math.floor(i * ratio)] / 255;
            const angle = i * angleStep;
            const distance = radius * (0.5 + value * options.intensity);

            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = options.lineWidth;
        ctx.stroke();
    }

    // 闪电效果
    lightning(ctx, width, height) {
        const { options, bufferLength, timeDomainData, gradient } = this;
        const { intensity, lineWidth } = options;
        const count = Math.min(width / 5, timeDomainData.length);
        const step = width / count;
        const ratio = timeDomainData.length / count;
        const centerY = height / 2;

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

    // 波形
    waveform(ctx, width, height) {
        const { timeDomainData, gradient, options } = this;
        const centerY = height / 2;
        const sliceWidth = width / timeDomainData.length;

        ctx.beginPath();
        ctx.moveTo(0, centerY);

        timeDomainData.forEach((value, i) => {
            const amplitude = (value - 128) / 128;
            const x = i * sliceWidth;
            const y = centerY - amplitude * centerY * options.intensity;
            ctx.lineTo(x, y);
        });

        ctx.lineTo(width, centerY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = options.lineWidth;
        ctx.stroke();
    }

    // 背景网格
    backgroundGrid(ctx, width, height) {
        const gridCols = Math.floor(width / 20);
        const gridRows = Math.floor(height / 20);

        const gridWidth = width / gridCols;
        const gridHeight = height / gridRows;

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 0.5;

        // 垂直线
        for (let col = 0; col <= gridCols; col++) {
            const x = col * gridWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // 水平线
        for (let row = 0; row <= gridRows; row++) {
            const y = row * gridHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // 绘制边框
        ctx.strokeRect(0, 0, width, height);
    }
}

if (typeof window === 'object') {
    window.AudioAnalyzer = AudioAnalyzer;
}
