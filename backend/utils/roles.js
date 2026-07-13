// Account roles that carry full agency-operator powers across the API (assignment,
// reminders, cross-county transparency): 'accg' (ACCG, the intermediary/mediator) and
// 'dca' (a state agency). Both can assign forms and see everything.
// (Role-specific, non-authorization branches — e.g. `role === 'county_user'` — stay as-is.)
const ADMIN_ROLES = ['accg', 'dca'];

const hasAdminPowers = (user) => !!user && ADMIN_ROLES.includes(user.role);

// Reviewing agencies: the state agencies that receive and review county submissions.
// ACCG is a mediator only and does NOT review — reviewing is agency-exclusive.
// Currently DCA is the only agency with a login; add more agency roles here as they gain one.
const AGENCY_ROLES = ['dca'];

const isReviewingAgency = (user) => !!user && AGENCY_ROLES.includes(user.role);

module.exports = { ADMIN_ROLES, hasAdminPowers, AGENCY_ROLES, isReviewingAgency };
