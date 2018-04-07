require('dotenv').config();

var fs = require('fs');
var request = require('request');
var ti = require('technicalindicators');
var _ = require('underscore');
var async = require('async');
var rp = require('request-promise');
var Table = require('easy-table');

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

            let gainers = [];
            let losers = [];

            let file = fs.createWriteStream('data/last_tickers.txt');
            
            readerInstance.fileTickers.forEach((t)=>{
                file.write(t+"\n");
            });
            file.end();
            
            //pick, gainers, losers
            
            writer.write("\n==== uptrend ======\n");
            writer.write(Table.print(readerInstance.tableIndicators));
            writer.write("\n=== newcomers (from previous run) === \n");
            _.uniq(_.difference(readerInstance.fileTickers, readerInstance.last_tickers)).forEach((x)=>{
                writer.write(x);
                writer.write("\n");
            });
            writer.write("=== losers (from previous run) === \n");
            _.uniq(_.difference(readerInstance.last_tickers, readerInstance.fileTickers)).forEach((x)=>{
                writer.write(x);
                writer.write("\n");
            });
            writer.end();
        }
    }
    
}

class BinanceReader{
    constructor(){
        this.intervals = ["30m", "1h", "4h", "1d"];
        this.intervals = ["1h", "4h"];
        this.fileTickers = [];
        this.tableIndicators = [];
        this.execMap = {};
        this.indicators = {};
        this.lookbackPeriod = 0;
        this.previousPeriod = 3;

        this.last_tickers = fs.readFileSync('data/last_tickers.txt').toString().split('\n');
        this.last_tickers = _.without(this.last_tickers, '');
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

    async getData(sym, interval, cb)
    {

        let intervalData= [];
        let klines_url = BASE_URL+KLINES_EP+'?symbol='+sym+"&interval="+interval;
        

        await this.sendRequest(klines_url).then(function(body){
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
            
            
        });//end sendRequest

        //let prices = getPrices("close", intervalData);
        let prices = intervalData;

        try{
            cb(prices);
        }catch(err){
            console.log(err);
        }
        
    }

    async getTopSymbols(){
        let url = BASE_URL+TICK_24HR;
    
        let ticks = [];

        let filter = function(body){

            let data = JSON.parse(body);
            //console.log(data.length);
            ticks = data.filter(x=>parseInt(x["quoteVolume"])>=1000 
                            && (x["symbol"].endsWith("BTC") || x["symbol"].endsWith("USDT")));
        };

        await this.sendRequest(url).then(filter);
        let promises= [];
        ticks.forEach((t)=>{
            this.execMap[t["symbol"]] = this.intervals.length;
        });

        ticks.forEach((t)=>{
            //promises.push(Promise.resolve(t["symbol"]));
            this.aggregate(t["symbol"]);
        });
        
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

    async aggregate(sym){
        
        this.indicators[sym] = {};

        //process for each interval and aggregate indicators
        this.intervals.forEach((x)=>{
            this.indicators[sym][x] = {};
            
            //calculate for each interval 
            this.getData(sym, x, (prices)=>{

                    //1. EMA 
                    let ema12 = this.getEma(_.pluck(prices, "close"), 7, "short");
                    let ema26 = this.getEma(_.pluck(prices, "close"), 25, "mid");
                    let ema100 = this.getEma(_.pluck(prices, "close"), 99, "long");
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


