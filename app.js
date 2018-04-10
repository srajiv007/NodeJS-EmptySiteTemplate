var bnb = require('./binance');

function outputter(writer, fname){
    let reader = new bnb.binance(fname);
    reader.getTopSymbols();
    bnb.logger(writer, reader);
}

module.exports = {
    output: outputter
}