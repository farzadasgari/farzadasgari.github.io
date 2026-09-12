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

    function NeuralSphere(canvas) {
        let ctx = canvas.getContext('2d');
        let pts = [], flows = [], raf = null, w = 0, h = 0, rot = 0, running = false;
        let N = deviceTier() === 'mobile' ? 40 : 68;
        let SYMBOLS = ['∂', '∇', 'Σ', 'λ', 'f(x)', 'AI', 'ML', 'CNN', 'LSTM', 'σ', 'μ'];

        function build() {
            pts = [];

            let golden = Math.PI * (3 - Math.sqrt(5));
            for (let i = 0; i < N; i++) {
                let y = 1 - (i / (N - 1)) * 2;
                let r = Math.sqrt(Math.max(0, 1 - y * y));
                let th = golden * i;
                pts.push({
                    x: Math.cos(th) * r, y: y, z: Math.sin(th) * r,
                    act: 0, phase: rand(0, Math.PI * 2)
                });
            }
            flows = [];
            for (let f = 0; f < (deviceTier() === 'mobile' ? 4 : 8); f++) {
                flows.push({
                    a: (Math.random() * N) | 0,
                    b: (Math.random() * N) | 0,
                    p: Math.random(),
                    speed: rand(0.004, 0.011)
                });
            }
        }

        function resize() {
            let s = fit(canvas, ctx, 2);
            w = s.w;
            h = s.h;
        }

        function project(p, radius) {
            let cos = Math.cos(rot), sin = Math.sin(rot);
            let x = p.x * cos - p.z * sin;
            let z = p.x * sin + p.z * cos;
            let y = p.y * Math.cos(0.32) - z * Math.sin(0.32);
            let z2 = p.y * Math.sin(0.32) + z * Math.cos(0.32);
            let persp = 1 / (2.4 - z2);
            return {
                x: w / 2 + x * radius * persp * 2.2,
                y: h / 2 + y * radius * persp * 2.2,
                z: z2,
                scale: persp * 2.2
            };
        }

        function frame(t) {
            raf = requestAnimationFrame(frame);
            rot += 0.0022;
            ctx.clearRect(0, 0, w, h);
            let radius = Math.min(w, h) * 0.30;
            let proj = [];
            let i;

            for (i = 0; i < pts.length; i++) {
                pts[i].act *= 0.972;
                proj.push(project(pts[i], radius));
            }


            let maxD = radius * 0.62;
            for (i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    let dx = proj[i].x - proj[j].x, dy = proj[i].y - proj[j].y;
                    let d = Math.sqrt(dx * dx + dy * dy);
                    if (d > maxD) continue;
                    let depth = (proj[i].z + proj[j].z) / 2;
                    let a = (1 - d / maxD) * 0.22 * (0.35 + (depth + 1) / 2);
                    ctx.strokeStyle = rgba(PURPLE, a);
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(proj[i].x, proj[i].y);
                    ctx.lineTo(proj[j].x, proj[j].y);
                    ctx.stroke();
                }
            }


            for (let f = 0; f < flows.length; f++) {
                let fl = flows[f];
                fl.p += fl.speed;
                if (fl.p >= 1) {
                    pts[fl.b].act = 1;
                    fl.a = fl.b;
                    fl.b = (Math.random() * pts.length) | 0;
                    fl.p = 0;
                }
                let pa = proj[fl.a], pb = proj[fl.b];
                let e = easeOut(fl.p);
                let px = lerp(pa.x, pb.x, e), py = lerp(pa.y, pb.y, e);
                let bright = Math.sin(fl.p * Math.PI);
                let g = ctx.createRadialGradient(px, py, 0, px, py, 9);
                g.addColorStop(0, rgba(VIOLET, 0.9 * bright));
                g.addColorStop(1, rgba(VIOLET, 0));
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(px, py, 9, 0, Math.PI * 2);
                ctx.fill();
            }


            let order = proj.map(function (p, idx) {
                return idx;
            })
                .sort(function (a, b) {
                    return proj[a].z - proj[b].z;
                });
            for (i = 0; i < order.length; i++) {
                let k = order[i];
                let p = proj[k], src = pts[k];
                let depthA = (p.z + 1) / 2;
                let a = 0.18 + depthA * 0.45 + src.act * 0.5;
                let r = (0.9 + depthA * 1.5) + src.act * 2;
                ctx.fillStyle = src.act > 0.3 ? rgba(VIOLET, a) : rgba(PURPLE, a);
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
            }


            ctx.font = '10px "JetBrains Mono", monospace';
            for (let s = 0; s < SYMBOLS.length; s++) {
                let ang = (s / SYMBOLS.length) * Math.PI * 2 + rot * 0.55;
                let orb = radius * 1.72;
                let sx = w / 2 + Math.cos(ang) * orb;
                let sy = h / 2 + Math.sin(ang) * orb * 0.62;
                let fade = 0.10 + Math.max(0, Math.sin(ang + Math.PI / 2)) * 0.18;
                ctx.fillStyle = rgba(VIOLET, fade);
                ctx.textAlign = 'center';
                ctx.fillText(SYMBOLS[s], sx, sy);
            }


            ctx.strokeStyle = rgba(VIOLET, 0.10);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, radius * 1.42, 0, Math.PI * 2);
            ctx.stroke();
        }

        function staticFrame() {
            resize();
            rot = 0.6;
            let radius = Math.min(w, h) * 0.30;
            ctx.clearRect(0, 0, w, h);
            let proj = pts.map(function (p) {
                return project(p, radius);
            });
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    let dx = proj[i].x - proj[j].x, dy = proj[i].y - proj[j].y;
                    let d = Math.hypot(dx, dy);
                    if (d > radius * 0.62) continue;
                    ctx.strokeStyle = rgba(PURPLE, (1 - d / (radius * 0.62)) * 0.18);
                    ctx.beginPath();
                    ctx.moveTo(proj[i].x, proj[i].y);
                    ctx.lineTo(proj[j].x, proj[j].y);
                    ctx.stroke();
                }
            }
            proj.forEach(function (p) {
                ctx.fillStyle = rgba(PURPLE, 0.4);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        build();
        resize();
        global.addEventListener('resize', function () {
            resize();
        });

        if (REDUCED) {
            staticFrame();
        } else {
            whenVisible(canvas, function () {
                if (!running) {
                    running = true;
                    raf = requestAnimationFrame(frame);
                }
            }, function () {
                if (running) {
                    cancelAnimationFrame(raf);
                    running = false;
                }
            });
        }
    }

    function FusionFlow(canvas) {
        let ctx = canvas.getContext('2d');
        let w = 0, h = 0, raf = null, running = false;
        let drops = [], lattice = [], bars = [], t = 0;
        let BARS = 9;

        function build() {
            lattice = [];
            let cols = 3, rows = 4;
            for (let c = 0; c < cols; c++) {
                for (let r = 0; r < rows; r++) {
                    lattice.push({
                        x: 0.40 + c * 0.085,
                        y: 0.22 + (r / (rows - 1)) * 0.56 + (c % 2 ? 0.04 : 0),
                        act: 0, col: c
                    });
                }
            }
            bars = [];
            for (let b = 0; b < BARS; b++) bars.push({v: rand(0.08, 0.3), target: rand(0.1, 0.4)});
            drops = [];
        }

        function resize() {
            let s = fit(canvas, ctx, 2);
            w = s.w;
            h = s.h;
        }

        function spawn() {
            drops.push({
                x: -0.03,
                y: rand(0.28, 0.72),
                base: 0,
                phase: rand(0, Math.PI * 2),
                speed: rand(0.0022, 0.0042),
                state: 'water',
                node: null,
                next: null,
                p: 0,
                r: rand(1.2, 2.6)
            });
            drops[drops.length - 1].base = drops[drops.length - 1].y;
        }

        function nearestNode(y) {
            let best = null, bd = 9;
            for (let i = 0; i < lattice.length; i++) {
                if (lattice[i].col !== 0) continue;
                let d = Math.abs(lattice[i].y - y);
                if (d < bd) {
                    bd = d;
                    best = lattice[i];
                }
            }
            return best;
        }

        function nextNode(node) {
            let opts = lattice.filter(function (n) {
                return n.col === node.col + 1;
            });
            if (!opts.length) return null;
            return opts[(Math.random() * opts.length) | 0];
        }

        function frame() {
            raf = requestAnimationFrame(frame);
            t += 1;
            ctx.clearRect(0, 0, w, h);

            if (drops.length < 46 && Math.random() < 0.30) spawn();


            ctx.strokeStyle = rgba(VIOLET, 0.07);
            ctx.lineWidth = 1;
            [0.36, 0.68].forEach(function (x) {
                ctx.beginPath();
                ctx.moveTo(x * w, h * 0.12);
                ctx.lineTo(x * w, h * 0.88);
                ctx.stroke();
            });


            for (let i = 0; i < lattice.length; i++) {
                let a = lattice[i];
                a.act *= 0.94;
                for (let j = 0; j < lattice.length; j++) {
                    let b = lattice[j];
                    if (b.col !== a.col + 1) continue;
                    let alpha = 0.06 + Math.max(a.act, b.act) * 0.28;
                    ctx.strokeStyle = rgba(PURPLE, alpha);
                    ctx.beginPath();
                    ctx.moveTo(a.x * w, a.y * h);
                    ctx.lineTo(b.x * w, b.y * h);
                    ctx.stroke();
                }
            }


            for (let i = 0; i < lattice.length; i++) {
                let n = lattice[i];
                let rr = 2.4 + n.act * 3.4;
                ctx.fillStyle = n.act > 0.3 ? rgba(VIOLET, 0.85) : rgba(PURPLE, 0.42);
                ctx.beginPath();
                ctx.arc(n.x * w, n.y * h, rr, 0, Math.PI * 2);
                ctx.fill();
                if (n.act > 0.2) {
                    let g = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, 18);
                    g.addColorStop(0, rgba(VIOLET, n.act * 0.3));
                    g.addColorStop(1, rgba(VIOLET, 0));
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(n.x * w, n.y * h, 18, 0, Math.PI * 2);
                    ctx.fill();
                }
            }


            for (let d = drops.length - 1; d >= 0; d--) {
                let p = drops[d];

                if (p.state === 'water') {
                    p.x += p.speed;

                    p.y = p.base + Math.sin(t * 0.03 + p.phase + p.x * 8) * 0.045;
                    if (p.x >= 0.40) {
                        p.node = nearestNode(p.y);
                        p.next = p.node ? nextNode(p.node) : null;
                        p.state = p.next ? 'signal' : 'data';
                        p.p = 0;
                        if (p.node) p.node.act = 1;
                    }
                    let trail = ctx.createLinearGradient((p.x - 0.05) * w, 0, p.x * w, 0);
                    trail.addColorStop(0, rgba(CYAN, 0));
                    trail.addColorStop(1, rgba(CYAN, 0.28));
                    ctx.strokeStyle = trail;
                    ctx.lineWidth = p.r;
                    ctx.beginPath();
                    ctx.moveTo((p.x - 0.05) * w, p.y * h);
                    ctx.lineTo(p.x * w, p.y * h);
                    ctx.stroke();
                    ctx.fillStyle = rgba(CYAN, 0.55);
                    ctx.beginPath();
                    ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
                    ctx.fill();

                } else if (p.state === 'signal') {
                    p.p += 0.028;
                    let e = easeOut(p.p);
                    p.x = lerp(p.node.x, p.next.x, e);
                    p.y = lerp(p.node.y, p.next.y, e);
                    if (p.p >= 1) {
                        p.next.act = 1;
                        let onward = nextNode(p.next);
                        if (onward) {
                            p.node = p.next;
                            p.next = onward;
                            p.p = 0;
                        } else {
                            p.state = 'data';
                        }
                    }
                    let br = Math.sin(p.p * Math.PI) * 0.9 + 0.1;
                    let gg = ctx.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, 8);
                    gg.addColorStop(0, rgba(VIOLET, br));
                    gg.addColorStop(1, rgba(VIOLET, 0));
                    ctx.fillStyle = gg;
                    ctx.beginPath();
                    ctx.arc(p.x * w, p.y * h, 8, 0, Math.PI * 2);
                    ctx.fill();

                } else {
                    p.x += 0.006;
                    let targetBar = clamp(Math.floor((p.y - 0.15) / (0.7 / BARS)), 0, BARS - 1);
                    let barX = 0.72 + (targetBar / BARS) * 0.26;
                    p.y = lerp(p.y, 0.82, 0.05);
                    p.x = lerp(p.x, barX, 0.06);
                    ctx.fillStyle = rgba(VIOLET, 0.6);
                    ctx.beginPath();
                    ctx.arc(p.x * w, p.y * h, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                    if (Math.abs(p.x - barX) < 0.01 && p.y > 0.79) {
                        bars[targetBar].target = clamp(bars[targetBar].target + 0.09, 0.1, 0.62);
                        drops.splice(d, 1);
                        continue;
                    }
                }

                if (p.x > 1.05) drops.splice(d, 1);
            }


            let bw = (0.26 * w) / BARS;
            for (let b = 0; b < BARS; b++) {
                let bar = bars[b];
                bar.target *= 0.995;
                bar.v = lerp(bar.v, bar.target, 0.07);
                let bx = 0.72 * w + b * bw;
                let bh = bar.v * h;
                let grad = ctx.createLinearGradient(0, 0.84 * h - bh, 0, 0.84 * h);
                grad.addColorStop(0, rgba(VIOLET, 0.72));
                grad.addColorStop(1, rgba(PURPLE, 0.16));
                ctx.fillStyle = grad;
                ctx.fillRect(bx, 0.84 * h - bh, bw * 0.62, bh);
            }

            ctx.strokeStyle = rgba(VIOLET, 0.22);
            ctx.beginPath();
            ctx.moveTo(0.70 * w, 0.84 * h);
            ctx.lineTo(0.99 * w, 0.84 * h);
            ctx.stroke();


            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = rgba(CYAN, 0.42);
            ctx.fillText('PHYSICAL FLOW', 0.03 * w, 0.14 * h);
            ctx.fillStyle = rgba(VIOLET, 0.42);
            ctx.fillText('NEURAL MODEL', 0.40 * w, 0.14 * h);
            ctx.fillText('PREDICTION', 0.72 * w, 0.14 * h);
        }

        function staticFrame() {
            resize();
            ctx.clearRect(0, 0, w, h);
            for (let i = 0; i < lattice.length; i++) {
                let a = lattice[i];
                for (let j = 0; j < lattice.length; j++) {
                    let b = lattice[j];
                    if (b.col !== a.col + 1) continue;
                    ctx.strokeStyle = rgba(PURPLE, 0.12);
                    ctx.beginPath();
                    ctx.moveTo(a.x * w, a.y * h);
                    ctx.lineTo(b.x * w, b.y * h);
                    ctx.stroke();
                }
                ctx.fillStyle = rgba(PURPLE, 0.5);
                ctx.beginPath();
                ctx.arc(a.x * w, a.y * h, 2.6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.strokeStyle = rgba(CYAN, 0.35);
            ctx.beginPath();
            for (let x = 0; x < 0.36; x += 0.01) {
                let yy = 0.5 + Math.sin(x * 26) * 0.06;
                if (x === 0) ctx.moveTo(x * w, yy * h); else ctx.lineTo(x * w, yy * h);
            }
            ctx.stroke();
            for (let b2 = 0; b2 < BARS; b2++) {
                let bw2 = (0.26 * w) / BARS;
                let bh2 = (0.12 + Math.sin(b2) * 0.08 + 0.12) * h;
                ctx.fillStyle = rgba(VIOLET, 0.4);
                ctx.fillRect(0.72 * w + b2 * bw2, 0.84 * h - bh2, bw2 * 0.62, bh2);
            }
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillStyle = rgba(VIOLET, 0.4);
            ctx.fillText('PHYSICAL FLOW → NEURAL MODEL → PREDICTION', 0.03 * w, 0.14 * h);
        }

        build();
        resize();
        global.addEventListener('resize', function () {
            resize();
        });

        if (REDUCED) {
            staticFrame();
        } else {
            whenVisible(canvas, function () {
                if (!running) {
                    running = true;
                    raf = requestAnimationFrame(frame);
                }
            }, function () {
                if (running) {
                    cancelAnimationFrame(raf);
                    running = false;
                }
            });
        }
    }

    function Constellation(root, canvas) {
        let ctx = canvas.getContext('2d');
        let nodes = [], raf = null, w = 0, h = 0, t = 0, running = false;
        let hovered = null;

        let SKILLS = [
            {n: 'Python', ring: 1, group: 'code'},
            {n: 'Machine Learning', ring: 1, group: 'ai'},
            {n: 'Deep Learning', ring: 1, group: 'ai'},
            {n: 'Signal Processing', ring: 1, group: 'sci'},
            {n: 'Remote Sensing', ring: 1, group: 'sci'},
            {n: 'TensorFlow', ring: 2, group: 'ai'},
            {n: 'Keras', ring: 2, group: 'ai'},
            {n: 'NumPy', ring: 2, group: 'code'},
            {n: 'Pandas', ring: 2, group: 'code'},
            {n: 'MATLAB', ring: 2, group: 'sci'},
            {n: 'Django', ring: 2, group: 'web'},
            {n: 'JavaScript', ring: 2, group: 'web'},
            {n: 'Google Earth Engine', ring: 2, group: 'sci'},
            {n: 'Git', ring: 2, group: 'infra'},
            {n: 'Linux', ring: 2, group: 'infra'},
            {n: 'Docker', ring: 2, group: 'infra'},
            {n: 'PostgreSQL', ring: 2, group: 'infra'}
        ];

        let EDGES = [
            ['Python', 'Machine Learning'], ['Python', 'NumPy'], ['Python', 'Pandas'],
            ['Python', 'Django'], ['Machine Learning', 'Deep Learning'],
            ['Deep Learning', 'TensorFlow'], ['TensorFlow', 'Keras'],
            ['Machine Learning', 'Signal Processing'], ['Signal Processing', 'MATLAB'],
            ['Remote Sensing', 'Google Earth Engine'], ['Remote Sensing', 'Deep Learning'],
            ['Django', 'PostgreSQL'], ['Django', 'JavaScript'], ['Git', 'Linux'],
            ['Linux', 'Docker'], ['Docker', 'Django'], ['NumPy', 'Pandas'],
            ['Signal Processing', 'NumPy']
        ];

        function place() {
            let rect = root.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
            let cx = w / 2, cy = h / 2;
            let r1 = Math.min(w, h) * 0.27;
            let r2 = Math.min(w, h) * 0.44;
            let ring1 = SKILLS.filter(function (s) {
                return s.ring === 1;
            });
            let ring2 = SKILLS.filter(function (s) {
                return s.ring === 2;
            });

            nodes.forEach(function (nd) {
                if (nd.el.parentNode) nd.el.parentNode.removeChild(nd.el);
            });
            nodes = [];

            function add(list, radius, offset) {
                list.forEach(function (s, i) {
                    let ang = (i / list.length) * Math.PI * 2 + offset;
                    let x = cx + Math.cos(ang) * radius * (w / Math.min(w, h)) * 0.86;
                    let y = cy + Math.sin(ang) * radius;
                    let el = document.createElement('button');
                    el.type = 'button';
                    el.className = 'skill-node';
                    el.textContent = s.n;
                    el.style.left = x + 'px';
                    el.style.top = y + 'px';
                    el.setAttribute('data-skill', s.n);
                    root.appendChild(el);
                    let nd = {name: s.n, x: x, y: y, el: el, phase: rand(0, Math.PI * 2), act: 0};
                    el.addEventListener('mouseenter', function () {
                        hovered = nd;
                        highlight();
                    });
                    el.addEventListener('mouseleave', function () {
                        hovered = null;
                        highlight();
                    });
                    el.addEventListener('focus', function () {
                        hovered = nd;
                        highlight();
                    });
                    el.addEventListener('blur', function () {
                        hovered = null;
                        highlight();
                    });
                    nodes.push(nd);
                });
            }

            add(ring1, r1, -Math.PI / 2);
            add(ring2, r2, -Math.PI / 2 + 0.3);
        }

        function related(name) {
            let out = {};
            EDGES.forEach(function (e) {
                if (e[0] === name) out[e[1]] = 1;
                if (e[1] === name) out[e[0]] = 1;
            });
            return out;
        }

        function highlight() {
            let rel = hovered ? related(hovered.name) : null;
            nodes.forEach(function (nd) {
                let on = rel && (rel[nd.name] || nd === hovered);
                nd.el.classList.toggle('is-lit', !!on);
            });
        }

        function find(name) {
            for (let i = 0; i < nodes.length; i++) if (nodes[i].name === name) return nodes[i];
            return null;
        }

        function resize() {
            fit(canvas, ctx, 2);
            place();
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            let cx = w / 2, cy = h / 2;
            let rel = hovered ? related(hovered.name) : null;

            nodes.forEach(function (nd) {
                let lit = rel && (rel[nd.name] || nd === hovered);
                ctx.strokeStyle = rgba(PURPLE, lit ? 0.30 : 0.09);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(nd.x, nd.y);
                ctx.stroke();
            });

            EDGES.forEach(function (e) {
                let a = find(e[0]), b = find(e[1]);
                if (!a || !b) return;
                let lit = hovered && (a === hovered || b === hovered);
                ctx.strokeStyle = lit ? rgba(VIOLET, 0.55) : rgba(VIOLET, 0.13);
                ctx.lineWidth = lit ? 1.4 : 1;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });


            if (!REDUCED) {
                t += 0.006;
                EDGES.forEach(function (e, i) {
                    let a = find(e[0]), b = find(e[1]);
                    if (!a || !b) return;
                    let p = (t * (0.6 + (i % 5) * 0.12) + i * 0.17) % 1;
                    let x = lerp(a.x, b.x, p), y = lerp(a.y, b.y, p);
                    let br = Math.sin(p * Math.PI);
                    ctx.fillStyle = rgba(VIOLET, 0.42 * br);
                    ctx.beginPath();
                    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }

        function frame() {
            raf = requestAnimationFrame(frame);
            draw();
        }

        resize();
        global.addEventListener('resize', (function () {
            let to;
            return function () {
                clearTimeout(to);
                to = setTimeout(resize, 200);
            };
        })());

        if (REDUCED) {
            draw();
        } else {
            whenVisible(root, function () {
                if (!running) {
                    running = true;
                    raf = requestAnimationFrame(frame);
                }
            }, function () {
                if (running) {
                    cancelAnimationFrame(raf);
                    running = false;
                }
            });
        }
    }

    function MicroViz(canvas, kind) {
        let ctx = canvas.getContext('2d');
        let w, h, raf = null, t = 0;

        function resize() {
            let s = fit(canvas, ctx, 1.75);
            w = s.w;
            h = s.h;
        }

        let draw = {
            net: function () {
                let pts = [];
                for (let i = 0; i < 9; i++) {
                    pts.push({
                        x: (0.18 + (i % 3) * 0.32) * w,
                        y: (0.22 + Math.floor(i / 3) * 0.28) * h
                    });
                }
                for (let a = 0; a < pts.length; a++) {
                    for (let b = 0; b < pts.length; b++) {
                        if (Math.floor(b / 3) !== Math.floor(a / 3) + 1) continue;
                        ctx.strokeStyle = rgba(PURPLE, 0.22 + Math.sin(t * 0.05 + a + b) * 0.14);
                        ctx.beginPath();
                        ctx.moveTo(pts[a].x, pts[a].y);
                        ctx.lineTo(pts[b].x, pts[b].y);
                        ctx.stroke();
                    }
                }
                pts.forEach(function (p, i) {
                    let act = 0.4 + Math.sin(t * 0.06 + i) * 0.35;
                    ctx.fillStyle = rgba(VIOLET, act);
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
                    ctx.fill();
                });
            },
            wave: function () {
                ctx.strokeStyle = rgba(VIOLET, 0.55);
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                for (let x = 0; x <= w; x += 2) {
                    let k = x / w;
                    let y = h / 2 +
                        Math.sin(k * 9 + t * 0.05) * h * 0.18 +
                        Math.sin(k * 23 + t * 0.09) * h * 0.08;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
                ctx.strokeStyle = rgba(CYAN, 0.20);
                ctx.beginPath();
                for (let x2 = 0; x2 <= w; x2 += 3) {
                    let k2 = x2 / w;
                    let y2 = h / 2 + Math.sin(k2 * 15 - t * 0.04) * h * 0.10;
                    if (x2 === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
                }
                ctx.stroke();
            },
            orbit: function () {
                let cx = w * 0.5, cy = h * 0.55, r = Math.min(w, h) * 0.30;
                ctx.strokeStyle = rgba(PURPLE, 0.35);
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = rgba(VIOLET, 0.16);
                ctx.beginPath();
                ctx.ellipse(cx, cy, r * 1.6, r * 0.6, 0.4, 0, Math.PI * 2);
                ctx.stroke();
                let ang = t * 0.03;
                let sx = cx + Math.cos(ang) * r * 1.6 * Math.cos(0.4) - Math.sin(ang) * r * 0.6 * Math.sin(0.4);
                let sy = cy + Math.cos(ang) * r * 1.6 * Math.sin(0.4) + Math.sin(ang) * r * 0.6 * Math.cos(0.4);
                ctx.fillStyle = rgba(CYAN, 0.9);
                ctx.beginPath();
                ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = rgba(CYAN, 0.18);
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(cx, cy);
                ctx.stroke();
            },
            chart: function () {
                let n = 7;
                for (let i = 0; i < n; i++) {
                    let bh = (0.22 + Math.abs(Math.sin(t * 0.03 + i * 0.7)) * 0.55) * h;
                    let bw = w / n * 0.5;
                    ctx.fillStyle = rgba(VIOLET, 0.28 + (i / n) * 0.35);
                    ctx.fillRect((i + 0.25) * (w / n), h * 0.85 - bh, bw, bh);
                }
                ctx.strokeStyle = rgba(VIOLET, 0.25);
                ctx.beginPath();
                ctx.moveTo(0, h * 0.85);
                ctx.lineTo(w, h * 0.85);
                ctx.stroke();
            },
            flow: function () {
                for (let l = 0; l < 5; l++) {
                    ctx.strokeStyle = rgba(CYAN, 0.10 + l * 0.05);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    for (let x = 0; x <= w; x += 4) {
                        let k = x / w;
                        let y = h * (0.24 + l * 0.13) +
                            Math.sin(k * 7 + t * 0.04 + l * 0.6) * h * 0.055;
                        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
                let px = ((t * 1.6) % (w + 20)) - 10;
                ctx.fillStyle = rgba(CYAN, 0.7);
                ctx.beginPath();
                ctx.arc(px, h * 0.5 + Math.sin(px / w * 7 + t * 0.04) * h * 0.055, 2, 0, Math.PI * 2);
                ctx.fill();
            },
            grid: function () {
                let step = Math.max(10, w / 9);
                ctx.strokeStyle = rgba(PURPLE, 0.18);
                for (let x = 0; x < w; x += step) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                    ctx.stroke();
                }
                for (let y = 0; y < h; y += step) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                }
                let cx = (0.5 + Math.sin(t * 0.02) * 0.3) * w;
                let cy = (0.5 + Math.cos(t * 0.025) * 0.3) * h;
                let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.3);
                g.addColorStop(0, rgba(VIOLET, 0.5));
                g.addColorStop(1, rgba(VIOLET, 0));
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            },
            scatter: function () {
                for (let i = 0; i < 22; i++) {
                    let sx = (0.08 + ((i * 37) % 100) / 118) * w;
                    let sy = h * 0.85 - (sx / w) * h * 0.6 +
                        Math.sin(i * 2.3 + t * 0.02) * h * 0.12;
                    ctx.fillStyle = rgba(i % 4 === 0 ? CYAN : VIOLET, 0.5);
                    ctx.beginPath();
                    ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.strokeStyle = rgba(VIOLET, 0.4);
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(0.05 * w, h * 0.82);
                ctx.lineTo(0.95 * w, h * 0.24);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        };

        function render() {
            ctx.clearRect(0, 0, w, h);
            (draw[kind] || draw.net)();
        }

        function frame() {
            raf = requestAnimationFrame(frame);
            t += 1;
            render();
        }

        resize();
        render();

        global.addEventListener('resize', (function () {
            let to;
            return function () {
                clearTimeout(to);
                to = setTimeout(function () {
                    resize();
                    render();
                }, 220);
            };
        })());

        return {
            start: function () {
                if (!raf && !REDUCED) frame();
            },
            stop: function () {
                if (raf) {
                    cancelAnimationFrame(raf);
                    raf = null;
                }
                render();
            }
        };
    }

    global.NN = {
        reduced: REDUCED,
        tier: deviceTier,
        NeuralField: NeuralField,
        NeuralSphere: NeuralSphere,
        FusionFlow: FusionFlow,
        Constellation: Constellation,
    };

})(window);
