require('dotenv').config();

const client = require('@slack/client');
const url = process.env.SLACK_WEBHOOK;
const webhook = new client.IncomingWebhook(url);


class SlackWriter{
    constructor(){
        this.messageBuf = '';
        this.logDetail = false;
    }

    write(msg){
        this.messageBuf = this.messageBuf + msg;
    }

    end(){
        webhook.send(this.messageBuf, function(err, res){
            if(err){
                console.log('Error: ', err);
            }else{
                console.log('Message sent : ', res);
            }
        });
    }
}

module.exports = {
    'SlackWriter': new SlackWriter()
}

