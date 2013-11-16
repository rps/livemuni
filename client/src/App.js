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

  // Always pulls last 15m.
  d3.xhr(url+'0', function(err,res){
    if(err) {
      console.error('Error: ',err);
      return;
    }
    var busArray = [],
        dir = '',
        doc = new XmlDocument(res.response);

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
  d3.xhr(query, function(err, res){
    if(err){
      console.error('Prediction error: ',err);
    }

    var doc = new XmlDocument(res.response),
        counter = doc.children.length,
        routesCovered = {},
        stop,
        name,
        directionTitle,
        tempArr = [],
        userOrDest;

    doc.eachChild(function(child){ // Child is a <prediction stopTag>
      counter--;
      stop = child.attr.stopTag;
      name = child.attr.routeTag;

      // Child.children is a <direction "Inbound to Downtown"> 
      // OR a <message text="Stop discontinued. Use pole stop closer to intersection."/>
      if(child.children.length > 0){ 
        directionTitle = child.children[0].attr.title;
        
        if(child.children[0].name !== 'message'){
          // Child.children.children is the soonest <prediction minutes dirTag>
          var minutes = child.children[0].children[0].attr.minutes;
          var dirTag = child.children[0].children[0].attr.dirTag;
          
          // Protection against dirTags we do not have
          if(stopObj[name+':'+dirTag]){
            userOrDest = stopObj[name+':'+dirTag].dest.stopTag === stop ? 'dest' : 'user';
            lat = stopObj[name+':'+dirTag][userOrDest].lonlat[1];
            lon = stopObj[name+':'+dirTag][userOrDest].lonlat[0];
            color = stopObj[name+':'+dirTag][userOrDest].color;
            oppositeColor = stopObj[name+':'+dirTag][userOrDest].oppositeColor;
            stopLongName = stopObj[name+':'+dirTag][userOrDest].stopName;
            routesCovered[name+':'+dirTag] = routesCovered[name+':'+dirTag] || [];
            routesCovered[name+':'+dirTag].push({ dirTitle: directionTitle, lat: lat, lon: lon, minutes: minutes, route: name, userOrDest: userOrDest, color: color, oppositeColor: oppositeColor });
          }
        }
      } else if(child.name === 'predictions' && child.attr.dirTitleBecauseNoPredictions){
        directionTitle = child.attr.dirTitleBecauseNoPredictions;
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
              pushObj.stopLongName = stopObj[key][userOrDest].stopName;
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

  if(type === 'stop'){
    svg.append('text')
      .attr('x',23)
      .attr('y',10)
      .attr('dy', '.31em')
      .attr('fill','white')
      .attr('class','timetext');

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
      .attr('textLength','15px')
      .attr('lengthAdjust','spacing')
      .style('fill', function(d){ return d.oppositeColor; })
      .text(function(d){ return d.route; });
  }
};
