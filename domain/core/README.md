# @hmpt/domain-core

The rules: drawing a page count from the range, one card per day (first drawer wins), a
reading log that is final but can grow (actual pages read, goal met by pages or by a finished book), streaks that survive an unread today, reader levels, the bookshelf
(the book in hand, books finished) and its bookmark (where the reader is; the day's reading
leads to bookmark + goal, at most the last page; every page logged moves it on), twenty-three
achievements (never taken back), the monthly and yearly overview, the reminder policy (after
the time, once a day, only while unread) and its notification in the reader's language, and
the language itself (the reader's pick, or the device's best match, English by default).

Entry points (the `exports` map is the wall): `.` → `createReadingApp`, `createReminderCheck`;
`./testing` → in-memory fakes for tests and previews.
