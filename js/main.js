getRoute = function() {

    var from = $("#from_field").val().toUpperCase();
    var to = $("#to_field").val().toUpperCase();

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
        parseRoute(xml)
    });


}
var parseRoute = function(result) {
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
    return route;
}

// route object (for users to walk on)
Route = function(from, to, type) {
    this.from = from;
    this.to = to;
    this.type = type;

    // array of points composing a path
    this.path = [];

    // array of spaces contained in the route
    // typically not populated unless debug mode is on
    this.spaces = []
};

// space object (for rooms/triangles)
Space = function(name) {
    this.name = name;
    this.color = "#FF0000";

    // x and y of the centroid
    this.centroid = [];

    // array of x and y coordinates defining corners
    this.contour = [];

    // array of triangles dividing the space
    this.triangulation = [];
};
