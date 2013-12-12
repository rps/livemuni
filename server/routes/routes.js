var common = require('../common.js'),
    routeCompiler = require('../routeCompiler.js'),
    routeComparator = require('../routeComparator.js');

exports.index = function(req, res){
  var readStream = common.fs.createReadStream(common.path.join(__dirname, '../../client/index.html')).pipe(res);
  readStream.on('error', function(err) {
    res.end(err);
  });
};

exports.files = function(req, res){
  res.setHeader('Content-Type','application/javascript');
  common.fs.createReadStream(common.path.join(__dirname, '../../lib/', req.url.slice(req.url.indexOf('lib/')+4))).pipe(res);
};

exports.main = function(req, res){
  res.setHeader('Content-Type','application/javascript');
  common.fs.createReadStream(common.path.join(__dirname, '../../client/dist/livemuni.js')).pipe(res);
};

exports.style = function(req, res){
  res.setHeader('Content-Type','text/css');
  common.fs.createReadStream(common.path.join(__dirname, '../../client/style.css')).pipe(res);
};

exports.coordinates = function(req, res){
  routeComparator.eligibleRoutes(req[0], req[1], res);
};

exports.findStopsOnRoutes = function(req, res){
  routeCompiler.findStopsOnRoutes(req, res);
};

exports.pathgen = function(req, res){
  common.fs.createReadStream(common.path.join(__dirname, '../precompiler/pathgen.html')).pipe(res);
};

// DEL
exports.pullBusRoutes = function(req, res){
  routeCompiler.pullRoutes(req, res);
};