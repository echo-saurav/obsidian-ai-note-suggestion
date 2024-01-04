import { ItemView, MarkdownView, WorkspaceLeaf } from "obsidian";
import MyPlugin, { SIDE_PANE_HOVER_ID, WeaviateFile } from "./main";
export const SIDE_PANE_VIEW_TYPE = "similar-notes";

export class SidePane extends ItemView {
    listEl: HTMLElement;
    leaf: WorkspaceLeaf;
    myPlugin: MyPlugin;

    constructor(leaf: WorkspaceLeaf, myplugin: MyPlugin) {
        super(leaf);
        this.leaf = leaf
        this.myPlugin = myplugin

        const container = this.containerEl.children[1];
        this.listEl = container.createDiv()
    }



    async onOpen() {
        this.updateView()

        this.registerEvent(this.app.workspace.on('active-leaf-change', f => {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const isFile = view?.file?.path

            if (isFile) {
                this.updateView()
            }
        }))

        this.registerEvent(this.app.vault.on('create',
            () => { this.updateView() }))
        this.registerEvent(this.app.vault.on('modify',
            () => { this.updateView() }))
        this.registerEvent(this.app.vault.on('rename',
            () => { this.updateView() }))
        this.registerEvent(this.app.vault.on('delete',
            () => { this.updateView() }))
        // this.registerEvent(this.app.workspace.on('active-leaf-change',
        //     () => { this.updateView() }))
        this.registerEvent(this.app.workspace.on('file-open',
            () => { this.updateView() }))

    }

    async updateView() {
        if (!this.listEl) return

        const currentFile = this.myPlugin.getCurrentOpenedFile()
        if (!currentFile) return


        

        this.myPlugin.vectorServer.getExtensionNoteList(currentFile)
        .then((similarFiles) => {
            if (!similarFiles) return


            const fileFromDatabase: WeaviateFile[] = similarFiles['data']['Get'][this.myPlugin.settings.weaviateClass]
            const cleanFileList: WeaviateFile[] = fileFromDatabase.filter(item => currentFile.path && currentFile.path != item.path)

            console.log("clean", cleanFileList.length)

            this.listEl.empty()
            // set heading
            const heading = this.listEl.createEl('div',{cls:"ai_heading"})
            heading.createEl("h5",{text:"Related notes for",cls:"ai_title"})
            heading.createEl("p",{text:currentFile?.basename,cls:"ai_title_path"})

            cleanFileList.map((file) => {
                const file_name = file.filename
                const file_similarity = this.myPlugin.vectorServer.convertToSimilarPercentage(file._additional.distance)
                const opacity_val = parseFloat(file_similarity) * .01


                const itemElement = this.listEl.createEl("div", { cls: "ai_note_side_pane" })

                itemElement.createEl("p", { text: file_name, cls: "file_name" })
                itemElement.createEl("p", { text: file_similarity, cls: "file_percent" })
                itemElement.style.opacity = `${opacity_val}`
                // click event
                itemElement.addEventListener('click', () => {
                    this.myPlugin.focusFile(file.path, null)
                })
    
                itemElement.addEventListener('mouseenter',(event)=>{
                    this.myPlugin.app.workspace.trigger("hover-link",{
                        source: SIDE_PANE_HOVER_ID,
                        event:event,
                        hoverParent: itemElement.parentElement,
                        targetEl: itemElement,
                        linktext: file.filename,
                        sourcePath: file.path
                    })
                })

            })


        })
    }



    getViewType(): string {
        return SIDE_PANE_VIEW_TYPE
    }
    async onClose() {
        // Nothing to clean up.
        console.log("close side pane")

    }

    getDisplayText() {
        return "Suggestion"
    }

    getIcon(): string {
        return "search"
    }

}