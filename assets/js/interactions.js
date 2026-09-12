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