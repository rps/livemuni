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
  // getRoutes();
  queryRouteData('x','Inbound',['45']);
});

var getRoutes = function(){
  var dbInfo = {};
  dbInfo.routesdb = mongoClient.db("routesdb");
  dbInfo.routepoints = dbInfo.routesdb.collection('routepoints');

  req('http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni&terse', function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var doc = new xmldoc.XmlDocument(response.body);
      dbInfo.counter = 0;
      var parseRoutesNow = parseRoutes.bind(undefined, dbInfo);
      doc.eachChild(parseRoutesNow);
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

var parseRoutes = function(dbInfo, child, index, array){
  if(child.name === 'route'){
    dbInfo.counter++;
    console.log(dbInfo.counter);
    var routeObj = makeRouteObj(child.attr.tag, child.attr.title, child.attr.color, child.attr.oppositeColor);
    var parseRouteStopsNow = parseRouteStops.bind(undefined, dbInfo, routeObj);

    child.eachChild(parseRouteStopsNow);
    insertIntoDB(routeObj, dbInfo);
  }
};

var parseRouteStops = function(dbInfo, routeObj, grandChild, index, array){
  if(grandChild.name === 'stop'){
    routeObj.stops.push({
      stopTag: grandChild.attr.tag,
      stopName: grandChild.attr.title,
      lat: grandChild.attr.lat,
      lon: grandChild.attr.lon
    });
  } else if(grandChild.name === 'direction'){
    var collectStopTagsNow = collectStopTags.bind(undefined, routeObj, grandChild.attr.name);
    grandChild.eachChild(collectStopTagsNow);
  }
};

var collectStopTags = function(routeObj, direction, stop, index){
  if(direction === 'Inbound'){
    routeObj.stopTagOrderInbound.push(stop.attr.tag);
  } else if (direction === 'Outbound'){
    routeObj.stopTagOrderOutbound.push(stop.attr.tag);
  }
};

var insertIntoDB = function(routeObj, dbInfo){
  dbInfo.routepoints.insert(routeObj, function(err, docs){
    dbInfo.counter--;
    console.log(dbInfo.counter);
    if(dbInfo.counter === 0){
      console.log('closing mongodb connection');
      dbInfo.routesdb.close();
    }
  });
};

var queryRouteData = function(callback, stringInboundOutbound, stringRoutesArr){
  var routesdb = mongoClient.db("routesdb");
  var directionalFilter = 'stopTagOrder'+stringInboundOutbound;
  var dynamicDirectionalFilter = '$'+directionalFilter;
  var projectFilter1 = {'stops':1, isMatch: {$cmp: ['$stops.stopTag', dynamicDirectionalFilter]}, _id:0, 'routename':1};
  projectFilter1[directionalFilter] = 1;
  var projectFilter2 = {'stops':1, 'routename':1};
  projectFilter2[directionalFilter] = 1;

  routesdb.collection('routepoints').aggregate([
    { $match: {routename: {$in: stringRoutesArr}} },
    { $unwind: '$stops' },
    { $unwind: dynamicDirectionalFilter},
    { $project: projectFilter1},
    { $match: {isMatch: 0}},
    { $project: projectFilter2}
  ], function(err, result){
    callback(result);
  });
};
/*
SELECT stops
WHERE routename = 45
AND stops IN (SELECT stopTagOrderOutbound WHERE routename = 45)
*/