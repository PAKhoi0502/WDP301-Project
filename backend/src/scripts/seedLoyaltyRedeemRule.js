const LoyaltyRedeemRule = require('../modules/loyalty/loyaltyRedeemRule.model');

const redeemRule = {
    point_value_amount: 1000,
    min_redeem_points: 1,
    redeem_step: 1,
    max_redeem_percent: 50,
    is_active: true,
};

const seedLoyaltyRedeemRule = async () => {
    const existingActiveRule = await LoyaltyRedeemRule.findOne({ is_active: true });

    if (existingActiveRule) {
        Object.assign(existingActiveRule, redeemRule);
        await existingActiveRule.save();
        console.log('Updated loyalty redeem rule');
        return;
    }

    await LoyaltyRedeemRule.create(redeemRule);

    console.log('Created loyalty redeem rule');
};

module.exports = seedLoyaltyRedeemRule;
