var http = require('http');
var fs = require('fs');
var app = require('./app');

http.createServer(function (req, res) {
    let url = req.url;
    if(url === '/list'){
        res.writeHead(200, { 'Content-Type': 'text/plain', 
                             'Content-Disposition': 'inline' });
        
        app.output(res);
    }else{
        res.write('Hello!');
        res.end();
    }
    
}).listen(process.env.PORT || 8080);
