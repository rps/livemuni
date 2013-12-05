LiveMuni
=========

LiveMuni is a realtime visual bus tracking app. See it live at [LiveMuni.org].

  - Click on your destination location
  - Nearby bus routes and stops are shown with stops near your destination
  - Stop arrival times are updated as buses approach
  - Monitor bus locations as they approach the stop
  - Refresh your GPS location if you're on the move

> LiveMuni empowers transit riders to make informed decisions about their choice of Muni bus.

Version
----

0.9

Screenshot
-----------

![screenshot](http://rps.github.io/livemuni/screenshot.png)

Tech Stack
-----------

LiveMuni requires a number of open source projects to work properly:

* [D3] - Data binding and visualization
* [node.js] - Evented I/O for the backend
* [Express] - Fast node.js network app framework
* [MongoDB] - NoSQL database with geospatial querying
* [Google Maps] - Map, scaling & traffic laws
* [NextBus] - Raw GPS data

Installation
--------------

```sh
git clone https://github.com/rps/livemuni
cd livemuni
npm install
grunt
```

License
----
[CC BY-SA-NC]

  [LiveMuni.org]: http://livemuni.org
  [node.js]: http://nodejs.org
  [express]: http://expressjs.com
  [D3]: http://d3js.org/
  [MongoDB]: http://www.mongodb.org/
  [Google Maps]: https://developers.google.com/maps/
  [NextBus]: http://www.nextbus.com/xmlFeedDocs/NextBusXMLFeed.pdf
  [CC BY-SA-NC]: http://creativecommons.org/licenses/by-nc-sa/3.0/us/
 