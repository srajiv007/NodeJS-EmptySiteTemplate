var http = require('http');
var fs = require('fs');
var app = require('./app');
var uuid = require('uuid/v4');
var url = require('url');
var _ = require('underscore');
var schedule = require('node-schedule');


function parseCookies(request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

//create instance of job everytime node is up
var rule = new schedule.RecurrenceRule();
rule.minute = 42;

function start(){
    //start job here
}

function stop(){
    //stop job here
}

http.createServer(function (req, res) {
    let req_url = req.url;
    let q = url.parse(req_url, true).query;
    let fname = parseCookies(req)["filename"] || uuid();
    let ints = _.isEmpty(q['int']) ? []: q['int'];
    ints = ints instanceof Array ? ints : ints.split(',');
    let sort = q['sort'] || [];
    sort = sort instanceof Array ? sort: sort.split(',');
    let methods = q['methods'] || ['macd', 'trix'];
    methods = methods instanceof Array ? methods : methods.split(',');

    console.log(q);
    let params = {
                    'filename': fname, 
                    'intervals': ints, 
                    'ema-short': q['ema-short'],
                    'ema-mid': q['ema-mid'],
                    'ema-long': q['ema-long'],
                    'volume': q['volume'],
                    'market': q['market'],
                    'sort': sort,
                    'priceChange': q['valuechange'],
                    'wr-cutoff': q['wr-cutoff'],
                    'wr-period': q['wr-period'],
                    'macd-slow': q['macd-slow'],
                    'macd-fast': q['macd-fast'],
                    'macd-signal': q['macd-signal'],
                    'methods': methods,
                    'sym': q['sym']
                };

    if(req_url.startsWith('/list')){
        res.writeHead(200, { 'Content-Type': 'text/plain', 
                             'Content-Disposition': 'inline',
                             'Set-Cookie': 'filename='+fname});
                             
        //let ints = q['int'] ? q['int'].split(','): [];
        console.log(ints);
        app.output(res, params);
    }else if(req_url.startsWith('/test')){
        res.writeHead(200, { 'Content-Type': 'text/plain', 
                             'Content-Disposition': 'inline',
                             'Set-Cookie': 'filename='+fname});

        app.test(res, params);
    }else if(req_url === 'start' || req_url === 'stop'){
            //start/stop job
    }else{
        res.write(fs.readFileSync('HTMLPage.html'));
        res.end();
    }
    
}).listen(process.env.PORT || 8080);
