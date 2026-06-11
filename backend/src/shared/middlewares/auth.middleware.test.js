jest.mock('../../modules/users/user.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../utils/jwt', () => ({
    verifyAccessToken: jest.fn(),
}));

const User = require('../../modules/users/user.model');
const { verifyAccessToken } = require('../utils/jwt');
const { authenticate, optionalAuthenticate } = require('./auth.middleware');

describe('auth middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('allows a request without a token through optional authentication', async () => {
        const req = { headers: {} };
        const next = jest.fn();

        await optionalAuthenticate(req, {}, next);

        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalledWith();
        expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it('still requires a token for mandatory authentication', async () => {
        const req = { headers: {} };
        const next = jest.fn();

        await authenticate(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            errorCode: 'ACCESS_TOKEN_REQUIRED',
        }));
    });

    it('loads the authenticated user when an optional token is provided', async () => {
        const user = {
            _id: '507f1f77bcf86cd799439011',
            is_active: true,
        };
        const req = {
            headers: {
                authorization: 'Bearer valid-token',
            },
        };
        const next = jest.fn();

        verifyAccessToken.mockReturnValue({
            user_id: user._id,
        });
        User.findById.mockResolvedValue(user);

        await optionalAuthenticate(req, {}, next);

        expect(req.user).toBe(user);
        expect(next).toHaveBeenCalledWith();
    });
});
