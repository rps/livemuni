
/**
 * Module dependencies.
 */
var common = require('./common.js'),
    app = common.express(),
    routes = require('./routes/routes.js'),
    config = require('../config.js');

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
app.get('/lib*', routes.files);
app.get('/livemuni.js', routes.main);
app.get('/genpath', routes.pathgen);

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

// Create server
common.http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});