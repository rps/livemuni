var lm = {
  config: {
    map: {
      el: '#map-canvas',
      center: new google.maps.LatLng(37.783, -122.409), //getCenter for NONwrapped LatLon obj
      zoom: 15,
      maxZoom: 18,
      minZoom: 14, 
      streetViewControl: false,
      zoomControlOptions: {
        // style: google.maps.ZoomControlStyle.LARGE,
        // position: google.maps.ControlPosition.LEFT_CENTER
      },
      mapTypeControl: false,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [
        {featureType: 'poi.business',
         elementType: 'all',
         stylers: [{ visibility: "off" }]
        }
      ] 
    },
    offset: 10,
    direction: {},
    timeout: true
  },
  init: function() {
    // Start app
    lm.app = new lm.App(lm.config);
  },
  hasDirection: function(key){
    return this.config.direction[key];
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
  this.lastStopObjArray = [];
  this.userloc;
  this.destloc;

  // Initialize map
  this.map = new lm.Map(lm.util.extend(config.map, {
    ready: this.setupMap.bind(this)
  }));
};

lm.App.prototype.setupMap = function (argument) {
  this.map.getRouteObjFromServer({});
  // Load initial content
  // this.fetchAndRenderVehicles();

  // Start polling
  // setInterval(this.fetchAndRenderVehicles.bind(this), 10000);
};

lm.App.prototype.set = function(variable, value){
  this[variable] = value;
};

lm.App.prototype.fetchAndRenderVehicles = function() {
  // Reset stored map center to reset map drag trigger
  this.map.midpoint = this.map.gMap.getCenter();

  var bounds = this.map.getBounds(),
      southWest = bounds.getSouthWest(),
      northEast = bounds.getNorthEast(),
      projection = this.map.projection,
      self = this,
      url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&t=';

  // Always pulls last 15m. To use self.lastTime with D3, will need to implement websockets.
  d3.xhr(url+'0', function(err,res){
    if(err) {
      console.error('Error: ',err);
      return;
    }
    var busArray = [],
        dir = '',
        doc = new XmlDocument(res.response); // TODO: move to server

    // 66% reduction in buses when filtering out LatLon
    for(var i = 0; i<doc.children.length; i++){
      if(doc.children[i].name === 'lastTime'){
        self.lastTime = doc.children[i].attr.time;
      }
      if(
      (!self.lastRouteArray.length || self.lastRouteArray.indexOf(doc.children[i].attr.routeTag+':'+doc.children[i].attr.dirTag) > -1) && // validate against eligible routes, if any listed
      (southWest.lat()-0.01 <= Number(doc.children[i].attr.lat) && Number(doc.children[i].attr.lat) <= northEast.lat()+0.01) && // Remove bus markers placed
      (southWest.lng()-0.01 <= Number(doc.children[i].attr.lon) && Number(doc.children[i].attr.lon) <= northEast.lng()+0.01) && // outside the screen.
      (doc.children[i].attr.secsSinceReport && doc.children[i].attr.secsSinceReport < 180) &&                 // Remove 180sec old markers.
      (doc.children[i].attr.dirTag && (lm.hasDirection(doc.children[i].attr.routeTag+':'+doc.children[i].attr.dirTag) || Object.keys(lm.config.direction).length === 0))          // Remove wrong direction bus.
      ){ 
        busArray.push(doc.children[i].attr);
      } 
    }
    // Save busArray for quick rerendering on zoom
    self.lastBusArray = busArray;

    // Render buses
    self.adjustItemsOnMap(1);
  });
};

lm.App.prototype.getStopPredictions = function(stopObj){
  var query = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni',
      map = this.map,
      route,
      self = this;

  this.lastRouteArray = [];
  this.lastStopObjArray = [];

  for(var routeAndDirTag in stopObj){
    this.lastRouteArray.push(routeAndDirTag);
    route = routeAndDirTag.slice(0,routeAndDirTag.indexOf(':'));
    query+='&stops='+route+'|'+stopObj[routeAndDirTag].user.stopTag+'&stops='+route+'|'+stopObj[routeAndDirTag].dest.stopTag;
  }
  console.log('calling stops');
  d3.xhr(query, function(err, res){
    if(err){
      console.log('Prediction error: ',err);
    }

    var doc = new XmlDocument(res.response),
        counter = doc.children.length, // TODO: if 'titles' are distinguished, will need to count childrens' children
        routesCovered = {},
        stop,
        name,
        directionTitle,
        tempArr = [],
        userOrDest;
        console.log(counter+' Predictions returned');

    // TODO: distinguish between different 'titles' per direction
    // e.g. Outbound to Ocean Beach vs Outbound to Richmond
    doc.eachChild(function(child){ // Child is a <prediction stopTag>
      counter--;
      stop = child.attr.stopTag;
      name = child.attr.routeTag;

      if(child.children.length > 0){ 
        directionTitle = child.children[0].attr.title;
      // Child.children is a <direction "Inbound to Downtown"> OR a <message text="Stop discontinued. Use pole stop closer to intersection."/>
        if(child.children[0].name !== 'message'){
          var minutes = child.children[0].children[0].attr.minutes; // Child.children.children is the soonest <prediction minutes dirTag>
          var dirTag = child.children[0].children[0].attr.dirTag;
          // Protection against dirTags we do not have
          if(stopObj[name+':'+dirTag]){
            userOrDest = stopObj[name+':'+dirTag].dest.stopTag === stop ? 'dest' : 'user';
            lat = stopObj[name+':'+dirTag][userOrDest].lonlat[1];
            lon = stopObj[name+':'+dirTag][userOrDest].lonlat[0];
            color = stopObj[name+':'+dirTag][userOrDest].color;
            oppositeColor = stopObj[name+':'+dirTag][userOrDest].oppositeColor;
            stopLongName = stopObj[name+':'+dirTag][userOrDest].stopName; // TODO: use or delete
            // self.lastStopObjArray.push({ lat: lat, lon: lon, minutes: minutes, route: name, userOrDest: userOrDest, color: color, oppositeColor: oppositeColor });
            routesCovered[name+':'+dirTag] = routesCovered[name+':'+dirTag] || [];
            routesCovered[name+':'+dirTag].push({ dirTitle: directionTitle, lat: lat, lon: lon, minutes: minutes, route: name, userOrDest: userOrDest, color: color, oppositeColor: oppositeColor });
          }
        }
      } else if(child.name === 'predictions' && child.attr.dirTitleBecauseNoPredictions){
        // self.lastStopObjArray.push({ lat: lat, lon: lon, minutes: '?', route: name, userOrDest: userOrDest, color: color, oppositeColor: oppositeColor });
        directionTitle = child.attr.dirTitleBecauseNoPredictions;
        // routesCovered[stopObj[name].direction] = routesCovered[stopObj[name].direction] || [];
        tempArr.push({ dirTitle: directionTitle, minutes: '?', route: name });
      }
    

      if(counter === 0){
        // Try to find matches for stops without predictions, to determine if they should be on map
        for(var i = 0; i<tempArr.length; i++){
          for(var key in routesCovered){
            if(key.slice(0,key.indexOf(':')) === tempArr[i].route && routesCovered[key].length < 2 && routesCovered[key][0].dirTitle === tempArr[i].dirTitle){
              var pushObj = tempArr[i];
              userOrDest = routesCovered[key][0].userOrDest === 'user' ? 'dest' : 'user';
              pushObj.userOrDest = userOrDest;
              pushObj.lat = stopObj[key][userOrDest].lonlat[1];
              pushObj.lon = stopObj[key][userOrDest].lonlat[0];
              pushObj.color = stopObj[key][userOrDest].color;
              pushObj.oppositeColor = stopObj[key][userOrDest].oppositeColor;
              pushObj.stopLongName = stopObj[key][userOrDest].stopName; // TODO: use or delete
              routesCovered[key].push(pushObj);
            }
          }
        }
        // Push all valid routes to the lastStopObjArray
        lm.config.direction = {};
        for(var routeAndDirTag in routesCovered){
          if(routesCovered[routeAndDirTag].length === 2){
            var temp = routesCovered[routeAndDirTag][0];
            temp.routeAndDirTag = routeAndDirTag;
            self.lastStopObjArray.push(temp);
            temp = routesCovered[routeAndDirTag][1];
            temp.routeAndDirTag = routeAndDirTag;
            self.lastStopObjArray.push(temp);
            lm.config.direction[routeAndDirTag] = true;  
          } else {
            delete routesCovered[routeAndDirTag];
          }
        }
        // console.log('lm config',lm.config.direction);
        // console.log('Routes and directions covered: ',routesCovered);
        // console.log('lastStopObjArray',self.lastStopObjArray);
        // console.log('stopobj for refresh',stopObj);
        self.adjustItemsOnMap(1);
        self.fetchAndRenderVehicles();
        setTimeout(function(){self.getStopPredictions(stopObj);}, 30000);
        map.routesNotRendered && map.getRouteObjFromServer(routesCovered);
      }
    });
  });
};

// Controls flow of item updates
lm.App.prototype.adjustItemsOnMap = function(enableTransitions){
  
  if(this.userloc){
    this.addThings('user',enableTransitions);
  }  
  if(this.destloc){
    this.addThings('dest',enableTransitions); 
  }  
  this.addThings('bus',enableTransitions); 
  this.addThings('stop',enableTransitions);
};

// Adds and updates SVG elements above map
lm.App.prototype.addThings = function(type, enableTransitions){
  var self = this,
      svgBind;

  var latLngToPx = function(d) {
    d = new google.maps.LatLng(d.lat, d.lon);
    d = self.map.projection.fromLatLngToDivPixel(d);

    // This is the DOM element, we slowly change the style
    return d3.select(this)
      .transition().duration(10000*enableTransitions)
      .style('left', (d.x - lm.config.offset) + 'px')
      .style('top', (d.y - lm.config.offset) +  'px');
    };

  // TODO move elsewhere
  var settings = {
    user: {
      r: 10,
      layer: '.userloclayer',
      data: this.userloc,
      svgClass: 'usersvg',
      itemClass: 'user',
      fill: 'yellow'
    },
    dest: {
      r: 10,
      layer: '.destloclayer',
      data: this.destloc,
      svgClass: 'destsvg',
      itemClass: 'dest',
      fill: 'yellow'
    },
    bus: {
      r: 8,
      layer: '.toplayer',
      data: this.lastBusArray,
      svgClass: 'busContainer',
      itemClass: 'bus'
    },
    stop: {
      r: 9,
      layer: '.stoplayer',
      data: this.lastStopObjArray,
      svgClass: 'stopsvg',
      itemClass: 'stop',
      fill: 'white'
    }    
  };

  if(type === 'bus'){
    svgBind = d3.select(settings[type].layer).selectAll('svg')
      .data(settings[type].data, function(d){ return d.id; })
      .each(latLngToPx);

      // TODO: Set timers on all buses so they will remove themselves.
    var exiting = svgBind.exit();

    exiting.selectAll('circle')
      .transition().duration(2000*enableTransitions)
      .style('opacity',0); // Fadeout

    exiting.selectAll('text')
      .transition().duration(2000*enableTransitions)
      .style('opacity',0); // Fadeout

    setTimeout(function(){exiting.remove();},2000*enableTransitions); // Remove after fade    
  
  } else if(type === 'stop'){
    svgBind = d3.select(settings[type].layer).selectAll('svg')
      .data(settings[type].data, function(d){ return d.route+d.userOrDest; })
      .each(latLngToPx);

  } else if(type === 'user' || type === 'dest'){
    svgBind = d3.select(settings[type].layer).selectAll('svg')
      .data(settings[type].data)
      .each(latLngToPx);

  } else {
    return;
  }

  var svg = svgBind.enter().append('svg')
    .each(latLngToPx)
    .attr('class',settings[type].svgClass);

    // TODO: align width with text elements
  if(type === 'stop'){
    svg.append('rect')
      .attr('x',10)
      .attr('y',5)
      .attr('width',46)
      .attr('height',10)
      .style('fill','black');
  }

  var circ = svg.append('circle')
    .attr('r', settings[type].r)
    .attr('cx',10)
    .attr('cy',10)
    .attr('class',settings[type].itemClass);
  
  if(type === 'user'){
    svg.append('text')
    .attr('dy', '.31em')
    .attr('y',9)
    .attr('x',1)
    .text('You');
  }
  if(type === 'dest'){
    svg.append('text')
    .attr('dy', '.31em')
    .attr('y',9)
    .attr('x',0)
    .text('Dest');    
  }
  if(type === 'bus'){
    circ.transition().duration(2000)
    .style('fill-opacity',0.9)
    .style('fill',function(d){return self.map.allRouteColors[d.routeTag].color; });

    svg.append('text')
      .attr('x',lm.config.offset/2)
      .attr('y',lm.config.offset)
      .attr('dy', '.31em')
      .style('fill',function(d){ return self.map.allRouteColors[d.routeTag].oppcolor; })
      .text(function(d){return d.routeTag;});
  } else if(type === 'stop') {
    circ.style('fill',function(d){ return d.color; });
  } else {
    circ.style('fill',settings[type].fill);
  }

// rect.append
// also try using .each(d){ this.node() } and offsetwidth
  if(type === 'stop'){
    svg.append('text')
      .attr('x',23)
      .attr('y',10)
      .attr('dy', '.31em')
      .attr('fill','white')
      .attr('class','timetext');

    // TODO: have dest stops display time until nearest USER bus reaches them
    var timeleft = d3.selectAll('.timetext')
      .data(settings[type].data, function(d){ return d.route+d.userOrDest; });
      
    timeleft.text(function(d){
      if(d.userOrDest === 'user'){
        if(d.minutes === '?'){
          return '???';
        } else {
        return d.minutes+' min';
        }
      } else { 
        return 'end';
      }
    });

    timeleft.style('fill',function(d){
      if(d.minutes === '?'){
        return 'red';
      }
    });

    svg.append('text')
      .attr('x',3)
      .attr('y',10)
      .attr('dy', '.31em')
      .attr('textLength','15px') // TODO: fix centering
      .attr('lengthAdjust','spacing') // TODO: fix centering
      .style('fill', function(d){ return d.oppositeColor; })
      .text(function(d){ return d.route; });
  }
};;lm.Map = function(config) {
  var self = this;
  this.allRouteColors = {"1":{"color":"cc6600","oppcolor":"000000"},"2":{"color":"000000","oppcolor":"ffffff"},"3":{"color":"339999","oppcolor":"000000"},"5":{"color":"666699","oppcolor":"ffffff"},"6":{"color":"996699","oppcolor":"000000"},"9":{"color":"889944","oppcolor":"000000"},"10":{"color":"b07d00","oppcolor":"000000"},"12":{"color":"b07d00","oppcolor":"000000"},"14":{"color":"339999","oppcolor":"000000"},"17":{"color":"003399","oppcolor":"ffffff"},"18":{"color":"996699","oppcolor":"000000"},"19":{"color":"000000","oppcolor":"ffffff"},"21":{"color":"660000","oppcolor":"ffffff"},"22":{"color":"ff6633","oppcolor":"000000"},"23":{"color":"b07d00","oppcolor":"000000"},"24":{"color":"996699","oppcolor":"000000"},"27":{"color":"660099","oppcolor":"ffffff"},"28":{"color":"000000","oppcolor":"ffffff"},"29":{"color":"ff6633","oppcolor":"000000"},"30":{"color":"990099","oppcolor":"ffffff"},"31":{"color":"339999","oppcolor":"000000"},"33":{"color":"660000","oppcolor":"ffffff"},"35":{"color":"ff6633","oppcolor":"000000"},"36":{"color":"003399","oppcolor":"ffffff"},"37":{"color":"000000","oppcolor":"ffffff"},"38":{"color":"ff6633","oppcolor":"000000"},"39":{"color":"ff6633","oppcolor":"000000"},"41":{"color":"b07d00","oppcolor":"000000"},"43":{"color":"006633","oppcolor":"ffffff"},"44":{"color":"ff6633","oppcolor":"000000"},"45":{"color":"006633","oppcolor":"ffffff"},"47":{"color":"667744","oppcolor":"ffffff"},"48":{"color":"cc6600","oppcolor":"000000"},"49":{"color":"b07d00","oppcolor":"000000"},"52":{"color":"889944","oppcolor":"000000"},"54":{"color":"cc0033","oppcolor":"ffffff"},"56":{"color":"990099","oppcolor":"ffffff"},"59":{"color":"cc3399","oppcolor":"ffffff"},"60":{"color":"4444a4","oppcolor":"ffffff"},"61":{"color":"9ac520","oppcolor":"000000"},"66":{"color":"666699","oppcolor":"ffffff"},"67":{"color":"555555","oppcolor":"ffffff"},"71":{"color":"667744","oppcolor":"ffffff"},"88":{"color":"555555","oppcolor":"ffffff"},"90":{"color":"660000","oppcolor":"ffffff"},"91":{"color":"667744","oppcolor":"ffffff"},"108":{"color":"555555","oppcolor":"ffffff"},"F":{"color":"555555","oppcolor":"ffffff"},"J":{"color":"cc6600","oppcolor":"000000"},"KT":{"color":"cc0033","oppcolor":"ffffff"},"L":{"color":"660099","oppcolor":"ffffff"},"M":{"color":"006633","oppcolor":"ffffff"},"N":{"color":"003399","oppcolor":"ffffff"},"NX":{"color":"006633","oppcolor":"ffffff"},"1AX":{"color":"990000","oppcolor":"ffffff"},"1BX":{"color":"cc3333","oppcolor":"ffffff"},"5L":{"color":"666699","oppcolor":"ffffff"},"8X":{"color":"996699","oppcolor":"000000"},"8AX":{"color":"996699","oppcolor":"000000"},"8BX":{"color":"996699","oppcolor":"000000"},"9L":{"color":"889944","oppcolor":"000000"},"14L":{"color":"009900","oppcolor":"ffffff"},"14X":{"color":"cc0033","oppcolor":"ffffff"},"16X":{"color":"cc0033","oppcolor":"ffffff"},"28L":{"color":"009900","oppcolor":"ffffff"},"30X":{"color":"cc0033","oppcolor":"ffffff"},"31AX":{"color":"990000","oppcolor":"ffffff"},"31BX":{"color":"cc3333","oppcolor":"ffffff"},"38AX":{"color":"990000","oppcolor":"ffffff"},"38BX":{"color":"cc3333","oppcolor":"ffffff"},"38L":{"color":"009900","oppcolor":"ffffff"},"71L":{"color":"009900","oppcolor":"ffffff"},"76X":{"color":"009900","oppcolor":"ffffff"},"81X":{"color":"cc0033","oppcolor":"ffffff"},"82X":{"color":"cc0033","oppcolor":"ffffff"},"83X":{"color":"cc0033","oppcolor":"ffffff"},"K OWL":{"color":"198080","oppcolor":"ffffff"},"L OWL":{"color":"330066","oppcolor":"ffffff"},"M OWL":{"color":"004d19","oppcolor":"ffffff"},"N OWL":{"color":"001980","oppcolor":"ffffff"},"T OWL":{"color":"001980","oppcolor":"ffffff"}}; 
  this.routesNotRendered = true;

  // Create the map
  var map = this.gMap = new google.maps.Map(document.querySelector(config.el), config);

  // Setup the overlay
  var overlay = this.overlay = new google.maps.OverlayView();

  // Setup the DirectionsService
  var directionsService = this.directionsService = new google.maps.DirectionsService();

  // calleded when the position from projection.fromLatLngToPixel() would return a new value for a given LatLng
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
  // var userLonLat = [-122.408904,37.783594];  // fake TODO fix
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
    .post(send, this.routify2.bind(this));
};

var glob = {};

lm.Map.prototype.renderEverything = function(){

};

// Routify takes an array of map objects and renders them.
lm.Map.prototype.routify2 = function(err, res){

  if(err) throw err;
  var stopArr, // all stops with the routeAndDirTag
      coord,
      stopRead,
      allRoutes = {},
      endPairs = {}, // obj of route objs containing dest/user lat and lon
      self = this,
      endpointArray = lm.app.lastStopObjArray; // Only routeStops we have predictions for

  for(var j = 0; j<endpointArray.length; j++){
    endPairs[endpointArray[j].routeAndDirTag] = endPairs[endpointArray[j].routeAndDirTag] || {};
    endPairs[endpointArray[j].routeAndDirTag][endpointArray[j].userOrDest] = endpointArray[j];
  }  
  


  try {
    stopArr = JSON.parse(res.responseText);
    this.routesNotRendered = false;
    console.log(stopArr);
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
    } else {
      coord = new google.maps.LatLng(stopArr[i].lonlat[1],stopArr[i].lonlat[0]);
      allRoutes[stopArr[i].routeAndDirTag].stops.push(coord);
    }
  }

  // console.log('allRoutes',allRoutes['2:02_OB3'].stops[0]);
//all routes has color and stops[]

  glob.allRoutes = allRoutes;
  glob.allRoutesKeys = [];
  glob.counter = -1;
  glob.currentItem = 0;
  glob.waypoints = [];
  glob.notDone = true;
  glob.currentLength = 0;
  glob.cont = true;
  glob.currentDirArr = [];
  glob.makeLines = function(){
    if(this.notDone === false && this.counter >= 0){
      this.waypoints = [];
      this.currentItem = 0;
      this.cont = false;
      this.saveTheDir();
    } 
    if(this.counter >= 0 && this.cont === true){
      if(this.waypoints.length > 0){
        this.waypoints = [this.waypoints[this.waypoints.length-1]];
      }
      var currentRoute = this.allRoutes[this.allRoutesKeys[this.counter]];
      this.currentLength = currentRoute.stops.length;
      while(this.waypoints.length < 10 && this.notDone) {
        if(this.currentItem < currentRoute.stops.length) {
          this.waypoints.push({location:currentRoute.stops[this.currentItem], stopover: true});
        } else {
          this.notDone = false;
        }
      }
      if(this.waypoints.length > 0){
        this.addLine(this.waypoints, currentRoute.color);
      }
    }
  };
  glob.addLine = function(waypointArr, linecolor){
    var color = linecolor;
    var request = {
      origin: waypointArr[0].location,
      destination: waypointArr[waypointArr.length-1].location,
      waypoints: waypointArr.slice(1,5), // max is 8 including endpoints. will need to fragment routes                  
      travelMode: google.maps.TravelMode.DRIVING
    };
    this.sendForRender(request);
  };
  glob.sendForRender = function(req){
    var self = this;
    var request = req;
    lm.app.map.directionsService.route(request, function(response, status){
      console.log('status: ',status,' counter: ',self.counter, 'item ',self.currentItem,' of ',self.currentLength);
      if(status == google.maps.DirectionsStatus.OK){
        // Increment item
        self.currentItem++;

        // Save file
        self.currentDirArr.push(response);

        // Keep going
        self.makeLines();

      } else {
        var time = Math.random()*25000;
        console.log('Firing in... ',time/1000,' seconds');
        setTimeout(function(){self.sendForRender(request);},time);
      }
    });
  };
  glob.saveTheDir = function(){
    var xhr = new XMLHttpRequest();
    var self = this;
    var send = {
      routename: this.allRoutesKeys[this.counter],
      dirobjects: []
    };
    send.dirObjects = this.currentDirArr;

    xhr.open("POST", "saveCompleteDir");
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState == 4){
        if(xhr.status == 200){
          console.log('Successfully saved');
          self.currentDirArr = [];
          self.counter--;
          self.cont = true;
          self.notDone = true;
          self.makeLines();
        } else {
          console.log('Node Post failed');
          self.saveTheDir();
        }
      }
    };
    xhr.send(JSON.stringify(send));
  };

  glob.makeLines.bind(glob);
  glob.addLine.bind(glob);
  glob.sendForRender.bind(glob);
  glob.saveTheDir.bind(glob);
  
  for(var routeAndDirTag in allRoutes){
  //   // createPolyline(allRoutes[routeAndDirTag].stops, allRoutes[routeAndDirTag].color);
    glob.allRoutesKeys.push(routeAndDirTag);
    glob.counter++;
  }

  glob.makeLines();


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
