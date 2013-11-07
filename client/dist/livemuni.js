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
  // this.lastStopObj = {}; TODO: undo

  // Initialize map
  this.map = new lm.Map(lm.util.extend(config.map, {
    ready: this.setupMap.bind(this)
  }));
};

lm.App.prototype.setupMap = function (argument) {
  // Load initial content
  this.generateAndRenderData();

  // Start polling
  setInterval(this.generateAndRenderData.bind(this), 10000);
};

lm.App.prototype.generateAndRenderData = function() {
  var bounds = this.map.getBounds();
  var southWest = bounds.getSouthWest();
  var northEast = bounds.getNorthEast();
  var projection = this.map.projection;
  var self = this;

  // Always pulls last 15m. To use self.lastTime with D3, will need to implement websockets.
  d3.xhr('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&t='+'0', function(err,res){
    if(err) {
      console.error('Error: ',err);
      return;
    }
    var busArray = [];
    var doc = new XmlDocument(res.response); // TODO: move to server

    // 66% reduction in buses when filtering out LatLon
    for(var i = 0; i<doc.children.length; i++){
      if(doc.children[i].name === 'lastTime'){
        self.lastTime = doc.children[i].attr.time;
      }

      if(
      (southWest.lat() <= Number(doc.children[i].attr.lat) && Number(doc.children[i].attr.lat) <= northEast.lat()) && // Remove bus markers placed
      (southWest.lng() <= Number(doc.children[i].attr.lon) && Number(doc.children[i].attr.lon) <= northEast.lng()) && // outside the screen.
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
  var query = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni';
  var map = this.map;
  var self = this;

  for(var route in stopObj){
    query+='&stops='+route+'|'+stopObj[route].stopTag;
  }

  d3.xhr(query, function(err, res){
    if(err){
      console.log('Prediction error: ',err);
    }

    var doc = new XmlDocument(res.response);
    var storage = { counter:doc.children.length };

    doc.eachChild(function(child){
      storage.counter--;

      if(child.children.length > 0){
        if(child.children[0].name !== 'message'){
          var name = child.attr.routeTag;
          var latLng = new google.maps.LatLng(stopObj[name].lonlat[1], stopObj[name].lonlat[0]);
          var minutes = child.children[0].children[0].attr.minutes;
          storage[name] = { latLng: latLng, minutes: minutes };
          // Could send route requests individually here, but db connection might get overloaded
        }
      }

      if(storage.counter === 0){
        delete storage.counter;
        self.lastStopObj = storage;
        self.updateOrAddSVG(storage, '.stoplayer', 'stopsvg', 'stop', 'yellow'); // TODO: undo, remove storage
        setTimeout(function(){self.getStopPredictions(stopObj);}, 30000);
        map.routesNotRendered && map.getRoutesFromServer(Object.keys(storage));
      }
      // TODO: delete nonessential buses ***
    });
  });
};

lm.App.prototype.updateOrAddSVG = function(dirObj, selectClassWithDot, clickClass, circleClass, circleColor){
  var pixelData = [],
      svg,
      circ,
      timeleft,
      // dirObj = this.lastStopObj; TODO: undo
      projection = this.map.projection,
      svgBind = d3.select(selectClassWithDot).selectAll('svg'),
      multiple = !(dirObj instanceof google.maps.LatLng);

  if(!multiple){
    pixelData.push(projection.fromLatLngToDivPixel(dirObj));
    svgBind = svgBind.data(pixelData);
  } else {
    for (var key in dirObj){
      var tempdata = projection.fromLatLngToDivPixel(dirObj[key].latLng);
      pixelData.push({x:tempdata.x, y:tempdata.y, route: key, time: dirObj[key].minutes});
    }
    svgBind = svgBind.data(pixelData, function(d){ return d.route; });
  }

  svg = svgBind.enter().append('svg')
    .style('top',function(d){ return d.y-10; }) // why doesn't map clickevent pixel loc work?
    .style('left',function(d){ return d.x-10; })
    .attr('class',clickClass);

  // d3.selectAll('.'+clickClass) // TODO: undo
  //   .style('top',function(d){ return d.y-10; }) // why doesn't map clickevent pixel loc work?
  //   .style('left',function(d){ return d.x-10; });

  if(multiple){
    svg.append('rect')
      .attr('x',10)
      .attr('y',5)
      .attr('width',40)
      .attr('height',10)
      .style('fill','black');
  }

  circ = svg.append('circle')
    .attr('r', 8)
    .attr('cx',10)
    .attr('cy',10)
    .attr('class',circleClass)
    .style('fill',circleColor);

  if(multiple){
    timeLeft = svg.append('text')
      .attr('x',20)
      .attr('y',10)
      .attr('dy', '.31em')
      .attr('fill','white')
      .attr('class','timetext');

    d3.selectAll('.timetext')
      .data(pixelData, function(d){ return d.route; })
      .text(function(d){ return d.time+' min';});

    svg.append('text')
      .attr('x',4)
      .attr('y',10)
      .attr('dy', '.31em')
      .attr('fill','black')
      .text(function(d){ return d.route; });
  }
};

lm.App.prototype.bussify = function(enableTransitions){
  var self = this;
  var busArray = this.lastBusArray;

  var latLngToPx = function(d) {
    d = new google.maps.LatLng(d.lat, d.lon);
    d = self.map.projection.fromLatLngToDivPixel(d);

    // this is the DOM element, we slowly change the style
    return d3.select(this)
      .transition().duration(10000*enableTransitions)  //.delay(function(d,i){return Math.min(i*50,5000)})
      .style('left', (d.x - lm.config.offset) + 'px')
      .style('top', (d.y - lm.config.offset) +  'px');
    };

  var busLayer = d3.select('.toplayer');

  //create SVG containers
  var busContainer = busLayer.selectAll('.busContainer') // select all svg elements
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
  // var userLonLat = [userPosition.coords.longitude, userPosition.coords.latitude]; // not accurate in browser, may be accurate in phone
  userPosition = {coords:{latitude:37.783594,longitude: -122.408904}}; // fake TODO fix
  var userLonLat = [-122.408904,37.783594];                            // fake TODO fix
  var userMapLatLng = new google.maps.LatLng(userLonLat[1],userLonLat[0]);
  lm.app.updateOrAddSVG(userMapLatLng, '.userloclayer', 'usersvg', 'user', 'blue');
  var location = new google.maps.LatLng(userPosition.coords.latitude, userPosition.coords.longitude);
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
