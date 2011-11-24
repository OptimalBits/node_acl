

var Contract = {};

Contract.require = function(cond){
  if(debug){
    if(cond===false){
      throw new Error('Broke conditions:'+cond);
    }
  }
};
Contract.params = function(){
  if(this.debug){
    var i, len, 
        args = arguments[0], 
        fulfilled = false;
    for(i=1, len=arguments.length;i<len;i++){
      fulfilled |= this._checkParams(args, arguments[i]);
      if(fulfilled){
        break;
      }
    }
    if(!fulfilled){
      this._printParamsError(arguments);
      throw new Error('Broke parameter contract');
    }
  }
};
Contract._typeOf = function(obj){
  return Array.isArray(obj)?'array':typeof obj;
};
Contract._checkParams = function(args, contract){
  var fulfilled, types, type, i, j, len;
  if(args.length !== contract.length){
    return false;
  }else{
    for(i=0, len=args.length;i<len;i++){
      types = contract[i].split('|');
      type = this._typeOf(args[i]);
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
Contract._printParamsError = function(arguments){
  var msg = 'Parameter missmatch.\nInput:\n( ',
      type,
      input,
      i;
  for(input in arguments[0]){
    type = this._typeOf(arguments[0][input]);
    msg += arguments[0][input] + '{'+type+'} ';
  }
  
  msg += ')\nAccepted:\n';
  
  for (i=1; i<arguments.length;i++){
    msg += '('+ arguments[i] + ')\n';
  }
  
  console.log(msg);
};

exports = module.exports = Contract;
