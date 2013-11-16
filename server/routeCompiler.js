var common = require('./common.js'),
    mongoClient = new common.MongoClient(new common.Server('localhost', 27017));

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

exports.findStopsOnRoutes = function(request, response){
  var db = connect('routesdb','busstops2');

  db.busstops2.find({routeAndDirTag: {$in: Object.keys(request)}},{_id:0}).toArray(function(err,res){
    if(err) console.error("Error: ", err);
    response.end(JSON.stringify(res));
  });
};

/******************************************
Functions below will likely be deleted.
*******************************************/

// Generate all route names
exports.listAllRoutes = function(cb, originalres){
  console.log('listAllRoutes');
  var routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  var busroutes2 = routesdb.collection('busroutes2'); // TODO: use connect function
  busroutes2.find({},{routename:1, _id:0}).toArray(function(err, res){
    console.log('sending cb routes');
    cb(res, originalres);
  });
};

// Save Map Objects
exports.saveBrain = function(data, response){
  var routesdb = mongoClient.db('routesdb'); // TODO: use connect function
  var mapobjects = routesdb.collection('mapobjects'); // TODO: use connect function
  mapobjects.insert({routename:data.routename, path:data.routeSegments, direction:data.direction}, function(err,res){
    if(err) {
      console.error("Error: ", err);
    } else {
      console.log('SAVED TO mapobjects');
      response.end('woot');
    }
  });
};

// Pull Map Objects
exports.pullRoutes = function(routesWanted, resp){
  var direction = Object.keys(routesWanted)[0];
  var db = connect('routesdb','mapobjects2');
  db.mapobjects2.find({routename: {$in: routesWanted[direction]}, direction: direction},{_id:0}).toArray(function(err, res){
    if(err){
      console.error("Error: ",err);
    }
    resp.end(JSON.stringify(res));
  });
};

var spool = function(){
  var routeColors = {"1":{"color":"cc6600","oppcolor":"000000"},"2":{"color":"000000","oppcolor":"ffffff"},"3":{"color":"339999","oppcolor":"000000"},"5":{"color":"666699","oppcolor":"ffffff"},"6":{"color":"996699","oppcolor":"000000"},"9":{"color":"889944","oppcolor":"000000"},"10":{"color":"b07d00","oppcolor":"000000"},"12":{"color":"b07d00","oppcolor":"000000"},"14":{"color":"339999","oppcolor":"000000"},"17":{"color":"003399","oppcolor":"ffffff"},"18":{"color":"996699","oppcolor":"000000"},"19":{"color":"000000","oppcolor":"ffffff"},"21":{"color":"660000","oppcolor":"ffffff"},"22":{"color":"ff6633","oppcolor":"000000"},"23":{"color":"b07d00","oppcolor":"000000"},"24":{"color":"996699","oppcolor":"000000"},"27":{"color":"660099","oppcolor":"ffffff"},"28":{"color":"000000","oppcolor":"ffffff"},"29":{"color":"ff6633","oppcolor":"000000"},"30":{"color":"990099","oppcolor":"ffffff"},"31":{"color":"339999","oppcolor":"000000"},"33":{"color":"660000","oppcolor":"ffffff"},"35":{"color":"ff6633","oppcolor":"000000"},"36":{"color":"003399","oppcolor":"ffffff"},"37":{"color":"000000","oppcolor":"ffffff"},"38":{"color":"ff6633","oppcolor":"000000"},"39":{"color":"ff6633","oppcolor":"000000"},"41":{"color":"b07d00","oppcolor":"000000"},"43":{"color":"006633","oppcolor":"ffffff"},"44":{"color":"ff6633","oppcolor":"000000"},"45":{"color":"006633","oppcolor":"ffffff"},"47":{"color":"667744","oppcolor":"ffffff"},"48":{"color":"cc6600","oppcolor":"000000"},"49":{"color":"b07d00","oppcolor":"000000"},"52":{"color":"889944","oppcolor":"000000"},"54":{"color":"cc0033","oppcolor":"ffffff"},"56":{"color":"990099","oppcolor":"ffffff"},"59":{"color":"cc3399","oppcolor":"ffffff"},"60":{"color":"4444a4","oppcolor":"ffffff"},"61":{"color":"9ac520","oppcolor":"000000"},"66":{"color":"666699","oppcolor":"ffffff"},"67":{"color":"555555","oppcolor":"ffffff"},"71":{"color":"667744","oppcolor":"ffffff"},"88":{"color":"555555","oppcolor":"ffffff"},"90":{"color":"660000","oppcolor":"ffffff"},"91":{"color":"667744","oppcolor":"ffffff"},"108":{"color":"555555","oppcolor":"ffffff"},"F":{"color":"555555","oppcolor":"ffffff"},"J":{"color":"cc6600","oppcolor":"000000"},"KT":{"color":"cc0033","oppcolor":"ffffff"},"L":{"color":"660099","oppcolor":"ffffff"},"M":{"color":"006633","oppcolor":"ffffff"},"N":{"color":"003399","oppcolor":"ffffff"},"NX":{"color":"006633","oppcolor":"ffffff"},"1AX":{"color":"990000","oppcolor":"ffffff"},"1BX":{"color":"cc3333","oppcolor":"ffffff"},"5L":{"color":"666699","oppcolor":"ffffff"},"8X":{"color":"996699","oppcolor":"000000"},"8AX":{"color":"996699","oppcolor":"000000"},"8BX":{"color":"996699","oppcolor":"000000"},"9L":{"color":"889944","oppcolor":"000000"},"14L":{"color":"009900","oppcolor":"ffffff"},"14X":{"color":"cc0033","oppcolor":"ffffff"},"16X":{"color":"cc0033","oppcolor":"ffffff"},"28L":{"color":"009900","oppcolor":"ffffff"},"30X":{"color":"cc0033","oppcolor":"ffffff"},"31AX":{"color":"990000","oppcolor":"ffffff"},"31BX":{"color":"cc3333","oppcolor":"ffffff"},"38AX":{"color":"990000","oppcolor":"ffffff"},"38BX":{"color":"cc3333","oppcolor":"ffffff"},"38L":{"color":"009900","oppcolor":"ffffff"},"71L":{"color":"009900","oppcolor":"ffffff"},"76X":{"color":"009900","oppcolor":"ffffff"},"81X":{"color":"cc0033","oppcolor":"ffffff"},"82X":{"color":"cc0033","oppcolor":"ffffff"},"83X":{"color":"cc0033","oppcolor":"ffffff"},"K OWL":{"color":"198080","oppcolor":"ffffff"},"L OWL":{"color":"330066","oppcolor":"ffffff"},"M OWL":{"color":"004d19","oppcolor":"ffffff"},"N OWL":{"color":"001980","oppcolor":"ffffff"},"T OWL":{"color":"001980","oppcolor":"ffffff"}}; 
  var db = connect('routesdb','mapobjects2');
  for(var key in obby){
    console.log(key, obby[key].color);
    db.mapobjects2.update({routename:key},{$set: {routeoppcolor: obby[key].oppcolor }},{multi:true},function(err){
      if(err){ 
        console.error(err);
      }
      else {
        console.log('success!');
      }
    }); 
  }
};


