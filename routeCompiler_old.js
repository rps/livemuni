var fs = require('fs');
var req = require('request');
var mongoose = require('mongoose');
var xmldoc = require('./lib/xmldoc');
var MongoClient = require('mongodb').MongoClient,
    format = require('util').format,
    Server = require('mongodb').Server;
var gm = require('googlemaps'),
    util = require('util');
// mongod --dbpath /path/to/livemuni/db

var mongoClient = new MongoClient(new Server('localhost', 27017));
mongoClient.open(function(err, mongoClient) {
  if(err) throw err;
  console.log('opening mongodb connection');
  // getRoutesFromMuni();
});

var getRoutesFromMuni = function(){
  var dbInfo = {};
  dbInfo.routesdb = mongoClient.db('routesdb');
  dbInfo.busroutes = dbInfo.routesdb.collection('busroutes');

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
      lonlat: {lon: Number(grandChild.attr.lon), lat: Number(grandChild.attr.lat)} // lonlat order required for mongo 2d index
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
  dbInfo.busroutes.insert(routeObj, function(err, result){
    dbInfo.counter--;
    console.log(dbInfo.counter);
    if(dbInfo.counter === 0){
      console.log('closing mongodb connection');
      dbInfo.routesdb.close();
    }
  });
};

// given a route and direction, returns ordered list of JSON stops
exports.queryRouteData = queryRouteData = function(callback, stringInboundOutbound, stringRoutesArr){
  console.log('running queryRouteData');
  console.log(stringRoutesArr);
  var routesdb = mongoClient.db("routesdb");
  var directionalFilter = 'stopTagOrder'+stringInboundOutbound;
  var dynamicDirectionalFilter = '$'+directionalFilter;
  var projectFilter1 = {'stops':1, 'routename':1, _id:0, isMatch: {$cmp: ['$stops.stopTag', dynamicDirectionalFilter]}};
  projectFilter1[directionalFilter] = 1;
  var projectFilter2 = {'stops':1, 'routename':1};
  projectFilter2[directionalFilter] = 1;

  routesdb.collection('busroutes').aggregate([
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

// query stopTags: db.busroutes.find({'stops':{$elemMatch:{'stopTag':"3311"}}})

exports.listAllRoutes = function(cb, originalres){
  console.log('listAllRoutes');
  var routesdb = mongoClient.db('routesdb');
  var busroutes = routesdb.collection('busroutes');
  busroutes.find({},{routename:1, _id:0}).toArray(function(err, res){
    console.log('sending cb routes');
    cb(res, originalres);
  });
};

exports.saveBrain = function(data, response){
  var routesdb = mongoClient.db('routesdb');
  var mapobjects = routesdb.collection('mapobjects2');
  mapobjects.insert({routename:data.routename, path:data.routeSegments, direction:data.direction}, function(err,res){
    if(err) {
      throw err;
    } else {
      console.log('SAVED TO mapobjects2');
      response.end('woot');
    }
  });
};

// var routesToPolylines = function(){
//   var dbInfo = {};
//   dbInfo.routesdb = mongoClient.db('routesdb');
//   dbInfo.busroutes = dbInfo.routesdb.collection('busroutes');
//   dbInfo.polylines = dbInfo.routesdb.collection('polylines');
//   var routelist = [];
//   dbInfo.busroutes.find({},{routename:1, _id:0}).toArray(function(err, result){
//     for(var i = 0; i<result.length; i++){
//       routelist.push(result[i].routename);
//     }
//     for(var j = 0; j<1; j++){ //routelist.length
//       var temp = routelist[j];
//       // delay the sending of each route by 7 seconds
//       (function(thing, index){
//         setTimeout(function(){getPolylines(thing,dbInfo)},index*7000);
//       })(temp, j);
//     }
//   });

// };

// var getPolylines = function(routename, dbInfo){
//   routename = '5'; // fake
//   var storage = [];
//   var counter = 0;
//   var resArr = [];
//   var cb = function(data){
//     for(var i = 0; i<data.length; i++){
//       storage.push(data[i].stops.lonlat.lat+","+data[i].stops.lonlat.lon);
//       console.log(storage[storage.length-1])
//       if(storage.length === 6){
//         counter++;
//         (function(index, saveStorage){
//           console.log('loading in ',index);
//           setTimeout(function(){console.log('firing'); gm.directions(saveStorage[0],saveStorage[saveStorage.length-1],cb2,false,'driving',saveStorage.slice(1,saveStorage.length-1));},1000*index)
//         })(i, storage); 
//         storage = [storage[storage.length-1]];
//       }
//     }

//   };
//   var cb2 = function(err, res){
//     if(err) throw err;
//     console.log('a res')
//     // console.log(res.routes[0])
//     resArr.push(res.routes[0].overview_polyline.points);
//     counter--;
//     if(counter === 0){
//       console.log(resArr.join('\n'));
//     }
//   }
//   console.log('calling ',routename);
//   queryRouteData(cb, 'Inbound',[routename]);
// };


