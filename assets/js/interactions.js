(function (global) {
    'use strict';

    const REDUCED = global.NN ? global.NN.reduced : false;
    const $ = function (s, r) {
        return (r || document).querySelector(s);
    };
    const $$ = function (s, r) {
        return Array.prototype.slice.call((r || document).querySelectorAll(s));
    };

    const store = {
        get: function (k) {
            try {
                return localStorage.getItem(k);
            } catch (e) {
                return null;
            }
        },
        set: function (k, v) {
            try {
                localStorage.setItem(k, v);
            } catch (e) { /* private mode */
            }
        }
    };

    function nav() {
        const bar = $('#nav');
        if (!bar) return;

        let ticking = false;

        function onScroll() {
            ticking = false;
            bar.classList.toggle('is-scrolled', (global.scrollY || 0) > 40);
        }

        global.addEventListener('scroll', function () {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(onScroll);
            }
        }, {passive: true});
        onScroll();

        const panel = $('#mobile-nav');
        if (panel && global.bootstrap) {
            $$('a', panel).forEach(function (a) {
                a.addEventListener('click', function () {
                    const inst = global.bootstrap.Offcanvas.getInstance(panel);
                    if (inst) inst.hide();
                });
            });
        }
    }

    function scrollspy() {
        const sections = $$('section[id]');
        const links = $$('[data-nav]');
        if (!sections.length || !links.length) return;

        if (!('IntersectionObserver' in global)) return;

        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                const id = e.target.id;
                links.forEach(function (l) {
                    l.classList.toggle('is-active', l.getAttribute('href') === '#' + id);
                });
            });
        }, {rootMargin: '-45% 0px -50% 0px'});

        sections.forEach(function (s) {
            io.observe(s);
        });
    }

    function cursor() {
        const fine = global.matchMedia && global.matchMedia('(pointer: fine)').matches;
        if (!fine || REDUCED) return;

        const dot = document.createElement('div');
        const ring = document.createElement('div');
        dot.className = 'cursor-dot';
        ring.className = 'cursor-ring';
        dot.setAttribute('aria-hidden', 'true');
        ring.setAttribute('aria-hidden', 'true');
        document.body.appendChild(dot);
        document.body.appendChild(ring);

        let mx = -100, my = -100, rx = -100, ry = -100, raf;

        global.addEventListener('pointermove', function (e) {
            if (e.pointerType === 'touch') return;
            mx = e.clientX;
            my = e.clientY;
            dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
        }, {passive: true});

        (function loop() {
            raf = requestAnimationFrame(loop);
            rx += (mx - rx) * 0.18;
            ry += (my - ry) * 0.18;
            ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
        })();

        const interactive = 'a, button, .skill-node, .project-card, .interest-card, .contact-link, [role="button"], input, summary';
        document.addEventListener('pointerover', function (e) {
            if (e.target.closest && e.target.closest(interactive)) ring.classList.add('is-hover');
        });
        document.addEventListener('pointerout', function (e) {
            if (e.target.closest && e.target.closest(interactive)) ring.classList.remove('is-hover');
        });
        document.addEventListener('pointerleave', function () {
            dot.style.opacity = '0';
            ring.style.opacity = '0';
        });
        document.addEventListener('pointerenter', function () {
            dot.style.opacity = '1';
            ring.style.opacity = '1';
        });
    }

    function researchMode(field) {
        const btns = $$('[data-research-toggle]');
        if (!btns.length) return;

        const hud = $('#hud');
        let timer = null;

        function apply(on) {
            document.body.classList.toggle('research-mode', on);
            btns.forEach(function (b) {
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            if (field) field.setLabels(on);
            if (on && hud && field) {
                timer = setInterval(function () {
                    const s = field.stats();
                    hud.innerHTML =
                        '<div class="row"><span class="k">nodes</span><span>' + s.nodes + '</span></div>' +
                        '<div class="row"><span class="k">edges</span><span>' + s.links + '</span></div>' +
                        '<div class="row"><span class="k">signals</span><span>' + s.signals + '</span></div>' +
                        '<div class="row"><span class="k">frame</span><span>' + s.ms + ' ms</span></div>' +
                        '<div class="row"><span class="k">state</span><span>ACTIVE</span></div>';
                }, 500);
            } else if (timer) {
                clearInterval(timer);
                timer = null;
            }
            store.set('research-mode', on ? '1' : '0');
        }

        btns.forEach(function (b) {
            b.addEventListener('click', function () {
                apply(!document.body.classList.contains('research-mode'));
            });
        });

        if (store.get('research-mode') === '1') apply(true);
    }