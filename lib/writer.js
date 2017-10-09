const { Observable } = require('rxjs');
const graphite = require('graphite');
const _ = require('lodash');
const debug = require('debug');
const config = require('../config.js');

const log = debug('mngstd:writer');
const graphiteUrl = `plaintext://${config.graphiteHost}:${config.graphitePort}/`;
const graphiteClient = graphite.createClient(graphiteUrl);
const write = Observable.bindNodeCallback(
  graphiteClient.write.bind(graphiteClient),
);

function sanitizeKey(name = '') {
  return name.replace(/[^\w]/gi, '_');
}

function createGraphiteTransform(server, metricMap, counterCache) {
  const cluster = sanitizeKey(server.cluster);
  const host = sanitizeKey(server.shortName || server.host);
  return serverStatus => {
    const metrics = {};

    function getCounterDelta(key, currentValue) {
      const prevVal = counterCache.has(key) ? counterCache.get(key) : null;
      counterCache.set(key, currentValue);

      if (!prevVal) {
        return 0;
      }

      // if current value is less than last then it has probably been reset
      if (currentValue < prevVal) {
        return currentValue;
      }

      return currentValue - prevVal;
    }

    function addMetric(metrics, metricType, name, value) {
      if (typeof value === 'boolean') {
        value = value ? 1 : 0;
      }

      const templateData = {
        cluster,
        host,
        metric: sanitizeKey(name),
      };

      const metricKey =
        metricType === 'counter' ?
          config.graphiteKeyTemplateCounters(templateData) :
          config.graphiteKeyTemplateGauges(templateData);

      if (metricType === 'counter') {
        metrics[metricKey] = getCounterDelta(name, value);
      } else {
        metrics[metricKey] = value;
      }
      return metrics;
    }

    function recurMetrics(
      metrics,
      metricType,
      status,
      metricName,
      accumKey = '',
    ) {
      if (!status) {
        return metrics;
      }
      if (typeof status !== 'object') {
        return addMetric(metrics, metricType, metricName, status);
      }
      // status is an object
      return _.reduce(
        metricType,
        (metrics, metricType, metricName) =>
          recurMetrics(
            metrics,
            metricType,
            status[metricName],
            metricName,
            accumKey + ' ' + metricName,
          ),
        metrics,
      );
    }
    return recurMetrics(metrics, metricMap, serverStatus);
  };
}

function replicaSetToGraphiteMetrics(replicaStatus) {
  const metrics = {};

  function addMetric(flattendKey, value, server) {
    if (value === undefined) {
      return;
    }

    let key;

    const templateData = {
      cluster: sanitizeKey(server.cluster),
      host: sanitizeKey(server.shortName || server.host),
      metric: sanitizeKey(flattendKey),
    };

    key = config.graphiteKeyTemplateGauges(templateData);
    metrics[key] = value;
  }

  _.each(replicaStatus.members, function(member) {
    const server = _.find(config.servers, function(server) {
      return server.setMemberName === member.name;
    });
    if (!server) {
      throw { message: 'unable to find replica set member in server list ' };
    }

    addMetric('replicaset_health', member.health, server);
    addMetric('replicaset_state', member.state, server);
    addMetric('replicaset_ping_ms', member.pingMs, server);
    addMetric('replicaset_optime_i', member.optime, server);

    if (member.lastHeartbeat) {
      const lag = member.lastHeartbeat - member.optimeDate;
      addMetric('replicaset_lag_ms', lag, server);
    } else {
      const lag = replicaStatus.date - member.optimeDate;
      addMetric('replicaset_lag_ms', lag, server);
    }
  });
  return metrics;
}

const sendToGraphite = write;

module.exports = {
  replicaSetToGraphiteMetrics,
  sendToGraphite,
  createGraphiteTransform,
};
