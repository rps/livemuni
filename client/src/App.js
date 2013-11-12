lm.App = function(config) {
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
  this.fetchAndRenderVehicles();

  // Start polling
  setInterval(this.fetchAndRenderVehicles.bind(this), 10000);
};

lm.App.prototype.set = function(variable, value){
  this[variable] = value;
};

lm.App.prototype.fetchAndRenderVehicles = function() {
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
  var query = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni';
  var map = this.map;
  var self = this;
  this.lastRouteArray = [];

  for(var route in stopObj){
    this.lastRouteArray.push(route);
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
      // dirObj = this.lastStopObj,
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
    .style('fill','black');  
}  

/************* 
  B u s s e s 
**************/

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
};