var http = require('http');
var fs = require('fs');
//var app = require('./app');



http.createServer(function (req, res) {
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write('test');
    res.end();
    
}).listen(process.env.PORT || 8080);