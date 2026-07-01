jest.mock('../../modules/users/user.model', () => ({
    findById: jest.fn(),
}));

jest.mock('../utils/jwt', () => ({
    verifyAccessToken: jest.fn(),
}));

const User = require('../../modules/users/user.model');
const { verifyAccessToken } = require('../utils/jwt');
const { authenticate, optionalAuthenticate, authorize } = require('./auth.middleware');
const { USER_ROLES } = require('../constants/roles.constant');
const {
    USER_ONBOARDING_STATUSES,
} = require('../constants/userOnboarding.constant');

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

    it('blocks staff protected routes until staff onboarding is complete', () => {
        const req = {
            user: {
                role: USER_ROLES.STAFF,
                phone_verified_at: null,
                onboarding_status: USER_ONBOARDING_STATUSES.PENDING_PHONE_VERIFICATION,
            },
        };
        const next = jest.fn();

        authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN)(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 403,
            errorCode: 'STAFF_ONBOARDING_INCOMPLETE',
        }));
    });

    it('allows active verified staff through staff protected routes', () => {
        const req = {
            user: {
                role: USER_ROLES.STAFF,
                phone_verified_at: new Date(),
                onboarding_status: USER_ONBOARDING_STATUSES.ACTIVE,
            },
        };
        const next = jest.fn();

        authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN)(req, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    it('treats legacy verified staff without onboarding status as active', () => {
        const req = {
            user: {
                role: USER_ROLES.STAFF,
                phone_verified_at: new Date(),
            },
        };
        const next = jest.fn();

        authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN)(req, {}, next);

        expect(next).toHaveBeenCalledWith();
    });
});
