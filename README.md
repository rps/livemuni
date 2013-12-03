Livemuni
=========

Livemuni is a realtime visual bus tracking app.

  - Click on your destination location
  - Nearby bus routes and stops are rendered with stops near your destination
  - Stop arrival times are updated as buses approach
  - Monitor bus locations as they approach the stop
  - Refresh your location if you're on the move

> Livemuni allows transit riders to make informed decisions about their choice of Muni bus.

Version
----

0.8

Tech Stack
-----------

Livemuni uses a number of (usually) open source projects to work properly:

* [D3] - data binding and visualization
* [node.js] - evented I/O for the backend
* [Express] - fast node.js network app framework
* [MongoDB] - nosql database with geospatial querying
* [Google Maps] - map, scaling & traffic laws
* [NextBus] - raw gps data

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

  [node.js]: http://nodejs.org
  [express]: http://expressjs.com
  [D3]: http://d3js.org/
  [MongoDB]: http://www.mongodb.org/
  [Google Maps]: https://developers.google.com/maps/
  [NextBus]: http://www.nextbus.com/xmlFeedDocs/NextBusXMLFeed.pdf
  [CC BY-SA-NC]: http://creativecommons.org/licenses/by-nc-sa/3.0/us/
 