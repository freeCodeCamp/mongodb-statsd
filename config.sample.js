/* eslint-disable quote-props */
module.exports = {
  // set true for replica sets
  // set false for standalone
  isReplSet: true,
  graphiteHost: 'you.graphite.server',
  graphitePort: 2003,

  intervalSeconds: 10,

  graphiteKeyTemplateGauges: ({ cluster, host, metric }) =>
    `mongodb.databases.${cluster}.${host}.${metric}.mean`,
  graphiteKeyTemplateCounters: ({ cluster, host, metric }) =>
    `mongodb.databases.${cluster}.${host}.${metric}.count`,

  // when auth is needed
  // mongo: {
  //   user: null,
  //   password: null,
  //   authDB: null,
  // },
  servers: [
    {
      host: 'mongo-server-01',
      port: '27017',
      // optional
      shortName: 'mongo_01',
      // optional
      cluster: 'main',
      // for replicate set member lookup
      // must match replicate server name
      setMemberName: 'mongo-server-01:27017',
    },
    {
      host: 'mongo-server-02',
      port: '27017',
      shortName: 'mongo_02',
      cluster: 'main',
      setMemberName: 'mongo-server-02:27017',
    },
    {
      host: 'mongo-server-03',
      port: '27017',
      shortName: 'mongo_03',
      cluster: 'main',
      setMemberName: 'mongo-server-03:27017',
    },
  ],

  metrics: {
    replSetGetStatus: 1,

    serverStatus: {
      connections: {
        current: 'gauge',
        available: 'gauge',
        totalCreated: 'counter',
      },

      backgroundFlushing: {
        last_ms: 'gauge',
        average_ms: 'gauge',
        total_ms: 'gauge',
        flushes: 'counter',
      },

      asserts: {
        regular: 'counter',
        warning: 'counter',
        msg: 'counter',
        user: 'counter',
        rollovers: 'counter',
      },

      cursors: {
        totalOpen: 'gauge',
        timedOut: 'counter',
      },

      opcounters: {
        command: 'counter',
        delete: 'counter',
        getmore: 'counter',
        insert: 'counter',
        query: 'counter',
        update: 'counter',
      },

      opcountersRepl: {
        command: 'counter',
        delete: 'counter',
        getmore: 'counter',
        insert: 'counter',
        query: 'counter',
        update: 'counter',
      },

      dur: {
        commits: 'counter',
        journaledMB: 'gauge',
        writeToDataFilesMB: 'gauge',
        commitsInWriteLock: 'counter',
        earlyCommits: 'counter',
        timeMS: {
          dt: 'gauge',
          prepLogBuffer: 'gauge',
          writeToJournal: 'gauge',
          writeToDataFiles: 'gauge',
          remapPrivateView: 'gauge',
        },
      },

      extra_info: {
        heap_usage_bytes: 'gauge',
        page_faults: 'counter',
      },

      indexCounters: {
        accesses: 'counter',
        hits: 'counter',
        misses: 'counter',
        resets: 'counter',
        missRatio: 'gauge',
      },

      network: {
        bytesIn: 'counter',
        bytesOut: 'counter',
        numRequests: 'counter',
      },

      repl: {
        ismaster: 'gauge',
      },

      recordStats: {
        accessesNotInMemory: 'counter',
        pageFaultExceptionsThrown: 'counter',
      },

      metrics: {
        document: {
          deleted: 'counter',
          inserted: 'counter',
          updated: 'counter',
        },

        getLastError: {
          wtime: {
            num: 'counter',
            totalMillis: 'counter',
            wtimeouts: 'counter',
          },
        },
        operation: {
          fastmod: 'counter',
          idhack: 'counter',
          scanAndOrder: 'counter',
        },
        queryExecutor: { scanned: 'counter' },
        record: { moves: 'counter' },

        repl: {
          apply: {
            batches: {
              num: 'counter',
              totalMillis: 'counter',
            },
            ops: 'counter',
          },
          buffer: {
            count: 'counter',
            sizeBytes: 'gauge',
          },
          network: {
            bytes: 'counter',
            getmores: { num: 'counter', totalMillis: 'counter' },
            ops: 'counter',
          },
          oplog: {
            insert: { num: 'counter', totalMillis: 'counter' },
            insertBytes: 'counter',
          },
          preload: {
            docs: { num: 'counter', totalMillis: 'counter' },
            indexes: { num: 'counter', totalMillis: 'counter' },
          },
        },

        ttl: {
          deletedDocuments: 'counter',
          passes: 'counter',
        },
      },

      globalLock: {
        lockTime: 'counter',
        currentQueue: {
          total: 'gauge',
          readers: 'gauge',
          writers: 'gauge',
        },
        activeClients: {
          total: 'gauge',
          readers: 'gauge',
          writers: 'gauge',
        },
      },

      mem: {
        resident: 'gauge',
        virtual: 'gauge',
        mapped: 'gauge',
        mappedWithJournal: 'gauge',
      },
    },
  },
};
