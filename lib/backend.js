/**
	Backend Interface.
	
	Implement this API for providing a backend for the acl module.
*/

var contract = require('./contract');

var Backend = {
  /**  
     Begins a transaction.
  */
  begin : function(){
    // returns a transaction object
  },
  
  /**
     Ends a transaction (and executes it)
  */
  end : function(transaction, cb){
		contract(arguments).params('object', 'function').end();
    // Execute transaction
  },
  
  /**
    Cleans the whole storage.
  */
  clean : function(cb){
    contract(arguments).params('function').end();
  },
  
  /**
     Gets the contents at the bucket's key.
  */
  get : function(bucket, key, cb){
		contract(arguments)
	      .params('string', 'string|number', 'function')
	      .end();
  },

	/**
		Returns the union of the values in the given keys.
	*/
  union : function(bucket, keys, cb){
    contract(arguments)
  	  .params('string', 'array', 'function')
  	  .end();
	},
  
  /**
		Adds values to a given key inside a bucket.
	*/
	add : function(transaction, bucket, key, values){
		contract(arguments)
	      .params('object', 'string', 'string|number','string|array|number')
        .end();
	},
    
  /**
     Delete the given key(s) at the bucket
  */
  del : function(transaction, bucket, keys){
		contract(arguments)
	      .params('object', 'string', 'string|array')
	      .end();
  },
  
	/**
		Removes values from a given key inside a bucket.
	*/
	remove : function(transaction, bucket, key, values){
		contract(arguments)
	      .params('object', 'string', 'string|number','string|array|number')
        .end();
	},
}

exports = module.exports = Backend;
