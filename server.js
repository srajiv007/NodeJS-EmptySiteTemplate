var http = require('http');
var fs = require('fs');
var ti = require('technicalindicators');

const SMA = ti.SMA;


http.createServer(function (req, res) {
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync('HTMLPage.html').toString());
    
}).listen(process.env.PORT || 8080);