var fs = require('fs');
var req = require('request');
var mongoose = require('mongoose');
var xmldoc = require('./lib/xmldoc');
var MongoClient = require('mongodb').MongoClient,
    format = require('util').format,
    Server = require('mongodb').Server;

// mongod --dbpath /path/to/livemuni/db

var mongoClient = new MongoClient(new Server('localhost', 27017));
mongoClient.open(function(err, mongoClient) {
  if(err) throw err;
  console.log('opening mongodb connection');
  var routesdb = mongoClient.db("routesdb");
  getRoutes(routesdb);
});

var getRoutes = function(routesdb){
  var routepoints = routesdb.collection('routepoints');
  req('http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni&terse', function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var doc = new xmldoc.XmlDocument(response.body);
      var counter = 0;
      doc.eachChild(function(child,index,array){
        if(child.name === 'route'){
          counter++;
          var routeObj = makeRouteObj(child.attr.tag, child.attr.title, child.attr.color, child.attr.oppositeColor);
          child.eachChild(function(grandChild,index,array){
            if(grandChild.name === 'stop'){
              routeObj.stops.push({
                stopTag: grandChild.attr.tag,
                stopName: grandChild.attr.title,
                lat: grandChild.attr.lat,
                lon: grandChild.attr.lon
              });
            } else if(grandChild.name === 'direction'){
              if(grandChild.attr.name === 'Inbound'){
                grandChild.eachChild(function(stop, index){
                  routeObj.stopTagOrderInbound.push(stop.attr.tag);
                });
              } else if(grandChild.attr.name === 'Outbound'){
                grandChild.eachChild(function(stop, index){
                  routeObj.stopTagOrderOutbound.push(stop.attr.tag);
                });
              }
            }
          });
          routepoints.insert(routeObj, function(err, docs){
            counter--;
            if(counter === 0){
              console.log('closing mongodb connection');
              routesdb.close();
            }
          });
        }
      });
    }
  });
};

var makeRouteObj = function(tag, title, color, oppositeColor){
  return {
    stops: [],
    stopTagOrderInbound: [],
    stopTagOrderOutbound: [],
    routename: tag,
    longname: title,
    color: color,
    oppositeColor: oppositeColor
  };
};