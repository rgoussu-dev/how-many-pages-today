/** The shell's router: three hash routes (GitHub Pages has no server-side routing). */

const ROUTES = ['today', 'progress', 'profile'] as const;
type Route = (typeof ROUTES)[number];

const TITLES: Record<Route, string> = {
  today: 'How Many Pages Today',
  progress: 'Progress · How Many Pages Today',
  profile: 'You · How Many Pages Today',
};

const routeOf = (hash: string): Route => {
  const name = hash.replace(/^#/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'today';
};

export function startRouter(root: ParentNode = document): void {
  const show = (scroll: boolean) => {
    const route = routeOf(location.hash);
    for (const section of root.querySelectorAll<HTMLElement>('[data-route]')) {
      section.hidden = section.dataset.route !== route;
    }
    for (const tab of root.querySelectorAll<HTMLElement>('[data-tab]')) {
      if (tab.dataset.tab === route) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    document.title = TITLES[route];
    if (scroll) window.scrollTo({ top: 0 });
  };
  window.addEventListener('hashchange', () => show(true));
  show(false);
}
