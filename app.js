var bnb = require('./binance');

function outputter(writer, params){
    let fname = params["filename"];
    
    let reader = new bnb.binance(fname);
    reader.getTopSymbols();
    bnb.logger(writer, reader);
}

module.exports = {
    output: outputter
}