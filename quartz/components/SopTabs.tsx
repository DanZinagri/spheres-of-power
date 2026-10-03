import { QuartzComponent, QuartzComponentConstructor } from "./types"
import style from "./styles/sopTabs.scss"
// @ts-ignore
import script from "./scripts/sopTabs.inline"

// Turns the converter's .sop-tabs blocks (the wiki's Ultimate / Original tab widgets) into
// clickable tabs. Renders nothing itself; it only ships the script and styles.
export default (() => {
  const SopTabs: QuartzComponent = () => null
  SopTabs.afterDOMLoaded = script
  SopTabs.css = style
  return SopTabs
}) satisfies QuartzComponentConstructor
