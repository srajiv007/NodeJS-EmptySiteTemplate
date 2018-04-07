var bnb = require('./binance');

function outputter(writer, fname){
    let reader = new bnb.binance(fname);
    reader.getTopSymbols();
    bnb.logger(writer, reader);
}

function test(){
    outputter({write: console.log, end: (x)=>console.log('done')}, 'last_tickers');
}

//test();

module.exports = {
    output: outputter
}