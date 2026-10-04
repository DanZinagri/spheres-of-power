import { QuartzComponent, QuartzComponentConstructor } from "./types"
import style from "./styles/sopRoller.scss"
// @ts-ignore
import script from "./scripts/sopRoller.inline"

// Random-table rollers (the wiki's Wild Magic generators). The converter leaves a .sop-roller
// marker where each generator was; the script adds a Roll button that rolls on the next table.
export default (() => {
  const SopRoller: QuartzComponent = () => null
  SopRoller.afterDOMLoaded = script
  SopRoller.css = style
  return SopRoller
}) satisfies QuartzComponentConstructor
