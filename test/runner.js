var Acl = require('../')
  , tests = require('./tests')
  , backendTests = require('./backendtests');

describe('MongoDB - Default', function () {
  before(function (done) {
    var self = this
      , { MongoClient }  = require('mongodb')

    var client = new MongoClient('mongodb://localhost:27017/acltest')
    client.connect(function(error, client) {
      client.db('acltest').dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(client, "acl")
        done()
      })
    })
  })

  run()
});


describe('MongoDB - useSingle', function () {
  before(function (done) {
    var self = this
      , { MongoClient } = require('mongodb')

    var client = new MongoClient('mongodb://localhost:27017/acltest')
    client.connect(function(error, client) {
      client.db('acltest').dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(client, "acl", true)
        done()
      })
    })
  })

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

  Object.keys(backendTests).forEach(function (test) {
    backendTests[test]()
  });
}
