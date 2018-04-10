var app = require('./app');

function test(){
    app.output(
                {write: console.log, end: (x)=>console.log('done')}, 
                {'filename':'last_tickers'}
    );
}

test();