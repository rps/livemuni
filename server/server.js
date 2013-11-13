
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes/routes.js');
var http = require('http');
var path = require('path');
var config = require('../config.js');
var routeCompiler = require('./routeCompiler.js');
var fs = require('fs');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, '../client/index.html')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/style.css', routes.style);
app.get('/lib*', routes.files); // TODO remove
app.get('/livemuni.js', routes.main);
app.get('/genpath', routes.pathgen);
app.get('/generatePath.js', generatePathData);
app.get('/triggerPathGen', triggerPathGen);

app.post('/routify', function(req, res){
  console.log(req.body);
  routes.pullBusRoutes(req.body, res);
});

app.post('/coordinates', function(req, res){
  console.log('coordinates post req');
  routes.coordinates(req.body, res);
});

app.post('/saveNewPath', function(req, res){
  console.log('INCOMING POST');
  routeCompiler.saveBrain(req.body, res);
});

app.post('/findStopsOnRoutes', function(req,res){
  routes.findStopsOnRoutes(req.body, res);
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

function triggerPathGen(req, res){
  routeCompiler.listAllRoutes(cbcontinue, res);
}

function cbcontinue(routeData, originalres){
  var routes = [];
  for (var i = 0; i<routeData.length; i++){
    routes.push(routeData[i].routename);
  }
  console.log('triggerPathGen');
  var direction = 'Outbound'; // TODO change
  var callback = function(data){
    console.log('called back');
    originalres.set('Content-Type', 'application/javascript');
    originalres.send(data);
  };
  routeCompiler.queryRouteData(callback, direction, routes);
}

function generatePathData(req, res){
  res.set('Content-Type', 'application/javascript');
  var readStream = fs.createReadStream(path.join(__dirname, './generatePath.js')).pipe(res);
  readStream.on('error', function(error){
    console.log(error);
    res.end(error);
  });
}