// come global vars
WORLD_URL = 'https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
MIT_URL = 'https://maps.mit.edu/pub/rest/services/basemap/WhereIs_Base_Topo/MapServer/tile/{z}/{y}/{x}';
MB_ATTR = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="http://mapbox.com">Mapbox</a>';
MB_URL = 'https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png';
OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
OSM_ATTRIB = '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// set up the Leaflet map
var map = L.map('map').setView([42.361648260887, -71.0905194348], 18);
L.tileLayer(WORLD_URL).addTo(map);
L.tileLayer(MIT_URL).addTo(map);

// define the modified ESPG:26786 projection for proj4
proj4.defs('EPSG:26786', "+proj=lcc +lat_1=41.71666666666667 +lat_2=42.68333333333333 +lat_0=41 +lon_0=-71.5 +x_0=182880.3657607315 +y_0=0 +ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs");

// prevent the form from reloading the page on submission.
$("#route-form").submit(function(e) {
    e.preventDefault();
});


getRoute = function() {
    // This gets results from the routing server when
    // the user clicks the "Route" button

    var from = $("#from_field").val().toUpperCase();
    var to = $("#to_field").val().toUpperCase();
    var route;

    routeURL = '/cgi-bin/route.xml?' + from + '+' + to;
    // directURL = 'http://wikimap.csail.mit.edu/cgi-bin/directions.xml?';
    // spaceURL = 'http://wikimap.csail.mit.edu/cgi-bin/space.xml?';
    // roomURL = 'http://wikimap.csail.mit.edu/cgi-bin/room.xml?', '+', '+';
    // proxURL = 'http://wikimap.csail.mit.edu/cgi-bin/proximity.xml?', '+', '+', '+', '+';

    // replace with stock xml file for now, to avoid mixed content http vs https restrictions
    // to enable, launch $./Google\ Chrome --allow-file-access-from-files
    // route.xml%3FW84-102+1-190+debug.xml
    $.ajax({
        url: routeURL,
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

    // clear existing routes
    proj4.clearPolylines();

    // [[lat, lng], [lat, lng]]
    pathArr = proj4.convertArr(route.path);

    // convert to latLngAray to leaflet [LatLng]
    // var latlng = L.latLng(50.5, 30.5);
    for (var i = 0; i < pathArr.length; i++) {
        lng = pathArr[i][0];
        lat = pathArr[i][1];

        pathArr[i] = L.latLng(lng, lat);
    }

    // create the line and add to map
    var polyline = L.polyline(pathArr, {
        color: 'red'
    }).addTo(map);

    
    // plot the spaces along the route
    for (var i = 0; i < route.spaces.length; i++) {
        // for each space along the route
        space = route.spaces[i];

        // convert to spherical coordinates
        contourArr = proj4.convertArr(space.contour);

        // plot the contour
        var polygon = L.polygon(contourArr).addTo(map);
        polygon.weight = 1;
    }

    // zoom the map to the polyline
    map.fitBounds(polyline.getBounds());
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

proj4.convertArr = function(arr) {
    // class level method
    // converts an array of points from MaSP spherical Lat/Lon
    // assumes an array of [[x, y], [x, y]]
    // returns [[lng, lat], [lng, lat]];
    conversionArr = [];
    for (var i = 0; i < arr.length; i++) {
        x = arr[i][0];
        y = arr[i][1];

        latLng = proj4("EPSG:26786", "WGS84", [x, y]);
        lngLat = [latLng[1],latLng[0]];
        conversionArr.push(lngLat);
    };
    return conversionArr;
};

proj4.clearPolylines = function(arra) {
    for(i in map._layers) {
        if(map._layers[i]._path != undefined) {
            try {
                map.removeLayer(map._layers[i]);
            }
            catch(e) {
                console.log("problem with " + e + map._layers[i]);
            }
        }
    }
}
