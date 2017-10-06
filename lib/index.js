const { Observable } = require('rxjs');
const debug = require('debug');

const readers = require('./readers');
const writer = require('./writer');
const config = require('../config.js');

const log = debug('mngstd:main');

function fetchDataForServer(serverConfig, lastMetrics) {
  log('getting server status');
  const tranformToGraphite = writer.createGraphiteTransform(
    serverConfig,
    config.metrics.serverStatus,
    lastMetrics,
  );
  return readers
    .connectToMongoDb(serverConfig)
    .switchMap(readers.fetchServerStatus)
    .map(tranformToGraphite)
    .map(writer.sendToGraphite);
}

function fetchReplicaStatus(serverConfig) {
  log('getting repl status');
  return readers
    .connectToMongoDb(serverConfig)
    .switchMap(readers.replSetGetStatus)
    .map(writer.replicaSetToGraphiteMetrics)
    .switchMap(writer.sendToGraphite);
}

let lastResultArray = [];

const serverStatus = Observable.from(config.servers)
  .concatMap((server, index) =>
    fetchDataForServer(server, lastResultArray[index]),
  )
  .toArray()
  .do(success => {
    log('ServerStatus fetched and set to graphite');
    lastResultArray = success;
  })
  .catch(err => {
    console.error(err);
    return Observable.empty();
  });

const replStat = Observable.from(config.servers)
  .groupBy(server => server.cluster)
  .mergeMap(group => group.mergeMap(fetchReplicaStatus))
  .do(null, null, () => log('ReplicaSetStatus fetched and set to graphite'))
  .catch(err => {
    console.error(err);
    return [];
  });

Observable.interval(config.intervalSeconds * 1000)
  .switchMap(() => Observable.merge(serverStatus, replStat))
  .subscribe(null, err => {
    throw err;
  });
