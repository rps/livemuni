var common = require('./common.js');

var mongoClient = common.MongoClient.connect('mongodb://livemuni:nyuco2k-@ds041177.mongolab.com:41177/routesdb', function(err, db) {
  if (err) console.error("Error: ", err);
  rc.db = db;
});

var rc = {
  util: {},
  userLonlat: [],
  destLonlat: [],
  direction: '',
  routesNearUser: {},
  sharedRoutes: {},
  comparator: {
    counter: -1,
    allRoutes: [], // { userobj, destobj, routeAndDirTag }
    currentuserlon: null,
    currentuserlat: null,
    currentdestlon: null,
    currentdestlat: null,
  }
};

// Return routes that pass by the user start and destination end points.
rc.eligibleRoutes = function(userLonlat, destLonlat, res){
  this.comparator.response = res;
  this.userLonlat = userLonlat;
  this.destLonlat = destLonlat;
  this.setUser = this.setUser.bind(this);
  this.compareRoutes = this.compareRoutes.bind(this);
  this.comparator.checkUserBeforeDest = rc.comparator.checkUserBeforeDest.bind(rc.comparator);
  this.comparator.generateStopLists = rc.comparator.generateStopLists.bind(rc.comparator);

  this.findRoutesNear(userLonlat, this.setUser);
};

// Save user info and query destination routes against routes near user
rc.setUser = function(routesNearUser){
  this.routesNearUser = routesNearUser;
  var keylist = Object.keys(routesNearUser);
  var routenames = {}; // No duplicates
  for(var i = 0; i<keylist.length; i++){
    routenames[keylist[i].slice(0,keylist[i].indexOf(':'))] = true;
  }
  this.findRoutesNear(this.destLonlat, this.compareRoutes, Object.keys(routenames));
};

// Determine & save routes which pass near both user and destloc
rc.compareRoutes = function(routesNearDest){
  for(var routeAndDirTag in routesNearDest){
    // If the route+dirTag appears near the user and dest
    if(this.routesNearUser[routeAndDirTag]){
      this.comparator.allRoutes.push({
        user: this.routesNearUser[routeAndDirTag],
        dest: routesNearDest[routeAndDirTag],
        routeAndDirTag: routeAndDirTag
      });
      this.comparator.counter++;
    }
  }
  this.comparator.db = this.db; 
  this.comparator.generateStopLists();
};


rc.comparator.pullRouteStops = function(){
  var self = this;
  var userlonlat,
      destlonlat,
      routeData = this.allRoutes[this.counter],
      routename = routeData.routeAndDirTag.slice(0,routeData.routeAndDirTag.indexOf(':')),
      dirTag = routeData.routeAndDirTag.slice(routeData.routeAndDirTag.indexOf(':')+1);

  this.db.collection('busstops3').find({dirTag: dirTag, routename: routename},{_id:0}).toArray(function(err,res){
    if(err){
      console.error('pullRouteStops ERROR: ',err);
    }
    self.checkUserBeforeDest(res);
  });
};

rc.comparator.generateStopLists = function(){
  if(this.counter >= 0){
    this.currentuserlon = this.allRoutes[this.counter].user.lonlat[0];
    this.currentuserlat = this.allRoutes[this.counter].user.lonlat[1];
    this.currentdestlon = this.allRoutes[this.counter].dest.lonlat[0];
    this.currentdestlat = this.allRoutes[this.counter].dest.lonlat[1];
    this.pullRouteStops();
  } else {
    var temp = {};
    var dirTag;
    var route;
    for(var i = 0; i<this.allRoutes.length; i++){
      temp[this.allRoutes[i].routeAndDirTag] = {user:this.allRoutes[i].user,dest:this.allRoutes[i].dest};
    }
    this.allRoutes = [];
    this.counter = -1;
    this.currentuserlon = null;
    this.currentuserlat = null;
    this.currentdestlon = null;
    this.currentdestlat = null;

    this.response.json(temp);
  }
};

// Verify that user comes before dest
rc.comparator.checkUserBeforeDest = function(lookupData){
  var del = false;
  for(var i = 0; i<lookupData.length; i++){
    if((lookupData[i].lonlat[0] === this.currentdestlon && lookupData[i].lonlat[1] === this.currentdestlat)){ 
      del = true;
      break;
    }  
    if(lookupData[i].lonlat[0] === this.currentuserlon && lookupData[i].lonlat[1] === this.currentuserlat){
      break;
    }
  }
  if(del){
    this.allRoutes.splice(this.counter,1);
  }
  this.counter--;
  this.generateStopLists();
};

// List routes by proximity to a point
rc.findRoutesNear = function(coordinates, cb, routeArray){
  var query = {};
  var num = 300;
  if(routeArray){
    query.routename = {$in: routeArray};
  }
  this.db.command({ 
    geoNear: 'busstops3',
    near: {
      type: 'Point',
      coordinates: coordinates 
    }, 
    spherical: true,
    num: num,
    maxDistance: 800, // Meters
    query: query
  },
  function(err, res){
    if(err) console.error(err);
    var routesObj = {};
    var resultsArr = res.results;
    for(var i = 0; i<resultsArr.length; i++){
      // Since geo results are sorted by proximity, only save the closest route+dirTag object
      if(!routesObj[resultsArr[i].obj.routename+':'+resultsArr[i].obj.dirTag]){
        routesObj[resultsArr[i].obj.routename+':'+resultsArr[i].obj.dirTag] = resultsArr[i].obj;
      }
    }
    cb(routesObj);
  });
};

module.exports = rc;

