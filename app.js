var bnb = require('./binance');

function outputter(writer, params){
    
    let reader = new bnb.binance(params);
    reader.getTopSymbols();
    bnb.logger(writer, reader);
}

function tester(writer, params){
    let reader = new bnb.binance(params);
    console.log(params['sym']);
    reader.getSymbols(params['sym']);
    bnb.logger(writer, reader);
}

module.exports = {
    output: outputter,
    test: tester
}