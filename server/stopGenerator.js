var common = require('./common.js'),
    mongoClient = new common.MongoClient(new common.Server('localhost', 27017));

mongoClient.open(function(err, mongoClient) {
  if (err) console.error("Error: ", err);
  // sg.createStopsCollection();
});

var sg = {
  util: {},
  routeMgmt: {
    routeTicker: 0,
    allRoutes: [],
    counter: 0
  },
  syncMgmt: {
    tempCount: 0,
    decompiledArr: [],
    tempCountTicker: 0,
  }
};

// Create a flat, indexable, queryable collection of stops from all routes
sg.createStopsCollection = function(){
  var self = this;
  this.triggerNewRoute.bind(this);
  this.db.busroutes3.find({}).toArray(function(err,res){
    if(!err){
      self.routeMgmt.allRoutes = res;
      self.triggerNewRoute();
    }
  });
};

sg.triggerNewRoute = function(){
  if(this.routeMgmt.routeTicker < this.routeMgmt.allRoutes.length){
    this.routeFlattener();
    this.routeMgmt.routeTicker++;
  } else {
    var self = this;
    this.db.busstops3.ensureIndex({'lonlat':'2dsphere'}, function(err, res){
      if(err) throw err;
      self.db.routesdb.close();
    });
  }
};

// Combine every stop with its route information
sg.routeFlattener = function(){
  var aRoute = this.routeMgmt.allRoutes[this.routeMgmt.routeTicker];
  var decompiledRoute = [];
  var tempStop = {};
  for(var dirTag in aRoute.directionPairs){
    for(var i = 0; i<aRoute[dirTag].length; i++){
      tempStop = aRoute[dirTag][i];
      tempStop.routename = aRoute.routename;
      tempStop.color = aRoute.color;
      tempStop.oppositeColor = aRoute.oppositeColor;
      tempStop.dirTag = dirTag;
      tempStop.routeAndDirTag = aRoute.routename+':'+dirTag;
      tempStop.fullDirection = aRoute.directionPairs[dirTag];
      tempStop.direction = aRoute.directionPairs[dirTag].slice(0,2) === 'In' ? 'Inbound' : 'Outbound';
      decompiledRoute.push(tempStop);
      this.routeMgmt.counter++;
      tempStop = {};
    }
  }
  this.syncMgmt.tempCount = decompiledRoute.length;
  this.syncMgmt.decompiledArr = decompiledRoute;
  this.syncMgmt.tempCountTicker = 0;
  this.synchronousInsert();
};

// Ensures that stops remain ordered
sg.synchronousInsert = function(){
  var self = this;
  if(this.syncMgmt.tempCountTicker < this.syncMgmt.tempCount){
    this.db.busstops3.insert(this.syncMgmt.decompiledArr[this.syncMgmt.tempCountTicker], function(err, res){
      if(err) console.error("Error: ",err);
      self.routeMgmt.counter--;
      if(self.routeMgmt.counter === 0){ // triggers the 'else' in triggerNewRoute
        self.triggerNewRoute();
      } else {
        self.syncMgmt.tempCountTicker++;
        self.synchronousInsert();
      }
    });
  } else {
    this.syncMgmt.tempCount = 0;
    this.syncMgmt.decompiledArr = [];
    this.syncMgmt.tempCountTicker = 0;
    this.triggerNewRoute();
  }
};

sg.util.connect = function(dbName){
  var db = {};
  db[dbName] = mongoClient.db(dbName);
  for(var i = 1; i<arguments.length; i++){
    db[arguments[i]] = db[dbName].collection(arguments[i]);
  }
  return db;
};

sg.db = sg.util.connect('routesdb', 'busroutes3', 'busstops3');

module.exports = sg;
