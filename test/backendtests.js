var chai = require("chai");
var expect = chai.expect;

var testData = {
    key1: ["1", "2", "3"],
    key2: ["3", "2", "4"],
    key3: ["3", "4", "5"],
};
var buckets = ["bucket1", "bucket2"];

describe("unions", function () {
    let backend;

    before(function (done) {
        require("./create-backend")()
            .then((b) => {
                backend = b;

                if (!backend.unions) {
                    this.skip();
                }

                backend.clean(function () {
                    var transaction = backend.begin();
                    Object.keys(testData).forEach(function (key) {
                        buckets.forEach(function (bucket) {
                            backend.add(transaction, bucket, key, testData[key]);
                        });
                    });
                    backend.end(transaction, done);
                });
            })
            .catch(done);
    });

    after(function (done) {
        if (!backend) return done();
        backend.clean((err) => {
            if (err) return done(err);
            backend.close(done);
        });
    });

    it("should respond with an appropriate map", function (done) {
        var expected = {
            bucket1: ["1", "2", "3", "4", "5"],
            bucket2: ["1", "2", "3", "4", "5"],
        };
        backend.unions(buckets, Object.keys(testData), function (err, result) {
            expect(err).to.be.null;
            expect(result).to.be.eql(expected);
            done();
        });
    });

    it("should get only the specified keys", function (done) {
        var expected = {
            bucket1: ["1", "2", "3"],
            bucket2: ["1", "2", "3"],
        };
        backend.unions(buckets, ["key1"], function (err, result) {
            expect(err).to.be.null;
            expect(result).to.be.eql(expected);
            done();
        });
    });

    it("should only get the specified buckets", function (done) {
        var expected = {
            bucket1: ["1", "2", "3"],
        };
        backend.unions(["bucket1"], ["key1"], function (err, result) {
            expect(err).to.be.null;
            expect(result).to.be.eql(expected);
            done();
        });
    });
});
