# @hmpt/domain-contract

The hexagon's contract face: the model (`DailyChallenge`, `Profile`, `PageRange`,
`ReminderSettings`, achievements, stats, `ReadingSnapshot`), the driving ports (one per use
case, plus the `ReadingView` read model and the `ReminderCheckPort` for scheduled wake-ups),
the driven ports (repositories, `ReminderScheduler`, `Notifier`) and the domain events.
