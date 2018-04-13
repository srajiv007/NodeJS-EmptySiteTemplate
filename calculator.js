var ti = require('technicalindicators');
var _ = require('underscore');

const SMA = ti.SMA;
const EMA = ti.EMA;
const MACD = ti.MACD;
const STOCH_RSI = ti.StochasticRSI;
const WilliamsR = ti.WilliamsR;


class Calculator{

    constructor(){}


    /** INDICATORS FUNCTIONS (START) **/
    getMACD(prices, slowPeriod, fastPeriod, signalPeriod)
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
        //console.log(_.last(d));
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