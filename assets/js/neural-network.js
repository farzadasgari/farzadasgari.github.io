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

    global.NN = {
        reduced: REDUCED,
        tier: deviceTier,
    };

})(window);
