lm.Map = function(config) {
  var self = this;
  this.allRouteColors = {"1":{"color":"cc6600","oppcolor":"000000"},"2":{"color":"000000","oppcolor":"ffffff"},"3":{"color":"339999","oppcolor":"000000"},"5":{"color":"666699","oppcolor":"ffffff"},"6":{"color":"996699","oppcolor":"000000"},"9":{"color":"889944","oppcolor":"000000"},"10":{"color":"b07d00","oppcolor":"000000"},"12":{"color":"b07d00","oppcolor":"000000"},"14":{"color":"339999","oppcolor":"000000"},"17":{"color":"003399","oppcolor":"ffffff"},"18":{"color":"996699","oppcolor":"000000"},"19":{"color":"000000","oppcolor":"ffffff"},"21":{"color":"660000","oppcolor":"ffffff"},"22":{"color":"ff6633","oppcolor":"000000"},"23":{"color":"b07d00","oppcolor":"000000"},"24":{"color":"996699","oppcolor":"000000"},"27":{"color":"660099","oppcolor":"ffffff"},"28":{"color":"000000","oppcolor":"ffffff"},"29":{"color":"ff6633","oppcolor":"000000"},"30":{"color":"990099","oppcolor":"ffffff"},"31":{"color":"339999","oppcolor":"000000"},"33":{"color":"660000","oppcolor":"ffffff"},"35":{"color":"ff6633","oppcolor":"000000"},"36":{"color":"003399","oppcolor":"ffffff"},"37":{"color":"000000","oppcolor":"ffffff"},"38":{"color":"ff6633","oppcolor":"000000"},"39":{"color":"ff6633","oppcolor":"000000"},"41":{"color":"b07d00","oppcolor":"000000"},"43":{"color":"006633","oppcolor":"ffffff"},"44":{"color":"ff6633","oppcolor":"000000"},"45":{"color":"006633","oppcolor":"ffffff"},"47":{"color":"667744","oppcolor":"ffffff"},"48":{"color":"cc6600","oppcolor":"000000"},"49":{"color":"b07d00","oppcolor":"000000"},"52":{"color":"889944","oppcolor":"000000"},"54":{"color":"cc0033","oppcolor":"ffffff"},"56":{"color":"990099","oppcolor":"ffffff"},"59":{"color":"cc3399","oppcolor":"ffffff"},"60":{"color":"4444a4","oppcolor":"ffffff"},"61":{"color":"9ac520","oppcolor":"000000"},"66":{"color":"666699","oppcolor":"ffffff"},"67":{"color":"555555","oppcolor":"ffffff"},"71":{"color":"667744","oppcolor":"ffffff"},"88":{"color":"555555","oppcolor":"ffffff"},"90":{"color":"660000","oppcolor":"ffffff"},"91":{"color":"667744","oppcolor":"ffffff"},"108":{"color":"555555","oppcolor":"ffffff"},"F":{"color":"555555","oppcolor":"ffffff"},"J":{"color":"cc6600","oppcolor":"000000"},"KT":{"color":"cc0033","oppcolor":"ffffff"},"L":{"color":"660099","oppcolor":"ffffff"},"M":{"color":"006633","oppcolor":"ffffff"},"N":{"color":"003399","oppcolor":"ffffff"},"NX":{"color":"006633","oppcolor":"ffffff"},"1AX":{"color":"990000","oppcolor":"ffffff"},"1BX":{"color":"cc3333","oppcolor":"ffffff"},"5L":{"color":"666699","oppcolor":"ffffff"},"8X":{"color":"996699","oppcolor":"000000"},"8AX":{"color":"996699","oppcolor":"000000"},"8BX":{"color":"996699","oppcolor":"000000"},"9L":{"color":"889944","oppcolor":"000000"},"14L":{"color":"009900","oppcolor":"ffffff"},"14X":{"color":"cc0033","oppcolor":"ffffff"},"16X":{"color":"cc0033","oppcolor":"ffffff"},"28L":{"color":"009900","oppcolor":"ffffff"},"30X":{"color":"cc0033","oppcolor":"ffffff"},"31AX":{"color":"990000","oppcolor":"ffffff"},"31BX":{"color":"cc3333","oppcolor":"ffffff"},"38AX":{"color":"990000","oppcolor":"ffffff"},"38BX":{"color":"cc3333","oppcolor":"ffffff"},"38L":{"color":"009900","oppcolor":"ffffff"},"71L":{"color":"009900","oppcolor":"ffffff"},"76X":{"color":"009900","oppcolor":"ffffff"},"81X":{"color":"cc0033","oppcolor":"ffffff"},"82X":{"color":"cc0033","oppcolor":"ffffff"},"83X":{"color":"cc0033","oppcolor":"ffffff"},"K OWL":{"color":"198080","oppcolor":"ffffff"},"L OWL":{"color":"330066","oppcolor":"ffffff"},"M OWL":{"color":"004d19","oppcolor":"ffffff"},"N OWL":{"color":"001980","oppcolor":"ffffff"},"T OWL":{"color":"001980","oppcolor":"ffffff"}}; 
  this.routesNotRendered = true;

  // Create the map
  var map = this.gMap = new google.maps.Map(document.querySelector(config.el), config);

  // Setup the overlay
  var overlay = this.overlay = new google.maps.OverlayView();

  // Setup the DirectionsService
  var directionsService = new google.maps.DirectionsService();

  // Called when the position from projection.fromLatLngToPixel() would return a new value for a given LatLng
  // This readjusts all items hovering above the map to correct locations
  overlay.draw = function(){
    lm.app.adjustItemsOnMap(0);
  };

  // This is automatically called ONCE, immediately after overlay.setMap()
  overlay.onAdd = function(){
    var panes = d3.select(this.getPanes().overlayMouseTarget);

    // Store a reference to the projection
    self.projection = self.overlay.getProjection();
    self.midpoint = self.gMap.getCenter();

    self.busLayer = panes.append('div')
    .attr('class', 'toplayer');

    self.routeLayer = panes.append('div')
    .attr('class', 'toplayerRoutes');

    self.destloclayer = panes.append('div')
    .attr('class', 'destloclayer');

    self.userLocLayer = panes.append('div')
    .attr('class', 'userloclayer');

    self.stopLayer = panes.append('div')
    .attr('class', 'stoplayer');

    this.draw();
    getGeo(true, this);

    // Rerender map items if total drag amount is a full screen different.
    // DANGER! WILL ROBINSON: Currently this re-queries the Nextbus API
    google.maps.event.addListener(map, 'dragend', function() { 
      var newCenterXY = self.projection.fromLatLngToDivPixel(self.gMap.getCenter());
      var oldCenterXY = self.projection.fromLatLngToDivPixel(self.midpoint);
      if(Math.abs(newCenterXY.x-oldCenterXY.x)>window.innerWidth || 
         Math.abs(newCenterXY.y-oldCenterXY.y)>window.innerHeight){
        console.log('MOVED');
        // lm.config.timeout = false;
        lm.app.fetchAndRenderVehicles();
      }      
    });    

    // Call the ready callback
    if (typeof config.ready === 'function'){
      config.ready();
    }
  };

  // Get user location
  var getGeo = function(highAccuracy){
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(position){
          self.waitForDestinationClick(position, this.overlay);
        },
        function(err){
          if(err.code === 3){
            console.log('High accuracy not available');
            getGeo(false);
          } else {
            console.log('Please enable GPS.');
          }
        },
        { enableHighAccuracy: highAccuracy }
      );
    }
  };

  // Add the overlay to the map
  google.maps.event.addListenerOnce(map, 'idle', function() {
    self.overlay.setMap(self.gMap);
  });
};

// Alias the getBounds function of Google Maps
lm.Map.prototype.getBounds = function() {
  return this.gMap.getBounds();
};

lm.Map.prototype.waitForDestinationClick = function(userPosition){
  var self = this;
  var clickedOnce = false;
  var userLonLat = [userPosition.coords.longitude, userPosition.coords.latitude]; // not accurate in browser, may be accurate in phone
  // var userLonLat = [-122.408904,37.783594];  // fake
  var userMapLatLng = new google.maps.LatLng(userLonLat[1],userLonLat[0]);
  
  lm.app.set('userloc',[{lat:userLonLat[1],lon:userLonLat[0]}]);
  
  // Place user on map right now
  lm.app.adjustItemsOnMap(0);
  
  var location = new google.maps.LatLng(userLonLat[1], userLonLat[0]);
  this.gMap.setCenter(location);

  // TODO : toggle w/ button click on menu
  // TODO : resolve touches being counted as clicks
  google.maps.event.addListener(this.gMap, 'click', function(e) {
    lm.app.lastBusArray = [];
    clickedOnce = true;

    // Workaround to avoid double-clicks triggering click events
    setTimeout(function(){
      if(clickedOnce){
        google.maps.event.clearListeners(self.gMap, 'click');
        
        var destLonLat = [e.latLng.lng(), e.latLng.lat()];
        lm.app.set('destloc', [{lon: destLonLat[0],lat:destLonLat[1]}]);
        lm.app.adjustItemsOnMap(0);
        
        self.sendCoordsToServer(userLonLat, destLonLat);
      }
    },400); // 0.4 second delay to distinguish clicks and dblclicks
  });

  google.maps.event.addListener(this.gMap, 'dblclick', function(e) {
     clickedOnce = false;
  });
};

// Determine routes that pass by both user and destination
lm.Map.prototype.sendCoordsToServer = function(userLonLat, destLonLat){
  var xhr = new XMLHttpRequest();

  xhr.open("POST", "coordinates");
  xhr.setRequestHeader('Content-Type', 'application/json'); // TODO use d3 xhr
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == 200) {
      console.log('Reply received from server');
      try {
        var parsedRes = JSON.parse(xhr.responseText);
        console.log('Routes nearby are: ',parsedRes);
        if(Object.keys(parsedRes).length > 0){
          lm.app.getStopPredictions(parsedRes);
        } else {
          // Trigger a popup saying no routes available.
        }
      } catch(err) {
        console.error(err);
      }
    }
  };
  xhr.send(JSON.stringify([userLonLat, destLonLat]));
};

lm.Map.prototype.getRouteObjFromServer = function(routeObj){
  var send = JSON.stringify(routeObj);

  d3.xhr('/findStopsOnRoutes')
    .header('Content-Type','application/json')
    .post(send, this.routify.bind(this));
};

// Routify takes an array of map objects and renders them.
lm.Map.prototype.routify = function(err, res){
  if(err) throw err;
  var stopArr, // all stops with the routeAndDirTag
      coord,
      stopRead,
      allRoutes = {},
      endPairs = {}, // Obj of route objs containing dest/user lat and lon
      self = this,
      endpointArray = lm.app.lastStopObjArray; // Only routeStops we have predictions for

  for(var j = 0; j<endpointArray.length; j++){
    endPairs[endpointArray[j].routeAndDirTag] = endPairs[endpointArray[j].routeAndDirTag] || {};
    endPairs[endpointArray[j].routeAndDirTag][endpointArray[j].userOrDest] = endpointArray[j];
  }  
  
  try {
    stopArr = JSON.parse(res.responseText);
    this.routesNotRendered = false;
  } catch(error) {
    console.error(error);
  }

  var createPolyline = function(coordArray, routecolor) {
    var line = new google.maps.Polyline({
        path: coordArray,
        strokeColor: routecolor,
        strokeWeight: 4
    });
    line.setMap(self.gMap);
  };

  for(var i = 0; i<stopArr.length; i++){
    if(!allRoutes[stopArr[i].routeAndDirTag]){
      stopRead = false;
      allRoutes[stopArr[i].routeAndDirTag] = {stops:[],color:stopArr[i].color};
    }
    if(!stopRead){
        coord = new google.maps.LatLng(stopArr[i].lonlat[1],stopArr[i].lonlat[0]);
        allRoutes[stopArr[i].routeAndDirTag].stops.push(coord);
    } else {
      // console.log('break ',stopArr[i].lonlat[1], endPairs[stopArr[i].routeAndDirTag].dest.lat, stopArr[i].lonlat[0], endPairs[stopArr[i].routeAndDirTag].dest.lon);
    }
    if(stopArr[i].lonlat[0] === endPairs[stopArr[i].routeAndDirTag].dest.lon &&
       stopArr[i].lonlat[1] === endPairs[stopArr[i].routeAndDirTag].dest.lat
      ){
      stopRead = true; // Less than ideal
    }
  }
  
  for(var routeAndDirTag in allRoutes){
    // console.log('route: ',route,allRoutes[route].stops);
    // for(var s = 0; s<allRoutes[route].stops.length; s++){
    //   console.log(allRoutes[route].stops[s].pb);
    // }
    createPolyline(allRoutes[routeAndDirTag].stops, allRoutes[routeAndDirTag].color);
  }

//   var coord;
//   var waypoints = [];
//   var brain = {};
//   brain.directions = new google.maps.DirectionsService();
//   brain.routeSegments = [];
//   brain.counter = 0;
//   brain.direction = 'Outbound'; // be sure to change in AppJS under direction =
//   brain.routename = routename;
//   brain.totalStops = data.stops.length;
//   console.log('Compiling a new route');
//   for(var i = 0; i<data.stops.length; i++){
//     coord = new google.maps.LatLng(data.stops[i].lonlat.lat, data.stops[i].lonlat.lon);
//     waypoints.push({location: coord, stopover: true});
//     brain.totalStops--;
//     if(waypoints.length === 8 || brain.totalStops === 0){
//       brain.counter++;
//       (function(waypt, index){
//         console.log('firing in ',index);
//         setTimeout(function(){getPath(waypt, brain);}, 500*index);
//       })(waypoints, i);
//       waypoints = [waypoints[waypoints.length-1]];
//     }
//   }
// }






  // var self = this,
  //     endpointArray = lm.app.lastStopObjArray, // TODO: !IMPORTANT - verify that this only stores for routes with BOTH user and dest.
  //     items,
  //     routecolor,
  //     lat,
  //     lng,
  //     east,
  //     north,
  //     west,
  //     south,
  //     endPairs = {}; // obj of route objs containing dest/user lat and lon

  //     //bad
  // for(var j = 0; j<endpointArray.length; j++){
  //   endPairs[endpointArray[j].route] = endPairs[endpointArray[j].route] || {};
  //   endPairs[endpointArray[j].route][endpointArray[j].userOrDest] = endpointArray[j];
  // }
  //   //bad
  // // for(var routeKey in endPairs){
  // //   if(endPairs[routeKey].user.lon < endPairs[routeKey].dest.lon){
  // //     endPairs[routeKey].west = endPairs[routeKey].user.lon;
  // //     endPairs[routeKey].east = endPairs[routeKey].dest.lon;
  // //   } else {
  // //     endPairs[routeKey].east = endPairs[routeKey].user.lon;
  // //     endPairs[routeKey].west = endPairs[routeKey].dest.lon;
  // //   }
  // //   if(endPairs[routeKey].user.lat < endPairs[routeKey].dest.lat){
  // //     endPairs[routeKey].south = endPairs[routeKey].user.lat;
  // //     endPairs[routeKey].north = endPairs[routeKey].dest.lat;
  // //   } else {
  // //     endPairs[routeKey].north = endPairs[routeKey].user.lat;
  // //     endPairs[routeKey].south = endPairs[routeKey].dest.lat;
  // //   }    
  // // }

  // try {
  //   items = JSON.parse(res.responseText);
  //   this.routesNotRendered = false;
  // } catch(error) {
  //   console.error(error);
  // }

  // var createPolyline = function(coordArray, routecolor) {
  //   lat = 0;
  //   lng = 0;
  //   for(var i = 0; i<coordArray.length; i++){
  //     for(var key in coordArray[i]){
  //       if(coordArray[i][key] > 0){
  //         lat = coordArray[i][key];
  //       } else {
  //         lng = coordArray[i][key];
  //       }
  //     }
  //     coordArray[i] = new google.maps.LatLng(lat,lng);
  //   }
  //   var line = new google.maps.Polyline({
  //       path: coordArray,
  //       strokeColor: routecolor,
  //       strokeWeight: 4
  //   });
  //   line.setMap(self.gMap);
  // };

  // // working
  // for (var route = 0; route<items.length; route++){
  //   for(var i = 0; i<items[route].path.length; i++){
  //     createPolyline(items[route].path[i].routes[0].overview_path, items[route].routecolor);
  //   }
  // }

  // for (var routeNum = 0; routeNum<items.length; routeNum++){
  //   for(var i = 0; i<items[routeNum].path.length; i++){
  //     var temp = [];
  //     var current = items[routeNum].path[i].routes[0].overview_path;
  //     var routeName = items[routeNum].routename;
  //     for(var k = 0; k<current.length; k++){
  //       // May be worth testing with N/S too
  //       // TODO: verify that current's keys will not change
  //       if(current[k].mb > endPairs[routeName].west && current[k].mb < endPairs[routeName].east){
  //         temp.push(current[k]);
  //       }
  //     }
  //     if(temp.length > 0){
  //       console.log('submitting');
  //       createPolyline(temp, items[routeNum].routecolor);        
  //     }
  //   }
  // }

  // var currentPath;
  // var currentOverviewPath;
  // var currentRouteName;
  // var pathsUntil = [];

  // for (var route = 0; route<items.length; route++){
  //   currentRouteName = items[route].routename;
  //   (function(){
  //     currentPath = items[route].path;
  //     for(var i = currentPath.length-1; i>=0; i--){
  //       currentOverviewPath = currentPath[i].routes[0].overview_path;
  //       pathsUntil = [];
  //       for(var j = 0; j<currentOverviewPath.length; j++){
  //         console.log(currentRouteName, Math.round(currentOverviewPath[j].lb*1000)/1000, Math.round(endPairs[currentRouteName].dest.lat*1000)/1000);
  //         // if(currentOverviewPath[j].lb === endPairs[currentRouteName].dest.lat && currentOverviewPath[j].mb === endPairs[currentRouteName].dest.lon){
  //         if(Math.round(currentOverviewPath[j].lb*1000)/1000 === Math.round(endPairs[currentRouteName].dest.lat*1000)/1000){
  //           pathsUntil.push(currentOverviewPath[j]);
  //           createPolyline(pathsUntil, items[route].routecolor);
  //           console.log('BREAK');
  //           return;
  //         }
  //         pathsUntil.push(currentOverviewPath[j]);
  //       }
  //       console.log('a line');
  //       createPolyline(items[route].path[i].routes[0].overview_path, items[route].routecolor);
  //     }
  //   })();
  // }

};
