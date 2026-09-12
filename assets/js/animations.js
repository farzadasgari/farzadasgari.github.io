(function (global) {
    'use strict';

    let REDUCED = global.NN ? global.NN.reduced : false;
    let $ = function (s, r) {
        return (r || document).querySelector(s);
    };
    let $$ = function (s, r) {
        return Array.prototype.slice.call((r || document).querySelectorAll(s));
    };

    function boot(onDone) {
        let el = $('#boot');
        let bar = $('#boot-bar span');
        let status = $('#boot-status');
        let canvas = $('#boot-canvas');
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

        let steps = [
            'initialising network',
            'seeding neurons',
            'forming connections',
            'propagating signals',
            'system online'
        ];
        let stepIdx = 0;

        let ctx = canvas.getContext('2d');
        let dpr = Math.min(global.devicePixelRatio || 1, 2);
        let size = canvas.clientWidth || 200;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        let nodes = [];
        let TOTAL = 22;
        for (let i = 0; i < TOTAL; i++) {
            let layer = Math.floor(i / (TOTAL / 4));
            let inLayer = i % (TOTAL / 4);
            nodes.push({
                x: (0.16 + layer * 0.23) * size,
                y: (0.22 + inLayer * (0.56 / (TOTAL / 4 - 1))) * size,
                born: i / TOTAL,
                layer: layer,
                act: 0
            });
        }

        let t0 = performance.now();
        let DURATION = 2100;
        let pulses = [];

        function frame(now) {
            let p = Math.min((now - t0) / DURATION, 1);
            ctx.clearRect(0, 0, size, size);

            if (p > 0.32) {
                let lc = Math.min((p - 0.32) / 0.3, 1);
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
                let from = nodes[(Math.random() * nodes.length) | 0];
                let opts = nodes.filter(function (n) {
                    return n.layer === from.layer + 1;
                });
                if (opts.length) {
                    pulses.push({a: from, b: opts[(Math.random() * opts.length) | 0], p: 0});
                }
            }
            for (let s = pulses.length - 1; s >= 0; s--) {
                let pl = pulses[s];
                pl.p += 0.045;
                if (pl.p >= 1) {
                    pl.b.act = 1;
                    pulses.splice(s, 1);
                    continue;
                }
                let x = pl.a.x + (pl.b.x - pl.a.x) * pl.p;
                let y = pl.a.y + (pl.b.y - pl.a.y) * pl.p;
                let g = ctx.createRadialGradient(x, y, 0, x, y, 7);
                g.addColorStop(0, 'rgba(167,139,250,0.9)');
                g.addColorStop(1, 'rgba(167,139,250,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fill();
            }

            nodes.forEach(function (n) {
                if (p < n.born * 0.4) return;
                let appear = Math.min((p - n.born * 0.4) / 0.12, 1);
                n.act *= 0.94;
                ctx.fillStyle = 'rgba(' + (n.act > 0.3 ? '167,139,250' : '124,58,237') + ',' +
                    (0.35 + n.act * 0.6) * appear + ')';
                ctx.beginPath();
                ctx.arc(n.x, n.y, (2 + n.act * 2) * appear, 0, Math.PI * 2);
                ctx.fill();
            });

            if (bar) bar.style.width = (p * 100) + '%';
            let wantStep = Math.min(Math.floor(p * steps.length), steps.length - 1);
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
        let skip = $('#boot-skip');
        if (skip) skip.addEventListener('click', finish);
        setTimeout(finish, 4200);
    }

    function reveals() {
        let items = $$('.reveal, .reveal-group');
        if (!items.length) return;

        if (REDUCED || !('IntersectionObserver' in global)) {
            items.forEach(function (el) {
                el.classList.add('is-visible');
            });
            return;
        }

        let io = new IntersectionObserver(function (entries) {
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
        let els = $$('[data-count]');
        if (!els.length) return;

        function run(el) {
            let target = parseFloat(el.getAttribute('data-count'));
            let suffix = el.getAttribute('data-suffix') || '';
            if (isNaN(target)) {
                el.textContent = el.getAttribute('data-label') || '';
                return;
            }
            if (REDUCED) {
                el.textContent = target + suffix;
                return;
            }

            let dur = 1500, t0 = performance.now();
            el.classList.add('is-counting');
            (function step(now) {
                let p = Math.min((now - t0) / dur, 1);
                let eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(target * eased) + (p === 1 ? suffix : '');
                if (p < 1) requestAnimationFrame(step);
                else el.classList.remove('is-counting');
            })(t0);
        }

        if (!('IntersectionObserver' in global)) {
            els.forEach(run);
            return;
        }
        let io = new IntersectionObserver(function (entries) {
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

    function timelines() {
        let lists = $$('.timeline');
        if (!lists.length) return;

        if ('IntersectionObserver' in global) {
            let io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    e.target.classList.toggle('is-lit', e.isIntersecting);
                });
            }, {threshold: 0.35, rootMargin: '-15% 0px -25% 0px'});
            $$('.tl-item').forEach(function (el) {
                io.observe(el);
            });
        } else {
            $$('.tl-item').forEach(function (el) {
                el.classList.add('is-lit');
            });
        }

        if (REDUCED) {
            lists.forEach(function (l) {
                let f = l.querySelector('.timeline-spine-fill');
                if (f) f.style.height = '100%';
            });
            return;
        }

        let ticking = false;

        function update() {
            ticking = false;
            let vh = global.innerHeight;
            lists.forEach(function (list) {
                let fill = list.querySelector('.timeline-spine-fill');
                if (!fill) return;
                let r = list.getBoundingClientRect();
                let start = vh * 0.75;
                let progress = (start - r.top) / (r.height || 1);
                fill.style.height = Math.max(0, Math.min(1, progress)) * 100 + '%';
            });
        }

        global.addEventListener('scroll', function () {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }, {passive: true});
        global.addEventListener('resize', update);
        update();
    }

    function pipeline() {
        let pipe = document.querySelector('.pipeline');
        if (!pipe) return;
        let stages = $$('.pipe-stage', pipe);
        let fill = pipe.querySelector('.pipe-rail-fill');
        let played = false;

        function play() {
            if (played) return;
            played = true;
            if (fill) {
                if (global.innerWidth <= 991) fill.style.height = '100%';
                else fill.style.width = '100%';
            }
            stages.forEach(function (s, i) {
                setTimeout(function () {
                    s.classList.add('is-lit');
                }, REDUCED ? 0 : i * 190);
            });
        }

        if (REDUCED || !('IntersectionObserver' in global)) {
            play();
            return;
        }
        let io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    play();
                    io.disconnect();
                }
            });
        }, {threshold: 0.35});
        io.observe(pipe);
    }

    function rotator() {
        let items = $$('.role-item');
        if (items.length < 2) {
            if (items[0]) items[0].classList.add('is-active');
            return;
        }
        let i = 0;
        items[0].classList.add('is-active');
        if (REDUCED) return;

        setInterval(function () {
            let cur = items[i];
            i = (i + 1) % items.length;
            let next = items[i];
            cur.classList.remove('is-active');
            cur.classList.add('is-leaving');
            next.classList.add('is-active');
            setTimeout(function () {
                cur.classList.remove('is-leaving');
            }, 700);
        }, 3200);
    }

    function heroFade() {
        let hero = document.querySelector('.hero-grid');
        if (!hero || REDUCED) return;
        let ticking = false;

        function update() {
            ticking = false;
            let y = global.scrollY || 0;
            let vh = global.innerHeight;
            if (y > vh) return;
            let p = Math.min(y / (vh * 0.8), 1);
            hero.style.opacity = String(1 - p * 0.9);
            hero.style.transform = 'translateY(' + (p * 40) + 'px)';
        }

        global.addEventListener('scroll', function () {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }, {passive: true});
    }

    function strip() {
        let track = document.querySelector('.strip-track');
        if (!track) return;
        let clone = track.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(track.children, function (c) {
            track.appendChild(c.cloneNode(true));
        });
    }

    global.Anim = {
        boot: boot,
        init: function () {
            strip();
            reveals();
            counters();
            timelines();
            pipeline();
            rotator();
            heroFade();
        }
    };
})(window);
