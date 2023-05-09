const webpack = require("webpack");

module.exports = function override(config) {
  return {
    ...config,
    ignoreWarnings: [
      {
        module: /node_modules/,
      },
    ],
    plugins: (config.plugins || []).concat([
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
      }),
    ]),
  };
};
