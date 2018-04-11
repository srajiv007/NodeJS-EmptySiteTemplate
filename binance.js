require('dotenv').config();

var fs = require('fs');
var request = require('request');
var ti = require('technicalindicators');
var _ = require('underscore');
var async = require('async');
var rp = require('request-promise');
var Table = require('easy-table');
var uuid = require('uuid/v4');

const SMA = ti.SMA;
const EMA = ti.EMA;
const STOCH_RSI = ti.StochasticRSI;
const WilliamsR = ti.WilliamsR;

const BASE_URL = process.env.BASE_URL;
const KLINES_EP = process.env.KLINES_EP;
const TICK_24HR = process.env.TICK_24HR;


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
            writer.write(x);
            writer.write("\n");
        });
    }

    writeData(){
        let gainers = [];
        let losers = [];
        let readerInstance = this.readerInstance;
        let writer = this.writer;
        let fappend = readerInstance.intervals.toString().replace(/,/g,'-');
        let file = fs.createWriteStream('data/'+readerInstance.lastfilename+'-'+fappend+'.txt');
        
        readerInstance.fileTickers.forEach((t)=>{
            file.write(t+"\n");
        });
        file.end();
        
        //pick, gainers, losers
        
        writer.write("\n==== uptrends ======\n");
        this.printList(_.sortBy(readerInstance.fileTickers||[], function(x){
            return readerInstance.topTickers[x];
        }).reverse());

        writer.write("\n=== newcomers (from previous run) === \n");
        this.printList(_.uniq(_.difference(readerInstance.fileTickers, readerInstance.last_tickers)));

        writer.write("=== losers (from previous run) === \n");
        this.printList(_.uniq(_.difference(readerInstance.last_tickers, readerInstance.fileTickers)));

        writer.write("\n==== details ======\n");
        writer.write(Table.print(readerInstance.tableIndicators));
        writer.end();
    }
}

class BinanceReader{
    constructor(params){
        let filename = params['filename'];
        let ints = params['intervals'];
        this.emaintervals = {'ema-short': params['ema-short'], 'ema-mid': params['ema-mid'], 'ema-long': params['ema-long']}
        this.topTickers = {};
        this.intervals = _.isEmpty(ints)?["1h", "4h"]:ints;
        //this.intervals = ["1h", "4h"];
        this.fileTickers = [];
        this.tableIndicators = [];
        this.execMap = {};
        this.indicators = {};
        this.lookbackPeriod = 0;
        this.previousPeriod = 3;
        this.lastfilename = filename;
        let fappend = this.intervals.toString().replace(/,/g,'-');
        
        let path = 'data/'+this.lastfilename+'-'+fappend+'.txt';
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

    /** INDICATORS FUNCTIONS (START) **/
    getWR(prices, period){
        
        
        let input = {
            high: _.pluck(prices, "high"),
            low:  _.pluck(prices, "low"),
            close:  _.pluck(prices, "close"),
            period: period
        };
        //console.log(input);

        let d = WilliamsR.calculate(input);

        return {"WR%" : _.last(d) };
    }
    
    getEma(prices, period, name)
    {
        // let key = "ema-"+period;
        //console.log(data["prices"].length);

        let d = EMA.calculate({period: period, values: prices})
        let key = "ema-"+name;
        let ema = {};
        ema[key] = d[d.length-this.lookbackPeriod-1];
        return ema;
    }

    getSma(prices, period, name)
    {
        // let key = "ema-"+period;
        //console.log(data["prices"].length);

        let d = SMA.calculate({period: period, values: prices})
        let key = "sma-"+name;
        let sma = {};
        sma[key] = d[d.length-this.lookbackPeriod-1];
        return sma;
    }

    getStochRSI(prices, rsiPeriod, stochasticPeriod, kPeriod, dPeriod)
    {
        let input = {
            values: prices,
            rsiPeriod: rsiPeriod, 
            stochasticPeriod: stochasticPeriod,
            kPeriod: kPeriod,
            dPeriod: dPeriod
        }

        let values = STOCH_RSI.calculate(input);
        //console.log("data length = " +values.length);
        let d = values[values.length-this.lookbackPeriod-1];
        
        let d5 = values[values.length-this.lookbackPeriod-this.previousPeriod-1];
        let k = "StochRSI-"+this.previousPeriod;
        //console.log(values);
        if(d){
            let obj = { "StochRSI" :  d.stochRSI } ;
            obj[k] = d5.stochRSI;
            return obj;
        }else{
            let obj = { "StochRSI" :  -1 } ;
            obj[k] = -1;
            return obj;
        }
        
    }
    /*** INDICATOR FUNCTIONS (END) ***/

    getPrices(key, data)
    {
        let prices = [];
        data.forEach(el=>{
            prices.push(el[key]);
        });

        return {
                "last_close_time": data[data.length-this.lookbackPeriod-1]["close_time"], 
                "prices": prices
            }
    }

    getData(sym, interval, cb)
    {

        let intervalData= [];
        let klines_url = BASE_URL+KLINES_EP+'?symbol='+sym+"&interval="+interval;
        

        this.sendRequest(klines_url).then(function(body){
            let data = JSON.parse(body);
            //console.log(data.length);
            let close_prices = [];
            
            data.forEach(element => {
                let open_time = new Date(parseInt(element[0])).toLocaleString("en-US");
                let open = parseFloat(element[1]);
                let high = element[2];
                let low = element[3];
                let close = parseFloat(element[4]);
                let vol = element[5]
                let close_time = new Date(parseInt(element[6])).toLocaleString("en-US");
                
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
            
        });//end sendRequest

        //let prices = getPrices("close", intervalData);
        let prices = intervalData;

        /*try{
            cb(prices);
        }catch(err){
            console.log(err);
        }*/
        
    }

    getTopSymbols(){
        let url = BASE_URL+TICK_24HR;
    
        let ticks = [];

        let filter = function(instance,body){

            let data = JSON.parse(body);
            //console.log(data.length);
            ticks = data.filter(x=>parseInt(x["quoteVolume"])>=2500 
                            && (x["symbol"].endsWith("BTC") || x["symbol"].endsWith("USDT")));
            
            ticks.forEach((t)=>{
                instance.topTickers[t["symbol"]] = t["quoteVolume"];

                instance.execMap[t["symbol"]] = instance.intervals.length;

                //callback for technical indicators
                instance.aggregate(t["symbol"]);
            });
        };

        this.sendRequest(url).then((body)=>{
            filter(this, body);
        });
        /*let promises= [];
        ticks.forEach((t)=>{
            this.execMap[t["symbol"]] = this.intervals.length;
        });

        ticks.forEach((t)=>{
            //promises.push(Promise.resolve(t["symbol"]));
            this.aggregate(t["symbol"]);
        });*/
        
        //return promises;
    
    }


    checkIndicators(values){
        //if ema 12 cross over ema 100
        if(
            values["ema-short"]>values["ema-mid"]
            && values["ema-mid"]>values["ema-long"]
            //&& values["StochRSI"]>20
            //&& values["StochRSI-"+previousPeriod]<=values["StochRSI"]
        )
        {
            return true;
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

                    let ema12 = this.getEma(_.pluck(prices, "close"), parseInt(s), "short");
                    let ema26 = this.getEma(_.pluck(prices, "close"), parseInt(m), "mid");
                    let ema100 = this.getEma(_.pluck(prices, "close"), parseInt(l), "long");
                    let stochRsi = this.getStochRSI(_.pluck(prices, "close"), 20, 14, 9, 9);
                    let wr = this.getWR(prices, 14);

                    //console.log(Object.keys(stochRsi));
                    let values = _.extend(ema12, ema26, ema100, stochRsi, wr);
                    //console.log(values);

                    this.execMap[sym] = this.execMap[sym]-1;
                    
                    if(this.checkIndicators(values)){
                        //add to the object, only if the criteria passes
                        this.indicators[sym][x] = values;
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


