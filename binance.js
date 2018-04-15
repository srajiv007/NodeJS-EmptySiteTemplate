require('dotenv').config();

var fs = require('fs');
var request = require('request');
var _ = require('underscore');
var async = require('async');
var rp = require('request-promise');
var Table = require('easy-table');
var uuid = require('uuid/v4');
var calc = require('./calculator').Calc;

const BASE_URL = process.env.BASE_URL;
const KLINES_EP = process.env.KLINES_EP;
const TICK_24HR = process.env.TICK_24HR;

function sortBy(list, map, key){
    return _.sortBy(list, function(x){
        return map[x][key];
    });
}


function log(writer, readerInstance){
    //wait while all indicators are collected
    
    if(Object.keys(readerInstance.execMap).length==0){ 
        setTimeout(log, 10, writer, readerInstance);
        return;
    }else{
        let sum = Object.values(readerInstance.execMap).reduce((a,b)=>a+b);
        if(sum>0){
            //wait for some more time
            setTimeout(log, 10, writer, readerInstance);
            return;
        }else{
            console.log("Completed processing data for tickers. Filtering now...");
            let logger = new BinanceLogger(readerInstance, writer);

            logger.filterData();
            logger.writeData();
        }
    }
    
}

class BinanceLogger{
    constructor(instance, writer){
        this.readerInstance = instance;
        this.writer = writer;
    }

    filterData(){
        let readerInstance = this.readerInstance;

        let tickers = Object.keys(readerInstance.indicators);
        tickers.forEach((k)=>{
            if( _.isEmpty(readerInstance.indicators[k])){
                delete readerInstance.indicators[k];
            }else{
                //check if all lower intervals satisfy the criteria
                
                let ints = Object.keys(readerInstance.indicators[k]);
                
                //all values in intervals are filtered
                if(!_.isEmpty(_.difference(readerInstance.intervals, ints))){
                    //console.log("deleting " + k);
                    delete readerInstance.indicators[k];
                }else{
                    readerInstance.fileTickers.push(k);
                    var obj = {};
                    //obj['ticker']=k;
                    //obj['indicators']=[];
                    ints.forEach((i)=>{
                        let x = {};
                        x['ticker']=k;
                        x['interval'] = i;
                        x=_.extend(x, readerInstance.indicators[k][i]);
                        //obj['indicators'].push(x);
                        readerInstance.tableIndicators.push(x);
                    });
                    

                }
            }
        });//forEach
    }

    printList(list){
        let writer = this.writer;
        list.forEach((x)=>{
            writer.write(x.toString().replace(/,/g,'   '));
            writer.write("\n");
        });
    }

    getTableObj(ticks, map, keys){
        //keys = [actual, display]
        let k = _.map(keys, (x)=>x[0]);
        let n = _.map(keys, (x)=>x[1]);
        n.push("ticker");
    
        let kl = _.map(ticks, (t)=>{
            let v = _.pick(map[t], k);
            v["ticker"] = t;
            let nl = _.unzip(_.pairs(v));
            let values = nl[1];
            console.log(nl);
            console.log(n);
            return _.object(_.zip(n, values));
        });
        return kl;
    }

    writeData(){
        let gainers = [];
        let losers = [];
        let readerInstance = this.readerInstance;
        let writer = this.writer;
        let fappend = readerInstance.intervals.toString().replace(/,/g,'-');
        let file = fs.createWriteStream('data/'+readerInstance.lastfilename+'-'+readerInstance.market+'-'+fappend+'.txt');
        
        readerInstance.fileTickers.forEach((t)=>{
            file.write(t+"\n");
        });
        file.end();
        
        //pick, gainers, losers
        
        writer.write("\n==== uptrends (sorted) ======\n");
        console.log(readerInstance.topTickers);

        let finalTickers = readerInstance.fileTickers||[];

        if(_.contains(readerInstance.sort, "vol")){
            finalTickers = sortBy(finalTickers, readerInstance.topTickers, "volume");
        }

        if(_.contains(readerInstance.sort, "price")){
            finalTickers = sortBy(finalTickers, readerInstance.topTickers, "priceChange");
        }

        if(_.contains(readerInstance.sort, "change")){
            finalTickers = sortBy(finalTickers, readerInstance.topTickers, "priceChangeLastCrossOver");
        }

        finalTickers = finalTickers.reverse();
        
        let to = this.getTableObj(finalTickers, 
                                readerInstance.topTickers, 
                            [["priceChange", "(24hr)%"], ["priceChangeLastCrossOver", "(Xover)%"]]
                        );

        //console.log(utable);
        writer.write(Table.print(to));

        writer.write("\n==== (recent crossovers) ====\n");
        let co = this.getTableObj(sortBy(finalTickers, readerInstance.topTickers, "lastCrossOverTime").reverse(), 
            readerInstance.topTickers, 
                    [["lastCrossOverDate", "Date"], ["priceChangeLastCrossOver", "%change"]]
            );
       
        writer.write(Table.print(co));

        writer.write("\n=== Trajectories (sorted) ====\n");
        this.printList(sortBy(finalTickers, readerInstance.topTickers, "velocity").reverse());

        writer.write("\n=== newcomers (from previous run) === \n");
        this.printList(_.uniq(_.difference(readerInstance.fileTickers, readerInstance.last_tickers)));

        writer.write("=== losers (from previous run) === \n");
        this.printList(_.uniq(_.difference(readerInstance.last_tickers, readerInstance.fileTickers)));

        if(writer.logDetail){
            writer.write("\n==== details ======\n");
            writer.write(Table.print(readerInstance.tableIndicators));
        }

        writer.end();
    }
}

class BinanceReader{
    constructor(params){
        let filename = params['filename'];
        let ints = params['intervals'];
        this.volume = params['volume'];
        this.market = params['market'];
        this.sort = params['sort'] || ['vol'];
        this.priceChange = parseFloat(params['priceChange']||'0.0');
        this.wrvalues = {'value': parseFloat(params['wr-cutoff'])||-50, 'period': parseInt(params['wr-period'])||14};
        this.methods = params['methods'];
        this.emaintervals = {'ema-short': params['ema-short'], 'ema-mid': params['ema-mid'], 'ema-long': params['ema-long']};
        this.macd = {'macd-slow': params['macd-slow']||26,'macd-fast': params['macd-fast']||12,'macd-signal': params['macd-signal']||9};
        

        this.topTickers = {};
        this.intervals = _.isEmpty(ints)?["1h", "4h"]:ints;
        //this.intervals = ["1h", "4h"];
        this.maxInterval = _.last(this.intervals);
        this.fileTickers = [];
        this.tableIndicators = [];
        this.execMap = {};
        this.indicators = {};
        this.lookbackPeriod = 0;
        this.previousPeriod = 3;
        this.lastfilename = filename;
        let fappend = this.intervals.toString().replace(/,/g,'-');
        
        let path = 'data/'+this.lastfilename+'-'+this.market+'-'+fappend+'.txt';
        if(fs.existsSync(path)){
            this.last_tickers = fs.readFileSync(path).toString().split('\n');
            this.last_tickers = _.without(this.last_tickers, '');
        }
        
    }

    sendRequest(url){
        var opts = {
            url: url,
            headers: {
                'X-MBX-APIKEY': process.env.APIKEY
            },
            method: 'GET'
        };

        return rp.get(opts);
    }

    getPrices(key, data)
    {
        let prices = [];
        data.forEach(el=>{
            prices.push(el[key]);
        });

        return {
                "last_close_time": _.last(data)["close_time"], 
                "prices": prices
            }
    }

    getData(sym, interval, cb)
    {

        let intervalData= [];
        let klines_url = BASE_URL+KLINES_EP+'?symbol='+sym+"&interval="+interval;
        
        var process = function(body){
            let data = JSON.parse(body);
            //console.log(data.length);
            let close_prices = [];
            
            data.forEach(element => {
                let open_time = new Date(parseInt(element[0]));
                let open = parseFloat(element[1]);
                let high = element[2];
                let low = element[3];
                let close = parseFloat(element[4]);
                let vol = element[5]
                let close_time = new Date(parseInt(element[6]));
                
                close_prices.push(close);

                intervalData.push( {
                    "open": open,
                    "close": close,
                    "high": high,
                    "low": low,
                    "volume": vol,
                    "open_time": open_time,
                    "close_time": close_time,
                });
            });//end forEach

            //callback(getPrices("close", intervalData));
            console.log('data retrieved for symbol [' + sym + "] & interval (" + interval + ")");
            try{
                cb(intervalData);
            }catch(err){
                console.log(err);
            }
        };

        this.sendRequest(klines_url).then(function(body){
            process(body);
        });//end sendRequest

        let prices = intervalData;
    }

    getSymbols(sym)
    {
        let url = BASE_URL+TICK_24HR;
        let ticks = [];

        if(sym){
            url = url + '?symbol=' + sym;
            ticks.push(sym);
        }

        console.log(url);

        this.sendRequest(url).then((body)=>{
            //filter(this, body);
            let data = JSON.parse(body);
            //console.log(data.length);
            if(!sym){
                ticks = data.filter(x=>parseInt(x["quoteVolume"])>=this.volume 
                            && (x["symbol"].endsWith(this.market)));
            }
                        
            ticks.forEach((t)=>{
                this.topTickers[t["symbol"]] = {
                                                    "volume": parseFloat(t["quoteVolume"]),
                                                    "priceChange": parseFloat(t["priceChangePercent"]).toFixed(2)
                                                };

                this.execMap[t["symbol"]] = this.intervals.length;

                //callback for technical indicators
                this.aggregate(t["symbol"]);
            });
        });
    }

    getTopSymbols()
    {
       this.getSymbols();
    }


    checkIndicators(values){
        //if ema 12 cross over ema 100
        let stochrsi = _.contains(this.methods, 'stochrsi');
        let wr = _.contains(this.methods, 'wr');
        let mcd = _.contains(this.methods, 'macd');
        let trix = _.contains(this.methods, 'trix');

        let wrValue = values['WR%'];
        let stochcheck = values["StochRSI"]>20 && values["StochRSI-"+this.previousPeriod]<=values["StochRSI"];
        let macdSignal = values["MACD"]["signal"];
        let macdValue = values["MACD"]["MACD"];
        let trixValue = values["TRIX"];

        if(
            values["ema-short"]>values["ema-long"]
            && values["ema-mid"]>values["ema-long"]
        )
        {
            return true 
                    && (stochrsi ? stochcheck : true) 
                    && (wr ? wrValue>=this.wrvalues['value']: true)
                    && (mcd ? macdValue > 0 : true)
                    && (trix ? trixValue >0 : true);
        }
        return false;
    }

    aggregate(sym){
        
        this.indicators[sym] = {};

        //process for each interval and aggregate indicators
        this.intervals.forEach((x)=>{
            this.indicators[sym][x] = {};
            
            //calculate for each interval 
            this.getData(sym, x, (prices)=>{

                    //1. EMA 
                    let s = this.emaintervals['ema-short'] || 7;
                    let m = this.emaintervals['ema-mid'] || 25;
                    let l = this.emaintervals['ema-long'] || 99;

                    let ema12 = calc.getEma(prices, parseInt(s), "short");
                    let ema26 = calc.getEma(prices, parseInt(m), "mid");
                    let ema100 = calc.getEma(prices, parseInt(l), "long");
                    let stochRsi = calc.getStochRSI(prices, 20, 14, 3, 3, 3);
                    let wr = calc.getWR(prices, this.wrvalues['period']);
                    //let macd = calc.getMACD(prices, this.macd["macd-slow"], this.macd["macd-slow"], this.macd["macd-signal"]);
                    let macd = calc.getMACD(prices, 12,26,9);
                    let trix = calc.getTRIX(prices, 18);

                    //console.log(Object.keys(stochRsi));
                    let values = _.extend(ema12, ema26, ema100, stochRsi, wr, macd, trix, priceCO);
                    
                    if(_.isEqual(x, this.maxInterval)){
                        console.log("Crossover ["+sym + "]");
                        var priceCO = calc.getPriceChangeLastCrossover(prices, 26, 100);
                        //values = _.extend(values, priceCO);
                        this.topTickers[sym] = _.extend(this.topTickers[sym], priceCO);
                    }
                    
                    //console.log(values);
                    this.execMap[sym] = this.execMap[sym]-1;
                    
                    if(this.checkIndicators(values)){
                        //add to the object, only if the criteria passes
                        let v = _.omit(values, "MACD", "ema-short", "ema-mid", "ema-long");//remove MACD
                        let w = _.pick(values, "MACD")["MACD"]; //get signal 
                        this.indicators[sym][x] = _.extend(v, _.pick(w, "signal"));//display only MACD value
                    }else{
                        delete this.indicators[sym][x];
                    }
            });
        });

    }//end aggregrate


}

module.exports = {
    binance: BinanceReader,
    logger: log
}


