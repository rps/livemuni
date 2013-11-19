lm.Map = function(config) {
  var self = this;
  this.allRouteColors = {"1":{"color":"cc6600","oppcolor":"000000"},"2":{"color":"000000","oppcolor":"ffffff"},"3":{"color":"339999","oppcolor":"000000"},"5":{"color":"666699","oppcolor":"ffffff"},"6":{"color":"996699","oppcolor":"000000"},"9":{"color":"889944","oppcolor":"000000"},"10":{"color":"b07d00","oppcolor":"000000"},"12":{"color":"b07d00","oppcolor":"000000"},"14":{"color":"339999","oppcolor":"000000"},"17":{"color":"003399","oppcolor":"ffffff"},"18":{"color":"996699","oppcolor":"000000"},"19":{"color":"000000","oppcolor":"ffffff"},"21":{"color":"660000","oppcolor":"ffffff"},"22":{"color":"ff6633","oppcolor":"000000"},"23":{"color":"b07d00","oppcolor":"000000"},"24":{"color":"996699","oppcolor":"000000"},"27":{"color":"660099","oppcolor":"ffffff"},"28":{"color":"000000","oppcolor":"ffffff"},"29":{"color":"ff6633","oppcolor":"000000"},"30":{"color":"990099","oppcolor":"ffffff"},"31":{"color":"339999","oppcolor":"000000"},"33":{"color":"660000","oppcolor":"ffffff"},"35":{"color":"ff6633","oppcolor":"000000"},"36":{"color":"003399","oppcolor":"ffffff"},"37":{"color":"000000","oppcolor":"ffffff"},"38":{"color":"ff6633","oppcolor":"000000"},"39":{"color":"ff6633","oppcolor":"000000"},"41":{"color":"b07d00","oppcolor":"000000"},"43":{"color":"006633","oppcolor":"ffffff"},"44":{"color":"ff6633","oppcolor":"000000"},"45":{"color":"006633","oppcolor":"ffffff"},"47":{"color":"667744","oppcolor":"ffffff"},"48":{"color":"cc6600","oppcolor":"000000"},"49":{"color":"b07d00","oppcolor":"000000"},"52":{"color":"889944","oppcolor":"000000"},"54":{"color":"cc0033","oppcolor":"ffffff"},"56":{"color":"990099","oppcolor":"ffffff"},"59":{"color":"cc3399","oppcolor":"ffffff"},"60":{"color":"4444a4","oppcolor":"ffffff"},"61":{"color":"9ac520","oppcolor":"000000"},"66":{"color":"666699","oppcolor":"ffffff"},"67":{"color":"555555","oppcolor":"ffffff"},"71":{"color":"667744","oppcolor":"ffffff"},"88":{"color":"555555","oppcolor":"ffffff"},"90":{"color":"660000","oppcolor":"ffffff"},"91":{"color":"667744","oppcolor":"ffffff"},"108":{"color":"555555","oppcolor":"ffffff"},"F":{"color":"555555","oppcolor":"ffffff"},"J":{"color":"cc6600","oppcolor":"000000"},"KT":{"color":"cc0033","oppcolor":"ffffff"},"L":{"color":"660099","oppcolor":"ffffff"},"M":{"color":"006633","oppcolor":"ffffff"},"N":{"color":"003399","oppcolor":"ffffff"},"NX":{"color":"006633","oppcolor":"ffffff"},"1AX":{"color":"990000","oppcolor":"ffffff"},"1BX":{"color":"cc3333","oppcolor":"ffffff"},"5L":{"color":"666699","oppcolor":"ffffff"},"8X":{"color":"996699","oppcolor":"000000"},"8AX":{"color":"996699","oppcolor":"000000"},"8BX":{"color":"996699","oppcolor":"000000"},"9L":{"color":"889944","oppcolor":"000000"},"14L":{"color":"009900","oppcolor":"ffffff"},"14X":{"color":"cc0033","oppcolor":"ffffff"},"16X":{"color":"cc0033","oppcolor":"ffffff"},"28L":{"color":"009900","oppcolor":"ffffff"},"30X":{"color":"cc0033","oppcolor":"ffffff"},"31AX":{"color":"990000","oppcolor":"ffffff"},"31BX":{"color":"cc3333","oppcolor":"ffffff"},"38AX":{"color":"990000","oppcolor":"ffffff"},"38BX":{"color":"cc3333","oppcolor":"ffffff"},"38L":{"color":"009900","oppcolor":"ffffff"},"71L":{"color":"009900","oppcolor":"ffffff"},"76X":{"color":"009900","oppcolor":"ffffff"},"81X":{"color":"cc0033","oppcolor":"ffffff"},"82X":{"color":"cc0033","oppcolor":"ffffff"},"83X":{"color":"cc0033","oppcolor":"ffffff"},"K OWL":{"color":"198080","oppcolor":"ffffff"},"L OWL":{"color":"330066","oppcolor":"ffffff"},"M OWL":{"color":"004d19","oppcolor":"ffffff"},"N OWL":{"color":"001980","oppcolor":"ffffff"},"T OWL":{"color":"001980","oppcolor":"ffffff"}}; 
  this.routesNotRendered = true;
  this.allLines = [];

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
    self.getGeo(true, this);

    // Rerender map items if total drag amount is a full screen different.
    // DANGER! WILL ROBINSON: Currently this re-queries the Nextbus API
    google.maps.event.addListener(map, 'dragend', function() { 
      var mobileMultiplier = lm.config.mobile ? 3 : 1;
      var newCenterXY = self.projection.fromLatLngToDivPixel(self.gMap.getCenter());
      var oldCenterXY = self.projection.fromLatLngToDivPixel(self.midpoint);
      if(Math.abs(newCenterXY.x-oldCenterXY.x)>(window.innerWidth*mobileMultiplier) || 
         Math.abs(newCenterXY.y-oldCenterXY.y)>(window.innerHeight*mobileMultiplier)){
        console.log('MOVED');
        lm.app.fetchAndRenderVehicles();
      }      
    });    

    // Call the ready callback
    if (typeof config.ready === 'function'){
      config.ready();
    }
  };

  // Add the overlay to the map
  google.maps.event.addListenerOnce(map, 'idle', function() {
    self.overlay.setMap(self.gMap);
  });
};

// Get user location
lm.Map.prototype.getGeo = function(highAccuracy){
  var self = this;
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position){
        self.waitForDestinationClick([position.coords.longitude, position.coords.latitude]);
      },
      function(err){
        if(err.code === 3){
          console.log('High accuracy not available');
          self.getGeo(false);
        } else {
          console.log('Please enable GPS.');
        }
      },
      { enableHighAccuracy: highAccuracy }
    );
  }
};

// Alias the getBounds function of Google Maps
lm.Map.prototype.getBounds = function() {
  return this.gMap.getBounds();
};

lm.Map.prototype.centerMap = function(lonLatCoordArr){
  var location = new google.maps.LatLng(lonLatCoordArr[1], lonLatCoordArr[0]);
  this.gMap.setCenter(location);
};

lm.Map.prototype.waitForDestinationClick = function(userPosition){
  console.log('WAITFOR');
  this.userPosition = userPosition || this.userPosition;
  var self = this,
      clickedOnce = false,
      userLonLat = this.userPosition,
      userMapLatLng = new google.maps.LatLng(userLonLat[1],userLonLat[0]);
  
  lm.app.set('userloc',[{lat:userLonLat[1],lon:userLonLat[0]}]);
  
  // Place user on map right now
  lm.app.adjustItemsOnMap(0);

  if(lm.app.destloc && lm.app.destloc.length > 0){
    self.sendCoordsToServer(userLonLat, [lm.app.destloc[0].lon, lm.app.destloc[0].lat]);
  }
  if(userPosition){
    this.centerMap(userLonLat);
  }

  google.maps.event.addListener(this.gMap, 'click', function(e) {
    lm.app.lastBusArray = [];
    clickedOnce = true;

    // Workaround to avoid double-clicks triggering click events
    setTimeout(function(){
      if(clickedOnce){
        google.maps.event.clearListeners(self.gMap, 'click');
        google.maps.event.clearListeners(self.gMap, 'dblclick');
        
        var destLonLat = [e.latLng.lng(), e.latLng.lat()];
        lm.app.set('destloc', [{lon: destLonLat[0],lat:destLonLat[1]}]);
        lm.app.adjustItemsOnMap(0);
        
        self.sendCoordsToServer(userLonLat, destLonLat);
      }
    }, 400); // 0.4 second delay to distinguish clicks and dblclicks
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
          if(lm.app.busIntervalReference === -1){
            lm.app.set('busIntervalReference',0);
          }
          if(lm.app.stopIntervalReference === -1){
            lm.app.set('stopIntervalReference',0);
          }
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
  console.log('ep keys',Object.keys(endPairs));
  
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
    self.allLines.push(line);
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
};

lm.Map.prototype.clearLines = function(){
  for(var i in this.allLines){
    this.allLines[i].setMap(null);
  }
  this.routesNotRendered = true;
};
