var http = require('http');
var fs = require('fs');
var app = require('./app');

http.createServer(function (req, res) {
    
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'inline' });
    app.output(res);
    
}).listen(process.env.PORT || 8080);
