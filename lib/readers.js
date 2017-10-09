const { Observable } = require('rxjs');
const { MongoClient } = require('mongodb');
const debug = require('debug');
const config = require('../config.js');

const log = debug('mngstd:readers');
const { auth: { username, password, authDB = 'auth' } = {} } = config;
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

const connectToMongoDb = ({ host, port = 27017 }, fn) =>
  Observable.create(obs => {
    const uri = `${baseURI}${host}:${port}/${authDB}`;
    log(`Connecting to mongodb: ${uri}`);
    let db;
    let subscription;
    MongoClient.connect(uri, (err, _db) => {
      if (err) {
        return obs.error(err);
      }
      log('db created');
      db = _db;
      subscription = fn(db)
        .catch(err => {
          err.host = host || 'unknown';
          return Observable.throw(err);
        })
        .subscribe(obs);
      return null;
    });
    return () => {
      if (db) {
        log('closing db connection');
        db.close();
        db = null;
      }
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  });

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
    const admin = db.admin();
    log('fetching replSetStatus');
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
