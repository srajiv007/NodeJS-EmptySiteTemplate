var http = require('http');
var fs = require('fs');
var app = require('./app');
var uuid = require('uuid/v4');
var url = require('url');
var _ = require('underscore');
var schedule = require('node-schedule');
var slack = require('./slack').SlackWriter;


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

var job = undefined;

const JOB_PARAMS = {
    'filename': uuid(), 
    'intervals': ["30m", "4h"], 
    'ema-short': 12,
    'ema-mid': 26,
    'ema-long': 100,
    'volume': 5000,
    'market': "BTC",
    'sort': "vol",
    'priceChange': 3,
    'wr-cutoff': -50,
    'wr-period': 14,
    'macd-slow': 26,
    'macd-fast': 12,
    'macd-signal': 9,
    'methods': ['macd', 'trix']
};

function start(minute){
    //start job here
    console.log("starting...");
    if(!job){
        let f = "*/" + minute + " * * * *"; //cron format
        console.log(f);
        job = schedule.scheduleJob(f, function(){
            app.output(slack, JOB_PARAMS);
        });
    }
    
}

function stop(){
    //stop job here
    console.log("stopping...");
    if(job){
        job.cancel();
    }
}

http.createServer(function (req, res) {
    let req_url = req.url;
    console.log(req_url);

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
        res.logDetail = true;
        app.output(res, params);
    }else if(req_url.startsWith('/test')){
        res.writeHead(200, { 'Content-Type': 'text/plain', 
                             'Content-Disposition': 'inline',
                             'Set-Cookie': 'filename='+fname});

        res.logDetail = true;
        app.test(res, params);
    }else if(req_url.startsWith('/start')){
            //start/stop job
            let min = q['min'] || 30;
            start(min);
            res.end('Job scheduled to run every - ' + min +" minute. To stop hit the /stop url");
    }else if (req_url.startsWith('/stop')){
        stop();
        res.end('Stopped');
    }else{
        res.write(fs.readFileSync('HTMLPage.html'));
        res.end();
    }
    
}).listen(process.env.PORT || 8080);
