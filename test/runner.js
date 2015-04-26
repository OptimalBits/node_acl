var Acl = require('../')
  , tests = require('./tests')

describe('MongoDB - Default', function () {
  before(function (done) {
    var self = this
      , mongodb = require('mongodb')

    mongodb.connect('mongodb://localhost:27017/acltest',function(error, db) {
      db.dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(db, "acl")
        done()
      })
    })
  })

  run()
});


describe('MongoDB - useSingle', function () {
  before(function (done) {
    var self = this
      , mongodb = require('mongodb')

    mongodb.connect('mongodb://localhost:27017/acltest',function(error, db) {
      db.dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(db, "acl", true)
        done()
      })
    })
  })

  run()
});

// Attention: keyspace and columnfamily must exist beforehand
describe('Cassandra', function () {
  before(function (done) {
    var self = this
      , cassandra = require('cassandra-driver');

    client = new cassandra.Client({contactPoints: ['127.0.0.1']});
    client.connect(function(err) {
      if (err) return done(err);
      client.execute("TRUNCATE acltest.acl", [], function(err) {
        if (err) return done(err);
        self.backend = new Acl.cassandraBackend(client, "acltest", "acl");
        done()
      });
    });
  });

  run()
});

describe('Redis', function () {
  before(function (done) {
    var self = this
      , options = {
          host: '127.0.0.1',
          port: 6379,
          password: null
        }
      , Redis = require('redis')


    var redis = Redis.createClient(options.port, options.host,  {no_ready_check: true} )

    function start(){
      self.backend = new Acl.redisBackend(redis)
      done()
    }

    if (options.password) {
      redis.auth(options.password, start)
    } else {
      start()
    }
  })

  run()
})


describe('Memory', function () {
  before(function () {
    var self = this
      self.backend = new Acl.memoryBackend()
  })

  run()
})

function run() {
  Object.keys(tests).forEach(function (test) {
    tests[test]()
  })
}