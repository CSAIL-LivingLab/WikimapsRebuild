
// set up the Leaflet map
var map = L.map('map').setView([42.3595462, -71.093284], 17);

L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    id: 'examples.map-i875mjb7'
}).addTo(map);

// define the ESPG:26786 projection for proj4
proj4.defs('EPSG:26786', "+proj=lcc +lat_1=41.71666666666667 +lat_2=42.68333333333333 +lat_0=41 +lon_0=-71.5 +x_0=182880.3657607315 +y_0=0 +ellps=clrk66 +datum=NAD27 +to_meter=0.3048006096012192 +no_defs");



getRoute = function() {
    // This gets results from the routing server when
    // the user clicks the "Route" button

    var from = $("#from_field").val().toUpperCase();
    var to = $("#to_field").val().toUpperCase();
    var route;

    routeURL = 'http://wikimap.csail.mit.edu/cgi-bin/route.xml?' + from + '+' + to + '+debug';
    // directURL = 'http://wikimap.csail.mit.edu/cgi-bin/directions.xml?';
    // spaceURL = 'http://wikimap.csail.mit.edu/cgi-bin/space.xml?';
    // roomURL = 'http://wikimap.csail.mit.edu/cgi-bin/room.xml?', '+', '+';
    // proxURL = 'http://wikimap.csail.mit.edu/cgi-bin/proximity.xml?', '+', '+', '+', '+';

    // replace with stock xml file for now, to avoid XSS restrictions
    // to enable, launch $./Google\ Chrome --allow-file-access-from-files
    $.ajax({
        url: 'file:///Users/arcarter/code/MapsRebuild/route.xml%3FW84-102+1-190+debug.xml',
        context: null,
        dataType: "xml",
    }).done(function(xml) {
        parseAndMapRoute(xml, mapRoute);
    });
}

var latlngs = [];
var mapRoute = function(route) {
    // convert the route coordinates to Lat, Lon
    // plot them to the map
    // var marker = L.marker([42.36253, -71.09148]).addTo(map);
    // var marker2 = L.marker([-71.09148, 42.36253]).addTo(map);

    // [[lat, lon], [lat, lon]]
    latlngs = Route.convert(route.path);

    // convert to latLngAray to leaflet [LatLng]
    // var latlng = L.latLng(50.5, 30.5);
    for (i = 0; i< latlngs.length; i++) {
        lat = latlngs[i][0];
        lng = latlngs[i][1];

        latlngs[i] = L.latLng(lat, lng);
    }

    // create the line
    // L.polyline(latlngs, {color: 'red'}).addTo(map);
    console.log("foo");

    // zoom the map to the polyline
    // map.fitBounds(polyline.getBounds());
    
    // return latlngs;
}


var parseAndMapRoute = function(result, callback) {
    // 1) Returns a route object, which contains points for the user to walk on.
    // 2) If spaces are available, creates an array of spaces (rooms) which are along the route.
    //     2.1) All rooms are divided into triangles.
    //     2.2) Spaces are contained within the route object.

    var spaces = [];
    var route = new Route;
    var xmlDoc = result.firstChild;

    // routeNode wraps all points. In the <route> tag are from, to and type of transport
    routeNode = xmlDoc.getElementsByTagName("route").item(0);

    // from, to, and type
    route.from = routeNode.getAttribute("from");
    route.to = routeNode.getAttribute("to");
    route.type = routeNode.getAttribute("type");

    // cycle through points and add them to the path.
    var i = 0;
    while (pointNode = routeNode.getElementsByTagName("point").item(i++)) {
        var x = Number(pointNode.getAttribute("x"));
        var y = Number(pointNode.getAttribute("y"));
        route.path.push([x, y]);
    }

    // --- Space parsing begins. ---

    // cycle through each space, unpacking it
    // <space> nodes appear in the xml when debug is enabled.
    var i = 0;
    while (spaceNode = xmlDoc.getElementsByTagName("space").item(i++)) {

        // make a new space and name it
        var space = new Space();
        space.name = spaceNode.getAttribute("name");

        // get the space's centroid and corodinates
        centroidNode = spaceNode.getElementsByTagName("centroid").item(0);
        var x = Number(centroidNode.getAttribute("x"));
        var y = Number(centroidNode.getAttribute("y"));
        space.centroid = [x, y];

        // get the contours of the space
        contourNode = spaceNode.getElementsByTagName("contour").item(0);
        var j = 0;
        while (contourNode && (pointNode = contourNode.getElementsByTagName("point").item(j++))) {
            var x = Number(pointNode.getAttribute("x"));
            var y = Number(pointNode.getAttribute("y"));

            space.contour.push([x, y]);
        }

        // get the triangulation of the space. Use the existing Space object to hold it.
        triangulationNode = spaceNode.getElementsByTagName("triangulation").item(0);
        j = 0;
        var triangle = new Space();
        while (triangulationNode && (pointNode = triangulationNode.getElementsByTagName("point").item(j++))) {
            x = Number(pointNode.getAttribute("x"));
            y = Number(pointNode.getAttribute("y"));
            triangle.contour.push([x, y]);

            // triangles only have three points
            // every third one, create a new triangle
            if (j % 3 == 0) {
                // not sure what the below line is about yet.
                triangle.contour.push(triangle.contour[0]);
                space.triangulation.push(triangle);
                triangle = new Space();
            }
        }

        route.spaces.push(space);
    }

    callback(route);
}


Route = function(from, to, type) {
    // route object (for users to walk on)

    var that = {};

    that.from = from;
    that.to = to;
    that.type = type;

    // array of points composing a path
    that.path = [];

    // array of spaces contained in the route
    // typically not populated unless debug mode is on
    that.spaces = []

    return that;

};

Route.convert = function(arr) {
    // class level method
    // converts an array of points from MaSP to Lat/Lon
    // assumes an array of [[x, y], [x, y]]
    // returns [[lat, lon], [lat, lon]];
    conversionArr = [];
    for (var i = 0; i< arr.length; i++) {
            x = arr[i][0];
            y = arr[i][1];

            latLng = proj4("EPSG:26786", "WGS84", [y, x]);
            conversionArr.push(latLng);
        };
    return conversionArr;
    };


Space = function(name) {
    // space object (for rooms/triangles)
    this.name = name;
    this.color = "#FF0000";

    // x and y of the centroid
    this.centroid = [];

    // array of x and y coordinates defining corners
    this.contour = [];

    // array of triangles dividing the space
    this.triangulation = [];
};

