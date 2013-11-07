var mapOptions = {
  center: new google.maps.LatLng(37.783, -122.409), //getCenter for NONwrapped LatLon obj
  zoom: 15,
  mapTypeId: google.maps.MapTypeId.ROADMAP
};
var map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);

if(navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position){
    console.log(position);
    var location = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    map.setCenter(location);
  });
}

var removeDirection = '_IB',
    lastTime = 0,
    offset = 12;

// on a click, query the server to find best routes near that area
// may be good to toggle w/ button click on menu
google.maps.event.addListener(map, 'click', function(e) {
  // e.latLng --> e.pixel also available
});

var getRouteData = function(routes){

  var routeArray = [];
  var lineObj = {};
  // stringRoutes comes from stringifiedMuniRoutes.js
  // for (var key in routes){
  var key = 21;
    lineObj = {routename: key, stops: []};
    if(stringRoutes[key]){
      for(var i = 0; i<stringRoutes[key].length; i++){
        if(stringRoutes[key][i].lat && stringRoutes[key][i].lon) {
          lineObj.stops.push({ lat: stringRoutes[key][i].lat, lon: stringRoutes[key][i].lon });
          // very precise data is important to ensure correct google routes
        }
      }
    // }
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
      // bussify(busArray, busLayer, projection);
    });
  };
};

var overlay = new google.maps.OverlayView();

      // called ONCE after overlay.setMap()
overlay.onAdd = function(){
  var busLayer = d3.select(this.getPanes().overlayMouseTarget)
    .append('div')
    .attr('class', 'toplayer');

  var routeLayer = d3.select(this.getPanes().overlayMouseTarget)
    .append('div')
    .attr('class', 'toplayerRoutes');

  var rerender = render(busLayer,routeLayer);

  setInterval(rerender,100000);

  // called when the position from projection.fromLatLngToPixel() would return a new value for a given LatLng.
  overlay.draw = function(){
    rerender();
  };
};

overlay.setMap(map);

