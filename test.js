var app = require('./app');
var schedule = require('node-schedule');
const slack = require('./slack').SlackWriter;
var ti = require('technicalindicators');
var _ = require('underscore');
var fs = require('fs');

const EMA = ti.EMA;

function test(sym){
    if(!sym){
        app.output(
            {write: console.log, end: (x)=>console.log('done'), logDetail: true}, 
            {'filename':'last_tickers', 'intervals': ['4h']}
        );
    }else{
        app.test(
                {write: console.log, end: (x)=>console.log('done'), logDetail: true}, 
                {'filename':'last_tickers', 'intervals': ['4h'], 'sym': sym}
        );
    }
    
}

function testSlack(){
    slack.write('Test Slack message');
    slack.write('another message');
    slack.end();
}

//test();
//test('ETHUSDT');
//testSlack();

function testEma(){
    let x = JSON.parse(fs.readFileSync('data/test-4h.json'));
    let arr = _.unzip(x);
    let close = _.map(arr[4], (x)=>parseFloat(x));
    let closetime = arr[6];
    
    //17 jan , ema 26 below ema 100
    //test close time = 1516175999999
    let e26 = EMA.calculate({period: 26, values: close}).reverse();
    let e100 = EMA.calculate({period: 100, values: close}).reverse();
    
    //26>100 ? 1 : 0
    let d= _.map(_.zip(e26, e100), (x)=>x[0]>x[1]?1:0);
    let f = _.indexOf(d, 0);
    console.log(f, new Date(closetime[f]));
    console.log(_.last(e26), _.last(e100));

    let i2 = _.indexOf(closetime.reverse(), 1522670399999);
    console.log(i2, new Date(closetime.reverse()[i2]));
    console.log(e26[i2], e100[i2], d[i2], f, new Date(closetime.reverse()[f]));
}

//testEma();