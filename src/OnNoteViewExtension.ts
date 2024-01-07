import {
    ViewUpdate,
    PluginValue,
    EditorView,
    ViewPlugin
} from "@codemirror/view";
import MyPlugin, { SIDE_PANE_HOVER_ID, WeaviateFile } from "./main"
import { TFile, editorInfoField } from "obsidian";


export const GetOnNoteViewExtension = (myPlugin: MyPlugin) =>
    ViewPlugin.fromClass(class OnNoteViewExtension implements PluginValue {
        el: HTMLElement
        currentFilePath: string
        view: EditorView

        constructor(view: EditorView) {
            this.view = view
            const oldEl = view.dom.querySelector("#on_note_suggestions") as HTMLElement

            // reuse old element
            if (oldEl) {
                this.el = oldEl
                this.updateList()
                return
            }

            // create a note suggestion element at top
            const parent = view.dom.querySelector(".cm-sizer")
            const addTextBeforeThis = view.dom.querySelector(".cm-contentContainer");

            this.el = document.createElement("div")
            this.el.id = "on_note_suggestions"


            if (addTextBeforeThis) {
                parent?.insertBefore(this.el, addTextBeforeThis)
            }


            myPlugin.registerEvent(myPlugin.app.vault.on('create', () => { this.updateList() }))
            myPlugin.registerEvent(myPlugin.app.vault.on('modify', () => { this.updateList() }))
            myPlugin.registerEvent(myPlugin.app.vault.on('delete', () => { this.updateList() }))
            // myPlugin.registerEvent(myPlugin.app.vault.on('rename', () => { this.updateList() }))
            // myPlugin.registerEvent(myPlugin.app.workspace.on('file-open', () => { this.updateList() }))
            this.updateList()


        }

        getCurrentFile() {
            const currentFile = this.view.state.field(editorInfoField).file;
            if (currentFile instanceof TFile) {
                return currentFile
            } else {
                return null
            }
        }


        async update(update: ViewUpdate): Promise<void> {
            // this.updateList()
        }

        async updateList() {
            if (!myPlugin.settings.inDocMatchNotes) return
            const currentFile = this.getCurrentFile()
            if (!currentFile) return


            this.el.createEl('small', { text: `Loading related notes for ${currentFile.path}...` })

            // showed cached version fist
            this.el.empty()
            const cachedFiles = await myPlugin.vectorServer.getCachedNoteList(currentFile)
            cachedFiles.map(cacheFile => {
                this.populateItem(cacheFile,true)
            })


            myPlugin.vectorServer.getExtensionNoteList(currentFile)
                .then((similarFiles) => {
                    if (!similarFiles) return


                    const fileFromDatabase: WeaviateFile[] = similarFiles['data']['Get'][myPlugin.settings.weaviateClass]
                    const cleanFileList: WeaviateFile[] = fileFromDatabase.filter(item => currentFile.path && currentFile.path != item.path)

                    // save cache result
                    myPlugin.vectorServer.addCachedNoteList(currentFile, cleanFileList)

                    this.el.empty()
                    cleanFileList.map((file) => {
                        this.populateItem(file, false)
                    })
                })

        }

        populateItem(file: WeaviateFile, isCached: boolean) {
            const file_name = file.filename
            const file_similarity = myPlugin.vectorServer.convertToSimilarPercentage(file._additional.distance)
            // const opacity_val = parseFloat(file_similarity) * .01
            // itemElement.style.opacity = `${opacity_val}`

            if (isCached) {

                const itemElement = this.el.createEl("a",
                    { "text": file_name, "href": file.path, cls: ["on_note_suggestions_item", "cached_item"] }
                )

                itemElement.addEventListener('click', (event: MouseEvent) => {
                    myPlugin.focusFile(file.path, null)
                });

                itemElement.addEventListener('mouseenter', (event) => {
                    myPlugin.app.workspace.trigger("hover-link", {
                        source: SIDE_PANE_HOVER_ID,
                        event: event,
                        hoverParent: itemElement.parentElement,
                        targetEl: itemElement,
                        linktext: file_name,
                        sourcePath: file.path
                    })
                })

            } else {
                const itemElement = this.el.createEl("a",
                    { "text": file_name, "href": file.path, cls: "on_note_suggestions_item" }
                )

                itemElement.addEventListener('click', (event: MouseEvent) => {
                    myPlugin.focusFile(file.path, null)
                });

                itemElement.addEventListener('mouseenter', (event) => {
                    myPlugin.app.workspace.trigger("hover-link", {
                        source: SIDE_PANE_HOVER_ID,
                        event: event,
                        hoverParent: itemElement.parentElement,
                        targetEl: itemElement,
                        linktext: file_name,
                        sourcePath: file.path
                    })
                })
            }





        }

        destroy(): void {

            if (this.view.dom.querySelector("#on_note_suggestions")) {
                // console.log("clear suggestion")
                this.view.dom.querySelector("#on_note_suggestions")?.empty()
            }
        }

    })