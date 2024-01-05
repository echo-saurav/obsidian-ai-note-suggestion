import { MarkdownView, PaneType, Plugin, TFile } from "obsidian";
import { SIDE_PANE_VIEW_TYPE, SidePane } from "./SidePane"
import { GetOnNoteViewExtension } from "./OnNoteViewExtension";
import { GetSearchCodeBlock } from "./SearchCodeBlock";
import { MySettings } from "./SettingTab";
import VectorServer from "./VectorServer";
import { SearchNoteModal } from "./SearchNoteModal";

const DEFAULT_SETTINGS: MyPluginSettings = {
    weaviateAddress: 'http://localhost:3636',
    weaviateClass: 'ObsidianVectors',
    limit: 30,
    inDocMatchNotes: true,
    showPercentageOnCodeQuery: false,
    autoCut: 0,
    distanceLimit: 0
}

interface MyPluginSettings {
    weaviateAddress: string
    weaviateClass: string
    limit: number
    inDocMatchNotes: boolean
    showPercentageOnCodeQuery: boolean
    autoCut: number
    distanceLimit: number
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

export default class MyPlugin extends Plugin {
    statusBarItemEl: HTMLElement
    settings: MyPluginSettings
    vectorServer: VectorServer


    async onload() {
        console.log("init Plugin")
        await this.loadSettings()
        this.addSettingTab(new MySettings(this.app, this))
        this.statusBarItemEl = this.addStatusBarItem()
        this.registerView(SIDE_PANE_VIEW_TYPE, (leaf) => new SidePane(leaf, this))
        this.registerMarkdownCodeBlockProcessor("match", GetSearchCodeBlock(this))
        this.registerEditorExtension(GetOnNoteViewExtension(this));
        // show on hover settings
        this.registerHoverLinkSource(SIDE_PANE_HOVER_ID, {
            display: 'AI Note suggestions',
            defaultMod: true,
        })
        this.registerHoverLinkSource(CODE_HOVER_ID, {
            display: 'AI Note suggestions (Code block)',
            defaultMod: true,
        })

        this.app.workspace.onLayoutReady(() => {
            this.registerEvents()
            this.registerCommands()

            this.vectorServer = new VectorServer(
                this.settings.weaviateAddress,
                this.settings.weaviateClass,
                this.settings.limit,
                this
            )
            this.scanVault()
        })

    }

    async onCreate(file: TFile) {
        const fileContent = await this.app.vault.cachedRead(file as TFile)
        console.log("new file content", fileContent)
        if (fileContent) this.vectorServer.onUpdateFile(fileContent, file.path, file.basename, file.stat.mtime)
    }

    async onModify(file: TFile) {
        const fileContent = await this.app.vault.cachedRead(file as TFile)
        console.log("modify content", fileContent)

        if (fileContent) this.vectorServer.onUpdateFile(fileContent, file.path, file.basename, file.stat.mtime)
        else this.vectorServer.onDeleteFile(file.path)

    }

    async onRename(file: TFile, oldPath: string) {
        console.log("old path", oldPath)
        console.log("new path", file.path)
        this.vectorServer.onRename(file.path, file.basename, file.stat.mtime, oldPath)
    }

    async onDelete(file: TFile) {
        console.log("delete path", file)
        this.vectorServer.onDeleteFile(file.path)
    }


    // initial scan ran on load and on setting changed 
    async scanVault() {
        const files = this.app.vault.getMarkdownFiles()
        console.log("file scan size", files.length)
        const fileCountOnServer = await this.vectorServer.countOnDatabase()

        // push new file
        files.map(async (file, index) => {
            const content = await this.app.vault.cachedRead(file)
            if (content) {
                this.vectorServer.onUpdateFile(content, file.path, file.basename, file.stat.mtime)
                // console.log("update file", file)
            }

        })
        // delete old file
        if (fileCountOnServer > files.length) {
            const weaviateFiles: WeaviateFile[] = await this.vectorServer.readAllPaths()
            const extraFiles = this.findExtraFiles(weaviateFiles, files)
            extraFiles.map(extra => {
                this.vectorServer.onDeleteFile(extra.path)
            })
        }

    }


    findExtraFiles(weaviateFiles: WeaviateFile[], localFiles: TFile[]) {
        const extraFiles = weaviateFiles.filter((weaviateFile) => !localFiles.some((file) => file.path === weaviateFile.path));
        return extraFiles
    }

    registerEvents() {
        console.log("register events")

        this.registerEvent(this.app.vault.on('create',
            (file) => { this.onCreate(file as TFile) }))
        this.registerEvent(this.app.vault.on('modify',
            (file) => { this.onModify(file as TFile) }))
        this.registerEvent(this.app.vault.on('rename',
            (file, oldPath) => { this.onRename(file as TFile, oldPath) }))
        this.registerEvent(this.app.vault.on('delete',
            (file) => { this.onDelete(file as TFile) }))
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        console.log("save settings")
    }

    getCurrentOpenedFile() {

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const isFile = view?.file?.path

        if (isFile) {
            const activeFile = this.app.workspace.getActiveFile()
            return activeFile
        } else {
            return null
        }
    }


    focusFile(filePath: string, paneType: PaneType | null) {
        const targetFile = this.app.vault.getAbstractFileByPath(filePath) as TFile
        if (!targetFile) return

        if (paneType) {
            const otherLeaf = this.app.workspace.getLeaf(paneType);
            otherLeaf?.openFile(targetFile, { active: true })

        } else {
            const currentLeaf = this.app.workspace.getMostRecentLeaf()
            currentLeaf?.openFile(targetFile, { active: true })

        }

    }

    registerCommands() {
        this.addCommand({
            id: 'open-note-suggestion',
            name: 'Related note side pane',
            callback: () => { this.activeView() }
        })

        this.addCommand({
            id: 'open-note-suggestion',
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
        console.log("on onload plugin")
    }
}