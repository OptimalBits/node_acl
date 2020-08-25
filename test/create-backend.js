const Acl = require("../");

module.exports = async function createBackend(backendType) {
    backendType = backendType || process.env.ACL_BACKEND;

    if (backendType === "memory") return new Acl.memoryBackend();

    if (backendType === "redis") {
        const options = {
            host: "127.0.0.1",
            port: 6379,
            password: null,
        };

        const redis = require("redis").createClient(options.port, options.host, {
            no_ready_check: true,
        });

        return new Acl.redisBackend(redis);
    }

    if (backendType === "mongo") {
        const client = await require("mongodb").connect("mongodb://localhost:27017/acl_test");
        const db = client.db("acl_test");
        await db.dropDatabase();
        return new Acl.mongodbBackend({ client, db, prefix: "acl_" });
    }

    if (backendType === "mongo_single") {
        const client = await require("mongodb").connect("mongodb://localhost:27017/acl_test");
        const db = client.db("acl_test");
        await db.dropDatabase();
        return new Acl.mongodbBackend({ client, db, prefix: "acl_", useSingle: true });
    }

    throw new Error("Please assign ACL_BACKEND env var to one of: memory, redis, mongo, mongo_single");
};
