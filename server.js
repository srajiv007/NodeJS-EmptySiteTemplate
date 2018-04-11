var http = require('http');
var fs = require('fs');
var app = require('./app');
var uuid = require('uuid/v4');
var url = require('url');
var _ = require('underscore');


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
    let fname = parseCookies(req)["filename"] || uuid();
    let ints = _.isEmpty(q['int']) ? []: q['int'];
    ints = ints instanceof Array ? ints : ints.split(',');

    console.log(q);
    let params = {
                'filename': fname, 
                'intervals': ints, 
                'ema-short': q['ema-short'],
                'ema-mid': q['ema-mid'],
                'ema-long': q['ema-long'],
                'volume': q['volume'],
                'market': q['market']};

    if(req_url.startsWith('/list')){
        res.writeHead(200, { 'Content-Type': 'text/plain', 
                             'Content-Disposition': 'inline',
                             'Set-Cookie': 'filename='+fname});
                             
        //let ints = q['int'] ? q['int'].split(','): [];
        console.log(ints);
        app.output(res, params);
    }else{
        res.write(fs.readFileSync('HTMLPage.html'));
        res.end();
    }
    
}).listen(process.env.PORT || 8080);
