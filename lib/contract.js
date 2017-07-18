/**
  Design by Contract module (c) OptimalBits 2011.

  Roadmap:
    - Optional parameters. ['(string)', 'array']
    - Variable number of parameters.['number','...']

  api?:
  
  contract(arguments)
    .params('string', 'array', '...')
    .params('number')
    .end()
  
*/
"use strict";

var noop = {};
var util = require('util');
var _ = require('lodash');

noop.params = function(){
  return this;
};
noop.end = function(){};

var contract = function(args){
  if(contract.debug===true){
    contract.fulfilled = false;
    contract.args = _.toArray(args);
    contract.checkedParams = [];
    return contract;
  }else{
    return noop;
  }
};

contract.params = function(){
  var i, len;
  this.fulfilled |= checkParams(this.args, _.toArray(arguments));
  if(this.fulfilled){
    return noop;
  }else{
    this.checkedParams.push(arguments);
    return this;
  }
}
contract.end = function(){
  if(!this.fulfilled){
    printParamsError(this.args, this.checkedParams);
    throw new Error('Broke parameter contract');
  }
}

var typeOf = function(obj){
  return Array.isArray(obj) ? 'array':typeof obj;
};

var checkParams = function(args, contract){
  var fulfilled, types, type, i, j;
  
  if(args.length !== contract.length){
    return false;
  }else{
    for(i=0; i<args.length; i++){
      try{
        types = contract[i].split('|');
      }catch(e){
        console.log(e, args)
      }
      if (args[i]) {
        type = typeOf(args[i]);
        fulfilled = false;
        for(j=0; j<types.length; j++){
          if (type === types[j]){
            fulfilled = true;
            break;
          }
        }
      }
      if(fulfilled===false){
        return false;
      }
    }
    return true;
  }
};

var printParamsError = function(args, checkedParams){
  var msg = 'Parameter mismatch.\nInput:\n( ',
      type,
      input,
      i;
  _.each(args, function(input, key){
    type = typeOf(input);
    if(key != 0){
      msg += ', '
    }
    msg += input + ': '+type;
  })

  msg += ')\nAccepted:\n';
  
  for (i=0; i<checkedParams.length;i++){
    msg += '('+ argsToString(checkedParams[i]) + ')\n';
  }

  console.log(msg);
};

var argsToString = function(args){
  var res = "";
  _.each(args, function(arg, key){
    if(key != 0){
      res += ', ';
    }
    res += arg;
  })
  return res;
}

exports = module.exports = contract;

