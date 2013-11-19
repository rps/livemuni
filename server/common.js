var common = {
  util: require('util'),
  format: require('util').format,
  fs: require('fs'),
  path: require('path'),
  express: require('express'),
  http: require('http'),
  req: require('request'),
  MongoClient: require('mongodb').MongoClient,
  Server: require('mongodb').Server
};

module.exports = common;