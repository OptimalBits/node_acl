/**
	Redis Backend.
	
  Implementation of the storage backend using Redis
*/
"use strict";

var contract = require('./contract');

function noop(){};

function RedisBackend(redis, prefix){
  this.redis = redis;
  this.prefix = prefix || 'acl';
}

RedisBackend.prototype = {
  
  /**  
     Begins a transaction
  */
  begin : function(){
    return this.redis.multi();
  },
  
  /**
     Ends a transaction (and executes it)
  */
  end : function(transaction, cb){
		contract(arguments).params('object', 'function').end();
    transaction.exec(function(){cb()});
  },
  
  /**
    Cleans the whole storage.
  */
  clean : function(cb){
    contract(arguments).params('function').end();
    var self = this;
    self.redis.keys(self.prefix+'*', function(err, keys){
      if(keys.length){
        self.redis.del(keys, function(){cb()});
      }else{
        cb();
      }
    });
  },
  
  /**
     Gets the contents at the bucket's key.
  */
  get : function(bucket, key, cb){
		contract(arguments)
	      .params('string', 'string|number', 'function')
	      .end();

    key = this.bucketKey(bucket, key);
    
    this.redis.smembers(key, cb);
  },
  
	/**
		Returns the union of the values in the given keys.
	*/
	union : function(bucket, keys, cb){
		contract(arguments)
	      .params('string', 'array', 'function')
	      .end();
    
    keys = this.bucketKey(bucket, keys);
    this.redis.sunion(keys, cb);
	},
  
	/**
		Adds values to a given key inside a bucket.
	*/
	add : function(transaction, bucket, key, values){
		contract(arguments)
	      .params('object', 'string', 'string|number','string|array|number')
        .end();
            
    key = this.bucketKey(bucket, key);
            
    if (Array.isArray(values)){
      values.forEach(function(value){
        transaction.sadd(key, value);
      });
    }else{
      transaction.sadd(key, values);
    }
	},
  
  /**
     Delete the given key(s) at the bucket
  */
  del : function(transaction, bucket, keys){
		contract(arguments)
	      .params('object', 'string', 'string|array')
	      .end();
            
    var self = this;
    
    keys = Array.isArray(keys) ? keys : [keys]
    
    keys = keys.map(function(key){
      return self.bucketKey(bucket, key);
    });
  
    transaction.del(keys);
  },
  
	/**
		Removes values from a given key inside a bucket.
	*/
	remove : function(transaction, bucket, key, values){
		contract(arguments)
	      .params('object', 'string', 'string|number','string|array|number')
        .end();
                  
    key = this.bucketKey(bucket, key);
        
    if (Array.isArray(values)){
      values.forEach(function(value){
        transaction.srem(key, value);
      });
    }else{
      transaction.srem(key, values);
    }
  },
  
  //
  // Private methods
  //
    
  bucketKey : function(bucket, keys){
    var self = this;
    if(Array.isArray(keys)){
      return keys.map(function(key){
        return self.prefix+'_'+bucket+'@'+key;
      });
    }else{
      return self.prefix+'_'+bucket+'@'+keys;
    }
  }
}

exports = module.exports = RedisBackend;
