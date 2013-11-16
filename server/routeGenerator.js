var common = require('./common.js'),
    mongoClient = new common.MongoClient(new common.Server('localhost', 27017));

mongoClient.open(function(err, mongoClient) {
  if (err) console.error("Error: ", err);
  // rg.getRoutesFromMuni();
});

var rg = {
  util: {},
  counter: 0,
  routeObj: {},
  currentDirection: '',
  getRoutesFromMuni: function(){
    var self = this;
    common.req('http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni&terse', function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var doc = new common.xmldoc.XmlDocument(response.body);
        doc.eachChild(self.parseRoutes.bind(self)); // Passes child, index, array as args
      }
    });
  },
  parseRoutes: function(child){
  // Handles a single <route> containing <stop>s and <direction>s lists of stops
    if(child.name === 'route'){
      this.counter++;
      this.routeObj = this.util.makeRouteObj(child.attr.tag, child.attr.title, child.attr.color, child.attr.oppositeColor);
      child.eachChild(this.parseRouteStops.bind(this));
      var mongoRouteObj = this.util.mongoReformat(this.routeObj);
      this.insertIntoDB(mongoRouteObj);
    }
  },
  parseRouteStops: function(grandChild){
    if(grandChild.name === 'stop' && grandChild.attr.lon && grandChild.attr.lat){ // some lon/lat are undefined from nextmuni
      this.routeObj.stops.push({
        stopTag: grandChild.attr.tag,
        stopName: grandChild.attr.title,
        lonlat: [Number(grandChild.attr.lon), Number(grandChild.attr.lat)] // lonlat order required for mongo 2d index
      });
    } else if(grandChild.name === 'direction'){
      this.routeObj[grandChild.attr.tag] = []; // Sets the dirTag as a key on this.routeObj
      this.routeObj.directionPairs[grandChild.attr.tag] = grandChild.attr.title; // Save direction tag and readable title
      this.currentDirection = grandChild.attr.tag;
      grandChild.eachChild(this.collectStopTags.bind(this));
    }
  },
  collectStopTags: function(stop){
    this.routeObj[this.currentDirection].push(stop.attr.tag);
  },
  insertIntoDB: function(routeObj){
    var self = this;
    this.db.busroutes3.insert(routeObj, function(err, result){
      self.counter--;
      if(self.counter === 0){
        self.db.routesdb.close(); // TODO: call createStopsCollection instead
      }
    });
  }
};

rg.util.connect = function(dbName){
  var db = {};
  db[dbName] = mongoClient.db(dbName);
  for(var i = 1; i<arguments.length; i++){
    db[arguments[i]] = db[dbName].collection(arguments[i]);
  }
  return db;
};

rg.util.makeRouteObj = function(tag, title, color, oppositeColor){
  return {
    stops: [],
    routename: tag,
    longname: title,
    color: color,
    oppositeColor: oppositeColor,
    directionPairs: {}
  };
};

// Optimize structure for Mongo querying
rg.util.mongoReformat = function(routeObj){
  var mongoRouteObj = {
    routename: routeObj.routename,
    longname: routeObj.longname,
    color: routeObj.color,
    oppositeColor: routeObj.oppositeColor,
    directionPairs: routeObj.directionPairs
  };
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

rg.db = rg.util.connect('routesdb', 'busroutes3');

module.exports = rg;
