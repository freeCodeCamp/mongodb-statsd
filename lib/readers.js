const { Observable } = require('rxjs');
const { MongoClient } = require('mongodb');
const debug = require('debug');
const config = require('../config.js');

const log = debug('mngstd:writer');
const { username, password } = config;
let baseURI = 'mongodb://';
baseURI = username && password ? baseURI + `${username}:${password}@` : baseURI;

const runCommand = (inst, command, ...args) =>
  Observable.defer(() => {
    const func = inst[command];
    if (typeof func === 'function') {
      throw new TypeError(`could not find func ${command}`);
    }
    return Observable.bindNodeCallback(func).apply(inst, args);
  });

function connectToMongoDb({ host, port = 27017 }) {
  return Observable.defer(() => {
    const uri = `${baseURI}${host}:${port}/admin`;
    log(`Connecting to mongodb: ${uri}`);
    return Observable.create(obs => {
      let db;
      log('creating connection');
      MongoClient.connect(uri, (err, _db) => {
        if (err) {
          return obs.error(err);
        }
        log('db created');
        db = _db;
        obs.next(db);
        return obs.complete();
      });
      return () => {
        if (db) {
          db.close();
          db = null;
        }
      };
    });
  });
}

function fetchServerStatus(db) {
  return Observable.defer(() => {
    log('fetching serverStatus');
    return Observable.fromPromise(db.command({ serverStatus: 1 }));
  });
}

function fetchServerInfo(db) {
  return Observable.defer(() => {
    log('fetching serverInfo');
    const admin = db.admin();
    return runCommand(admin, 'serverInfo');
  });
}

function replSetGetStatus(db) {
  return Observable.defer(() => {
    log('fetching replSetStatus');
    const admin = db.admin();
    return Observable.fromPromise(admin.replSetGetStatus());
  });
}

function listDatabases(db) {
  return Observable.defer(() => {
    log('fetching database list');
    const admin = db.admin();
    return runCommand(admin, 'listDatabases');
  });
}

function dbStats({ db, data: { databases } }) {
  return Observable.from(databases)
    .map(({ name }) => name)
    .do(name => log('getting dbStats for %s', name))
    .map(name => db.db(name))
    .mergeMap(db => runCommand(db, 'stats'))
    .toArray();
}

module.exports = {
  connectToMongoDb,
  dbStats,
  fetchServerInfo,
  fetchServerStatus,
  listDatabases,
  replSetGetStatus,
};
