// Account roles that carry full agency-operator powers across the API.
// 'accg' is ACCG; 'dca' is the Georgia Dept. of Community Affairs (state agency).
// Both are agency operators and are treated identically for authorization.
// (Role-specific, non-authorization branches — e.g. `role === 'county_user'` — stay as-is.)
const ADMIN_ROLES = ['accg', 'dca'];

const hasAdminPowers = (user) => !!user && ADMIN_ROLES.includes(user.role);

module.exports = { ADMIN_ROLES, hasAdminPowers };
