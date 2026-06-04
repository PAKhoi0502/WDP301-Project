const crypto = require('crypto');

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

const compareToken = (token, tokenHash) => {
    return hashToken(token) === tokenHash;
};

module.exports = {
    hashToken,
    compareToken,
};
