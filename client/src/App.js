lm.App = function(config) {
  this.lastTime = 0;
  this.lastBusArray = [];
  this.lastRouteArray = [];
  this.lastStopObjArray = [];
  this.userloc;
  this.destloc;
  this.busIntervalReference;
  this.stopIntervalReference;

  // Check for mobile
  if(screen.width < 800){
    lm.config.mobile = true;
    lm.config.map.zoom = 15;
    lm.config.map.maxZoom = 17;
  } else {
    var point = document.getElementById('pointer');
    var arrowtxt = point.children[0];
    var img = document.createElement('img');
    img.src = 'http://rps.github.io/livemuni/arrow.svg';
    point.insertBefore(img, arrowtxt);
  }

  // Initialize map
  this.map = new lm.Map(lm.util.extend(config.map, {
    ready: this.setupMap.bind(this)
  }));

  // Popup helper bar
  setTimeout(function(){document.getElementById('start').style.height = '30px';}, 4000);  

  // Add click listeners
  var self = this;
  var ul = document.getElementsByTagName('ul');
  ul[0].addEventListener('click', self.manageClick.bind(self), false);
  var slider = document.getElementById('slide');
  slider.addEventListener('click', self.triggerAbout);

  // Hide helper bar
  var anyClick = document.addEventListener('click', function(){
    document.getElementById('start').style.height = '0px';
    document.removeEventListener('click', anyClick, false);
  });  
};

lm.App.prototype.manageClick = function(e){
  var self = this;
  var obj = {
    0: self.clearMap,
    1: self.findUser,
    2: self.startOver,
    3: self.triggerAbout
  };
  var index = e.srcElement.value || e.target.value;
  obj[index].call(this);
};

lm.App.prototype.clearMap = function () {
  this.resetBuses();
  this.findUser(true);
  this.busIntervalReference = -1;
  this.stopIntervalReference = -1;
};

lm.App.prototype.findUser = function (keepUser) {
  this.resetRoutesandStops();
  this.adjustItemsOnMap(0);
  if(keepUser){
    this.map.waitForDestinationClick();
  } else {
    this.map.getGeo(true);
  }
};

lm.App.prototype.resetRoutesandStops = function(){
  this.lastRouteArray = [];
  this.lastStopObjArray = [];
  clearInterval(this.stopIntervalReference);
  this.map.clearLines();
};

lm.App.prototype.resetBuses = function(){
  clearInterval(this.busIntervalReference);
  this.lastBusArray = [];
  this.destloc = [];
  this.map.handlers = false;
};

lm.App.prototype.startOver = function () {
  this.resetBuses();
  this.map.routesNotRendered = true;
  lm.config.direction = {};
  this.map.centerMap([this.userloc[0].lon, this.userloc[0].lat]);
  this.findUser(true);
  this.busIntervalReference = undefined;
  this.stopIntervalReference = undefined;
  this.fetchAndRenderVehicles();
};

lm.App.prototype.triggerAbout = function (argument) {
  var slide = document.getElementById('slide');
  slide.classList.toggle('large');
  slide.classList.toggle('mini');
};

lm.App.prototype.setupMap = function () {
  // Load initial content
  if(!lm.config.mobile){ 
    this.fetchAndRenderVehicles();
  }
};

lm.App.prototype.set = function(variable, value){
  this[variable] = value;
};

lm.App.prototype.fetchAndRenderVehicles = function() {
  if(this.busIntervalReference !== -1){
    // Reset stored map center to reset map drag trigger
    this.map.midpoint = this.map.gMap.getCenter();

    var bounds = this.map.getBounds(),
        southWest = bounds.getSouthWest(),
        northEast = bounds.getNorthEast(),
        projection = this.map.projection,
        self = this,
        url = 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&t=';

    console.log('calling nextbus');
    // Always pulls last 15m. To use self.lastTime with D3, will need to implement websockets.
    d3.xhr(url+'0', function(err,res){
      if(err) {
        console.error('Error: ',err);
        return;
      }
      console.log('nextbus replied');
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

      // Begin polling
      if(!self.busIntervalReference){
        var interval = lm.config.mobile ? 15000 : 10000;
        self.busIntervalReference = setInterval(self.fetchAndRenderVehicles.bind(self), interval);
      }

      console.log('rendering buses');
      // Render buses
      self.adjustItemsOnMap(1);
    });
  }
};

lm.App.prototype.getStopPredictions = function(stopObj){
  if(this.stopIntervalReference !== -1){
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
    console.log(query);
    d3.xhr(query, function(err, res){
      if(err){
        console.error('Prediction error: ',err);
      }
      console.log('sssss',stopObj);
      var doc = new XmlDocument(res.response),
          counter = doc.children.length,
          routesCovered = {},
          stop,
          name,
          directionTitle,
          tempArr = [],
          userOrDest,
          stopObjKeys = [],
          allRouteNames = {};
          
          for(var routeDirKey in stopObj){
            allRouteNames[routeDirKey.slice(0,routeDirKey.indexOf(':'))] = {
              fullDir: stopObj[routeDirKey].dest.fullDirection,
              routeDirKey: routeDirKey
            };
          }
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
            var keyIdentifier;
            if(stopObj[name+':'+dirTag]){
              keyIdentifier = name+':'+dirTag;
            // Fallback in the event that the dirTags do not match but the directions do
            } else if(allRouteNames[name].fullDir === directionTitle){
              keyIdentifier = allRouteNames[name].routeDirKey;
            }
            if(keyIdentifier){
              userOrDest = stopObj[keyIdentifier].dest.stopTag === stop ? 'dest' : 'user';
              lat = stopObj[keyIdentifier][userOrDest].lonlat[1];
              lon = stopObj[keyIdentifier][userOrDest].lonlat[0];
              color = stopObj[keyIdentifier][userOrDest].color;
              oppositeColor = stopObj[keyIdentifier][userOrDest].oppositeColor;
              stopLongName = stopObj[keyIdentifier][userOrDest].stopName; // TODO: use or delete
              // self.lastStopObjArray.push({ lat: lat, lon: lon, minutes: minutes, route: name, userOrDest: userOrDest, color: color, oppositeColor: oppositeColor });
              routesCovered[keyIdentifier] = routesCovered[keyIdentifier] || [];
              routesCovered[keyIdentifier].push({ dirTitle: directionTitle, lat: lat, lon: lon, minutes: minutes, route: name, userOrDest: userOrDest, color: color, oppositeColor: oppositeColor });
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
          self.stopIntervalReference = setTimeout(function(){self.getStopPredictions(stopObj);}, 30000);
          map.routesNotRendered && map.getRouteObjFromServer(routesCovered);
        }
      });
    });
  }
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
      fill: 'yellow',
      ry: 10,
      rx: 10
    },
    dest: {
      r: 10,
      layer: '.destloclayer',
      data: this.destloc,
      svgClass: 'destsvg',
      itemClass: 'dest',
      fill: 'yellow',
      ry: 10,
      rx: 10
    },
    bus: {
      r: 8,
      layer: '.toplayer',
      data: this.lastBusArray,
      svgClass: 'busContainer',
      itemClass: 'bus',
      ry: 10,
      rx: 10
    },
    stop: {
      r: 9,
      layer: '.stoplayer',
      data: this.lastStopObjArray,
      svgClass: 'stopsvg',
      itemClass: 'stop',
      fill: 'white',
      ry: 3,
      rx: 5
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

    svgBind.exit().remove();

  } else if(type === 'user' || type === 'dest'){
    svgBind = d3.select(settings[type].layer).selectAll('svg')
      .data(settings[type].data)
      .each(latLngToPx);

    svgBind.exit().remove();    

  } else {
    return;
  }

  var svg = svgBind.enter().append('svg')
    .each(latLngToPx)
    .attr('class',settings[type].svgClass);

    // TODO: align width with text elements
  if(type === 'stop'){
    svg.append('rect')
      .attr('x',18)
      .attr('y',5.5)
      .attr('width',function(d){
        if(d.userOrDest === 'dest') return 31;
        else if(d.minutes === '?') return 33;
        else if(d.minutes > 9) return 48;
        else return 40;
      })
      .attr('height',11)
      .style('fill','black');
  }

  // var circ = svg.append('circle')
  //   .attr('r', settings[type].r)
  //   .attr('cx',10)
  //   .attr('cy',10)
  //   .attr('class',settings[type].itemClass);
  
  var circ = svg.append('rect')
    .attr('width', function(d){
      if(type === 'bus' && d.routeTag.length > 2) return 19+d.routeTag.length;
      else if (type === 'stop' && d.route.length > 2) return 19+d.route.length;
      else if(type === 'user') return 20;
      else if(type === 'dest') return 24; 
      else return 19;
    })
    .attr('height', 19)
    .attr('x', 2)
    .attr('y', 2)
    .attr('rx',settings[type].rx)
    .attr('ry',settings[type].ry)
    .attr('class',settings[type].itemClass);

  if(type === 'user'){
    svg.append('text')
    .attr('dy', 4)
    .attr('text-anchor','middle')
    .attr('y',lm.config.offset + 1)
    .attr('x',lm.config.offset + 1)
    .text('You');
  }
  if(type === 'dest'){
    svg.append('text')
    .attr('dy', 4)
    .attr('text-anchor','middle')
    .attr('y',lm.config.offset +1)
    .attr('x',lm.config.offset +4)
    .text('Dest');    
  }
  if(type === 'bus'){
    circ.transition().duration(2000)
    .style('fill-opacity', 0.9)
    .style('fill',function(d){return self.map.allRouteColors[d.routeTag].color; });

    svg.append('text')
      .attr('x',function(d){
        if(d.routeTag.length > 2) return lm.config.offset + d.routeTag.length;
        else return lm.config.offset + 1;
      })
      .attr('y',lm.config.offset +1)
      .attr('text-anchor','middle')
      .attr('dy', 4)
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
      .attr('x', 26)
      .attr('y', 11)
      .attr('dy', 4)
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
      } else {
        return 'white';
      }
    });

    svg.append('text')
      .attr('x',function(d){
        if(d.route.length > 2) return lm.config.offset + d.route.length;
        else return lm.config.offset + 1;
      })
      .attr('y',lm.config.offset +1)
      .attr('text-anchor','middle')
      .attr('dy', 4)
      .style('fill', function(d){ return d.oppositeColor; })
      .text(function(d){ return d.route; });
  }
};