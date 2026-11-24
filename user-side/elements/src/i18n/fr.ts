import type { AchievementId, ChallengeError, FieldError, ReminderError } from '@hmpt/domain-contract';
import type { Messages } from './en';

/*
 * Le carnet de phrases français. Il suit l’anglais clé pour clé (`Messages`).
 * Typographie française : espace fine insécable avant ? ! ; et %, insécable avant : et
 * à l’intérieur des guillemets « ». On vouvoie la personne qui lit, sans jamais la genrer.
 */

const number = new Intl.NumberFormat('fr');
const n = (value: number) => number.format(value);
// En français, 0 et 1 s’accordent au singulier.
const count = (value: number, one: string, many = `${one}s`) => `${n(value)} ${value <= 1 ? one : many}`;
const pages = (value: number) => count(value, 'page');
const pagesRead = (value: number) => count(value, 'page lue', 'pages lues');
const days = (value: number) => count(value, 'jour');

const ACHIEVEMENTS: Record<AchievementId, { readonly title: string; readonly description: string }> = {
  'first-challenge': { title: 'Premier chapitre', description: 'Relevez votre premier défi quotidien.' },
  'streak-3': { title: 'Petit bois', description: 'Lisez trois jours de suite.' },
  'streak-7': { title: 'Une semaine de mots', description: 'Lisez sept jours de suite.' },
  'streak-30': { title: 'Un mois de ferveur', description: 'Lisez trente jours de suite.' },
  'streak-100': { title: 'Centurion', description: 'Lisez cent jours de suite.' },
  'book-1': { title: 'Fin', description: 'Terminez votre premier livre.' },
  'books-5': { title: 'Une étagère à soi', description: 'Terminez cinq livres.' },
  'books-12': { title: 'Un livre par mois', description: 'Terminez douze livres.' },
  'pages-500': { title: 'Cinq cents pages', description: 'Lisez 500 pages en tout.' },
  'pages-1000': { title: 'Mille pages', description: 'Lisez 1 000 pages en tout.' },
  'pages-5000': { title: 'Rat de bibliothèque', description: 'Lisez 5 000 pages en tout.' },
  marathon: { title: 'Marathon', description: 'Lisez 100 pages ou plus en une seule journée.' },
  'beyond-goal': { title: 'Encore un chapitre', description: 'Lisez plus que l’objectif du jour.' },
  'double-goal': { title: 'Jusqu’au bout de la nuit', description: 'Lisez au moins deux fois l’objectif du jour.' },
  'extra-100': { title: 'Chapitres bonus', description: 'Lisez 100 pages au-delà de vos objectifs, en tout.' },
  'page-binge': { title: 'Impossible à lâcher', description: 'Lisez 200 pages ou plus en une seule journée.' },
  'little-by-little': {
    title: 'Petit à petit',
    description: 'Notez une journée en deçà de l’objectif. Chaque page compte.',
  },
  'final-chapter': { title: 'Le dernier chapitre', description: 'Terminez un livre avec la lecture du jour.' },
  'early-bird': { title: 'Lève-tôt', description: 'Validez un défi avant 8 h.' },
  'night-owl': { title: 'Oiseau de nuit', description: 'Validez un défi après 22 h.' },
  weekend: { title: 'Week-end studieux', description: 'Lisez le samedi et le dimanche d’un même week-end.' },
  comeback: { title: 'De retour au rayon', description: 'Reprenez la lecture après au moins deux jours manqués.' },
  introductions: { title: 'Faisons connaissance', description: 'Remplissez votre carte de lecture.' },
};

const CHALLENGE_ERRORS: Record<ChallengeError, string> = {
  'already-completed': 'La journée est déjà scellée.',
  'not-completed': 'Notez d’abord votre lecture.',
  'invalid-pages': 'Un nombre entier de pages, s’il vous plaît — au moins une.',
  'invalid-title': 'Ce titre est un peu long.',
};

const REMINDER_ERRORS: Record<ReminderError, string> = {
  'invalid-time': 'Choisissez une heure, par exemple 20:30.',
  'permission-denied':
    'Les notifications sont bloquées pour cette application. Autorisez-les dans les réglages du navigateur ou du téléphone, puis réessayez.',
  unsupported:
    'Ce navigateur ne peut pas afficher de notifications ici. Sur iPhone et iPad, ajoutez d’abord l’application à l’écran d’accueil. Le rappel par agenda ci-dessous fonctionne partout.',
  'delivery-failed':
    'La notification n’a pas pu s’afficher sur cet appareil. Le rappel par agenda ci-dessous fonctionne partout.',
};

function fieldError({ field, problem, min = 0, max = 0 }: FieldError): string {
  switch (problem) {
    case 'required':
      return field === 'displayName'
        ? 'Dites-nous comment vous appeler.'
        : field === 'avatar'
          ? 'Choisissez un avatar.'
          : field === 'title'
            ? 'Quel livre est-ce ?'
            : 'Ce champ est nécessaire.';
    case 'too-long':
      return `Pas plus de ${n(max)} caractères.`;
    case 'not-whole':
      return field === 'pagesRead' ? 'Un nombre entier de pages, s’il vous plaît.' : 'Un nombre entier, s’il vous plaît.';
    case 'out-of-range':
      return field === 'pagesRead' ? `Entre ${n(min)} et ${n(max)} pages.` : `Un nombre entre ${n(min)} et ${n(max)}.`;
    case 'below-minimum':
      return 'Le maximum ne peut pas être inférieur au minimum.';
    case 'past-the-end':
      return `Le livre s’arrête à la page ${n(max)}.`;
    case 'no-book':
      return 'Il n’y a pas de livre sur la table de chevet.';
  }
}

export const fr: Messages = {
  common: {
    optional: '(facultatif)',
    title: 'Titre',
    aBook: 'Un livre',
    saved: 'Enregistré ✓',
    save: 'Enregistrer',
    fieldError,
  },

  shell: {
    appName: 'Combien de pages aujourd’hui',
    sections: 'Rubriques',
    tabs: { today: 'Aujourd’hui', progress: 'Progrès', overview: 'Bilan', profile: 'Vous' },
    regions: { today: 'Aujourd’hui', progress: 'Progrès', overview: 'Bilan', profile: 'Profil et réglages' },
    headings: {
      progress: 'Votre bibliothèque',
      overview: 'Retour sur vos lectures',
      profile: 'Votre salle de lecture',
    },
    titles: {
      today: 'Combien de pages aujourd’hui',
      progress: 'Progrès · Combien de pages aujourd’hui',
      overview: 'Bilan · Combien de pages aujourd’hui',
      profile: 'Vous · Combien de pages aujourd’hui',
    },
    footnote: 'Tout reste sur cet appareil. Effacer les données du site dans le navigateur les supprime.',
    update: {
      notice: 'Une nouvelle édition est sur l’étagère.',
      open: 'L’ouvrir',
      later: 'Plus tard',
    },
    fatal:
      'Impossible de distribuer votre carte de lecture : ce navigateur bloque le stockage local (navigation privée ?). Ouvrez l’application dans une fenêtre normale pour garder votre progression.',
  },

  tour: {
    card: {
      title: 'Votre carte du jour',
      text: 'Chaque jour, je pose un livre fermé sur la table. Touchez-le et il s’ouvre sur la page du jour : une image, un nombre de pages — et, si un livre attend sur votre table de chevet, la page jusqu’à laquelle lire. Lisez-les, appuyez sur le bouton, et je referme le livre, je scelle la journée et j’avance votre marque-page. Plus de pages, moins — ou votre livre terminé ? Dites-le-moi sous « Plus ou moins de pages ? ». Chaque page compte.',
    },
    candle: {
      title: 'Gardez la bougie allumée',
      text: 'Lisez un peu chaque jour et cette bougie continue de brûler. Vos pages, vos livres et votre rang de lecture sont gardés ici aussi.',
    },
    library: {
      title: 'Votre bibliothèque',
      text: 'Le livre sur votre table de chevet et son marque-page, l’étagère de vos livres terminés, le registre des six dernières semaines, et vos ex-libris — les distinctions gagnées en chemin.',
    },
    overview: {
      title: 'Regarder en arrière',
      text: 'Vos mois et vos années de lecture, d’un coup d’œil : pages, jours, livres — et vos plus beaux jours.',
    },
    room: {
      title: 'Votre salle de lecture',
      text: 'Votre carte de lecture, la langue que je parle, la taille du défi quotidien, et un rappel chaque jour à l’heure de votre choix.',
    },
  },

  greeting: {
    hello: 'Bonjour',
    salutation: (hour: number) => (hour < 5 ? 'Bonsoir' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'),
    named: (salutation: string, name: string) => `${salutation}, ${name}`,
    anonymous: (salutation: string) => `${salutation} !`,
    nightstand: 'Sur la table de chevet : ',
    nightstandEnd: (bookmark: number | null) => (bookmark === null || bookmark === 0 ? '.' : `, page ${n(bookmark)}.`),
    newHere: 'Première visite ? ',
    fillCard: 'Remplissez votre carte de lecture',
    laidOut: 'Votre carte du jour vous attend.',
  },

  card: {
    today: 'Aujourd’hui',
    unit: (value: number) => (value <= 1 ? 'page' : 'pages'),
    upTo: (page: number) => `jusqu’à la page ${n(page)}`,
    toTheEnd: (page: number) => `jusqu’à la fin du livre — page ${n(page)}`,
    placeBookmark: 'Marquer votre page dans ce livre',
    readThem: (value: number) => `J’ai lu ${pages(value)}`,
    readMore: 'Plus ou moins de pages ?',
    pagesRead: 'Pages réellement lues',
    finishedBook: 'J’ai terminé mon livre',
    whichBook: 'Quel livre ?',
    logReading: 'Noter ma lecture',
    readSomeMore: 'Encore un peu de lecture aujourd’hui ?',
    pagesToAdd: 'Pages à ajouter',
    addPages: 'Ajouter les pages',
    closeBook: 'Refermer le livre',
    openCover: 'Ouvrir la carte du jour',
    coverEyebrow: 'La carte du jour',
    tapToOpen: 'Touchez pour ouvrir',
    sealedGroup: 'Aujourd’hui, lu et scellé',
    sealed: 'Lu, et scellé.',
    openBook: 'Rouvrir le livre',
    bookmarkAt: (page: number, total: number | null) =>
      total === null ? `Marque-page à la page ${n(page)}.` : `Marque-page à la page ${n(page)} sur ${n(total)}.`,
    lastPage: (title: string) => `La dernière page de « ${title} ». Terminé ?`,
    shelveIt: 'Le ranger sur l’étagère',
    hints: [
      'Trouvez un coin douillet. Les pages ne se liront pas toutes seules.',
      'Un plaid, une tasse de thé, et ces pages.',
      'Le fauteuil vous attend depuis ce matin.',
      'Téléphone posé, livre ouvert.',
      'Allumez la lampe ; le reste suivra.',
      'Chaque page compte. Celles-ci tout particulièrement.',
    ],
    hintDone: (streak: number) =>
      streak > 1 ? `${days(streak)} de suite. Une nouvelle carte vous attend demain.` : 'Une nouvelle carte vous attend demain.',
    errors: CHALLENGE_ERRORS,
    summary: {
      book: (read: number) => `${pages(read)} — et un livre terminé. Bravo.`,
      beyond: (read: number, goal: number) => `${pages(read)} sur ${n(goal)} — ${pages(read - goal)} au-delà de l’objectif.`,
      short: (read: number, goal: number) => `${pages(read)} sur ${n(goal)}. Chaque page compte.`,
      exact: (read: number) => `${pages(read)}, exactement comme prévu.`,
    },
    notes: {
      met: [
        'Bien lu. La journée est à vous.',
        'Toutes les pages sont au rendez-vous. Splendide.',
        'Un triomphe discret. La lampe peut se reposer.',
        'C’est ainsi qu’on relie une habitude : une page à la fois.',
        'Le bibliothécaire approuve d’un signe de tête, par-dessus ses lunettes.',
        'Une journée de plus inscrite au registre. Bravo.',
      ],
      beyond: [
        'Au-delà du marque-page — l’histoire ne voulait plus vous lâcher.',
        'Juste un chapitre de plus, n’est-ce pas ? Splendide.',
        'Vous avez dépassé l’objectif. Excellent signe.',
        'Plus que demandé. Les étagères sont impressionnées.',
      ],
      short: [
        'Chaque page compte — celles-ci aussi.',
        'Un chapitre court reste un chapitre. La bougie reste allumée.',
        'Certains jours sont de minces volumes. Demain est une nouvelle page.',
        'Un peu de lecture, c’est encore de la lecture. Merci de votre visite.',
      ],
      book: [
        'La dernière page est tournée. Quel moment.',
        'Fin — et en route vers un nouveau début.',
        'Un livre de plus pour l’étagère. Le bibliothécaire est enchanté.',
      ],
    },
    bookFinishedNote: (title: string, note: string) => `« ${title} » — terminé. ${note}`,
    newBookplate: (title: string) => `Nouvel ex-libris : ${title}`,
    newBookplates: (value: number) => `${n(value)} nouveaux ex-libris aujourd’hui`,
    inARow: (streak: number) => `${n(streak)} jours de suite`,
    past: {
      read: (read: number) => `${pagesRead(read)} · scellé`,
      unread: 'pages prévues, restées non lues',
      noCard: 'Pas de carte ce jour-là',
      exLibris: 'Ex libris',
      newReader: 'Votre nom ici',
      chapter: 'Chapitre',
      one: 'Un',
    },
  },

  summary: {
    region: 'Votre lecture',
    unit: (streak: number) => (streak <= 1 ? 'jour' : 'jours'),
    inARow: 'de suite',
    lightIt: 'Lisez aujourd’hui pour allumer la bougie.',
    burnsOn: 'de suite — la bougie brûle toujours.',
    keepLit: 'de suite — lisez aujourd’hui pour garder la bougie allumée.',
    best: 'Meilleure série',
    pagesRead: 'Pages lues',
    booksRead: 'Livres lus',
    rank: (roman: string) => `Rang ${roman}`,
    meter: 'Progression vers le rang suivant',
    toNext: (remaining: number) => `Encore ${pages(remaining)} jusqu’au rang suivant.`,
    top: 'Tout en haut de l’échelle. Chapeau bas.',
    levels: [
      'Tourne-page',
      'Bibliophile en herbe',
      'Livresque',
      'Insatiable',
      'Bibliophile',
      'Humaniste',
      'Sage',
      'Bibliothécaire',
      'Archiviste',
      'Légende vivante',
    ],
  },

  shelf: {
    heading: 'Votre étagère',
    count: (books: number) => count(books, 'livre'),
    nightstand: 'Sur la table de chevet',
    finishedIt: 'Je l’ai terminé',
    finishedABook: 'Un livre terminé ?',
    whichOne: 'Lequel ?',
    putOnShelf: 'Le ranger sur l’étagère',
    readingElse: 'Vous lisez autre chose ?',
    whatReading: 'Que lisez-vous ?',
    anotherInstead: 'Vous commencez plutôt un autre livre ?',
    titlePlaceholder: 'Titre du livre',
    onPage: 'À la page',
    totalPages: 'Nombre de pages du livre',
    fromTheStart: 'Depuis le début',
    startReading: 'Commencer la lecture',
    shelfLabel: 'Les livres que vous avez terminés',
    empty: 'Votre étagère attend son premier livre.',
    spine: (title: string, date: string) => `${title}, terminé le ${date}`,
    spineTitle: (title: string, date: string) => `${title} — terminé le ${date}`,
    bookmark: (page: number, total: number | null) =>
      total === null ? `Marque-page à la page ${n(page)}` : `Page ${n(page)} sur ${n(total)}`,
    percent: (percent: number) => `${percent} % lu`,
    noBookmark: 'Pas encore de marque-page dans celui-ci.',
    lastPage: 'La dernière page. Terminé ?',
    progressLabel: 'Avancement dans le livre',
    moveBookmark: 'Déplacer le marque-page',
    placeBookmark: 'Placer un marque-page',
  },

  calendar: {
    heading: 'Les six dernières semaines',
    legend: { met: 'objectif atteint', short: 'quelques pages', missed: 'manqué', today: 'aujourd’hui' },
    read: (date: string, read: number, goal: number, book: boolean) =>
      `${date} — ${pagesRead(read)} sur ${n(goal)}${book ? ', un livre terminé' : ''}`,
    missed: (date: string) => `${date} — manqué`,
  },

  achievements: {
    heading: 'Distinctions',
    tally: (earned: number, total: number) => `${n(earned)} / ${n(total)}`,
    earned: (date: string) => `Obtenue le ${date}`,
    locked: 'Verrouillée',
    list: ACHIEVEMENTS,
  },

  overview: {
    lookBackBy: 'Regarder par',
    month: 'Mois',
    year: 'Année',
    previous: 'Précédent',
    next: 'Suivant',
    previousOf: (unit: 'month' | 'year') => (unit === 'month' ? 'Mois précédent' : 'Année précédente'),
    nextOf: (unit: 'month' | 'year') => (unit === 'month' ? 'Mois suivant' : 'Année suivante'),
    pagesRead: 'Pages lues',
    daysRead: 'Jours de lecture',
    booksFinished: 'Livres terminés',
    perDay: 'Pages lues chaque jour',
    perMonth: 'Pages lues chaque mois',
    goalKey: 'l’objectif du jour',
    showTable: 'Afficher en tableau',
    day: 'Jour',
    monthColumn: 'Mois',
    goal: 'Objectif',
    noneEither: (period: string) => `Rien non plus en ${period}.`,
    none: (period: string) => `Rien en ${period}.`,
    same: (period: string) => `Comme en ${period}.`,
    change: (up: boolean, by: number, period: string) => `${up ? '↑' : '↓'} ${n(by)} par rapport à ${period}.`,
    ofSoFar: (span: number) => `sur ${n(span)} jusqu’ici`,
    of: (span: number) => `sur ${n(span)}`,
    pages: (value: number) => pages(value),
    noCard: 'Pas de carte',
    notRead: 'Non lu',
    dayDetail: (label: string, goal: number | null, book: boolean) =>
      `${label}${goal !== null ? ` · objectif ${n(goal)}` : ''}${book ? ' · livre terminé' : ''}`,
    monthDetail: (month: string, daysRead: number, books: number) =>
      `${month} · ${days(daysRead)} de lecture${books ? ` · ${count(books, 'livre')}` : ''}`,
    bestDay: (date: string, read: number) => `Meilleur jour : ${date}, ${pages(read)}.`,
    bestMonth: (month: string, read: number) => `Meilleur mois : ${month}, ${pages(read)}.`,
    longestRun: (run: number) => `Plus longue série : ${days(run)} de suite.`,
    goalsMet: (met: number, read: number) => `Objectif atteint ${days(met)} sur ${n(read)}.`,
    beyond: (extra: number) => `${pages(extra)} au-delà de l’objectif.`,
    average: (perDay: number) => `${pages(perDay)} par jour de lecture, en moyenne.`,
    booksIn: (year: number) => `Livres terminés en ${year}`,
    noBookMonth: (month: string) => `Aucun livre terminé en ${month} — pour l’instant.`,
    noBookYear: (year: number) => `Aucun livre terminé en ${year} — pour l’instant.`,
    span: (from: string, to: string) => ` — du ${from} au ${to}`,
    finishedOn: (date: string) => ` — terminé le ${date}`,
  },

  profile: {
    heading: 'Ex libris',
    intro: 'Votre carte de lecture. Elle reste sur cet appareil — rien n’est jamais envoyé nulle part.',
    since: (date: string) => `Carte ouverte le ${date} · elle reste sur cet appareil, jamais envoyée nulle part.`,
    avatar: 'Avatar',
    name: 'Nom',
    genre: 'Genre préféré',
    genrePlaceholder: 'Science-fiction, poésie, polar…',
    save: 'Enregistrer le profil',
    check: 'Vérifiez les champs signalés, s’il vous plaît.',
  },

  language: {
    heading: 'Langue',
    intro: 'La salle de lecture parle la langue de votre appareil, sauf si vous en choisissez une autre.',
    legend: 'Langue',
    auto: (name: string) => `Comme sur cet appareil (${name})`,
  },

  range: {
    heading: 'Défi quotidien',
    intro: 'Chaque carte tire un nombre de pages dans cette fourchette.',
    min: 'Minimum',
    max: 'Maximum',
    step: 'Pas',
    possible: 'Cartes possibles',
    more: (hidden: number) => `… ${n(hidden)} de plus`,
    save: 'Enregistrer la fourchette',
    invalid: 'Cette fourchette ne fonctionne pas encore.',
    redrawn: 'Enregistré ✓ — la carte du jour a été tirée à nouveau pour s’y accorder.',
    fromNext: 'Enregistré ✓ — s’applique dès la prochaine carte.',
  },

  reminder: {
    heading: 'Rappel quotidien',
    intro: 'Un petit signe à la même heure chaque jour, tant que vous n’avez pas lu vos pages.',
    everyDay: 'Me le rappeler chaque jour',
    at: 'À',
    save: 'Enregistrer le rappel',
    test: 'Envoyer un essai',
    neverMisses: 'Un rappel qui ne manque jamais ?',
    help: 'Cette application fonctionne entièrement sur votre téléphone, sans serveur. Android (Chrome) peut la réveiller en arrière-plan — à peu près à l’heure choisie. L’iPhone n’affiche les rappels que lorsque l’application est ouverte. Pour un rappel qui sonne à l’heure pile, ajoutez-le à votre agenda :',
    calendar: '📅 Ajouter à mon agenda',
    off: 'Rappel désactivé.',
    background: (time: string) => `Enregistré ✓ — un rappel vers ${time}, même application fermée.`,
    whileOpen: (time: string) =>
      `Enregistré ✓ — un rappel à ${time} tant que l’application est ouverte. Ajoutez-le à votre agenda pour plus de sûreté.`,
    testSent: 'Essai envoyé — regardez vos notifications.',
    errors: REMINDER_ERRORS,
    invite: {
      file: 'rappel-lecture-quotidien.ics',
      summary: '📖 Combien de pages aujourd’hui ?',
      description: (url: string) => `Votre carte de lecture vous attend : ${url}`,
      alarm: 'L’heure de vos pages du jour',
    },
  },

  celebration: {
    beyond: (extra: number) => `✨ ${pages(extra)} au-delà de l’objectif. Splendide.`,
    short: (read: number) => `🐢 ${pagesRead(read)}. Chaque page compte — la bougie reste allumée.`,
    streak: (streak: number) => `🕯️ ${days(streak)} de suite. Splendide.`,
    read: (read: number) => `${pagesRead(read)}. Bravo.`,
    added: (added: number, total: number) => `📖 ${count(added, 'page')} de plus — ${n(total)} aujourd’hui.`,
    shelved: (title: string, number: number) => `📕 « ${title} » rejoint votre étagère — livre numéro ${n(number)}.`,
    shelvedUntitled: (number: number) => `📕 Un livre de plus sur votre étagère — le numéro ${n(number)}.`,
    achievement: (icon: string, title: string) => `${icon} Distinction obtenue : ${title}`,
  },

  welcome: {
    librarian: 'Le bibliothécaire',
    back: 'Retour',
    next: 'Suivant',
    onward: 'En avant',
    skipTour: 'Passer la visite',
    tourCount: (index: number, total: number) => `Visite de la salle · ${index} sur ${total}`,
    door: {
      eyebrow: 'Une porte grince…',
      heading: 'La salle de lecture',
      speech:
        '« Ah — un nouveau visage. Entrez donc, et prenez garde à la poussière. Je tiens cette petite bibliothèque, et chaque jour je distribue une carte : une image, et un nombre de pages à lire. C’est tout — et c’est bien assez. »',
      languages: 'Langue',
      skip: 'Je connais le chemin',
      enter: 'Entrer',
    },
    card: {
      eyebrow: 'D’abord, le registre',
      heading: 'Votre carte de lecture',
      speech:
        '« Chaque personne qui lit ici en a une. Elle ne quitte jamais cette pièce — rien de ce que vous me dites n’est envoyé nulle part. »',
      portrait: 'Choisissez un portrait',
      name: 'Comment dois-je vous appeler ?',
      genre: 'Un genre préféré ?',
      genrePlaceholder: 'Poésie, polar, science-fiction…',
      later: 'Plus tard',
      sign: 'Signer le registre',
    },
    nightstand: {
      eyebrow: 'Et sur votre table de chevet ?',
      heading: 'Le livre en cours',
      speech:
        '« Que lisez-vous en ce moment ? Dites-moi où se trouve votre marque-page, et chaque jour je vous dirai jusqu’à quelle page lire. À la dernière page, il rejoindra votre étagère. »',
      greet: (name: string) =>
        `« Enchanté, ${name}. Que lisez-vous en ce moment ? Dites-moi où se trouve votre marque-page, et chaque jour je vous dirai jusqu’à quelle page lire. À la dernière page, il rejoindra votre étagère. »`,
      book: 'Le livre que vous lisez',
      onPage: 'Votre marque-page est à la page',
      totalPages: 'Nombre de pages du livre',
      nothing: 'Rien pour l’instant',
      put: 'Le poser sur la table de chevet',
    },
    install: {
      eyebrow: 'Une dernière chose',
      heading: 'Une clé de la salle',
      speech:
        '« Gardez la salle de lecture sur votre écran d’accueil : elle s’ouvre comme n’importe quelle application, fonctionne sans connexion, et peut vous rappeler qu’il est l’heure de lire. »',
      notNow: 'Pas maintenant',
      add: 'L’ajouter à mon écran d’accueil',
      iosShare: 'Touchez le bouton ',
      iosShareButton: 'Partager',
      iosShareEnd: ' dans la barre d’outils de Safari.',
      iosScroll: 'Faites défiler et choisissez ',
      iosAddToHome: 'Sur l’écran d’accueil',
      iosAdd: 'Touchez ',
      iosAddButton: 'Ajouter',
      iosAddEnd: '. La clé est à vous.',
      done: 'C’est fait',
      menu: 'Dans le menu de votre navigateur, cherchez ',
      menuInstall: 'Installer l’application',
      menuOr: ' ou ',
      menuAddHome: 'Ajouter à l’écran d’accueil',
      accepted: '« Splendide. La clé est sur votre écran d’accueil. »',
      dismissed: '« Une autre fois, alors. La porte est toujours ouverte. »',
    },
    finale: {
      eyebrow: 'Et maintenant',
      heading: 'Votre première carte vous attend',
      speech: (name: string | null, goal: number, readTo: number | null, bookplate: string) =>
        `« Le livre du jour est sur la table${name ? `, ${name}` : ''}. Touchez-le, et il s’ouvrira sur votre page — ${pages(goal)} aujourd’hui${readTo === null ? '' : `, jusqu’à la page ${n(readTo)}`}. Lisez-les, appuyez sur le bouton, et je refermerai le livre et scellerai la journée à la cire.${bookplate} Prenez votre temps ; la lampe est allumée. »`,
      oneBookplate: (title: string) => ` Oh — et vous avez déjà gagné votre premier ex-libris : « ${title} ».`,
      bookplates: (value: number) => ` Oh — et vous avez déjà gagné ${n(value)} ex-libris.`,
      begin: 'Tourner la première page',
    },
    replay: '🦉 Refaire la visite',
  },
};
