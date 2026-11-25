import { PAGES_READ_LIMITS, type AchievementId, type ChallengeError, type FieldError, type ReminderError } from '@hmpt/domain-contract';

/*
 * The English phrasebook — the reference every other language must match, key for key
 * (the type of this object is `Messages`). Wording only: no markup, no user text.
 * Counted words carry their own plural rules; numbers arrive already formatted or are
 * formatted here.
 */

const number = new Intl.NumberFormat('en');
const n = (value: number) => number.format(value);
const count = (value: number, one: string, many = `${one}s`) => `${n(value)} ${value === 1 ? one : many}`;
const pages = (value: number) => count(value, 'page');
const days = (value: number) => count(value, 'day');

const ACHIEVEMENTS: Record<AchievementId, { readonly title: string; readonly description: string }> = {
  'first-challenge': { title: 'First chapter', description: 'Complete your first daily challenge.' },
  'streak-3': { title: 'Kindling', description: 'Read three days in a row.' },
  'streak-7': { title: 'A week of words', description: 'Read seven days in a row.' },
  'streak-30': { title: 'Monthly devotion', description: 'Read thirty days in a row.' },
  'streak-100': { title: 'Centurion', description: 'Read one hundred days in a row.' },
  'book-1': { title: 'The end', description: 'Finish your first book.' },
  'books-5': { title: 'A shelf of your own', description: 'Finish five books.' },
  'books-12': { title: 'A book a month', description: 'Finish twelve books.' },
  'pages-500': { title: 'Five hundred pages', description: 'Read 500 pages in total.' },
  'pages-1000': { title: 'A thousand pages', description: 'Read 1,000 pages in total.' },
  'pages-5000': { title: 'Bookworm', description: 'Read 5,000 pages in total.' },
  marathon: { title: 'Marathon', description: 'Read 100 pages or more in a single day.' },
  'beyond-goal': { title: 'Just one more chapter', description: "Read more than the day's goal." },
  'double-goal': { title: 'Burning the midnight oil', description: "Read at least twice the day's goal." },
  'extra-100': { title: 'Bonus chapters', description: 'Read 100 pages beyond your goals, all told.' },
  'page-binge': { title: 'Lost in a book', description: 'Read 200 pages or more in a single day.' },
  'little-by-little': { title: 'Little by little', description: 'Log a day short of the goal. Every page counts.' },
  'final-chapter': { title: 'The final chapter', description: "Finish a book on the day's reading." },
  'early-bird': { title: 'Early bird', description: 'Validate a challenge before 8 a.m.' },
  'night-owl': { title: 'Night owl', description: 'Validate a challenge after 10 p.m.' },
  weekend: { title: 'Weekend warrior', description: 'Read on both the Saturday and the Sunday of a weekend.' },
  comeback: { title: 'Back on the shelf', description: 'Return to reading after missing two days or more.' },
  introductions: { title: 'Pleased to meet you', description: 'Fill in your reader profile.' },
};

const REMINDER_ERRORS: Record<ReminderError, string> = {
  'invalid-time': 'Pick a time, like 20:30.',
  'permission-denied':
    'Notifications are blocked for this app. Allow them in your browser or phone settings, then try again.',
  unsupported:
    'This browser cannot show notifications here. On iPhone and iPad, add the app to your Home Screen first. The calendar reminder below works everywhere.',
  'delivery-failed': 'The notification could not be shown on this device. The calendar reminder below works everywhere.',
};

function fieldError({ field, problem, min, max }: FieldError): string {
  switch (problem) {
    case 'required':
      return field === 'displayName'
        ? 'Tell us what to call you.'
        : field === 'avatar'
          ? 'Pick an avatar.'
          : field === 'title'
            ? 'Which book is it?'
            : 'This one is needed.';
    case 'too-long':
      return `Keep it under ${max} characters.`;
    case 'not-whole':
      return field === 'pagesRead' ? 'Use a whole number of pages.' : 'Use a whole number.';
    case 'out-of-range':
      return field === 'pagesRead' ? `Between ${min} and ${max} pages.` : `Pick a number between ${min} and ${max}.`;
    case 'below-minimum':
      return 'The maximum cannot be below the minimum.';
    case 'past-the-end':
      return `The book ends at page ${max}.`;
    case 'no-book':
      return 'There is no book on the nightstand.';
  }
}

export const en = {
  common: {
    optional: '(optional)',
    title: 'Title',
    aBook: 'A book',
    saved: 'Saved ✓',
    save: 'Save',
    fieldError,
  },

  shell: {
    appName: 'How Many Pages Today',
    sections: 'Sections',
    tabs: { today: 'Today', progress: 'Progress', overview: 'Overview', profile: 'You' },
    regions: { today: 'Today', progress: 'Progress', overview: 'Overview', profile: 'Profile and settings' },
    headings: {
      progress: 'Your library',
      overview: 'Your reading, looked back on',
      profile: 'Your reading room',
    },
    titles: {
      today: 'How Many Pages Today',
      progress: 'Progress · How Many Pages Today',
      overview: 'Overview · How Many Pages Today',
      profile: 'You · How Many Pages Today',
    },
    footnote: "Everything stays on this device. Clearing the browser's site data erases it.",
    update: {
      notice: 'A new edition is on the shelf.',
      open: 'Open it',
      later: 'Later',
    },
    fatal:
      'Your reading card could not be dealt: this browser blocked local storage (private browsing?). Open the app in a regular window to keep your progress.',
  },

  /** The stops of the tour, as the shell marks them with `data-tour-stop`. */
  tour: {
    card: {
      title: 'Your daily card',
      text: 'Each day I lay a book on the table, closed. Tap it and it opens on the day’s page: a picture, a number of pages, and the page to read up to from your bookmark. Read, write the page you stopped at, and I close the book, write the day on a scroll and seal it in wax — red for a short day, orange for the goal, gold beyond it. Every page counts.',
    },
    candle: {
      title: 'Keep the candle lit',
      text: 'Read a little every day and this candle keeps burning. Your pages, your books and your rank as a reader are kept here too.',
    },
    library: {
      title: 'Your library',
      text: 'The book on your nightstand and its bookmark, your shelf of finished books, a ledger of the last six weeks, and your bookplates — the achievements you earn along the way.',
    },
    overview: {
      title: 'Looking back',
      text: 'Your months and years of reading, looked back on: pages, days, books — and your best days.',
    },
    room: {
      title: 'Your reading room',
      text: 'Your reader’s card, the language I speak, how big the daily challenge is, and a daily reminder at the hour you choose.',
    },
  },

  greeting: {
    hello: 'Hello',
    salutation: (hour: number): string =>
      hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening',
    named: (salutation: string, name: string) => `${salutation}, ${name}`,
    anonymous: (salutation: string) => `${salutation}!`,
    nightstand: 'On the nightstand: ',
    nightstandEnd: (bookmark: number | null): string => (bookmark === null || bookmark === 0 ? '.' : `, page ${n(bookmark)}.`),
    newHere: 'New here? ',
    fillCard: 'Fill in your reader’s card',
    laidOut: 'Your card for today has been laid out.',
  },

  card: {
    today: 'Today',
    unit: (count: number): string => (count === 1 ? 'page' : 'pages'),
    upTo: (page: number) => `up to page ${n(page)}`,
    toTheEnd: (page: number) => `to the end of the book — page ${n(page)}`,
    stoppedAt: 'I stopped at page',
    readOnTo: 'I read on to page',
    lastPageCheck: 'That was the last page',
    seal: 'Seal the day',
    book: {
      ask: 'First, the book on your nightstand — and the page your bookmark is at.',
      askBookmark: (title: string) => `Where is your bookmark in “${title}”?`,
      title: 'The book you are reading',
      bookmark: 'Your bookmark is at page',
      total: 'Pages in the book',
      put: 'Put it on the nightstand',
    },
    closeBook: 'Close the book',
    openCover: 'Open today’s card',
    coverEyebrow: 'Today’s card',
    tapToOpen: 'Tap to open',
    sealedGroup: 'Today, read and sealed',
    bookmarkAt: (page: number, total: number | null) =>
      total === null ? `Bookmark at page ${n(page)}.` : `Bookmark at page ${n(page)} of ${n(total)}.`,
    /** The page written on the bookmark itself, or nothing yet at the very start. */
    bookmarkTag: (page: number): string => (page > 0 ? `p. ${n(page)}` : ''),
    bookmarkLabel: (title: string, page: number): string =>
      page > 0 ? `Bookmark in “${title}”, at page ${n(page)}` : `Bookmark in “${title}”, at the very start`,
    hints: [
      'Find a cosy corner. The pages will not read themselves.',
      'A blanket, a cup of tea, and these pages.',
      'The armchair has been waiting all day.',
      'Phone down, book up.',
      'Light the lamp; the rest will follow.',
      'Every page counts. These ones especially.',
    ],
    hintDone: (streak: number): string =>
      streak > 1 ? `${days(streak)} in a row. A fresh card awaits tomorrow.` : 'A fresh card awaits tomorrow.',
    errors: (error: ChallengeError, bookmark: number, total: number | null): string => {
      switch (error) {
        case 'already-completed':
          return 'Today is already sealed.';
        case 'not-completed':
          return 'Seal the day first.';
        case 'no-bookmark':
          return 'Tell me where your bookmark is first.';
        case 'invalid-page':
          return 'Which page? A whole number, please.';
        case 'not-past-bookmark':
          return `Your bookmark is already at page ${n(bookmark)}: a later page, please.`;
        case 'past-the-end':
          return total === null ? 'That page is past the end of any book.' : `This book ends at page ${n(total)}.`;
        case 'too-many-pages':
          return `More than ${n(PAGES_READ_LIMITS.highest)} pages at one sitting? Check the page.`;
      }
    },
    scroll: {
      heads: { met: 'To the page', beyond: 'Beyond the page', short: 'A short day, honestly kept', book: 'Finis' },
      finis: 'Finis',
      signature: 'The librarian',
      readOn: 'I read some more',
      rollUp: 'Roll up the scroll',
      unroll: 'Unroll the scroll',
      skip: 'Tap to skip ahead',
      openHint: 'Tap the scroll to roll it up.',
      rolledHint: 'Tap the seal to unroll it.',
    },
    summary: {
      book: (read: number) => `${pages(read)} — and a book finished. Bravo.`,
      beyond: (read: number, goal: number) => `${n(read)} of ${n(goal)} pages — ${pages(read - goal)} beyond the goal.`,
      short: (read: number, goal: number) => `${n(read)} of ${n(goal)} pages. Every page counts.`,
      exact: (read: number) => `${pages(read)}, exactly as dealt.`,
    },
    notes: {
      met: [
        'Well read. The day is yours.',
        'Every page accounted for. Splendid.',
        'A quiet triumph. The lamp may rest.',
        'That is how a habit is bound: one page at a time.',
        'The librarian nods, approvingly, over the spectacles.',
        'Another day written into the ledger. Bravo.',
      ],
      beyond: [
        'Beyond the bookmark — the story simply would not let you go.',
        'Just one more chapter, was it? Splendid.',
        'You read past the goal. A very fine sign.',
        'More than was asked. The shelves are impressed.',
      ],
      short: [
        'Every page counts — and these did.',
        'A short chapter is still a chapter. The candle stays lit.',
        'Some days are slim volumes. Tomorrow is a new page.',
        'A little reading is still reading. Well done for coming.',
      ],
      book: [
        'The last page, turned. What a thing.',
        'The end — and on to the next beginning.',
        'Another book for the shelf. The librarian is delighted.',
      ],
    },
    bookFinishedNote: (title: string, note: string) => `“${title}” — finished. ${note}`,
    newBookplate: (title: string) => `New bookplate: ${title}`,
    newBookplates: (count: number) => `${n(count)} new bookplates today`,
    inARow: (streak: number) => `${n(streak)} days in a row`,
    past: {
      read: (read: number) => `${pages(read)} read · sealed`,
      unread: 'pages dealt, left unread',
      noCard: 'No card that day',
      exLibris: 'Ex libris',
      newReader: 'A new reader',
      chapter: 'Chapter',
      one: 'One',
    },
  },

  summary: {
    region: 'Your reading',
    unit: (streak: number): string => (streak === 1 ? 'day' : 'days'),
    inARow: 'in a row',
    lightIt: 'Read today to light the candle.',
    burnsOn: 'in a row — the candle burns on.',
    keepLit: 'in a row — read today to keep the candle lit.',
    best: 'Best streak',
    pagesRead: 'Pages read',
    booksRead: 'Books read',
    rank: (roman: string) => `Rank ${roman}`,
    meter: 'Progress to the next rank',
    toNext: (remaining: number) => `${pages(remaining)} to the next rank.`,
    top: 'The top of the ladder. Take a bow.',
    levels: [
      'Page turner',
      'Apprentice reader',
      'Bookish',
      'Avid reader',
      'Bibliophile',
      'Scholar',
      'Sage',
      'Librarian',
      'Archivist',
      'Living legend',
    ],
  },

  shelf: {
    heading: 'Your shelf',
    count: (books: number) => count(books, 'book'),
    nightstand: 'On the nightstand',
    finishedIt: 'I finished it',
    finishedABook: 'Finished a book?',
    whichOne: 'Which one?',
    putOnShelf: 'Put it on the shelf',
    readingElse: 'Reading something else?',
    whatReading: 'What are you reading?',
    anotherInstead: 'Starting another book instead?',
    titlePlaceholder: 'Title of the book',
    onPage: 'On page',
    totalPages: 'Pages in the book',
    fromTheStart: 'From the beginning',
    startReading: 'Start reading',
    shelfLabel: 'Books you have finished',
    empty: 'Your shelf awaits its first book.',
    spine: (title: string, date: string) => `${title}, finished ${date}`,
    spineTitle: (title: string, date: string) => `${title} — finished ${date}`,
    bookmark: (page: number, total: number | null) =>
      total === null ? `Bookmark at page ${n(page)}` : `Page ${n(page)} of ${n(total)}`,
    percent: (percent: number) => `${percent}% read`,
    noBookmark: 'No bookmark in this one yet.',
    lastPage: 'The last page. Finished?',
    progressLabel: 'How far into the book',
    moveBookmark: 'Move the bookmark',
    placeBookmark: 'Place a bookmark',
  },

  calendar: {
    heading: 'Last six weeks',
    legend: { met: 'goal met', short: 'some pages', missed: 'missed', today: 'today' },
    read: (date: string, read: number, goal: number, book: boolean) =>
      `${date} — ${pages(read)} read of ${n(goal)}${book ? ', a book finished' : ''}`,
    missed: (date: string) => `${date} — missed`,
  },

  achievements: {
    heading: 'Achievements',
    tally: (earned: number, total: number) => `${n(earned)} / ${n(total)}`,
    earned: (date: string) => `Earned ${date}`,
    locked: 'Locked',
    list: ACHIEVEMENTS,
  },

  overview: {
    lookBackBy: 'Look back by',
    month: 'Month',
    year: 'Year',
    previous: 'Previous',
    next: 'Next',
    previousOf: (unit: 'month' | 'year') => `Previous ${unit}`,
    nextOf: (unit: 'month' | 'year') => `Next ${unit}`,
    pagesRead: 'Pages read',
    daysRead: 'Days read',
    booksFinished: 'Books finished',
    perDay: 'Pages read each day',
    perMonth: 'Pages read each month',
    goalKey: "the day's goal",
    showTable: 'Show as a table',
    day: 'Day',
    monthColumn: 'Month',
    goal: 'Goal',
    noneEither: (period: string) => `None in ${period} either.`,
    none: (period: string) => `None in ${period}.`,
    same: (period: string) => `Same as ${period}.`,
    change: (up: boolean, by: number, period: string) => `${up ? '↑' : '↓'} ${n(by)} on ${period}.`,
    ofSoFar: (span: number) => `of ${n(span)} so far`,
    of: (span: number) => `of ${n(span)}`,
    pages: (count: number) => pages(count),
    noCard: 'No card',
    notRead: 'Not read',
    dayDetail: (label: string, goal: number | null, book: boolean) =>
      `${label}${goal !== null ? ` · goal ${n(goal)}` : ''}${book ? ' · book finished' : ''}`,
    monthDetail: (month: string, daysRead: number, books: number) =>
      `${month} · ${days(daysRead)} read${books ? ` · ${count(books, 'book')}` : ''}`,
    bestDay: (date: string, read: number) => `Best day: ${date}, ${pages(read)}.`,
    bestMonth: (month: string, read: number) => `Best month: ${month}, ${pages(read)}.`,
    longestRun: (run: number) => `Longest run: ${days(run)} in a row.`,
    goalsMet: (met: number, read: number) => `Goal met on ${n(met)} of ${count(read, 'reading day')}.`,
    beyond: (extra: number) => `${pages(extra)} beyond the goal.`,
    average: (perDay: number) => `${n(perDay)} pages a reading day, on average.`,
    booksIn: (year: number) => `Books finished in ${year}`,
    noBookMonth: (month: string) => `No book finished in ${month} — yet.`,
    noBookYear: (year: number) => `No book finished in ${year} — yet.`,
    span: (from: string, to: string) => ` — ${from} to ${to}`,
    finishedOn: (date: string) => ` — finished ${date}`,
  },

  profile: {
    heading: 'Ex libris',
    intro: 'Your reader’s card. It stays on this device — nothing is ever sent anywhere.',
    since: (date: string) => `Reader since ${date} · stays on this device, never sent anywhere.`,
    avatar: 'Avatar',
    name: 'Name',
    genre: 'Favourite genre',
    genrePlaceholder: 'Science fiction, poetry, crime…',
    save: 'Save profile',
    check: 'Please check the highlighted fields.',
  },

  language: {
    heading: 'Language',
    intro: 'The reading room speaks the language of your device, unless you choose another.',
    legend: 'Language',
    auto: (name: string) => `As on this device (${name})`,
  },

  range: {
    heading: 'Daily challenge',
    intro: "Each day's card draws a page count from this range.",
    min: 'Minimum',
    max: 'Maximum',
    step: 'Step',
    possible: 'Possible cards',
    more: (hidden: number) => `… ${n(hidden)} more`,
    save: 'Save range',
    invalid: 'That range does not work yet.',
    redrawn: "Saved ✓ — today's card was redrawn to fit.",
    fromNext: 'Saved ✓ — applies from the next card.',
  },

  reminder: {
    heading: 'Daily reminder',
    intro: 'A nudge at the same hour every day, until you have read your pages.',
    everyDay: 'Remind me every day',
    at: 'At',
    save: 'Save reminder',
    test: 'Send a test',
    neverMisses: 'Want a reminder that never misses?',
    help: 'This app runs entirely on your phone, with no server. Android (Chrome) can wake it in the background — at roughly the hour you chose. iPhone only shows reminders while the app is open. For a reminder that rings on the dot, add it to your calendar:',
    calendar: '📅 Add to my calendar',
    off: 'Reminder off.',
    background: (time: string) => `Saved ✓ — you will be nudged around ${time}, even with the app closed.`,
    whileOpen: (time: string) =>
      `Saved ✓ — you will be nudged at ${time} while the app is open. Add it to your calendar for a sure thing.`,
    testSent: 'Test sent — check your notifications.',
    errors: REMINDER_ERRORS,
    invite: {
      file: 'daily-reading-reminder.ics',
      summary: '📖 How many pages today?',
      description: (url: string) => `Your reading card is waiting: ${url}`,
      alarm: 'Time for your daily pages',
    },
  },

  celebration: {
    shelved: (title: string, number: number) => `📕 “${title}” joins your shelf — book number ${n(number)}.`,
    shelvedUntitled: (number: number) => `📕 Another book on your shelf — number ${n(number)}.`,
    achievement: (icon: string, title: string) => `${icon} Achievement unlocked: ${title}`,
  },

  welcome: {
    librarian: 'The librarian',
    back: 'Back',
    next: 'Next',
    onward: 'Onward',
    skipTour: 'Skip the tour',
    tourCount: (index: number, total: number) => `A tour of the room · ${index} of ${total}`,
    door: {
      eyebrow: 'A door creaks open…',
      heading: 'The reading room',
      speech:
        '“Ah — a new reader. Do come in, and mind the dust. I keep this little library, and every day I deal one card: a picture, and a number of pages to read. That is all there is to it — and it is quite enough.”',
      languages: 'Language',
      skip: 'I know my way',
      enter: 'Step inside',
    },
    card: {
      eyebrow: 'First, the register',
      heading: 'Your reader’s card',
      speech: '“Every reader here has one. It never leaves this room — nothing you tell me is sent anywhere.”',
      portrait: 'Pick a portrait',
      name: 'What shall I call you?',
      genre: 'A favourite genre?',
      genrePlaceholder: 'Poetry, crime, science fiction…',
      later: 'Later',
      sign: 'Sign the register',
    },
    nightstand: {
      eyebrow: 'And on your nightstand?',
      heading: 'The book in hand',
      speech:
        '“What are you reading at the moment? Tell me where your bookmark is, and each day I shall tell you which page to read up to. When you reach the last page, it goes on your shelf.”',
      greet: (name: string) =>
        `“A pleasure, ${name}. What are you reading at the moment? Tell me where your bookmark is, and each day I shall tell you which page to read up to. When you reach the last page, it goes on your shelf.”`,
      book: 'The book you are reading',
      onPage: 'Your bookmark is at page',
      totalPages: 'Pages in the book',
      nothing: 'Nothing just now',
      put: 'Put it on the nightstand',
    },
    install: {
      eyebrow: 'One last thing',
      heading: 'A key to the room',
      speech:
        '“Keep the reading room on your home screen: it opens like any app, works without a connection, and can remind you when it is time to read.”',
      notNow: 'Not now',
      add: 'Add it to my home screen',
      iosShare: 'Tap the ',
      iosShareButton: 'Share',
      iosShareEnd: ' button in Safari’s toolbar.',
      iosScroll: 'Scroll down and choose ',
      iosAddToHome: 'Add to Home Screen',
      iosAdd: 'Tap ',
      iosAddButton: 'Add',
      iosAddEnd: '. The key is yours.',
      done: 'Done',
      menu: 'In your browser’s menu, look for ',
      menuInstall: 'Install app',
      menuOr: ' or ',
      menuAddHome: 'Add to Home screen',
      accepted: '“Splendid. The key is on your home screen.”',
      dismissed: '“Another time, then. The door is always open.”',
    },
    finale: {
      eyebrow: 'Now then',
      heading: 'Your first card awaits',
      speech: (name: string | null, goal: number, readTo: number | null, bookplate: string) =>
        `“Today’s book is on the table${name ? `, ${name}` : ''}. Tap it, and it will open on your page — ${pages(goal)} today${readTo === null ? '' : `, up to page ${n(readTo)}`}. Read them, write the page you stopped at, and I shall close the book, write the day on a scroll and seal it with wax.${bookplate} Take your time; the lamp is lit.”`,
      oneBookplate: (title: string) => ` Oh — and you have already earned your first bookplate: “${title}”.`,
      bookplates: (count: number) => ` Oh — and you have already earned ${n(count)} bookplates.`,
      begin: 'Turn the first page',
    },
    replay: '🦉 Take the tour again',
  },
};

export type Messages = typeof en;
