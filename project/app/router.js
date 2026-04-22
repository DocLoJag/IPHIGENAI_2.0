/*
 * Minimal hash-based router: #/path?a=b
 * Exposes window.Router, window.useRoute, window.navigate, window.Link
 */
(function () {
  const { useState, useEffect, createElement: h } = React;

  const parseHash = () => {
    const raw = (window.location.hash || '#/').replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const query = {};
    if (qs) new URLSearchParams(qs).forEach((v, k) => (query[k] = v));
    return { path, query };
  };

  function navigate(to) {
    window.location.hash = to.startsWith('#') ? to : '#' + to;
  }

  function useRoute() {
    const [route, setRoute] = useState(parseHash());
    useEffect(() => {
      const onChange = () => setRoute(parseHash());
      window.addEventListener('hashchange', onChange);
      return () => window.removeEventListener('hashchange', onChange);
    }, []);
    return route;
  }

  function Link({ to, children, className, style, onClick }) {
    return h(
      'a',
      {
        href: '#' + to,
        className,
        style,
        onClick: (e) => {
          if (onClick) onClick(e);
        },
      },
      children
    );
  }

  window.useRoute = useRoute;
  window.navigate = navigate;
  window.Link = Link;
})();
