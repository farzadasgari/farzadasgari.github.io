(function (global) {
    'use strict';
    let REDUCED = global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let PURPLE = [124, 58, 237];
    let VIOLET = [167, 139, 250];
    let CYAN = [34, 211, 238];

    function rgba(c, a) {
        return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    }

    function rand(a, b) {
        return a + Math.random() * (b - a);
    }

    function clamp(v, a, b) {
        return v < a ? a : v > b ? b : v;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function easeOut(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function deviceTier() {
        let w = global.innerWidth;
        if (w < 768) return 'mobile';
        if (w < 1200) return 'tablet';
        return 'desktop';
    }

    function fit(canvas, ctx, maxDpr) {
        let rect = canvas.getBoundingClientRect();
        let w = rect.width || canvas.clientWidth || 1;
        let h = rect.height || canvas.clientHeight || 1;
        let dpr = Math.min(global.devicePixelRatio || 1, maxDpr || 2);
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return {w: w, h: h, dpr: dpr};
    }

    function whenVisible(el, onEnter, onLeave) {
        if (!('IntersectionObserver' in global)) {
            onEnter();
            return;
        }
        let io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    onEnter();
                } else if (onLeave) {
                    onLeave();
                }
            });
        }, {threshold: 0.05});
        io.observe(el);
    }

    function NeuralField(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', {alpha: true});
        this.neurons = [];
        this.signals = [];
        this.waves = [];
        this.links = [];
        this.mouse = {x: -9999, y: -9999, active: false};
        this.energy = 0;
        this.raf = null;
        this.last = 0;
        this.acc = 0;
        this.showLabels = false;
        this.stars = null;
        this.paused = false;
        this.frameMs = 0;
        this.init();
    }

    NeuralField.prototype.config = function () {
        let tier = deviceTier();
        let area = global.innerWidth * global.innerHeight;
        if (tier === 'mobile') {
            return {
                count: clamp(Math.round(area / 14000), 35, 60), dist: 132, dpr: 1.5,
                signals: 14, interact: false, minStep: 24
            };
        }
        if (tier === 'tablet') {
            return {
                count: clamp(Math.round(area / 11000), 70, 100), dist: 165, dpr: 1.75,
                signals: 22, interact: true, minStep: 16
            };
        }
        return {
            count: clamp(Math.round(area / 8000), 110, 160), dist: 186, dpr: 2,
            signals: 34, interact: true, minStep: 0
        };
    };

    NeuralField.prototype.init = function () {
        let self = this;
        this.cfg = this.config();
        this.resize();
        this.build();

        this._onResize = this.debounce(function () {
            let prevTier = self.tier;
            self.cfg = self.config();
            self.resize();
            if (prevTier !== deviceTier()) {
                self.build();
            } else {
                self.reflow();
            }
            self.makeStars();
            if (REDUCED) self.renderStatic();
        }, 220);
        global.addEventListener('resize', this._onResize);

        if (this.cfg.interact && !REDUCED) {
            global.addEventListener('pointermove', function (e) {
                if (e.pointerType === 'touch') return;
                self.mouse.x = e.clientX;
                self.mouse.y = e.clientY;
                self.mouse.active = true;
            }, {passive: true});

            global.addEventListener('pointerleave', function () {
                self.mouse.active = false;
            });
            document.addEventListener('mouseleave', function () {
                self.mouse.active = false;
            });
        }

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                self.stop();
            } else if (!REDUCED) {
                self.start();
            }
        });

        this.makeStars();

        if (REDUCED) {
            this.renderStatic();
        } else {
            this.start();
        }
    };

    NeuralField.prototype.debounce = function (fn, ms) {
        let t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    };

    NeuralField.prototype.resize = function () {
        let s = fit(this.canvas, this.ctx, this.cfg.dpr);
        this.w = s.w;
        this.h = s.h;
        this.tier = deviceTier();
    };

    NeuralField.prototype.build = function () {
        let n = this.cfg.count;
        let layers = this.tier === 'mobile' ? 4 : 6;
        this.layers = layers;
        this.neurons = [];

        for (let i = 0; i < n; i++) {
            let layer = Math.floor((i / n) * layers);
            let bandW = 1 / layers;
            let jx = (layer + 0.5) * bandW + rand(-bandW * 0.30, bandW * 0.30);
            if (Math.random() < 0.08) jx = Math.random();

            let cluster = Math.floor(rand(0, 4));
            let cy = [0.18, 0.42, 0.64, 0.86][cluster] + rand(-0.13, 0.13);

            this.neurons.push({
                bx: clamp(jx, 0.02, 0.98),
                by: clamp(cy, 0.02, 0.98),
                x: 0, y: 0,
                dvx: rand(-0.12, 0.12),
                dvy: rand(-0.09, 0.09),
                ivx: 0, ivy: 0,
                r: rand(0.9, 2.6),
                depth: rand(0.35, 1),
                activity: 0,
                phase: rand(0, Math.PI * 2),
                layer: layer
            });
        }
        this.reflow();
    };

    NeuralField.prototype.reflow = function () {
        for (let i = 0; i < this.neurons.length; i++) {
            let p = this.neurons[i];
            p.x = p.bx * this.w;
            p.y = p.by * this.h;
        }
    };

    NeuralField.prototype.makeStars = function () {
        let c = document.createElement('canvas');
        let dpr = Math.min(global.devicePixelRatio || 1, 1.5);
        c.width = Math.max(1, Math.round(this.w * dpr));
        c.height = Math.max(1, Math.round(this.h * dpr));
        let g = c.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        let count = Math.round((this.w * this.h) / 6000);
        for (let i = 0; i < count; i++) {
            let a = rand(0.02, 0.16);
            g.fillStyle = rgba(VIOLET, a);
            let s = rand(0.4, 1.1);
            g.fillRect(rand(0, this.w), rand(0, this.h), s, s);
        }
        this.stars = c;
    };

    NeuralField.prototype.start = function () {
        if (this.raf || REDUCED) return;
        let self = this;
        this.last = performance.now();
        let loop = function (t) {
            self.raf = requestAnimationFrame(loop);
            let dt = Math.min(t - self.last, 48);
            self.last = t;
            if (self.cfg.minStep) {
                self.acc += dt;
                if (self.acc < self.cfg.minStep) return;
                dt = self.acc;
                self.acc = 0;
            }
            let t0 = performance.now();
            self.update(dt, t);
            self.render(t);
            self.frameMs = performance.now() - t0;
        };
        this.raf = requestAnimationFrame(loop);
    };

    NeuralField.prototype.stop = function () {
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
    };

    NeuralField.prototype.update = function (dt, t) {
        let k = dt / 16.67;
        let m = this.mouse;
        let R = 190, R2 = R * R;
        let ns = this.neurons;

        this.energy *= Math.pow(0.94, k);

        for (let i = 0; i < ns.length; i++) {
            let p = ns[i];


            p.x += (p.dvx + Math.sin(t * 0.00016 + p.phase) * 0.10) * k;
            p.y += (p.dvy + Math.cos(t * 0.00013 + p.phase) * 0.08) * k;


            p.x += p.ivx * k;
            p.y += p.ivy * k;
            p.ivx *= Math.pow(0.93, k);
            p.ivy *= Math.pow(0.93, k);


            if (p.x < -40) p.x = this.w + 40;
            if (p.x > this.w + 40) p.x = -40;
            if (p.y < -40) p.y = this.h + 40;
            if (p.y > this.h + 40) p.y = -40;


            if (m.active) {
                let dx = m.x - p.x, dy = m.y - p.y;
                let d2 = dx * dx + dy * dy;
                if (d2 < R2) {
                    let d = Math.sqrt(d2) || 1;
                    let f = (1 - d / R);
                    p.ivx += (dx / d) * f * f * 0.30 * k;
                    p.ivy += (dy / d) * f * f * 0.30 * k;
                    if (f > p.activity) p.activity = f * 0.85;
                }
            }

            p.activity *= Math.pow(0.965, k);
            if (p.activity < 0.001) p.activity = 0;
        }


        for (let wI = this.waves.length - 1; wI >= 0; wI--) {
            let wv = this.waves[wI];
            wv.r += wv.speed * k;
            wv.life -= 0.012 * k;
            if (wv.life <= 0) {
                this.waves.splice(wI, 1);
                continue;
            }
            for (let j = 0; j < ns.length; j++) {
                let q = ns[j];
                let ddx = q.x - wv.x, ddy = q.y - wv.y;
                let dd = Math.sqrt(ddx * ddx + ddy * ddy);
                if (Math.abs(dd - wv.r) < 46) {
                    let boost = wv.life * (1 - Math.abs(dd - wv.r) / 46);
                    if (boost > q.activity) q.activity = boost;
                    let nd = dd || 1;
                    q.ivx += (ddx / nd) * boost * 0.6;
                    q.ivy += (ddy / nd) * boost * 0.6;
                }
            }
        }


        this.buildLinks();


        let chance = 0.055 + this.energy * 0.16;
        if (this.links.length && this.signals.length < this.cfg.signals && Math.random() < chance * k) {
            let L = this.links[(Math.random() * this.links.length) | 0];
            this.signals.push({a: L.a, b: L.b, p: 0, speed: rand(0.010, 0.024), hop: 0});
        }

        for (let s = this.signals.length - 1; s >= 0; s--) {
            let sig = this.signals[s];
            sig.p += sig.speed * k * (1 + this.energy * 0.7);
            if (sig.p >= 1) {
                sig.b.activity = Math.min(1, sig.b.activity + 0.55);

                if (sig.hop < 2 && Math.random() < 0.42) {
                    let next = this.neighbourOf(sig.b, sig.a);
                    if (next) {
                        sig.a = sig.b;
                        sig.b = next;
                        sig.p = 0;
                        sig.hop++;
                        continue;
                    }
                }
                this.signals.splice(s, 1);
            }
        }
    };

    NeuralField.prototype.buildLinks = function () {
        let ns = this.neurons;
        let max = this.cfg.dist, max2 = max * max;
        let links = this.links;
        links.length = 0;


        let deg = this._deg || (this._deg = []);
        let CAP = 6;
        for (let z = 0; z < ns.length; z++) deg[z] = 0;

        for (let i = 0; i < ns.length; i++) {
            if (deg[i] >= CAP) continue;
            let a = ns[i];
            for (let j = i + 1; j < ns.length; j++) {
                if (deg[i] >= CAP) break;
                if (deg[j] >= CAP) continue;
                let b = ns[j];
                let dx = a.x - b.x, dy = a.y - b.y;
                let d2 = dx * dx + dy * dy;
                if (d2 > max2) continue;
                let d = Math.sqrt(d2);
                let strength = 1 - d / max;
                let span = Math.abs(a.layer - b.layer);
                if (span > 1) strength *= 0.30;
                if (strength < 0.06) continue;
                links.push({a: a, b: b, s: strength, d: d});
                deg[i]++;
                deg[j]++;
            }
        }
    };

    NeuralField.prototype.neighbourOf = function (node, exclude) {
        let opts = [];
        for (let i = 0; i < this.links.length; i++) {
            let L = this.links[i];
            if (L.a === node && L.b !== exclude) opts.push(L.b);
            else if (L.b === node && L.a !== exclude) opts.push(L.a);
        }
        if (!opts.length) return null;
        return opts[(Math.random() * opts.length) | 0];
    };

    NeuralField.prototype.render = function (t) {
        let ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);

        if (this.stars) {
            ctx.globalAlpha = 0.55;
            ctx.drawImage(this.stars, 0, 0, this.w, this.h);
            ctx.globalAlpha = 1;
        }

        let links = this.links;
        ctx.lineWidth = 1;
        for (let i = 0; i < links.length; i++) {
            let L = links[i];
            let act = Math.max(L.a.activity, L.b.activity);
            let alpha = L.s * 0.46 * ((L.a.depth + L.b.depth) / 2) + act * 0.45;
            if (alpha < 0.012) continue;
            ctx.strokeStyle = act > 0.35 ? rgba(VIOLET, alpha) : rgba(PURPLE, alpha);
            ctx.beginPath();
            ctx.moveTo(L.a.x, L.a.y);
            ctx.lineTo(L.b.x, L.b.y);
            ctx.stroke();
        }

        let ns = this.neurons;
        for (let n = 0; n < ns.length; n++) {
            let p = ns[n];
            let pulse = 0.72 + Math.sin(t * 0.001 + p.phase) * 0.12;
            let a = (0.46 + p.activity * 0.8) * p.depth * pulse;
            ctx.fillStyle = p.activity > 0.4 ? rgba(VIOLET, Math.min(1, a + 0.25)) : rgba(PURPLE, a);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r + p.activity * 1.6, 0, Math.PI * 2);
            ctx.fill();

            if (p.activity > 0.18) {
                let gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22 + p.activity * 26);
                gr.addColorStop(0, rgba(VIOLET, p.activity * 0.30));
                gr.addColorStop(1, rgba(VIOLET, 0));
                ctx.fillStyle = gr;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 22 + p.activity * 26, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        for (let s = 0; s < this.signals.length; s++) {
            let sg = this.signals[s];
            let e = easeOut(sg.p);
            let x = lerp(sg.a.x, sg.b.x, e);
            let y = lerp(sg.a.y, sg.b.y, e);
            let bright = Math.sin(sg.p * Math.PI);
            let g2 = ctx.createRadialGradient(x, y, 0, x, y, 10);
            g2.addColorStop(0, rgba(VIOLET, 0.85 * bright));
            g2.addColorStop(0.4, rgba(PURPLE, 0.35 * bright));
            g2.addColorStop(1, rgba(PURPLE, 0));
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = rgba([255, 255, 255], 0.75 * bright);
            ctx.beginPath();
            ctx.arc(x, y, 1.4, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let w = 0; w < this.waves.length; w++) {
            let wv = this.waves[w];
            ctx.strokeStyle = rgba(VIOLET, wv.life * 0.22);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.showLabels) this.renderLabels(ctx);
    };

    NeuralField.prototype.renderLabels = function (ctx) {
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = rgba(CYAN, 0.42);
        for (let i = 0; i < this.neurons.length; i += 7) {
            let p = this.neurons[i];
            ctx.fillText('n' + i + ' (' + Math.round(p.x) + ',' + Math.round(p.y) + ')', p.x + 7, p.y - 6);
        }
        ctx.fillStyle = rgba(CYAN, 0.30);
        let band = this.w / this.layers;
        for (let L = 0; L < this.layers; L++) {
            let name = L === 0 ? 'INPUT' : L === this.layers - 1 ? 'OUTPUT' : 'HIDDEN ' + L;
            ctx.fillText(name, L * band + 10, 18);
        }
    };

    NeuralField.prototype.renderStatic = function () {
        this.buildLinks();
        this.render(0);
    };

    NeuralField.prototype.pulse = function (x, y, strength) {
        if (REDUCED) return;
        this.waves.push({x: x, y: y, r: 4, speed: 4.2, life: strength || 1});
        if (this.waves.length > 5) this.waves.shift();
    };

    NeuralField.prototype.excite = function (amount) {
        this.energy = clamp(this.energy + amount, 0, 1);
    };

    NeuralField.prototype.setLabels = function (on) {
        this.showLabels = !!on;
        if (REDUCED) this.renderStatic();
    };

    NeuralField.prototype.stats = function () {
        return {
            nodes: this.neurons.length,
            links: this.links.length,
            signals: this.signals.length,
            ms: this.frameMs.toFixed(1)
        };
    };

    global.NN = {
        reduced: REDUCED,
        tier: deviceTier,
        NeuralField: NeuralField,
    };

})(window);
