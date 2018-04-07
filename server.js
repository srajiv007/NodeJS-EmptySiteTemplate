var http = require('http');
var fs = require('fs');


http.createServer(function (req, res) {
    let url = req.url;
    if(url === '/check'){
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'inline' });
        let app = require('./app');
        app.output(res);
    }else{
        res.write('Hello!');
        res.end();
    }
    
}).listen(process.env.PORT || 8080);
