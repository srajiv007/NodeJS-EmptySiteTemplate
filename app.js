var bnb = require('./binance');

function outputter(writer, params){
    
    let reader = new bnb.binance(params);
    reader.getTopSymbols();
    bnb.logger(writer, reader);
}

module.exports = {
    output: outputter
}