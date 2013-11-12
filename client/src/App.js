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
    self.adjustItemsOnMap(1);
  });
};

lm.App.prototype.getStopPredictions = function(stopObj){
  var query = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni',
      map = this.map,
      self = this;

  this.lastRouteArray = [];
  this.lastStopObjArray = [];

  for(var route in stopObj){
    this.lastRouteArray.push(route); // Filters out nonessential buses in fetchAndRenderVehnicles
    query+='&stops='+route+'|'+stopObj[route].stopTag;
  }

  d3.xhr(query, function(err, res){
    if(err){
      console.log('Prediction error: ',err);
    }

    var doc = new XmlDocument(res.response),
        counter = doc.children.length;
        storage = {};

    doc.eachChild(function(child){
      counter--;

      if(child.children.length > 0){
        if(child.children[0].name !== 'message'){
          var name = child.attr.routeTag,
              lat = stopObj[name].lonlat[1], 
              lon = stopObj[name].lonlat[0],
              minutes = child.children[0].children[0].attr.minutes;

          storage[name] = true;
          self.lastStopObjArray.push({ lat: lat, lon: lon, minutes: minutes, route: name });
          // Could send route requests individually here, but db connection might get overloaded
        }
      }

      if(counter === 0){
        self.adjustItemsOnMap(0);
        setTimeout(function(){self.getStopPredictions(stopObj);}, 30000);
        map.routesNotRendered && map.getRoutesFromServer(Object.keys(storage));
      }
    });
  });
};

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
      layer: '.userloclayer',
      data: this.userloc,
      svgClass: 'usersvg',
      itemClass: 'user',
      fill: 'blue'
    },
    dest: {
      layer: '.destloclayer',
      data: this.destloc,
      svgClass: 'destsvg',
      itemClass: 'dest',
      fill: 'red'
    },
    bus: {
      layer: '.toplayer',
      data: this.lastBusArray,
      svgClass: 'busContainer',
      itemClass: 'bus'
    },
    stop: {
      layer: '.stoplayer',
      data: this.lastStopObjArray,
      svgClass: 'stopsvg',
      itemClass: 'stop',
      fill: 'yellow'
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
      .data(settings[type].data, function(d){ return d.route; })
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
      .attr('width',40)
      .attr('height',10)
      .style('fill','black');
  }

  var circ = svg.append('circle')
    .attr('r', 9)
    .attr('cx',10)
    .attr('cy',10)
    .attr('class',settings[type].itemClass);
  
  if(type === 'bus'){
    circ.style('fill-opacity',0.7)
    .style('stroke-width','1.5px')
    .style('fill',function(){return '#'+(~~(Math.random()*(1<<24))).toString(16);}); //colors

    svg.append('text')
      .attr('x',lm.config.offset/2)
      .attr('y',lm.config.offset)
      .attr('dy', '.31em')
      .attr('fill','black')
      .text(function(d){return d.routeTag;});
  
  } else {
    circ.style('fill',settings[type].fill);
  }

  if(type === 'stop'){
    svg.append('text')
      .attr('x',20)
      .attr('y',10)
      .attr('dy', '.31em')
      .attr('fill','white')
      .attr('class','timetext');

    var timeleft = d3.selectAll('.timetext')
      .data(settings[type].data, function(d){ return d.route; });
      
    timeleft.text(function(d){ return d.minutes+' min';});

    svg.append('text')
      .attr('x',4)
      .attr('y',10)
      .attr('dy', '.31em')
      .attr('fill','black')
      .text(function(d){ return d.route; });
    }
};