lm.Map = function(config) {
  var self = this;

  this.routesNotRendered = true;

  // Create the map
  // TODO: REMOVE GLOBAL
  var map = window.map = this.gMap = new google.maps.Map(document.querySelector(config.el), config);

  // Setup the overlay
  // TODO: REMOVE GLOBAL
  var overlay = window.overlay = this.overlay = new google.maps.OverlayView();

  // Setup the DirectionsService
  // TODO: REMOVE GLOBAL
  var directionsService = window.directionsService = new google.maps.DirectionsService();

  // called when the position from projection.fromLatLngToPixel() would return a new value for a given LatLng.
  overlay.draw = function(){
    lm.app.bussify(0);
    // lm.app.updateOrAddSVG('.stoplayer', 'stopsvg', 'stop', 'yellow');
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

    self.clickLayer = panes.append('div')
    .attr('class', 'clicklayer');

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
  // var userLonLat = [userPosition.coords.lon, userPosition.coords.lat]; // not accurate in browser, may be accurate in phone
  userPosition = {coords:{lat:37.783594,lon: -122.408904}}; // fake TODO fix
  var userLonLat = [-122.408904,37.783594];                            // fake TODO fix
  var userMapLatLng = new google.maps.LatLng(userLonLat[1],userLonLat[0]);
  lm.app.set('userloc',[userPosition.coords]);
  // lm.app.updateOrAddSVG(userMapLatLng, '.userloclayer', 'usersvg', 'user', 'blue');
  lm.app.bussify(0);
  var location = new google.maps.LatLng(userPosition.coords.lat, userPosition.coords.lon);
  this.gMap.setCenter(location);

  // may be good to toggle w/ button click on menu
  google.maps.event.addListener(map, 'click', function(e) {
    var destLonLat = [e.latLng.lng(), e.latLng.lat()];
    lm.config.direction = (destLonLat[0] < userLonLat[0]) ? 'Outbound' : 'Inbound'; // rough prediction of inbound/outbound
    lm.app.updateOrAddSVG(e.latLng, '.clicklayer','clicksvg','dest', 'black');
    self.sendCoordsToServer(userLonLat, destLonLat);
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
  if(err) throw err;
  var self = this;
  var items,
      lat,
      lng;

  try {
    items = JSON.parse(res.responseText);
    this.routesNotRendered = false;
  } catch(error) {
    console.error(error);
  }

  var createPolyline = function(coordArray) {
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
        strokeColor: '#F08080',
        strokeWeight: 4
    });
    line.setMap(self.gMap);
  };

  for (var route = 0; route<items.length; route++){
    for(var i = 0; i<items[route].path.length; i++){
      createPolyline(items[route].path[i].routes[0].overview_path);
    }
  }

};
