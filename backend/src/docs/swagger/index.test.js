const openApiSpec = require('./index');

describe('OpenAPI server configuration', () => {
    it('uses the current origin for API requests', () => {
        expect(openApiSpec.servers).toEqual([
            {
                url: '/api/v1',
                description: 'Current server',
            },
        ]);
    });
});
