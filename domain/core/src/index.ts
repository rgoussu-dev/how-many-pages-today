// The exports map's "." entry: factories returning driving ports. Nothing else of the
// core is reachable from outside the package.
export { createReadingApp, createReminderCheck } from './reading-app';
export type { ReadingApp, ReadingDeps, ReminderCheckDeps } from './reading-app';
