import type { AchievementId, ChallengeError, FieldError, ReminderError } from '@hmpt/domain-contract';
import type { Messages } from './en';

/*
 * Le carnet de phrases français. Il suit l’anglais clé pour clé (`Messages`), mais il ne le
 * traduit pas mot à mot : il le dit comme on le dirait, avec la bonne humeur d’une petite
 * bibliothèque de quartier. On vouvoie la personne qui lit, sans jamais la genrer.
 * Typographie : espace fine insécable avant ? ! ; et %, insécable avant : et dans « ».
 */

const number = new Intl.NumberFormat('fr');
const n = (value: number) => number.format(value);
// En français, 0 et 1 s’accordent au singulier.
const count = (value: number, one: string, many = `${one}s`) => `${n(value)} ${value <= 1 ? one : many}`;
const pages = (value: number) => count(value, 'page');
const pagesRead = (value: number) => count(value, 'page lue', 'pages lues');
const days = (value: number) => count(value, 'jour');

const ACHIEVEMENTS: Record<AchievementId, { readonly title: string; readonly description: string }> = {
  'first-challenge': { title: 'Premier chapitre', description: 'Relevez votre tout premier défi.' },
  'streak-3': { title: 'Petit bois', description: 'Lisez trois jours d’affilée.' },
  'streak-7': { title: 'Une semaine de mots', description: 'Lisez sept jours d’affilée.' },
  'streak-30': { title: 'Un mois de ferveur', description: 'Lisez trente jours d’affilée.' },
  'streak-100': { title: 'Centurion', description: 'Cent jours d’affilée. Rien que ça.' },
  'book-1': { title: 'Fin', description: 'Terminez votre premier livre.' },
  'books-5': { title: 'Une étagère à soi', description: 'Terminez cinq livres.' },
  'books-12': { title: 'Un livre par mois', description: 'Terminez douze livres.' },
  'pages-500': { title: 'Cinq cents pages', description: 'Lisez 500 pages en tout.' },
  'pages-1000': { title: 'Mille pages', description: 'Lisez 1 000 pages en tout.' },
  'pages-5000': { title: 'Rat de bibliothèque', description: 'Lisez 5 000 pages en tout.' },
  marathon: { title: 'Marathon', description: 'Lisez 100 pages ou plus dans la journée.' },
  'beyond-goal': { title: 'Encore un chapitre !', description: 'Dépassez l’objectif du jour.' },
  'double-goal': { title: 'Jusqu’au bout de la nuit', description: 'Lisez au moins le double de l’objectif du jour.' },
  'extra-100': { title: 'Chapitres en rab', description: 'Accumulez 100 pages au-delà de vos objectifs.' },
  'page-binge': { title: 'Impossible à lâcher', description: 'Lisez 200 pages ou plus dans la journée.' },
  'little-by-little': {
    title: 'Petit à petit',
    description: 'Notez une journée sous l’objectif. Chaque page compte !',
  },
  'final-chapter': { title: 'Le mot de la fin', description: 'Terminez un livre avec la lecture du jour.' },
  'early-bird': { title: 'Lève-tôt', description: 'Validez un défi avant 8 h.' },
  'night-owl': { title: 'Oiseau de nuit', description: 'Validez un défi après 22 h.' },
  weekend: { title: 'Week-end au coin du feu', description: 'Lisez le samedi et le dimanche d’un même week-end.' },
  comeback: { title: 'Le grand retour', description: 'Reprenez la lecture après au moins deux jours sans.' },
  introductions: { title: 'Faisons connaissance', description: 'Remplissez votre carte de lecture.' },
};

const CHALLENGE_ERRORS: Record<ChallengeError, string> = {
  'already-completed': 'C’est déjà scellé pour aujourd’hui !',
  'not-completed': 'Notez d’abord votre lecture.',
  'invalid-pages': 'Des pages entières, s’il vous plaît — et au moins une !',
  'invalid-title': 'Ce titre est un brin trop long.',
};

const REMINDER_ERRORS: Record<ReminderError, string> = {
  'invalid-time': 'Choisissez une heure, par exemple 20:30.',
  'permission-denied':
    'Les notifications sont bloquées pour cette appli. Autorisez-les dans les réglages du navigateur ou du téléphone, puis réessayez.',
  unsupported:
    'Ce navigateur ne sait pas afficher de notifications ici. Sur iPhone et iPad, ajoutez d’abord l’appli à l’écran d’accueil. Le rappel par agenda, juste en dessous, marche partout.',
  'delivery-failed':
    'La notification n’a pas voulu s’afficher sur cet appareil. Le rappel par agenda, juste en dessous, marche partout.',
};

function fieldError({ field, problem, min = 0, max = 0 }: FieldError): string {
  switch (problem) {
    case 'required':
      return field === 'displayName'
        ? 'Il me faut un nom pour la carte — un surnom fera l’affaire !'
        : field === 'avatar'
          ? 'Choisissez un portrait, n’importe lequel !'
          : field === 'title'
            ? 'Il me manque le titre !'
            : 'Celui-ci, il me le faut.';
    case 'too-long':
      return `Un peu long, tout ça : ${n(max)} caractères au plus.`;
    case 'not-whole':
      return field === 'pagesRead' ? 'Des pages entières, s’il vous plaît — pas de demi-page !' : 'Un nombre entier, s’il vous plaît.';
    case 'out-of-range':
      return field === 'pagesRead' ? `Entre ${n(min)} et ${n(max)} pages, voyons.` : `Un nombre entre ${n(min)} et ${n(max)}.`;
    case 'below-minimum':
      return 'Le maximum ne peut pas passer sous le minimum !';
    case 'past-the-end':
      return `Le livre s’arrête page ${n(max)} — pas plus loin !`;
    case 'no-book':
      return 'Rien sur la table de chevet pour l’instant.';
  }
}

export const fr: Messages = {
  common: {
    optional: '(si vous voulez)',
    title: 'Titre',
    aBook: 'Un livre',
    saved: 'C’est noté ✓',
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
      overview: 'Vos lectures, dans le rétro',
      profile: 'Votre salle de lecture',
    },
    titles: {
      today: 'Combien de pages aujourd’hui',
      progress: 'Progrès · Combien de pages aujourd’hui',
      overview: 'Bilan · Combien de pages aujourd’hui',
      profile: 'Vous · Combien de pages aujourd’hui',
    },
    footnote: 'Tout reste ici, sur cet appareil. Effacez les données du site, et tout s’envole.',
    update: {
      notice: 'Tout frais : une nouvelle édition vient d’arriver sur l’étagère !',
      open: 'Voyons ça',
      later: 'Plus tard',
    },
    fatal:
      'Impossible de vous servir votre carte du jour : ce navigateur bloque le stockage local (navigation privée, peut-être ?). Ouvrez l’appli dans une fenêtre normale pour garder vos progrès.',
  },

  tour: {
    card: {
      title: 'Votre carte du jour',
      text: 'Chaque jour, je pose un livre fermé sur la table. Touchez-le : il s’ouvre sur la page du jour, avec une image, un nombre de pages — et, si un livre attend sur votre table de chevet, la page jusqu’où aller. Lisez, appuyez sur le bouton : je referme le livre, je scelle la journée et j’avance votre marque-page. Plus de pages, moins, ou un livre de fini ? Dites-le-moi sous « Plus ou moins de pages ? ». Chaque page compte !',
    },
    candle: {
      title: 'Gardez la flamme',
      text: 'Lisez un peu chaque jour, et cette bougie tient bon. Vos pages, vos livres et votre rang de lecture sont gardés au chaud ici aussi.',
    },
    library: {
      title: 'Votre bibliothèque',
      text: 'Le livre de votre table de chevet et son marque-page, l’étagère de vos livres terminés, le carnet des six dernières semaines, et vos ex-libris — de petites récompenses glanées en chemin.',
    },
    overview: {
      title: 'Dans le rétro',
      text: 'Vos mois et vos années de lecture d’un coup d’œil : pages, jours, livres… et vos plus belles journées.',
    },
    room: {
      title: 'Votre salle de lecture',
      text: 'Votre carte de lecture, la langue que je parle, la taille du défi du jour, et un petit rappel à l’heure qui vous arrange.',
    },
  },

  greeting: {
    hello: 'Bonjour',
    salutation: (hour: number) =>
      hour < 5 ? 'Toujours debout' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir',
    named: (salutation: string, name: string) => `${salutation}, ${name}`,
    anonymous: (salutation: string) => `${salutation} !`,
    nightstand: 'Sur la table de chevet : ',
    nightstandEnd: (bookmark: number | null) => (bookmark === null || bookmark === 0 ? '.' : `, page ${n(bookmark)}.`),
    newHere: 'Première visite ? ',
    fillCard: 'Remplissez votre carte de lecture',
    laidOut: 'Votre carte du jour est servie.',
  },

  card: {
    today: 'Aujourd’hui',
    unit: (value: number) => (value <= 1 ? 'page' : 'pages'),
    upTo: (page: number) => `jusqu’à la page ${n(page)}`,
    toTheEnd: (page: number) => `jusqu’au bout du livre — page ${n(page)}`,
    placeBookmark: 'Glissez-y un marque-page',
    readThem: (value: number) => (value === 1 ? 'J’ai lu ma page' : `J’ai lu mes ${n(value)} pages`),
    readMore: 'Plus ou moins de pages ?',
    pagesRead: 'Pages vraiment lues',
    finishedBook: 'J’ai fini mon livre !',
    whichBook: 'Lequel ?',
    logReading: 'Noter ma lecture',
    readSomeMore: 'Encore quelques pages ?',
    pagesToAdd: 'Pages en plus',
    addPages: 'Ajouter',
    closeBook: 'Refermer le livre',
    openCover: 'Ouvrir la carte du jour',
    coverEyebrow: 'La carte du jour',
    tapToOpen: 'Touchez pour ouvrir',
    sealedGroup: 'Aujourd’hui : lu et scellé',
    sealed: 'Lu, et scellé !',
    openBook: 'Rouvrir le livre',
    bookmarkAt: (page: number, total: number | null) =>
      total === null ? `Marque-page glissé page ${n(page)}.` : `Marque-page glissé page ${n(page)} sur ${n(total)}.`,
    bookmarkTag: (page: number) => (page > 0 ? `p. ${n(page)}` : ''),
    bookmarkLabel: (title: string, page: number) =>
      page > 0
        ? `Marque-page de « ${title} », glissé page ${n(page)}`
        : `Marque-page de « ${title} », glissé au tout début`,
    lastPage: (title: string) => `Dernière page de « ${title} » ! Alors, terminé ?`,
    shelveIt: 'Hop, sur l’étagère !',
    hints: [
      'Un coin douillet, et en avant : les pages ne vont pas se lire toutes seules.',
      'Un plaid, une tasse de thé, et ces quelques pages.',
      'Le fauteuil vous attend depuis ce matin.',
      'Téléphone au placard, nez dans le livre.',
      'Allumez la lampe ; le reste suivra.',
      'Chaque page compte. Celles-ci plus encore.',
    ],
    hintDone: (streak: number) =>
      streak > 1 ? `${days(streak)} d’affilée ! Une nouvelle carte vous attend demain.` : 'Une nouvelle carte vous attend demain.',
    errors: CHALLENGE_ERRORS,
    summary: {
      book: (read: number) => `${pages(read)} — et un livre de fini. Bravo !`,
      beyond: (read: number, goal: number) => `${pages(read)} sur ${n(goal)} — ${pages(read - goal)} de rab !`,
      short: (read: number, goal: number) => `${pages(read)} sur ${n(goal)}. Chaque page compte !`,
      exact: (read: number) => `${pages(read)}, pile comme prévu.`,
    },
    notes: {
      met: [
        'Bien lu ! La journée est à vous.',
        'Pas une page ne manque à l’appel. Splendide.',
        'Mission accomplie. La lampe peut souffler un peu.',
        'C’est comme ça qu’on prend le pli : une page à la fois.',
        'Le bibliothécaire hoche la tête, ravi, par-dessus ses lunettes.',
        'Encore une journée dans le carnet. Bravo !',
      ],
      beyond: [
        'Plus loin que le marque-page — l’histoire ne voulait plus vous lâcher !',
        'Juste un petit chapitre de plus, hein ? On connaît la chanson.',
        'Au-delà de l’objectif ! Voilà qui fait plaisir.',
        'Plus que demandé. Même les étagères applaudissent.',
      ],
      short: [
        'Chaque page compte — et celles-ci aussi !',
        'Un petit chapitre reste un chapitre. La bougie brille toujours.',
        'Il y a des jours en format poche. Demain, on tourne la page.',
        'Un peu, c’est déjà beaucoup. À demain !',
      ],
      book: [
        'La dernière page est tournée. Quel moment !',
        'Fin — et vivement le prochain !',
        'Un livre de plus sur l’étagère. Le bibliothécaire est aux anges.',
      ],
    },
    bookFinishedNote: (title: string, note: string) => `« ${title} », c’est fini ! ${note}`,
    newBookplate: (title: string) => `Nouvel ex-libris : ${title}`,
    newBookplates: (value: number) => `${n(value)} nouveaux ex-libris aujourd’hui !`,
    inARow: (streak: number) => `${n(streak)} jours d’affilée`,
    past: {
      read: (read: number) => `${pagesRead(read)} · scellé`,
      unread: 'pages prévues, restées en plan',
      noCard: 'Pas de carte ce jour-là',
      exLibris: 'Ex libris',
      newReader: 'Votre nom ici',
      chapter: 'Chapitre',
      one: 'Premier',
    },
  },

  summary: {
    region: 'Votre lecture',
    unit: (streak: number) => (streak <= 1 ? 'jour' : 'jours'),
    inARow: 'd’affilée',
    lightIt: 'Lisez aujourd’hui pour allumer la bougie !',
    burnsOn: 'd’affilée — la flamme tient bon.',
    keepLit: 'd’affilée — lisez aujourd’hui pour garder la flamme.',
    best: 'Record',
    pagesRead: 'Pages lues',
    booksRead: 'Livres lus',
    rank: (roman: string) => `Rang ${roman}`,
    meter: 'En route vers le rang suivant',
    toNext: (remaining: number) => `Plus que ${pages(remaining)} avant le rang suivant.`,
    top: 'Tout en haut de l’échelle. Chapeau bas !',
    levels: [
      'Tourne-page',
      'Bibliophile en herbe',
      'Grignote-chapitres',
      'Dévore-livres',
      'Bibliophile',
      'Puits de science',
      'Sage des rayonnages',
      'Bibliothécaire',
      'Archiviste',
      'Légende vivante',
    ],
  },

  shelf: {
    heading: 'Votre étagère',
    count: (books: number) => count(books, 'livre'),
    nightstand: 'Sur la table de chevet',
    finishedIt: 'Je l’ai fini !',
    finishedABook: 'Un livre de fini ?',
    whichOne: 'Lequel ?',
    putOnShelf: 'Hop, sur l’étagère',
    readingElse: 'Vous lisez autre chose ?',
    whatReading: 'Que lisez-vous en ce moment ?',
    anotherInstead: 'Un autre livre à la place ?',
    titlePlaceholder: 'Le titre du livre',
    onPage: 'J’en suis à la page',
    totalPages: 'Nombre de pages',
    fromTheStart: 'Au tout début',
    startReading: 'Je commence',
    shelfLabel: 'Vos livres terminés',
    empty: 'Votre étagère attend son tout premier livre.',
    spine: (title: string, date: string) => `${title}, terminé le ${date}`,
    spineTitle: (title: string, date: string) => `${title} — terminé le ${date}`,
    bookmark: (page: number, total: number | null) =>
      total === null ? `Marque-page glissé page ${n(page)}` : `Page ${n(page)} sur ${n(total)}`,
    percent: (percent: number) => `${percent} % lu`,
    noBookmark: 'Pas encore de marque-page dans celui-ci.',
    lastPage: 'Dernière page ! Alors, terminé ?',
    progressLabel: 'Où vous en êtes dans le livre',
    moveBookmark: 'Déplacer le marque-page',
    placeBookmark: 'Glisser un marque-page',
  },

  calendar: {
    heading: 'Les six dernières semaines',
    legend: { met: 'objectif atteint', short: 'quelques pages', missed: 'jour sans', today: 'aujourd’hui' },
    read: (date: string, read: number, goal: number, book: boolean) =>
      `${date} — ${pagesRead(read)} sur ${n(goal)}${book ? ', et un livre de fini' : ''}`,
    missed: (date: string) => `${date} — jour sans`,
  },

  achievements: {
    heading: 'Vos ex-libris',
    tally: (earned: number, total: number) => `${n(earned)} / ${n(total)}`,
    earned: (date: string) => `Obtenu le ${date}`,
    locked: 'Encore sous clé',
    list: ACHIEVEMENTS,
  },

  overview: {
    lookBackBy: 'Voir par',
    month: 'Mois',
    year: 'Année',
    previous: 'Précédent',
    next: 'Suivant',
    previousOf: (unit: 'month' | 'year') => (unit === 'month' ? 'Mois précédent' : 'Année précédente'),
    nextOf: (unit: 'month' | 'year') => (unit === 'month' ? 'Mois suivant' : 'Année suivante'),
    pagesRead: 'Pages lues',
    daysRead: 'Jours de lecture',
    booksFinished: 'Livres terminés',
    perDay: 'Pages lues, jour après jour',
    perMonth: 'Pages lues, mois après mois',
    goalKey: 'l’objectif du jour',
    showTable: 'Voir le tableau',
    day: 'Jour',
    monthColumn: 'Mois',
    goal: 'Objectif',
    noneEither: (period: string) => `Rien non plus en ${period}.`,
    none: (period: string) => `Rien en ${period} : ça décolle !`,
    same: (period: string) => `Pile comme en ${period}.`,
    change: (up: boolean, by: number, period: string) =>
      up ? `↑ ${n(by)} de plus qu’en ${period} !` : `↓ ${n(by)} de moins qu’en ${period}.`,
    ofSoFar: (span: number) => `sur ${n(span)} jusqu’ici`,
    of: (span: number) => `sur ${n(span)}`,
    pages: (value: number) => pages(value),
    noCard: 'Pas de carte',
    notRead: 'Jour sans',
    dayDetail: (label: string, goal: number | null, book: boolean) =>
      `${label}${goal !== null ? ` · objectif ${n(goal)}` : ''}${book ? ' · livre terminé' : ''}`,
    monthDetail: (month: string, daysRead: number, books: number) =>
      `${month} · ${days(daysRead)} de lecture${books ? ` · ${count(books, 'livre')}` : ''}`,
    bestDay: (date: string, read: number) => `Plus belle journée : ${date}, ${pages(read)}.`,
    bestMonth: (month: string, read: number) => `Plus beau mois : ${month}, ${pages(read)}.`,
    longestRun: (run: number) => `Plus longue série : ${days(run)} d’affilée.`,
    goalsMet: (met: number, read: number) => `Objectif atteint ${days(met)} sur ${n(read)}.`,
    beyond: (extra: number) => `${pages(extra)} de rab sur vos objectifs.`,
    average: (perDay: number) => `En moyenne, ${pages(perDay)} par jour de lecture.`,
    booksIn: (year: number) => `Livres terminés en ${year}`,
    noBookMonth: (month: string) => `Pas encore de livre terminé en ${month}… ça viendra !`,
    noBookYear: (year: number) => `Pas encore de livre terminé en ${year}… ça viendra !`,
    span: (from: string, to: string) => ` — du ${from} au ${to}`,
    finishedOn: (date: string) => ` — terminé le ${date}`,
  },

  profile: {
    heading: 'Ex libris',
    intro: 'Votre carte de lecture. Elle ne quitte jamais cet appareil — rien n’est envoyé nulle part.',
    since: (date: string) => `Carte ouverte le ${date} · elle reste ici, sur cet appareil.`,
    avatar: 'Portrait',
    name: 'Nom',
    genre: 'Genre de prédilection',
    genrePlaceholder: 'Science-fiction, poésie, polar…',
    save: 'Enregistrer',
    check: 'Petit souci dans les champs en rouge.',
  },

  language: {
    heading: 'Langue',
    intro: 'Je parle la langue de votre appareil — à moins que vous ne préfériez l’autre.',
    legend: 'Langue',
    auto: (name: string) => `Comme cet appareil (${name})`,
  },

  range: {
    heading: 'Le défi du jour',
    intro: 'Chaque carte tire son nombre de pages dans cette fourchette.',
    min: 'Minimum',
    max: 'Maximum',
    step: 'Par paliers de',
    possible: 'Cartes possibles',
    more: (hidden: number) => `… et ${n(hidden)} de plus`,
    save: 'Enregistrer la fourchette',
    invalid: 'Cette fourchette ne tient pas encore debout.',
    redrawn: 'C’est noté ✓ — la carte du jour a été retirée au sort pour coller.',
    fromNext: 'C’est noté ✓ — dès la prochaine carte.',
  },

  reminder: {
    heading: 'Le petit rappel',
    intro: 'Un petit signe chaque jour à la même heure, tant que vos pages ne sont pas lues.',
    everyDay: 'Me le rappeler chaque jour',
    at: 'À',
    save: 'Enregistrer le rappel',
    test: 'Faire un essai',
    neverMisses: 'Un rappel qui ne rate jamais le coche ?',
    help: 'Cette appli vit entièrement sur votre téléphone, sans serveur. Android (Chrome) peut la réveiller en coulisses — à peu près à l’heure dite. Sur iPhone, les rappels n’arrivent que si l’appli est ouverte. Pour un rappel qui sonne à l’heure pile, confiez-le à votre agenda :',
    calendar: '📅 Ajouter à mon agenda',
    off: 'Rappel coupé.',
    background: (time: string) => `C’est noté ✓ — un petit signe vers ${time}, même appli fermée.`,
    whileOpen: (time: string) =>
      `C’est noté ✓ — un petit signe à ${time} tant que l’appli est ouverte. Pour ne jamais le rater, passez par l’agenda.`,
    testSent: 'Essai envoyé — jetez un œil à vos notifications !',
    errors: REMINDER_ERRORS,
    invite: {
      file: 'rappel-lecture.ics',
      summary: '📖 Combien de pages aujourd’hui ?',
      description: (url: string) => `Votre carte du jour vous attend : ${url}`,
      alarm: 'C’est l’heure de vos pages !',
    },
  },

  celebration: {
    beyond: (extra: number) => `✨ ${pages(extra)} de rab. Splendide !`,
    short: (read: number) => `🐢 ${pagesRead(read)}. Chaque page compte — la bougie brille toujours.`,
    streak: (streak: number) => `🕯️ ${days(streak)} d’affilée. Bravo !`,
    read: (read: number) => `${pagesRead(read)}. Bien joué !`,
    added: (added: number, total: number) => `📖 ${count(added, 'page')} de plus — ${n(total)} aujourd’hui !`,
    shelved: (title: string, number: number) => `📕 « ${title} » rejoint votre étagère — c’est le livre n° ${n(number)} !`,
    shelvedUntitled: (number: number) => `📕 Un livre de plus sur l’étagère — le n° ${n(number)} !`,
    achievement: (icon: string, title: string) => `${icon} Nouvel ex-libris : ${title}`,
  },

  welcome: {
    librarian: 'Le bibliothécaire',
    back: 'Retour',
    next: 'Suivant',
    onward: 'En avant !',
    skipTour: 'Passer la visite',
    tourCount: (index: number, total: number) => `Visite des lieux · ${index} sur ${total}`,
    door: {
      eyebrow: 'La porte grince…',
      heading: 'La salle de lecture',
      speech:
        '« Tiens, un nouveau visage ! Entrez donc, et attention à la poussière. Je m’occupe de cette petite bibliothèque, et chaque jour je tire une carte : une image, et un nombre de pages à lire. C’est tout — et croyez-moi, c’est bien assez. »',
      languages: 'Langue',
      skip: 'Je connais la maison',
      enter: 'Entrer',
    },
    card: {
      eyebrow: 'D’abord, le registre',
      heading: 'Votre carte de lecture',
      speech: '« Ici, tout le monde a la sienne. Elle ne quitte jamais cette pièce — ce que vous me confiez reste entre nous. »',
      portrait: 'Choisissez un portrait',
      name: 'Comment dois-je vous appeler ?',
      genre: 'Un genre de prédilection ?',
      genrePlaceholder: 'Poésie, polar, science-fiction…',
      later: 'Plus tard',
      sign: 'Signer le registre',
    },
    nightstand: {
      eyebrow: 'Et sur votre table de chevet ?',
      heading: 'Le livre du moment',
      speech:
        '« Que lisez-vous en ce moment ? Dites-moi où en est votre marque-page : chaque jour, je vous dirai jusqu’à quelle page aller. Et à la dernière page, hop, il rejoindra votre étagère. »',
      greet: (name: string) =>
        `« Enchanté, ${name} ! Que lisez-vous en ce moment ? Dites-moi où en est votre marque-page : chaque jour, je vous dirai jusqu’à quelle page aller. Et à la dernière page, hop, il rejoindra votre étagère. »`,
      book: 'Le livre que vous lisez',
      onPage: 'Votre marque-page est à la page',
      totalPages: 'Nombre de pages du livre',
      nothing: 'Rien pour l’instant',
      put: 'Sur la table de chevet !',
    },
    install: {
      eyebrow: 'Une dernière chose',
      heading: 'Une clé de la maison',
      speech:
        '« Gardez la salle de lecture sur votre écran d’accueil : elle s’ouvre comme une vraie appli, marche même sans réseau, et peut vous souffler qu’il est l’heure de lire. »',
      notNow: 'Pas maintenant',
      add: 'L’ajouter à mon écran d’accueil',
      iosShare: 'Touchez le bouton ',
      iosShareButton: 'Partager',
      iosShareEnd: ' dans la barre de Safari.',
      iosScroll: 'Faites défiler et choisissez ',
      iosAddToHome: 'Sur l’écran d’accueil',
      iosAdd: 'Touchez ',
      iosAddButton: 'Ajouter',
      iosAddEnd: '. La clé est à vous !',
      done: 'C’est fait !',
      menu: 'Dans le menu de votre navigateur, cherchez ',
      menuInstall: 'Installer l’application',
      menuOr: ' ou ',
      menuAddHome: 'Ajouter à l’écran d’accueil',
      accepted: '« Parfait ! La clé est sur votre écran d’accueil. »',
      dismissed: '« Une autre fois, alors. La porte reste ouverte. »',
    },
    finale: {
      eyebrow: 'Et maintenant…',
      heading: 'Votre première carte vous attend',
      speech: (name: string | null, goal: number, readTo: number | null, bookplate: string) =>
        `« Le livre du jour est sur la table${name ? `, ${name}` : ''}. Touchez-le, il s’ouvrira sur votre page — ${pages(goal)} aujourd’hui${readTo === null ? '' : `, jusqu’à la page ${n(readTo)}`}. Lisez-les, appuyez sur le bouton, et je refermerai le livre en scellant la journée à la cire.${bookplate} Prenez votre temps : la lampe est allumée. »`,
      oneBookplate: (title: string) => ` Oh, et vous avez déjà gagné votre premier ex-libris : « ${title} » !`,
      bookplates: (value: number) => ` Oh, et vous avez déjà gagné ${n(value)} ex-libris !`,
      begin: 'Tourner la première page',
    },
    replay: '🦉 Refaire la visite',
  },
};
