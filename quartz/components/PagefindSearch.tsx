import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/pagefindSearch.scss"
// @ts-ignore
import script from "./scripts/pagefindSearch.inline"
import { classNames } from "../util/lang"

// Full-text search backed by Pagefind (https://pagefind.app). The index is built after
// `quartz build` by running `npx pagefind --site public`, and is split into small chunks
// that are fetched on demand, so it scales to thousands of pages.
export default (() => {
  const PagefindSearch: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return (
      <div class={classNames(displayClass, "pf-search")}>
        <button class="pf-search-button" aria-label="Search">
          <svg role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.9 19.7">
            <title>Search</title>
            <g class="search-path" fill="none">
              <path stroke-linecap="square" d="M18.5 18.3l-5.4-5.4" />
              <circle cx="8" cy="8" r="7" />
            </g>
          </svg>
          <p>Search</p>
          <kbd>Ctrl K</kbd>
        </button>
        <div class="pf-search-container">
          <div class="pf-search-space">
            <div class="pf-search-ui"></div>
            <a class="pf-search-all" href="Search" hidden>
              See all results →
            </a>
          </div>
        </div>
      </div>
    )
  }

  PagefindSearch.afterDOMLoaded = script
  PagefindSearch.css = style

  return PagefindSearch
}) satisfies QuartzComponentConstructor
