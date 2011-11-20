

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
      console.log(arguments);
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

exports = module.exports = Contract;
