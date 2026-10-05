import { QuartzComponent, QuartzComponentConstructor } from "./types"
import style from "./styles/sopFold.scss"
// @ts-ignore
import script from "./scripts/sopFold.inline"

// Collapsible sections: a toggle on each h1-h3 hides the content up to the next heading of the
// same or higher level. Everything starts open. Renders nothing itself.
export default (() => {
  const SopFold: QuartzComponent = () => null
  SopFold.afterDOMLoaded = script
  SopFold.css = style
  return SopFold
}) satisfies QuartzComponentConstructor
