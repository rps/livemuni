lm.Map = function(config) {
  var self = this;
  this.obby = {"1":{"color":"cc6600","oppcolor":"000000"},"2":{"color":"000000","oppcolor":"ffffff"},"3":{"color":"339999","oppcolor":"000000"},"5":{"color":"666699","oppcolor":"ffffff"},"6":{"color":"996699","oppcolor":"000000"},"9":{"color":"889944","oppcolor":"000000"},"10":{"color":"b07d00","oppcolor":"000000"},"12":{"color":"b07d00","oppcolor":"000000"},"14":{"color":"339999","oppcolor":"000000"},"17":{"color":"003399","oppcolor":"ffffff"},"18":{"color":"996699","oppcolor":"000000"},"19":{"color":"000000","oppcolor":"ffffff"},"21":{"color":"660000","oppcolor":"ffffff"},"22":{"color":"ff6633","oppcolor":"000000"},"23":{"color":"b07d00","oppcolor":"000000"},"24":{"color":"996699","oppcolor":"000000"},"27":{"color":"660099","oppcolor":"ffffff"},"28":{"color":"000000","oppcolor":"ffffff"},"29":{"color":"ff6633","oppcolor":"000000"},"30":{"color":"990099","oppcolor":"ffffff"},"31":{"color":"339999","oppcolor":"000000"},"33":{"color":"660000","oppcolor":"ffffff"},"35":{"color":"ff6633","oppcolor":"000000"},"36":{"color":"003399","oppcolor":"ffffff"},"37":{"color":"000000","oppcolor":"ffffff"},"38":{"color":"ff6633","oppcolor":"000000"},"39":{"color":"ff6633","oppcolor":"000000"},"41":{"color":"b07d00","oppcolor":"000000"},"43":{"color":"006633","oppcolor":"ffffff"},"44":{"color":"ff6633","oppcolor":"000000"},"45":{"color":"006633","oppcolor":"ffffff"},"47":{"color":"667744","oppcolor":"ffffff"},"48":{"color":"cc6600","oppcolor":"000000"},"49":{"color":"b07d00","oppcolor":"000000"},"52":{"color":"889944","oppcolor":"000000"},"54":{"color":"cc0033","oppcolor":"ffffff"},"56":{"color":"990099","oppcolor":"ffffff"},"59":{"color":"cc3399","oppcolor":"ffffff"},"60":{"color":"4444a4","oppcolor":"ffffff"},"61":{"color":"9ac520","oppcolor":"000000"},"66":{"color":"666699","oppcolor":"ffffff"},"67":{"color":"555555","oppcolor":"ffffff"},"71":{"color":"667744","oppcolor":"ffffff"},"88":{"color":"555555","oppcolor":"ffffff"},"90":{"color":"660000","oppcolor":"ffffff"},"91":{"color":"667744","oppcolor":"ffffff"},"108":{"color":"555555","oppcolor":"ffffff"},"F":{"color":"555555","oppcolor":"ffffff"},"J":{"color":"cc6600","oppcolor":"000000"},"KT":{"color":"cc0033","oppcolor":"ffffff"},"L":{"color":"660099","oppcolor":"ffffff"},"M":{"color":"006633","oppcolor":"ffffff"},"N":{"color":"003399","oppcolor":"ffffff"},"NX":{"color":"006633","oppcolor":"ffffff"},"1AX":{"color":"990000","oppcolor":"ffffff"},"1BX":{"color":"cc3333","oppcolor":"ffffff"},"5L":{"color":"666699","oppcolor":"ffffff"},"8X":{"color":"996699","oppcolor":"000000"},"8AX":{"color":"996699","oppcolor":"000000"},"8BX":{"color":"996699","oppcolor":"000000"},"9L":{"color":"889944","oppcolor":"000000"},"14L":{"color":"009900","oppcolor":"ffffff"},"14X":{"color":"cc0033","oppcolor":"ffffff"},"16X":{"color":"cc0033","oppcolor":"ffffff"},"28L":{"color":"009900","oppcolor":"ffffff"},"30X":{"color":"cc0033","oppcolor":"ffffff"},"31AX":{"color":"990000","oppcolor":"ffffff"},"31BX":{"color":"cc3333","oppcolor":"ffffff"},"38AX":{"color":"990000","oppcolor":"ffffff"},"38BX":{"color":"cc3333","oppcolor":"ffffff"},"38L":{"color":"009900","oppcolor":"ffffff"},"71L":{"color":"009900","oppcolor":"ffffff"},"76X":{"color":"009900","oppcolor":"ffffff"},"81X":{"color":"cc0033","oppcolor":"ffffff"},"82X":{"color":"cc0033","oppcolor":"ffffff"},"83X":{"color":"cc0033","oppcolor":"ffffff"},"K OWL":{"color":"198080","oppcolor":"ffffff"},"L OWL":{"color":"330066","oppcolor":"ffffff"},"M OWL":{"color":"004d19","oppcolor":"ffffff"},"N OWL":{"color":"001980","oppcolor":"ffffff"},"T OWL":{"color":"001980","oppcolor":"ffffff"}}; 

  this.routesNotRendered = true;

  // Create the map
  var map = this.gMap = new google.maps.Map(document.querySelector(config.el), config);

  // Setup the overlay
  var overlay = this.overlay = new google.maps.OverlayView();

  // Setup the DirectionsService
  var directionsService = new google.maps.DirectionsService();

  // Called when the position from projection.fromLatLngToPixel() would return a new value for a given LatLng.
  overlay.draw = function(){
    lm.app.adjustItemsOnMap(0);
  };

  // This is automatically called ONCE after overlay.setMap()
  overlay.onAdd = function(){
    var panes = d3.select(this.getPanes().overlayMouseTarget);

    // Store a reference to the projection
    self.projection = self.overlay.getProjection();

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

  // Store the projection for future use
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
  // var userLonLat = [userPosition.coords.lon, userPosition.coords.lat]; // not accurate in browser, may be accurate in phone
  userPosition = {coords:{lat:37.783594,lon: -122.408904}}; // fake TODO fix
  var userLonLat = [-122.408904,37.783594];                            // fake TODO fix
  var userMapLatLng = new google.maps.LatLng(userLonLat[1],userLonLat[0]);
  
  lm.app.set('userloc',[userPosition.coords]);
  // Place user on map right now
  lm.app.adjustItemsOnMap(0);
  
  var location = new google.maps.LatLng(userPosition.coords.lat, userPosition.coords.lon);
  this.gMap.setCenter(location);

  // TODO : toggle w/ button click on menu
  google.maps.event.addListener(this.gMap, 'click', function(e) {
    clickedOnce = true;

    // Workaround to avoid double-clicks triggering click events
    setTimeout(function(){
      if(clickedOnce){
        google.maps.event.clearListeners(self.gMap, 'click');
        
        var destLonLat = [e.latLng.lng(), e.latLng.lat()];
        lm.app.set('destloc', [{lon: destLonLat[0],lat:destLonLat[1]}]);
        lm.app.adjustItemsOnMap(0);
        lm.config.direction = (destLonLat[0] < userLonLat[0]) ? 'Outbound' : 'Inbound'; // rough prediction of inbound/outbound
        
        self.sendCoordsToServer(userLonLat, destLonLat);
      }
    },400); // 0.4 second delay to distinguish clicks and dblclicks
  });

  google.maps.event.addListener(this.gMap, 'dblclick', function(e) {
     clickedOnce = false;
  });
};

lm.Map.prototype.sendCoordsToServer = function(userLonLat, destLonLat){
  var xhr = new XMLHttpRequest();

  xhr.open("POST", "coordinates");
  xhr.setRequestHeader('Content-Type', 'application/json'); // TODO use d3 xhr
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == 200) {
      console.log('Reply received from server');
      try {
        var parsedRes = JSON.parse(xhr.responseText);
        lm.app.getStopPredictions(parsedRes);
      } catch(err) {
        console.error(err);
      }
    }
  };
  xhr.send(JSON.stringify([userLonLat, destLonLat, lm.config.direction]));
};

lm.Map.prototype.getRoutesFromServer = function(routeArray){
  var data = {};
  data[lm.config.direction] = routeArray;
  var send = JSON.stringify(data);

  d3.xhr('/routify')
    .header('Content-Type','application/json')
    .post(send, this.routify.bind(this));
};

// Routify takes an array of map objects and renders them.
lm.Map.prototype.routify = function(err, res){
  console.log(res);
  if(err) throw err;
  var self = this;
  var items,
      routecolor,
      lat,
      lng;

  try {
    items = JSON.parse(res.responseText);
    this.routesNotRendered = false;
  } catch(error) {
    console.error(error);
  }

  var createPolyline = function(coordArray, routecolor) {
    lat = 0;
    lng = 0;
    for(var i = 0; i<coordArray.length; i++){
      for(var key in coordArray[i]){
        if(coordArray[i][key] > 0){
          lat = coordArray[i][key];
        } else {
          lng = coordArray[i][key];
        }
      }
      coordArray[i] = new google.maps.LatLng(lat,lng);
    }
    var line = new google.maps.Polyline({
        path: coordArray,
        strokeColor: routecolor,
        strokeWeight: 4
    });
    line.setMap(self.gMap);
  };

  for (var route = 0; route<items.length; route++){
    for(var i = 0; i<items[route].path.length; i++){
      createPolyline(items[route].path[i].routes[0].overview_path, items[route].routecolor);
    }
  }

};
