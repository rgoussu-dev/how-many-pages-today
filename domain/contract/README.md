# @hmpt/domain-contract

The hexagon's contract face: the model (`DailyChallenge`, `Profile`, `PageRange`,
`ReminderSettings`, the book in hand and its bookmark, achievements, stats, the language
setting, `ReadingSnapshot`), the driving ports (one per use case — `LanguagePort` among them —
plus the `ReadingView` read model and the `ReminderCheckPort` for scheduled wake-ups), the
driven ports (repositories, `ReminderScheduler`, `Notifier`) and the domain events.

The contract carries no display text: achievements are ids and icons, ranks are numbers,
and a field error is a `FieldProblem` code with its limits. The UI words them.
