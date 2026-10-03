import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { BASE_URL } from "./site"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [Component.SopTabs()],
  footer: Component.Footer({
    links: {
      "Open Game License": `https://${BASE_URL}/Meta/Legal-and-Open-Game-License`,
      "Original wiki": "https://spheresofpower.wikidot.com",
      "Drop Dead Studios": "https://www.dropdeadstudios.com",
    },
  }),
}

// Full-width top bar (rendered in the "left sidebar" slot, which the grid in
// quartz/styles/variables.scss stretches across the top): site title + search + toggles.
const topBar = [
  Component.PageTitle(),
  Component.Flex({
    components: [
      { Component: Component.PagefindSearch(), grow: true },
      { Component: Component.Darkmode() },
      { Component: Component.ReaderMode() },
    ],
    gap: "0.75rem",
  }),
]

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: topBar,
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: topBar,
  right: [],
}
