var fs = require('fs');
var req = require('request');
var xmldoc = require('xmldoc');
var routeGenerator = require('routeGenerator.js');
var MongoClient = require('mongodb').MongoClient,
    format = require('util').format,
    Server = require('mongodb').Server;

var mongoClient = new MongoClient(new Server('localhost', 27017));
mongoClient.open(function(err, mongoClient) {
  if (err) console.error("Error: ",err);
  // getRoutesFromMuni(); // DEL for review
  // createStopsCollection(); // DEL for review
  // spool(); // DEL for review
});

var connect = function(dbName){
  var db = {};
  db[dbName] = mongoClient.db(dbName);
  for(var i = 1; i<arguments.length; i++){
    db[arguments[i]] = db[dbName].collection(arguments[i]);
  }
  return db;
};

var someFunction = function(){
  var db = connect('routesdb','busroutes2');
  routeGenerator.getRoutesFromMuni(db);
}

// DEL
var spool = function(){
  var obby = {"1":{"color":"cc6600","oppcolor":"000000"},"2":{"color":"000000","oppcolor":"ffffff"},"3":{"color":"339999","oppcolor":"000000"},"5":{"color":"666699","oppcolor":"ffffff"},"6":{"color":"996699","oppcolor":"000000"},"9":{"color":"889944","oppcolor":"000000"},"10":{"color":"b07d00","oppcolor":"000000"},"12":{"color":"b07d00","oppcolor":"000000"},"14":{"color":"339999","oppcolor":"000000"},"17":{"color":"003399","oppcolor":"ffffff"},"18":{"color":"996699","oppcolor":"000000"},"19":{"color":"000000","oppcolor":"ffffff"},"21":{"color":"660000","oppcolor":"ffffff"},"22":{"color":"ff6633","oppcolor":"000000"},"23":{"color":"b07d00","oppcolor":"000000"},"24":{"color":"996699","oppcolor":"000000"},"27":{"color":"660099","oppcolor":"ffffff"},"28":{"color":"000000","oppcolor":"ffffff"},"29":{"color":"ff6633","oppcolor":"000000"},"30":{"color":"990099","oppcolor":"ffffff"},"31":{"color":"339999","oppcolor":"000000"},"33":{"color":"660000","oppcolor":"ffffff"},"35":{"color":"ff6633","oppcolor":"000000"},"36":{"color":"003399","oppcolor":"ffffff"},"37":{"color":"000000","oppcolor":"ffffff"},"38":{"color":"ff6633","oppcolor":"000000"},"39":{"color":"ff6633","oppcolor":"000000"},"41":{"color":"b07d00","oppcolor":"000000"},"43":{"color":"006633","oppcolor":"ffffff"},"44":{"color":"ff6633","oppcolor":"000000"},"45":{"color":"006633","oppcolor":"ffffff"},"47":{"color":"667744","oppcolor":"ffffff"},"48":{"color":"cc6600","oppcolor":"000000"},"49":{"color":"b07d00","oppcolor":"000000"},"52":{"color":"889944","oppcolor":"000000"},"54":{"color":"cc0033","oppcolor":"ffffff"},"56":{"color":"990099","oppcolor":"ffffff"},"59":{"color":"cc3399","oppcolor":"ffffff"},"60":{"color":"4444a4","oppcolor":"ffffff"},"61":{"color":"9ac520","oppcolor":"000000"},"66":{"color":"666699","oppcolor":"ffffff"},"67":{"color":"555555","oppcolor":"ffffff"},"71":{"color":"667744","oppcolor":"ffffff"},"88":{"color":"555555","oppcolor":"ffffff"},"90":{"color":"660000","oppcolor":"ffffff"},"91":{"color":"667744","oppcolor":"ffffff"},"108":{"color":"555555","oppcolor":"ffffff"},"F":{"color":"555555","oppcolor":"ffffff"},"J":{"color":"cc6600","oppcolor":"000000"},"KT":{"color":"cc0033","oppcolor":"ffffff"},"L":{"color":"660099","oppcolor":"ffffff"},"M":{"color":"006633","oppcolor":"ffffff"},"N":{"color":"003399","oppcolor":"ffffff"},"NX":{"color":"006633","oppcolor":"ffffff"},"1AX":{"color":"990000","oppcolor":"ffffff"},"1BX":{"color":"cc3333","oppcolor":"ffffff"},"5L":{"color":"666699","oppcolor":"ffffff"},"8X":{"color":"996699","oppcolor":"000000"},"8AX":{"color":"996699","oppcolor":"000000"},"8BX":{"color":"996699","oppcolor":"000000"},"9L":{"color":"889944","oppcolor":"000000"},"14L":{"color":"009900","oppcolor":"ffffff"},"14X":{"color":"cc0033","oppcolor":"ffffff"},"16X":{"color":"cc0033","oppcolor":"ffffff"},"28L":{"color":"009900","oppcolor":"ffffff"},"30X":{"color":"cc0033","oppcolor":"ffffff"},"31AX":{"color":"990000","oppcolor":"ffffff"},"31BX":{"color":"cc3333","oppcolor":"ffffff"},"38AX":{"color":"990000","oppcolor":"ffffff"},"38BX":{"color":"cc3333","oppcolor":"ffffff"},"38L":{"color":"009900","oppcolor":"ffffff"},"71L":{"color":"009900","oppcolor":"ffffff"},"76X":{"color":"009900","oppcolor":"ffffff"},"81X":{"color":"cc0033","oppcolor":"ffffff"},"82X":{"color":"cc0033","oppcolor":"ffffff"},"83X":{"color":"cc0033","oppcolor":"ffffff"},"K OWL":{"color":"198080","oppcolor":"ffffff"},"L OWL":{"color":"330066","oppcolor":"ffffff"},"M OWL":{"color":"004d19","oppcolor":"ffffff"},"N OWL":{"color":"001980","oppcolor":"ffffff"},"T OWL":{"color":"001980","oppcolor":"ffffff"}}; 
  var db = connect('routesdb','mapobjects2');
  for(var key in obby){
    console.log(key, obby[key].color);
    db.mapobjects2.update({routename:key},{$set: {routeoppcolor: obby[key].oppcolor }},{multi:true},function(err){
      if(err){ 
        console.log (err);
      }
      else {
        console.log('success!');
      }
    }); 
  }
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

exports.findStopsOnRoutes = function(request, response){
  
  var db = connect('routesdb','busstops2');

  db.busstops2.find({routeAndDirTag: {$in: Object.keys(request)}},{_id:0}).toArray(function(err,res){
    if(err) console.log("Error: ",err);
    response.end(JSON.stringify(res));
  });
};

// dual function to save user coord early when possible
exports.findRoutesNear = findRoutesNear = function(coordinates, cb, routeArray){
  var db = connect('routesdb','busstops2');
  var query = {};
  var num = 300;
  console.log('findroutesnear',coordinates);
  if(routeArray){
    query.routename = {$in: routeArray};
  }
  db.routesdb.command({ 
    geoNear: 'busstops2',
    near: {
      type: 'Point',
      coordinates: coordinates 
    }, 
    spherical: true,
    num: num,
    maxDistance: 800, // meters
    query: query
  },
  function(err, res){
    console.log('Total nearby routes: ', res.results.length);
    var routesObj = {};
    var resultsArr = res.results;
      for(var i = 0; i<resultsArr.length; i++){
        console.log(resultsArr[i].obj.routeAndDirTag);
        // Since geo results are sorted by proximity, only save the closest route+dirTag object
        if(!routesObj[resultsArr[i].obj.routename+':'+resultsArr[i].obj.dirTag]){
          routesObj[resultsArr[i].obj.routename+':'+resultsArr[i].obj.dirTag] = resultsArr[i].obj;
        }
      }
    console.log('MATCH RESULTS: ',Object.keys(routesObj));
    cb(routesObj);
  });
};

var globalObj;

// Verify that user comes before dest
var validateRoutes = function(routedata, db){
  console.log('Sending to MongoDB');
  var userlonlat,
      destlonlat,
      routename = routedata.routeAndDirTag.slice(0,routedata.routeAndDirTag.indexOf(':')),
      dirTag = routedata.routeAndDirTag.slice(routedata.routeAndDirTag.indexOf(':')+1);

  db.busstops2.find({dirTag: dirTag, routename: routename},{_id:0}).toArray(function(err,res){
    if(err){
      console.log('ValidateRoutes ERROR: ',err);
    }
    console.log('Response from MongoDB');
    globalObj.validate(res);
  });
};

globalObj = {
  counter: -1, 
  allRoutes: [], // { userobj, destobj, routeAndDirTag }
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
      validateRoutes(this.allRoutes[this.counter], this.db);
    } else {
      var temp = {};
      var dirTag;
      var route;
      for(var i = 0; i<this.allRoutes.length; i++){
        temp[this.allRoutes[i].routeAndDirTag] = {user:this.allRoutes[i].user,dest:this.allRoutes[i].dest};
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
      // if(lookupData[i].routename === '5'){
      //   console.log(Math.abs(lookupData[i].lonlat[0] - this.currentdestlon)+Math.abs(lookupData[i].lonlat[0] - this.currentdestlon));
      //   console.log(Math.abs(lookupData[i].lonlat[0] - this.currentdestlon)+Math.abs(lookupData[i].lonlat[0] - this.currentdestlon) < 0.0009);
      //   // console.log(lookupData[i].lonlat[0], this.currentdestlon);
      
      // }
      if((lookupData[i].lonlat[0] === this.currentdestlon && lookupData[i].lonlat[1] === this.currentdestlat) // ||
        //(Math.abs(lookupData[i].lonlat[0] - this.currentdestlon)+Math.abs(lookupData[i].lonlat[0] - this.currentdestlon)) < 0.0009
        ){ 
        console.log('Deleting Route! ',this.allRoutes[this.counter].routeAndDirTag);
        del = true;
        break;
      }  
      if(lookupData[i].lonlat[0] === this.currentuserlon && lookupData[i].lonlat[1] === this.currentuserlat){
        console.log('Saving Route! ',this.allRoutes[this.counter].routeAndDirTag);
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
globalObj.db = connect('routesdb','busstops2');
globalObj.validate = globalObj.validate.bind(globalObj);
globalObj.trigger = globalObj.trigger.bind(globalObj);

// Return routes that pass by the user start and destination end points.
exports.eligibleRoutes = function(userCoord, destCoord, res){ // DEL
  console.log('eligibleroutes');
  var routeComparator = {
    userCoord: userCoord,
    destCoord: destCoord,
    direction: '',
    routesNearUser: {},
    sharedRoutes: {},
    res: res
  };
  routeComparator.setUser = function(routesNearUser){
    this.routesNearUser = routesNearUser;
    var keylist = Object.keys(routesNearUser);
    var routenames = {};
    for(var i = 0; i<keylist.length; i++){
      routenames[keylist[i].slice(0,keylist[i].indexOf(':'))] = true;
    }
    findRoutesNear(this.destCoord, this.compareRoutes, Object.keys(routenames));
  };
  routeComparator.compareRoutes = function(routesNearDest){

    // We now have, for dest and userloc, a single location for each route-dir pair
    // Determine & save which routes pass near both user and destloc
    for(var routeAndDirTag in routesNearDest){
      // If the route+dirTag appears near the user and dest
      if(this.routesNearUser[routeAndDirTag]){
        globalObj.allRoutes.push({
          user:this.routesNearUser[routeAndDirTag],
          dest:routesNearDest[routeAndDirTag],
          routeAndDirTag:routeAndDirTag
          // routename: routeAndDirTag.slice(0,routeAndDirTag.indexOf(':')),
          // dirTag: routeAndDirTag.slice(routeAndDirTag.indexOf(':')+1)
        });
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
      console.log("Error: ",err);
    } else {
      console.log('SAVED TO mapobjects');
      response.end('woot');
    }
  });
};

exports.pullRoutes = function(routesWanted, resp){
  var direction = Object.keys(routesWanted)[0];
  var db = connect('routesdb','mapobjects2');
  db.mapobjects2.find({routename: {$in: routesWanted[direction]}, direction: direction},{_id:0}).toArray(function(err, res){
    if(err){
      console.log("Error: ",err);
    }
    resp.end(JSON.stringify(res));
  });
};


