# @hmpt/commons

Default implementations of the ubiquitous ports: `systemClock`, `mathRandom`,
`deviceLanguages` (`navigator.languages`, in a page or a service worker). Wired by the
assembly points (`main.ts`, `sw.ts`); tests use the fakes in `@hmpt/domain-core/testing`.
