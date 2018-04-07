var http = require('http');
var fs = require('fs');
var app = require('./app');
var uuid = require('uuid/v4');

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
    let url = req.url;
    if(url === '/list'){
        let fname = parseCookies(req)["filename"] || uuid();
        console.log(fname);
        
        res.writeHead(200, { 'Content-Type': 'text/plain', 
                             'Content-Disposition': 'inline',
                             'Set-Cookie': 'filename='+fname});
        
        app.output(res, fname);
    }else{
        res.write('Hello!');
        res.end();
    }
    
}).listen(process.env.PORT || 8080);
