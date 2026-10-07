import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import breadcrumbsStyle from "./styles/breadcrumbs.scss"
import { FullSlug, SimpleSlug, resolveRelative, simplifySlug } from "../util/path"
import { classNames } from "../util/lang"
import { trieFromAllFiles } from "../util/ctx"

type CrumbData = {
  displayName: string
  path: string
}

interface BreadcrumbOptions {
  /**
   * Symbol between crumbs
   */
  spacerSymbol: string
  /**
   * Name of first crumb
   */
  rootName: string
  /**
   * Whether to look up frontmatter title for folders (could cause performance problems with big vaults)
   */
  resolveFrontmatterTitle: boolean
  /**
   * Whether to display the current page in the breadcrumbs.
   */
  showCurrentPage: boolean
}

const defaultOptions: BreadcrumbOptions = {
  spacerSymbol: "❯",
  rootName: "Home",
  resolveFrontmatterTitle: true,
  showCurrentPage: true,
}

function formatCrumb(displayName: string, baseSlug: FullSlug, currentSlug: SimpleSlug): CrumbData {
  return {
    displayName: displayName.replaceAll("-", " "),
    path: resolveRelative(baseSlug, currentSlug),
  }
}

export default ((opts?: Partial<BreadcrumbOptions>) => {
  const options: BreadcrumbOptions = { ...defaultOptions, ...opts }
  const Breadcrumbs: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
    ctx,
  }: QuartzComponentProps) => {
    const trie = (ctx.trie ??= trieFromAllFiles(allFiles))
    const slugParts = fileData.slug!.split("/")
    const pathNodes = trie.ancestryChain(slugParts)

    if (!pathNodes) {
      return null
    }

    // "Folder notes": a folder Foo/ holding Foo/Foo.md (a class page with its archetypes beside
    // it). Its crumb opens that note instead of the folder listing, and on the note itself the
    // folder crumb is dropped so it doesn't read "Armorist ❯ Armorist".
    const slugs = new Set(allFiles.map((f) => f.slug))
    const folderNote = (slug: string): FullSlug | undefined => {
      const folder = slug.replace(/\/?index$/, "")
      const name = folder.split("/").pop()
      const note = `${folder}/${name}` as FullSlug
      return name && slugs.has(note) ? note : undefined
    }

    const titles = new Map(allFiles.map((f) => [f.slug, f.frontmatter?.title]))
    let crumbs: CrumbData[] = pathNodes.map((node, idx) => {
      const isFolder = idx > 0 && idx < pathNodes.length - 1
      const note = isFolder ? folderNote(node.slug) : undefined
      const target = note || node.slug
      // a folder with a folder note reads as that note's title ("Warleader (warleader-sphere)/" -> "Warleader")
      const crumb = formatCrumb(node.displayName, fileData.slug!, simplifySlug(target))
      const title = note && titles.get(note)
      if (title) crumb.displayName = title
      if (idx === 0) {
        crumb.displayName = options.rootName
      }

      // For last node (current page), set empty path
      if (idx === pathNodes.length - 1) {
        crumb.path = ""
      }

      return crumb
    })

    if (pathNodes.length >= 3 && folderNote(pathNodes[pathNodes.length - 2].slug) === fileData.slug) {
      crumbs = [...crumbs.slice(0, -2), crumbs[crumbs.length - 1]]
    }

    if (!options.showCurrentPage) {
      crumbs.pop()
    }

    return (
      <nav class={classNames(displayClass, "breadcrumb-container")} aria-label="breadcrumbs">
        {crumbs.map((crumb, index) => (
          <div class="breadcrumb-element">
            <a href={crumb.path}>{crumb.displayName}</a>
            {index !== crumbs.length - 1 && <p>{` ${options.spacerSymbol} `}</p>}
          </div>
        ))}
      </nav>
    )
  }
  Breadcrumbs.css = breadcrumbsStyle

  return Breadcrumbs
}) satisfies QuartzComponentConstructor
