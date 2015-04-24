getRoute = function() {

    var from = $("#from_field").val().toUpperCase();
    var to = $("#to_field").val().toUpperCase();

    routeURL = 'http://wikimap.csail.mit.edu/cgi-bin/route.xml?' + from + '+' + to + '+debug';
    // directURL = 'http://wikimap.csail.mit.edu/cgi-bin/directions.xml?';
    // spaceURL = 'http://wikimap.csail.mit.edu/cgi-bin/space.xml?';
    // roomURL = 'http://wikimap.csail.mit.edu/cgi-bin/room.xml?', '+', '+';
    // proxURL = 'http://wikimap.csail.mit.edu/cgi-bin/proximity.xml?', '+', '+', '+', '+';



    console.log(routeURL);

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

parseRoute = function(route) {
    console.log("parseRoute called");
    console.log(route)
}
