// scraper

var mapOptions = {
  center: new google.maps.LatLng(37.783, -122.409), //getCenter for NONwrapped LatLon obj
  zoom: 15,
  mapTypeId: google.maps.MapTypeId.ROADMAP
};
var map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);

var globalMind = {
  counter: 0,
  allRouteNames: [],
  routeObj: {},
  trigger: function(){
    if(this.counter < this.allRouteNames.length){
      getPathObjects(this.routeObj[this.allRouteNames[this.counter]],this.allRouteNames[this.counter]);
      this.counter++;
    }
  }
};

function reqListener () {
  var routeDataRaw = JSON.parse(this.responseText);
  for(var i = 0; i<routeDataRaw.length; i++){
    globalMind.routeObj[routeDataRaw[i].routename] = globalMind.routeObj[routeDataRaw[i].routename] || {stops:[]};
    globalMind.routeObj[routeDataRaw[i].routename].stops.push(routeDataRaw[i].stops);
  }
  globalMind.allRouteNames = Object.keys(globalMind.routeObj);
  globalMind.trigger();
}

var oReq = new XMLHttpRequest();
oReq.onload = reqListener;
oReq.open("get", "triggerPathGen", true);
oReq.send();

function readyPost(data){
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "saveNewPath");
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == 200) {
        globalMind.trigger();
    }
  };
  xhr.send(data);
}

// staggers requests to getPath
function getPathObjects(data, routename){
  var coord;
  var waypoints = [];
  var brain = {};
  brain.directions = new google.maps.DirectionsService();
  brain.routeSegments = [];
  brain.counter = 0;
  brain.direction = 'Outbound'; // be sure to change in AppJS under direction =
  brain.routename = routename;
  brain.totalStops = data.stops.length;
  for(var i = 0; i<data.stops.length; i++){
    coord = new google.maps.LatLng(data.stops[i].lonlat.lat, data.stops[i].lonlat.lon);
    waypoints.push({location: coord, stopover: true});
    brain.totalStops--;
    if(waypoints.length === 8 || brain.totalStops === 0){
      brain.counter++;
      (function(waypt, index){
        setTimeout(function(){getPath(waypt, brain);}, 500*index);
      })(waypoints, i);
      waypoints = [waypoints[waypoints.length-1]];
    }
  }
}

// collects array of waypoint objects
function getPath(waypoints, brain){
  var request = {
    origin: waypoints[0].location, // will need to adjust based on inbound/outbound
    destination: waypoints[waypoints.length-1].location,
    waypoints: waypoints.slice(1,7), // max is 8 including endpoints. will need to fragment routes
    travelMode: google.maps.TravelMode.DRIVING
  };
  brain.directions.route(request, function(response, status){
    if (status == google.maps.DirectionsStatus.OK) {
      brain.routeSegments.push(response);
      brain.counter--;
      if(brain.counter === 0){
        readyPost(JSON.stringify(brain));
      }
    } else {
      setTimeout(function(){getPath(waypoints, brain);},60000);
    }
  });
}