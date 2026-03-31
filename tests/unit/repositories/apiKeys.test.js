'use strict';

// DB_PATH deve essere ':memory:' prima che database.js venga caricato
process.env.DB_PATH = ':memory:';

const { findByKey } = require('../../../src/repositories/apiKeys');

describe('apiKeys repository', () => {
  describe('findByKey', () => {
    it('restituisce il record per la chiave di seed', () => {
      const result = findByKey('dev-key-1234');

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        id: expect.any(Number),
        key: 'dev-key-1234',
        client_name: expect.any(String),
      });
    });

    it('restituisce null per una chiave inesistente', () => {
      const result = findByKey('chiave-non-esistente');

      expect(result).toBeNull();
    });
  });
});
