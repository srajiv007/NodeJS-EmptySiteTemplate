var http = require('http');
var fs = require('fs');
var app = require('./app');
var uuid = require('uuid/v4');
var url = require('url');


function parseCookies(request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

http.createServer(function (req, res) {
    let req_url = req.url;
    let q = url.parse(req_url, true).query;
    console.log(q);
    //console.log(req_url.startsWith('/list'));
    let ints = q['int'] ? q['int'].split(','): [];
    console.log(ints);

    if(req_url.startsWith('/list')){
        let fname = parseCookies(req)["filename"] || uuid();        
        res.writeHead(200, { 'Content-Type': 'text/plain', 
                             'Content-Disposition': 'inline',
                             'Set-Cookie': 'filename='+fname});
        
        app.output(res, {'filename': fname, 'intervals': ints});
    }else{
        res.write('Hello!');
        res.end();
    }
    
}).listen(process.env.PORT || 8080);
