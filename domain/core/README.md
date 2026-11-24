# @hmpt/domain-core

The rules: drawing a page count from the range, one card per day (first drawer wins), a
reading log that is final but can grow (actual pages read, goal met by pages or by a finished book), streaks that survive an unread today, reader levels, the bookshelf
(the book in hand, books finished), twenty-three achievements (never taken back), and the reminder policy (after the time, once a day, only while unread).

Entry points (the `exports` map is the wall): `.` → `createReadingApp`, `createReminderCheck`;
`./testing` → in-memory fakes for tests and previews.
