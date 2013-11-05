
/*
 * GET home page.
 */

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

exports.style = function(req, res){
  fs.createReadStream(path.join(__dirname, '../../client/style.css')).pipe(res);
};

exports.main = function(req, res){
  var readStream = fs.createReadStream(path.join(__dirname, '../../client/client.js')).pipe(res);
};

exports.busroutes = function(req, res){
  var direction = 'Inbound'; // TODO change
  var routes = ['45','21'];  // TODO change
  var callback = function(data){ // TODO change
    console.log('Success! ', data); // do something with the data
  };
  routeCompiler.queryRouteData(callback, direction, routes);
};

exports.pathgen = function(req, res){
  fs.createReadStream(path.join(__dirname, '../pathgen.html')).pipe(res);
};

exports.coordinates = function(req, res){
  routeCompiler.eligibleRoutes(req[0],req[1], 'Outbound', res);
};