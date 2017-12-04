//Decision Genie Code
//11/20/2017 - refactoring to use Alexa SDK
'use strict';

var Alexa = require('alexa-sdk');
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var dateFormat = require('dateformat');

exports.handler = function(event, context, callback) {

  var alexa = Alexa.handler(event,context);
  alexa.registerHandlers(handlers);
  alexa.execute();

}

var handlers = {

  'LaunchRequest': function() {
    var speechOutput = 'Hello, I am the Decision Genie. I can help you decide between several choices if you separate each choice by the word or. For example, you can say, should I order Pizza or Sushi or Chinese Take Out? ';
    var repromptSpeech = 'For example, you can ask, should I order Mexican or Chinese?';
    this.emit(':ask',speechOutput,repromptSpeech)
  },

  'AskIntent': function () {
    var paramsCheck = {
      Key: {
        "userId": {
          S: this.event.session.user['userId']
        }
      },
      TableName: "decisionGenieResponses"
    };
    console.log(paramsCheck);

    var localThis = this; //kludge to get "this" inside the function

    dynamodb.getItem(paramsCheck, function(err,data){
      if (err) {
        console.log('Failed');
        localThis.emit(":tell","Decision Genie is unavailable at this time. Please try again later. ");
      } else {
        console.log('Succeed');
        if (Object.keys(data).length === 0) {
          localThis.emit('ChoiceSection');
        } else {
          localThis.attributes['pastData'] = data;
          localThis.emit('ChoiceSection');
        }
      }
    });
  },

  'ChoiceSection': function() {
    let choices = this.event.request.intent.slots.BigQuestion.value;

    if (typeof choices !== "undefined") {

      let choices_split = choices.split(" or ");

      if (choices_split.length < 2) {
        var speechOutput = "Sorry, can you please repeat your question with each choice separated by the word or? ";
        var repromptSpeech = "Can you please repeat your question with each choice separated by the word or? ";
        this.emit(':ask',speechOutput,repromptSpeech);

      } else {

        let selected_choice = choices_split[Math.floor(Math.random()*choices_split.length)]
        let cleaned_choice = removeExtraneousWords(selected_choice)
        var speechOutput = `The Decision Genie has selected: ${cleaned_choice}. `;

        if (cleaned_choice.length > 0) {
          var datetime = new Date().getTime().toString();
          var localThis = this;

          if (typeof this.attributes['pastData'] === 'undefined') {
            var answerArr = [datetime+'-'+ String(cleaned_choice)];
            var questionArr = [datetime+'-'+String(choices)]
          } else {
            var pastData = this.attributes['pastData']
            var answerArr = pastData.Item.answerArr.SS
            var questionArr = pastData.Item.questionArr.SS

            answerArr.push(datetime+'-'+String(cleaned_choice));
            questionArr.push(datetime+'-'+String(choices));
          }

          dynamodb.putItem({
            "TableName": "decisionGenieResponses",
            "Item" : {
              "userId": {"S": this.event.session.user['userId'] },
              "questionArr": {"SS": questionArr },
              "answerArr": {"SS": answerArr},
            }
          }, function(err, data) {
            if (err) {
              console.log(err)
              console.log('failed')
              localThis.emit(':tell',speechOutput)
            }
            else {
              console.log('great success!');
              localThis.emit(':tell',speechOutput)
            }
          });

        } else {
            responseRetry()
        }

      }
    } else {
      responseRetry()
    }
  },

  'AMAZON.StopIntent': function() {
    var speechOutput = "Good bye";
    this.emit(":tell",speechOutput);
  },

  'AMAZON.CancelIntent': function() {
    var speechOutput = "Good bye";
    this.emit(":tell",speechOutput);
  },

  'AMAZON.HelpIntent': function() {
    var speechOutput = "I can help you decide between several choices if you separate each choice by the word or. For example, you can say, should I order Pizza or Sushi or Chinese Take Out?  ";
    var repromptSpeech = "For example, you can ask, should I order Mexican or Chinese food? ";
    this.emit(':ask',speechOutput,repromptSpeech);
  },


}

function responseRetry() {
  var speechOutput = "Sorry, can you please repeat your question again? ";
  var repromptSpeech = "Sorry, can you please repeat your question again? ";
  this.emit(':ask',speechOutput,repromptSpeech);
}

function removeExtraneousWords(phrase) {
  phrase = phrase.replace('choose between','');
  phrase = phrase.replace('choose among','');
  phrase = phrase.replace('select between','');
  phrase = phrase.replace('select among','');
  phrase = phrase.replace('decide between','');
  phrase = phrase.replace('decide among','');
  phrase = phrase.replace('should I','');
  phrase = phrase.replace('I should','');
  phrase = phrase.replace('do I','');
  phrase = phrase.replace('can I','');
  phrase = phrase.trim();

  return phrase;
}