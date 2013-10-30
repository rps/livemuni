
/*
 * GET home page.
 */

var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');

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
  var readStream = fs.createReadStream(path.join(__dirname, '../../client/main.js')).pipe(res);
};