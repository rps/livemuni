var fs = require('fs');
var req = require('request');
var xmldoc = require('xmldoc');
var MongoClient = require('mongodb').MongoClient,
    format = require('util').format,
    Server = require('mongodb').Server;
// mongod --dbpath /path/to/livemuni/db

var mongoClient = new MongoClient(new Server('localhost', 27017));
mongoClient.open(function(err, mongoClient) {
  if(err) console.log("This is an error: ",err);
  console.log('opening mongodb connection');
  // getRoutesFromMuni();
  // createRoutesCollection();
  // spool();
});



var connect = function(dbName){
  var dbInfo = {};
  dbInfo[dbName] = mongoClient.db(dbName);
  for(var i = 1; i<arguments.length; i++){
    dbInfo[arguments[i]] = dbInfo[dbName].collection(arguments[i]);
  }
  return dbInfo;
};

var spool = function(){
  var obby = {"1":{"color":"cc6600","oppcolor":"000000"},"2":{"color":"000000","oppcolor":"ffffff"},"3":{"color":"339999","oppcolor":"000000"},"5":{"color":"666699","oppcolor":"ffffff"},"6":{"color":"996699","oppcolor":"000000"},"9":{"color":"889944","oppcolor":"000000"},"10":{"color":"b07d00","oppcolor":"000000"},"12":{"color":"b07d00","oppcolor":"000000"},"14":{"color":"339999","oppcolor":"000000"},"17":{"color":"003399","oppcolor":"ffffff"},"18":{"color":"996699","oppcolor":"000000"},"19":{"color":"000000","oppcolor":"ffffff"},"21":{"color":"660000","oppcolor":"ffffff"},"22":{"color":"ff6633","oppcolor":"000000"},"23":{"color":"b07d00","oppcolor":"000000"},"24":{"color":"996699","oppcolor":"000000"},"27":{"color":"660099","oppcolor":"ffffff"},"28":{"color":"000000","oppcolor":"ffffff"},"29":{"color":"ff6633","oppcolor":"000000"},"30":{"color":"990099","oppcolor":"ffffff"},"31":{"color":"339999","oppcolor":"000000"},"33":{"color":"660000","oppcolor":"ffffff"},"35":{"color":"ff6633","oppcolor":"000000"},"36":{"color":"003399","oppcolor":"ffffff"},"37":{"color":"000000","oppcolor":"ffffff"},"38":{"color":"ff6633","oppcolor":"000000"},"39":{"color":"ff6633","oppcolor":"000000"},"41":{"color":"b07d00","oppcolor":"000000"},"43":{"color":"006633","oppcolor":"ffffff"},"44":{"color":"ff6633","oppcolor":"000000"},"45":{"color":"006633","oppcolor":"ffffff"},"47":{"color":"667744","oppcolor":"ffffff"},"48":{"color":"cc6600","oppcolor":"000000"},"49":{"color":"b07d00","oppcolor":"000000"},"52":{"color":"889944","oppcolor":"000000"},"54":{"color":"cc0033","oppcolor":"ffffff"},"56":{"color":"990099","oppcolor":"ffffff"},"59":{"color":"cc3399","oppcolor":"ffffff"},"60":{"color":"4444a4","oppcolor":"ffffff"},"61":{"color":"9ac520","oppcolor":"000000"},"66":{"color":"666699","oppcolor":"ffffff"},"67":{"color":"555555","oppcolor":"ffffff"},"71":{"color":"667744","oppcolor":"ffffff"},"88":{"color":"555555","oppcolor":"ffffff"},"90":{"color":"660000","oppcolor":"ffffff"},"91":{"color":"667744","oppcolor":"ffffff"},"108":{"color":"555555","oppcolor":"ffffff"},"F":{"color":"555555","oppcolor":"ffffff"},"J":{"color":"cc6600","oppcolor":"000000"},"KT":{"color":"cc0033","oppcolor":"ffffff"},"L":{"color":"660099","oppcolor":"ffffff"},"M":{"color":"006633","oppcolor":"ffffff"},"N":{"color":"003399","oppcolor":"ffffff"},"NX":{"color":"006633","oppcolor":"ffffff"},"1AX":{"color":"990000","oppcolor":"ffffff"},"1BX":{"color":"cc3333","oppcolor":"ffffff"},"5L":{"color":"666699","oppcolor":"ffffff"},"8X":{"color":"996699","oppcolor":"000000"},"8AX":{"color":"996699","oppcolor":"000000"},"8BX":{"color":"996699","oppcolor":"000000"},"9L":{"color":"889944","oppcolor":"000000"},"14L":{"color":"009900","oppcolor":"ffffff"},"14X":{"color":"cc0033","oppcolor":"ffffff"},"16X":{"color":"cc0033","oppcolor":"ffffff"},"28L":{"color":"009900","oppcolor":"ffffff"},"30X":{"color":"cc0033","oppcolor":"ffffff"},"31AX":{"color":"990000","oppcolor":"ffffff"},"31BX":{"color":"cc3333","oppcolor":"ffffff"},"38AX":{"color":"990000","oppcolor":"ffffff"},"38BX":{"color":"cc3333","oppcolor":"ffffff"},"38L":{"color":"009900","oppcolor":"ffffff"},"71L":{"color":"009900","oppcolor":"ffffff"},"76X":{"color":"009900","oppcolor":"ffffff"},"81X":{"color":"cc0033","oppcolor":"ffffff"},"82X":{"color":"cc0033","oppcolor":"ffffff"},"83X":{"color":"cc0033","oppcolor":"ffffff"},"K OWL":{"color":"198080","oppcolor":"ffffff"},"L OWL":{"color":"330066","oppcolor":"ffffff"},"M OWL":{"color":"004d19","oppcolor":"ffffff"},"N OWL":{"color":"001980","oppcolor":"ffffff"},"T OWL":{"color":"001980","oppcolor":"ffffff"}}; 
  var dbInfo = connect('routesdb','mapobjects2');
  for(var key in obby){
    console.log(key, obby[key].color);
    dbInfo.mapobjects2.update({routename:key},{$set: {routeoppcolor: obby[key].oppcolor }},{multi:true},function(err){
      if(err){ 
        console.log (err);
      }
      else {
        console.log('success!');
      }
    }); 
  }
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
  // TODO: save colors
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

exports.listAllRoutes = function(cb, originalres){
  console.log('listAllRoutes');
  var routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  var busroutes = routesdb.collection('busroutes'); // TODO: use connect function
  busroutes.find({},{routename:1, _id:0}).toArray(function(err, res){
    console.log('sending cb routes');
    cb(res, originalres);
  });
};

var globalStopObj = {
  requestDirections: []
}; // TODO NO GLOBAL!!!

var getRouteStopsFromDB = function(db, stopArray, direction){
  console.log('stoparr: ',stopArray);
  console.log('direction: ',direction);
  db.busstops.find({direction: direction, routename: {$in: stopArray}},{_id:0}).toArray(function(err,res){
    if(err) console.log("This is an error: ",err);
    globalStopObj.save(res);
  });
};

// Doesn't send back directions. Is this important?
exports.findStopsOnRoutes = function(request, response){
  console.log('thereq',request);
  globalStopObj.dbInfo = connect('routesdb','busstops');
  globalStopObj.counter = 0;
  globalStopObj.res = response;
  globalStopObj.toSendBack = [];
  globalStopObj.lastDir = '';
  globalStopObj.trigger = function(){
    if(this.counter > 0){
      this.counter--;
      this.lastDir = Object.keys(this.requestDirections[this.counter])[0];
      console.log('reqdircount',this.requestDirections[this.counter]);
      getRouteStopsFromDB(this.dbInfo, this.requestDirections[this.counter][this.lastDir], this.lastDir);
    } else {
      console.log('tosendback',this.toSendBack);
      var sendback = this.toSendBack;
      this.counter = 0;
      this.toSendBack = [];
      this.lastDir = '';
      this.requestDirections = [];
      this.res.end(JSON.stringify(sendback));
    }
  };
  globalStopObj.save = function(results){
    this.toSendBack = this.toSendBack.concat(results);
    this.trigger();
  };
  var temp = {};
  for(var dir in request){
    temp[dir] = Object.keys(request[dir]);
    console.log('temp',temp);
    globalStopObj.requestDirections.push(temp);
    temp = {};
  }
  globalStopObj.counter = globalStopObj.requestDirections.length;
  globalStopObj.trigger.bind(globalStopObj);
  globalStopObj.save.bind(globalStopObj);
  globalStopObj.trigger(); 

};

// dual function to save user coord early when possible
exports.findRoutesNear = findRoutesNear = function(coordinates, cb, num){ //DEL
  var dbInfo = connect('routesdb','busstops');

  // callback array of string stopnames within .5 miles. maxdistradians is ~.5 / 69
  // MODIFIED TO INCLUDE BOTH DIRECTIONS
  console.log('findroutesnear',coordinates);
  dbInfo.busstops.find( {lonlat: {$near: coordinates, $maxDistance: 0.00723431558 }},{_id:0}).toArray(function(err,res){ //DEL
    if(err){
      console.log('Findroutesnear ERROR: ',err);
    }
    var routesObj = {}; // could give this a length property = res.length, then use to determine which obj to iterate over in eligibleRoutes
    for(var i = 0; i<res.length; i++){
      if(!routesObj[res[i].routename+':'+res[i].direction]){
        routesObj[res[i].routename+':'+res[i].direction] = res[i];
      }
    }
    // console.log('FIND RESULTS: ',Object.keys(routesObj));
    cb(routesObj);
  });
};

var globalObj;

// Verify that user comes before dest
var validateRoutes = function(routedata, dbInfo){
  console.log('Sending to MongoDB');
  var userlonlat,
      destlonlat;
      routename = routedata.routename.slice(0,routedata.routename.indexOf(':'));
      direction = routedata.routename.slice(routedata.routename.indexOf(':')+1);

  dbInfo.busstops.find({direction: direction, routename: routename},{_id:0}).toArray(function(err,res){
    if(err){
      console.log('ValidateRoutes ERROR: ',err);
    }
    console.log('Response from MongoDB');
    globalObj.validate(res);
  });
};

globalObj = {
  counter: -1, 
  allRoutes: [],
  currentuserlon: null,
  currentuserlat: null,
  currentdestlon: null,
  currentdestlat: null,
  trigger: function(){
    console.log('Countdown: ', this.counter);
    // console.log(this.allRoutes[this.counter]);
    if(this.counter >= 0){
      this.currentuserlon = this.allRoutes[this.counter].user.lonlat[0];
      this.currentuserlat = this.allRoutes[this.counter].user.lonlat[1];
      this.currentdestlon = this.allRoutes[this.counter].dest.lonlat[0];
      this.currentdestlat = this.allRoutes[this.counter].dest.lonlat[1];
      validateRoutes(this.allRoutes[this.counter], this.dbInfo);
    } else {
      var temp = {};
      var dir;
      var route;
      for(var i = 0; i<this.allRoutes.length; i++){
        // console.log(this.allRoutes[i]);
        // TODO delete dir, unused
        console.log(this.allRoutes[i].routename);
        dir = this.allRoutes[i].routename.slice(this.allRoutes[i].routename.indexOf(':')+1);
        route = this.allRoutes[i].routename.slice(0,this.allRoutes[i].routename.indexOf(':'));
        temp[route] = {direction: dir, user:this.allRoutes[i].user,dest:this.allRoutes[i].dest};
      }
      this.allRoutes = [];
      this.counter = -1;
      this.currentuserlon= null;
      this.currentuserlat= null;
      this.currentdestlon= null;
      this.currentdestlat= null;

      console.log('Returning to client: ',Object.keys(temp));
      this.response.end(JSON.stringify(temp));
    }
  },
  validate: function(lookupData){
    var del = false;
    // console.log('valid route ',this.allRoutes[this.counter]);
    // console.log('some lookupdata',lookupData);
    for(var i = 0; i<lookupData.length; i++){
      // console.log(lookupData[i].lonlat[0], this.currentdestlon);
      // console.log(lookupData[i].lonlat[1], this.currentdestlat);
      if(lookupData[i].lonlat[0] === this.currentdestlon && lookupData[i].lonlat[1] === this.currentdestlat){
        console.log('Deleting Route! ',this.allRoutes[this.counter].routename);
        del = true;
        break;
      }  
      if(lookupData[i].lonlat[0] === this.currentuserlon && lookupData[i].lonlat[1] === this.currentuserlat){
        console.log('Saving Route! ',this.allRoutes[this.counter].routename);
        break;
      }
    }
    if(del){
      this.allRoutes.splice(this.counter,1);
    }
    this.counter--;
    this.trigger();

  }
}; // TODO: NO GLOBAL!!!
globalObj.dbInfo = connect('routesdb','busstops');
globalObj.validate = globalObj.validate.bind(globalObj);
globalObj.trigger = globalObj.trigger.bind(globalObj);

// Return routes that pass by the user start and destination end points.
exports.eligibleRoutes = function(userCoord, destCoord, res){ // DEL
  console.log('eligibleroutes');
  var routeComparator = {
    userCoord: userCoord,
    destCoord: destCoord,
    direction: '', // DEL
    routesNearUser: {},
    sharedRoutes: {},
    res: res
  };
  routeComparator.setUser = function(routesNearUser){
    this.routesNearUser = routesNearUser;
    // DEL
    findRoutesNear(this.destCoord, this.compareRoutes);
  };
  routeComparator.compareRoutes = function(routesNearDest){

    // We now have, for dest and userloc, a single location for each route-dir pair
    // Determine & save which routes pass near both user and destloc
    for(var key in routesNearDest){
      if(this.routesNearUser[key]){
        globalObj.allRoutes.push({user:this.routesNearUser[key],dest:routesNearDest[key],routename: key});
        globalObj.counter++;
      }
    }
    console.log('Total Number of Comparisons: ',globalObj.counter);
    // console.log('totalobj: ',globalObj.allRoutes);
    globalObj.response = this.res;
    globalObj.trigger();
  };
  routeComparator.setUser = routeComparator.setUser.bind(routeComparator);
  routeComparator.compareRoutes = routeComparator.compareRoutes.bind(routeComparator);
  // DEL
  findRoutesNear(userCoord, routeComparator.setUser);
};

exports.saveBrain = function(data, response){
  var routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  var mapobjects = routesdb.collection('mapobjects'); // TODO: use connect function
  mapobjects.insert({routename:data.routename, path:data.routeSegments, direction:data.direction}, function(err,res){
    if(err) {
      console.log("This is an error: ",err);
    } else {
      console.log('SAVED TO mapobjects');
      response.end('woot');
    }
  });
};

exports.pullRoutes = function(routesWanted, resp){
  var direction = Object.keys(routesWanted)[0];
  var dbInfo = connect('routesdb','mapobjects2');
  dbInfo.mapobjects2.find({routename: {$in: routesWanted[direction]}, direction: direction},{_id:0}).toArray(function(err, res){
    if(err){
      console.log("This is an error: ",err);
    }
    resp.end(JSON.stringify(res));
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
      if(err) console.log("This is an error: ",err);
      globalMind.counter--;
      console.log(globalMind.counter);
      if(globalMind.counter === 0){
        globalMind.trigger();
      }
    });
  }
};
