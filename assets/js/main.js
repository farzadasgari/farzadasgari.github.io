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
    })
})(window);