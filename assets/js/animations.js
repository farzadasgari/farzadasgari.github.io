(function (global) {
    'use strict';

    const REDUCED = global.NN ? global.NN.reduced : false;
    const $ = function (s, r) {
        return (r || document).querySelector(s);
    };
    const $$ = function (s, r) {
        return Array.prototype.slice.call((r || document).querySelectorAll(s));
    };

    function boot(onDone) {
        const el = $('#boot');
        const bar = $('#boot-bar span');
        const status = $('#boot-status');
        const canvas = $('#boot-canvas');
        let finished = false;

        function finish() {
            if (finished) return;
            finished = true;
            if (el) el.classList.add('is-done');
            document.body.classList.add('is-booted');
            document.body.style.removeProperty('overflow');
            setTimeout(function () {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            }, 900);
            if (onDone) onDone();
        }

        if (!el || REDUCED) {
            finish();
            return;
        }

        document.body.style.overflow = 'hidden';

        const steps = [
            'initialising network',
            'seeding neurons',
            'forming connections',
            'propagating signals',
            'system online'
        ];
        let stepIdx = 0;

        const ctx = canvas.getContext('2d');
        const dpr = Math.min(global.devicePixelRatio || 1, 2);
        let size = canvas.clientWidth || 200;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const nodes = [];
        const TOTAL = 22;
        for (let i = 0; i < TOTAL; i++) {
            const layer = Math.floor(i / (TOTAL / 4));
            const inLayer = i % (TOTAL / 4);
            nodes.push({
                x: (0.16 + layer * 0.23) * size,
                y: (0.22 + inLayer * (0.56 / (TOTAL / 4 - 1))) * size,
                born: i / TOTAL,
                layer: layer,
                act: 0
            });
        }

        const t0 = performance.now();
        const DURATION = 2100;
        let pulses = [];

        function frame(now) {
            const p = Math.min((now - t0) / DURATION, 1);
            ctx.clearRect(0, 0, size, size);

            if (p > 0.32) {
                const lc = Math.min((p - 0.32) / 0.3, 1);
                for (let a = 0; a < nodes.length; a++) {
                    for (let b = 0; b < nodes.length; b++) {
                        if (nodes[b].layer !== nodes[a].layer + 1) continue;
                        ctx.strokeStyle = 'rgba(124,58,237,' + (0.16 * lc) + ')';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(nodes[a].x, nodes[a].y);
                        ctx.lineTo(nodes[b].x, nodes[b].y);
                        ctx.stroke();
                    }
                }
            }

            if (p > 0.58 && Math.random() < 0.22) {
                const from = nodes[(Math.random() * nodes.length) | 0];
                const opts = nodes.filter(function (n) {
                    return n.layer === from.layer + 1;
                });
                if (opts.length) {
                    pulses.push({a: from, b: opts[(Math.random() * opts.length) | 0], p: 0});
                }
            }
            for (let s = pulses.length - 1; s >= 0; s--) {
                const pl = pulses[s];
                pl.p += 0.045;
                if (pl.p >= 1) {
                    pl.b.act = 1;
                    pulses.splice(s, 1);
                    continue;
                }
                const x = pl.a.x + (pl.b.x - pl.a.x) * pl.p;
                const y = pl.a.y + (pl.b.y - pl.a.y) * pl.p;
                const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
                g.addColorStop(0, 'rgba(167,139,250,0.9)');
                g.addColorStop(1, 'rgba(167,139,250,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fill();
            }

            nodes.forEach(function (n) {
                if (p < n.born * 0.4) return;
                const appear = Math.min((p - n.born * 0.4) / 0.12, 1);
                n.act *= 0.94;
                ctx.fillStyle = 'rgba(' + (n.act > 0.3 ? '167,139,250' : '124,58,237') + ',' +
                    (0.35 + n.act * 0.6) * appear + ')';
                ctx.beginPath();
                ctx.arc(n.x, n.y, (2 + n.act * 2) * appear, 0, Math.PI * 2);
                ctx.fill();
            });

            if (bar) bar.style.width = (p * 100) + '%';
            const wantStep = Math.min(Math.floor(p * steps.length), steps.length - 1);
            if (wantStep !== stepIdx || !status.textContent) {
                stepIdx = wantStep;
                if (status) status.textContent = steps[stepIdx];
            }

            if (p < 1) {
                requestAnimationFrame(frame);
            } else {
                setTimeout(finish, 260);
            }
        }

        requestAnimationFrame(frame);

        el.addEventListener('click', finish);
        document.addEventListener('keydown', function onKey(e) {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                document.removeEventListener('keydown', onKey);
                finish();
            }
        });
        const skip = $('#boot-skip');
        if (skip) skip.addEventListener('click', finish);
        setTimeout(finish, 4200);

        function reveals() {
            const items = $$('.reveal, .reveal-group');
            if (!items.length) return;

            if (REDUCED || !('IntersectionObserver' in global)) {
                items.forEach(function (el) {
                    el.classList.add('is-visible');
                });
                return;
            }

            const io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('is-visible');
                    io.unobserve(e.target);
                });
            }, {threshold: 0.12, rootMargin: '0px 0px -8% 0px'});

            items.forEach(function (el) {
                io.observe(el);
            });
        }

        function counters() {
            const els = $$('[data-count]');
            if (!els.length) return;

            function run(el) {
                const target = parseFloat(el.getAttribute('data-count'));
                const suffix = el.getAttribute('data-suffix') || '';
                if (isNaN(target)) {
                    el.textContent = el.getAttribute('data-label') || '';
                    return;
                }
                if (REDUCED) {
                    el.textContent = target + suffix;
                    return;
                }

                const dur = 1500, t0 = performance.now();
                el.classList.add('is-counting');
                (function step(now) {
                    const p = Math.min((now - t0) / dur, 1);
                    const eased = 1 - Math.pow(1 - p, 3);
                    el.textContent = Math.round(target * eased) + (p === 1 ? suffix : '');
                    if (p < 1) requestAnimationFrame(step);
                    else el.classList.remove('is-counting');
                })(t0);
            }

            if (!('IntersectionObserver' in global)) {
                els.forEach(run);
                return;
            }
            const io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (!e.isIntersecting) return;
                    run(e.target);
                    io.unobserve(e.target);
                });
            }, {threshold: 0.5});
            els.forEach(function (el) {
                io.observe(el);
            });
        }
    }
})(window);