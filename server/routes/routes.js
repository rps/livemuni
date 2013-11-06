var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');
var routeCompiler = require('../../routeCompiler.js');

exports.index = function(req, res){
  var readStream = fs.createReadStream(path.join(__dirname, '../../client/index.html')).pipe(res);
  readStream.on('error', function(err) {
    res.end(err);
  });
};

exports.files = function(req, res){
  fs.createReadStream(path.join(__dirname, '../../lib/', req.url.slice(req.url.indexOf('lib/')+4))).pipe(res);
};

exports.main = function(req, res){
  var readStream = fs.createReadStream(path.join(__dirname, '../../client', req.url)).pipe(res);
};

exports.pathgen = function(req, res){
  fs.createReadStream(path.join(__dirname, '../pathgen.html')).pipe(res);
};

exports.coordinates = function(req, res){
  routeCompiler.eligibleRoutes(req[0], req[1], req[2], res);
};

exports.pullBusRoutes = function(req, res){
  routeCompiler.pullRoutes(req, res);
};