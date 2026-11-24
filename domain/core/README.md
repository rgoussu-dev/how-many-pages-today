# @hmpt/domain-core

The rules: drawing a page count from the range, one card per day (first drawer wins),
streaks that survive an unread today, reader levels, sixteen achievements (never taken
back), and the reminder policy (after the time, once a day, only while unread).

Entry points (the `exports` map is the wall): `.` → `createReadingApp`, `createReminderCheck`;
`./testing` → in-memory fakes for tests and previews.
