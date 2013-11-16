lm.App = function(config) {
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

  // Add click listeners
  var ul = document.getElementsByTagName('ul');
  ul[0].addEventListener('click', this.navClick, false);
};

lm.App.prototype.navClick = function(e){
  var obj = {
    0: 'first',
    1: 'second',
    2: 'third',
    3: 'fourth' 
  };
  var index = e.srcElement.value || e.target.value;
  console.log(obj[index]);
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

    console.log('rendering buses');
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
      console.error('Prediction error: ',err);
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
  console.log('trans enabled: ',enableTransitions);
  
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
};