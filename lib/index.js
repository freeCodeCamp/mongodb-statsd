const { Observable } = require('rxjs');
const debug = require('debug');

const readers = require('./readers');
const writer = require('./writer');
const config = require('../config.js');

const log = debug('mngstd:main');

function fetchDataForServer(serverConfig, counterCache) {
  log('getting server status');
  const tranformToGraphite = writer.createGraphiteTransform(
    serverConfig,
    config.metrics.serverStatus,
    counterCache,
  );
  return readers
    .connectToMongoDb(serverConfig, readers.fetchServerStatus)
    .map(tranformToGraphite)
    .switchMap(writer.sendToGraphite);
}

function fetchReplicaStatus(serverConfig) {
  log('getting repl status');
  return readers
    .connectToMongoDb(serverConfig, readers.replSetGetStatus)
    .map(writer.replicaSetToGraphiteMetrics)
    .switchMap(writer.sendToGraphite);
}

const counter = config.servers.map(() => new Map());

const serverStatus = Observable.from(config.servers)
  .concatMap((server, index) => fetchDataForServer(server, counter[index]))
  .toArray()
  .do(() => log('ServerStatus fetched and set to graphite'))
  .catch(err => {
    console.error(err);
    return Observable.empty();
  });

const replStat = !config.isReplSet ?
  Observable.empty() :
  Observable.from(config.servers)
    .groupBy(server => server.cluster)
    .concatMap(group => group.concatMap(fetchReplicaStatus))
    .do(null, null, () => log('ReplicaSetStatus fetched and set to graphite'))
    .catch(err => {
      console.error(err);
      return [];
    });

Observable.interval(config.intervalSeconds * 1000)
  .startWith(0)
  .switchMap(() => Observable.merge(serverStatus, replStat))
  .subscribe(null, err => {
    throw err;
  });
