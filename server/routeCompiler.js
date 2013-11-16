var common = require('./common.js'),
    mongoClient = new common.MongoClient(new common.Server('localhost', 27017));

mongoClient.open(function(err, mongoClient) {
  if (err) console.error("Error: ",err);
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
