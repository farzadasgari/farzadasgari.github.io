(function (global) {
    'use strict';

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        const NN = global.NN;
        let field = null;

        const bg = document.getElementById('neural-canvas');
        if (bg && NN) {
            try {
                field = new NN.NeuralField(bg);
            } catch (err) {
                bg.style.display = 'none';
                if (global.console) console.warn('Neural field unavailable:', err);
            }
        }
        if (global.Anim) {
            global.Anim.boot(function () {
                if (global.Anim) global.Anim.init();
            });
        } else {
            document.body.classList.add('is-booted');
        }

        setTimeout(function () {
            document.body.classList.add('is-booted');
            const b = document.getElementById('boot');
            if (b) b.classList.add('is-done');
            document.body.style.removeProperty('overflow');
        }, 5000);
    })
})(window);