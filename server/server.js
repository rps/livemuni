
/**
 * Module dependencies.
 */
var common = require('./common.js'),
    app = common.express(),
    routes = require('./routes/routes.js'),
    config = require('../config.js'),
    routeCompiler = require('./routeCompiler.js'); // DEL

// All environments
app.set('port', process.env.PORT || 3000);
app.set('views', common.path.join(__dirname, 'views'));
app.use(common.express.favicon());
app.use(common.express.logger('dev'));
app.use(common.express.json());
app.use(common.express.urlencoded());
app.use(common.express.bodyParser());
app.use(common.express.methodOverride());
app.use(app.router);
app.use(common.express.static(common.path.join(__dirname, '../client/index.html')));

// Development only
if ('development' == app.get('env')) {
  app.use(common.express.errorHandler());
}

// GET request handling
app.get('/', routes.index);
app.get('/style.css', routes.style);
app.get('/lib*', routes.files); // TODO remove
app.get('/livemuni.js', routes.main);
app.get('/genpath', routes.pathgen);
app.get('/generatePath.js', generatePathData);
app.get('/triggerPathGen', triggerPathGen);

// POST request handling
app.post('/routify', function(req, res){
  routes.pullBusRoutes(req.body, res);
});

app.post('/coordinates', function(req, res){
  routes.coordinates(req.body, res);
});

app.post('/findStopsOnRoutes', function(req,res){
  routes.findStopsOnRoutes(req.body, res);
});

common.http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

/************************************
 Functions below queued for deletion
************************************/

// DEL
app.post('/saveNewPath', function(req, res){
  console.log('INCOMING POST');
  routeCompiler.saveBrain(req.body, res);
});

// DEL
function triggerPathGen(req, res){
  routeCompiler.listAllRoutes(cbcontinue, res);
}

// DEL - queryRouteData missing
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

// DEL
function generatePathData(req, res){
  res.set('Content-Type', 'application/javascript');
  var readStream = common.fs.createReadStream(common.path.join(__dirname, '../precompiler/generatePath.js')).pipe(res);
  readStream.on('error', function(error){
    console.log(error);
    res.end(error);
  });
}