import { MarkdownView, PaneType, Plugin, TFile } from "obsidian";
import { SIDE_PANE_VIEW_TYPE, SidePane } from "./SidePane"
import { GetOnNoteViewExtension } from "./OnNoteViewExtension";
import { GetSearchCodeBlock } from "./SearchCodeBlock";
import { MySettings } from "./SettingTab";
import VectorServer from "./VectorServer";
import { SearchNoteModal } from "./SearchNoteModal";
// import { getEmbedding } from "./LocalVector";

const DEFAULT_SETTINGS: AINoteSuggestionSettings = {
    weaviateAddress: 'http://localhost:3636',
    weaviateClass: 'ObsidianVectors',
    limit: 30,
    inDocMatchNotes: true,
    showPercentageOnCodeQuery: false,
    autoCut: 0,
    distanceLimit: 0,
    cacheSearch: false
}

interface AINoteSuggestionSettings {
    weaviateAddress: string
    weaviateClass: string
    limit: number
    inDocMatchNotes: boolean
    showPercentageOnCodeQuery: boolean
    autoCut: number
    distanceLimit: number
    cacheSearch: boolean
}
export interface WeaviateFile {
    content: string
    metadata: string
    tags: string[]
    path: string
    filename: string
    mtime: string
    _additional: {
        id: string
        distance: number
    }
}

export const CODE_HOVER_ID = "AI_CODE_HOVER_ID"
export const SIDE_PANE_HOVER_ID = "AI_SIDE_PANE_HOVER_ID"

export default class AINoteSuggestionPlugin extends Plugin {
    statusBarItemEl: HTMLElement
    settings: AINoteSuggestionSettings
    vectorServer: VectorServer


    async onload() {
        // console.log("init Plugin")
        await this.loadSettings()
        this.addSettingTab(new MySettings(this.app, this))
        this.statusBarItemEl = this.addStatusBarItem()
        this.vectorServer = new VectorServer(
            this.settings.weaviateAddress,
            this.settings.weaviateClass,
            this.settings.limit,
            this
        )

        // show on hover settings
        this.registerHoverLinkSource(SIDE_PANE_HOVER_ID, {
            display: 'AI Note suggestions',
            defaultMod: true,
        })
        this.registerHoverLinkSource(CODE_HOVER_ID, {
            display: 'AI Note suggestions (Code block)',
            defaultMod: true,
        })


        this.registerEvents()
        this.registerCommands()
        this.registerEditorExtension(GetOnNoteViewExtension(this));
        this.registerView(SIDE_PANE_VIEW_TYPE, (leaf) => new SidePane(leaf, this))
        this.registerMarkdownCodeBlockProcessor("match", GetSearchCodeBlock(this))
        this.scanVault()


        // this.app.workspace.onLayoutReady(() => {
        // })

    }



    async onCreate(file: TFile) {
        if (file instanceof TFile) {

            const fileContent = await this.app.vault.cachedRead(file)
            // console.log("new file content", fileContent)
            if (fileContent) this.vectorServer.onUpdateFile(fileContent, file.path, file.basename, file.stat.mtime)
        }

    }

    async onModify(file: TFile) {
        if (file instanceof TFile) {

            const fileContent = await this.app.vault.cachedRead(file)
            // console.log("modify content", fileContent)

            if (fileContent) this.vectorServer.onUpdateFile(fileContent, file.path, file.basename, file.stat.mtime)
            else this.vectorServer.onDeleteFile(file.path)
        }

    }

    async onRename(file: TFile, oldPath: string) {
        if (file instanceof TFile) {

            // console.log("old path", oldPath)
            // console.log("new path", file.path)
            this.vectorServer.onRename(file.path, file.basename, file.stat.mtime, oldPath)
        }
    }

    async onDelete(file: TFile) {
        // console.log"delete path", file)
        this.vectorServer.onDeleteFile(file.path)
    }


    // initial scan ran on load and on setting changed 
    async scanVault() {
        const classExist = await this.vectorServer.initClass()
        const files = this.app.vault.getMarkdownFiles()
        // console.log"file scan size", files.length)
        const fileCountOnServer = await this.vectorServer.countOnDatabase()

        // push new file
        await Promise.all(
            files.map(async (file, index) => {
                const content = await this.app.vault.cachedRead(file)
                if (content) {
                    await this.vectorServer.onUpdateFile(content, file.path, file.basename, file.stat.mtime)
                    // // // console.log"update file", file)
                }

            })
        )
        // delete old file

        if (fileCountOnServer > files.length) {
            const weaviateFiles: WeaviateFile[] = await this.vectorServer.readAllPaths()
            const extraFiles = this.findExtraFiles(weaviateFiles, files)
            extraFiles.map(async (extra) => {
                await this.vectorServer.onDeleteFile(extra.path)
            })
        }

    }


    findExtraFiles(weaviateFiles: WeaviateFile[], localFiles: TFile[]) {
        const extraFiles = weaviateFiles.filter((weaviateFile) => !localFiles.some((file) => file.path === weaviateFile.path));
        return extraFiles
    }

    registerEvents() {
        // console.log("register events")

        this.registerEvent(this.app.vault.on('create',
            (file) => {
                if (file instanceof TFile) this.onCreate(file)
            }))
        this.registerEvent(this.app.vault.on('modify',
            (file) => {
                if (file instanceof TFile) this.onModify(file)
            }))
        this.registerEvent(this.app.vault.on('rename',
            (file, oldPath) => {
                if (file instanceof TFile) this.onRename(file, oldPath)
            }))
        this.registerEvent(this.app.vault.on('delete',
            (file) => {
                if (file instanceof TFile) this.onDelete(file)
            }))
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // console.log("save settings")
    }

    getCurrentOpenedFile() {
        // const file =  this.app.workspace.getActiveFile()

        // const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        // const isFile = view?.file?.path
        // // console.log("is file",view?.file)

        // if (isFile) {
        //     const activeFile = this.app.workspace.getActiveFile()
        //     return activeFile
        // } else {
        //     return null
        // }

        const activeFile = this.app.workspace.getActiveFile()
        if (activeFile instanceof TFile) {

            return activeFile
        } else {
            return null
        }
    }


    focusFile(filePath: string, paneType: PaneType | null) {
        const targetFile = this.app.vault.getAbstractFileByPath(filePath)
        if (!targetFile) return

        if (targetFile instanceof TFile) {

            if (paneType) {
                const otherLeaf = this.app.workspace.getLeaf(paneType);
                otherLeaf?.openFile(targetFile, { active: true })

            } else {
                const currentLeaf = this.app.workspace.getMostRecentLeaf()
                currentLeaf?.openFile(targetFile, { active: true })
            }
        }


    }

    registerCommands() {
        this.addCommand({
            id: 'open-note-suggestion',
            name: 'Side pane',
            callback: () => { this.activeView() }
        })

        this.addCommand({
            id: 'open-search-note-suggestion',
            name: 'Search Related notes',
            callback: () => {
                new SearchNoteModal(this)
                    .open()
            }
        })
    }

    async activeView() {
        this.app.workspace.detachLeavesOfType(SIDE_PANE_VIEW_TYPE)

        await this.app.workspace.getRightLeaf(false)
            .setViewState({
                type: SIDE_PANE_VIEW_TYPE,
                active: true
            })

        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(SIDE_PANE_VIEW_TYPE)[0]
        );
    }

    async onunload() {
        // console.log("on onload plugin")
    }
}
