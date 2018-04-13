var app = require('./app');
var empty = require('is-empty');

function test(sym){
    if(empty(sym)){
        app.output(
            {write: console.log, end: (x)=>console.log('done')}, 
            {'filename':'last_tickers', 'intervals': ['4h']}
        );
    }else{
        app.test(
                {write: console.log, end: (x)=>console.log('done')}, 
                {'filename':'last_tickers', 'intervals': ['4h'], 'sym': sym}
        );
    }
    
}

//test();
test('ETHUSDT');