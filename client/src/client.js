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
    direction: {}
  },
  init: function() {
    // Start app
    lm.app = new lm.App(lm.config);
  },
  hasDirection: function(key, dir){
    return this.config.direction[key] && this.config.direction[key][dir] !== undefined;
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
};