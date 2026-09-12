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
            } catch (e) {
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

    function easterEggs(field) {
        if (!field || REDUCED) return;

        const skip = 'a, button, input, select, textarea, summary, .panel, .project-card, ' +
            '.interest-card, .teach-card, .contact-link, .skill-node, .repo-card, .metric';

        document.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest(skip)) return;
            field.pulse(e.clientX, e.clientY, 0.9);
        });

        document.addEventListener('dblclick', function (e) {
            if (e.target.closest && e.target.closest(skip)) return;
            field.pulse(e.clientX, e.clientY, 1.4);
        });

        const name = $('.hero-name');
        if (name) {
            name.addEventListener('mouseenter', function () {
                const r = name.getBoundingClientRect();
                field.pulse(r.left + r.width / 2, r.top + r.height / 2, 0.75);
            });
        }

        let lastY = global.scrollY || 0, lastT = performance.now();
        global.addEventListener('scroll', function () {
            const now = performance.now();
            const y = global.scrollY || 0;
            const dt = now - lastT;
            if (dt > 60) {
                const v = Math.abs(y - lastY) / dt;
                if (v > 1.1) field.excite(Math.min(v / 14, 0.30));
                lastY = y;
                lastT = now;
            }
        }, {passive: true});
    }

    function microViz() {
        if (!global.NN) return;

        $$('[data-viz]').forEach(function (canvas) {
            const kind = canvas.getAttribute('data-viz');
            const viz = global.NN.MicroViz(canvas, kind);
            const host = canvas.closest('.interest-card, .teach-card') || canvas.parentElement;
            if (!host || REDUCED) return;

            host.addEventListener('mouseenter', viz.start);
            host.addEventListener('mouseleave', viz.stop);
            host.addEventListener('focusin', viz.start);
            host.addEventListener('focusout', viz.stop);
        });

        $$('[data-plot]').forEach(function (canvas) {
            global.NN.StaticPlot(canvas, canvas.getAttribute('data-plot'));
        });
    }

    function anchors() {
        $$('a[href^="#"]').forEach(function (a) {
            const id = a.getAttribute('href');
            if (!id || id === '#') return;
            a.addEventListener('click', function (e) {
                const target = document.querySelector(id);
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({
                    behavior: REDUCED ? 'auto' : 'smooth',
                    block: 'start'
                });
                target.setAttribute('tabindex', '-1');
                setTimeout(function () {
                    target.focus({preventScroll: true});
                }, 400);
                if (history.replaceState) history.replaceState(null, '', id);
            });
        });
    }

    function misc() {
        const y = $('#year');
        if (y) y.textContent = new Date().getFullYear();

        const portrait = $('#portrait-img');
        if (portrait) {
            portrait.addEventListener('error', function () {
                portrait.style.display = 'none';
            });
        }
    }

    global.UI = {
        init: function (field) {
            nav();
            scrollspy();
            cursor();
            anchors();
            microViz();
            researchMode(field);
            easterEggs(field);
            misc();
        }
    };

})(window);