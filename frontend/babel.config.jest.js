/**
 * Delivery360 - Babel Configuration for Jest ONLY
 * 
 * NOTE: This file is used only for Jest tests.
 * Next.js uses its internal compiler (SWC) by default.
 * For production/development builds, Next.js does NOT use this file.
 */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
  ],
};
