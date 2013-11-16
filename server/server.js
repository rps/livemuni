
/**
 * Module dependencies.
 */
var common = require('common.js'),
    app = common.express(),
    routes = require('./routes/routes.js'),
    config = require('../config.js'),
    routeCompiler = require('./routeCompiler.js'); // DEL

// All environments
app.set('port', process.env.PORT || 3000);
app.set('views', common.path.join(__dirname, 'views'));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(common.path.join(__dirname, '../client/index.html')));

// Development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
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
// DEL
app.post('/saveNewPath', function(req, res){
  console.log('INCOMING POST');
  routeCompiler.saveBrain(req.body, res);
});
app.post('/findStopsOnRoutes', function(req,res){
  routes.findStopsOnRoutes(req.body, res);
});
common.http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
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
  var readStream = common.fs.createReadStream(common.path.join(__dirname, './generatePath.js')).pipe(res);
  readStream.on('error', function(error){
    console.log(error);
    res.end(error);
  });
}