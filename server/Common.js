var common = {
  util: require('util'),
  fs: require('fs'),
  path: require('path'),
  express: require('express'),
  routes: require('./routes/routes.js'),
  http: require('http'),
  path: require('path'),
  req: require('request'),
  config: require('../config.js'),
  MongoClient: require('mongodb').MongoClient,
  format: require('util').format,
  Server: require('mongodb').Server
};

module.exports = common;