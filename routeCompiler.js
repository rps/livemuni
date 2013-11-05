var fs = require('fs');
var req = require('request');
var xmldoc = require('./lib/xmldoc');
var MongoClient = require('mongodb').MongoClient,
    format = require('util').format,
    Server = require('mongodb').Server;
// var gm = require('googlemaps'),
    // util = require('util');
// mongod --dbpath /path/to/livemuni/db

var mongoClient = new MongoClient(new Server('localhost', 27017));
mongoClient.open(function(err, mongoClient) {
  if(err) throw err;
  console.log('opening mongodb connection');
  // getRoutesFromMuni();
  // createRoutesCollection();
});

var connect = function(dbName){
  var dbInfo = {};
  dbInfo[dbName] = mongoClient.db(dbName);
  for(var i = 1; i<arguments.length; i++){
    dbInfo[arguments[i]] = dbInfo[dbName].collection(arguments[i]);
  }
  return dbInfo;
};

var getRoutesFromMuni = function(){
  var dbInfo = connect('routesdb','busroutes');

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
    var mongoRouteObj = mongoReformat(routeObj);
    insertIntoDB(mongoRouteObj, dbInfo);
  }
};

var parseRouteStops = function(dbInfo, routeObj, grandChild, index, array){
  if(grandChild.name === 'stop' && grandChild.attr.lon && grandChild.attr.lat){ // some lon/lat are undefined from nextmuni
    routeObj.stops.push({
      stopTag: grandChild.attr.tag,
      stopName: grandChild.attr.title,
      lonlat: [Number(grandChild.attr.lon), Number(grandChild.attr.lat)] // lonlat order required for mongo 2d index
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

// quickfix to create more readily queryable mongo collection
var mongoReformat = function(routeObj){
  var mongoRouteObj = {stopsInbound:[], stopsOutbound:[]};
  mongoRouteObj.routename = routeObj.routename;
  mongoRouteObj.longname = routeObj.longname;
  mongoRouteObj.color = routeObj.color;
  mongoRouteObj.oppositeColor = routeObj.oppositeColor;
  for(var i = 0; i<routeObj.stopTagOrderInbound.length; i++){
    for(var j = 0; j<routeObj.stops.length; j++){
      if(routeObj.stops[j].stopTag === routeObj.stopTagOrderInbound[i]){
        mongoRouteObj.stopsInbound.push(routeObj.stops[j]);
      }
    }
  }
  for(var k = 0; k<routeObj.stopTagOrderOutbound.length; k++){
    for(var l = 0; l<routeObj.stops.length; l++){
      if(routeObj.stops[l].stopTag === routeObj.stopTagOrderOutbound[k]){
        mongoRouteObj.stopsOutbound.push(routeObj.stops[l]);
      }
    }
  }
  return mongoRouteObj;
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



// query stopTags: db.busroutes.find({'stops':{$elemMatch:{'stopTag':"3311"}}})

exports.listAllRoutes = function(cb, originalres){
  console.log('listAllRoutes');
  var routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  var busroutes = routesdb.collection('busroutes'); // TODO: use connect function
  busroutes.find({},{routename:1, _id:0}).toArray(function(err, res){
    console.log('sending cb routes');
    cb(res, originalres);
  });
};

// dual function to save user coord early when possible
exports.findRoutesNear = findRoutesNear = function(coordinates, cb){
  var dbInfo = connect('routesdb','busroutes');
  // callback array of string stopnames within .4 miles. maxdistradians is .4 / 69
  console.log('findroutesnear',coordinates)
  dbInfo.busroutes.distinct('routename',{'stopsOutbound.lonlat': { $near: coordinates, $maxDistance: 0.00578745247 }},function(err,res){
    if(err) throw err;
    var routesObj = {}; // could give this a length property = res.length, then use to determine which obj to iterate over in eligibleRoutes
    for(var i = 0; i<res.length; i++){
      routesObj[res[i]] = true;
    }
    cb(routesObj);
  });
};

exports.eligibleRoutes = function(userCoord, destCoord, direction, res){
  console.log('eligibleroutes');
  var routeComparator = {
    userCoord: userCoord,
    destCoord: destCoord,
    direction: direction,
    routesNearUser: {},
    sharedRoutes: [],
    res: res
  };
  routeComparator.setUser = function(routesNearUser){
    this.routesNearUser = routesNearUser;
    findRoutesNear(this.destCoord, this.compareRoutes); 
  };
  routeComparator.compareRoutes = function(routesNearDest){
    console.log(Object.keys(this.routesNearUser).length, 'keylength');
    console.log(this.routesNearUser,'xxxxxxxxxxxxxxxxxxxxxxxx', routesNearDest)
    for(var key in routesNearDest){
      this.routesNearUser[key] && this.sharedRoutes.push(key);
    }
    getClosestStops(this.userCoord,this.direction,this.sharedRoutes, this.res);
  };
  routeComparator.setUser = routeComparator.setUser.bind(routeComparator);
  routeComparator.compareRoutes = routeComparator.compareRoutes.bind(routeComparator);
  findRoutesNear(userCoord,routeComparator.setUser);
};

var getClosestStops = function(userCoord, direction, routesArr, result){
  var dbInfo = connect('routesdb','busstops');
  console.log('getclosest',userCoord, direction, routesArr);
  dbInfo.busstops.find( {lonlat: {$near: userCoord }, direction: direction, routename: {$in: routesArr} }).toArray(function(err,res){
    var closestStops = {};
    for(var i = 0; i<res.length; i++){
      closestStops[res[i].routename] = closestStops[res[i].routename] || {lonlat:res[i].lonlat, stopTag:res[i].stopTag}; // lonlat for rendering, stoptag and route for updating
    }
    console.log(closestStops, 'closeststops');
    result.end(JSON.stringify(closestStops));
  });
};

exports.saveBrain = function(data, response){
  var routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  var mapobjects = routesdb.collection('mapobjects'); // TODO: use connect function
  mapobjects.insert({routename:data.routename, path:data.routeSegments, direction:data.direction}, function(err,res){
    if(err) {
      throw err;
    } else {
      console.log('SAVED TO mapobjects');
      response.end('woot');
    }
  });
};

var createRoutesCollection = function(){
  var globalMind = {
    routeTicker: 0,
    allRoutes: [],
    counter: 0,
    trigger: function(){
      if(this.routeTicker < this.allRoutes.length){
        routeDecompiler(this.allRoutes[this.routeTicker],this);
        this.routeTicker++;
      } else {
        this.routesdb.close();
      }
    }
  };

  globalMind.routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  globalMind.busroutes = globalMind.routesdb.collection('busroutes'); // TODO: use connect function
  globalMind.busstops = globalMind.routesdb.collection('busstops');// TODO: use connect function
  globalMind.busroutes.find({}).toArray(function(err,res){
    if(!err){
      globalMind.allRoutes = res;
      globalMind.trigger();
    }
  });
};

var routeDecompiler = function(aRoute, globalMind){
  var decompiledRoute = [];
  var tempStopInbound = {};
  var tempStopOutbound = {};
  for(var i = 0; i<aRoute.stopsInbound.length; i++){
    tempStopInbound = aRoute.stopsInbound[i];
    tempStopInbound.routename = aRoute.routename;
    tempStopInbound.color = aRoute.color;
    tempStopInbound.oppositeColor = aRoute.oppositeColor;
    tempStopInbound.direction = 'Inbound';
    decompiledRoute.push(tempStopInbound);
    globalMind.counter++;
  }
  for(var j = 0; j<aRoute.stopsOutbound.length; j++){
    tempStopOutbound = aRoute.stopsOutbound[j];
    tempStopOutbound.routename = aRoute.routename;
    tempStopOutbound.color = aRoute.color;
    tempStopOutbound.oppositeColor = aRoute.oppositeColor;
    tempStopOutbound.direction = 'Outbound';
    decompiledRoute.push(tempStopOutbound);
    globalMind.counter++;
    console.log(globalMind.counter);
  }
  for(var k = 0; k<decompiledRoute.length; k++){
    globalMind.busstops.insert(decompiledRoute[k], function(err, res){
      if(err) throw err;
      globalMind.counter--;
      console.log(globalMind.counter);
      if(globalMind.counter === 0){
        globalMind.trigger();
      }
    });
  }

};

// // old polyline scraper
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


// // given a route and direction, returns ordered list of JSON stops
// // no longer works following destruction of old busroutes collection
// exports.queryRouteData = queryRouteData = function(callback, stringInboundOutbound, stringRoutesArr){
//   console.log('running queryRouteData');
//   var routesdb = mongoClient.db("routesdb");
//   var directionalFilter = 'stopTagOrder'+stringInboundOutbound;
//   var dynamicDirectionalFilter = '$'+directionalFilter;
//   var projectFilter1 = {'stops':1, 'routename':1, _id:0, isMatch: {$cmp: ['$stops.stopTag', dynamicDirectionalFilter]}};
//   projectFilter1[directionalFilter] = 1;
//   var projectFilter2 = {'stops':1, 'routename':1};
//   projectFilter2[directionalFilter] = 1;

//   routesdb.collection('busroutes').aggregate([
//     { $match: {routename: {$in: stringRoutesArr}} },
//     { $unwind: '$stops' },
//     { $unwind: dynamicDirectionalFilter},
//     { $project: projectFilter1},
//     { $match: {isMatch: 0}},
//     { $project: projectFilter2}
//   ], function(err, result){
//     callback(result);
//   });
// };
// /*
// SELECT stops
// WHERE routename = 45
// AND stops IN (SELECT stopTagOrderOutbound WHERE routename = 45)
// */