
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes/routes.js');
var http = require('http');
var path = require('path');
var config = require('../config.js');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, '../client/index.html')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/files*', routes.files); // rewrite
app.get('/style*', routes.style);
app.get('/main.js', routes.main);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});