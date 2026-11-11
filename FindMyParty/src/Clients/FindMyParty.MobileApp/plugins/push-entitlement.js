// Push notifications need the app's Apple provisioning profile to allow them. Until an APNs key is set up for
// the app on Expo (`eas credentials` → iOS → Push Notifications), a build that asks for the push entitlement
// fails. This takes the entitlement out unless the build sets FMP_PUSH=on, so builds keep working before then.
// Without it the app runs normally and simply gets no push token (services/push.ts stays silent).
// It is listed first in app.json on purpose: an entitlements change listed first runs last, after
// expo-notifications has added its own.
const { withEntitlementsPlist } = require('expo/config-plugins');

const pushOn = () => process.env.FMP_PUSH === 'on';

module.exports = function withOptionalPushEntitlement(config) {
  if (!pushOn() && config.ios?.entitlements) delete config.ios.entitlements['aps-environment'];
  return withEntitlementsPlist(config, (mod) => {
    if (!pushOn()) delete mod.modResults['aps-environment'];
    return mod;
  });
};
