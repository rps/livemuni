var lm = {
  config: {
    map: {
      el: '#map-canvas',
      center: new google.maps.LatLng(37.783, -122.409), //getCenter for NONwrapped LatLon obj
      zoom: 15,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [
        {featureType: 'poi.business',
         elementType: 'all',
         stylers: [{ visibility: "off" }]
        }
      ]
    },
    offset: 10,
    direction: 'Outbound'
  },
  init: function() {
    // Start app
    lm.app = new lm.App(lm.config);
  },
  getDirection: function(){
    return this.config.direction === 'Outbound' ? '_OB' : '_IB';
  },
  util: {}
};

lm.util.extend = function() {
  var target = arguments[0];
  for (var i = 1; i < arguments.length; i++) {
    for (var prop in arguments[i]) {
      target[prop] = arguments[i][prop];
    }
  }
  return target;
};;lm.App = function(config) {
  this.lastTime = 0;
  this.lastBusArray = [];
  this.lastRouteArray = [];
  this.lastStopObj = {};

  // Initialize map
  this.map = new lm.Map(lm.util.extend(config.map, {
    ready: this.setupMap.bind(this)
  }));
};

lm.App.prototype.setupMap = function (argument) {
  // Load initial content
  this.fetchAndRenderVehicles();

  // Start polling
  setInterval(this.fetchAndRenderVehicles.bind(this), 10000);
};

lm.App.prototype.set = function(variable, value){
  this[variable] = value;
};

lm.App.prototype.fetchAndRenderVehicles = function() {
  var bounds = this.map.getBounds(),
      southWest = bounds.getSouthWest(),
      northEast = bounds.getNorthEast(),
      projection = this.map.projection,
      self = this;

  // Always pulls last 15m. To use self.lastTime with D3, will need to implement websockets.
  d3.xhr('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&t='+'0', function(err,res){
    if(err) {
      console.error('Error: ',err);
      return;
    }
    var busArray = [],
        doc = new XmlDocument(res.response); // TODO: move to server

    // 66% reduction in buses when filtering out LatLon
    for(var i = 0; i<doc.children.length; i++){
      if(doc.children[i].name === 'lastTime'){
        self.lastTime = doc.children[i].attr.time;
      }

      if(
      (!self.lastRouteArray.length || self.lastRouteArray.indexOf(doc.children[i].attr.routeTag) > -1) && // validate against eligible routes, if any listed
      (southWest.lat()-0.01 <= Number(doc.children[i].attr.lat) && Number(doc.children[i].attr.lat) <= northEast.lat()+0.01) && // Remove bus markers placed
      (southWest.lng()-0.01 <= Number(doc.children[i].attr.lon) && Number(doc.children[i].attr.lon) <= northEast.lng()+0.01) && // outside the screen.
      (doc.children[i].attr.secsSinceReport && doc.children[i].attr.secsSinceReport < 180) &&                 // Remove 180sec old markers.
      (doc.children[i].attr.dirTag && doc.children[i].attr.dirTag.indexOf(lm.getDirection()) > -1)          // Remove wrong direction bus.
      ){
        busArray.push(doc.children[i].attr);
      }
    }
    // Save busArray for quick rerendering on zoom
    self.lastBusArray = busArray;

    // Render buses
    self.bussify(1);
  });
};

lm.App.prototype.getStopPredictions = function(stopObj){
  var query = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni',
      map = this.map,
      self = this;

  this.lastRouteArray = [];

  for(var route in stopObj){
    this.lastRouteArray.push(route); // Filters out nonessential buses in fetchAndRenderVehnicles
    query+='&stops='+route+'|'+stopObj[route].stopTag;
  }

  d3.xhr(query, function(err, res){
    if(err){
      console.log('Prediction error: ',err);
    }

    var doc = new XmlDocument(res.response),
        storage = { counter:doc.children.length };

    doc.eachChild(function(child){
      storage.counter--;

      if(child.children.length > 0){
        if(child.children[0].name !== 'message'){
          var name = child.attr.routeTag,
              lat = stopObj[name].lonlat[1], 
              lon = stopObj[name].lonlat[0],
              minutes = child.children[0].children[0].attr.minutes;

          storage[name] = { lat: lat, lon: lon, minutes: minutes };
          // Could send route requests individually here, but db connection might get overloaded
        }
      }

      if(storage.counter === 0){
        delete storage.counter;
        self.lastStopObj = storage;
        self.bussify(0);
        setTimeout(function(){self.getStopPredictions(stopObj);}, 30000);
        map.routesNotRendered && map.getRoutesFromServer(Object.keys(storage));
      }
      // TODO: delete nonessential buses ***
    });
  });
};

lm.App.prototype.bussify = function(enableTransitions){
  var self = this,
      busArray = this.lastBusArray;

  var latLngToPx = function(d) {
    d = new google.maps.LatLng(d.lat, d.lon);
    d = self.map.projection.fromLatLngToDivPixel(d);

    // this is the DOM element, we slowly change the style
    return d3.select(this)
      .transition().duration(10000*enableTransitions)  //.delay(function(d,i){return Math.min(i*50,5000)})
      .style('left', (d.x - lm.config.offset) + 'px')
      .style('top', (d.y - lm.config.offset) +  'px');
    };

/*************
  U s e r s
*************/

if(this.userloc){

  var userSvgBind = d3.select('.userloclayer').selectAll('svg')
    .data(this.userloc)
    .each(latLngToPx);

  var userSvg = userSvgBind.enter().append('svg')
    .each(latLngToPx)
    .attr('class','usersvg');

  var userCirc = userSvg.append('circle')
    .attr('r', 8)
    .attr('cx',10)
    .attr('cy',10)
    .attr('class','user')
    .style('fill','blue');

  this.userloc = undefined; 
}  

/*************
  D e s t s
*************/


if(this.destloc){

  var destSvgBind = d3.select('.clicklayer').selectAll('svg')
    .data(this.destloc)
    .each(latLngToPx);

  var destSvg = destSvgBind.enter().append('svg')
    .each(latLngToPx)
    .attr('class','clicksvg');

  var destCirc = destSvg.append('circle')
    .attr('r', 8)
    .attr('cx',10)
    .attr('cy',10)
    .attr('class','dest')
    .style('fill','red');  

  this.destloc = undefined;
}  

/************* 
  S t o p s
**************/

if(this.lastStopObj){
  var dirObj = this.lastStopObj,
      pixelData = [];

  for(var key in dirObj){
    pixelData.push({lat:dirObj[key].lat, lon:dirObj[key].lon, route: key, time: dirObj[key].minutes});
  }

  var stopSvgBind = d3.select('.stoplayer').selectAll('svg')
    .data(pixelData, function(d){ return d.route; })
    .each(latLngToPx);

  var stopSvg = stopSvgBind.enter().append('svg')
    .each(latLngToPx)
    .attr('class','stopsvg');

  stopSvg.append('rect')
    .attr('x',10)
    .attr('y',5)
    .attr('width',40)
    .attr('height',10)
    .style('fill','black');

  var stopCirc = stopSvg.append('circle')
    .attr('r', 8)
    .attr('cx',10)
    .attr('cy',10)
    .attr('class','stop')
    .style('fill','yellow');  

  var timeLeft = stopSvg.append('text')
      .attr('x',20)
      .attr('y',10)
      .attr('dy', '.31em')
      .attr('fill','white')
      .attr('class','timetext');

  d3.selectAll('.timetext')
    .data(pixelData, function(d){ return d.route; })
    .text(function(d){ return d.time+' min';});

  stopSvg.append('text')
    .attr('x',4)
    .attr('y',10)
    .attr('dy', '.31em')
    .attr('fill','black')
    .text(function(d){ return d.route; });
}

/************* 
  B u s s e s 
**************/

  //create SVG containers
  var busContainer = d3.select('.toplayer').selectAll('.busContainer') // select all svg elements
    .data(busArray, function(d){ return d.id; })
    .each(latLngToPx);

  var exiting = busContainer.exit();

  exiting.selectAll('circle')
    .transition().duration(2000*enableTransitions)
    .style('opacity',0);

  exiting.selectAll('text')
    .transition().duration(2000*enableTransitions)
    .style('opacity',0);

  setTimeout(function(){exiting.remove();},2000*enableTransitions);

  var svgs = busContainer.enter().append('svg')
    .each(latLngToPx)
    .attr('class','busContainer');

  var circle = svgs.append('circle')
    .transition().duration(2000*enableTransitions)
    .attr('r', 8)
    .attr('cx',lm.config.offset)
    .attr('cy',lm.config.offset)
    .attr('class','bus')
    .style('fill-opacity',0.7)
    .style('stroke-width','1.5px')
    .style('fill',function(){return '#'+(~~(Math.random()*(1<<24))).toString(16);}); //colors

  var text = svgs.append('text')
    .attr('x',lm.config.offset/2)
    .attr('y',lm.config.offset)
    .attr('dy', '.31em')
    .attr('fill','black')
    .text(function(d){return d.routeTag;});
};;lm.Map = function(config) {
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

  // Called when the position from projection.fromLatLngToPixel() would return a new value for a given LatLng.
  overlay.draw = function(){
    lm.app.bussify(0);
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
  var clickedOnce = false;
  // var userLonLat = [userPosition.coords.lon, userPosition.coords.lat]; // not accurate in browser, may be accurate in phone
  userPosition = {coords:{lat:37.783594,lon: -122.408904}}; // fake TODO fix
  var userLonLat = [-122.408904,37.783594];                            // fake TODO fix
  var userMapLatLng = new google.maps.LatLng(userLonLat[1],userLonLat[0]);
  
  lm.app.set('userloc',[userPosition.coords]);
  lm.app.bussify(0);
  
  var location = new google.maps.LatLng(userPosition.coords.lat, userPosition.coords.lon);
  this.gMap.setCenter(location);

  // TODO : toggle w/ button click on menu
  google.maps.event.addListener(map, 'click', function(e) {
    clickedOnce = true;
    // Workaround to avoid double-clicks triggering click events
    setTimeout(function(){
      if(clickedOnce){
        google.maps.event.clearListeners(map, 'click');
        
        var destLonLat = [e.latLng.lng(), e.latLng.lat()];
        lm.app.set('destloc', [{lon: destLonLat[0],lat:destLonLat[1]}]);
        lm.app.bussify(0);
        lm.config.direction = (destLonLat[0] < userLonLat[0]) ? 'Outbound' : 'Inbound'; // rough prediction of inbound/outbound
        
        self.sendCoordsToServer(userLonLat, destLonLat);
      }
    },400); // 0.4 second delay to distinguish clicks and dblclicks
  });

  google.maps.event.addListener(map, 'dblclick', function(e) {
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
