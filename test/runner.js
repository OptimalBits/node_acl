var Acl = require('../')
  , tests = require('./tests')
  , backendTests = require('./backendtests');
const MongoClient = require('mongodb').MongoClient;

describe('MongoDB - Default', function () {
  before(function (done) {
    var self = this;

    MongoClient.connect('mongodb://localhost:27017',(err,client) => {
      const db = client.db('acltest');
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
    var self = this;

    MongoClient.connect('mongodb://localhost:27017',(err,client) => {
      const db = client.db('acltest');
      db.dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(db, "acl")
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
          password: process.env.REDIS_PASSWORD || 'admin'
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
