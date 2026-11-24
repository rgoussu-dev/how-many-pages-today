/** The shell's router: four hash routes (GitHub Pages has no server-side routing). */

export const ROUTES = ['today', 'progress', 'overview', 'profile'] as const;
export type Route = (typeof ROUTES)[number];

const routeOf = (hash: string): Route => {
  const name = hash.replace(/^#/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'today';
};

export interface Router {
  /** Re-titles the document — after the language changes. */
  retitle(): void;
}

/** `titles` names each route's document title, in the reader's language of the moment. */
export function startRouter(titles: () => Record<Route, string>, root: ParentNode = document): Router {
  const retitle = () => {
    document.title = titles()[routeOf(location.hash)];
  };
  const show = (scroll: boolean) => {
    const route = routeOf(location.hash);
    for (const section of root.querySelectorAll<HTMLElement>('[data-route]')) {
      section.hidden = section.dataset.route !== route;
    }
    for (const tab of root.querySelectorAll<HTMLElement>('[data-tab]')) {
      if (tab.dataset.tab === route) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    retitle();
    if (scroll) window.scrollTo({ top: 0 });
  };
  window.addEventListener('hashchange', () => show(true));
  show(false);
  return { retitle };
}
