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

var noop = {};

noop.params = function(){
  return this;
};
noop.end = function(){};

var contract = function(args){
  if(contract.debug===true){
    contract.fulfilled = false;
    contract.args = args;
    contract.checkedParams = [];
    return contract;
  }else{
    return noop;
  }
};

contract.params = function(){
  var i, len;
  this.fulfilled |= checkParams(this.args, arguments);
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
  return Array.isArray(obj)?'array':typeof obj;
};

var checkParams = function(args, contract){
  var fulfilled, types, type, i, j, len;
  if(args.length !== contract.length){
    return false;
  }else{
    for(i=0, len=args.length;i<len;i++){
      types = contract[i].split('|');
      type = typeOf(args[i]);
      fulfilled = false;
      for(j=0, len=types.length;j<len;j++){
        if (type === types[j]){
          fulfilled = true;
          break;
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
  var msg = 'Parameter missmatch.\nInput:\n( ',
      type,
      input,
      i;
  for(input in args){
    type = typeOf(args[input]);
    msg += args[input] + '{'+type+'} ';
  }
  
  msg += ')\nAccepted:\n';
  
  for (i=0; i<checkedParams.length;i++){
    msg += '('+ checkedParams[i] + ')\n';
  }

  console.log(msg);
};

exports = module.exports = contract;

