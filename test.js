var app = require('./app');

function test(){
    app.output({write: console.log, end: (x)=>console.log('done')}, 'last_tickers');
}

test();