const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .db extension for SQLite database files
config.resolver.assetExts.push('db');

module.exports = config;
