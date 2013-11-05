var mapOptions = {
  center: new google.maps.LatLng(37.783, -122.409), //getCenter for NONwrapped LatLon obj
  zoom: 15,
  mapTypeId: google.maps.MapTypeId.ROADMAP
};
var map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
var overlay = new google.maps.OverlayView();

overlay.draw = function(){

};
// called ONCE after overlay.setMap()
overlay.onAdd = function(){
  this.draw();
  getGeo(true, this);

  var busLayer = d3.select(this.getPanes().overlayMouseTarget)
    .append('div')
    .attr('class', 'toplayer');

  var routeLayer = d3.select(this.getPanes().overlayMouseTarget)
    .append('div')
    .attr('class', 'toplayerRoutes');

  var clickLayer = d3.select(this.getPanes().overlayMouseTarget)
    .append('div')
    .attr('class', 'clicklayer');

  var userLocLayer = d3.select(this.getPanes().overlayMouseTarget)
    .append('div')
    .attr('class', 'userloclayer');

  var stopLayer = d3.select(this.getPanes().overlayMouseTarget)
    .append('div')
    .attr('class', 'stoplayer');

  var rerender = render(busLayer,routeLayer);

  setInterval(rerender,10000);

  // called when the position from projection.fromLatLngToPixel() would return a new value for a given LatLng.
  // overlay.draw = function(){
  //   rerender();
  // };

};

google.maps.event.addListenerOnce(map, 'idle', function(){
  overlay.setMap(map);
});

var getGeo = function(highAccuracy, sharedOverlay){
  console.log('high accuracy: ',highAccuracy);
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position){
        waitForClick(position, sharedOverlay);
      },
      function(err){
        if(err.code === 3){
          console.log('no high accuracy');
          getGeo(false, sharedOverlay);
        } else {
        console.log('Please enable GPS.');
        }
      },
      { enableHighAccuracy: highAccuracy }
    );
  }
};


var waitForClick = function(userPosition, sharedOverlay){
  // var userLonLat = [userPosition.coords.longitude, userPosition.coords.latitude]; // not accurate in browser, may be accurate in phone
  userPosition = {coords:{latitude:37.783594,longitude: -122.408904}}; // fake
  var userLonLat = [-122.408904,37.783594]; // fake
  var userMapLatLng = new google.maps.LatLng(userLonLat[1],userLonLat[0]);
  addPointToMap(userMapLatLng, '.userloclayer', 'usersvg', 'user', 'blue', sharedOverlay);
  var location = new google.maps.LatLng(userPosition.coords.latitude, userPosition.coords.longitude);
  map.setCenter(location);

  // may be good to toggle w/ button click on menu
  google.maps.event.addListener(map, 'click', function(e) {
    var destLonLat = [e.latLng.mb, e.latLng.lb];
    addPointToMap(e.latLng, '.clicklayer','clicksvg','dest', 'black', sharedOverlay);
    sendCoordsToServer(userLonLat, destLonLat, sharedOverlay);
  });
};

var addPointToMap = function(latLng, selectClassWithDot, clickClass, circleClass, circleColor, sharedOverlay, text){
  console.log('adding');

  var pixelData = sharedOverlay.getProjection().fromLatLngToDivPixel(latLng);

  var svgBind = d3.select(selectClassWithDot).selectAll('svg')
    .data([pixelData]);

  var svg = svgBind.enter().append('svg')
    .style('top',function(d){ return d.y-10; }) // why doesn't map clickevent pixel loc work?
    .style('left',function(d){ return d.x-10; })
    .attr('class',clickClass);

  var circ = svg.append('circle')
    .attr('r', 8)
    .attr('cx',10)
    .attr('cy',10)
    .attr('class',circleClass)
    .style('fill',circleColor);

  if(text){
    var timeLeft = svg.append('text')
      .attr('x',offset/2)
      .attr('y',offset)
      .attr('dy', '.31em')
      .attr('fill','black')
      .text(text);
  }
};

var addPointsToMap = function(dirObj, selectClassWithDot, clickClass, circleClass, circleColor, sharedOverlay){
  console.log('adding');

  var allPixelData = [];
  for (var key in dirObj){
    if(key !== 'counter'){
      var tempdata = sharedOverlay.getProjection().fromLatLngToDivPixel(dirObj[key].latLng);
      allPixelData.push({x:tempdata.x, y:tempdata.y, route: key, time: dirObj[key].minutes});
    }
  }

  var svgBind = d3.select(selectClassWithDot).selectAll('svg')
    .data(allPixelData, function(d){ return d.route; });

  var svg = svgBind.enter().append('svg')
    .style('top',function(d){ return d.y-10; }) // why doesn't map clickevent pixel loc work?
    .style('left',function(d){ return d.x-10; })
    .attr('class',clickClass);

  var rect = svg.append('rect')
    .attr('x',10)
    .attr('y',5)
    .attr('width',40)
    .attr('height',10)
    .style('fill','black');

  var circ = svg.append('circle')
    .attr('r', 8)
    .attr('cx',10)
    .attr('cy',10)
    .attr('class',circleClass)
    .style('fill',circleColor);

  var timeLeft = svg.append('text')
    .attr('x',20)
    .attr('y',10)
    .attr('dy', '.31em')
    .attr('fill','white')
    .text(function(d){ return d.time+' min';});

  var routename = svg.append('text')
    .attr('x',4)
    .attr('y',10)
    .attr('dy', '.31em')
    .attr('fill','black')
    .text(function(d){ return d.route; });
};

var getStopPredictions = function(stopObj, sharedOverlay){
  console.log('GETTING PREDICTIONS')
  var query = 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictionsForMultiStops&a=sf-muni';
  for(var route in stopObj){
    query+='&stops='+route+'|'+stopObj[route].stopTag;
  }
  console.log(query);
  d3.xhr(query, function(err, res){
    if(err){
      console.log('Prediction error: ',err);
    }
    var doc = new XmlDocument(res.response);
    var storage = {counter:doc.children.length, };
    doc.eachChild(function(child){
      console.log(child);
      storage.counter--;
      if(child.children.length > 0){
        var name = child.attr.routeTag;
        var latLng = new google.maps.LatLng(stopObj[name].lonlat[1], stopObj[name].lonlat[0]);
        var minutes = child.children[0].children[0].attr.minutes;
        storage[name] = {latLng: latLng, minutes: minutes};
      }
      if(storage.counter === 0){
        addPointsToMap(storage, '.stoplayer', 'stopsvg', 'stop', 'yellow', sharedOverlay);
        setTimeout(function(){getStopPredictions(stopObj, sharedOverlay);}, 60000);
      }
        // delete nonessential buses
        // query and render the routes
    });
  });
};

var sendCoordsToServer = function(userLonLat, destLonLat, sharedOverlay){
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "coordinates");
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == 200) {
      console.log('SUCCESS BACK!');
      getStopPredictions(JSON.parse(xhr.responseText), sharedOverlay);
    }
  };
  xhr.send(JSON.stringify([userLonLat, destLonLat]));
};

var removeDirection = '_IB',
    lastTime = 0,
    offset = 12;



var getRouteData = function(routes){

  var routeArray = [];
  var lineObj = {};
  // stringRoutes comes from stringifiedMuniRoutes.js
  for (var key in routes){
  // var key = 21; // temporary limiting variable
    lineObj = {routename: key, stops: []};
    if(stringRoutes[key]){
      for(var i = 0; i<stringRoutes[key].length; i++){
        if(stringRoutes[key][i].lat && stringRoutes[key][i].lon) {
          lineObj.stops.push({ lat: stringRoutes[key][i].lat, lon: stringRoutes[key][i].lon });
          // very precise data is important to ensure correct google routes
        }
      }
    }
    routeArray.push(lineObj);
    lineObj = {};
  }
  return routeArray;
};

var getData = function(bounds, cb){

  d3.xhr('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&t='+lastTime, // last 15min or only new
     function(err,res){

    if(err) {
      console.log('Error: ',err);
    }
    var busArray = [],
        routeArray = [],
        routesOnMap = {};

    var doc = new XmlDocument(res.response);

    /* lat inc away from eq
       lon inc (neg) away from prime merid
       66% reduction in buses when filtering out LatLon */
    for(var i = 0; i<doc.children.length; i++){
      if(doc.children[i].name === 'lastTime'){
        // lastTime = doc.children[i].attr.time; // opportunity for a curried function. This is not compatible with D3.
      }
      if(
        (bounds.ea.d <= Number(doc.children[i].attr.lat) && Number(doc.children[i].attr.lat) <= bounds.ea.b) && // Remove bus markers placed
        (bounds.fa.b <= Number(doc.children[i].attr.lon) && Number(doc.children[i].attr.lon) <= bounds.fa.d) && // outside the screen.
        (doc.children[i].attr.secsSinceReport && doc.children[i].attr.secsSinceReport < 90) &&                  // Remove 90sec old markers.
        (doc.children[i].attr.dirTag && doc.children[i].attr.dirTag.indexOf(removeDirection) === -1)            // Remove wrong direction bus.
      ){
        busArray.push(doc.children[i].attr);
        routesOnMap[doc.children[i].attr.routeTag] = true;
      }
    }
    routeArray = getRouteData(routesOnMap);
    return cb(busArray, routeArray);
  });
};

var routify = function(routeArray, routeLayer, projection){

  /******************************************************************************************************************
                                                         BUS ROUTES ON MAP
  ******************************************************************************************************************/

  var coord;
  var waypoints = [];
  var color = function(){return '#'+(~~(Math.random()*(1<<24))).toString(16);}; // TODO: these are re-rendered constantly. Fix.

  var convert2 = function(route){


    for(var i = 0; i<route.stops.length; i++){
      coord = new google.maps.LatLng(route.stops[i].lat, route.stops[i].lon);
      waypoints.push({location: coord, stopover: true});
      if(waypoints.length === 8){
        var request = {
          origin: waypoints[0].location, // will need to adjust based on inbound/outbound
          destination: waypoints[waypoints.length-1].location,
          waypoints: waypoints.slice(1,5), // max is 8 including endpoints. will need to fragment routes
          travelMode: google.maps.TravelMode.DRIVING
        };
        waypoints = [];
        var directions = new google.maps.DirectionsService();
        directions.route(request, function(response, status){
          if (status == google.maps.DirectionsStatus.OK) {
            var directionsDisplay = new google.maps.DirectionsRenderer({
              map: map,
              preserveViewport: true,
              suppressMarkers: true,
              polylineOptions: {strokeColor: 'black', strokeWeight: 5}
            });
            directionsDisplay.setDirections(response);
          }
        });
      }
    }
  };

  routeArray.forEach(convert2);

};

var bussify = function(busArray, busLayer, projection){

  /*************************************************************************************************************************************
                                                        BUS MARKERS ON MAP
  *************************************************************************************************************************************/

  //create SVG containers
  var busContainer = busLayer.selectAll('.busContainer') // select all svg elements
    .data(busArray, function(d){ return d.id; })
    .each(convert);

  var svgs = busContainer.enter().append('svg')
    .each(convert)
    .attr('class','busContainer');

  busContainer.exit().remove();

  var circle = svgs.append('circle')
    .attr('r', 8)
    .attr('cx',offset)
    .attr('cy',offset)
    .attr('class','bus')
    .style('fill',function(){return '#'+(~~(Math.random()*(1<<24))).toString(16);}); //colors

  var text = svgs.append('text')
    .attr('x',offset/2)
    .attr('y',offset)
    .attr('dy', '.31em')
    .attr('fill','black')
    .text(function(d){return d.routeTag;});

    // not included
    // .filter(function(d){ if(d.dirTag){ return d.dirTag.indexOf('_IB') > -1} else { return false } })
    // .remove()

  function convert(d){
    d = new google.maps.LatLng(d.lat, d.lon);
    d = projection.fromLatLngToDivPixel(d);
    // this is the DOM element, we slowly change the style
    return d3.select(this)
        .transition().duration(10000)  //.delay(function(d,i){return Math.min(i*50,5000)})
        .style('left', (d.x - offset) + 'px')
        .style('top', (d.y - offset) +  'px');
  }
};

var render = function(busLayer,routeLayer){
  var projection = overlay.getProjection();
  return function(){
    getData(map.getBounds(), function(busArray, routeArray){
      routify(routeArray, routeLayer, projection);
      bussify(busArray, busLayer, projection);
    });
  };
};


