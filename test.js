var app = require('./app');
var schedule = require('node-schedule');
const slack = require('./slack').SlackWriter;

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
