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


var intervals = ["30m", "1h", "4h", "1d"];
intervals = ["1h", "4h"];

var lookbackPeriod = 0;
var previousPeriod = 3;
var outputString = '';

module.exports = {
    output: function(writer){
        getTopSymbols(aggregate);
        log(writer);
    }
}

var fileTickers = [];
var tableIndicators = [];
var execMap = {};
var indicators = {};
var ticks = [];

let last_tickers = fs.readFileSync('data/last_tickers.txt').toString().split('\n');
last_tickers = _.without(last_tickers, '');

function reset(){
    fileTickers = [];
    tableIndicators = [];
    execMap = {};
    indicators = [];
    ticks = [];
}

var log = function(writer){
    //wait while all indicators are collected
    if(Object.keys(execMap).length==0){
        
        setTimeout(log, 100, writer);
        return;
    }else{
        let sum = Object.values(execMap).reduce((a,b)=>a+b);
        if(sum>0){
            //wait for some more time
            setTimeout(log, 100, writer);
            return;
        }else{
            console.log("Completed processing data for tickers. Filtering now...");

            let tickers = Object.keys(indicators);
            tickers.forEach((k)=>{
                if( _.isEmpty(indicators[k])){
                    delete indicators[k];
                }else{
                    //check if all lower intervals satisfy the criteria
                    
                    let ints = Object.keys(indicators[k]);
                    
                    //all values in intervals are filtered
                    if(!_.isEmpty(_.difference(intervals, ints))){
                        //console.log("deleting " + k);
                        delete indicators[k];
                    }else{
                        fileTickers.push(k);
                        var obj = {};
                        //obj['ticker']=k;
                        //obj['indicators']=[];
                        ints.forEach((i)=>{
                            let x = {};
                            x['ticker']=k;
                            x['interval'] = i;
                            x=_.extend(x,indicators[k][i]);
                            //obj['indicators'].push(x);
                            tableIndicators.push(x);
                        });
                        

                    }
                }
            });//forEach

            let gainers = [];
            let losers = [];

            let file = fs.createWriteStream('data/last_tickers.txt');
            
            fileTickers.forEach((t)=>{
                file.write(t+"\n");
            });
            file.end();
            
            //pick, gainers, losers
            
            writer.write("\n==== uptrend ======\n");
            writer.write(Table.print(tableIndicators));
            writer.write("\n=== newcomers (from previous run) === \n");
            _.difference(fileTickers, last_tickers).forEach((x)=>{
                writer.write(x);
                writer.write("\n");
            });
            writer.write("=== losers (from previous run) === \n");
            _.difference(last_tickers, fileTickers).forEach((x)=>{
                writer.write(x);
                writer.write("\n");
            });
            writer.end();

            reset();
        }
    }
    
};

var sendRequest = function(url){
    var opts = {
        url: url,
        headers: {
            'X-MBX-APIKEY': process.env.APIKEY
        },
        method: 'GET'
    };

    return rp.get(opts);
};

/** INDICATORS FUNCTIONS (START) **/
var getWR = function(prices, period){
    
    
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
var getEma = function(prices, period, name){
   // let key = "ema-"+period;
   //console.log(data["prices"].length);

   let d = EMA.calculate({period: period, values: prices})
   let key = "ema-"+name;
   let ema = {};
   ema[key] = d[d.length-lookbackPeriod-1];
   return ema;
  
}

var getStochRSI = function(prices, rsiPeriod, stochasticPeriod, kPeriod, dPeriod){
    let input = {
        values: prices,
        rsiPeriod: rsiPeriod, 
        stochasticPeriod: stochasticPeriod,
        kPeriod: kPeriod,
        dPeriod: dPeriod
    };

    let values = STOCH_RSI.calculate(input);
    //console.log("data length = " +values.length);
    let d = values[values.length-lookbackPeriod-1];
    
    let d5 = values[values.length-lookbackPeriod-previousPeriod-1];
    let k = "StochRSI-"+previousPeriod;
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

var getPrices = function(key, data){
    let prices = [];
    data.forEach(el=>{
        prices.push(el[key]);
    });
    return {
            "last_close_time": data[data.length-lookbackPeriod-1]["close_time"], 
            "prices": prices
        };
}

var getData = async function(sym, interval, cb){

    let intervalData= [];
    let klines_url = BASE_URL+KLINES_EP+'?symbol='+sym+"&interval="+interval;
    

    await sendRequest(klines_url).then(function(body){
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
    
};

var getTopSymbols =  async function(cb){
    let url = BASE_URL+TICK_24HR;
   

    let filter = function(body){

        let data = JSON.parse(body);
        //console.log(data.length);
        ticks = data.filter(x=>parseInt(x["quoteVolume"])>=1000 
                        && (x["symbol"].endsWith("BTC") || x["symbol"].endsWith("USDT")));
    };

    await sendRequest(url).then(filter);
    let promises= [];
    ticks.forEach((t)=>{
        execMap[t["symbol"]] = intervals.length;
    });

    ticks.forEach((t)=>{
        //promises.push(Promise.resolve(t["symbol"]));
        cb(t["symbol"]);
    });
    
    //return promises;
 
};


function checkIndicators(values){
    //if ema 12 cross over ema 100
    if(
        values["ema-short"]>values["ema-mid"]
        && values["ema-mid"]>values["ema-long"]
        && values["StochRSI"]>20
        && values["StochRSI-"+previousPeriod]<=values["StochRSI"]
    )
    {
        return true;
    }
    return false;
}

function aggregate(sym){
    
    indicators[sym] = {};

    //process for each interval and aggregate indicators
    intervals.forEach((x)=>{
        indicators[sym][x] = {};
        
        //calculate for each interval 
        getData(sym, x, (prices)=>{

                //1. EMA 
                let ema12 = getEma(_.pluck(prices, "close"), 7, "short");
                let ema26 = getEma(_.pluck(prices, "close"), 25, "mid");
                let ema100 = getEma(_.pluck(prices, "close"), 99, "long");
                let stochRsi = getStochRSI(_.pluck(prices, "close"), 20, 14, 9, 9);
                let wr = getWR(prices, 14);

                //console.log(Object.keys(stochRsi));
                let values = _.extend(ema12, ema26, ema100, stochRsi, wr);
                //console.log(values);

                execMap[sym] = execMap[sym]-1;
                
                if(checkIndicators(values)){
                    //add to the object, only if the criteria passes
                    indicators[sym][x] = values;
                }else{
                    delete indicators[sym][x];
                }
                
                //console.log("Decrementing count for symbol = " + sym + "[ " + execMap[sym]+"]");
        });
    });

    //console.log('inside agggregator');
    //console.log(indicators);

};//end aggregrate