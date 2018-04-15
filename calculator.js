var ti = require('technicalindicators');
var _ = require('underscore');

const SMA = ti.SMA;
const EMA = ti.EMA;
const MACD = ti.MACD;
const STOCH_RSI = ti.StochasticRSI;
const WilliamsR = ti.WilliamsR;
const TRIX = ti.TRIX;


class Calculator{

    constructor(){}


    /** INDICATORS FUNCTIONS (START) **/
    getTRIX(prices, period)
    {
        let d = TRIX.calculate({
            values: _.pluck(prices, "close"),
            period: period
        });
        //console.log(d);

        return {"TRIX": _.last(d)};
    }


    getMACD(prices, fastPeriod, slowPeriod, signalPeriod)
    {
        let input = {
            values: _.pluck(prices, "close"),
            slowPeriod: slowPeriod,
            fastPeriod: fastPeriod,
            signalPeriod: signalPeriod,
            SimpleMAOscillator: false,
            SimpleMASignal    : false
        };

        let d = MACD.calculate(input);
        //console.log(_.last(d, 3));
        return {"MACD": _.last(d)};
    }

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
        let values = _.pluck(prices, "close");
        let d = EMA.calculate({period: period, values: values});
        let key = "ema-"+name;
        let ema = {};
        ema[key] = _.last(d);
        return ema;
    }

    getLastEmaCrossover(prices, mid, long)
    {
        //prices: recent first
        let values = _.pluck(prices, "close");
        let emid = EMA.calculate({period: mid, values: values}).reverse();//recent last
        let elong = EMA.calculate({period: long, values: values}).reverse();
        //26 > 100
        let d = _.map(_.zip(emid, elong), (x)=>x[0]>x[1]?1:0);
        let i = _.indexOf(d, 0);
        //console.log(i, emid[i], elong[i], prices[prices.length-i]["close_time"], _.last(prices)["close_time"]);
        //console.log(_.first(emid), _.first(elong));//correct
        return i;
    }

    getPriceChangeLastCrossover(prices, mid, long)
    {
        let index = this.getLastEmaCrossover(prices, mid, long);
        let l = prices.length;
        let p = prices.reverse();

        if(index>=0){
            let last = p[index];
            let curr = _.first(p);
            console.log(last, curr);

            //[ last-crossover, current ]
            let close = _.pluck([last, curr], "close");
            let d = ((close[1]/close[0])-1)*100;
            return {"priceChangeLastCrossOver" : d.toPrecision(6).toString()} ;
        }
        return {"priceChangeLastCrossOver" : "NO BACK DATA" } ;
    }

    getSma(prices, period, name)
    {
        let values = _.pluck(prices, "close");
        let d = SMA.calculate({period: period, values: values});
        let key = "sma-"+name;
        let sma = {};
        sma[key] = _.last(d);
        return sma;
    }

    getStochRSI(prices, rsiPeriod, stochasticPeriod, kPeriod, dPeriod, previousPeriod)
    {
        let input = {
            values: _.pluck(prices, "close"),
            rsiPeriod: rsiPeriod, 
            stochasticPeriod: stochasticPeriod,
            kPeriod: kPeriod,
            dPeriod: dPeriod
        }

        let values = STOCH_RSI.calculate(input);
        //console.log("data length = " +values.length);
        let d = _.last(values);
        
        let d5 = _.last(_.initial(values, previousPeriod));
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

}

module.exports = {
    'Calc': new Calculator()
}