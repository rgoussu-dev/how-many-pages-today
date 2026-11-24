# infra/install-browser — conventions

- Construct it at the very start of `main.ts`, before any `await`: the install event fires
  once, early, and is lost if nobody listens.
- Feature-detect; never assume an install prompt exists.
