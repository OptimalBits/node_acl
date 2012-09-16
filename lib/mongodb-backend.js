/**
	MongoDB Backend.
  Implementation of the storage backend using MongoDB
*/

var mongodb = require('mongodb'); 
var contract = require('./contract');
var async = require('async');
var _ = require('underscore');

function isDeadlocked(cb){
  cb.__deferCount = (cb.__deferCount || 0) +1;
  return cb.__deferCount>10;
}

function MongoDBBackend(client, collectionName){
  this.client = client;
  collectionName = collectionName||"acl";
  this.collection   = new mongodb.Collection(client, collectionName);
  this.transactions = new mongodb.Collection(client, collectionName+"-transactions");
}

MongoDBBackend.prototype = {
 /**  
     Begins a transaction.
  */
  begin : function(){
    // returns a transaction object(just an array of functions will do here.)
    return [];
  },
  
  /**
     Ends a transaction (and executes it)
  */
  end : function(transaction, cb){
  	contract(arguments).params('array', 'function').end();
    
    var self = this;
    self.transactions.find().toArray(function(err,docs){
      // if a transaction is in progress, wait
      if(docs.length){
        console.log("transaction in progress while starting new transaction, deferring...");
        return setTimeout(function(){
          if(isDeadlocked(cb)) return cb(new Error("Cannot start new transaction, deadlock"));
          self.end(transaction,cb);
        },0);
      }
      var transactionId = ("" + Math.random()).replace(".","");      
      self.transactions.save({transactionId:transactionId},{save:true},function(err,doc){
        // Execute transactions serially, remove transaction doc and return
        async.series(transaction,function(err,results){
          self.transactions.remove({"_id":doc._id});
          cb(err||undefined);
        });      
      });
    });
  },
  
  /**
    Cleans the whole storage.
  */
  clean : function(cb){
    contract(arguments).params('function').end();
    var self = this;
    this.collection.remove(null, {safe:true}, function(err){
      self.transactions.remove(null, {safe:true}, function(err){
        cb(err||undefined);
      });   
    }); 
  },
  
  /**
     Gets the contents at the bucket's key.
  */
  get : function(bucket, key, cb){
		contract(arguments)
	      .params('string', 'string', 'function')
	      .end();
        
    var self=this;
    self.transactions.find().toArray(function(err,docs){
      // if a transaction is in progress, wait  
      if(docs.length){
        console.log("transaction in progress while trying to get(), deferring...");
        return setTimeout(function(){
          if(isDeadlocked(cb)) return cb(new Error("Cannot get(), deadlock"));
          self.get(bucket, key, cb);
        },0);  
      }        
      // otherwise, find the document  
      self.collection.findOne(
        {bucket:bucket,key:key}, 
        function(err, doc){
          if(err) return cb(err);
          if(!doc) return cb(undefined,[]);
          cb(null,doc.value||[]);
        }
      );
    });
  },

	/**
		Returns the union of the values in the given keys.
	*/
  union : function(bucket, keys, cb){
    contract(arguments)
  	  .params('string', 'array', 'function')
  	  .end();
      
    var self=this;
    self.transactions.find().toArray(function(err,docs){
      // if a transaction is in progress, wait  
      if(docs.length){
        console.log("transaction in progress while trying to union(), deferring...");
        return setTimeout(function(){
          if(isDeadlocked(cb)) return cb(new Error("Cannot union(), deadlock"));
          self.union(bucket, keys, cb);
        },0);  
      }        
      // otherwise, find the document        
      self.collection.find(
        {bucket: bucket, key: { $in: keys }}, 
        {fields:{value:1}}
      ).toArray(function(err,docs){ 
        if(err) return cb(err);
        if( ! docs.length ) return cb(undefined, []);
        var keyArrays = [];
        docs.forEach(function(doc){
          keyArrays.push.apply(keyArrays, doc.value);
        });
        cb(undefined, _.union(keyArrays));
      });
    });
	},
  
  /**
		Adds values to a given key inside a bucket.
	*/
	add : function(transaction, bucket, key, values){
		contract(arguments)
	      .params('array', 'string', 'string','string|array')
        .end();
        
    values = makeArray(values);
    var collection = this.collection;
    transaction.push(function(cb){
      collection.findOne({bucket:bucket,key:key},function(err,doc){
        if (!doc) {
          collection.insert(
            {bucket:bucket,key:key,value:values},
            {safe:true},
            function(err){cb(err||undefined);}
          ); 
        } else {
          collection.update(
            {bucket:bucket,key:key},
            {$set:{value:_.union(doc.value,values)}},
            {safe:true},
            function(err){cb(err||undefined);}
          );
        }
      });
    });
	},
    
  /**
     Delete the given key(s) at the bucket
  */
  del : function(transaction, bucket, keys){
		contract(arguments)
	      .params('array', 'string', 'string|array')
	      .end();
    keys = makeArray(keys);
    var collection = this.collection;
    transaction.push(function(cb){
      collection.remove(
        {bucket:bucket,key:{$in:keys}}, 
        {safe:true}, 
        function(err){cb(err||undefined);}
      );
    })
  },
  
	/**
		Removes values from a given key inside a bucket.
	*/
	remove : function(transaction, bucket, key, values){
		contract(arguments)
	      .params('array', 'string', 'string','string|array')
        .end();
        
    var collection = this.collection;
    values = makeArray(values);
    transaction.push(function(cb){
      collection.findOne({bucket:bucket,key:key}, function(err, doc){
        if(err) return cb(err);
        if(!doc) return cb(undefined,[]);
        collection.update(
          {bucket:bucket,key:key}, 
          {$set:{value: _.difference(doc.value, values) }},
          {safe:true},
          function(err){cb(err||undefined);}
        );
      });
    });
	},
}

function makeArray(arr){
  return Array.isArray(arr) ? arr : [arr];
}

exports = module.exports = MongoDBBackend;