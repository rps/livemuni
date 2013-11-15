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
  createStopsCollection();
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
  var dbInfo = connect('routesdb','busroutes2');

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
    routename: tag,
    longname: title,
    color: color,
    oppositeColor: oppositeColor,
    directionPairs: {}
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
    routeObj[grandChild.attr.tag] = [];
    routeObj.directionPairs[grandChild.attr.tag] = grandChild.attr.title; // Save direction tag and readable title
    var collectStopTagsNow = collectStopTags.bind(undefined, routeObj, grandChild.attr.tag); 
    grandChild.eachChild(collectStopTagsNow);
  }
};

var collectStopTags = function(routeObj, direction, stop, index){
  routeObj[direction].push(stop.attr.tag);
};

// quickfix to create more readily queryable mongo collection
var mongoReformat = function(routeObj){
  var mongoRouteObj = {};
  mongoRouteObj.routename = routeObj.routename;
  mongoRouteObj.longname = routeObj.longname;
  mongoRouteObj.color = routeObj.color;
  mongoRouteObj.oppositeColor = routeObj.oppositeColor;
  mongoRouteObj.directionPairs = routeObj.directionPairs;
  for(var dirTag in routeObj.directionPairs){
    mongoRouteObj[dirTag] = [];
    for(var i = 0; i<routeObj[dirTag].length; i++){
      for(var j = 0; j<routeObj.stops.length; j++){
        if(routeObj.stops[j].stopTag === routeObj[dirTag][i]){
          mongoRouteObj[dirTag].push(routeObj.stops[j]);
        }
      }
    }
  }
  return mongoRouteObj;
};

var insertIntoDB = function(routeObj, dbInfo){
  dbInfo.busroutes2.insert(routeObj, function(err, result){
    dbInfo.counter--;
    console.log(dbInfo.counter);
    if(dbInfo.counter === 0){
      console.log('closing mongodb connection');
      dbInfo.routesdb.close(); // TODO: call createStopsCollection instead
    }
  });
};

exports.listAllRoutes = function(cb, originalres){
  console.log('listAllRoutes');
  var routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  var busroutes2 = routesdb.collection('busroutes2'); // TODO: use connect function
  busroutes2.find({},{routename:1, _id:0}).toArray(function(err, res){
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
  db.busstops2.find({direction: direction, routename: {$in: stopArray}},{_id:0}).toArray(function(err,res){
    if(err) console.log("This is an error: ",err);
    globalStopObj.save(res);
  });
};

// Doesn't send back directions. Is this important?
exports.findStopsOnRoutes = function(request, response){
  console.log('thereq',request);
  globalStopObj.dbInfo = connect('routesdb','busstops2');
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
      // console.log('tosendback',this.toSendBack);
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
exports.findRoutesNear = findRoutesNear = function(coordinates, cb, routenames){
  var dbInfo = connect('routesdb','busstops2');

  // callback array of string stopnames within .5 miles. maxdistradians is ~.5 / 69
  // MODIFIED TO INCLUDE BOTH DIRECTIONS
  console.log('findroutesnear',coordinates);
  //TODO: IMPORTANT - convert to GeoJSON and use 2dsphere so that more than 100results can be returned
  if(routenames){
    dbInfo.busstops2.find( {lonlat: {$near: coordinates, $maxDistance: 0.00723431558 }, routename: {$in: routenames}},{_id:0}).toArray(function(err,res){ //DEL
      if(err){
        console.log('Findroutesnear ERROR: ',err);
      }
      console.log('NUM OF RES: ',res.length);
      var routesObj = {}; // could give this a length property = res.length, then use to determine which obj to iterate over in eligibleRoutes
      for(var i = 0; i<res.length; i++){
        if(!routesObj[res[i].routename+':'+res[i].direction]){
          routesObj[res[i].routename+':'+res[i].direction] = res[i];
        }
      }
      console.log('MATCH RESULTS: ',Object.keys(routesObj));
      cb(routesObj);
    });
  } else {
    dbInfo.busstops2.find( {lonlat: {$near: coordinates, $maxDistance: 0.00579710144 }},{_id:0}).toArray(function(err,res){ //DEL
      if(err){
        console.log('Findroutesnear ERROR: ',err);
      }
      console.log('NUM OF RES: ',res.length);
      var routesObj = {}; // could give this a length property = res.length, then use to determine which obj to iterate over in eligibleRoutes
      for(var i = 0; i<res.length; i++){
        if(!routesObj[res[i].routename+':'+res[i].direction]){
          routesObj[res[i].routename+':'+res[i].direction] = res[i];
        }
      }
      console.log('FIND RESULTS: ',Object.keys(routesObj));
      cb(routesObj);
    });
  }
};

var globalObj;

// Verify that user comes before dest
var validateRoutes = function(routedata, dbInfo){
  console.log('Sending to MongoDB');
  var userlonlat,
      destlonlat;
      routename = routedata.routename.slice(0,routedata.routename.indexOf(':'));
      direction = routedata.routename.slice(routedata.routename.indexOf(':')+1);

  dbInfo.busstops2.find({direction: direction, routename: routename},{_id:0}).toArray(function(err,res){
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
      if(lookupData[i].routename === '5'){
        console.log(Math.abs(lookupData[i].lonlat[0] - this.currentdestlon)+Math.abs(lookupData[i].lonlat[0] - this.currentdestlon));
        console.log(Math.abs(lookupData[i].lonlat[0] - this.currentdestlon)+Math.abs(lookupData[i].lonlat[0] - this.currentdestlon) < 0.0009);
        // console.log(lookupData[i].lonlat[0], this.currentdestlon);
      
      }
      if((lookupData[i].lonlat[0] === this.currentdestlon && lookupData[i].lonlat[1] === this.currentdestlat) ||
        (Math.abs(lookupData[i].lonlat[0] - this.currentdestlon)+Math.abs(lookupData[i].lonlat[0] - this.currentdestlon)) < 0.0009){ 
        // TODO FIX - bandaid until all route directionPairs are saved
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
globalObj.dbInfo = connect('routesdb','busstops2');
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
    var keylist = Object.keys(routesNearUser);
    var routenames = [];
    for(var i = 0; i<keylist.length; i++){
      routenames.push(keylist[i].slice(0,keylist[i].indexOf(':')));
    }
    findRoutesNear(this.destCoord, this.compareRoutes, routenames);
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

var createStopsCollection = function(){
  var globalMind = {
    routeTicker: 0,
    allRoutes: [],
    counter: 0,
    trigger: function(){
      if(this.routeTicker < this.allRoutes.length){
        routeFlattener(this.allRoutes[this.routeTicker],this);
        this.routeTicker++;
      } else {
        var self = this;
        var coll = this.routesdb;
        this.busstops2.ensureIndex({'lonlat':'2dsphere'}, function(err, res){
          if(err) throw err;
          self.routesdb.close();
        });
      }
    }
  };

  globalMind.routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  globalMind.busroutes2 = globalMind.routesdb.collection('busroutes2'); // TODO: use connect function
  globalMind.busstops2 = globalMind.routesdb.collection('busstops2');// TODO: use connect function
  globalMind.busroutes2.find({}).toArray(function(err,res){
    if(!err){
      globalMind.allRoutes = res;
      globalMind.trigger();
    }
  });
};


// TODO - determine inbound/outbound based on dirtag
var routeFlattener = function(aRoute, globalMind){
  var decompiledRoute = [];
  var tempStop = {};
  for(var dirTag in aRoute.directionPairs){
    for(var i = 0; i<aRoute[dirTag].length; i++){
      tempStop = aRoute[dirTag][i];
      tempStop.routename = aRoute.routename;
      tempStop.color = aRoute.color;
      tempStop.oppositeColor = aRoute.oppositeColor;
      tempStop.dirTag = dirTag;
      tempStop.fullDirection = aRoute.directionPairs[dirTag];
      tempStop.direction = aRoute.directionPairs[dirTag].slice(0,2) === 'In' ? 'Inbound' : 'Outbound';
      decompiledRoute.push(tempStop);
      globalMind.counter++;
      tempStop = {};
    }
  }
  for(var j = 0; j<decompiledRoute.length; j++){
    globalMind.busstops2.insert(decompiledRoute[j], function(err, res){
      if(err) console.log("This is an error: ",err);
      globalMind.counter--;
      console.log(globalMind.counter);
      if(globalMind.counter === 0){
        globalMind.trigger();
      }
    });
  }
};

