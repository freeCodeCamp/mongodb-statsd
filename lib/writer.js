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

function createGraphiteTransform(server, metricMap, lastMetrics) {
  const cluster = sanitizeKey(server.cluster);
  const host = sanitizeKey(server.shortName || server.host);
  return serverStatus => {
    const metrics = {
      keyValues: {},
      counters: {},
    };

    function getCounterDelta(key, currentValue) {
      metrics.counters[key] = currentValue;

      if (!lastMetrics || lastMetrics.counters[key] === undefined) {
        return 0;
      }

      // if current value is less than last then it has probably been reset
      if (currentValue < lastMetrics.counters[key]) {
        return currentValue;
      }

      return currentValue - lastMetrics.counters[key];
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
        metrics.keyValues[metricKey] = getCounterDelta(name, value);
      } else {
        metrics.keyValues[metricKey] = value;
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
  const metrics = { keyValues: {} };

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
    metrics.keyValues[key] = value;
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
    addMetric('replicaset_optime_i', member.optime.i, server);

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

function sendToGraphite(metrics) {
  return write(metrics.keyValues);
}

module.exports = {
  replicaSetToGraphiteMetrics,
  sendToGraphite,
  createGraphiteTransform,
};
