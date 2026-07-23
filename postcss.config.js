const colorMixFallback = require('./scripts/postcss-color-mix-fallback');

module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('postcss-lightningcss')({
      browsers: '>= 0.25%',
      lightningcssOptions: {
        minify: false,
      },
    }),

    colorMixFallback(),
  ],
};