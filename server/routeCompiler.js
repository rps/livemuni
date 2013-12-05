var common = require('./common.js');

var mongoClient = common.MongoClient.connect('mongodb://livemuni:nyuco2k-@ds041177.mongolab.com:41177/routesdb', function(err, db) {
  if (err) console.error("Error: ", err);
  rComp.db = db;
});

exports.findStopsOnRoutes = function(request, response){

  rComp.db.collection('busstops2').find({routeAndDirTag: {$in: Object.keys(request)}},{_id:0}).toArray(function(err,res){
    if(err) console.error("Error: ", err);
    response.json(res);
  });
};

var rComp = {};
