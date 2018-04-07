var bnb = require('./binance');

module.exports = {
    output: function(writer){
        let reader = new bnb.binance();
        reader.getTopSymbols();
        bnb.logger(writer, reader);
    }
}

function test(){
    var reader = new bnb.binance();
    reader.getTopSymbols();
    bnb.logger({write: console.log, end: (x)=>console.log('done')}, reader);
}

//test();